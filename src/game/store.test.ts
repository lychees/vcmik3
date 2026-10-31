import { describe, expect, it, vi } from 'vitest';
import { GameStore } from './GameStore';
import { toTileIndex } from './map';
import type { DwellingObject, GameState, MineObject } from './types';

function mutableState(store: GameStore): GameState {
  return store.getState() as GameState;
}

describe('GameStore movement and interactions', () => {
  it('supports subscriptions, legal hero selection, and rejects opposing heroes', () => {
    const store = new GameStore({ seed: 'selection', storage: null });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    expect(store.selectHero('hero-rowan').ok).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    const result = store.selectHero('hero-aveline');
    expect(result.ok).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.selectHero('hero-aveline');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('moves along a reachable path, spends movement, picks up resources, and reveals fog', () => {
    const store = new GameStore({ seed: 'movement', storage: null });
    const state = mutableState(store);
    const initialFog = state.fog.red?.visible.length ?? 0;
    const result = store.moveSelectedHero({ x: 5, y: Math.floor(state.map.height / 2) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.cost).toBeGreaterThan(0);
    expect(result.value.interaction.kind).toBe('resource');
    expect(state.players.red?.resources.gold).toBe(6750);
    expect(state.map.objects['gold-west']).toBeUndefined();
    expect(state.heroes['hero-aveline']?.movementPoints).toBe(1500 - result.value.cost);
    expect(state.fog.red?.visible).toContain(toTileIndex(state.map, { x: 5, y: Math.floor(state.map.height / 2) }));
    expect(state.fog.red?.visible.length).not.toBe(initialFog);
  });

  it('claims mines and recruits at adventure dwellings within resource constraints', () => {
    const store = new GameStore({ seed: 'objects', storage: null });
    const state = mutableState(store);
    const hero = state.heroes['hero-aveline'];
    const mine = state.map.objects['sawmill-west'] as MineObject;
    const dwelling = state.map.objects['dwelling-militia'] as DwellingObject;
    if (!hero) throw new Error('Missing test hero');
    hero.position = { ...mine.position };
    const claim = store.interact(hero.id);
    expect(claim.ok).toBe(true);
    expect(mine.ownerId).toBe('red');

    hero.position = { ...dwelling.position };
    const gold = state.players.red?.resources.gold ?? 0;
    const recruited = store.recruitFromDwelling(hero.id, dwelling.id, 4);
    expect(recruited.ok).toBe(true);
    expect(dwelling.available).toBe(10);
    expect(hero.army.find((stack) => stack.creatureId === 'militia')?.count).toBe(28);
    expect(state.players.red?.resources.gold).toBe(gold - 220);
    expect(store.recruitFromDwelling(hero.id, dwelling.id, 99).ok).toBe(false);
  });

  it('rejects unreachable movement without changing hero state', () => {
    const store = new GameStore({ seed: 'exhaustion', storage: null });
    const state = mutableState(store);
    const hero = state.heroes['hero-aveline'];
    if (!hero) throw new Error('Missing test hero');
    hero.movementPoints = 0;
    const position = { ...hero.position };
    expect(store.moveHero(hero.id, { x: hero.position.x + 1, y: hero.position.y }).ok).toBe(false);
    expect(hero.position).toEqual(position);
    expect(store.getReachableTiles(hero.id)).toHaveLength(1);
  });
});
