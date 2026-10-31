import { describe, expect, it } from 'vitest';
import { runTacticalAutoBattle } from '../src/battle';
import { CREATURES, FACTIONS, RESOURCE_TYPES } from '../src/game/content';
import { updateAllFog } from '../src/game/fog';
import { GameStore } from '../src/game/GameStore';
import { toTileIndex } from '../src/game/map';
import { isGameState, serializeGameState } from '../src/game/persistence';
import { createHeroState, createInitialGameState } from '../src/game/scenario';
import type { BattleSetup, GameState, Point } from '../src/game/types';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const ORIGINAL_OBJECT_IDS = [
  'town-haven', 'town-grove',
  'gold-west', 'wood-west', 'ore-cache-east', 'gold-east', 'crystal-north',
  'sawmill-west', 'ore-east', 'gold-north', 'crystal-south',
  'dwelling-militia', 'dwelling-sprites',
  'monster-west', 'monster-east', 'monster-dragon',
] as const;

const FIRST_EXPANSION_OBJECT_IDS = [
  'town-ember', 'town-mire', 'sulfur-north', 'mercury-south',
  'dwelling-imps', 'dwelling-hellhounds', 'dwelling-lizardmen', 'dwelling-gorgons',
  'monster-ember', 'monster-mire',
] as const;

const LEGACY_OBJECT_POSITIONS: Record<string, Point> = {
  'town-haven': { x: 3, y: 12 }, 'town-grove': { x: 28, y: 12 },
  'town-ember': { x: 3, y: 4 }, 'town-mire': { x: 28, y: 19 },
  'gold-west': { x: 5, y: 12 }, 'wood-west': { x: 11, y: 12 },
  'ore-cache-east': { x: 20, y: 12 }, 'gold-east': { x: 26, y: 12 },
  'crystal-north': { x: 16, y: 5 }, 'sawmill-west': { x: 6, y: 16 },
  'ore-east': { x: 25, y: 8 }, 'gold-north': { x: 16, y: 3 },
  'crystal-south': { x: 20, y: 20 }, 'sulfur-north': { x: 10, y: 3 },
  'mercury-south': { x: 21, y: 20 }, 'dwelling-militia': { x: 8, y: 7 },
  'dwelling-sprites': { x: 23, y: 17 }, 'dwelling-imps': { x: 7, y: 4 },
  'dwelling-hellhounds': { x: 11, y: 5 }, 'dwelling-lizardmen': { x: 24, y: 19 },
  'dwelling-gorgons': { x: 20, y: 18 }, 'monster-west': { x: 9, y: 12 },
  'monster-east': { x: 22, y: 12 }, 'monster-dragon': { x: 16, y: 19 },
  'monster-ember': { x: 12, y: 9 }, 'monster-mire': { x: 19, y: 15 },
};

const LEGACY_HERO_POSITIONS: Record<string, Point> = {
  'hero-aveline': { x: 3, y: 10 }, 'hero-rowan': { x: 28, y: 14 },
  'hero-seraphine': { x: 5, y: 4 }, 'hero-morven': { x: 26, y: 19 },
};

function mutableState(store: GameStore): GameState {
  return store.getState() as GameState;
}

function provideResources(state: GameState): void {
  const resources = state.players.red?.resources;
  if (!resources) throw new Error('Missing human resources');
  for (const resource of RESOURCE_TYPES) resources[resource] = 100000;
}

function createLegacyState(fourTowns: boolean): GameState {
  const legacy = structuredClone(createInitialGameState(fourTowns ? 'acceptance-four-town-v1' : 'acceptance-two-town-v1'));
  const objectIds = new Set<string>(fourTowns
    ? [...ORIGINAL_OBJECT_IDS, ...FIRST_EXPANSION_OBJECT_IDS]
    : ORIGINAL_OBJECT_IDS);
  const townIds = new Set(fourTowns ? ['haven', 'grove', 'ember', 'mire'] : ['haven', 'grove']);
  const heroIds = new Set(fourTowns
    ? ['hero-aveline', 'hero-rowan', 'hero-seraphine', 'hero-morven']
    : ['hero-aveline', 'hero-rowan']);

  legacy.map.width = 32;
  legacy.map.height = 24;
  legacy.map.tiles = Array.from({ length: 32 * 24 }, (_, index) => ({
    x: index % 32,
    y: Math.floor(index / 32),
    terrain: 'grass',
    road: false,
    obstacle: false,
    objectId: null,
  }));
  legacy.map.objects = Object.fromEntries(Object.entries(legacy.map.objects).filter(([id]) => objectIds.has(id)));
  for (const object of Object.values(legacy.map.objects)) {
    const position = LEGACY_OBJECT_POSITIONS[object.id];
    if (!position) throw new Error(`Missing legacy position: ${object.id}`);
    object.position = { ...position };
    const tile = legacy.map.tiles[toTileIndex(legacy.map, position)];
    if (!tile) throw new Error(`Invalid legacy position: ${object.id}`);
    tile.objectId = object.id;
  }
  legacy.towns = Object.fromEntries(Object.entries(legacy.towns).filter(([id]) => townIds.has(id)));
  for (const town of Object.values(legacy.towns)) {
    const object = Object.values(legacy.map.objects).find((candidate) => candidate.kind === 'town' && candidate.townId === town.id);
    if (!object) throw new Error(`Missing legacy town object: ${town.id}`);
    town.position = { ...object.position };
  }
  legacy.heroes = Object.fromEntries(Object.entries(legacy.heroes).filter(([id]) => heroIds.has(id)));
  for (const hero of Object.values(legacy.heroes)) {
    const position = LEGACY_HERO_POSITIONS[hero.id];
    if (!position) throw new Error(`Missing legacy hero position: ${hero.id}`);
    hero.position = { ...position };
  }
  for (const fog of Object.values(legacy.fog)) {
    fog.visible = [];
    fog.explored = [];
  }
  updateAllFog(legacy);
  return legacy;
}

function setupForCreature(creatureId: string): BattleSetup {
  return {
    id: `acceptance-${creatureId}`,
    seed: `tactical-${creatureId}`,
    source: { heroId: 'hero-acceptance', objectId: 'monster-acceptance', kind: 'monster' },
    attacker: {
      ownerId: 'red', heroId: 'hero-acceptance',
      primarySkills: { attack: 4, defense: 4, spellPower: 0, knowledge: 0 },
      army: [{ creatureId, count: 12 }],
    },
    defender: {
      ownerId: 'neutral', heroId: null,
      primarySkills: { attack: 0, defense: 0, spellPower: 0, knowledge: 0 },
      army: [{ creatureId: 'militia', count: 4 }],
    },
    rewards: { experience: 100, resources: { gold: 100 } },
  };
}

describe('full-roster construction, recruitment, and persistence', () => {
  it('builds and recruits every faction chain through real store actions, then round-trips all 13 towns', () => {
    const storage = new MemoryStorage();
    const store = new GameStore({ seed: 'acceptance-all-towns', storage });
    const state = mutableState(store);
    provideResources(state);

    for (const faction of Object.values(FACTIONS)) {
      const town = state.towns[faction.id];
      if (!town) throw new Error(`Missing faction town: ${faction.id}`);
      town.ownerId = 'red';
      const initialTierOneCount = town.garrison.find((stack) => stack.creatureId === faction.creatureIds[0])?.count ?? 0;
      for (let tier = 0; tier < 4; tier += 1) {
        const buildingId = faction.buildingIds[tier];
        const creatureId = faction.creatureIds[tier];
        const creature = CREATURES[creatureId];
        if (!buildingId || !creature) throw new Error(`Incomplete chain: ${faction.id} tier ${tier + 1}`);
        town.builtToday = false;
        if (tier > 0) expect(store.constructBuilding(faction.id, buildingId).ok, `${faction.id}:${buildingId}`).toBe(true);
        expect(town.buildings).toContain(buildingId);
        expect(store.recruitCreature(faction.id, creatureId, 1).ok, `${faction.id}:${creatureId}`).toBe(true);
        expect(town.dwellingPools[creatureId]).toBe(creature.growth - 1);
        expect(town.garrison.find((stack) => stack.creatureId === creatureId)?.count)
          .toBe(tier === 0 ? initialTierOneCount + 1 : 1);
      }
      expect(faction.buildingIds.every((id) => town.buildings.includes(id))).toBe(true);
      expect(town.garrison).toHaveLength(4);
    }

    expect(isGameState(state)).toBe(true);
    expect(store.saveGame('slot-1').ok).toBe(true);
    const restored = new GameStore({ seed: 'unused', storage });
    expect(restored.loadGame('slot-1').ok).toBe(true);
    expect(restored.getState()).toEqual({ ...state, revision: state.revision + 1 });
    expect(Object.keys(restored.getState().towns)).toHaveLength(13);
    expect(restored.getState().map).toEqual(state.map);
    for (const faction of Object.values(FACTIONS)) {
      expect(restored.getState().towns[faction.id]?.buildings).toEqual(state.towns[faction.id]?.buildings);
      expect(restored.getState().towns[faction.id]?.garrison).toEqual(state.towns[faction.id]?.garrison);
      expect(restored.getState().towns[faction.id]?.dwellingPools).toEqual(state.towns[faction.id]?.dwellingPools);
    }

    expect(restored.saveGame('slot-2').ok).toBe(true);
    const secondRestore = new GameStore({ seed: 'unused-again', storage });
    expect(secondRestore.loadGame('slot-2').ok).toBe(true);
    expect(secondRestore.getState()).toEqual({ ...restored.getState(), revision: restored.getState().revision + 1 });
  });

  it.each([
    { fourTowns: false, townCount: 2 },
    { fourTowns: true, townCount: 4 },
  ])('loads and continues a legacy $townCount-town save without adding towns', ({ fourTowns, townCount }) => {
    const legacy = createLegacyState(fourTowns);
    expect(isGameState(legacy)).toBe(true);
    const storage = new MemoryStorage();
    const store = new GameStore({ storage });
    expect(store.loadSerialized(serializeGameState(legacy)).ok).toBe(true);
    expect(store.getState().map.width).toBe(32);
    expect(store.getState().map.height).toBe(24);
    expect(Object.keys(store.getState().towns)).toHaveLength(townCount);
    expect(store.getState().towns.tower).toBeUndefined();

    provideResources(mutableState(store));
    expect(store.constructBuilding('haven', 'archeryRange').ok).toBe(true);
    expect(store.recruitCreature('haven', 'archer', 2).ok).toBe(true);
    expect(store.saveGame('legacy-continued').ok).toBe(true);
    const restored = new GameStore({ storage });
    expect(restored.loadGame('legacy-continued').ok).toBe(true);
    expect(Object.keys(restored.getState().towns)).toHaveLength(townCount);
    expect(restored.getState().towns.haven?.dwellingPools.archer).toBe(7);
  });
});

describe('all 52 units in tactical combat', () => {
  it.each(Object.values(CREATURES))('$id enters and resolves a valid tactical battle', (creature) => {
    const setup = setupForCreature(creature.id);
    const engine = runTacticalAutoBattle(setup, { obstacles: [] });
    expect(engine.getState().stacks.find((stack) => stack.id === 'attacker:0')?.creatureId).toBe(creature.id);
    expect(engine.getState().stacks.find((stack) => stack.id === 'attacker:0')?.initialCount).toBe(12);
    const result = engine.getResult();
    expect(result).not.toBeNull();
    expect(result?.setupId).toBe(setup.id);
    expect(result?.rounds).toBeGreaterThan(0);
    expect(result?.attackerArmy.every((stack) => CREATURES[stack.creatureId] !== undefined)).toBe(true);
    expect(result?.defenderArmy.every((stack) => CREATURES[stack.creatureId] !== undefined)).toBe(true);
  });
});

describe('new-faction real-map encounters', () => {
  it.each(Object.values(FACTIONS).slice(4))('$id fields all four tiers in its real monster encounter', (faction) => {
    const store = new GameStore({ seed: `acceptance-battle-${faction.id}`, storage: null });
    const state = mutableState(store);
    const monster = state.map.objects[`monster-${faction.id}`];
    if (monster?.kind !== 'monster') throw new Error(`Missing ${faction.id} encounter`);
    const hero = createHeroState(faction.heroId, `hero-${faction.heroId}`, 'red', monster.position);
    hero.army = faction.creatureIds.map((creatureId, index) => ({ creatureId, count: 20 - index * 3 }));
    state.heroes[hero.id] = hero;
    const initiated = store.initiateBattle(hero.id, monster.id);
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) throw new Error(initiated.error);
    expect(initiated.value.attacker.army.map((stack) => stack.creatureId)).toEqual(faction.creatureIds);
    expect(initiated.value.defender.army.map((stack) => stack.creatureId)).toEqual(faction.creatureIds.slice(2));
    const result = runTacticalAutoBattle(initiated.value).getResult();
    expect(result).not.toBeNull();
    if (!result) throw new Error(`Missing ${faction.id} battle result`);
    expect(store.applyBattleResult(result).ok).toBe(true);
    expect(state.pendingBattle).toBeNull();
  });
});
