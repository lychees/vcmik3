import { describe, expect, it } from 'vitest';
import { BUILDINGS, CREATURES, SPELLS } from './content';
import { createAdventureMap, toTileIndex } from './map';
import { findPath, getReachableTiles } from './pathfinding';
import { createInitialGameState } from './scenario';

describe('content and deterministic adventure maps', () => {
  it('provides distinct creatures, buildings, spells, and a reproducible populated map', () => {
    expect(Object.keys(CREATURES).length).toBeGreaterThanOrEqual(8);
    expect(new Set(Object.values(CREATURES).map((creature) => creature.name)).size).toBe(Object.keys(CREATURES).length);
    expect(Object.keys(BUILDINGS).length).toBeGreaterThanOrEqual(10);
    expect(Object.keys(SPELLS).length).toBeGreaterThanOrEqual(6);

    const first = createAdventureMap('north-reach');
    const second = createAdventureMap('north-reach');
    expect(first).toEqual(second);
    expect(createAdventureMap('south-reach')).not.toEqual(first);
    expect(first.width).toBeGreaterThanOrEqual(64);
    expect(first.height).toBeGreaterThanOrEqual(48);
    expect(first.tiles).toHaveLength(first.width * first.height);

    const objects = Object.values(first.objects);
    expect(objects.filter((object) => object.kind === 'town')).toHaveLength(13);
    expect(objects.filter((object) => object.kind === 'resource').length).toBeGreaterThanOrEqual(4);
    expect(objects.filter((object) => object.kind === 'mine').length).toBeGreaterThanOrEqual(3);
    expect(objects.filter((object) => object.kind === 'dwelling').length).toBeGreaterThanOrEqual(2);
    expect(objects.filter((object) => object.kind === 'monster').length).toBeGreaterThanOrEqual(3);
    expect(first.tiles.some((tile) => tile.road)).toBe(true);
    expect(first.tiles.some((tile) => tile.obstacle)).toBe(true);
    expect(new Set(first.tiles.map((tile) => tile.terrain)).size).toBeGreaterThanOrEqual(6);
    for (const object of objects) {
      expect(first.tiles[toTileIndex(first, object.position)]?.objectId).toBe(object.id);
    }
  });

  it('creates human and AI heroes with fog-of-war state', () => {
    const state = createInitialGameState('fog-seed');
    expect(state.heroes['hero-aveline']?.ownerId).toBe('red');
    expect(state.heroes['hero-rowan']?.ownerId).toBe('blue');
    expect(state.players['hero-rowan']).toBeUndefined();
    expect(state.fog.red?.visible.length).toBeGreaterThan(20);
    expect(state.fog.blue?.visible.length).toBeGreaterThan(20);
    expect(state.fog.red?.explored).toEqual(state.fog.red?.visible);
  });
});

describe('pathfinding', () => {
  it('uses road discounts and respects movement limits', () => {
    const map = createAdventureMap('roads');
    const roadY = Math.floor(map.height / 2);
    const roadPath = findPath(map, { x: 13, y: roadY }, { x: 15, y: roadY });
    expect(roadPath?.cost).toBe(100);
    expect(roadPath?.path).toHaveLength(3);

    const reachable = getReachableTiles(map, { x: 3, y: roadY - 2 }, 300);
    expect(reachable.length).toBeGreaterThan(1);
    expect(reachable.every((tile) => tile.cost <= 300)).toBe(true);
    expect(getReachableTiles(map, { x: 3, y: roadY - 2 }, 0)).toHaveLength(1);
  });

  it('connects every point of interest to the road network for arbitrary seeds', () => {
    for (const seed of ['alpha', 'beta', 'gamma']) {
      const map = createAdventureMap(seed);
      const start = { x: 3, y: Math.floor(map.height / 2) };
      for (const object of Object.values(map.objects)) {
        expect(findPath(map, start, object.position), `${seed}:${object.id}`).not.toBeNull();
      }
    }
  });

  it('rejects impassable destinations and blocked routes', () => {
    const map = createAdventureMap('blocked');
    expect(findPath(map, { x: 2, y: 2 }, { x: 0, y: 0 })).toBeNull();
    const blocked = new Set([toTileIndex(map, { x: 3, y: 2 })]);
    expect(findPath(map, { x: 2, y: 2 }, { x: 3, y: 2 }, { blockedTiles: blocked })).toBeNull();
  });
});
