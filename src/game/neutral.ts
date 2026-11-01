import type { CreatureDefinition } from './types';

export const NEUTRAL_CREATURES: Record<string, CreatureDefinition> = {
  ratling: {
    id: 'ratling', name: 'Ratling', faction: 'Neutral', tier: 1,
    attack: 3, defense: 2, damage: [1, 3], health: 6, speed: 7, shots: 0,
    cost: { gold: 45 }, growth: 18, abilities: ['retaliation'],
  },
  mummy: {
    id: 'mummy', name: 'Mummy', faction: 'Neutral', tier: 1,
    attack: 5, defense: 5, damage: [2, 3], health: 14, speed: 4, shots: 0,
    cost: { gold: 80 }, growth: 12, abilities: ['regeneration'],
  },
  giantSpider: {
    id: 'giantSpider', name: 'Giant Spider', faction: 'Neutral', tier: 1,
    attack: 5, defense: 3, damage: [1, 4], health: 10, speed: 6, shots: 0,
    cost: { gold: 75 }, growth: 14, abilities: ['doubleStrike'],
  },
  seaHag: {
    id: 'seaHag', name: 'Sea Hag', faction: 'Neutral', tier: 2,
    attack: 7, defense: 5, damage: [3, 5], health: 18, speed: 5, shots: 10,
    cost: { gold: 145, mercury: 1 }, growth: 9, abilities: ['ranged', 'spellResistance'],
  },
  direBear: {
    id: 'direBear', name: 'Dire Bear', faction: 'Neutral', tier: 2,
    attack: 8, defense: 8, damage: [4, 6], health: 28, speed: 6, shots: 0,
    cost: { gold: 180 }, growth: 8, abilities: ['retaliation'],
  },
  cerberus: {
    id: 'cerberus', name: 'Cerberus', faction: 'Neutral', tier: 2,
    attack: 9, defense: 6, damage: [3, 6], health: 24, speed: 8, shots: 0,
    cost: { gold: 190, sulfur: 1 }, growth: 8, abilities: ['doubleStrike'],
  },
  broodMother: {
    id: 'broodMother', name: 'Brood Mother', faction: 'Neutral', tier: 2,
    attack: 8, defense: 7, damage: [3, 6], health: 26, speed: 5, shots: 0,
    cost: { gold: 175 }, growth: 8, abilities: ['regeneration', 'retaliation'],
  },
  wraith: {
    id: 'wraith', name: 'Wraith', faction: 'Neutral', tier: 2,
    attack: 8, defense: 6, damage: [3, 6], health: 20, speed: 7, shots: 0,
    cost: { gold: 170, gems: 1 }, growth: 9, abilities: ['flying', 'spellResistance'],
  },
  golem: {
    id: 'golem', name: 'Runic Golem', faction: 'Neutral', tier: 3,
    attack: 11, defense: 13, damage: [6, 9], health: 55, speed: 5, shots: 0,
    cost: { gold: 390, ore: 2 }, growth: 5, abilities: ['retaliation', 'spellResistance'],
  },
  manticore: {
    id: 'manticore', name: 'Manticore', faction: 'Neutral', tier: 3,
    attack: 12, defense: 9, damage: [7, 11], health: 45, speed: 9, shots: 0,
    cost: { gold: 380 }, growth: 5, abilities: ['flying', 'doubleStrike'],
  },
  sandWyrm: {
    id: 'sandWyrm', name: 'Sand Wyrm', faction: 'Neutral', tier: 3,
    attack: 12, defense: 11, damage: [7, 12], health: 58, speed: 6, shots: 0,
    cost: { gold: 420 }, growth: 5, abilities: ['regeneration'],
  },
  ent: {
    id: 'ent', name: 'Ancient Ent', faction: 'Neutral', tier: 3,
    attack: 10, defense: 13, damage: [6, 10], health: 65, speed: 5, shots: 0,
    cost: { gold: 400, wood: 2 }, growth: 4, abilities: ['retaliation', 'regeneration'],
  },
  iceWyrm: {
    id: 'iceWyrm', name: 'Ice Wyrm', faction: 'Neutral', tier: 3,
    attack: 12, defense: 10, damage: [7, 11], health: 48, speed: 8, shots: 0,
    cost: { gold: 410, crystal: 1 }, growth: 5, abilities: ['flying', 'spellResistance'],
  },
  basiliskKing: {
    id: 'basiliskKing', name: 'Basilisk King', faction: 'Neutral', tier: 3,
    attack: 13, defense: 12, damage: [8, 12], health: 60, speed: 6, shots: 0,
    cost: { gold: 460, crystal: 1 }, growth: 4, abilities: ['retaliation', 'spellResistance'],
  },
  lich: {
    id: 'lich', name: 'Lich', faction: 'Neutral', tier: 3,
    attack: 12, defense: 10, damage: [7, 10], health: 42, speed: 6, shots: 12,
    cost: { gold: 430, mercury: 1 }, growth: 5, abilities: ['ranged', 'spellResistance'],
  },
  beholder: {
    id: 'beholder', name: 'Beholder', faction: 'Neutral', tier: 4,
    attack: 16, defense: 14, damage: [14, 20], health: 95, speed: 7, shots: 12,
    cost: { gold: 900, gems: 2 }, growth: 2, abilities: ['ranged', 'flying', 'spellResistance'],
  },
  kraken: {
    id: 'kraken', name: 'Kraken', faction: 'Neutral', tier: 4,
    attack: 17, defense: 17, damage: [16, 24], health: 130, speed: 7, shots: 0,
    cost: { gold: 1100, mercury: 2 }, growth: 2, abilities: ['retaliation', 'regeneration'],
  },
  frostGiant: {
    id: 'frostGiant', name: 'Frost Giant', faction: 'Neutral', tier: 4,
    attack: 18, defense: 16, damage: [16, 25], health: 140, speed: 6, shots: 0,
    cost: { gold: 1200, crystal: 2 }, growth: 2, abilities: ['retaliation', 'spellResistance'],
  },
  balor: {
    id: 'balor', name: 'Balor', faction: 'Neutral', tier: 4,
    attack: 19, defense: 15, damage: [18, 26], health: 115, speed: 9, shots: 0,
    cost: { gold: 1250, sulfur: 3 }, growth: 2, abilities: ['flying', 'doubleStrike'],
  },
  hydra: {
    id: 'hydra', name: 'Swamp Hydra', faction: 'Neutral', tier: 4,
    attack: 17, defense: 18, damage: [15, 24], health: 135, speed: 6, shots: 0,
    cost: { gold: 1150, mercury: 2 }, growth: 2, abilities: ['retaliation', 'regeneration'],
  },
};

export const NEUTRAL_CREATURE_IDS = Object.freeze(Object.keys(NEUTRAL_CREATURES));

export function isNeutralCreatureId(creatureId: string): boolean {
  return Object.hasOwn(NEUTRAL_CREATURES, creatureId);
}
