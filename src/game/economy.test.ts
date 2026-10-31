import { describe, expect, it } from 'vitest';
import { GameStore } from './GameStore';
import type { GameState } from './types';

function mutableState(store: GameStore): GameState {
  return store.getState() as GameState;
}

describe('town economy and recruitment', () => {
  it('enforces building prerequisites, costs, and one construction per day', () => {
    const store = new GameStore({ seed: 'building', storage: null });
    const state = mutableState(store);
    expect(store.constructBuilding('haven', 'griffinTower').ok).toBe(false);
    const gold = state.players.red?.resources.gold ?? 0;
    const wood = state.players.red?.resources.wood ?? 0;
    const built = store.constructBuilding('haven', 'archeryRange');
    expect(built.ok).toBe(true);
    expect(state.towns.haven?.buildings).toContain('archeryRange');
    expect(state.towns.haven?.dwellingPools.archer).toBe(9);
    expect(state.players.red?.resources.gold).toBe(gold - 700);
    expect(state.players.red?.resources.wood).toBe(wood - 8);
    expect(store.constructBuilding('haven', 'market').ok).toBe(false);
  });

  it('recruits creatures, preserves resources on failure, and transfers garrison stacks', () => {
    const store = new GameStore({ seed: 'recruitment', storage: null });
    const state = mutableState(store);
    expect(store.constructBuilding('haven', 'archeryRange').ok).toBe(true);
    expect(store.recruitCreature('haven', 'archer', 2).ok).toBe(true);
    expect(state.towns.haven?.dwellingPools.archer).toBe(7);
    expect(state.towns.haven?.garrison.find((stack) => stack.creatureId === 'archer')?.count).toBe(2);
    expect(state.players.red?.resources.gold).toBe(5080);
    expect(store.recruitCreature('haven', 'archer', 100).ok).toBe(false);

    const hero = state.heroes['hero-aveline'];
    const town = state.towns.haven;
    if (!hero || !town) throw new Error('Missing test entities');
    hero.position = { ...town.position };
    expect(store.transferCreatures(hero.id, town.id, 'archer', 2, 'toHero').ok).toBe(true);
    expect(hero.army.find((stack) => stack.creatureId === 'archer')?.count).toBe(14);
    expect(town.garrison.some((stack) => stack.creatureId === 'archer')).toBe(false);
    expect(store.transferCreatures(hero.id, town.id, 'militia', 5, 'toGarrison').ok).toBe(true);
    expect(hero.army.find((stack) => stack.creatureId === 'militia')?.count).toBe(19);
    expect(town.garrison.find((stack) => stack.creatureId === 'militia')?.count).toBe(17);
  });

  it('does not charge for recruitment when the garrison is full', () => {
    const store = new GameStore({ seed: 'capacity', storage: null });
    const state = mutableState(store);
    const town = state.towns.haven;
    if (!town) throw new Error('Missing test town');
    expect(store.constructBuilding(town.id, 'archeryRange').ok).toBe(true);
    town.garrison = ['militia', 'griffin', 'cavalier', 'sprite', 'ranger', 'unicorn', 'dragon']
      .map((creatureId) => ({ creatureId, count: 1 }));
    const gold = state.players.red?.resources.gold ?? 0;
    const available = town.dwellingPools.archer;
    expect(store.recruitCreature(town.id, 'archer', 1).ok).toBe(false);
    expect(state.players.red?.resources.gold).toBe(gold);
    expect(town.dwellingPools.archer).toBe(available);
  });

  it('pays daily town and mine income and applies weekly dwelling growth', () => {
    const store = new GameStore({ seed: 'calendar-economy', storage: null });
    const state = mutableState(store);
    for (const hero of Object.values(state.heroes)) {
      if (hero.ownerId === 'blue') hero.alive = false;
    }
    const sawmill = state.map.objects['sawmill-west'];
    if (sawmill?.kind === 'mine') sawmill.ownerId = 'red';
    for (let turn = 0; turn < 7; turn += 1) expect(store.endTurn().ok).toBe(true);
    expect(state.calendar).toEqual({ day: 8, week: 2, month: 1, dayOfWeek: 1 });
    expect(state.players.red?.resources.gold).toBe(13000);
    expect(state.players.blue?.resources.gold).toBe(44500);
    expect(state.players.red?.resources.wood).toBe(39);
    expect(state.towns.haven?.dwellingPools.militia).toBe(28);
    expect(state.towns.ember?.dwellingPools.imp).toBe(32);
    expect(state.towns.mire?.dwellingPools.lizardman).toBe(24);
    const dwelling = state.map.objects['dwelling-militia'];
    expect(dwelling?.kind === 'dwelling' && dwelling.available).toBe(28);
    const impDwelling = state.map.objects['dwelling-imps'];
    expect(impDwelling?.kind === 'dwelling' && impDwelling.available).toBe(32);
    const lizardmanDwelling = state.map.objects['dwelling-lizardmen'];
    expect(lizardmanDwelling?.kind === 'dwelling' && lizardmanDwelling.available).toBe(24);
  });
});
