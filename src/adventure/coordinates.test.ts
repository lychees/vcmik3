import { describe, expect, it } from 'vitest';
import { createAdventureMap } from '../game/map';
import { findPath } from '../game/pathfinding';
import {
  TILE_SIZE,
  deterministicNoise,
  terrainElevation,
  tileToWorld,
  tileWorldPath,
  worldToTile,
} from './coordinates';

describe('adventure coordinates', () => {
  it('centers the board and round-trips every corner', () => {
    const map = createAdventureMap('coordinates');
    expect(tileToWorld(map, { x: 0, y: 0 })).toEqual({
      x: -(map.width - 1) * TILE_SIZE / 2,
      y: 0,
      z: -(map.height - 1) * TILE_SIZE / 2,
    });
    for (const point of [
      { x: 0, y: 0 },
      { x: map.width - 1, y: 0 },
      { x: 0, y: map.height - 1 },
      { x: map.width - 1, y: map.height - 1 },
      { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) },
    ]) {
      const world = tileToWorld(map, point, 0.4);
      expect(world.y).toBe(0.4);
      expect(worldToTile(map, world.x, world.z)).toEqual(point);
    }
  });

  it('rejects coordinates outside the playable board', () => {
    const grid = { width: 4, height: 3 };
    const outside = tileToWorld(grid, { x: 4, y: 3 });
    expect(worldToTile(grid, outside.x, outside.z)).toBeNull();
    expect(worldToTile(grid, Number.NaN, 0)).toBeNull();
  });

  it('uses stable terrain elevations and deterministic decoration noise', () => {
    expect(terrainElevation('water')).toBeLessThan(terrainElevation('swamp'));
    expect(terrainElevation('mountain')).toBeGreaterThan(terrainElevation('grass'));
    const first = deterministicNoise('seed', 42, 7);
    expect(first).toBe(deterministicNoise('seed', 42, 7));
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(1);
    expect(first).not.toBe(deterministicNoise('seed', 43, 7));
  });

  it('presents every store path point at its own tile height', () => {
    const map = createAdventureMap('world-path');
    const start = { x: 3, y: Math.floor(map.height / 2) };
    const end = { x: 6, y: Math.floor(map.height / 2) };
    const path = findPath(map, start, end);
    expect(path).not.toBeNull();
    if (!path) return;
    const world = tileWorldPath(map, path.path, 0.05);
    expect(world).toHaveLength(path.path.length);
    const startTile = map.tiles[start.y * map.width + start.x]!;
    const endTile = map.tiles[end.y * map.width + end.x]!;
    expect(world[0]).toEqual(tileToWorld(map, start, terrainElevation(startTile.terrain) + 0.05));
    expect(world.at(-1)).toEqual(tileToWorld(map, end, terrainElevation(endTile.terrain) + 0.05));
    for (const point of world) expect(point.y).toBeGreaterThan(0.05);
  });
});
