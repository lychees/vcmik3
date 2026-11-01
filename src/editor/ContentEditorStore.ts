import { ARTIFACTS, type ArtifactDefinition } from '../game/artifacts';
import { CREATURES } from '../game/content';
import type { CreatureDefinition } from '../game/types';
import type {
  ContentImportMode,
  CustomContentListener,
  CustomContentRegistry,
  CustomContentSource,
  EditorIssue,
  EditorResult,
} from './types';
import { CUSTOM_CONTENT_STORAGE_KEY } from './types';
import {
  cloneArtifact,
  cloneCreature,
  cloneRegistry,
  emptyCustomContentRegistry,
  isEditorRecord,
  parseCustomContentJson,
  serializeCustomContent,
  validateArtifact,
  validateCreature,
  validateCustomContentRegistry,
} from './validation';

export interface ContentEditorStoreOptions {
  readonly storage?: Storage | null;
  readonly storageKey?: string;
  readonly autoLoad?: boolean;
  readonly initialRegistry?: CustomContentRegistry;
  readonly randomToken?: () => string;
}

export interface ContentImportOptions {
  readonly mode?: ContentImportMode;
}

function defaultStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

function storageIssue(message: string): EditorIssue {
  return { path: 'storage', code: 'storage', message };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown storage error';
}

function slug(value: string): string {
  const normalized = value.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'content';
}

export class ContentEditorStore implements CustomContentSource {
  private registry: CustomContentRegistry;
  private readonly storage: Storage | null;
  private readonly storageKey: string;
  private readonly randomToken: () => string;
  private readonly listeners = new Set<CustomContentListener>();
  private readonly loadIssues: EditorIssue[] = [];

  constructor(options: ContentEditorStoreOptions = {}) {
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.storageKey = options.storageKey ?? CUSTOM_CONTENT_STORAGE_KEY;
    this.randomToken = options.randomToken ?? (() => {
      try {
        if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID().slice(0, 8);
      } catch {
        // Fall through to a local random token when crypto is unavailable.
      }
      return `${Date.now().toString(36)}${Math.floor(Math.random() * 0xffffff).toString(36)}`.slice(-12);
    });
    this.registry = emptyCustomContentRegistry();
    if (options.initialRegistry) {
      const initial = validateCustomContentRegistry(options.initialRegistry);
      if (initial.ok) this.registry = initial.value;
      else this.loadIssues.push(...initial.errors);
    }
    if (options.autoLoad !== false) this.load();
  }

  getSnapshot(): CustomContentRegistry {
    return cloneRegistry(this.registry);
  }

  getLoadIssues(): readonly EditorIssue[] {
    return this.loadIssues.map((entry) => ({ ...entry }));
  }

  getCreature(id: string): CreatureDefinition | undefined {
    const result = this.registry.creatures.find((creature) => creature.id === id);
    return result ? cloneCreature(result) : undefined;
  }

  getArtifact(id: string): ArtifactDefinition | undefined {
    const result = this.registry.artifacts.find((artifact) => artifact.id === id);
    return result ? cloneArtifact(result) : undefined;
  }

  generateCreatureId(name = 'creature'): string {
    return this.generateId('creature', name);
  }

  generateArtifactId(name = 'artifact'): string {
    return this.generateId('artifact', name);
  }

  createCreature(input: unknown): EditorResult<CreatureDefinition> {
    const prepared = this.prepareNewEntry(input, 'creature');
    const result = validateCreature(prepared);
    if (!result.ok) return result;
    const duplicate = this.findDuplicate(result.value.id);
    if (duplicate) return duplicate;
    const next: CustomContentRegistry = {
      ...this.registry,
      creatures: [...this.registry.creatures, result.value],
    };
    const committed = this.commit(next);
    return committed.ok ? { ok: true, value: cloneCreature(result.value) } : committed;
  }

  updateCreature(originalId: string, input: unknown): EditorResult<CreatureDefinition> {
    const index = this.registry.creatures.findIndex((creature) => creature.id === originalId);
    if (index < 0) return this.notFound('Creature', originalId);
    const prepared = isEditorRecord(input) && !Object.hasOwn(input, 'id') ? { ...input, id: originalId } : input;
    const result = validateCreature(prepared);
    if (!result.ok) return result;
    const duplicate = this.findDuplicate(result.value.id, originalId);
    if (duplicate) return duplicate;
    const creatures = this.registry.creatures.map(cloneCreature);
    creatures[index] = result.value;
    const committed = this.commit({ ...this.registry, creatures });
    return committed.ok ? { ok: true, value: cloneCreature(result.value) } : committed;
  }

  deleteCreature(id: string): EditorResult<CreatureDefinition> {
    const creature = this.registry.creatures.find((entry) => entry.id === id);
    if (!creature) return this.notFound('Creature', id);
    const committed = this.commit({
      ...this.registry,
      creatures: this.registry.creatures.filter((entry) => entry.id !== id),
    });
    return committed.ok ? { ok: true, value: cloneCreature(creature) } : committed;
  }

  createArtifact(input: unknown): EditorResult<ArtifactDefinition> {
    const prepared = this.prepareNewEntry(input, 'artifact');
    const result = validateArtifact(prepared);
    if (!result.ok) return result;
    const duplicate = this.findDuplicate(result.value.id);
    if (duplicate) return duplicate;
    const next: CustomContentRegistry = {
      ...this.registry,
      artifacts: [...this.registry.artifacts, result.value],
    };
    const committed = this.commit(next);
    return committed.ok ? { ok: true, value: cloneArtifact(result.value) } : committed;
  }

  updateArtifact(originalId: string, input: unknown): EditorResult<ArtifactDefinition> {
    const index = this.registry.artifacts.findIndex((artifact) => artifact.id === originalId);
    if (index < 0) return this.notFound('Artifact', originalId);
    const prepared = isEditorRecord(input) && !Object.hasOwn(input, 'id') ? { ...input, id: originalId } : input;
    const result = validateArtifact(prepared);
    if (!result.ok) return result;
    const duplicate = this.findDuplicate(result.value.id, originalId);
    if (duplicate) return duplicate;
    const artifacts = this.registry.artifacts.map(cloneArtifact);
    artifacts[index] = result.value;
    const committed = this.commit({ ...this.registry, artifacts });
    return committed.ok ? { ok: true, value: cloneArtifact(result.value) } : committed;
  }

  deleteArtifact(id: string): EditorResult<ArtifactDefinition> {
    const artifact = this.registry.artifacts.find((entry) => entry.id === id);
    if (!artifact) return this.notFound('Artifact', id);
    const committed = this.commit({
      ...this.registry,
      artifacts: this.registry.artifacts.filter((entry) => entry.id !== id),
    });
    return committed.ok ? { ok: true, value: cloneArtifact(artifact) } : committed;
  }

  importJson(json: string, options: ContentImportOptions = {}): EditorResult<CustomContentRegistry> {
    const result = parseCustomContentJson(json, {
      mode: options.mode ?? 'merge',
      existing: this.registry,
    });
    if (!result.ok) return result;
    const committed = this.commit(result.value);
    return committed.ok ? { ok: true, value: this.getSnapshot() } : committed;
  }

  importRegistry(
    registry: unknown,
    options: ContentImportOptions = {},
  ): EditorResult<CustomContentRegistry> {
    const result = validateCustomContentRegistry(registry, {
      mode: options.mode ?? 'merge',
      existing: this.registry,
    });
    if (!result.ok) return result;
    const committed = this.commit(result.value);
    return committed.ok ? { ok: true, value: this.getSnapshot() } : committed;
  }

  exportJson(pretty = true): string {
    return serializeCustomContent(this.registry, pretty);
  }

  reset(): EditorResult<CustomContentRegistry> {
    if (this.storage) {
      try {
        this.storage.removeItem(this.storageKey);
      } catch (error) {
        return { ok: false, errors: [storageIssue(`Could not reset persisted content: ${errorMessage(error)}`)] };
      }
    }
    this.registry = emptyCustomContentRegistry();
    this.notify();
    return { ok: true, value: this.getSnapshot() };
  }

  subscribe(listener: CustomContentListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private load(): void {
    if (!this.storage) return;
    let serialized: string | null;
    try {
      serialized = this.storage.getItem(this.storageKey);
    } catch (error) {
      this.loadIssues.push(storageIssue(`Could not read custom content: ${errorMessage(error)}`));
      return;
    }
    if (serialized === null) return;
    const result = parseCustomContentJson(serialized);
    if (result.ok) this.registry = result.value;
    else this.loadIssues.push(...result.errors);
  }

  private commit(next: CustomContentRegistry): EditorResult<CustomContentRegistry> {
    if (this.storage) {
      try {
        this.storage.setItem(this.storageKey, serializeCustomContent(next));
      } catch (error) {
        return { ok: false, errors: [storageIssue(`Could not persist custom content: ${errorMessage(error)}`)] };
      }
    }
    this.registry = cloneRegistry(next);
    this.notify();
    return { ok: true, value: this.getSnapshot() };
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.getSnapshot());
  }

  private notFound(kind: string, id: string): EditorResult<never> {
    return { ok: false, errors: [{ path: 'id', code: 'not-found', message: `${kind} "${id}" does not exist.` }] };
  }

  private findDuplicate(id: string, exceptId?: string): EditorResult<never> | undefined {
    const duplicateCreature = this.registry.creatures.some((entry) => entry.id === id && entry.id !== exceptId);
    const duplicateArtifact = this.registry.artifacts.some((entry) => entry.id === id && entry.id !== exceptId);
    const builtIn = Object.hasOwn(CREATURES, id) || Object.hasOwn(ARTIFACTS, id);
    if (!duplicateCreature && !duplicateArtifact && !builtIn) return undefined;
    return { ok: false, errors: [{ path: 'id', code: 'duplicate', message: `Content ID "${id}" is already in use.` }] };
  }

  private prepareNewEntry(input: unknown, kind: 'creature' | 'artifact'): unknown {
    if (!isEditorRecord(input) || (Object.hasOwn(input, 'id') && input.id !== '')) return input;
    const name = typeof input.name === 'string' ? input.name : kind;
    return {
      ...input,
      id: kind === 'creature' ? this.generateCreatureId(name) : this.generateArtifactId(name),
    };
  }

  private generateId(kind: 'creature' | 'artifact', name: string): string {
    const base = `custom-${kind}-${slug(name)}`;
    const token = this.randomToken().toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'id';
    for (let attempt = 0; attempt < 10_000; attempt += 1) {
      const suffix = attempt === 0 ? token : `${token}-${attempt}`;
      const candidate = `${base}-${suffix}`;
      if (!this.findDuplicate(candidate)) return candidate;
    }
    throw new Error('Could not generate a unique content ID.');
  }
}
