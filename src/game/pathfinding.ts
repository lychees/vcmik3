import { getTerrain } from './content';
import { fromTileIndex, getTile, isInsideMap, toTileIndex } from './map';
import type { AdventureMap, PathfindingOptions, PathResult, Point, ReachableTile } from './types';

const DIRECTIONS = [
  [-1, 0], [1, 0], [0, -1], [0, 1],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
] as const;

function movementCost(map: AdventureMap, from: Point, to: Point): number {
  const fromTile = getTile(map, from);
  const toTile = getTile(map, to);
  if (!fromTile || !toTile || toTile.obstacle) return Number.POSITIVE_INFINITY;
  const base = fromTile.road && toTile.road ? 50 : getTerrain(toTile.terrain).movementCost;
  return Math.ceil(base * (from.x !== to.x && from.y !== to.y ? 1.5 : 1));
}

function search(
  map: AdventureMap,
  start: Point,
  options: PathfindingOptions,
): { costs: number[]; previous: Array<number | null> } {
  const costs = new Array<number>(map.tiles.length).fill(Number.POSITIVE_INFINITY);
  const previous = new Array<number | null>(map.tiles.length).fill(null);
  const visited = new Array<boolean>(map.tiles.length).fill(false);
  if (!isInsideMap(map, start)) return { costs, previous };
  const startIndex = toTileIndex(map, start);
  const startTile = map.tiles[startIndex];
  if (!startTile || startTile.obstacle) return { costs, previous };
  const maxCost = options.maxCost ?? Number.POSITIVE_INFINITY;
  costs[startIndex] = 0;

  while (true) {
    let current = -1;
    let currentCost = Number.POSITIVE_INFINITY;
    for (let index = 0; index < costs.length; index += 1) {
      const cost = costs[index] ?? Number.POSITIVE_INFINITY;
      if (!visited[index] && cost < currentCost) {
        current = index;
        currentCost = cost;
      }
    }
    if (current < 0 || currentCost > maxCost) break;
    visited[current] = true;
    const position = fromTileIndex(map, current);
    for (const [dx, dy] of DIRECTIONS) {
      const next = { x: position.x + dx, y: position.y + dy };
      if (!isInsideMap(map, next)) continue;
      const nextIndex = toTileIndex(map, next);
      if (visited[nextIndex] || options.blockedTiles?.has(nextIndex)) continue;
      if (dx !== 0 && dy !== 0) {
        const horizontal = map.tiles[toTileIndex(map, { x: next.x, y: position.y })];
        const vertical = map.tiles[toTileIndex(map, { x: position.x, y: next.y })];
        if (horizontal?.obstacle || vertical?.obstacle) continue;
      }
      const stepCost = movementCost(map, position, next);
      const candidate = currentCost + stepCost;
      if (candidate > maxCost || candidate >= (costs[nextIndex] ?? Number.POSITIVE_INFINITY)) continue;
      costs[nextIndex] = candidate;
      previous[nextIndex] = current;
    }
  }
  return { costs, previous };
}

function buildPath(map: AdventureMap, start: Point, end: Point, previous: Array<number | null>): Point[] {
  const path: Point[] = [];
  let current: number | null = toTileIndex(map, end);
  const startIndex = toTileIndex(map, start);
  while (current !== null) {
    path.push(fromTileIndex(map, current));
    if (current === startIndex) break;
    current = previous[current] ?? null;
  }
  if (path[path.length - 1]?.x !== start.x || path[path.length - 1]?.y !== start.y) return [];
  return path.reverse();
}

export function findPath(
  map: AdventureMap,
  start: Point,
  end: Point,
  options: PathfindingOptions = {},
): PathResult | null {
  if (!isInsideMap(map, end)) return null;
  const { costs, previous } = search(map, start, options);
  const cost = costs[toTileIndex(map, end)] ?? Number.POSITIVE_INFINITY;
  if (!Number.isFinite(cost)) return null;
  return { path: buildPath(map, start, end, previous), cost };
}

export function getReachableTiles(
  map: AdventureMap,
  start: Point,
  movementPoints: number,
  options: Omit<PathfindingOptions, 'maxCost'> = {},
): ReachableTile[] {
  const { costs, previous } = search(map, start, { ...options, maxCost: movementPoints });
  const reachable: ReachableTile[] = [];
  for (let tileIndex = 0; tileIndex < costs.length; tileIndex += 1) {
    const cost = costs[tileIndex] ?? Number.POSITIVE_INFINITY;
    if (!Number.isFinite(cost)) continue;
    const position = fromTileIndex(map, tileIndex);
    reachable.push({ position, tileIndex, cost, path: buildPath(map, start, position, previous) });
  }
  return reachable;
}
