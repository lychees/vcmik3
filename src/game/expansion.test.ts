import { describe, expect, it } from 'vitest';
import {
  BUILDINGS,
  CREATURES,
  FACTIONS,
  HEROES,
  RESOURCE_TYPES,
  SPELLS,
} from './content';
import { updateAllFog } from './fog';
import { GameStore } from './GameStore';
import { createAdventureMap, DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH, toTileIndex } from './map';
import { getReachableTiles } from './pathfinding';
import { isGameState, serializeGameState } from './persistence';
import { createHeroState, createInitialGameState } from './scenario';
import type { GameState, Point } from './types';

const ORIGINAL_CREATURE_IDS = [
  'militia', 'archer', 'griffin', 'cavalier',
  'sprite', 'ranger', 'unicorn', 'dragon',
] as const;

const FIRST_EXPANSION_CREATURE_IDS = [
  'imp', 'hellhound', 'ifrit', 'pitFiend',
  'lizardman', 'gorgon', 'wyvern', 'basilisk',
] as const;

const NEW_FACTION_IDS = [
  'tower', 'necropolis', 'dungeon', 'stronghold', 'conflux',
  'cove', 'factory', 'bulwark', 'courtyard',
] as const;

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

function createLegacyState(includeFirstExpansion: boolean): GameState {
  const legacy = structuredClone(createInitialGameState(
    includeFirstExpansion ? 'legacy-four-town-v1' : 'legacy-two-town-v1',
  ));
  const objectIds = new Set<string>(includeFirstExpansion
    ? [...ORIGINAL_OBJECT_IDS, ...FIRST_EXPANSION_OBJECT_IDS]
    : ORIGINAL_OBJECT_IDS);
  const townIds = new Set(includeFirstExpansion ? ['haven', 'grove', 'ember', 'mire'] : ['haven', 'grove']);
  const heroIds = new Set(includeFirstExpansion
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
  legacy.map.objects = Object.fromEntries(Object.entries(legacy.map.objects)
    .filter(([id]) => objectIds.has(id)));
  for (const object of Object.values(legacy.map.objects)) {
    const position = LEGACY_OBJECT_POSITIONS[object.id];
    if (!position) throw new Error(`Missing legacy position: ${object.id}`);
    object.position = { ...position };
    const tile = legacy.map.tiles[toTileIndex(legacy.map, position)];
    if (!tile) throw new Error(`Invalid legacy position: ${object.id}`);
    tile.objectId = object.id;
  }
  legacy.towns = Object.fromEntries(Object.entries(legacy.towns)
    .filter(([id]) => townIds.has(id)));
  for (const town of Object.values(legacy.towns)) {
    const object = Object.values(legacy.map.objects).find((candidate) =>
      candidate.kind === 'town' && candidate.townId === town.id);
    if (!object) throw new Error(`Missing legacy town object: ${town.id}`);
    town.position = { ...object.position };
  }
  legacy.heroes = Object.fromEntries(Object.entries(legacy.heroes)
    .filter(([id]) => heroIds.has(id)));
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

function provideResources(state: GameState): void {
  const resources = state.players.red?.resources;
  if (!resources) throw new Error('Missing human resources');
  for (const resource of RESOURCE_TYPES) resources[resource] = 100000;
}

describe('thirteen-faction content registry', () => {
  it('preserves all old IDs and provides 13 four-tier factions plus 20 neutral units', () => {
    expect(Object.keys(FACTIONS)).toHaveLength(13);
    expect(Object.keys(CREATURES)).toHaveLength(72);
    expect(Object.keys(CREATURES)).toEqual(expect.arrayContaining([
      ...ORIGINAL_CREATURE_IDS, ...FIRST_EXPANSION_CREATURE_IDS,
    ]));
    expect(new Set(Object.values(CREATURES).map((creature) => creature.name)).size).toBe(72);

    for (const faction of Object.values(FACTIONS)) {
      const creatures = faction.creatureIds.map((id) => {
        const creature = CREATURES[id];
        if (!creature) throw new Error(`Missing faction creature: ${id}`);
        return creature;
      });
      expect(creatures.map((creature) => creature.tier)).toEqual([1, 2, 3, 4]);
      expect(creatures.every((creature) => creature.faction === faction.name)).toBe(true);
      for (const creature of creatures) {
        expect(creature.id).toBe(faction.creatureIds[creature.tier - 1]);
        expect(creature.attack).toBeGreaterThan(0);
        expect(creature.defense).toBeGreaterThan(0);
        expect(creature.damage[0]).toBeGreaterThan(0);
        expect(creature.damage[1]).toBeGreaterThanOrEqual(creature.damage[0]);
        expect(creature.health).toBeGreaterThan(0);
        expect(creature.growth).toBeGreaterThan(0);
        expect(creature.cost.gold).toBeGreaterThan(0);
        expect(creature.abilities.length).toBeGreaterThan(0);
        expect(creature.abilities.includes('ranged') ? creature.shots > 0 : creature.shots === 0).toBe(true);
      }
    }

    const newCreatureIds = NEW_FACTION_IDS.flatMap((id) => FACTIONS[id].creatureIds);
    expect(newCreatureIds).toHaveLength(36);
    expect(new Set(newCreatureIds).size).toBe(36);
    for (const id of newCreatureIds) {
      const creature = CREATURES[id];
      const peers = Object.values(CREATURES).filter((candidate) => candidate.tier === creature?.tier);
      expect(creature).toBeDefined();
      if (!creature) continue;
      expect(creature.cost.gold ?? 0).toBeLessThanOrEqual(Math.max(...peers.map((peer) => peer.cost.gold ?? 0)) + 250);
      expect(creature.health).toBeLessThanOrEqual(Math.max(...peers.map((peer) => peer.health)) + 30);
    }
  });

  it('links every unit to a faction-specific building chain and every faction to a valid hero', () => {
    const recruitmentBuildings = Object.values(BUILDINGS).filter((building) => building.creatureId);
    expect(recruitmentBuildings).toHaveLength(52);
    expect(new Set(recruitmentBuildings.map((building) => building.creatureId)).size).toBe(52);
    expect(Object.keys(HEROES)).toHaveLength(13);

    for (const faction of Object.values(FACTIONS)) {
      expect(faction.buildingIds).toHaveLength(4);
      faction.buildingIds.forEach((buildingId, index) => {
        const building = BUILDINGS[buildingId];
        expect(building).toBeDefined();
        expect(building?.creatureId).toBe(faction.creatureIds[index]);
        expect(building?.prerequisites.length).toBeGreaterThan(0);
        for (const prerequisite of building?.prerequisites ?? []) expect(BUILDINGS[prerequisite]).toBeDefined();
      });
      const hero = HEROES[faction.heroId];
      expect(hero).toBeDefined();
      expect(hero?.faction).toBe(faction.name);
      expect(hero?.startingArmy.length).toBeGreaterThan(0);
      expect(hero?.startingArmy.every((stack) => CREATURES[stack.creatureId]?.faction === faction.name)).toBe(true);
      expect(hero?.spells.every((spell) => SPELLS[spell] !== undefined)).toBe(true);
    }
  });
});

describe('thirteen-town adventure and economy', () => {
  it('starts a 64x48 map with one reachable town per faction and preserves human Haven and Ember', () => {
    const state = createInitialGameState('thirteen-town-start');
    expect(state.map.width).toBe(DEFAULT_MAP_WIDTH);
    expect(state.map.height).toBe(DEFAULT_MAP_HEIGHT);
    expect(DEFAULT_MAP_WIDTH).toBeGreaterThanOrEqual(64);
    expect(DEFAULT_MAP_HEIGHT).toBeGreaterThanOrEqual(48);
    expect(Object.keys(state.towns).sort()).toEqual(Object.keys(FACTIONS).sort());
    expect(Object.keys(state.heroes).sort()).toEqual([
      'hero-aveline', 'hero-morven', 'hero-rowan', 'hero-seraphine',
    ]);
    expect(state.towns.haven).toMatchObject({ faction: 'Haven', ownerId: 'red', position: { x: 3, y: 24 } });
    expect(state.towns.ember).toMatchObject({ faction: 'Ember', ownerId: 'red', position: { x: 3, y: 4 } });
    expect(state.towns.grove).toMatchObject({ faction: 'Grove', ownerId: 'blue', position: { x: 60, y: 24 } });
    expect(state.towns.mire).toMatchObject({ faction: 'Mire', ownerId: 'blue', position: { x: 60, y: 43 } });
    for (const faction of Object.values(FACTIONS)) {
      expect(state.towns[faction.id]).toMatchObject({
        faction: faction.name,
        name: faction.townName,
        buildings: ['townHall', 'fort', faction.buildingIds[0]],
      });
      if (faction.id !== 'haven' && faction.id !== 'ember') expect(state.towns[faction.id]?.ownerId).toBe('blue');
    }
  });

  it('keeps all 13 towns and every point of interest connected across arbitrary seeds and sizes', () => {
    for (let index = 0; index < 12; index += 1) {
      const map = createAdventureMap(`hota-connectivity-${index}`, 64 + (index % 3) * 4, 48 + (index % 2) * 4);
      const start = { x: 3, y: Math.floor(map.height / 2) };
      const reachable = new Set(getReachableTiles(map, start, Number.POSITIVE_INFINITY)
        .map((tile) => tile.tileIndex));
      const towns = Object.values(map.objects).filter((object) => object.kind === 'town');
      expect(towns).toHaveLength(13);
      expect(new Set(towns.map((town) => town.kind === 'town' && town.townId))).toEqual(new Set(Object.keys(FACTIONS)));
      for (const object of Object.values(map.objects)) {
        expect(reachable.has(toTileIndex(map, object.position)), `${map.seed}:${object.id}`).toBe(true);
      }
    }
  });

  it('showcases all 36 added units in dwellings or monster encounters and preserves key encounter IDs', () => {
    const map = createAdventureMap('hota-encounters');
    const showcased = new Set<string>();
    for (const object of Object.values(map.objects)) {
      if (object.kind === 'dwelling') showcased.add(object.creatureId);
      if (object.kind === 'monster') {
        for (const stack of object.army) showcased.add(stack.creatureId);
      }
    }
    const newCreatureIds = NEW_FACTION_IDS.flatMap((id) => FACTIONS[id].creatureIds);
    expect(newCreatureIds.filter((id) => showcased.has(id))).toHaveLength(36);
    expect(map.objects['monster-ember']).toMatchObject({
      kind: 'monster', army: [{ creatureId: 'ifrit', count: 3 }, { creatureId: 'pitFiend', count: 1 }],
    });
    expect(map.objects['monster-mire']).toMatchObject({
      kind: 'monster', army: [{ creatureId: 'wyvern', count: 3 }, { creatureId: 'basilisk', count: 1 }],
    });
  });

  it('constructs every new chain and recruits all 36 units through real town actions', () => {
    const store = new GameStore({ seed: 'hota-economy', storage: null });
    const state = mutableState(store);
    provideResources(state);
    expect(store.constructBuilding('haven', 'gremlinWorkshop').ok).toBe(false);

    for (const factionId of NEW_FACTION_IDS) {
      const faction = FACTIONS[factionId];
      const town = state.towns[factionId];
      if (!town) throw new Error(`Missing town: ${factionId}`);
      town.ownerId = 'red';
      for (let tier = 0; tier < 4; tier += 1) {
        const buildingId = faction.buildingIds[tier];
        const creatureId = faction.creatureIds[tier];
        if (!buildingId || !creatureId) throw new Error(`Incomplete faction chain: ${factionId}`);
        const creature = CREATURES[creatureId];
        if (!creature) throw new Error(`Missing creature: ${creatureId}`);
        town.builtToday = false;
        if (tier > 0) expect(store.constructBuilding(factionId, buildingId).ok).toBe(true);
        expect(town.buildings).toContain(buildingId);
        expect(town.dwellingPools[creatureId]).toBe(creature.growth);
        expect(store.recruitCreature(factionId, creatureId, 1).ok).toBe(true);
        expect(town.dwellingPools[creatureId]).toBe(creature.growth - 1);
        expect(town.garrison.find((stack) => stack.creatureId === creatureId)?.count)
          .toBe(tier === 0 ? creature.growth + 1 : 1);
      }
    }
  });

  it('allows every originally opposing faction to be captured and used', () => {
    const store = new GameStore({ seed: 'hota-capture', storage: null });
    const state = mutableState(store);
    provideResources(state);
    const hero = state.heroes['hero-aveline'];
    if (!hero) throw new Error('Missing capture hero');

    for (const factionId of Object.keys(FACTIONS).filter((id) => id !== 'haven' && id !== 'ember')) {
      const town = state.towns[factionId];
      if (!town) throw new Error(`Missing capture town: ${factionId}`);
      expect(town.ownerId).toBe('blue');
      hero.position = { ...town.position };
      const initiated = store.initiateBattle(hero.id, `town-${factionId}`);
      expect(initiated.ok).toBe(true);
      if (!initiated.ok) throw new Error(initiated.error);
      expect(store.applyBattleResult({
        setupId: initiated.value.id,
        winner: 'attacker',
        attackerArmy: initiated.value.attacker.army.map((stack) => ({ ...stack })),
        defenderArmy: [],
        rewards: initiated.value.rewards,
        rounds: 1,
      }).ok).toBe(true);
      expect(town.ownerId).toBe('red');
      town.builtToday = false;
      expect(store.constructBuilding(factionId, FACTIONS[factionId as keyof typeof FACTIONS].buildingIds[1]).ok).toBe(true);
      expect(store.recruitCreature(factionId, FACTIONS[factionId as keyof typeof FACTIONS].creatureIds[1], 1).ok).toBe(true);
    }
    expect(Object.values(state.towns).every((town) => town.ownerId === 'red')).toBe(true);
    expect(state.phase).toBe('playing');
    expect(isGameState(state)).toBe(true);
  });
});

describe('version-1 persistence across all content generations', () => {
  it.each([false, true])('loads an original 32x24 save with first expansion=%s', (includeFirstExpansion) => {
    const legacy = createLegacyState(includeFirstExpansion);
    expect(legacy.map.width).toBe(32);
    expect(legacy.map.height).toBe(24);
    expect(Object.keys(legacy.towns)).toHaveLength(includeFirstExpansion ? 4 : 2);
    expect(Object.keys(legacy.heroes)).toHaveLength(includeFirstExpansion ? 4 : 2);
    expect(isGameState(legacy)).toBe(true);

    const store = new GameStore({ seed: 'current', storage: null });
    expect(store.loadSerialized(JSON.stringify(legacy)).ok).toBe(true);
    expect(store.getState().version).toBe(1);
    expect(store.getState().map.width).toBe(32);
    expect(Object.keys(store.getState().towns)).toHaveLength(includeFirstExpansion ? 4 : 2);
    expect(store.getState().towns.tower).toBeUndefined();
    expect(store.getState().heroes['hero-aveline']?.army).toEqual(legacy.heroes['hero-aveline']?.army);
  });

  it('round-trips a pending battle from a loaded four-town save', () => {
    const store = new GameStore({ storage: null });
    expect(store.loadSerialized(JSON.stringify(createLegacyState(true))).ok).toBe(true);
    const state = mutableState(store);
    const hero = state.heroes['hero-seraphine'];
    const monster = state.map.objects['monster-ember'];
    if (!hero || monster?.kind !== 'monster') throw new Error('Missing four-town pending-battle fixtures');
    hero.position = { ...monster.position };
    expect(store.initiateBattle(hero.id, monster.id).ok).toBe(true);
    const serialized = serializeGameState(state);
    const restored = new GameStore({ storage: null });
    expect(restored.loadSerialized(serialized).ok).toBe(true);
    expect(restored.getState().pendingBattle?.defender.army).toEqual([
      { creatureId: 'ifrit', count: 3 }, { creatureId: 'pitFiend', count: 1 },
    ]);
    expect(Object.keys(restored.getState().towns)).toHaveLength(4);
  });

  it('deep-round-trips 13 towns, new buildings, a new hero, and a pending new-faction battle', () => {
    const store = new GameStore({ seed: 'hota-save', storage: null });
    const state = mutableState(store);
    const tower = state.towns.tower;
    if (!tower) throw new Error('Missing Tower town');
    tower.ownerId = 'red';
    expect(store.constructBuilding('tower', 'gargoyleParapet').ok).toBe(true);
    expect(store.recruitCreature('tower', 'stoneGargoyle', 2).ok).toBe(true);
    const monster = state.map.objects['monster-tower'];
    if (monster?.kind !== 'monster') throw new Error('Missing Tower monster');
    state.heroes['hero-solmyr'] = createHeroState('solmyr', 'hero-solmyr', 'red', monster.position);
    expect(store.initiateBattle('hero-solmyr', monster.id).ok).toBe(true);
    expect(state.pendingBattle?.defender.army).toEqual([
      { creatureId: 'genie', count: 3 }, { creatureId: 'titan', count: 1 },
    ]);

    const serialized = serializeGameState(state);
    expect(isGameState(JSON.parse(serialized))).toBe(true);
    const restored = new GameStore({ seed: 'unused', storage: null });
    expect(restored.loadSerialized(serialized).ok).toBe(true);
    expect(restored.getState()).toEqual({ ...state, revision: state.revision + 1 });
    expect(Object.keys(restored.getState().towns)).toHaveLength(13);
    expect(restored.getState().towns.tower?.buildings).toContain('gargoyleParapet');
    expect(restored.getState().heroes['hero-solmyr']?.definitionId).toBe('solmyr');
    expect(restored.getState().pendingBattle).toEqual(state.pendingBattle);
  });
});
