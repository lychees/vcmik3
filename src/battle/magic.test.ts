import { describe, expect, it } from 'vitest';
import { EXPANDED_SPELL_LIST, EXPANDED_SPELLS } from '../game/spells';
import type { ExpandedSpellId } from '../game/spells';
import { createExpandedSpellPlan, getExpandedSpellTargets } from './magic';
import type { ExpandedSpellCastContext } from './magic';
import type { BattleHeroState, BattleSideId, BattleStackState } from './types';

const SPELLBOOK = EXPANDED_SPELL_LIST.map((spell) => spell.id);

function makeStack(
  id: string,
  side: BattleSideId,
  overrides: Partial<BattleStackState> = {},
): BattleStackState {
  return {
    id,
    side,
    creatureId: 'militia',
    initialCount: 5,
    count: 5,
    topHealth: 8,
    position: { x: 1, y: 5 },
    shots: 0,
    defending: false,
    waited: false,
    retaliationsUsed: 0,
    statuses: {},
    ...overrides,
  };
}

function makeHero(overrides: Partial<BattleHeroState> = {}): BattleHeroState {
  return {
    heroId: 'hero-test',
    primarySkills: { attack: 0, defense: 0, spellPower: 2, knowledge: 4 },
    mana: 30,
    maxMana: 40,
    spells: [...SPELLBOOK],
    castThisRound: false,
    ...overrides,
  };
}

function defaultStacks(): BattleStackState[] {
  return [
    makeStack('a0', 'attacker', { position: { x: 1, y: 5 } }),
    makeStack('a1', 'attacker', { count: 3, topHealth: 4, position: { x: 1, y: 2 } }),
    makeStack('d0', 'defender', { position: { x: 8, y: 5 } }),
    makeStack('d1', 'defender', { position: { x: 10, y: 5 } }),
  ];
}

function makeContext(overrides: Partial<ExpandedSpellCastContext> = {}): ExpandedSpellCastContext {
  return {
    casterSide: 'attacker',
    stacks: defaultStacks(),
    heroes: {
      attacker: makeHero(),
      defender: makeHero({ mana: 20, maxMana: 30 }),
    },
    ...overrides,
  };
}

function selectedTarget(spellId: ExpandedSpellId): string | undefined {
  if (spellId === 'stormRelay') return 'd0';
  if (spellId === 'graniteAegis') return 'a0';
  if (spellId === 'fountainOfLife') return 'a1';
  return undefined;
}

function plan(spellId: string, overrides: Partial<ExpandedSpellCastContext> = {}) {
  return createExpandedSpellPlan(spellId, makeContext(overrides));
}

describe('expanded spell targeting', () => {
  it('lists living allies, enemies, both sides, and wounded allies according to each target rule', () => {
    const context = makeContext();
    const before = structuredClone(context);
    const expected: Partial<Record<ExpandedSpellId, string[]>> = {
      stormRelay: ['d0', 'd1'],
      graniteAegis: ['a0', 'a1'],
      tailwind: ['a0', 'a1'],
      battleFervor: ['a0', 'a1'],
      emberVolley: ['d0', 'd1'],
      mireHex: ['d0', 'd1'],
      quakePulse: ['a0', 'a1', 'd0', 'd1'],
      fountainOfLife: ['a1'],
      tidalRenewal: ['a1'],
      staticDisruption: [],
      manaSiphon: [],
      spiritChannel: [],
    };

    for (const spell of EXPANDED_SPELL_LIST) {
      expect(getExpandedSpellTargets(spell.id, context)).toEqual(expected[spell.id]);
    }
    expect(context).toEqual(before);
  });

  it('excludes dead stacks except explicitly revivable allies for Fountain of Life', () => {
    const fallenAlly = makeStack('a2', 'attacker', { count: 0, topHealth: 0 });
    const fallenEnemy = makeStack('d2', 'defender', { count: 0, topHealth: 0 });
    const context = makeContext({ stacks: [...defaultStacks(), fallenAlly, fallenEnemy] });

    expect(getExpandedSpellTargets('stormRelay', context)).toEqual(['d0', 'd1']);
    expect(getExpandedSpellTargets('graniteAegis', context)).toEqual(['a0', 'a1']);
    expect(getExpandedSpellTargets('fountainOfLife', context)).toEqual(['a1']);
    expect(getExpandedSpellTargets('fountainOfLife', {
      ...context,
      revivableStackIds: ['a2', 'd2'],
    })).toEqual(['a1', 'a2']);
    expect(getExpandedSpellTargets('tidalRenewal', {
      ...context,
      revivableStackIds: ['a2'],
    })).toEqual(['a1']);
  });

  it('rejects missing, unknown, wrong-side, full-health, and non-revivable selected targets', () => {
    const fallen = makeStack('a2', 'attacker', { count: 0, topHealth: 0 });
    const stacks = [...defaultStacks(), fallen];
    const cases: Array<[ExpandedSpellId, string | undefined]> = [
      ['stormRelay', undefined],
      ['stormRelay', 'missing'],
      ['stormRelay', 'a0'],
      ['stormRelay', 'a2'],
      ['graniteAegis', undefined],
      ['graniteAegis', 'd0'],
      ['graniteAegis', 'a2'],
      ['fountainOfLife', undefined],
      ['fountainOfLife', 'a0'],
      ['fountainOfLife', 'd0'],
      ['fountainOfLife', 'a2'],
    ];
    for (const [spellId, targetId] of cases) {
      expect(() => plan(spellId, { stacks, targetId })).toThrow();
    }
    expect(() => plan('fountainOfLife', {
      stacks,
      targetId: 'a2',
      revivableStackIds: ['a2'],
    })).not.toThrow();
  });

  it('rejects a selected stack for every mass, hero, or caster spell', () => {
    const automaticSpells = EXPANDED_SPELL_LIST.filter((spell) =>
      spell.target !== 'ally' && spell.target !== 'enemy');
    expect(automaticSpells).toHaveLength(9);
    for (const spell of automaticSpells) {
      expect(() => plan(spell.id, { targetId: 'a0' })).toThrow('does not use a selected stack');
    }
  });

  it('rejects mass and restoration casts when their valid target set is empty', () => {
    const alliesOnly = defaultStacks().filter((stack) => stack.side === 'attacker');
    const enemiesOnly = defaultStacks().filter((stack) => stack.side === 'defender');
    const fullHealthAllies = alliesOnly.map((stack) => makeStack(stack.id, stack.side));
    expect(() => plan('tailwind', { stacks: enemiesOnly })).toThrow('No valid targets');
    expect(() => plan('emberVolley', { stacks: alliesOnly })).toThrow('No valid targets');
    expect(() => plan('quakePulse', { stacks: [] })).toThrow('No valid targets');
    expect(() => plan('tidalRenewal', { stacks: fullHealthAllies })).toThrow('No valid targets');
  });
});

describe('expanded spell casting validation and purity', () => {
  it('plans all twelve spells with their casting cost and one-cast marker without mutating input', () => {
    for (const spell of EXPANDED_SPELL_LIST) {
      const context = makeContext({ targetId: selectedTarget(spell.id) });
      const before = structuredClone(context);
      const first = createExpandedSpellPlan(spell.id, context);
      const second = createExpandedSpellPlan(spell.id, context);
      expect(first).toEqual(second);
      expect(first).not.toBe(second);
      expect(first.operations).not.toBe(second.operations);
      expect(first.spellId).toBe(spell.id);
      expect(first.casterSide).toBe('attacker');
      expect(first.manaCost).toBe(spell.manaCost);
      expect(first.consumeCast).toBe(true);
      expect(first.operations.length).toBeGreaterThan(0);
      expect(context).toEqual(before);
      for (const operation of first.operations) {
        if (operation.kind !== 'status') {
          expect(Number.isFinite(operation.amount)).toBe(true);
          expect(operation.amount).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('rejects unknown spells, missing casters, and spells outside the caster spellbook', () => {
    expect(() => plan('magicArrow')).toThrow('Unknown expanded spell: magicArrow');
    expect(() => plan('stormRelay', {
      heroes: { defender: makeHero() },
      targetId: 'd0',
    })).toThrow('The casting side has no hero');
    expect(() => plan('tailwind', {
      heroes: { attacker: makeHero({ spells: ['stormRelay'] }), defender: makeHero() },
    })).toThrow('The caster does not know Tailwind');
  });

  it('enforces the existing mana and once-per-round casting constraints', () => {
    expect(() => plan('stormRelay', {
      heroes: { attacker: makeHero({ castThisRound: true }), defender: makeHero() },
      targetId: 'd0',
    })).toThrow('already cast a spell this round');
    expect(() => plan('quakePulse', {
      heroes: { attacker: makeHero({ mana: EXPANDED_SPELLS.quakePulse.manaCost - 1 }), defender: makeHero() },
    })).toThrow('Not enough mana');
    expect(() => plan('staticDisruption', {
      heroes: {
        attacker: makeHero({ mana: EXPANDED_SPELLS.staticDisruption.manaCost }),
        defender: makeHero(),
      },
    })).not.toThrow();
  });

  it('rejects invalid Spell Power instead of producing fractional or negative amounts', () => {
    for (const spellPower of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => plan('stormRelay', {
        heroes: {
          attacker: makeHero({ primarySkills: { attack: 0, defense: 0, spellPower, knowledge: 4 } }),
          defender: makeHero(),
        },
        targetId: 'd0',
      })).toThrow('Spell Power must be a non-negative integer');
    }
  });
});

describe('damage effect plans', () => {
  it('chains through the four nearest unhit enemies with compounded 70% damage falloff', () => {
    const stacks = [
      makeStack('a0', 'attacker', { position: { x: 4, y: 5 } }),
      makeStack('d0', 'defender', { position: { x: 5, y: 5 } }),
      makeStack('d1', 'defender', { position: { x: 8, y: 5 } }),
      makeStack('d2', 'defender', { position: { x: 6, y: 5 } }),
      makeStack('d3', 'defender', { position: { x: 12, y: 5 } }),
      makeStack('d4', 'defender', { position: { x: 14, y: 5 } }),
    ];
    const result = plan('stormRelay', { stacks, targetId: 'd0' });
    expect(result.targetIds).toEqual(['d0', 'd2', 'd1', 'd3']);
    expect(result.operations).toEqual([
      { kind: 'damage', targetId: 'd0', amount: 48 },
      { kind: 'damage', targetId: 'd2', amount: 33 },
      { kind: 'damage', targetId: 'd1', amount: 23 },
      { kind: 'damage', targetId: 'd3', amount: 16 },
    ]);
  });

  it('breaks chain-distance ties by stack ID and stops when no unhit enemies remain', () => {
    const tiedStacks = [
      makeStack('a0', 'attacker'),
      makeStack('d0', 'defender', { position: { x: 5, y: 5 } }),
      makeStack('z', 'defender', { position: { x: 7, y: 5 } }),
      makeStack('a', 'defender', { position: { x: 5, y: 3 } }),
    ];
    expect(plan('stormRelay', { stacks: tiedStacks, targetId: 'd0' }).targetIds).toEqual(['d0', 'a', 'z']);
    expect(plan('stormRelay', {
      stacks: [makeStack('a0', 'attacker'), makeStack('d0', 'defender')],
      targetId: 'd0',
    }).operations).toEqual([{ kind: 'damage', targetId: 'd0', amount: 48 }]);
  });

  it('plans Ember Volley against enemies only and Quake Pulse against both sides', () => {
    expect(plan('emberVolley')).toMatchObject({
      targetIds: ['d0', 'd1'],
      operations: [
        { kind: 'damage', targetId: 'd0', amount: 30 },
        { kind: 'damage', targetId: 'd1', amount: 30 },
      ],
    });
    expect(plan('quakePulse')).toMatchObject({
      targetIds: ['a0', 'a1', 'd0', 'd1'],
      operations: [
        { kind: 'damage', targetId: 'a0', amount: 32 },
        { kind: 'damage', targetId: 'a1', amount: 32 },
        { kind: 'damage', targetId: 'd0', amount: 32 },
        { kind: 'damage', targetId: 'd1', amount: 32 },
      ],
    });
  });
});

describe('status effect plans', () => {
  it('emits every mass buff, mass debuff, and defensive modifier with a three-round duration', () => {
    const cases = [
      { id: 'tailwind', targetId: undefined, targets: ['a0', 'a1'], modifiers: { speed: 2 } },
      { id: 'battleFervor', targetId: undefined, targets: ['a0', 'a1'], modifiers: { attack: 3 } },
      { id: 'mireHex', targetId: undefined, targets: ['d0', 'd1'], modifiers: { attack: -3, speed: -1 } },
      { id: 'graniteAegis', targetId: 'a0', targets: ['a0'], modifiers: { defense: 5, damageReduction: 0.15 } },
    ] as const;

    for (const testCase of cases) {
      const result = plan(testCase.id, { targetId: testCase.targetId });
      expect(result.targetIds).toEqual(testCase.targets);
      expect(result.operations).toEqual(testCase.targets.map((targetId) => ({
        kind: 'status',
        targetId,
        statusId: testCase.id,
        duration: 3,
        modifiers: testCase.modifiers,
      })));
      const modifiers = result.operations.map((operation) =>
        operation.kind === 'status' ? operation.modifiers : undefined);
      if (modifiers.length > 1) expect(modifiers[0]).not.toBe(modifiers[1]);
    }
  });
});

describe('restoration effect plans', () => {
  it('caps Fountain of Life at missing health and restores a revivable fallen ally', () => {
    expect(plan('fountainOfLife', { targetId: 'a1' }).operations).toEqual([
      { kind: 'heal', targetId: 'a1', amount: 20, canRevive: true },
    ]);
    const fallen = makeStack('a2', 'attacker', { count: 0, topHealth: 0 });
    expect(plan('fountainOfLife', {
      stacks: [...defaultStacks(), fallen],
      targetId: 'a2',
      revivableStackIds: ['a2'],
    }).operations).toEqual([
      { kind: 'heal', targetId: 'a2', amount: 40, canRevive: true },
    ]);
  });

  it('heals each wounded living ally independently and never mass-revives', () => {
    const secondWounded = makeStack('a2', 'attacker', { count: 4, topHealth: 2 });
    const fallen = makeStack('a3', 'attacker', { count: 0, topHealth: 0 });
    const result = plan('tidalRenewal', {
      stacks: [...defaultStacks(), secondWounded, fallen],
      revivableStackIds: ['a3'],
    });
    expect(result.targetIds).toEqual(['a1', 'a2']);
    expect(result.operations).toEqual([
      { kind: 'heal', targetId: 'a1', amount: 20, canRevive: false },
      { kind: 'heal', targetId: 'a2', amount: 14, canRevive: false },
    ]);
  });
});

describe('mana effect plans', () => {
  it('burns only available enemy mana with Static Disruption', () => {
    expect(plan('staticDisruption', {
      heroes: { attacker: makeHero(), defender: makeHero({ mana: 8 }) },
    })).toMatchObject({
      targetIds: [],
      operations: [{ kind: 'manaBurn', side: 'defender', amount: 8 }],
    });
    expect(plan('staticDisruption').operations).toEqual([
      { kind: 'manaBurn', side: 'defender', amount: 10 },
    ]);
  });

  it('drains and restores the same available mana with Mana Siphon, capped by post-cast capacity', () => {
    expect(plan('manaSiphon', {
      heroes: {
        attacker: makeHero({ mana: 20, maxMana: 40 }),
        defender: makeHero({ mana: 10 }),
      },
    }).operations).toEqual([
      { kind: 'manaDrain', side: 'defender', amount: 10 },
      { kind: 'manaRestore', side: 'attacker', amount: 10 },
    ]);
    expect(plan('manaSiphon', {
      heroes: {
        attacker: makeHero({ mana: 39, maxMana: 40 }),
        defender: makeHero({ mana: 20 }),
      },
    }).operations).toEqual([
      { kind: 'manaDrain', side: 'defender', amount: 12 },
      { kind: 'manaRestore', side: 'attacker', amount: 10 },
    ]);
  });

  it('restores Spirit Channel mana after its cost without exceeding maximum mana', () => {
    expect(plan('spiritChannel', {
      heroes: { attacker: makeHero({ mana: 20, maxMana: 40 }), defender: makeHero() },
    }).operations).toEqual([{ kind: 'manaRestore', side: 'attacker', amount: 12 }]);
    expect(plan('spiritChannel', {
      heroes: { attacker: makeHero({ mana: 38, maxMana: 40 }), defender: makeHero() },
    }).operations).toEqual([{ kind: 'manaRestore', side: 'attacker', amount: 7 }]);
    expect(() => plan('spiritChannel', {
      heroes: { attacker: makeHero({ mana: 40, maxMana: 40 }), defender: makeHero() },
    })).toThrow('The caster already has full mana');
  });

  it('requires an enemy hero with mana for both enemy-hero spells', () => {
    for (const spellId of ['staticDisruption', 'manaSiphon'] as const) {
      expect(() => plan(spellId, { heroes: { attacker: makeHero() } })).toThrow('The enemy side has no hero');
      expect(() => plan(spellId, {
        heroes: { attacker: makeHero(), defender: makeHero({ mana: 0 }) },
      })).toThrow('The enemy hero has no mana to affect');
    }
  });
});
