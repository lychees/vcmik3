import { describe, expect, it } from 'vitest';
import { BUILDINGS, CREATURES, FACTIONS } from '../src/game/content';
import { GameStore } from '../src/game/GameStore';
import { LANDMARK_IDS } from '../src/game/landmarks';
import { createAdventureMap } from '../src/game/map';
import { NEUTRAL_CREATURE_IDS, NEUTRAL_CREATURES } from '../src/game/neutral';
import { isGameState, serializeGameState } from '../src/game/persistence';
import type { GameState, HeroState, LandmarkObject, LandmarkType } from '../src/game/types';

function mutableState(store: GameStore): GameState {
  return store.getState() as GameState;
}

function getLandmark(state: GameState, id: string): LandmarkObject {
  const object = state.map.objects[`landmark-${id}`];
  if (object?.kind !== 'landmark') throw new Error(`Missing landmark: ${id}`);
  return object;
}

function placeHero(state: GameState, object: LandmarkObject, heroId = 'hero-aveline'): HeroState {
  const hero = state.heroes[heroId];
  if (!hero) throw new Error(`Missing hero: ${heroId}`);
  hero.position = { ...object.position };
  hero.alive = true;
  state.activePlayerId = hero.ownerId;
  state.selectedHeroId = hero.id;
  return hero;
}

function visit(store: GameStore, id: string, heroId = 'hero-aveline') {
  const object = getLandmark(mutableState(store), id);
  placeHero(mutableState(store), object, heroId);
  return store.interact(heroId);
}

function setDay(state: GameState, day: number): void {
  state.calendar = {
    day,
    dayOfWeek: ((day - 1) % 7) + 1,
    week: Math.floor((day - 1) / 7) + 1,
    month: Math.floor((day - 1) / 28) + 1,
  };
}

describe('72-unit registry and neutral encounters', () => {
  it('adds exactly 20 neutral-only definitions without changing faction recruitment', () => {
    expect(NEUTRAL_CREATURE_IDS).toHaveLength(20);
    expect(new Set(NEUTRAL_CREATURE_IDS).size).toBe(20);
    expect(Object.keys(CREATURES)).toHaveLength(72);
    expect(Object.keys(FACTIONS)).toHaveLength(13);
    expect(Object.keys(BUILDINGS)).toHaveLength(57);
    const recruitmentBuildings = Object.values(BUILDINGS).filter((building) => building.creatureId);
    expect(recruitmentBuildings).toHaveLength(52);
    expect(new Set(recruitmentBuildings.map((building) => building.creatureId))).toHaveLength(52);

    for (const id of NEUTRAL_CREATURE_IDS) {
      const creature = NEUTRAL_CREATURES[id];
      expect(creature).toBe(CREATURES[id]);
      expect(creature?.faction).toBe('Neutral');
      expect(recruitmentBuildings.some((building) => building.creatureId === id)).toBe(false);
      expect(Object.values(FACTIONS).some((faction) => faction.creatureIds.includes(id))).toBe(false);
      expect(creature?.attack).toBeGreaterThan(0);
      expect(creature?.defense).toBeGreaterThan(0);
      expect(creature?.health).toBeGreaterThan(0);
      expect(creature?.growth).toBeGreaterThan(0);
      expect(creature?.damage[0]).toBeGreaterThan(0);
      expect(creature?.damage[1]).toBeGreaterThanOrEqual(creature?.damage[0] ?? 0);
      expect(creature?.abilities.length).toBeGreaterThan(0);
      expect(creature?.abilities.includes('ranged') ? creature.shots > 0 : creature?.shots === 0).toBe(true);
    }
  });

  it('places ten mixed encounters covering every neutral exactly once without object collisions', () => {
    const map = createAdventureMap('wild-encounters');
    const encounters = Object.values(map.objects).filter((object) =>
      object.kind === 'monster' && object.id.startsWith('monster-neutral-'));
    expect(encounters).toHaveLength(10);
    const showcased = encounters.flatMap((object) => object.kind === 'monster' ? object.army.map((stack) => stack.creatureId) : []);
    expect(new Set(showcased)).toEqual(new Set(NEUTRAL_CREATURE_IDS));
    expect(showcased).toHaveLength(20);
    for (const encounter of encounters) {
      if (encounter.kind !== 'monster') throw new Error('Unexpected encounter type');
      expect(encounter.army).toHaveLength(2);
      expect(encounter.army.every((stack) => NEUTRAL_CREATURES[stack.creatureId]?.faction === 'Neutral')).toBe(true);
    }
    const objects = Object.values(map.objects);
    expect(new Set(objects.map((object) => `${object.position.x},${object.position.y}`)).size).toBe(objects.length);
  });

  it('places all ten landmark types and exactly two reciprocal portals deterministically', () => {
    const first = createAdventureMap('wild-landmarks');
    expect(first).toEqual(createAdventureMap('wild-landmarks'));
    const landmarks = Object.values(first.objects).filter((object) => object.kind === 'landmark');
    expect(landmarks).toHaveLength(11);
    expect(new Set(landmarks.map((object) => object.kind === 'landmark' && object.landmarkId))).toEqual(new Set(LANDMARK_IDS));
    const portals = landmarks.filter((object) => object.kind === 'landmark' && object.landmarkId === 'wayfarerPortal');
    expect(portals).toHaveLength(2);
    for (const portal of portals) {
      if (portal.kind !== 'landmark') throw new Error('Unexpected portal type');
      const linked = portal.linkedObjectId ? first.objects[portal.linkedObjectId] : undefined;
      expect(linked?.kind).toBe('landmark');
      expect(linked?.kind === 'landmark' && linked.linkedObjectId).toBe(portal.id);
      expect(portal.position).not.toEqual(linked?.position);
    }
  });
});

describe('landmark effects and reuse rules', () => {
  it('teaches one new spell once per hero at the Arcane Library', () => {
    const store = new GameStore({ seed: 'library-effect', storage: null });
    const hero = mutableState(store).heroes['hero-aveline']!;
    hero.spells = [];
    const result = visit(store, 'arcaneLibrary');
    expect(result.ok).toBe(true);
    expect(hero.spells).toEqual(['fireball']);
    expect(visit(store, 'arcaneLibrary').ok).toBe(true);
    expect(hero.spells).toEqual(['fireball']);
    expect(getLandmark(mutableState(store), 'arcaneLibrary').visits[hero.id]).toBe(1);
  });

  it('grants permanent arena attack independently to each hero', () => {
    const store = new GameStore({ seed: 'arena-effect', storage: null });
    const first = mutableState(store).heroes['hero-aveline']!;
    const second = mutableState(store).heroes['hero-seraphine']!;
    const attack = first.primarySkills.attack;
    expect(visit(store, 'warriorsArena').ok).toBe(true);
    expect(first.primarySkills.attack).toBe(attack + 1);
    expect(visit(store, 'warriorsArena').ok).toBe(true);
    expect(first.primarySkills.attack).toBe(attack + 1);
    const secondAttack = second.primarySkills.attack;
    expect(visit(store, 'warriorsArena', second.id).ok).toBe(true);
    expect(second.primarySkills.attack).toBe(secondAttack + 1);
  });

  it('grants shrine experience and real level progression only once', () => {
    const store = new GameStore({ seed: 'shrine-effect', storage: null });
    const hero = mutableState(store).heroes['hero-aveline']!;
    expect(visit(store, 'heroesShrine').ok).toBe(true);
    expect(hero.experience).toBe(1000);
    expect(hero.level).toBe(2);
    expect(visit(store, 'heroesShrine').ok).toBe(true);
    expect(hero.experience).toBe(1000);
    expect(hero.level).toBe(2);
  });

  it('grants permanent lodge defense only once', () => {
    const store = new GameStore({ seed: 'lodge-effect', storage: null });
    const hero = mutableState(store).heroes['hero-aveline']!;
    const defense = hero.primarySkills.defense;
    expect(visit(store, 'huntersLodge').ok).toBe(true);
    expect(hero.primarySkills.defense).toBe(defense + 1);
    expect(visit(store, 'huntersLodge').ok).toBe(true);
    expect(hero.primarySkills.defense).toBe(defense + 1);
  });

  it('restores waterwheel movement once per day', () => {
    const store = new GameStore({ seed: 'waterwheel-effect', storage: null });
    const hero = mutableState(store).heroes['hero-aveline']!;
    hero.movementPoints = 0;
    expect(visit(store, 'waterwheel').ok).toBe(true);
    expect(hero.movementPoints).toBe(hero.maxMovementPoints);
    hero.movementPoints = 0;
    expect(visit(store, 'waterwheel').ok).toBe(true);
    expect(hero.movementPoints).toBe(0);
    setDay(mutableState(store), 2);
    expect(visit(store, 'waterwheel').ok).toBe(true);
    expect(hero.movementPoints).toBe(hero.maxMovementPoints);
    expect(getLandmark(mutableState(store), 'waterwheel').visits[hero.id]).toBe(2);
  });

  it('grants both elemental forge bonuses exactly once', () => {
    const store = new GameStore({ seed: 'forge-effect', storage: null });
    const hero = mutableState(store).heroes['hero-aveline']!;
    const skills = { ...hero.primarySkills };
    expect(visit(store, 'elementalForge').ok).toBe(true);
    expect(hero.primarySkills.attack).toBe(skills.attack + 1);
    expect(hero.primarySkills.defense).toBe(skills.defense + 1);
    expect(visit(store, 'elementalForge').ok).toBe(true);
    expect(hero.primarySkills.attack).toBe(skills.attack + 1);
    expect(hero.primarySkills.defense).toBe(skills.defense + 1);
  });

  it('reveals and persistently explores new observatory tiles', () => {
    const store = new GameStore({ seed: 'observatory-effect', storage: null });
    const state = mutableState(store);
    const object = getLandmark(state, 'ancientObservatory');
    placeHero(state, object);
    state.fog.red = { visible: [], explored: [] };
    const result = store.interact();
    expect(result.ok).toBe(true);
    expect(state.fog.red!.explored.length).toBeGreaterThan(100);
    expect(state.fog.red!.explored).toContain(object.position.y * state.map.width + object.position.x);
    expect(state.fog.red!.visible.every((index) => state.fog.red!.explored.includes(index))).toBe(true);
    const revealed = state.fog.red!.explored.length;
    expect(store.interact().ok).toBe(true);
    expect(state.fog.red!.explored).toHaveLength(revealed);
  });

  it('restores sanctuary mana once per day', () => {
    const store = new GameStore({ seed: 'sanctuary-effect', storage: null });
    const hero = mutableState(store).heroes['hero-aveline']!;
    hero.mana = 0;
    expect(visit(store, 'healersSanctuary').ok).toBe(true);
    expect(hero.mana).toBe(hero.maxMana);
    hero.mana = 0;
    expect(visit(store, 'healersSanctuary').ok).toBe(true);
    expect(hero.mana).toBe(0);
    setDay(mutableState(store), 2);
    expect(visit(store, 'healersSanctuary').ok).toBe(true);
    expect(hero.mana).toBe(hero.maxMana);
  });

  it('travels in both directions through the linked portals', () => {
    const store = new GameStore({ seed: 'portal-effect', storage: null });
    const state = mutableState(store);
    const hero = state.heroes['hero-aveline']!;
    const west = getLandmark(state, 'wayfarerPortal-west');
    const east = getLandmark(state, 'wayfarerPortal-east');
    const outbound = visit(store, 'wayfarerPortal-west');
    expect(outbound.ok).toBe(true);
    expect(outbound.ok && outbound.value.kind === 'landmark' && outbound.value.destination).toEqual(east.position);
    expect(hero.position).toEqual(east.position);
    expect(west.visits[hero.id]).toBe(1);
    expect(east.visits[hero.id]).toBe(1);
    expect(store.interact().ok).toBe(true);
    expect(hero.position).toEqual(west.position);
  });

  it('leaves a hero at the source when the linked portal is occupied', () => {
    const store = new GameStore({ seed: 'portal-occupied', storage: null });
    const state = mutableState(store);
    const east = getLandmark(state, 'wayfarerPortal-east');
    state.heroes['hero-seraphine']!.position = { ...east.position };
    const hero = state.heroes['hero-aveline']!;
    const result = visit(store, 'wayfarerPortal-west');
    expect(result.ok).toBe(true);
    expect(hero.position).toEqual(getLandmark(state, 'wayfarerPortal-west').position);
    expect(result.ok && result.value.kind === 'landmark' ? result.value.message : '').toContain('occupied');
  });

  it('executes a fair daily trade and never spends resources on a rejected trade', () => {
    const store = new GameStore({ seed: 'merchant-effect', storage: null });
    const state = mutableState(store);
    const resources = state.players.red!.resources;
    resources.gold = 500;
    resources.wood = 10;
    resources.ore = 20;
    expect(visit(store, 'merchantsTent').ok).toBe(true);
    expect(resources).toMatchObject({ gold: 0, wood: 11, ore: 21 });
    resources.gold = 500;
    expect(visit(store, 'merchantsTent').ok).toBe(true);
    expect(resources).toMatchObject({ gold: 500, wood: 11, ore: 21 });
    setDay(state, 2);
    resources.gold = 0;
    expect(visit(store, 'merchantsTent').ok).toBe(true);
    expect(resources).toMatchObject({ gold: 0, wood: 11, ore: 21 });
    expect(getLandmark(state, 'merchantsTent').visits['hero-aveline']).toBe(1);
  });
});

describe('landmark persistence and validation', () => {
  it('round-trips visits, daily reuse, hero effects, and portal positions', () => {
    const store = new GameStore({ seed: 'landmark-save', storage: null });
    expect(visit(store, 'arcaneLibrary').ok).toBe(true);
    expect(visit(store, 'warriorsArena').ok).toBe(true);
    expect(visit(store, 'wayfarerPortal-west').ok).toBe(true);
    const serialized = serializeGameState(store.getState());
    const restored = new GameStore({ seed: 'unused', storage: null });
    expect(restored.loadSerialized(serialized).ok).toBe(true);
    expect(restored.getState().map).toEqual(store.getState().map);
    expect(restored.getState().heroes['hero-aveline']).toEqual(store.getState().heroes['hero-aveline']);
    const hero = mutableState(restored).heroes['hero-aveline']!;
    hero.movementPoints = 0;
    expect(visit(restored, 'waterwheel').ok).toBe(true);
    expect(hero.movementPoints).toBe(hero.maxMovementPoints);
    hero.movementPoints = 0;
    expect(visit(restored, 'waterwheel').ok).toBe(true);
    expect(hero.movementPoints).toBe(0);
    setDay(mutableState(restored), 2);
    expect(visit(restored, 'waterwheel').ok).toBe(true);
    expect(hero.movementPoints).toBe(hero.maxMovementPoints);
  });

  it('rejects malformed landmark records and broken portal links', () => {
    const store = new GameStore({ seed: 'landmark-validation', storage: null });
    const state = mutableState(store);
    const missingVisits = structuredClone(state);
    const library = missingVisits.map.objects['landmark-arcaneLibrary'];
    if (library?.kind === 'landmark') delete (library as Partial<LandmarkObject>).visits;
    expect(isGameState(missingVisits)).toBe(false);

    const invalidDay = structuredClone(state);
    const arena = invalidDay.map.objects['landmark-warriorsArena'];
    if (arena?.kind === 'landmark') arena.visits['hero-aveline'] = 0;
    expect(isGameState(invalidDay)).toBe(false);

    const unknownType = structuredClone(state);
    const shrine = unknownType.map.objects['landmark-heroesShrine'];
    if (shrine?.kind === 'landmark') (shrine as LandmarkObject).landmarkId = 'missing' as LandmarkType;
    expect(isGameState(unknownType)).toBe(false);

    const brokenLink = structuredClone(state);
    const portal = brokenLink.map.objects['landmark-wayfarerPortal-east'];
    if (portal?.kind === 'landmark') portal.linkedObjectId = 'landmark-wayfarerPortal-west-missing';
    expect(isGameState(brokenLink)).toBe(false);
    expect(store.loadSerialized(JSON.stringify(brokenLink)).ok).toBe(false);
    expect(store.getState()).toBe(state);
  });
});
