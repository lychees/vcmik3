import { describe, expect, it } from 'vitest';
import { GameStore } from './GameStore';
import type { GameState } from './types';

function mutableState(store: GameStore): GameState {
  return store.getState() as GameState;
}

describe('calendar and AI adventure turns', () => {
  it('restores human movement and mana while the AI explores deterministically', () => {
    const first = new GameStore({ seed: 'turns', storage: null });
    const second = new GameStore({ seed: 'turns', storage: null });
    const state = mutableState(first);
    const human = state.heroes['hero-aveline'];
    if (!human) throw new Error('Missing human hero');
    human.movementPoints = 0;
    human.mana = 0;
    const aiStart = { ...state.heroes['hero-rowan']?.position };
    const result = first.endTurn();
    expect(result.ok).toBe(true);
    expect(state.calendar.day).toBe(2);
    expect(state.activePlayerId).toBe('red');
    expect(human.movementPoints).toBe(human.maxMovementPoints);
    expect(human.mana).toBe(human.maxMana);
    expect(state.heroes['hero-rowan']?.position).not.toEqual(aiStart);
    expect(second.endTurn().ok).toBe(true);
    expect(mutableState(second).heroes).toEqual(state.heroes);
    expect(mutableState(second).players).toEqual(state.players);
  });

  it('resolves neutral encounters automatically during an AI turn', () => {
    const store = new GameStore({ seed: 'ai-combat', storage: null });
    const state = mutableState(store);
    for (const [id, object] of Object.entries(state.map.objects)) {
      if (object.kind !== 'monster' && object.kind !== 'town') delete state.map.objects[id];
    }
    const hero = state.heroes['hero-rowan'];
    const monster = state.map.objects['monster-east'];
    if (!hero || monster?.kind !== 'monster') throw new Error('Missing AI encounter');
    state.activePlayerId = 'blue';
    hero.army = [{ creatureId: 'dragon', count: 5 }];
    hero.position = { x: monster.position.x, y: monster.position.y - 1 };
    const result = store.runAiTurn('blue');
    expect(result.ok).toBe(true);
    expect(state.pendingBattle).toBeNull();
    expect(state.map.objects['monster-east']).toBeUndefined();
    expect(hero.alive).toBe(true);
    expect(hero.experience).toBeGreaterThan(0);
  });

  it('recognizes victory when the opposing player has no towns or heroes', () => {
    const store = new GameStore({ seed: 'victory', storage: null });
    const state = mutableState(store);
    for (const hero of Object.values(state.heroes)) {
      if (hero.ownerId === 'blue') hero.alive = false;
    }
    for (const town of Object.values(state.towns)) {
      if (town.ownerId === 'blue') town.ownerId = 'red';
    }
    expect(store.endTurn().ok).toBe(true);
    expect(state.phase).toBe('victory');
    expect(state.winnerId).toBe('red');
    expect(store.endTurn().ok).toBe(false);
  });

  it('recognizes defeat when the human player is eliminated', () => {
    const store = new GameStore({ seed: 'defeat', storage: null });
    const state = mutableState(store);
    for (const hero of Object.values(state.heroes)) {
      if (hero.ownerId === 'red') hero.alive = false;
    }
    for (const town of Object.values(state.towns)) {
      if (town.ownerId === 'red') town.ownerId = 'blue';
    }
    expect(store.endTurn().ok).toBe(true);
    expect(state.phase).toBe('defeat');
    expect(state.winnerId).toBe('blue');
  });
});
