import { describe, expect, it } from 'vitest';
import { GameStore } from './GameStore';

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

describe('localStorage persistence', () => {
  it('round-trips a complete game and pending battle through injected storage', () => {
    const storage = new MemoryStorage();
    const store = new GameStore({ seed: 'save', storage });
    expect(store.constructBuilding('haven', 'archeryRange').ok).toBe(true);
    expect(store.saveGame('slot-1').ok).toBe(true);
    expect(store.hasSavedGame('slot-1')).toBe(true);

    const loaded = new GameStore({ seed: 'other', storage, autoLoad: false });
    const result = loaded.loadGame('slot-1');
    expect(result.ok).toBe(true);
    expect(loaded.getState().seed).toBe('save');
    expect(loaded.getState().towns.haven?.buildings).toContain('archeryRange');
    expect(loaded.getState().map).toEqual(store.getState().map);

    const state = loaded.getState();
    const hero = state.heroes['hero-aveline'];
    const monster = state.map.objects['monster-west'];
    if (!hero || !monster) throw new Error('Missing save battle fixture');
    hero.position = { ...monster.position };
    expect(loaded.initiateBattle(hero.id, monster.id).ok).toBe(true);
    expect(loaded.saveGame().ok).toBe(true);
    const pending = loaded.getState().pendingBattle;
    const restored = new GameStore({ storage, autoLoad: true });
    expect(restored.getState().pendingBattle?.id).toBe(pending?.id);
  });

  it('rejects malformed saves without replacing the current state', () => {
    const store = new GameStore({ seed: 'safe', storage: null });
    const before = store.getState();
    expect(store.loadSerialized('{not-json').ok).toBe(false);
    expect(store.getState()).toBe(before);
    expect(store.loadSerialized(JSON.stringify({ version: 2 })).ok).toBe(false);
    expect(store.getState()).toBe(before);
    expect(store.loadGame().ok).toBe(false);
    expect(store.saveGame().ok).toBe(false);
  });

  it('falls back safely when storage throws', () => {
    const storage: Storage = {
      length: 0,
      clear: () => undefined,
      getItem: () => { throw new Error('denied'); },
      key: () => null,
      removeItem: () => undefined,
      setItem: () => { throw new Error('quota'); },
    };
    const store = new GameStore({ storage });
    expect(store.saveGame().ok).toBe(false);
    expect(store.loadGame().ok).toBe(false);
    expect(store.hasSavedGame()).toBe(false);
  });
});
