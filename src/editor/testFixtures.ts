import type { ArtifactDefinition } from '../game/artifacts';
import type { CreatureDefinition } from '../game/types';
import { CONTENT_EDITOR_FORMAT, CONTENT_EDITOR_VERSION, type CustomContentRegistry } from './types';

export function creatureFixture(
  id = 'custom-creature-test',
  overrides: Partial<CreatureDefinition> = {},
): CreatureDefinition {
  const base: CreatureDefinition = {
    id,
    name: 'Test Vanguard',
    faction: 'Haven',
    tier: 2,
    attack: 7,
    defense: 6,
    damage: [3, 5],
    health: 24,
    speed: 6,
    shots: 0,
    cost: { gold: 180, wood: 1 },
    growth: 8,
    abilities: ['retaliation'],
  };
  return {
    ...base,
    ...overrides,
    id,
    damage: overrides.damage ? [...overrides.damage] : [...base.damage],
    cost: { ...base.cost, ...overrides.cost },
    abilities: overrides.abilities ? [...overrides.abilities] : [...base.abilities],
  };
}

export function artifactFixture(
  id = 'custom-artifact-test',
  overrides: Partial<ArtifactDefinition> = {},
): ArtifactDefinition {
  const base: ArtifactDefinition = {
    id,
    name: 'Test Sunblade',
    description: 'A blade made for editor tests.',
    slot: 'weapon',
    rarity: 'rare',
    bonuses: { attack: 2, knowledge: 1 },
  };
  return {
    ...base,
    ...overrides,
    id,
    bonuses: { ...base.bonuses, ...overrides.bonuses },
  };
}

export function registryFixture(): CustomContentRegistry {
  return {
    format: CONTENT_EDITOR_FORMAT,
    version: CONTENT_EDITOR_VERSION,
    creatures: [creatureFixture()],
    artifacts: [artifactFixture()],
  };
}
