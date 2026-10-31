import { describe, expect, it } from 'vitest';
import { CREATURES, FACTIONS, HEROES } from '../game/content';
import { createInitialGameState } from '../game/scenario';
import { creaturePortrait, factionIcon, heroPortrait, townBanner } from './icons';
import { getCurrentObjective, getHeroCycleTarget } from './format';
import { FACTION_VISUALS, getFactionVisual, ROSTER_COUNTS } from './presentation';

describe('complete faction presentation', () => {
  it('provides a distinct crest, palette, and town banner for every faction', () => {
    expect(ROSTER_COUNTS).toEqual({ factions: 13, units: 52, tiers: 4 });
    expect(Object.keys(FACTION_VISUALS)).toHaveLength(13);
    expect(new Set(Object.values(FACTIONS).map((faction) => factionIcon(faction.name))).size).toBe(13);
    expect(new Set(Object.values(FACTIONS).map((faction) => townBanner(faction.name))).size).toBe(13);

    for (const faction of Object.values(FACTIONS)) {
      const visual = getFactionVisual(faction.name);
      expect(getFactionVisual(faction.id)).toBe(visual);
      expect(factionIcon(faction.name)).toContain(`data-faction="${faction.name}"`);
      expect(townBanner(faction.name)).toContain(visual.primary);
      expect(townBanner(faction.name)).toContain(visual.crest);
    }
  });

  it('renders every unit as a labeled faction and four-tier portrait without duplicate markup', () => {
    const portraits = Object.values(CREATURES).map((creature) => creaturePortrait(creature.id));
    expect(new Set(portraits).size).toBe(52);
    for (const faction of Object.values(FACTIONS)) {
      const portraitsByTier = faction.creatureIds.map((id) => creaturePortrait(id));
      expect(portraitsByTier.map((portrait) => Number(/data-tier="(\d)"/.exec(portrait)?.[1]))).toEqual([1, 2, 3, 4]);
      for (const [index, creatureId] of faction.creatureIds.entries()) {
        const creature = CREATURES[creatureId];
        if (!creature) throw new Error(`Missing creature: ${creatureId}`);
        const portrait = portraitsByTier[index];
        expect(portrait).toContain(`data-creature-id="${creatureId}"`);
        expect(portrait).toContain(`data-faction="${faction.name}"`);
        expect(portrait).toContain(creature.name);
        expect(portrait).toContain(getFactionVisual(faction.name).primary);
      }
    }
  });

  it('gives every faction hero the correct faction portrait and crest', () => {
    for (const hero of Object.values(HEROES)) {
      const portrait = heroPortrait(hero.id, hero.name);
      expect(portrait).toContain(`data-faction="${hero.faction}"`);
      expect(portrait).toContain(getFactionVisual(hero.faction).crest);
    }
  });
});

describe('multi-town objectives and hero cycling', () => {
  it('counts every hostile town instead of naming one fixed enemy', () => {
    const state = createInitialGameState('objective-all-towns');
    const objective = getCurrentObjective(state);
    expect(objective.detail).toContain('11 enemy towns');
    expect(objective.detail).toContain('13 towns');
    expect(objective.detail).toContain('13 faction rosters');
    expect(objective.detail).not.toContain('Lunar Glade');

    const haven = state.towns.haven;
    const hero = state.heroes['hero-aveline'];
    if (!haven || !hero) throw new Error('Missing objective fixtures');
    hero.position = { ...haven.position };
    expect(getCurrentObjective(state).detail).toContain('Haven town');
    expect(getCurrentObjective(state).detail).toContain('four creature tiers');
  });

  it.each([
    { townIds: ['haven', 'grove'], expectedTowns: 2, expectedEnemies: 1 },
    { townIds: ['haven', 'grove', 'ember', 'mire'], expectedTowns: 4, expectedEnemies: 2 },
  ])('keeps objective counts accurate in a $expectedTowns-town campaign', ({ townIds, expectedTowns, expectedEnemies }) => {
    const state = createInitialGameState(`objective-${expectedTowns}-towns`);
    const originalTowns = state.towns;
    state.towns = {};
    for (const id of townIds) {
      const town = originalTowns[id];
      if (!town) throw new Error(`Missing objective town: ${id}`);
      state.towns[id] = town;
    }
    const objective = getCurrentObjective(state);
    expect(objective.detail).toContain(`${expectedEnemies} enemy ${expectedEnemies === 1 ? 'town' : 'towns'}`);
    expect(objective.detail).toContain(`${expectedTowns} towns`);
    expect(objective.detail).toContain(`${expectedTowns} faction rosters`);
  });

  it('cycles and wraps through surviving human heroes, including the Ember hero', () => {
    const state = createInitialGameState('hero-cycle');
    expect(getHeroCycleTarget(state, 1)?.id).toBe('hero-seraphine');
    state.selectedHeroId = 'hero-seraphine';
    expect(getHeroCycleTarget(state, 1)?.id).toBe('hero-aveline');
    state.selectedHeroId = 'hero-aveline';
    expect(getHeroCycleTarget(state, -1)?.id).toBe('hero-seraphine');
    const seraphine = state.heroes['hero-seraphine'];
    if (!seraphine) throw new Error('Missing Ember hero');
    seraphine.alive = false;
    expect(getHeroCycleTarget(state, 1)?.id).toBe('hero-aveline');
    state.selectedHeroId = null;
    expect(getHeroCycleTarget(state, -1)?.id).toBe('hero-aveline');
  });
});
