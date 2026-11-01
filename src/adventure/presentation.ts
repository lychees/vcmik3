import { getCreature } from '../game/content';
import { hasVisitedLandmark, isLandmarkUsed } from '../game/landmarks';
import type {
  GameState,
  HeroState,
  LandmarkType,
  MapObject,
  Point,
  ReachableTile,
  ResourceCost,
  TerrainType,
} from '../game/types';
import { TILE_SIZE, tileWorldPath, type WorldPoint } from './coordinates';

export interface TravelFrame {
  time: number;
  position: WorldPoint;
}

export interface TravelTimeline {
  duration: number;
  frames: TravelFrame[];
}

export function createTravelTimeline(
  state: Pick<GameState, 'map'>,
  path: readonly Point[],
  tilesPerSecond = 5.5,
): TravelTimeline {
  const points = tileWorldPath(state.map, path, 0.04);
  if (points.length === 0) return { duration: 0, frames: [] };
  const frames: TravelFrame[] = [{ time: 0, position: points[0] as WorldPoint }];
  let duration = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1] as WorldPoint;
    const current = points[index] as WorldPoint;
    const distance = Math.hypot(current.x - previous.x, current.z - previous.z);
    duration += distance / (TILE_SIZE * Math.max(0.1, tilesPerSecond));
    frames.push({ time: duration, position: current });
  }
  return { duration, frames };
}

export function sampleTravel(timeline: TravelTimeline, elapsed: number): WorldPoint | null {
  const first = timeline.frames[0];
  if (!first) return null;
  const last = timeline.frames[timeline.frames.length - 1] as TravelFrame;
  if (elapsed <= 0 || timeline.frames.length === 1) return { ...first.position };
  if (elapsed >= timeline.duration) return { ...last.position };
  for (let index = 1; index < timeline.frames.length; index += 1) {
    const next = timeline.frames[index] as TravelFrame;
    if (elapsed > next.time) continue;
    if (elapsed === next.time) return { ...next.position };
    const previous = timeline.frames[index - 1] as TravelFrame;
    const span = next.time - previous.time;
    const amount = span <= 0 ? 1 : (elapsed - previous.time) / span;
    return {
      x: previous.position.x + (next.position.x - previous.position.x) * amount,
      y: previous.position.y + (next.position.y - previous.position.y) * amount,
      z: previous.position.z + (next.position.z - previous.position.z) * amount,
    };
  }
  return { ...last.position };
}

export interface AdventureTileSnapshot {
  x: number;
  y: number;
  terrain: TerrainType;
  road: boolean;
  obstacle: boolean;
  visible: boolean;
  explored: boolean;
  reachable: boolean;
  movementCost: number | null;
  objectId: string | null;
  heroId: string | null;
}

export interface AdventureObjectSnapshot {
  id: string;
  kind: MapObject['kind'];
  name: string;
  position: Point;
  ownerId: string | null;
  visible: boolean;
  explored: boolean;
  landmarkId: LandmarkType | null;
  visited: boolean;
  depleted: boolean;
}

export interface AdventureHeroSnapshot {
  id: string;
  name: string;
  ownerId: string;
  position: Point;
  alive: boolean;
  visible: boolean;
  selected: boolean;
  movementPoints: number;
  maxMovementPoints: number;
}

export interface AdventureMapSnapshot {
  seed: string;
  width: number;
  height: number;
  tileSize: number;
  activePlayerId: string;
  selectedHeroId: string | null;
  tiles: AdventureTileSnapshot[];
  objects: AdventureObjectSnapshot[];
  heroes: AdventureHeroSnapshot[];
}

export function createMapSnapshot(
  state: Readonly<GameState>,
  reachable: readonly ReachableTile[] = [],
): AdventureMapSnapshot {
  const playerId = state.activePlayerId;
  const fog = Object.hasOwn(state.fog, playerId) ? state.fog[playerId] : undefined;
  const visible = new Set(fog?.visible ?? []);
  const explored = new Set(fog?.explored ?? []);
  const reach = new Map(reachable.map((tile) => [tile.tileIndex, tile.cost]));
  const heroAt = new Map<number, HeroState>();
  for (const hero of Object.values(state.heroes)) {
    if (hero.alive) heroAt.set(hero.position.y * state.map.width + hero.position.x, hero);
  }

  const tiles = state.map.tiles.map((tile, tileIndex) => {
    const hero = heroAt.get(tileIndex);
    const heroObservable = hero && (hero.ownerId === playerId || visible.has(tileIndex));
    return {
      x: tile.x,
      y: tile.y,
      terrain: tile.terrain,
      road: tile.road,
      obstacle: tile.obstacle,
      visible: visible.has(tileIndex),
      explored: explored.has(tileIndex),
      reachable: reach.has(tileIndex),
      movementCost: reach.get(tileIndex) ?? null,
      objectId: explored.has(tileIndex) ? tile.objectId : null,
      heroId: heroObservable ? hero.id : null,
    };
  });

  const objects = Object.values(state.map.objects).map((object): AdventureObjectSnapshot => {
    const tileIndex = object.position.y * state.map.width + object.position.x;
    let ownerId: string | null = null;
    if (object.kind === 'mine') ownerId = object.ownerId;
    if (object.kind === 'town') ownerId = state.towns[object.townId]?.ownerId ?? null;
    return {
      id: object.id,
      kind: object.kind,
      name: object.name,
      position: { ...object.position },
      ownerId,
      visible: visible.has(tileIndex),
      explored: explored.has(tileIndex),
      landmarkId: object.kind === 'landmark' ? object.landmarkId : null,
      visited: object.kind === 'landmark' && hasVisitedLandmark(object, state.selectedHeroId ?? ''),
      depleted: (object.kind === 'dwelling' && object.available <= 0) ||
        (object.kind === 'landmark' && isLandmarkUsed(object, state.selectedHeroId ?? '', state.calendar.day)),
    };
  });

  const heroes = Object.values(state.heroes).map((hero): AdventureHeroSnapshot => {
    const tileIndex = hero.position.y * state.map.width + hero.position.x;
    return {
      id: hero.id,
      name: hero.name,
      ownerId: hero.ownerId,
      position: { ...hero.position },
      alive: hero.alive,
      visible: hero.ownerId === playerId || visible.has(tileIndex),
      selected: state.selectedHeroId === hero.id,
      movementPoints: hero.movementPoints,
      maxMovementPoints: hero.maxMovementPoints,
    };
  });

  return {
    seed: state.seed,
    width: state.map.width,
    height: state.map.height,
    tileSize: TILE_SIZE,
    activePlayerId: playerId,
    selectedHeroId: state.selectedHeroId,
    tiles,
    objects,
    heroes,
  };
}

export function formatResources(resources: ResourceCost): string {
  return Object.entries(resources)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
    .map(([resource, amount]) => `${amount} ${resource}`)
    .join(', ');
}

export function describeArmy(army: readonly { creatureId: string; count: number }[]): string {
  if (army.length === 0) return 'No creatures';
  return army.map((stack) => `${stack.count} ${getCreature(stack.creatureId).name}`).join(', ');
}
