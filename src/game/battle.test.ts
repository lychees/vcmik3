import { describe, expect, it } from 'vitest';
import { resolveBattleAutomatically } from './combat';
import { GameStore } from './GameStore';
import type { BattleResult, GameState, MonsterObject } from './types';

function mutableState(store: GameStore): GameState {
  return store.getState() as GameState;
}

function prepareMonsterBattle(store: GameStore): { setupId: string; monster: MonsterObject } {
  const state = mutableState(store);
  const hero = state.heroes['hero-aveline'];
  const monster = state.map.objects['monster-west'];
  if (!hero || monster?.kind !== 'monster') throw new Error('Missing battle fixture');
  hero.position = { ...monster.position };
  const setup = store.initiateBattle(hero.id, monster.id);
  expect(setup.ok).toBe(true);
  if (!setup.ok) throw new Error(setup.error);
  expect(state.pendingBattle?.id).toBe(setup.value.id);
  return { setupId: setup.value.id, monster };
}

describe('battle handoff', () => {
  it('creates a typed setup and applies surviving armies, rewards, experience, and levels', () => {
    const store = new GameStore({ seed: 'battle-win', storage: null });
    const state = mutableState(store);
    const { setupId } = prepareMonsterBattle(store);
    const setup = state.pendingBattle;
    expect(setup?.source.kind).toBe('monster');
    expect(setup?.attacker.army).toEqual(state.heroes['hero-aveline']?.army);
    expect(setup?.defender.army).toEqual([{ creatureId: 'militia', count: 16 }]);
    if (!setup) throw new Error('Missing setup');
    expect(resolveBattleAutomatically(setup)).toEqual(resolveBattleAutomatically(setup));

    const skills = state.heroes['hero-aveline']?.primarySkills;
    const skillTotal = skills ? skills.attack + skills.defense + skills.spellPower + skills.knowledge : 0;
    const gold = state.players.red?.resources.gold ?? 0;
    const result: BattleResult = {
      setupId,
      winner: 'attacker',
      attackerArmy: [{ creatureId: 'militia', count: 20 }],
      defenderArmy: [],
      rewards: { experience: 1000, resources: { gold: 500 } },
      rounds: 4,
    };
    expect(store.applyBattleResult(result).ok).toBe(true);
    const hero = state.heroes['hero-aveline'];
    expect(hero?.army).toEqual([{ creatureId: 'militia', count: 20 }]);
    expect(hero?.level).toBe(2);
    expect(hero?.experience).toBe(1000);
    expect(state.map.objects['monster-west']).toBeUndefined();
    expect(state.players.red?.resources.gold).toBe(gold + 500);
    const updatedSkills = hero?.primarySkills;
    expect(updatedSkills ? updatedSkills.attack + updatedSkills.defense + updatedSkills.spellPower + updatedSkills.knowledge : 0).toBe(skillTotal + 1);
    expect(state.pendingBattle).toBeNull();
  });

  it('rejects invalid survivors and handles attacker defeat', () => {
    const store = new GameStore({ seed: 'battle-loss', storage: null });
    const state = mutableState(store);
    const { setupId, monster } = prepareMonsterBattle(store);
    const invalid: BattleResult = {
      setupId, winner: 'attacker', attackerArmy: [{ creatureId: 'dragon', count: 99 }], defenderArmy: [],
      rewards: { experience: 0, resources: {} }, rounds: 1,
    };
    expect(store.applyBattleResult(invalid).ok).toBe(false);
    expect(state.pendingBattle?.id).toBe(setupId);
    const defeat: BattleResult = {
      setupId, winner: 'defender', attackerArmy: [], defenderArmy: [{ creatureId: 'militia', count: 10 }],
      rewards: { experience: 100, resources: {} }, rounds: 5,
    };
    expect(store.applyBattleResult(defeat).ok).toBe(true);
    expect(state.heroes['hero-aveline']?.alive).toBe(false);
    expect(state.heroes['hero-aveline']?.army).toEqual([]);
    expect(monster.army).toEqual([{ creatureId: 'militia', count: 10 }]);
    expect(state.selectedHeroId).toBe('hero-seraphine');
  });

  it('supports sieges and town ownership changes', () => {
    const store = new GameStore({ seed: 'siege', storage: null });
    const state = mutableState(store);
    const hero = state.heroes['hero-aveline'];
    const town = state.towns.grove;
    if (!hero || !town) throw new Error('Missing siege fixture');
    hero.position = { ...town.position };
    const setup = store.initiateBattle(hero.id, 'town-grove');
    expect(setup.ok).toBe(true);
    if (!setup.ok) return;
    expect(setup.value.source.kind).toBe('town');
    for (const candidate of Object.values(state.heroes)) {
      if (candidate.ownerId === 'blue') candidate.alive = false;
    }
    for (const candidate of Object.values(state.towns)) {
      if (candidate.ownerId === 'blue') candidate.ownerId = 'red';
    }
    expect(store.applyBattleResult({
      setupId: setup.value.id,
      winner: 'attacker',
      attackerArmy: [{ creatureId: 'militia', count: 18 }],
      defenderArmy: [],
      rewards: { experience: 1000, resources: { gold: 1000 } },
      rounds: 6,
    }).ok).toBe(true);
    expect(town.ownerId).toBe('red');
    expect(town.garrison).toEqual([]);
    expect(state.phase).toBe('victory');
  });

  it('rejects monster outcomes that would erase surviving defenders and preserves round-limit survivors', () => {
    const store = new GameStore({ seed: 'monster-survivors', storage: null });
    const state = mutableState(store);
    const { setupId, monster } = prepareMonsterBattle(store);
    const originalMonsterArmy = monster.army.map((stack) => ({ ...stack }));
    const invalid: BattleResult = {
      setupId,
      winner: 'attacker',
      attackerArmy: [{ creatureId: 'militia', count: 20 }],
      defenderArmy: originalMonsterArmy,
      rewards: { experience: 500, resources: {} },
      rounds: 3,
    };
    expect(store.applyBattleResult(invalid).ok).toBe(false);
    expect(state.map.objects['monster-west']).toBe(monster);
    expect(monster.army).toEqual(originalMonsterArmy);
    expect(state.pendingBattle?.id).toBe(setupId);
    expect(store.applyBattleResult({
      ...invalid,
      attackerArmy: [],
      defenderArmy: [],
    }).ok).toBe(false);
    expect(state.pendingBattle?.id).toBe(setupId);

    expect(store.applyBattleResult({
      ...invalid,
      winner: 'draw',
      rounds: 100,
    }).ok).toBe(true);
    expect(state.heroes['hero-aveline']?.army).toEqual([{ creatureId: 'militia', count: 20 }]);
    expect(monster.army).toEqual(originalMonsterArmy);
    expect(state.map.objects['monster-west']).toBe(monster);
  });

  it('rejects siege captures with surviving garrisons and preserves both armies on a draw', () => {
    const store = new GameStore({ seed: 'siege-survivors', storage: null });
    const state = mutableState(store);
    const hero = state.heroes['hero-aveline'];
    const town = state.towns.grove;
    if (!hero || !town) throw new Error('Missing siege survivor fixture');
    hero.position = { ...town.position };
    const setup = store.initiateBattle(hero.id, 'town-grove');
    expect(setup.ok).toBe(true);
    if (!setup.ok) return;
    const originalOwner = town.ownerId;
    const result: BattleResult = {
      setupId: setup.value.id,
      winner: 'attacker',
      attackerArmy: [{ creatureId: 'militia', count: 18 }],
      defenderArmy: [{ creatureId: 'sprite', count: 10 }],
      rewards: { experience: 1000, resources: { gold: 1000 } },
      rounds: 6,
    };
    expect(store.applyBattleResult(result).ok).toBe(false);
    expect(town.ownerId).toBe(originalOwner);
    expect(town.garrison).toEqual([{ creatureId: 'sprite', count: 16 }]);
    expect(state.pendingBattle?.id).toBe(setup.value.id);

    expect(store.applyBattleResult({ ...result, winner: 'draw', rounds: 100 }).ok).toBe(true);
    expect(town.ownerId).toBe(originalOwner);
    expect(town.garrison).toEqual([{ creatureId: 'sprite', count: 10 }]);
    expect(hero.army).toEqual([{ creatureId: 'militia', count: 18 }]);
  });

  it('returns a draw instead of a health-based win when automatic combat reaches its round limit', () => {
    const store = new GameStore({ seed: 'round-limit', storage: null });
    const { setupId } = prepareMonsterBattle(store);
    const setup = mutableState(store).pendingBattle;
    if (!setup) throw new Error('Missing round-limit setup');
    setup.attacker.army = [{ creatureId: 'militia', count: 1 }];
    setup.defender.army = [{ creatureId: 'militia', count: 1 }];
    setup.attacker.primarySkills = { attack: 0, defense: 100, spellPower: 0, knowledge: 0 };
    setup.defender.primarySkills = { attack: 0, defense: 100, spellPower: 0, knowledge: 0 };
    const result = resolveBattleAutomatically(setup);
    expect(result.setupId).toBe(setupId);
    expect(result.rounds).toBe(100);
    expect(result.winner).toBe('draw');
    expect(result.attackerArmy).toEqual([{ creatureId: 'militia', count: 1 }]);
    expect(result.defenderArmy).toEqual([{ creatureId: 'militia', count: 1 }]);
    expect(result.rewards).toEqual({ experience: 0, resources: {} });
  });
});
