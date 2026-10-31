import { describe, expect, it } from 'vitest';
import { GameStore } from './GameStore';
import type {
  BattleSetup,
  BattleSide,
  GameState,
  HeroState,
  MineObject,
  MonsterObject,
  PlayerState,
  ResourceObject,
  TownState,
} from './types';

function mutableState(store: GameStore): GameState {
  return store.getState() as GameState;
}

function expectRejectedWithoutChanges(store: GameStore, malformed: GameState, before: GameState, serialized: string): void {
  expect(store.loadSerialized(JSON.stringify(malformed)).ok).toBe(false);
  expect(store.getState()).toBe(before);
  expect(JSON.stringify(store.getState())).toBe(serialized);
}

describe('nested save validation', () => {
  it('rejects incomplete map objects, entities, coordinates, and calendars without replacing known-good state', () => {
    const store = new GameStore({ seed: 'nested-validation', storage: null });
    const before = mutableState(store);
    const serialized = JSON.stringify(before);
    const malformedStates: GameState[] = [];

    const missingMonsterArmy = structuredClone(before);
    const monster = missingMonsterArmy.map.objects['monster-west'];
    if (monster?.kind === 'monster') delete (monster as Partial<MonsterObject>).army;
    malformedStates.push(missingMonsterArmy);

    const missingResourcePayload = structuredClone(before);
    const resource = missingResourcePayload.map.objects['gold-west'];
    if (resource?.kind === 'resource') delete (resource as Partial<ResourceObject>).resources;
    malformedStates.push(missingResourcePayload);

    const inconsistentObjectTile = structuredClone(before);
    const displacedMonster = inconsistentObjectTile.map.objects['monster-west'];
    if (displacedMonster) displacedMonster.position = { x: 0, y: 0 };
    malformedStates.push(inconsistentObjectTile);

    const invalidMineOwner = structuredClone(before);
    const mine = invalidMineOwner.map.objects['sawmill-west'];
    if (mine?.kind === 'mine') (mine as MineObject).ownerId = 'missing-player';
    malformedStates.push(invalidMineOwner);

    const missingHeroSkills = structuredClone(before);
    const hero = missingHeroSkills.heroes['hero-aveline'];
    if (hero) delete (hero as Partial<HeroState>).primarySkills;
    malformedStates.push(missingHeroSkills);

    const fractionalHeroCoordinates = structuredClone(before);
    const displacedHero = fractionalHeroCoordinates.heroes['hero-aveline'];
    if (displacedHero) displacedHero.position.x = 1.5;
    malformedStates.push(fractionalHeroCoordinates);

    const missingTownPools = structuredClone(before);
    const town = missingTownPools.towns.haven;
    if (town) delete (town as Partial<TownState>).dwellingPools;
    malformedStates.push(missingTownPools);

    const missingPlayerResources = structuredClone(before);
    const player = missingPlayerResources.players.red;
    if (player) delete (player as Partial<PlayerState>).resources;
    malformedStates.push(missingPlayerResources);

    const fractionalCalendar = structuredClone(before);
    fractionalCalendar.calendar.day = 1.5;
    malformedStates.push(fractionalCalendar);

    for (const malformed of malformedStates) {
      expectRejectedWithoutChanges(store, malformed, before, serialized);
    }
    expect(store.getState().pendingBattle).toBeNull();
    expect(store.getReachableTiles('hero-aveline').length).toBeGreaterThan(1);
  });

  it('rejects incomplete pending-battle sides, rewards, and sources while retaining a resolvable battle', () => {
    const store = new GameStore({ seed: 'battle-validation', storage: null });
    const state = mutableState(store);
    const hero = state.heroes['hero-aveline'];
    const monster = state.map.objects['monster-west'];
    if (!hero || !monster) throw new Error('Missing pending-battle save fixture');
    hero.position = { ...monster.position };
    expect(store.initiateBattle(hero.id, monster.id).ok).toBe(true);
    const before = mutableState(store);
    const serialized = JSON.stringify(before);
    const malformedStates: GameState[] = [];

    const missingRewards = structuredClone(before);
    if (missingRewards.pendingBattle) delete (missingRewards.pendingBattle as Partial<BattleSetup>).rewards;
    malformedStates.push(missingRewards);

    const missingAttackerSkills = structuredClone(before);
    if (missingAttackerSkills.pendingBattle) {
      delete (missingAttackerSkills.pendingBattle.attacker as Partial<BattleSide>).primarySkills;
    }
    malformedStates.push(missingAttackerSkills);

    const missingDefenderArmy = structuredClone(before);
    if (missingDefenderArmy.pendingBattle) {
      delete (missingDefenderArmy.pendingBattle.defender as Partial<BattleSide>).army;
    }
    malformedStates.push(missingDefenderArmy);

    const missingSource = structuredClone(before);
    if (missingSource.pendingBattle) missingSource.pendingBattle.source.objectId = 'missing-object';
    malformedStates.push(missingSource);

    const inconsistentAttacker = structuredClone(before);
    if (inconsistentAttacker.pendingBattle) inconsistentAttacker.pendingBattle.attacker.ownerId = 'neutral';
    malformedStates.push(inconsistentAttacker);

    for (const malformed of malformedStates) {
      expectRejectedWithoutChanges(store, malformed, before, serialized);
    }
    expect(store.getState().pendingBattle?.id).toBe(before.pendingBattle?.id);
    expect(store.resolveBattleAutomatically().ok).toBe(true);
  });
});
