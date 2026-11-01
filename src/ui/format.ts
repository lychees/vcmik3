import { MAX_ARMY_STACKS } from '../game/army';
import {
  BUILDINGS,
  canAfford,
  getBuilding,
  getCreature,
} from '../game/content';
import { EXTENDED_RESOURCE_TYPES as RESOURCE_TYPES } from '../game/resources';
import { getObjectAt } from '../game/map';
import { experienceForLevel } from '../game/progression';
import type {
  ArmyStack,
  BuildingDefinition,
  CalendarState,
  GameState,
  HeroState,
  ResourceBundle,
  ResourceCost,
  ResourceType,
  TownState,
} from '../game/types';

const numberFormatter = new Intl.NumberFormat('en-US');

export const RESOURCE_META: Record<ResourceType, { name: string; shortName: string }> = {
  gold: { name: 'Gold', shortName: 'Gold' },
  wood: { name: 'Wood', shortName: 'Wood' },
  ore: { name: 'Ore', shortName: 'Ore' },
  crystal: { name: 'Crystal', shortName: 'Crystal' },
  gems: { name: 'Gems', shortName: 'Gems' },
  mercury: { name: 'Mercury', shortName: 'Mercury' },
  sulfur: { name: 'Sulfur', shortName: 'Sulfur' },
  mithril: { name: 'Mithril', shortName: 'Mithril' },
  obsidian: { name: 'Obsidian', shortName: 'Obsidian' },
  essence: { name: 'Essence', shortName: 'Essence' },
};

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatCalendar(calendar: CalendarState): string {
  return `Month ${calendar.month} · Week ${calendar.week} · ${DAY_NAMES[calendar.dayOfWeek - 1] ?? `Day ${calendar.dayOfWeek}`}`;
}

export function formatCalendarShort(calendar: CalendarState): string {
  return `M${calendar.month} W${calendar.week} D${calendar.dayOfWeek}`;
}

export function formatCost(cost: ResourceCost, empty = 'No cost'): string {
  const parts = RESOURCE_TYPES
    .filter((resource) => (cost[resource] ?? 0) !== 0)
    .map((resource) => `${formatNumber(cost[resource] ?? 0)} ${RESOURCE_META[resource].shortName.toLowerCase()}`);
  return parts.length > 0 ? parts.join(' · ') : empty;
}

export function multiplyCost(cost: ResourceCost, multiplier: number): ResourceCost {
  const result: ResourceCost = {};
  for (const resource of RESOURCE_TYPES) {
    const amount = cost[resource];
    if (amount !== undefined) result[resource] = amount * multiplier;
  }
  return result;
}

export function getMissingResources(resources: ResourceBundle, cost: ResourceCost): ResourceCost {
  const missing: ResourceCost = {};
  for (const resource of RESOURCE_TYPES) {
    const amount = Math.max(0, (cost[resource] ?? 0) - resources[resource]);
    if (amount > 0) missing[resource] = amount;
  }
  return missing;
}

export function hasResourceCost(cost: ResourceCost): boolean {
  return RESOURCE_TYPES.some((resource) => (cost[resource] ?? 0) > 0);
}

export function getDailyIncome(town: TownState): ResourceCost {
  const income: ResourceCost = {};
  for (const buildingId of town.buildings) {
    const building = getBuilding(buildingId);
    if (!building.dailyIncome) continue;
    for (const resource of RESOURCE_TYPES) {
      const amount = building.dailyIncome[resource] ?? 0;
      if (amount !== 0) income[resource] = (income[resource] ?? 0) + amount;
    }
  }
  return income;
}

export function getTownBuildings(town: TownState): BuildingDefinition[] {
  return Object.values(BUILDINGS).filter((building) => {
    if (town.buildings.includes(building.id) || !building.creatureId) return true;
    return getCreature(building.creatureId).faction === town.faction;
  });
}

export interface BuildingAvailability {
  status: 'built' | 'ready' | 'locked' | 'unaffordable' | 'wait';
  missingPrerequisites: BuildingDefinition[];
  missingResources: ResourceCost;
  reason: string;
}

export function getBuildingAvailability(
  town: TownState,
  resources: ResourceBundle,
  building: BuildingDefinition,
): BuildingAvailability {
  const missingPrerequisites = building.prerequisites
    .filter((id) => !town.buildings.includes(id))
    .map((id) => getBuilding(id));
  const missingResources = getMissingResources(resources, building.cost);
  if (town.buildings.includes(building.id)) {
    return { status: 'built', missingPrerequisites, missingResources, reason: 'Already constructed' };
  }
  if (missingPrerequisites.length > 0) {
    return {
      status: 'locked',
      missingPrerequisites,
      missingResources,
      reason: `Requires ${missingPrerequisites.map((item) => item.name).join(', ')}`,
    };
  }
  if (town.builtToday) {
    return {
      status: 'wait',
      missingPrerequisites,
      missingResources,
      reason: 'Another building was completed today',
    };
  }
  if (!canAfford(resources, building.cost)) {
    return {
      status: 'unaffordable',
      missingPrerequisites,
      missingResources,
      reason: `Missing ${formatCost(missingResources)}`,
    };
  }
  return { status: 'ready', missingPrerequisites, missingResources, reason: 'Ready to construct' };
}

export function getAffordableCreatureCount(resources: ResourceBundle, cost: ResourceCost, available: number): number {
  let limit = Math.max(0, Math.floor(available));
  for (const resource of RESOURCE_TYPES) {
    const unitCost = cost[resource] ?? 0;
    if (unitCost > 0) limit = Math.min(limit, Math.floor(resources[resource] / unitCost));
  }
  return Math.max(0, limit);
}

export function getRecruitLimit(town: TownState, resources: ResourceBundle, creatureId: string): number {
  const dwelling = town.buildings
    .map((id) => getBuilding(id))
    .find((building) => building.creatureId === creatureId);
  if (!dwelling) return 0;
  const creature = getCreature(creatureId);
  const hasSlot = town.garrison.some((stack) => stack.creatureId === creatureId) ||
    town.garrison.length < MAX_ARMY_STACKS;
  if (!hasSlot) return 0;
  return getAffordableCreatureCount(resources, creature.cost, town.dwellingPools[creatureId] ?? 0);
}

export function getTransferLimit(
  source: readonly ArmyStack[],
  target: readonly ArmyStack[],
  creatureId: string,
): number {
  const available = source
    .filter((stack) => stack.creatureId === creatureId)
    .reduce((total, stack) => total + stack.count, 0);
  const hasSlot = target.some((stack) => stack.creatureId === creatureId) || target.length < MAX_ARMY_STACKS;
  return hasSlot ? available : 0;
}

export function armyCount(army: readonly ArmyStack[]): number {
  return army.reduce((total, stack) => total + stack.count, 0);
}

export function getHeroCycleTarget(state: Readonly<GameState>, direction: -1 | 1): HeroState | null {
  const heroes = Object.values(state.heroes)
    .filter((hero) => hero.ownerId === state.activePlayerId && hero.alive)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!heroes.length) return null;
  const current = heroes.findIndex((hero) => hero.id === state.selectedHeroId);
  const index = current < 0 ? 0 : (current + direction + heroes.length) % heroes.length;
  return heroes[index] ?? null;
}

export function getLevelProgress(hero: HeroState): { current: number; required: number; percent: number } {
  const levelStart = experienceForLevel(hero.level);
  const nextLevel = experienceForLevel(hero.level + 1);
  const current = Math.max(0, hero.experience - levelStart);
  const required = Math.max(1, nextLevel - levelStart);
  return {
    current,
    required,
    percent: Math.max(0, Math.min(100, current / required * 100)),
  };
}

export interface Objective {
  title: string;
  detail: string;
  tone: 'normal' | 'opportunity' | 'danger' | 'complete';
}

export function getCurrentObjective(state: Readonly<GameState>): Objective {
  const towns = Object.values(state.towns);
  const enemyTownCount = towns.filter((town) => town.ownerId !== state.activePlayerId).length;
  const factionCount = new Set(towns.map((town) => town.faction)).size;
  if (state.phase === 'victory') {
    return {
      title: 'Aster Vale is united',
      detail: `All ${towns.length} towns answer your banner. Begin a new campaign or continue reviewing the realm.`,
      tone: 'complete',
    };
  }
  if (state.phase === 'defeat') {
    return { title: 'The realm has fallen', detail: 'Load a saved campaign or begin anew to change the fate of Aster Vale.', tone: 'danger' };
  }
  if (state.pendingBattle) {
    const encounter = state.map.objects[state.pendingBattle.source.objectId];
    return {
      title: `Battle: ${encounter?.name ?? 'enemy forces'}`,
      detail: `Resolve this battle, then continue the campaign against ${enemyTownCount} remaining enemy ${enemyTownCount === 1 ? 'town' : 'towns'}.`,
      tone: 'danger',
    };
  }
  const hero = state.selectedHeroId ? state.heroes[state.selectedHeroId] : undefined;
  if (!hero || !hero.alive) {
    return { title: 'Choose a hero', detail: 'Select one of your surviving heroes to continue exploring Aster Vale.', tone: 'normal' };
  }
  const object = getObjectAt(state.map, hero.position);
  if (object?.kind === 'town') {
    const town = state.towns[object.townId];
    if (town?.ownerId === hero.ownerId) {
      return {
        title: `Welcome to ${town.name}`,
        detail: `Develop this ${town.faction} town and recruit its four creature tiers. ${enemyTownCount} enemy ${enemyTownCount === 1 ? 'town remains' : 'towns remain'}.`,
        tone: 'opportunity',
      };
    }
    return {
      title: `Siege of ${object.name}`,
      detail: `Challenge the defending garrison. ${enemyTownCount} enemy ${enemyTownCount === 1 ? 'town remains' : 'towns remain'} across ${towns.length}.`,
      tone: 'danger',
    };
  }
  if (object?.kind === 'dwelling') {
    return { title: object.name, detail: 'Interact to recruit the creatures gathered at this dwelling.', tone: 'opportunity' };
  }
  if (object?.kind === 'resource') {
    return { title: object.name, detail: 'Interact to collect this treasure.', tone: 'opportunity' };
  }
  if (object?.kind === 'artifact') {
    return { title: object.name, detail: 'Interact to collect this artifact, then equip it from the hero panel.', tone: 'opportunity' };
  }
  if (object?.kind === 'mine') {
    return { title: object.name, detail: 'Interact to claim daily resource income for your realm.', tone: 'opportunity' };
  }
  if (object?.kind === 'monster') {
    return { title: object.name, detail: 'Interact to engage this hostile army in tactical combat.', tone: 'danger' };
  }
  if (hero.movementPoints <= 0) {
    return { title: 'The company is weary', detail: 'End the turn to restore movement and mana. A new day also brings town income.', tone: 'normal' };
  }
  return {
    title: 'Explore Aster Vale',
    detail: `Gather treasure, recruit armies, and capture ${enemyTownCount} enemy ${enemyTownCount === 1 ? 'town' : 'towns'} across ${towns.length} towns and ${factionCount} faction rosters.`,
    tone: 'normal',
  };
}

type LogEvent = GameState['log'][number];

export function getNewLogEvents(previousLog: readonly LogEvent[], currentLog: readonly LogEvent[]): LogEvent[] {
  const maximumOverlap = Math.min(previousLog.length, currentLog.length);
  for (let overlap = maximumOverlap; overlap > 0; overlap -= 1) {
    const previousOffset = previousLog.length - overlap;
    let matches = true;
    for (let index = 0; index < overlap; index += 1) {
      if (previousLog[previousOffset + index] !== currentLog[index]) {
        matches = false;
        break;
      }
    }
    if (matches) return currentLog.slice(overlap);
  }
  return [...currentLog];
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
