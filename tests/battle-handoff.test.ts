import { describe, expect, it, vi } from 'vitest';
import { runTacticalAutoBattle } from '../src/battle';
import { GameStore } from '../src/game';
import type { BattleResult, BattleSetup, GameState } from '../src/game/types';
import { BattleHandoff } from '../src/integration/BattleHandoff';

interface FakeView {
  setup: BattleSetup;
  complete: (result: BattleResult) => void;
  resize: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
}

function mutableState(store: GameStore): GameState {
  return store.getState() as GameState;
}

function createHarness(store: GameStore) {
  const views: FakeView[] = [];
  const battleActive: boolean[] = [];
  const visibility: boolean[] = [];
  const errors: Error[] = [];
  const handoff = new BattleHandoff({
    store,
    ui: { setBattleActive: (active) => battleActive.push(active) },
    createView: (setup, complete) => {
      const view: FakeView = { setup, complete, resize: vi.fn(), dispose: vi.fn() };
      views.push(view);
      return view;
    },
    onVisibilityChange: (active) => visibility.push(active),
    onError: (error) => errors.push(error),
  });
  return { views, battleActive, visibility, errors, handoff };
}

function beginMonsterBattle(store: GameStore): BattleSetup {
  const state = mutableState(store);
  const hero = state.heroes['hero-aveline'];
  const monster = state.map.objects['monster-west'];
  if (!hero || monster?.kind !== 'monster') throw new Error('Missing battle fixtures');
  hero.position = { ...monster.position };
  const result = store.initiateBattle(hero.id, monster.id);
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe('BattleHandoff application contract', () => {
  it('creates one view per pending id, disposes across restart/load, and applies one result', () => {
    const store = new GameStore({ seed: 'single-battle', storage: null });
    const { views, battleActive, visibility, errors, handoff } = createHarness(store);
    expect(views).toHaveLength(0);

    const setup = beginMonsterBattle(store);
    expect(views).toHaveLength(1);
    expect(views[0]?.setup.id).toBe(setup.id);
    expect(battleActive).toEqual([true]);
    expect(visibility).toEqual([true]);

    expect(store.selectHero('hero-aveline').ok).toBe(true);
    handoff.resize();
    expect(views).toHaveLength(1);
    expect(views[0]?.resize).toHaveBeenCalledTimes(1);
    expect(store.saveGame).toBeDefined();

    expect(store.newGame('restart').ok).toBe(true);
    expect(views[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(battleActive).toEqual([true, false]);
    expect(visibility).toEqual([true, false]);

    const pendingStore = new GameStore({ seed: 'pending-save', storage: null });
    const pending = beginMonsterBattle(pendingStore);
    expect(pendingStore.loadSerialized(JSON.stringify(pendingStore.getState())).ok).toBe(true);
    expect(store.loadSerialized(JSON.stringify(pendingStore.getState())).ok).toBe(true);
    expect(views).toHaveLength(2);
    expect(views[1]?.setup.id).toBe(pending.id);
    expect(battleActive).toEqual([true, false, true]);

    const result = runTacticalAutoBattle(pending).getResult();
    if (!result) throw new Error('Missing battle result');
    views[1]?.complete(result);
    expect(store.getState().pendingBattle).toBeNull();
    expect(views[1]?.dispose).toHaveBeenCalledTimes(1);
    const revision = store.getState().revision;
    views[1]?.complete(result);
    expect(store.getState().revision).toBe(revision);
    expect(views).toHaveLength(2);
    expect(errors).toEqual([]);

    handoff.dispose();
    handoff.dispose();
    expect(views[1]?.dispose).toHaveBeenCalledTimes(1);
  });

  it('restores a pending battle during construction without duplicating it', () => {
    const source = new GameStore({ seed: 'restore-active', storage: null });
    beginMonsterBattle(source);
    const restored = new GameStore({ storage: null });
    expect(restored.loadSerialized(JSON.stringify(source.getState())).ok).toBe(true);
    const { views, battleActive, handoff } = createHarness(restored);
    expect(views).toHaveLength(1);
    expect(battleActive).toEqual([true]);
    restored.selectHero('hero-aveline');
    expect(views).toHaveLength(1);
    handoff.dispose();
    expect(views[0]?.dispose).toHaveBeenCalledTimes(1);
  });

  it.each(['victory', 'defeat'] as const)('leaves battle mode after campaign %s', (phase) => {
    const store = new GameStore({ seed: `campaign-${phase}`, storage: null });
    const state = mutableState(store);
    const { views, battleActive, handoff } = createHarness(store);
    const hero = state.heroes['hero-aveline'];
    if (!hero) throw new Error('Missing outcome hero');

    let setup: BattleSetup;
    let result: BattleResult;
    if (phase === 'victory') {
      const town = state.towns.grove;
      if (!town) throw new Error('Missing enemy town');
      hero.position = { ...town.position };
      for (const candidate of Object.values(state.heroes)) {
        if (candidate.ownerId === 'blue') candidate.alive = false;
      }
      for (const candidate of Object.values(state.towns)) {
        if (candidate.id !== 'grove' && candidate.ownerId === 'blue') candidate.ownerId = 'red';
      }
      const initiated = store.initiateBattle(hero.id, 'town-grove');
      if (!initiated.ok) throw new Error(initiated.error);
      setup = initiated.value;
      result = {
        setupId: setup.id,
        winner: 'attacker',
        attackerArmy: setup.attacker.army.map((stack) => ({ ...stack })),
        defenderArmy: [],
        rewards: { experience: setup.rewards.experience, resources: { ...setup.rewards.resources } },
        rounds: 1,
      };
    } else {
      for (const candidate of Object.values(state.heroes)) {
        if (candidate.ownerId === 'red' && candidate.id !== hero.id) candidate.alive = false;
      }
      for (const town of Object.values(state.towns)) {
        if (town.ownerId === 'red') town.ownerId = 'blue';
      }
      setup = beginMonsterBattle(store);
      result = {
        setupId: setup.id,
        winner: 'defender',
        attackerArmy: [],
        defenderArmy: setup.defender.army.map((stack) => ({ ...stack })),
        rewards: { experience: setup.rewards.experience, resources: { ...setup.rewards.resources } },
        rounds: 1,
      };
    }

    expect(views).toHaveLength(1);
    views[0]?.complete(result);
    expect(store.getState().phase).toBe(phase);
    expect(store.getState().pendingBattle).toBeNull();
    expect(battleActive).toEqual([true, false]);
    expect(views[0]?.dispose).toHaveBeenCalledTimes(1);
    handoff.dispose();
  });
});
