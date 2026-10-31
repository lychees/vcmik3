import { describe, expect, it } from 'vitest';
import { GameStore } from '../game/GameStore';
import { getBuilding, getCreature, startingResources } from '../game/content';
import { experienceForLevel } from '../game/progression';
import { createInitialGameState } from '../game/scenario';
import type { GameState } from '../game/types';
import {
  escapeHtml,
  formatCalendar,
  formatCost,
  formatNumber,
  getBuildingAvailability,
  getCurrentObjective,
  getDailyIncome,
  getLevelProgress,
  getMissingResources,
  getNewLogEvents,
  getRecruitLimit,
  getTownBuildings,
  getTransferLimit,
  multiplyCost,
} from './format';

function mutableState(store: GameStore): GameState {
  return store.getState() as GameState;
}

describe('UI formatting', () => {
  it('formats calendar, quantities, costs, and escaped content consistently', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatCalendar({ day: 8, dayOfWeek: 1, week: 2, month: 1 })).toBe('Month 1 · Week 2 · Monday');
    expect(formatCost({ gold: 1200, wood: 5 })).toBe('1,200 gold · 5 wood');
    expect(formatCost({})).toBe('No cost');
    expect(multiplyCost(getCreature('archer').cost, 3)).toEqual({ gold: 330 });
    expect(getMissingResources(startingResources(), { gold: 6001, wood: 20, crystal: 10 })).toEqual({ gold: 1, crystal: 2 });
    expect(escapeHtml('<hero title="A&B">')).toBe('&lt;hero title=&quot;A&amp;B&quot;&gt;');
  });

  it('computes level progress within the current level', () => {
    const state = createInitialGameState('progress-ui');
    const hero = state.heroes['hero-aveline'];
    if (!hero) throw new Error('Missing hero');
    expect(getLevelProgress(hero)).toEqual({ current: 0, required: 1000, percent: 0 });
    hero.experience = 500;
    expect(getLevelProgress(hero)).toEqual({ current: 500, required: 1000, percent: 50 });
    hero.level = 2;
    hero.experience = experienceForLevel(2);
    expect(getLevelProgress(hero)).toEqual({ current: 0, required: 2000, percent: 0 });
  });
});

describe('town presentation logic', () => {
  it('aggregates real building income and filters dwellings by town faction', () => {
    const state = createInitialGameState('town-ui');
    const town = state.towns.haven;
    if (!town) throw new Error('Missing town');
    expect(getDailyIncome(town)).toEqual({ gold: 500 });
    town.buildings.push('capitol', 'market');
    expect(getDailyIncome(town)).toEqual({ gold: 1750 });
    const buildingIds = getTownBuildings(town).map((building) => building.id);
    expect(buildingIds).toContain('archeryRange');
    expect(buildingIds).not.toContain('spriteGlade');
    expect(buildingIds).not.toContain('dragonCliffs');
  });

  it('distinguishes locked, ready, unaffordable, built, and daily-limited projects', () => {
    const state = createInitialGameState('build-ui');
    const town = state.towns.haven;
    const player = state.players.red;
    if (!town || !player) throw new Error('Missing fixtures');
    expect(getBuildingAvailability(town, player.resources, getBuilding('archeryRange')).status).toBe('ready');
    const griffin = getBuildingAvailability(town, player.resources, getBuilding('griffinTower'));
    expect(griffin.status).toBe('locked');
    expect(griffin.missingPrerequisites.map((building) => building.id)).toEqual(['archeryRange']);
    player.resources.wood = 0;
    expect(getBuildingAvailability(town, player.resources, getBuilding('archeryRange')).status).toBe('unaffordable');
    player.resources.wood = 25;
    town.builtToday = true;
    expect(getBuildingAvailability(town, player.resources, getBuilding('archeryRange')).status).toBe('wait');
    town.buildings.push('archeryRange');
    expect(getBuildingAvailability(town, player.resources, getBuilding('archeryRange')).status).toBe('built');
  });

  it('limits recruitment by pool, treasury, dwelling, and free garrison stacks', () => {
    const state = createInitialGameState('recruit-ui');
    const town = state.towns.haven;
    const player = state.players.red;
    if (!town || !player) throw new Error('Missing fixtures');
    expect(getRecruitLimit(town, player.resources, 'militia')).toBe(14);
    player.resources.gold = 119;
    expect(getRecruitLimit(town, player.resources, 'militia')).toBe(2);
    expect(getRecruitLimit(town, player.resources, 'archer')).toBe(0);
    player.resources = startingResources();
    town.buildings.push('archeryRange');
    town.dwellingPools.archer = 9;
    town.garrison = [
      { creatureId: 'militia', count: 1 },
      { creatureId: 'griffin', count: 1 },
      { creatureId: 'cavalier', count: 1 },
      { creatureId: 'sprite', count: 1 },
      { creatureId: 'ranger', count: 1 },
      { creatureId: 'unicorn', count: 1 },
      { creatureId: 'dragon', count: 1 },
    ];
    expect(getRecruitLimit(town, player.resources, 'archer')).toBe(0);
    expect(getRecruitLimit(town, player.resources, 'militia')).toBeGreaterThan(0);
  });

  it('prevents UI transfers into a full army unless the creature stack already exists', () => {
    const source = [{ creatureId: 'archer', count: 12 }];
    const fullTarget = [
      { creatureId: 'militia', count: 1 },
      { creatureId: 'griffin', count: 1 },
      { creatureId: 'cavalier', count: 1 },
      { creatureId: 'sprite', count: 1 },
      { creatureId: 'ranger', count: 1 },
      { creatureId: 'unicorn', count: 1 },
      { creatureId: 'dragon', count: 1 },
    ];
    expect(getTransferLimit(source, fullTarget, 'archer')).toBe(0);
    fullTarget[0] = { creatureId: 'archer', count: 2 };
    expect(getTransferLimit(source, fullTarget, 'archer')).toBe(12);
  });
});

describe('objective and real-store UI flows', () => {
  it('describes exploration, friendly town entry, weariness, and combat', () => {
    const store = new GameStore({ seed: 'objective-ui', storage: null });
    const state = mutableState(store);
    expect(getCurrentObjective(state).title).toBe('Explore Aster Vale');
    const hero = state.heroes['hero-aveline'];
    const town = state.towns.haven;
    if (!hero || !town) throw new Error('Missing fixtures');
    hero.position = { ...town.position };
    expect(getCurrentObjective(state).title).toBe(`Welcome to ${town.name}`);
    hero.position = { x: 0, y: 0 };
    hero.movementPoints = 0;
    expect(getCurrentObjective(state).title).toBe('The company is weary');
    const monster = state.map.objects['monster-west'];
    if (!monster) throw new Error('Missing monster');
    hero.position = { ...monster.position };
    expect(store.initiateBattle(hero.id, monster.id).ok).toBe(true);
    expect(getCurrentObjective(state).tone).toBe('danger');
    expect(getCurrentObjective(state).title).toContain('Battle:');
  });

  it('uses real store results for construction, recruitment, transfers, turns, and saves', () => {
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, value),
    };
    const store = new GameStore({ seed: 'full-ui-flow', storage });
    const state = mutableState(store);
    const hero = state.heroes['hero-aveline'];
    const town = state.towns.haven;
    if (!hero || !town) throw new Error('Missing fixtures');
    expect(store.constructBuilding(town.id, 'archeryRange').ok).toBe(true);
    expect(town.dwellingPools.archer).toBe(getCreature('archer').growth);
    expect(getBuildingAvailability(town, state.players.red!.resources, getBuilding('archeryRange')).status).toBe('built');
    expect(store.constructBuilding(town.id, 'market').ok).toBe(false);

    const recruited = store.recruitCreature(town.id, 'archer', 3);
    expect(recruited.ok).toBe(true);
    expect(town.garrison.find((stack) => stack.creatureId === 'archer')?.count).toBe(3);
    hero.position = { ...town.position };
    expect(store.transferCreatures(hero.id, town.id, 'archer', 2, 'toHero').ok).toBe(true);
    expect(hero.army.find((stack) => stack.creatureId === 'archer')?.count).toBe(14);
    expect(town.garrison.find((stack) => stack.creatureId === 'archer')?.count).toBe(1);
    expect(store.transferCreatures(hero.id, town.id, 'militia', 5, 'toGarrison').ok).toBe(true);

    expect(store.saveGame('slot-1').ok).toBe(true);
    expect(store.hasSavedGame('slot-1')).toBe(true);
    expect(store.endTurn().ok).toBe(true);
    expect(town.builtToday).toBe(false);
    expect(hero.movementPoints).toBe(hero.maxMovementPoints);
    expect(store.loadGame('slot-1').ok).toBe(true);
    expect(store.getState().calendar.day).toBe(1);
    expect(store.getTown(town.id)?.garrison).toEqual([
      { creatureId: 'militia', count: 17 },
      { creatureId: 'archer', count: 1 },
    ]);
  });
});

describe('store log event tracking', () => {
  it('keeps finding new events after the 100-entry cap trims old entries', () => {
    const previous = Array.from({ length: 100 }, (_, index) => ({
      day: Math.floor(index / 7) + 1,
      kind: 'day',
      message: `Day ${index + 1} begins.`,
    }));
    expect(getNewLogEvents(previous.slice(0, 99), previous)).toEqual([previous[99]]);
    const week = { day: 8, kind: 'week', message: 'Week 2 brings new creature growth.' };
    const capped = [...previous.slice(1), week];
    expect(capped).toHaveLength(100);
    expect(getNewLogEvents(previous, capped)).toEqual([week]);
    expect(getNewLogEvents(capped, capped)).toEqual([]);
    const battle = { day: 8, kind: 'battle', message: "Aveline's battle ends: attacker." };
    const cappedAgain = [...capped.slice(1), battle];
    expect(getNewLogEvents(capped, cappedAgain)).toEqual([battle]);
  });

  it('uses event identity for duplicate text and starts cleanly from reset snapshots', () => {
    const previous = Array.from({ length: 100 }, () => ({
      day: 8,
      kind: 'week',
      message: 'Week 2 brings new creature growth.',
    }));
    const fresh = { day: 8, kind: 'week', message: 'Week 2 brings new creature growth.' };
    const result = getNewLogEvents(previous, [...previous.slice(1), fresh]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(fresh);

    const loadedHistory = [{ day: 7, kind: 'week', message: 'Historic loaded growth.' }];
    const resetSnapshot = [...loadedHistory];
    expect(getNewLogEvents(resetSnapshot, loadedHistory)).toEqual([]);
    const newEvent = { day: 8, kind: 'week', message: 'New post-load growth.' };
    expect(getNewLogEvents(resetSnapshot, [...loadedHistory, newEvent])).toEqual([newEvent]);
  });
});
