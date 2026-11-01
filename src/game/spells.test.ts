import { describe, expect, it } from 'vitest';
import { SPELLS } from './content';
import {
  EXPANDED_SPELL_LIST,
  EXPANDED_SPELLS,
  getExpandedSpell,
  isExpandedSpellId,
} from './spells';
import type { ExpandedSpellId } from './spells';
import type { SpellSchool } from './types';

const ORIGINAL_SPELL_IDS = [
  'magicArrow', 'stoneSkin', 'haste', 'slow', 'cure', 'fireball', 'bless',
] as const;

const EXPECTED_METADATA = {
  stormRelay: {
    name: 'Storm Relay', school: 'air', level: 4, manaCost: 15, target: 'enemy',
    effect: { kind: 'chainDamage', baseDamage: 30, powerDamage: 9, maxTargets: 4, falloff: 0.7 },
  },
  tailwind: {
    name: 'Tailwind', school: 'air', level: 2, manaCost: 10, target: 'allAllies',
    effect: { kind: 'status', modifiers: { speed: 2 }, duration: 3 },
  },
  staticDisruption: {
    name: 'Static Disruption', school: 'air', level: 2, manaCost: 7, target: 'enemyHero',
    effect: { kind: 'manaBurn', baseAmount: 6, powerAmount: 2 },
  },
  graniteAegis: {
    name: 'Granite Aegis', school: 'earth', level: 2, manaCost: 10, target: 'ally',
    effect: { kind: 'status', modifiers: { defense: 5, damageReduction: 0.15 }, duration: 3 },
  },
  quakePulse: {
    name: 'Quake Pulse', school: 'earth', level: 4, manaCost: 16, target: 'all',
    effect: { kind: 'massDamage', baseDamage: 20, powerDamage: 6 },
  },
  mireHex: {
    name: 'Mire Hex', school: 'earth', level: 3, manaCost: 12, target: 'allEnemies',
    effect: { kind: 'status', modifiers: { attack: -3, speed: -1 }, duration: 3 },
  },
  emberVolley: {
    name: 'Ember Volley', school: 'fire', level: 3, manaCost: 12, target: 'allEnemies',
    effect: { kind: 'massDamage', baseDamage: 18, powerDamage: 6 },
  },
  battleFervor: {
    name: 'Battle Fervor', school: 'fire', level: 2, manaCost: 11, target: 'allAllies',
    effect: { kind: 'status', modifiers: { attack: 3 }, duration: 3 },
  },
  manaSiphon: {
    name: 'Mana Siphon', school: 'fire', level: 3, manaCost: 9, target: 'enemyHero',
    effect: { kind: 'manaDrain', baseAmount: 8, powerAmount: 2 },
  },
  spiritChannel: {
    name: 'Spirit Channel', school: 'water', level: 1, manaCost: 5, target: 'caster',
    effect: { kind: 'manaRestore', baseAmount: 8, powerAmount: 2 },
  },
  fountainOfLife: {
    name: 'Fountain of Life', school: 'water', level: 4, manaCost: 14, target: 'ally',
    effect: { kind: 'restoration', baseAmount: 40, powerAmount: 10, canRevive: true },
  },
  tidalRenewal: {
    name: 'Tidal Renewal', school: 'water', level: 3, manaCost: 13, target: 'allAllies',
    effect: { kind: 'restoration', baseAmount: 16, powerAmount: 5, canRevive: false },
  },
} as const satisfies Record<ExpandedSpellId, object>;

describe('expanded spell registry', () => {
  it('adds exactly twelve uniquely named spells without replacing the original seven IDs', () => {
    expect(EXPANDED_SPELL_LIST).toHaveLength(12);
    expect(Object.keys(EXPANDED_SPELLS)).toHaveLength(12);
    expect(new Set(EXPANDED_SPELL_LIST.map((spell) => spell.id)).size).toBe(12);
    expect(new Set(EXPANDED_SPELL_LIST.map((spell) => spell.name)).size).toBe(12);
    expect(Object.keys(SPELLS).sort()).toEqual([...ORIGINAL_SPELL_IDS].sort());
    expect(EXPANDED_SPELL_LIST.some((spell) => Object.hasOwn(SPELLS, spell.id))).toBe(false);
    expect(Object.keys(EXPECTED_METADATA).sort()).toEqual(Object.keys(EXPANDED_SPELLS).sort());
  });

  it('provides three spells in each school and spans levels one through four', () => {
    const schools: readonly SpellSchool[] = ['air', 'earth', 'fire', 'water'];
    for (const school of schools) {
      expect(EXPANDED_SPELL_LIST.filter((spell) => spell.school === school)).toHaveLength(3);
    }
    expect(new Set(EXPANDED_SPELL_LIST.map((spell) => spell.level))).toEqual(new Set([1, 2, 3, 4]));
  });

  it('preserves the complete original balance metadata for every new spell', () => {
    for (const spell of EXPANDED_SPELL_LIST) {
      const expected = EXPECTED_METADATA[spell.id];
      expect(spell.name).toBe(expected.name);
      expect(spell.school).toBe(expected.school);
      expect(spell.level).toBe(expected.level);
      expect(spell.manaCost).toBe(expected.manaCost);
      expect(spell.target).toBe(expected.target);
      expect(spell.effect).toEqual(expected.effect);
      expect(spell.description.length).toBeGreaterThan(30);
      expect(spell.oncePerRound).toBe(true);
      expect(Number.isInteger(spell.level) && spell.level >= 1 && spell.level <= 5).toBe(true);
      expect(Number.isInteger(spell.manaCost) && spell.manaCost > 0).toBe(true);
    }
  });

  it('covers every declared effect and target category with bounded numerical metadata', () => {
    expect(new Set(EXPANDED_SPELL_LIST.map((spell) => spell.effect.kind))).toEqual(new Set([
      'chainDamage', 'massDamage', 'status', 'manaBurn', 'manaDrain', 'manaRestore', 'restoration',
    ]));
    expect(new Set(EXPANDED_SPELL_LIST.map((spell) => spell.target))).toEqual(new Set([
      'ally', 'enemy', 'all', 'allAllies', 'allEnemies', 'caster', 'enemyHero',
    ]));

    for (const spell of EXPANDED_SPELL_LIST) {
      const effect = spell.effect;
      if (effect.kind === 'chainDamage') {
        expect(effect.baseDamage).toBeGreaterThan(0);
        expect(effect.powerDamage).toBeGreaterThan(0);
        expect(Number.isInteger(effect.maxTargets) && effect.maxTargets >= 2).toBe(true);
        expect(effect.falloff).toBeGreaterThan(0);
        expect(effect.falloff).toBeLessThanOrEqual(1);
      } else if (effect.kind === 'massDamage') {
        expect(effect.baseDamage).toBeGreaterThan(0);
        expect(effect.powerDamage).toBeGreaterThan(0);
      } else if (effect.kind === 'status') {
        expect(Number.isInteger(effect.duration) && effect.duration > 0).toBe(true);
        expect(Object.keys(effect.modifiers).length).toBeGreaterThan(0);
        for (const value of Object.values(effect.modifiers)) expect(value).not.toBe(0);
        if (effect.modifiers.damageReduction !== undefined) {
          expect(effect.modifiers.damageReduction).toBeGreaterThan(0);
          expect(effect.modifiers.damageReduction).toBeLessThan(1);
        }
      } else {
        expect(effect.baseAmount).toBeGreaterThan(0);
        expect(effect.powerAmount).toBeGreaterThan(0);
      }
    }
  });

  it('resolves only own expanded IDs and rejects unknown or inherited keys', () => {
    for (const spell of EXPANDED_SPELL_LIST) {
      expect(isExpandedSpellId(spell.id)).toBe(true);
      expect(getExpandedSpell(spell.id)).toBe(EXPANDED_SPELLS[spell.id]);
    }
    for (const id of ['magicArrow', 'unknown', '__proto__', 'toString', '']) {
      expect(isExpandedSpellId(id)).toBe(false);
      expect(() => getExpandedSpell(id)).toThrow(`Unknown expanded spell: ${id}`);
    }
  });
});
