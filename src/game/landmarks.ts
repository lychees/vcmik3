import { EXPANDED_SPELL_LIST } from './spells';
import type { LandmarkEffect, LandmarkObject, LandmarkType, ResourceCost } from './types';

export interface LandmarkDefinition {
  id: LandmarkType;
  name: string;
  description: string;
  effect: LandmarkEffect;
  reuse: 'never' | 'daily' | 'always';
}

export const LANDMARK_DEFINITIONS: Record<LandmarkType, LandmarkDefinition> = {
  arcaneLibrary: {
    id: 'arcaneLibrary', name: 'Arcane Library', effect: 'spell', reuse: 'never',
    description: 'Teaches a visiting hero one new spell.',
  },
  warriorsArena: {
    id: 'warriorsArena', name: "Warriors' Arena", effect: 'attack', reuse: 'never',
    description: 'Permanently grants a visiting hero +1 attack.',
  },
  heroesShrine: {
    id: 'heroesShrine', name: "Heroes' Shrine", effect: 'experience', reuse: 'never',
    description: 'Grants a visiting hero 1,000 experience.',
  },
  huntersLodge: {
    id: 'huntersLodge', name: "Hunters' Lodge", effect: 'defense', reuse: 'never',
    description: 'Permanently grants a visiting hero +1 defense.',
  },
  waterwheel: {
    id: 'waterwheel', name: 'Waterwheel', effect: 'movement', reuse: 'daily',
    description: 'Restores a visiting hero’s movement points once per day.',
  },
  elementalForge: {
    id: 'elementalForge', name: 'Elemental Forge', effect: 'forge', reuse: 'never',
    description: 'Permanently grants a visiting hero +1 attack and +1 defense.',
  },
  ancientObservatory: {
    id: 'ancientObservatory', name: 'Ancient Observatory', effect: 'reveal', reuse: 'never',
    description: 'Reveals the surrounding realm to the visiting hero’s player.',
  },
  healersSanctuary: {
    id: 'healersSanctuary', name: "Healers' Sanctuary", effect: 'mana', reuse: 'daily',
    description: 'Restores a visiting hero’s mana once per day.',
  },
  wayfarerPortal: {
    id: 'wayfarerPortal', name: 'Wayfarer Portal', effect: 'portal', reuse: 'always',
    description: 'Instantly transports a visiting hero to its linked portal.',
  },
  merchantsTent: {
    id: 'merchantsTent', name: "Merchants' Tent", effect: 'trade', reuse: 'daily',
    description: 'Offers 1 wood and 1 ore for 500 gold once per day.',
  },
};

export const LANDMARK_IDS = Object.freeze(Object.keys(LANDMARK_DEFINITIONS) as LandmarkType[]);
export const LIBRARY_SPELL_IDS: readonly string[] = [
  'fireball', 'slow', 'cure', 'bless', 'magicArrow', 'stoneSkin', 'haste',
  ...EXPANDED_SPELL_LIST.map((spell) => spell.id),
];
export const SHRINE_EXPERIENCE = 1000;
export const OBSERVATORY_REVEAL_RADIUS = 8;
export const MERCHANT_TRADE_COST: ResourceCost = { gold: 500 };
export const MERCHANT_TRADE_REWARD: ResourceCost = { wood: 1, ore: 1 };

export function isLandmarkType(value: string): value is LandmarkType {
  return Object.hasOwn(LANDMARK_DEFINITIONS, value);
}

export function hasVisitedLandmark(object: LandmarkObject, heroId: string): boolean {
  return Object.hasOwn(object.visits, heroId);
}

export function isLandmarkUsed(object: LandmarkObject, heroId: string, day: number): boolean {
  if (object.depleted) return true;
  const definition = LANDMARK_DEFINITIONS[object.landmarkId];
  if (definition.reuse === 'always') return false;
  const visitedDay = object.visits[heroId];
  if (visitedDay === undefined) return false;
  return definition.reuse === 'never' || visitedDay === day;
}
