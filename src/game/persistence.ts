import { createArtifactInventory, getArtifact, isValidArtifactInventory, synchronizeHeroMana } from './artifacts';
import { BUILDINGS, CREATURES, HEROES, TERRAIN } from './content';
import { isLandmarkType } from './landmarks';
import {
  CORE_RESOURCE_TYPES,
  createExtendedResourceBundle,
  EXTENDED_RESOURCE_TYPES as RESOURCE_TYPES,
  NEW_RESOURCES,
  NEW_RESOURCE_TYPES,
} from './resources';
import { getReachableTiles } from './pathfinding';
import { isCombatSpellId } from './spellbook';
import type { AdventureMap, BattleSide, GameState, HeroState, Point } from './types';

export const SAVE_KEY_PREFIX = 'h3core.save.v1.';

const PRIMARY_SKILLS = ['attack', 'defense', 'spellPower', 'knowledge'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwnRecord(record: Record<string, unknown>, id: unknown): id is string {
  return typeof id === 'string' && Object.hasOwn(record, id) && isRecord(record[id]);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}

function validResources(value: unknown): boolean {
  return isRecord(value) && CORE_RESOURCE_TYPES.every((resource) => Object.hasOwn(value, resource)) &&
    Object.entries(value).every(([resource, amount]) =>
      RESOURCE_TYPES.some((type) => type === resource) && isNonNegativeInteger(amount));
}

function validResourceCost(value: unknown): boolean {
  return isRecord(value) && Object.entries(value).every(([resource, amount]) =>
    RESOURCE_TYPES.some((type) => type === resource) && isNonNegativeInteger(amount));
}

function validPrimarySkills(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === PRIMARY_SKILLS.length &&
    PRIMARY_SKILLS.every((skill) => Object.hasOwn(value, skill) && isNonNegativeInteger(value[skill]));
}

function validArmy(value: unknown): boolean {
  return Array.isArray(value) && value.every((stack) =>
    isRecord(stack) && typeof stack.creatureId === 'string' && Object.hasOwn(CREATURES, stack.creatureId) &&
    isNonNegativeInteger(stack.count));
}

function validPoint(value: unknown, width: number, height: number): boolean {
  if (!isRecord(value)) return false;
  const { x, y } = value;
  return isNonNegativeInteger(x) && isNonNegativeInteger(y) && x < width && y < height;
}

function validTileIndices(value: unknown, tileCount: number): boolean {
  if (!Array.isArray(value)) return false;
  const indices = new Set(value);
  return indices.size === value.length && value.every((index) =>
    isNonNegativeInteger(index) && index < tileCount);
}

function validPlayer(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' &&
    typeof value.color === 'string' && typeof value.isAI === 'boolean' && validResources(value.resources);
}

function validMapObject(value: unknown, players: Record<string, unknown>, width: number, height: number): boolean {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' ||
    !validPoint(value.position, width, height) || typeof value.kind !== 'string') return false;
  if (value.kind === 'resource') return validResourceCost(value.resources);
  if (value.kind === 'artifact') return typeof value.artifactId === 'string' && Boolean(getArtifact(value.artifactId));
  if (value.kind === 'mine') {
    return (value.ownerId === null || hasOwnRecord(players, value.ownerId)) &&
      typeof value.resource === 'string' && RESOURCE_TYPES.some((resource) => resource === value.resource) &&
      isPositiveInteger(value.dailyOutput);
  }
  if (value.kind === 'dwelling') {
    return typeof value.creatureId === 'string' && Object.hasOwn(CREATURES, value.creatureId) &&
      isNonNegativeInteger(value.available);
  }
  if (value.kind === 'monster') {
    return validArmy(value.army) && isNonNegativeInteger(value.experienceReward) &&
      validResourceCost(value.treasure);
  }
  if (value.kind === 'landmark') {
    if (typeof value.landmarkId !== 'string' || !isLandmarkType(value.landmarkId) ||
      !isRecord(value.visits) || typeof value.depleted !== 'boolean') return false;
    const visitsValid = Object.entries(value.visits).every(([heroId, day]) =>
      heroId.length > 0 && isPositiveInteger(day));
    const linkValid = value.landmarkId === 'wayfarerPortal'
      ? typeof value.linkedObjectId === 'string' && value.linkedObjectId.length > 0
      : value.linkedObjectId === null;
    return visitsValid && linkValid;
  }
  return value.kind === 'town' && typeof value.townId === 'string';
}

function validPortalLinks(objects: Record<string, unknown>): boolean {
  return Object.values(objects).every((object) => {
    if (!isRecord(object) || object.kind !== 'landmark' || object.landmarkId !== 'wayfarerPortal') return true;
    if (typeof object.id !== 'string' || typeof object.linkedObjectId !== 'string' ||
      object.linkedObjectId === object.id || !hasOwnRecord(objects, object.linkedObjectId)) return false;
    const linked = objects[object.linkedObjectId];
    return isRecord(linked) && linked.kind === 'landmark' && linked.landmarkId === 'wayfarerPortal' &&
      linked.linkedObjectId === object.id;
  });
}

function validHero(
  value: unknown,
  players: Record<string, unknown>,
  width: number,
  height: number,
): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.definitionId === 'string' &&
    Object.hasOwn(HEROES, value.definitionId) && typeof value.name === 'string' &&
    hasOwnRecord(players, value.ownerId) && validPoint(value.position, width, height) &&
    isPositiveInteger(value.level) && isNonNegativeInteger(value.experience) &&
    validPrimarySkills(value.primarySkills) && isNonNegativeInteger(value.mana) &&
    isPositiveInteger(value.maxMana) && isNonNegativeInteger(value.movementPoints) &&
    isPositiveInteger(value.maxMovementPoints) && validArmy(value.army) && Array.isArray(value.spells) &&
    new Set(value.spells).size === value.spells.length &&
    value.spells.every((spell) => typeof spell === 'string' && isCombatSpellId(spell)) &&
    (value.artifacts === undefined || isValidArtifactInventory(value.artifacts)) &&
    typeof value.alive === 'boolean';
}

function validTown(
  value: unknown,
  players: Record<string, unknown>,
  width: number,
  height: number,
): boolean {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' ||
    !hasOwnRecord(players, value.ownerId) || typeof value.faction !== 'string' ||
    !validPoint(value.position, width, height) || !Array.isArray(value.buildings) ||
    !validArmy(value.garrison) || !isRecord(value.dwellingPools) || typeof value.builtToday !== 'boolean') return false;
  const buildings = new Set(value.buildings);
  if (buildings.size !== value.buildings.length || !value.buildings.every((building) =>
    typeof building === 'string' && Object.hasOwn(BUILDINGS, building))) return false;
  return Object.entries(value.dwellingPools).every(([creatureId, count]) =>
    Object.hasOwn(CREATURES, creatureId) && isNonNegativeInteger(count));
}

function validBattleSide(value: unknown, players: Record<string, unknown>): boolean {
  if (!isRecord(value) || typeof value.ownerId !== 'string' ||
    (value.ownerId !== 'neutral' && !hasOwnRecord(players, value.ownerId)) ||
    (value.heroId !== null && typeof value.heroId !== 'string') ||
    !validPrimarySkills(value.primarySkills) || !validArmy(value.army)) return false;
  if (value.spells !== undefined && (!Array.isArray(value.spells) ||
    new Set(value.spells).size !== value.spells.length ||
    !value.spells.every((spell) => typeof spell === 'string' && isCombatSpellId(spell)))) return false;
  if (value.maxMana !== undefined && !isNonNegativeInteger(value.maxMana)) return false;
  if (value.mana !== undefined && (!isNonNegativeInteger(value.mana) ||
    typeof value.maxMana !== 'number' || value.mana > value.maxMana)) return false;
  return true;
}

function validBattleRewards(value: unknown): boolean {
  return isRecord(value) && isNonNegativeInteger(value.experience) && validResourceCost(value.resources);
}

function validPendingBattle(
  value: unknown,
  players: Record<string, unknown>,
  heroes: Record<string, unknown>,
  towns: Record<string, unknown>,
  objects: Record<string, unknown>,
): boolean {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.seed !== 'string' ||
    !isRecord(value.source) || !validBattleSide(value.attacker, players) ||
    !validBattleSide(value.defender, players) || !validBattleRewards(value.rewards)) return false;
  const { source } = value;
  if ((source.kind !== 'monster' && source.kind !== 'town') || typeof source.heroId !== 'string' ||
    typeof source.objectId !== 'string') return false;
  if (!hasOwnRecord(heroes, source.heroId) || !hasOwnRecord(objects, source.objectId)) return false;
  const hero = heroes[source.heroId];
  const object = objects[source.objectId];
  if (!isRecord(hero) || !isRecord(object) || object.kind !== source.kind) return false;
  if (!isRecord(value.attacker) || value.attacker.heroId !== source.heroId ||
    value.attacker.ownerId !== hero.ownerId) return false;
  if (!isRecord(value.defender) || value.defender.heroId !== null) return false;
  if (source.kind === 'monster') return value.defender.ownerId === 'neutral';
  if (!hasOwnRecord(towns, object.townId)) return false;
  const town = towns[object.townId as string];
  return isRecord(town) && value.defender.ownerId === town.ownerId;
}

export function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || value.version !== 1 || typeof value.seed !== 'string' || !isRecord(value.map)) return false;
  const { map } = value;
  const { width, height, tiles } = map;
  if (!isPositiveInteger(width) || !isPositiveInteger(height) || width < 32 || height < 24 ||
    map.seed !== value.seed || !Array.isArray(tiles) || tiles.length !== width * height ||
    !isRecord(map.objects)) return false;

  if (!isRecord(value.players) || !Array.isArray(value.playerOrder) || value.playerOrder.length < 2) return false;
  const players = value.players;
  const playerOrder = value.playerOrder;
  if (Object.keys(players).length !== playerOrder.length || new Set(playerOrder).size !== playerOrder.length ||
    !playerOrder.every((id) => hasOwnRecord(players, id) && validPlayer(players[id]) &&
      (players[id] as Record<string, unknown>).id === id)) return false;
  if (typeof value.activePlayerId !== 'string' || !playerOrder.includes(value.activePlayerId)) return false;

  const objects = map.objects;
  if (!Object.entries(objects).every(([id, object]) => validMapObject(object, players, width, height) &&
    (object as Record<string, unknown>).id === id) || !validPortalLinks(objects)) return false;
  const tilesValid = tiles.every((tile, index) => {
    if (!isRecord(tile) || tile.x !== index % width || tile.y !== Math.floor(index / width) ||
      typeof tile.terrain !== 'string' || !Object.hasOwn(TERRAIN, tile.terrain) ||
      typeof tile.road !== 'boolean' || typeof tile.obstacle !== 'boolean') return false;
    if (tile.objectId === null) return true;
    if (!hasOwnRecord(objects, tile.objectId)) return false;
    const object = objects[tile.objectId];
    return isRecord(object) && isRecord(object.position) && object.position.x === tile.x && object.position.y === tile.y;
  });
  if (!tilesValid || !Object.entries(objects).every(([id, object]) => {
    if (!isRecord(object) || !isRecord(object.position)) return false;
    const index = (object.position.y as number) * width + (object.position.x as number);
    const tile = tiles[index];
    return isRecord(tile) && tile.objectId === id;
  })) return false;

  if (!isRecord(value.heroes) || !Object.entries(value.heroes).every(([id, hero]) =>
    validHero(hero, players, width, height) && (hero as Record<string, unknown>).id === id)) return false;
  const heroes = value.heroes;
  if (value.selectedHeroId !== null && !hasOwnRecord(heroes, value.selectedHeroId)) return false;
  if (!isRecord(value.towns) || !Object.entries(value.towns).every(([id, town]) =>
    validTown(town, players, width, height) && (town as Record<string, unknown>).id === id)) return false;
  const towns = value.towns;
  if (!Object.entries(towns).every(([id, town]) => {
    const object = Object.values(objects).find((candidate) => isRecord(candidate) &&
      candidate.kind === 'town' && candidate.townId === id);
    return isRecord(object) && isRecord(town) && JSON.stringify(object.position) === JSON.stringify(town.position);
  }) || !Object.values(objects).every((object) => !isRecord(object) || object.kind !== 'town' ||
    hasOwnRecord(towns, object.townId))) return false;

  if (!isRecord(value.fog) || Object.keys(value.fog).length !== playerOrder.length) return false;
  const fog = value.fog;
  if (!playerOrder.every((id) => {
    if (!hasOwnRecord(fog, id)) return false;
    const playerFog = fog[id];
    if (!isRecord(playerFog) || !validTileIndices(playerFog.visible, tiles.length) ||
      !validTileIndices(playerFog.explored, tiles.length)) return false;
    const explored = new Set(playerFog.explored as unknown[]);
    return (playerFog.visible as unknown[]).every((index) => explored.has(index));
  })) return false;

  if (!isRecord(value.calendar)) return false;
  const { day, week, month, dayOfWeek } = value.calendar;
  if (!isPositiveInteger(day) || !isPositiveInteger(week) || !isPositiveInteger(month) ||
    !isPositiveInteger(dayOfWeek) || dayOfWeek > 7 || dayOfWeek !== ((day - 1) % 7) + 1 ||
    week !== Math.floor((day - 1) / 7) + 1 || month !== Math.floor((day - 1) / 28) + 1) return false;
  if (!Array.isArray(value.log) || !value.log.every((event) => isRecord(event) &&
    isPositiveInteger(event.day) && typeof event.kind === 'string' && typeof event.message === 'string')) return false;
  if (!isNonNegativeInteger(value.rngState) || !isNonNegativeInteger(value.revision)) return false;
  if (value.phase !== 'playing' && value.phase !== 'victory' && value.phase !== 'defeat') return false;
  if (value.winnerId !== null && !hasOwnRecord(players, value.winnerId)) return false;
  if ((value.phase === 'playing') !== (value.winnerId === null)) return false;
  return value.pendingBattle === null || validPendingBattle(value.pendingBattle, players, heroes, towns, objects);
}

function migrateHero(hero: HeroState): void {
  if (!hero.artifacts) hero.artifacts = createArtifactInventory();
  else hero.artifacts = {
    items: { ...hero.artifacts.items },
    equipped: { ...hero.artifacts.equipped },
  };
  hero.spells = [...hero.spells];
  synchronizeHeroMana(hero);
}

function migrateBattleSide(side: BattleSide, hero: HeroState | undefined): void {
  if (!hero) return;
  side.spells = [...(side.spells ?? hero.spells)];
  side.maxMana = side.maxMana ?? hero.maxMana;
  side.mana = Math.min(side.mana ?? hero.mana, side.maxMana);
}

function findLegacyMinePosition(map: AdventureMap, preferred: Point, reachable: ReadonlySet<number>): Point {
  const tile = map.tiles
    .filter((candidate) => !candidate.obstacle && candidate.objectId === null &&
      reachable.has(candidate.y * map.width + candidate.x))
    .sort((a, b) => Number(b.road) - Number(a.road) ||
      Math.abs(a.x - preferred.x) + Math.abs(a.y - preferred.y) -
        (Math.abs(b.x - preferred.x) + Math.abs(b.y - preferred.y)) ||
      a.y - b.y || a.x - b.x)[0];
  if (!tile) throw new Error('Unable to migrate expanded-resource mines onto the legacy map');
  return { x: tile.x, y: tile.y };
}

function migrateLegacyResourceSources(state: GameState): void {
  const { map } = state;
  const roadY = Math.floor(map.height / 2);
  const roadX = Math.floor(map.width / 2);
  const anchor = Object.values(state.heroes).find((hero) => hero.alive)?.position ??
    Object.values(map.objects).find((object) => object.kind === 'town')?.position ?? { x: 0, y: 0 };
  const reachable = new Set(getReachableTiles(map, anchor, Number.POSITIVE_INFINITY)
    .map((tile) => tile.tileIndex));
  const preferredPositions: readonly Point[] = [
    { x: 9, y: roadY + 6 },
    { x: roadX + 7, y: roadY - 6 },
    { x: map.width - 10, y: roadY + 6 },
  ];
  for (const [index, resource] of NEW_RESOURCE_TYPES.entries()) {
    const hasMine = Object.values(map.objects).some((object) =>
      object.kind === 'mine' && object.resource === resource);
    if (hasMine) continue;
    const baseId = `${resource}-mine`;
    const id = Object.hasOwn(map.objects, baseId) ? `legacy-${baseId}` : baseId;
    if (Object.hasOwn(map.objects, id)) throw new Error(`Unable to migrate legacy resource mine: ${id}`);
    const position = findLegacyMinePosition(
      map,
      preferredPositions[index] ?? { x: roadX, y: roadY },
      reachable,
    );
    const definition = NEW_RESOURCES[resource];
    map.objects[id] = {
      id,
      kind: 'mine',
      name: `${definition.name} Mine`,
      ownerId: null,
      resource,
      dailyOutput: definition.mineDailyOutput,
      position,
    };
    const tile = map.tiles[position.y * map.width + position.x];
    if (!tile) throw new Error(`Legacy resource mine is outside the map: ${id}`);
    tile.objectId = id;
  }
}

function migrateGameState(state: GameState): GameState {
  for (const player of Object.values(state.players)) {
    player.resources = createExtendedResourceBundle(player.resources);
  }
  migrateLegacyResourceSources(state);
  for (const hero of Object.values(state.heroes)) migrateHero(hero);
  if (state.pendingBattle) {
    migrateBattleSide(
      state.pendingBattle.attacker,
      state.heroes[state.pendingBattle.attacker.heroId ?? ''],
    );
    migrateBattleSide(
      state.pendingBattle.defender,
      state.heroes[state.pendingBattle.defender.heroId ?? ''],
    );
  }
  return state;
}

export function serializeGameState(state: GameState): string {
  return JSON.stringify(state);
}

export function parseGameState(serialized: string): GameState {
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isGameState(parsed)) throw new Error('Save data is not a valid H3CORE game');
    return migrateGameState(parsed);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to read save data');
  }
}
