import { describe, expect, it } from 'vitest';
import type { EditorResult } from './types';
import {
  parseCustomContentJson,
  serializeCustomContent,
  validateArtifact,
  validateCreature,
  validateCustomContentRegistry,
} from './validation';
import { artifactFixture, creatureFixture, registryFixture } from './testFixtures';

function errors(result: EditorResult<unknown>) {
  if (result.ok) throw new Error('Expected validation to fail');
  return result.errors;
}

describe('creature schema validation', () => {
  it('accepts the current game creature contract and normalizes safe values', () => {
    const result = validateCreature({
      ...creatureFixture(),
      name: '  Dawn Vanguard  ',
      faction: ' Haven ',
      cost: { gold: 200, wood: 0 },
      abilities: ['flying', 'ranged'],
      shots: 12,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      name: 'Dawn Vanguard',
      faction: 'Haven',
      cost: { gold: 200 },
      abilities: ['flying', 'ranged'],
      shots: 12,
    });
    expect(result.value).not.toHaveProperty('cost.wood');
  });

  it('rejects missing, unknown, and incorrectly typed fields', () => {
    const missing = { ...creatureFixture() } as Record<string, unknown>;
    delete missing.health;
    expect(errors(validateCreature(missing)).some((entry) => entry.path === 'creature.health')).toBe(true);
    expect(errors(validateCreature({ ...creatureFixture(), surprise: true }))).toMatchObject([
      { path: 'creature.surprise', code: 'unknown-key' },
    ]);
    expect(errors(validateCreature(null))[0]?.code).toBe('type');
    expect(errors(validateCreature({ ...creatureFixture(), name: 42 })).some((entry) => entry.path === 'creature.name')).toBe(true);
    expect(errors(validateCreature({ ...creatureFixture(), name: '   ' })).some((entry) => entry.code === 'required')).toBe(true);
  });

  it('enforces integer ranges for every combat and growth field', () => {
    const invalidCases: readonly [string, unknown][] = [
      ['tier', 0], ['tier', 5], ['tier', 1.5],
      ['attack', -1], ['attack', Number.NaN], ['defense', 1.2],
      ['health', 0], ['health', Number.POSITIVE_INFINITY],
      ['speed', 0], ['speed', 100], ['shots', -1], ['growth', -1], ['growth', 2.5],
    ];
    for (const [field, value] of invalidCases) {
      const result = errors(validateCreature({ ...creatureFixture(), [field]: value }));
      expect(result.some((entry) => entry.path === `creature.${field}`), `${field}=${String(value)}`).toBe(true);
    }
  });

  it('validates damage tuples, resource costs, factions, and IDs', () => {
    for (const damage of [[4, 2], [0, 0], [1], [1, 2, 3], '1-2']) {
      expect(errors(validateCreature({ ...creatureFixture(), damage })).some((entry) => entry.path.includes('damage'))).toBe(true);
    }
    expect(errors(validateCreature({ ...creatureFixture(), cost: { gold: -1 } })).some((entry) => entry.path === 'creature.cost.gold')).toBe(true);
    const allResources = {
      gold: 10, wood: 9, ore: 8, crystal: 7, gems: 6, mercury: 5, sulfur: 4,
      mithril: 3, obsidian: 2, essence: 1,
    };
    const expandedCost = validateCreature({ ...creatureFixture(), cost: allResources });
    expect(expandedCost.ok).toBe(true);
    if (expandedCost.ok) expect(expandedCost.value.cost).toEqual(allResources);
    expect(errors(validateCreature({ ...creatureFixture(), cost: { unobtainium: 1 } }))[0]?.code).toBe('unknown-key');
    expect(errors(validateCreature({ ...creatureFixture(), faction: 'Invented' })).some((entry) => entry.path === 'creature.faction')).toBe(true);
    for (const id of ['', '9bad', 'has space', 'bad/slash', 'a'.repeat(65), '__proto__', 'constructor', 'prototype']) {
      expect(errors(validateCreature({ ...creatureFixture(), id })).some((entry) => entry.path === 'creature.id'), id).toBe(true);
    }
  });

  it('accepts only unique existing abilities and requires ammunition for ranged creatures', () => {
    expect(errors(validateCreature({ ...creatureFixture(), abilities: ['meteor'] })).some((entry) => entry.code === 'enum')).toBe(true);
    expect(errors(validateCreature({ ...creatureFixture(), abilities: ['flying', 'flying'] })).some((entry) => entry.code === 'duplicate')).toBe(true);
    expect(errors(validateCreature({ ...creatureFixture(), abilities: ['ranged'], shots: 0 })).some((entry) => entry.path === 'creature.shots')).toBe(true);
    expect(errors(validateCreature({ ...creatureFixture(), abilities: 'flying' })).some((entry) => entry.path === 'creature.abilities')).toBe(true);
    expect(validateCreature({ ...creatureFixture(), abilities: ['ranged'], shots: 1 }).ok).toBe(true);
  });
});

describe('artifact schema validation', () => {
  it('uses the M41 slot, rarity, and primary-stat definitions', () => {
    const result = validateArtifact({
      ...artifactFixture(),
      name: '  Sage Ring ',
      slot: 'trinket',
      rarity: 'epic',
      bonuses: { attack: 0, spellPower: 3, knowledge: 2 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('Sage Ring');
      expect(result.value.bonuses).toEqual({ spellPower: 3, knowledge: 2 });
    }
  });

  it('rejects invalid enums, descriptions, bonuses, and unknown fields', () => {
    expect(errors(validateArtifact({ ...artifactFixture(), slot: 'ring' })).some((entry) => entry.code === 'enum')).toBe(true);
    expect(errors(validateArtifact({ ...artifactFixture(), rarity: 'mythic' })).some((entry) => entry.code === 'enum')).toBe(true);
    expect(errors(validateArtifact({ ...artifactFixture(), description: '' })).some((entry) => entry.path === 'artifact.description')).toBe(true);
    expect(errors(validateArtifact({ ...artifactFixture(), bonuses: {} })).some((entry) => entry.path === 'artifact.bonuses')).toBe(true);
    expect(errors(validateArtifact({ ...artifactFixture(), bonuses: { attack: -1 } })).some((entry) => entry.path === 'artifact.bonuses.attack')).toBe(true);
    expect(errors(validateArtifact({ ...artifactFixture(), bonuses: { attack: 1.5 } })).some((entry) => entry.path === 'artifact.bonuses.attack')).toBe(true);
    expect(errors(validateArtifact({ ...artifactFixture(), bonuses: { luck: 2 } }))[0]?.code).toBe('unknown-key');
    expect(errors(validateArtifact({ ...artifactFixture(), price: 100 }))[0]?.code).toBe('unknown-key');
  });
});

describe('versioned registry validation and JSON', () => {
  it('round-trips a validated registry without losing definitions', () => {
    const registry = registryFixture();
    const json = serializeCustomContent(registry);
    expect(JSON.parse(json)).toMatchObject({ format: 'h3content-editor', version: 1 });
    const result = parseCustomContentJson(json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual(registry);
  });

  it('reports malformed JSON, unsupported versions, wrong formats, and invalid collections', () => {
    expect(errors(parseCustomContentJson('{no json'))[0]).toMatchObject({ path: 'json', code: 'format' });
    expect(errors(parseCustomContentJson(JSON.stringify({ ...registryFixture(), version: 2 }))).some((entry) => entry.code === 'version')).toBe(true);
    expect(errors(parseCustomContentJson(JSON.stringify({ ...registryFixture(), format: 'other' }))).some((entry) => entry.code === 'format')).toBe(true);
    expect(errors(parseCustomContentJson(JSON.stringify({ ...registryFixture(), creatures: {} }))).some((entry) => entry.path === 'registry.creatures')).toBe(true);
    expect(errors(parseCustomContentJson(JSON.stringify({ ...registryFixture(), extra: [] })))[0]?.code).toBe('unknown-key');
  });

  it('rejects duplicate custom IDs, cross-type collisions, and built-in overrides', () => {
    const duplicateCreatures = { ...registryFixture(), creatures: [creatureFixture('same'), creatureFixture('same')] };
    expect(errors(validateCustomContentRegistry(duplicateCreatures)).some((entry) => entry.code === 'duplicate')).toBe(true);
    const duplicateAcrossTypes = {
      ...registryFixture(),
      creatures: [creatureFixture('shared')],
      artifacts: [artifactFixture('shared')],
    };
    expect(errors(validateCustomContentRegistry(duplicateAcrossTypes)).some((entry) => entry.code === 'duplicate')).toBe(true);
    expect(errors(validateCustomContentRegistry({ ...registryFixture(), creatures: [creatureFixture('militia')] })).some((entry) => entry.code === 'duplicate')).toBe(true);
    expect(errors(validateCustomContentRegistry({ ...registryFixture(), artifacts: [artifactFixture('copperSunblade')] })).some((entry) => entry.code === 'duplicate')).toBe(true);
  });

  it('rejects prototype keys at every dynamic object boundary', () => {
    const registryJson = serializeCustomContent(registryFixture());
    const root = JSON.parse(registryJson.replace('"format":', '"__proto__": {"polluted": true}, "format":')) as unknown;
    expect(errors(validateCustomContentRegistry(root)).some((entry) => entry.code === 'prototype-key')).toBe(true);

    const creature = JSON.parse(registryJson.replace('"name": "Test Vanguard"', '"__proto__": {"polluted": true}, "name": "Test Vanguard"')) as { creatures: unknown[] };
    expect(errors(validateCreature(creature.creatures[0])).some((entry) => entry.code === 'prototype-key')).toBe(true);

    const cost = JSON.parse(registryJson.replace('"gold": 180', '"__proto__": {"polluted": true}, "gold": 180')) as { creatures: { cost: unknown }[] };
    expect(errors(validateCreature({ ...creatureFixture(), cost: cost.creatures[0]?.cost })).some((entry) => entry.code === 'prototype-key')).toBe(true);

    const bonuses = JSON.parse(registryJson.replace('"attack": 2', '"constructor": {"polluted": true}, "attack": 2')) as { artifacts: { bonuses: unknown }[] };
    expect(errors(validateArtifact({ ...artifactFixture(), bonuses: bonuses.artifacts[0]?.bonuses })).some((entry) => entry.code === 'prototype-key')).toBe(true);
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });

  it('rejects objects with altered prototypes instead of reading inherited registry fields', () => {
    const inherited = Object.create(registryFixture()) as unknown;
    expect(validateCustomContentRegistry(inherited).ok).toBe(false);
    expect(parseCustomContentJson('null').ok).toBe(false);
  });
});
