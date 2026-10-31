import { describe, expect, it } from 'vitest';
import { runTacticalAutoBattle } from '../src/battle';
import { GameStore } from '../src/game';
import type { GameState } from '../src/game/types';

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

function mutableState(store: GameStore): GameState {
  return store.getState() as GameState;
}

describe('integrated campaign flow', () => {
  it('plays movement, town development, recruitment, turns, tactical battle, and save/load through real modules', () => {
    const storage = new MemoryStorage();
    const store = new GameStore({ seed: 'integrated-smoke', storage });
    expect(store.newGame('integrated-smoke').ok).toBe(true);
    const state = mutableState(store);
    const hero = state.heroes['hero-aveline'];
    const town = state.towns.haven;
    if (!hero || !town) throw new Error('Missing campaign fixtures');

    const movement = store.moveSelectedHero(town.position);
    expect(movement.ok).toBe(true);
    if (!movement.ok) throw new Error(movement.error);
    expect(movement.value.interaction).toMatchObject({ kind: 'town', townId: 'haven' });
    expect(hero.position).toEqual(town.position);
    expect(hero.movementPoints).toBeLessThan(hero.maxMovementPoints);

    expect(store.constructBuilding('haven', 'archeryRange').ok).toBe(true);
    expect(town.buildings).toContain('archeryRange');
    expect(town.dwellingPools.archer).toBe(9);
    const goldBeforeRecruit = state.players.red?.resources.gold;
    expect(store.recruitCreature('haven', 'archer', 2).ok).toBe(true);
    expect(town.garrison.find((stack) => stack.creatureId === 'archer')?.count).toBe(2);
    expect(town.dwellingPools.archer).toBe(7);
    expect(state.players.red?.resources.gold).toBe((goldBeforeRecruit ?? 0) - 220);
    expect(store.transferCreatures(hero.id, 'haven', 'archer', 2, 'toHero').ok).toBe(true);
    expect(hero.army.find((stack) => stack.creatureId === 'archer')?.count).toBe(14);
    expect(store.saveGame('slot-1').ok).toBe(true);

    const previousDay = state.calendar.day;
    const turn = store.endTurn();
    expect(turn.ok).toBe(true);
    expect(state.activePlayerId).toBe('red');
    expect(state.calendar.day).toBeGreaterThan(previousDay);
    expect(hero.movementPoints).toBe(hero.maxMovementPoints);

    const monster = state.map.objects['monster-west'];
    if (!monster || monster.kind !== 'monster') throw new Error('Missing integrated monster');
    const encounter = store.moveSelectedHero(monster.position);
    expect(encounter.ok).toBe(true);
    if (!encounter.ok) throw new Error(encounter.error);
    expect(encounter.value.interaction.kind).toBe('battle');
    const setup = state.pendingBattle;
    expect(setup?.source).toMatchObject({ heroId: hero.id, objectId: monster.id, kind: 'monster' });
    expect(store.initiateBattle(hero.id, monster.id).ok).toBe(false);
    expect(store.getReachableTiles()).toEqual([]);
    if (!setup) throw new Error('Missing battle handoff');

    const engine = runTacticalAutoBattle(setup);
    const result = engine.getResult();
    expect(result).not.toBeNull();
    if (!result) throw new Error('Missing tactical result');
    expect(result.setupId).toBe(setup.id);
    expect(result.rounds).toBeGreaterThan(0);
    expect(store.applyBattleResult(result).ok).toBe(true);
    expect(state.pendingBattle).toBeNull();
    expect(store.applyBattleResult(result).ok).toBe(false);

    const restored = new GameStore({ seed: 'unused', storage });
    expect(restored.loadGame('slot-1').ok).toBe(true);
    expect(restored.getState().pendingBattle).toBeNull();
    expect(restored.getState().towns.haven?.buildings).toContain('archeryRange');
    expect(restored.getState().towns.haven?.dwellingPools.archer).toBe(7);
    expect(restored.getState().heroes['hero-aveline']?.army).toEqual([
      { creatureId: 'militia', count: 24 },
      { creatureId: 'archer', count: 14 },
    ]);
    expect(restored.getState().calendar.day).toBe(1);

    expect(restored.newGame('restart-seed').ok).toBe(true);
    expect(restored.getState().seed).toBe('restart-seed');
    expect(restored.getState().calendar.day).toBe(1);
    expect(restored.getState().pendingBattle).toBeNull();
  });
});
