import type { SpellSchool } from './types';

export type ExpandedSpellId =
  | 'stormRelay'
  | 'tailwind'
  | 'staticDisruption'
  | 'graniteAegis'
  | 'quakePulse'
  | 'mireHex'
  | 'emberVolley'
  | 'battleFervor'
  | 'manaSiphon'
  | 'spiritChannel'
  | 'fountainOfLife'
  | 'tidalRenewal';

export type ExpandedSpellTarget =
  | 'ally'
  | 'enemy'
  | 'all'
  | 'allAllies'
  | 'allEnemies'
  | 'caster'
  | 'enemyHero';

export interface ExpandedStackModifiers {
  readonly attack?: number;
  readonly defense?: number;
  readonly speed?: number;
  readonly damageReduction?: number;
}

export type ExpandedSpellEffect =
  | {
      readonly kind: 'chainDamage';
      readonly baseDamage: number;
      readonly powerDamage: number;
      readonly maxTargets: number;
      readonly falloff: number;
    }
  | {
      readonly kind: 'massDamage';
      readonly baseDamage: number;
      readonly powerDamage: number;
    }
  | {
      readonly kind: 'status';
      readonly modifiers: ExpandedStackModifiers;
      readonly duration: number;
    }
  | {
      readonly kind: 'manaBurn';
      readonly baseAmount: number;
      readonly powerAmount: number;
    }
  | {
      readonly kind: 'manaDrain';
      readonly baseAmount: number;
      readonly powerAmount: number;
    }
  | {
      readonly kind: 'manaRestore';
      readonly baseAmount: number;
      readonly powerAmount: number;
    }
  | {
      readonly kind: 'restoration';
      readonly baseAmount: number;
      readonly powerAmount: number;
      readonly canRevive: boolean;
    };

export interface ExpandedSpellDefinition {
  readonly id: ExpandedSpellId;
  readonly name: string;
  readonly description: string;
  readonly school: SpellSchool;
  readonly level: number;
  readonly manaCost: number;
  readonly target: ExpandedSpellTarget;
  readonly oncePerRound: true;
  readonly effect: ExpandedSpellEffect;
}

export const EXPANDED_SPELLS = {
  stormRelay: {
    id: 'stormRelay',
    name: 'Storm Relay',
    description: 'Deals 30 + 9 × Spell Power damage to an enemy, then chains to the nearest unhit enemies. Damage is multiplied by 0.7 per jump and rounded down; up to four stacks are hit.',
    school: 'air',
    level: 4,
    manaCost: 15,
    target: 'enemy',
    oncePerRound: true,
    effect: { kind: 'chainDamage', baseDamage: 30, powerDamage: 9, maxTargets: 4, falloff: 0.7 },
  },
  tailwind: {
    id: 'tailwind',
    name: 'Tailwind',
    description: 'Grants every living allied stack +2 Speed for three rounds.',
    school: 'air',
    level: 2,
    manaCost: 10,
    target: 'allAllies',
    oncePerRound: true,
    effect: { kind: 'status', modifiers: { speed: 2 }, duration: 3 },
  },
  staticDisruption: {
    id: 'staticDisruption',
    name: 'Static Disruption',
    description: 'Removes up to 6 + 2 × Spell Power mana from the enemy hero.',
    school: 'air',
    level: 2,
    manaCost: 7,
    target: 'enemyHero',
    oncePerRound: true,
    effect: { kind: 'manaBurn', baseAmount: 6, powerAmount: 2 },
  },
  graniteAegis: {
    id: 'graniteAegis',
    name: 'Granite Aegis',
    description: 'Grants an allied stack +5 Defense and 15% incoming damage reduction for three rounds.',
    school: 'earth',
    level: 2,
    manaCost: 10,
    target: 'ally',
    oncePerRound: true,
    effect: { kind: 'status', modifiers: { defense: 5, damageReduction: 0.15 }, duration: 3 },
  },
  quakePulse: {
    id: 'quakePulse',
    name: 'Quake Pulse',
    description: 'Deals 20 + 6 × Spell Power damage to every living stack on both sides.',
    school: 'earth',
    level: 4,
    manaCost: 16,
    target: 'all',
    oncePerRound: true,
    effect: { kind: 'massDamage', baseDamage: 20, powerDamage: 6 },
  },
  mireHex: {
    id: 'mireHex',
    name: 'Mire Hex',
    description: 'Gives every living enemy stack −3 Attack and −1 Speed for three rounds.',
    school: 'earth',
    level: 3,
    manaCost: 12,
    target: 'allEnemies',
    oncePerRound: true,
    effect: { kind: 'status', modifiers: { attack: -3, speed: -1 }, duration: 3 },
  },
  emberVolley: {
    id: 'emberVolley',
    name: 'Ember Volley',
    description: 'Deals 18 + 6 × Spell Power damage to every living enemy stack.',
    school: 'fire',
    level: 3,
    manaCost: 12,
    target: 'allEnemies',
    oncePerRound: true,
    effect: { kind: 'massDamage', baseDamage: 18, powerDamage: 6 },
  },
  battleFervor: {
    id: 'battleFervor',
    name: 'Battle Fervor',
    description: 'Grants every living allied stack +3 Attack for three rounds.',
    school: 'fire',
    level: 2,
    manaCost: 11,
    target: 'allAllies',
    oncePerRound: true,
    effect: { kind: 'status', modifiers: { attack: 3 }, duration: 3 },
  },
  manaSiphon: {
    id: 'manaSiphon',
    name: 'Mana Siphon',
    description: 'Drains up to 8 + 2 × Spell Power mana from the enemy hero and restores as much of it to the caster as their post-cast mana capacity allows.',
    school: 'fire',
    level: 3,
    manaCost: 9,
    target: 'enemyHero',
    oncePerRound: true,
    effect: { kind: 'manaDrain', baseAmount: 8, powerAmount: 2 },
  },
  spiritChannel: {
    id: 'spiritChannel',
    name: 'Spirit Channel',
    description: 'Restores up to 8 + 2 × Spell Power mana to the caster after paying the casting cost.',
    school: 'water',
    level: 1,
    manaCost: 5,
    target: 'caster',
    oncePerRound: true,
    effect: { kind: 'manaRestore', baseAmount: 8, powerAmount: 2 },
  },
  fountainOfLife: {
    id: 'fountainOfLife',
    name: 'Fountain of Life',
    description: 'Restores up to 40 + 10 × Spell Power health to a wounded ally, or to a fallen ally whose hex is available for revival.',
    school: 'water',
    level: 4,
    manaCost: 14,
    target: 'ally',
    oncePerRound: true,
    effect: { kind: 'restoration', baseAmount: 40, powerAmount: 10, canRevive: true },
  },
  tidalRenewal: {
    id: 'tidalRenewal',
    name: 'Tidal Renewal',
    description: 'Restores up to 16 + 5 × Spell Power health to every wounded living allied stack; it does not revive fallen stacks.',
    school: 'water',
    level: 3,
    manaCost: 13,
    target: 'allAllies',
    oncePerRound: true,
    effect: { kind: 'restoration', baseAmount: 16, powerAmount: 5, canRevive: false },
  },
} as const satisfies Record<ExpandedSpellId, ExpandedSpellDefinition>;

export const EXPANDED_SPELL_LIST: readonly ExpandedSpellDefinition[] = Object.values(EXPANDED_SPELLS);

export function isExpandedSpellId(id: string): id is ExpandedSpellId {
  return Object.hasOwn(EXPANDED_SPELLS, id);
}

export function getExpandedSpell(id: string): ExpandedSpellDefinition {
  if (!isExpandedSpellId(id)) throw new Error(`Unknown expanded spell: ${id}`);
  return EXPANDED_SPELLS[id];
}
