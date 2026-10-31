import { describe, expect, it } from 'vitest';
import { GameStore } from '../game/GameStore';
import { createInitialGameState } from '../game/scenario';
import type { DwellingObject, GameState } from '../game/types';
import { TILE_SIZE } from './coordinates';
import {
  createMapSnapshot,
  createTravelTimeline,
  describeArmy,
  formatResources,
  sampleTravel,
} from './presentation';

describe('adventure travel presentation', () => {
  it('follows the exact store path and clamps samples to its endpoints', () => {
    const state = createInitialGameState('travel-presentation');
    const path = [
      { x: 3, y: 10 },
      { x: 4, y: 10 },
      { x: 5, y: 11 },
      { x: 6, y: 11 },
    ];
    const timeline = createTravelTimeline(state, path, 5);
    expect(timeline.frames).toHaveLength(path.length);
    expect(timeline.duration).toBeGreaterThan(3 / 5);
    expect(sampleTravel(timeline, -1)).toEqual(timeline.frames[0]?.position);
    expect(sampleTravel(timeline, timeline.duration + 1)).toEqual(timeline.frames.at(-1)?.position);
    const diagonal = timeline.frames[2];
    expect(diagonal).toBeDefined();
    if (!diagonal) return;
    expect(sampleTravel(timeline, diagonal.time)).toEqual(diagonal.position);
    const halfway = sampleTravel(timeline, timeline.frames[1]!.time / 2);
    expect(halfway?.x).toBeCloseTo((timeline.frames[0]!.position.x + timeline.frames[1]!.position.x) / 2);
  });

  it('handles empty and single-point paths without division errors', () => {
    const state = createInitialGameState('empty-path');
    expect(createTravelTimeline(state, [])).toEqual({ duration: 0, frames: [] });
    expect(sampleTravel(createTravelTimeline(state, []), 0)).toBeNull();
    const timeline = createTravelTimeline(state, [{ x: 0, y: 0 }]);
    expect(timeline.duration).toBe(0);
    expect(sampleTravel(timeline, 100)).toEqual(timeline.frames[0]?.position);
  });
});

describe('minimap state adapter', () => {
  it('combines terrain, ownership, fog, heroes, and store reachability', () => {
    const store = new GameStore({ seed: 'snapshot', storage: null });
    const state = store.getState();
    const reachable = store.getReachableTiles();
    const snapshot = createMapSnapshot(state, reachable);
    expect(snapshot.width).toBe(state.map.width);
    expect(snapshot.height).toBe(state.map.height);
    expect(snapshot.tileSize).toBe(TILE_SIZE);
    expect(snapshot.tiles).toHaveLength(state.map.tiles.length);
    expect(snapshot.selectedHeroId).toBe('hero-aveline');
    expect(snapshot.heroes.find((hero) => hero.id === 'hero-aveline')?.visible).toBe(true);
    expect(snapshot.heroes.find((hero) => hero.id === 'hero-rowan')?.visible).toBe(false);
    expect(snapshot.objects.find((object) => object.id === 'town-haven')?.ownerId).toBe('red');
    expect(snapshot.objects.find((object) => object.id === 'town-grove')?.ownerId).toBe('blue');
    const gold = state.map.objects['gold-west'];
    expect(gold).toBeDefined();
    if (!gold) return;
    const goldIndex = gold.position.y * state.map.width + gold.position.x;
    expect(snapshot.tiles[goldIndex]?.reachable).toBe(true);
    expect(snapshot.tiles[goldIndex]?.movementCost).toBeGreaterThan(0);
    const hiddenIndex = state.map.height * state.map.width - 1;
    if (!state.fog.red?.explored.includes(hiddenIndex)) {
      expect(snapshot.tiles[hiddenIndex]?.objectId).toBeNull();
    }
  });

  it('marks depleted dwellings without changing simulation state', () => {
    const state = createInitialGameState('depleted') as GameState;
    const dwelling = state.map.objects['dwelling-militia'] as DwellingObject;
    dwelling.available = 0;
    const snapshot = createMapSnapshot(state);
    expect(snapshot.objects.find((object) => object.id === dwelling.id)?.depleted).toBe(true);
    expect(dwelling.available).toBe(0);
  });
});

describe('accessible object descriptions', () => {
  it('formats resources and creature names for DOM tooltips', () => {
    expect(formatResources({ gold: 250, wood: 2, ore: 0 })).toBe('250 gold, 2 wood');
    expect(describeArmy([{ creatureId: 'militia', count: 12 }])).toBe('12 Militia');
    expect(describeArmy([])).toBe('No creatures');
  });
});
