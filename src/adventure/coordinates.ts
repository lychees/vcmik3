import type { AdventureMap as AdventureMapData, MapTile, Point, TerrainType } from '../game/types';

export const TILE_SIZE = 1.2;

export interface MapGrid {
  width: number;
  height: number;
}

export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

export function terrainElevation(terrain: TerrainType): number {
  switch (terrain) {
    case 'water': return -0.18;
    case 'swamp': return -0.035;
    case 'sand': return 0.015;
    case 'grass': return 0.075;
    case 'dirt': return 0.105;
    case 'forest': return 0.09;
    case 'mountain': return 0.13;
  }
}

export function tileElevation(tile: MapTile): number {
  return terrainElevation(tile.terrain);
}

export function tileToWorld(grid: MapGrid, point: Point, elevation = 0): WorldPoint {
  return {
    x: (point.x - (grid.width - 1) / 2) * TILE_SIZE,
    y: elevation,
    z: (point.y - (grid.height - 1) / 2) * TILE_SIZE,
  };
}

export function worldToTile(grid: MapGrid, x: number, z: number): Point | null {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
  const point = {
    x: Math.floor(x / TILE_SIZE + grid.width / 2),
    y: Math.floor(z / TILE_SIZE + grid.height / 2),
  };
  return point.x >= 0 && point.x < grid.width && point.y >= 0 && point.y < grid.height ? point : null;
}

export function tileWorldPath(map: AdventureMapData, path: readonly Point[], lift = 0): WorldPoint[] {
  const points: WorldPoint[] = [];
  for (const point of path) {
    const tile = map.tiles[point.y * map.width + point.x];
    if (!tile || tile.x !== point.x || tile.y !== point.y) continue;
    points.push(tileToWorld(map, point, tileElevation(tile) + lift));
  }
  return points;
}

export function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function deterministicNoise(seed: string, index: number, salt = 0): number {
  let hash = 2166136261 ^ salt;
  for (let cursor = 0; cursor < seed.length; cursor += 1) {
    hash ^= seed.charCodeAt(cursor);
    hash = Math.imul(hash, 16777619);
  }
  hash ^= index + 0x9e3779b9;
  hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad);
  hash = Math.imul(hash ^ (hash >>> 15), 0x735a2d97);
  return ((hash ^ (hash >>> 15)) >>> 0) / 4294967296;
}
