import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameStore } from '../game/GameStore';
import type { GameState } from '../game/types';
import { TownScene } from '../town/TownScene';
import { ConfirmedConstructionTownScene, ConstructionConfirmation } from './constructionPlayback';

afterEach(() => {
  vi.restoreAllMocks();
});

function observeConstruction(store: GameStore, confirmation: ConstructionConfirmation): string[] {
  const started: string[] = [];
  let previous = new Set(store.getState().towns.haven?.buildings ?? []);
  store.subscribe((state) => {
    const current = new Set(state.towns.haven?.buildings ?? []);
    for (const buildingId of current) {
      if (!previous.has(buildingId) && confirmation.consume('haven', buildingId)) started.push(buildingId);
    }
    previous = current;
  });
  return started;
}

describe('confirmed construction playback', () => {
  it('allows one matching transition and clears its one-shot confirmation', () => {
    const confirmation = new ConstructionConfirmation();
    const result = confirmation.run('haven', 'archeryRange', () => {
      expect(confirmation.consume('grove', 'archeryRange')).toBe(false);
      expect(confirmation.consume('haven', 'mageGuild')).toBe(false);
      expect(confirmation.consume('haven', 'archeryRange')).toBe(true);
      expect(confirmation.consume('haven', 'archeryRange')).toBe(false);
      return 'built';
    });
    expect(result).toBe('built');
    expect(confirmation.consume('haven', 'archeryRange')).toBe(false);
  });

  it('starts exactly once for a confirmed successful store construction and not for later rerenders', () => {
    const store = new GameStore({ seed: 'confirmed-construction', storage: null });
    const confirmation = new ConstructionConfirmation();
    const started = observeConstruction(store, confirmation);

    const result = confirmation.run('haven', 'archeryRange', () => store.constructBuilding('haven', 'archeryRange'));
    expect(result.ok).toBe(true);
    expect(started).toEqual(['archeryRange']);
    expect(store.recruitCreature('haven', 'archer', 1).ok).toBe(true);
    expect(store.loadSerialized(JSON.stringify(store.getState())).ok).toBe(true);
    expect(started).toEqual(['archeryRange']);
  });

  it('does not start for unconfirmed free, AI, loaded, or old-save construction transitions', () => {
    const store = new GameStore({ seed: 'unconfirmed-construction', storage: null });
    const confirmation = new ConstructionConfirmation();
    const started = observeConstruction(store, confirmation);

    expect(store.constructBuilding('haven', 'archeryRange').ok).toBe(true);
    const loaded = structuredClone(store.getState()) as GameState;
    loaded.towns.haven!.buildings.push('mageGuild');
    expect(store.loadSerialized(JSON.stringify(loaded)).ok).toBe(true);
    expect(started).toEqual([]);
  });

  it('clears failed and thrown confirmations without starting or leaking into a later action', () => {
    const store = new GameStore({ seed: 'failed-construction', storage: null });
    const confirmation = new ConstructionConfirmation();
    const started = observeConstruction(store, confirmation);
    const state = store.getState() as GameState;
    for (const resource of Object.keys(state.players.red!.resources) as Array<keyof GameState['players'][string]['resources']>) {
      state.players.red!.resources[resource] = 0;
    }

    const failed = confirmation.run('haven', 'archeryRange', () => store.constructBuilding('haven', 'archeryRange'));
    expect(failed.ok).toBe(false);
    expect(confirmation.consume('haven', 'archeryRange')).toBe(false);
    expect(() => confirmation.run('haven', 'archeryRange', () => {
      throw new Error('cancelled');
    })).toThrow('cancelled');
    expect(confirmation.consume('haven', 'archeryRange')).toBe(false);
    expect(started).toEqual([]);
  });

  it('gates the scene start method itself while preserving the confirmed base start', () => {
    const start = vi.spyOn(TownScene.prototype, 'startConstruction').mockReturnValue(null);
    const confirmation = new ConstructionConfirmation();
    const scene = Object.create(ConfirmedConstructionTownScene.prototype) as ConfirmedConstructionTownScene;
    Object.defineProperty(scene, 'confirmation', { value: confirmation });

    expect(scene.startConstruction('haven', 'archeryRange')).toBeNull();
    expect(start).not.toHaveBeenCalled();
    confirmation.run('haven', 'archeryRange', () => {
      scene.startConstruction('haven', 'archeryRange', { autoplay: false });
      scene.startConstruction('haven', 'archeryRange');
    });
    expect(start).toHaveBeenCalledOnce();
    expect(start).toHaveBeenCalledWith('haven', 'archeryRange', { autoplay: false });
  });
});
