import { describe, expect, it } from 'vitest';
import {
  getBuilding,
  getCreature,
  getFaction,
  getHeroDefinition,
  getSpell,
  getTerrain,
} from './content';
import { GameStore } from './GameStore';
import { toTileIndex } from './map';
import type { GameState, TerrainType } from './types';

const INHERITED_IDS = ['toString', 'constructor', '__proto__'] as const;

function mutableState(store: GameStore): GameState {
  return store.getState() as GameState;
}

function expectLoadRejected(store: GameStore, malformed: GameState, before: GameState, serialized: string, label: string): void {
  expect(store.loadSerialized(JSON.stringify(malformed)).ok, label).toBe(false);
  expect(store.getState(), label).toBe(before);
  expect(JSON.stringify(store.getState()), label).toBe(serialized);
}

function addTownReference(state: GameState, townId: string): void {
  const position = { x: 13, y: Math.floor(state.map.height / 2) };
  state.map.objects['inherited-town'] = {
    id: 'inherited-town',
    kind: 'town',
    townId,
    name: 'Inherited Town',
    position,
  };
  const tile = state.map.tiles[toTileIndex(state.map, position)];
  if (tile) tile.objectId = 'inherited-town';
}

describe('own-property content and entity lookups', () => {
  it('rejects inherited IDs in every public content getter without hiding valid content', () => {
    const getters: Array<{ name: string; get: (id: string) => unknown }> = [
      { name: 'creature', get: getCreature },
      { name: 'building', get: getBuilding },
      { name: 'faction', get: getFaction },
      { name: 'spell', get: getSpell },
      { name: 'hero', get: getHeroDefinition },
      { name: 'terrain', get: (id) => getTerrain(id as TerrainType) },
    ];
    for (const { name, get } of getters) {
      for (const id of INHERITED_IDS) expect(() => get(id), `${name}:${id}`).toThrow(/Unknown/);
    }
    expect(getCreature('militia').id).toBe('militia');
    expect(getFaction('tower').name).toBe('Tower');
    expect(getBuilding('townHall').id).toBe('townHall');
    expect(getSpell('haste').id).toBe('haste');
    expect(getHeroDefinition('aveline').id).toBe('aveline');
    expect(getTerrain('grass').id).toBe('grass');
  });

  it('rejects inherited content, owner, and entity references without replacing known-good state', () => {
    const store = new GameStore({ seed: 'own-property-save', storage: null });
    const before = mutableState(store);
    const serialized = JSON.stringify(before);
    const mutations: Array<{ name: string; apply: (state: GameState, id: string) => void }> = [
      {
        name: 'creature', apply: (state, id) => {
          const hero = state.heroes['hero-aveline'];
          if (hero) hero.army = [{ creatureId: id, count: 5 }];
        },
      },
      {
        name: 'terrain', apply: (state, id) => {
          const tile = state.map.tiles[0];
          if (tile) tile.terrain = id as TerrainType;
        },
      },
      {
        name: 'hero definition', apply: (state, id) => {
          const hero = state.heroes['hero-aveline'];
          if (hero) hero.definitionId = id;
        },
      },
      {
        name: 'building', apply: (state, id) => {
          const town = state.towns.haven;
          if (town) town.buildings = [id];
        },
      },
      {
        name: 'spell', apply: (state, id) => {
          const hero = state.heroes['hero-aveline'];
          if (hero) hero.spells = [id];
        },
      },
      {
        name: 'mine owner', apply: (state, id) => {
          const mine = state.map.objects['sawmill-west'];
          if (mine?.kind === 'mine') mine.ownerId = id;
        },
      },
      {
        name: 'hero owner', apply: (state, id) => {
          const hero = state.heroes['hero-aveline'];
          if (hero) hero.ownerId = id;
        },
      },
      {
        name: 'town owner', apply: (state, id) => {
          const town = state.towns.haven;
          if (town) town.ownerId = id;
        },
      },
      {
        name: 'selected hero', apply: (state, id) => {
          state.selectedHeroId = id;
        },
      },
      {
        name: 'tile object', apply: (state, id) => {
          const tile = state.map.tiles[0];
          if (tile) tile.objectId = id;
        },
      },
      {
        name: 'player order', apply: (state, id) => {
          state.playerOrder = [id, 'red'];
        },
      },
      {
        name: 'winner', apply: (state, id) => {
          state.phase = 'victory';
          state.winnerId = id;
        },
      },
    ];

    for (const id of INHERITED_IDS) {
      for (const mutation of mutations) {
        const malformed = structuredClone(before);
        mutation.apply(malformed, id);
        expectLoadRejected(store, malformed, before, serialized, `${mutation.name}:${id}`);
      }
      const malformedTown = structuredClone(before);
      addTownReference(malformedTown, id);
      expectLoadRejected(store, malformedTown, before, serialized, `town reference:${id}`);
    }
  });

  it('rejects inherited pending-battle entity references and preserves the pending encounter', () => {
    const store = new GameStore({ seed: 'own-property-battle', storage: null });
    const state = mutableState(store);
    const hero = state.heroes['hero-aveline'];
    const monster = state.map.objects['monster-west'];
    if (!hero || !monster) throw new Error('Missing own-property battle fixture');
    hero.position = { ...monster.position };
    expect(store.initiateBattle(hero.id, monster.id).ok).toBe(true);
    const before = mutableState(store);
    const serialized = JSON.stringify(before);
    for (const id of INHERITED_IDS) {
      const badHero = structuredClone(before);
      if (badHero.pendingBattle) badHero.pendingBattle.source.heroId = id;
      expectLoadRejected(store, badHero, before, serialized, `pending hero:${id}`);
      const badObject = structuredClone(before);
      if (badObject.pendingBattle) badObject.pendingBattle.source.objectId = id;
      expectLoadRejected(store, badObject, before, serialized, `pending object:${id}`);
    }
    expect(store.resolveBattleAutomatically().ok).toBe(true);
  });

  it('rolls back position and movement points when a malformed town interaction fails', () => {
    for (const id of INHERITED_IDS) {
      const store = new GameStore({ seed: `movement-rollback-${id}`, storage: null });
      const state = mutableState(store);
      addTownReference(state, id);
      const hero = state.heroes['hero-aveline'];
      if (!hero) throw new Error('Missing movement rollback hero');
      const destination = { x: 13, y: Math.floor(state.map.height / 2) };
      expect(store.findHeroPath(hero.id, destination), id).not.toBeNull();
      const position = { ...hero.position };
      const movementPoints = hero.movementPoints;
      const revision = state.revision;
      const fog = JSON.stringify(state.fog);
      expect(store.moveHero(hero.id, destination).ok, id).toBe(false);
      expect(hero.position, id).toEqual(position);
      expect(hero.movementPoints, id).toBe(movementPoints);
      expect(state.revision, id).toBe(revision);
      expect(JSON.stringify(state.fog), id).toBe(fog);
      expect(state.pendingBattle, id).toBeNull();
    }
  });
});
