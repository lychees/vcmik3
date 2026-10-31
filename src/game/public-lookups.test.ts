import { describe, expect, it } from 'vitest';
import { isTileExplored, isTileVisible, updateFog } from './fog';
import { GameStore } from './GameStore';
import { getObjectAt } from './map';
import type { GameState } from './types';

const UNKNOWN_IDS = ['toString', 'constructor', '__proto__', 'ordinary-missing'] as const;

function mutableState(store: GameStore): GameState {
  return store.getState() as GameState;
}

describe('public entity and fog lookups', () => {
  it('returns contract-safe neutral results for inherited and unknown IDs', () => {
    const store = new GameStore({ seed: 'public-lookups', storage: null });
    const state = mutableState(store);
    const position = state.heroes['hero-aveline']?.position ?? { x: 0, y: 0 };
    const selectedHeroId = state.selectedHeroId;

    for (const id of UNKNOWN_IDS) {
      expect(store.getHero(id), `hero:${id}`).toBeUndefined();
      expect(store.getTown(id), `town:${id}`).toBeUndefined();
      expect(store.getPlayer(id), `player:${id}`).toBeUndefined();
      expect(isTileVisible(state, id, position), `visible:${id}`).toBe(false);
      expect(isTileExplored(state, id, position), `explored:${id}`).toBe(false);
      expect(store.getReachableTiles(id), `reachable:${id}`).toEqual([]);
      expect(store.findHeroPath(id, position), `path:${id}`).toBeNull();

      state.selectedHeroId = id;
      expect(store.getSelectedHero(), `selected:${id}`).toBeNull();
      const fog = JSON.stringify(state.fog);
      expect(() => updateFog(state, id), `updateFog:${id}`).not.toThrow();
      expect(JSON.stringify(state.fog), `updateFog state:${id}`).toBe(fog);
    }
    state.selectedHeroId = selectedHeroId;

    expect(store.getHero('hero-aveline')?.id).toBe('hero-aveline');
    expect(store.getTown('haven')?.id).toBe('haven');
    expect(store.getPlayer('red')?.id).toBe('red');
    expect(store.getSelectedHero()?.id).toBe('hero-aveline');
    expect(isTileVisible(state, 'red', position)).toBe(true);
    expect(isTileExplored(state, 'red', position)).toBe(true);
    expect(store.getReachableTiles('hero-aveline').length).toBeGreaterThan(1);
    expect(store.findHeroPath('hero-aveline', position)).not.toBeNull();
  });

  it('returns undefined for inherited map object references while preserving valid lookups', () => {
    const store = new GameStore({ seed: 'object-lookups', storage: null });
    const state = mutableState(store);
    const tile = state.map.tiles[0];
    if (!tile) throw new Error('Missing map object lookup tile');
    const originalObjectId = tile.objectId;
    for (const id of UNKNOWN_IDS) {
      tile.objectId = id;
      expect(getObjectAt(state.map, tile), `object:${id}`).toBeUndefined();
    }
    tile.objectId = originalObjectId;
    const town = state.towns.haven;
    if (!town) throw new Error('Missing valid town lookup');
    expect(getObjectAt(state.map, town.position)).toMatchObject({ kind: 'town', townId: 'haven' });
  });
});
