import {
  ARTIFACT_RARITIES,
  ARTIFACT_SLOTS,
  ARTIFACT_STATS,
  ARTIFACTS,
  type ArtifactDefinition,
  type ArtifactStatBonuses,
} from '../game/artifacts';
import { CREATURES, FACTIONS } from '../game/content';
import { EXTENDED_RESOURCE_TYPES as RESOURCE_TYPES } from '../game/resources';
import type { CreatureAbility, CreatureDefinition, ResourceCost } from '../game/types';
import {
  CONTENT_EDITOR_FORMAT,
  CONTENT_EDITOR_VERSION,
  type CustomContentRegistry,
  type ContentImportMode,
  type EditorIssue,
  type EditorIssueCode,
  type EditorResult,
} from './types';

export const CREATURE_ABILITIES = [
  'ranged',
  'flying',
  'retaliation',
  'doubleStrike',
  'regeneration',
  'spellResistance',
] as const satisfies readonly CreatureAbility[];

export const CREATURE_FACTIONS: readonly string[] = [
  ...Object.values(FACTIONS).map((faction) => faction.name),
  'Neutral',
];

const CREATURE_KEYS = [
  'id', 'name', 'faction', 'tier', 'attack', 'defense', 'damage', 'health',
  'speed', 'shots', 'cost', 'growth', 'abilities',
] as const;
const ARTIFACT_KEYS = ['id', 'name', 'description', 'slot', 'rarity', 'bonuses'] as const;
const REGISTRY_KEYS = ['format', 'version', 'creatures', 'artifacts'] as const;
const PROTOTYPE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_IMPORT_CHARACTERS = 5_000_000;

export function isEditorRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function issue(path: string, code: EditorIssueCode, message: string): EditorIssue {
  return { path, code, message };
}

function validateKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: EditorIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (PROTOTYPE_KEYS.has(key)) {
      errors.push(issue(`${path}.${key}`, 'prototype-key', `Unsafe key "${key}" is not allowed.`));
    } else if (!allowed.includes(key)) {
      errors.push(issue(`${path}.${key}`, 'unknown-key', `Unknown field "${key}".`));
    }
  }
}

function required(
  value: Record<string, unknown>,
  key: string,
  path: string,
  errors: EditorIssue[],
): unknown {
  if (!Object.hasOwn(value, key)) {
    errors.push(issue(`${path}.${key}`, 'required', `${key} is required.`));
    return undefined;
  }
  return value[key];
}

function stringValue(
  value: unknown,
  path: string,
  errors: EditorIssue[],
  options: { maxLength: number; allowEmpty?: boolean },
): string {
  if (typeof value !== 'string') {
    errors.push(issue(path, 'type', 'Expected a string.'));
    return '';
  }
  const result = value.trim();
  if (!options.allowEmpty && result.length === 0) {
    errors.push(issue(path, 'required', 'A non-empty value is required.'));
  }
  if (result.length > options.maxLength) {
    errors.push(issue(path, 'range', `Must be at most ${options.maxLength} characters.`));
  }
  return result;
}

function idValue(value: unknown, path: string, errors: EditorIssue[]): string {
  const id = stringValue(value, path, errors, { maxLength: 64 });
  if (PROTOTYPE_KEYS.has(id.toLowerCase())) {
    errors.push(issue(path, 'prototype-key', 'This ID is reserved for object prototype safety.'));
  } else if (id && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(id)) {
    errors.push(issue(path, 'format', 'Use a letter followed by letters, numbers, hyphens, or underscores.'));
  }
  return id;
}

function integerValue(
  value: unknown,
  path: string,
  errors: EditorIssue[],
  minimum: number,
  maximum: number,
): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    errors.push(issue(path, 'type', 'Expected a safe integer.'));
    return minimum;
  }
  if (value < minimum || value > maximum) {
    errors.push(issue(path, 'range', `Must be between ${minimum} and ${maximum}.`));
  }
  return value;
}

function enumValue<T extends string>(
  value: unknown,
  choices: readonly T[],
  path: string,
  errors: EditorIssue[],
): T | undefined {
  if (typeof value !== 'string' || !(choices as readonly string[]).includes(value)) {
    errors.push(issue(path, 'enum', `Expected one of: ${choices.join(', ')}.`));
    return undefined;
  }
  return value as T;
}

function costValue(value: unknown, path: string, errors: EditorIssue[]): ResourceCost {
  if (!isEditorRecord(value)) {
    errors.push(issue(path, 'type', 'Expected a resource-cost object.'));
    return {};
  }
  validateKeys(value, RESOURCE_TYPES, path, errors);
  const result: ResourceCost = {};
  for (const resource of RESOURCE_TYPES) {
    if (!Object.hasOwn(value, resource)) continue;
    const amount = integerValue(value[resource], `${path}.${resource}`, errors, 0, 1_000_000);
    if (amount > 0) result[resource] = amount;
  }
  return result;
}

function bonusesValue(value: unknown, path: string, errors: EditorIssue[]): ArtifactStatBonuses {
  if (!isEditorRecord(value)) {
    errors.push(issue(path, 'type', 'Expected a primary-stat bonus object.'));
    return {};
  }
  validateKeys(value, ARTIFACT_STATS, path, errors);
  const result: ArtifactStatBonuses = {};
  let positiveBonuses = 0;
  for (const stat of ARTIFACT_STATS) {
    if (!Object.hasOwn(value, stat)) continue;
    const amount = integerValue(value[stat], `${path}.${stat}`, errors, 0, 99);
    if (amount > 0) {
      result[stat] = amount;
      positiveBonuses += 1;
    }
  }
  if (positiveBonuses === 0) {
    errors.push(issue(path, 'required', 'At least one primary-stat bonus must be greater than zero.'));
  }
  return result;
}

function success<T>(value: T): EditorResult<T> {
  return { ok: true, value };
}

function failure(errors: readonly EditorIssue[]): EditorResult<never> {
  return { ok: false, errors };
}

export function cloneCreature(creature: CreatureDefinition): CreatureDefinition {
  return {
    ...creature,
    damage: [creature.damage[0], creature.damage[1]],
    cost: { ...creature.cost },
    abilities: [...creature.abilities],
  };
}

export function cloneArtifact(artifact: ArtifactDefinition): ArtifactDefinition {
  return { ...artifact, bonuses: { ...artifact.bonuses } };
}

export function cloneRegistry(registry: CustomContentRegistry): CustomContentRegistry {
  return {
    format: CONTENT_EDITOR_FORMAT,
    version: CONTENT_EDITOR_VERSION,
    creatures: registry.creatures.map(cloneCreature),
    artifacts: registry.artifacts.map(cloneArtifact),
  };
}

export function emptyCustomContentRegistry(): CustomContentRegistry {
  return {
    format: CONTENT_EDITOR_FORMAT,
    version: CONTENT_EDITOR_VERSION,
    creatures: [],
    artifacts: [],
  };
}

export function validateCreature(value: unknown, path = 'creature'): EditorResult<CreatureDefinition> {
  const errors: EditorIssue[] = [];
  if (!isEditorRecord(value)) return failure([issue(path, 'type', 'Expected a creature object.')]);
  validateKeys(value, CREATURE_KEYS, path, errors);

  const id = idValue(required(value, 'id', path, errors), `${path}.id`, errors);
  const name = stringValue(required(value, 'name', path, errors), `${path}.name`, errors, { maxLength: 80 });
  const faction = stringValue(required(value, 'faction', path, errors), `${path}.faction`, errors, { maxLength: 40 });
  if (faction && !CREATURE_FACTIONS.includes(faction)) {
    errors.push(issue(`${path}.faction`, 'enum', `Unknown faction "${faction}".`));
  }
  const tier = integerValue(required(value, 'tier', path, errors), `${path}.tier`, errors, 1, 4);
  const attack = integerValue(required(value, 'attack', path, errors), `${path}.attack`, errors, 0, 999);
  const defense = integerValue(required(value, 'defense', path, errors), `${path}.defense`, errors, 0, 999);

  const damageValue = required(value, 'damage', path, errors);
  let damage: [number, number] = [1, 1];
  if (!Array.isArray(damageValue) || damageValue.length !== 2) {
    errors.push(issue(`${path}.damage`, 'type', 'Expected [minimum, maximum] damage.'));
  } else {
    damage = [
      integerValue(damageValue[0], `${path}.damage[0]`, errors, 0, 999_999),
      integerValue(damageValue[1], `${path}.damage[1]`, errors, 0, 999_999),
    ];
    if (damage[0] > damage[1]) {
      errors.push(issue(`${path}.damage`, 'range', 'Minimum damage cannot exceed maximum damage.'));
    }
    if (damage[1] < 1) {
      errors.push(issue(`${path}.damage[1]`, 'range', 'Maximum damage must be at least 1.'));
    }
  }

  const health = integerValue(required(value, 'health', path, errors), `${path}.health`, errors, 1, 999_999);
  const speed = integerValue(required(value, 'speed', path, errors), `${path}.speed`, errors, 1, 99);
  const shots = integerValue(required(value, 'shots', path, errors), `${path}.shots`, errors, 0, 999);
  const cost = costValue(required(value, 'cost', path, errors), `${path}.cost`, errors);
  const growth = integerValue(required(value, 'growth', path, errors), `${path}.growth`, errors, 0, 999);

  const abilitiesValue = required(value, 'abilities', path, errors);
  let abilities: CreatureAbility[] = [];
  if (!Array.isArray(abilitiesValue)) {
    errors.push(issue(`${path}.abilities`, 'type', 'Expected an array of abilities.'));
  } else {
    const seen = new Set<CreatureAbility>();
    for (const [index, ability] of abilitiesValue.entries()) {
      const valid = enumValue(ability, CREATURE_ABILITIES, `${path}.abilities[${index}]`, errors);
      if (!valid) continue;
      if (seen.has(valid)) {
        errors.push(issue(`${path}.abilities[${index}]`, 'duplicate', `Ability "${valid}" is duplicated.`));
      } else {
        seen.add(valid);
        abilities.push(valid);
      }
    }
  }
  if (abilities.includes('ranged') && shots === 0) {
    errors.push(issue(`${path}.shots`, 'range', 'Ranged creatures need at least one shot.'));
  }

  if (errors.length > 0) return failure(errors);
  return success({ id, name, faction, tier, attack, defense, damage, health, speed, shots, cost, growth, abilities });
}

export function validateArtifact(value: unknown, path = 'artifact'): EditorResult<ArtifactDefinition> {
  const errors: EditorIssue[] = [];
  if (!isEditorRecord(value)) return failure([issue(path, 'type', 'Expected an artifact object.')]);
  validateKeys(value, ARTIFACT_KEYS, path, errors);

  const id = idValue(required(value, 'id', path, errors), `${path}.id`, errors);
  const name = stringValue(required(value, 'name', path, errors), `${path}.name`, errors, { maxLength: 80 });
  const description = stringValue(
    required(value, 'description', path, errors),
    `${path}.description`,
    errors,
    { maxLength: 240 },
  );
  const slot = enumValue(required(value, 'slot', path, errors), ARTIFACT_SLOTS, `${path}.slot`, errors);
  const rarity = enumValue(required(value, 'rarity', path, errors), ARTIFACT_RARITIES, `${path}.rarity`, errors);
  const bonuses = bonusesValue(required(value, 'bonuses', path, errors), `${path}.bonuses`, errors);

  if (errors.length > 0 || !slot || !rarity) return failure(errors);
  return success({ id, name, description, slot, rarity, bonuses });
}

export interface RegistryValidationOptions {
  readonly mode?: ContentImportMode;
  readonly existing?: CustomContentRegistry;
  readonly allowBuiltInIds?: boolean;
}

export function validateCustomContentRegistry(
  value: unknown,
  options: RegistryValidationOptions = {},
): EditorResult<CustomContentRegistry> {
  const errors: EditorIssue[] = [];
  if (!isEditorRecord(value)) return failure([issue('registry', 'type', 'Expected a content registry object.')]);
  validateKeys(value, REGISTRY_KEYS, 'registry', errors);

  const format = required(value, 'format', 'registry', errors);
  const version = required(value, 'version', 'registry', errors);
  if (format !== CONTENT_EDITOR_FORMAT) {
    errors.push(issue('registry.format', 'format', `Expected format "${CONTENT_EDITOR_FORMAT}".`));
  }
  if (version !== CONTENT_EDITOR_VERSION) {
    errors.push(issue('registry.version', 'version', `Unsupported registry version; expected ${CONTENT_EDITOR_VERSION}.`));
  }

  const creaturesValue = required(value, 'creatures', 'registry', errors);
  const artifactsValue = required(value, 'artifacts', 'registry', errors);
  const creatures: CreatureDefinition[] = [];
  const artifacts: ArtifactDefinition[] = [];
  if (!Array.isArray(creaturesValue)) {
    errors.push(issue('registry.creatures', 'type', 'Expected an array of creatures.'));
  } else {
    for (const [index, entry] of creaturesValue.entries()) {
      const result = validateCreature(entry, `registry.creatures[${index}]`);
      if (result.ok) creatures.push(result.value);
      else errors.push(...result.errors);
    }
  }
  if (!Array.isArray(artifactsValue)) {
    errors.push(issue('registry.artifacts', 'type', 'Expected an array of artifacts.'));
  } else {
    for (const [index, entry] of artifactsValue.entries()) {
      const result = validateArtifact(entry, `registry.artifacts[${index}]`);
      if (result.ok) artifacts.push(result.value);
      else errors.push(...result.errors);
    }
  }

  const mode = options.mode ?? 'replace';
  const existingCreatures = mode === 'merge' ? options.existing?.creatures ?? [] : [];
  const existingArtifacts = mode === 'merge' ? options.existing?.artifacts ?? [] : [];
  const seen = new Set<string>();
  const reserve = (id: string, path: string, builtIn: boolean): void => {
    if (seen.has(id) || (!options.allowBuiltInIds && builtIn)) {
      errors.push(issue(path, 'duplicate', `Content ID "${id}" is already in use.`));
    } else {
      seen.add(id);
    }
  };
  for (const creature of existingCreatures) reserve(creature.id, 'registry.creatures', false);
  for (const artifact of existingArtifacts) reserve(artifact.id, 'registry.artifacts', false);
  for (const [index, creature] of creatures.entries()) {
    reserve(creature.id, `registry.creatures[${index}].id`, Object.hasOwn(CREATURES, creature.id) || Object.hasOwn(ARTIFACTS, creature.id));
  }
  for (const [index, artifact] of artifacts.entries()) {
    reserve(artifact.id, `registry.artifacts[${index}].id`, Object.hasOwn(CREATURES, artifact.id) || Object.hasOwn(ARTIFACTS, artifact.id));
  }

  if (errors.length > 0) return failure(errors);
  return success({
    format: CONTENT_EDITOR_FORMAT,
    version: CONTENT_EDITOR_VERSION,
    creatures: [...existingCreatures.map(cloneCreature), ...creatures],
    artifacts: [...existingArtifacts.map(cloneArtifact), ...artifacts],
  });
}

export function parseCustomContentJson(
  json: string,
  options: RegistryValidationOptions = {},
): EditorResult<CustomContentRegistry> {
  if (typeof json !== 'string') return failure([issue('json', 'type', 'Expected JSON text.')]);
  if (json.length > MAX_IMPORT_CHARACTERS) {
    return failure([issue('json', 'range', 'Import is too large; the limit is 5,000,000 characters.')]);
  }
  try {
    return validateCustomContentRegistry(JSON.parse(json) as unknown, options);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown JSON error';
    return failure([issue('json', 'format', `Malformed JSON: ${detail}`)]);
  }
}

export function serializeCustomContent(registry: CustomContentRegistry, pretty = true): string {
  return JSON.stringify(cloneRegistry(registry), null, pretty ? 2 : undefined);
}
