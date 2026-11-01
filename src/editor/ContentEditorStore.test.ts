import { describe, expect, it, vi } from 'vitest';
import { ContentEditorStore } from './ContentEditorStore';
import { CUSTOM_CONTENT_STORAGE_KEY } from './types';
import { artifactFixture, creatureFixture, registryFixture } from './testFixtures';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function withoutId<T extends { id: string }>(definition: T): Omit<T, 'id'> {
  const { id: _id, ...input } = definition;
  return input;
}

describe('ContentEditorStore CRUD and identity', () => {
  it('creates, reads, updates, renames, and deletes creatures', () => {
    const store = new ContentEditorStore({ storage: null, randomToken: () => 'abc123' });
    const created = store.createCreature(withoutId(creatureFixture()));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.id).toBe('custom-creature-test-vanguard-abc123');
    expect(store.getCreature(created.value.id)).toEqual(created.value);

    const renamed = { ...created.value, id: 'custom-creature-renamed', name: 'Renamed Vanguard', attack: 12 };
    const updated = store.updateCreature(created.value.id, renamed);
    expect(updated.ok).toBe(true);
    expect(store.getCreature(created.value.id)).toBeUndefined();
    expect(store.getCreature(renamed.id)).toMatchObject({ name: 'Renamed Vanguard', attack: 12 });

    const deleted = store.deleteCreature(renamed.id);
    expect(deleted.ok).toBe(true);
    expect(store.getSnapshot().creatures).toEqual([]);
    expect(store.deleteCreature(renamed.id).ok).toBe(false);
    expect(store.updateCreature('missing', creatureFixture()).ok).toBe(false);
  });

  it('creates, updates, and deletes artifacts using the same registry', () => {
    const store = new ContentEditorStore({ storage: null, randomToken: () => 'artifact1' });
    const created = store.createArtifact(withoutId(artifactFixture()));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.id).toBe('custom-artifact-test-sunblade-artifact1');
    const updated = store.updateArtifact(created.value.id, { ...created.value, rarity: 'legendary', bonuses: { defense: 4 } });
    expect(updated.ok).toBe(true);
    expect(store.getArtifact(created.value.id)).toMatchObject({ rarity: 'legendary', bonuses: { defense: 4 } });
    expect(store.deleteArtifact(created.value.id).ok).toBe(true);
    expect(store.getSnapshot().artifacts).toEqual([]);
    expect(store.deleteArtifact('missing').ok).toBe(false);
    expect(store.updateArtifact('missing', artifactFixture()).ok).toBe(false);
  });

  it('generates collision-free IDs even when the random token repeats', () => {
    const store = new ContentEditorStore({ storage: null, randomToken: () => 'repeat' });
    const first = store.createCreature(withoutId(creatureFixture()));
    const second = store.createCreature(withoutId(creatureFixture()));
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.id).not.toBe(second.value.id);
      expect(second.value.id).toBe('custom-creature-test-vanguard-repeat-1');
    }
  });

  it('rejects custom, cross-type, and built-in duplicate IDs without mutation', () => {
    const store = new ContentEditorStore({ storage: null });
    expect(store.createCreature(creatureFixture('shared')).ok).toBe(true);
    const before = store.exportJson();
    expect(store.createCreature(creatureFixture('shared')).ok).toBe(false);
    expect(store.createArtifact(artifactFixture('shared')).ok).toBe(false);
    expect(store.createCreature(creatureFixture('militia')).ok).toBe(false);
    expect(store.createArtifact(artifactFixture('copperSunblade')).ok).toBe(false);
    expect(store.exportJson()).toBe(before);

    expect(store.createArtifact(artifactFixture('other')).ok).toBe(true);
    const occupied = store.exportJson();
    expect(store.updateCreature('shared', creatureFixture('other')).ok).toBe(false);
    expect(store.updateCreature('shared', creatureFixture('militia')).ok).toBe(false);
    expect(store.exportJson()).toBe(occupied);
  });

  it('keeps snapshots and returned definitions isolated from registry state', () => {
    const store = new ContentEditorStore({ storage: null });
    const created = store.createCreature(creatureFixture());
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    created.value.name = 'Mutated result';
    created.value.cost.gold = 0;
    (created.value.abilities as unknown as string[]).push('flying');
    expect(store.getCreature(creatureFixture().id)).toMatchObject({ name: 'Test Vanguard', cost: { gold: 180 }, abilities: ['retaliation'] });

    const snapshot = store.getSnapshot();
    const mutable = snapshot.creatures[0]! as unknown as { name: string; damage: [number, number] };
    mutable.name = 'Mutated snapshot';
    mutable.damage[0] = 999;
    expect(store.getCreature(creatureFixture().id)).toMatchObject({ name: 'Test Vanguard', damage: [3, 5] });
  });

  it('retains the saved entry after invalid updates or deletes of unknown IDs', () => {
    const store = new ContentEditorStore({ storage: null });
    expect(store.createCreature(creatureFixture()).ok).toBe(true);
    const before = store.exportJson();
    expect(store.updateCreature(creatureFixture().id, { ...creatureFixture(), health: -20 }).ok).toBe(false);
    expect(store.deleteArtifact('unknown').ok).toBe(false);
    expect(store.exportJson()).toBe(before);
  });
});

describe('ContentEditorStore import and export', () => {
  it('merges distinct registries and replaces only after complete validation', () => {
    const store = new ContentEditorStore({ storage: null });
    expect(store.createCreature(creatureFixture()).ok).toBe(true);
    const imported = registryFixture();
    const importedCreature = { ...imported.creatures[0]!, id: 'imported-creature' };
    const importedArtifact = { ...imported.artifacts[0]!, id: 'imported-artifact' };
    const merge = store.importRegistry({ ...imported, creatures: [importedCreature], artifacts: [importedArtifact] });
    expect(merge.ok).toBe(true);
    expect(store.getSnapshot().creatures.map((entry) => entry.id)).toEqual([creatureFixture().id, importedCreature.id]);
    expect(store.getSnapshot().artifacts.map((entry) => entry.id)).toEqual([importedArtifact.id]);

    const replace = store.importJson(store.exportJson(), { mode: 'replace' });
    expect(replace.ok).toBe(true);
    expect(store.getSnapshot().creatures).toHaveLength(2);
  });

  it('rejects malformed input and merge duplicates atomically', () => {
    const store = new ContentEditorStore({ storage: null });
    expect(store.importRegistry(registryFixture()).ok).toBe(true);
    const before = store.exportJson();
    expect(store.importJson('{bad json').ok).toBe(false);
    expect(store.importJson(JSON.stringify(registryFixture())).ok).toBe(false);
    expect(store.importJson(JSON.stringify({ ...registryFixture(), version: 99 }), { mode: 'replace' }).ok).toBe(false);
    expect(store.importRegistry({ ...registryFixture(), creatures: [{ ...creatureFixture(), speed: 0 }] }, { mode: 'replace' }).ok).toBe(false);
    expect(store.exportJson()).toBe(before);
  });

  it('exports only versioned saved state, not mutable object references', () => {
    const store = new ContentEditorStore({ storage: null });
    expect(store.importRegistry(registryFixture()).ok).toBe(true);
    const exported = store.exportJson(false);
    expect(exported).not.toContain('\n');
    const parsed = JSON.parse(exported) as { creatures: { name: string }[] };
    parsed.creatures[0]!.name = 'Changed export';
    expect(store.getSnapshot().creatures[0]?.name).toBe('Test Vanguard');
  });
});

describe('ContentEditorStore persistence and subscriptions', () => {
  it('validates and isolates optional initial registries', () => {
    const initial = registryFixture();
    const store = new ContentEditorStore({ storage: null, initialRegistry: initial });
    const creature = initial.creatures[0]! as { name: string };
    creature.name = 'Changed fixture';
    expect(store.getSnapshot().creatures[0]?.name).toBe('Test Vanguard');

    const invalid = new ContentEditorStore({
      storage: null,
      initialRegistry: { ...registryFixture(), creatures: [creatureFixture('invalid', { health: 0 })] },
    });
    expect(invalid.getSnapshot().creatures).toEqual([]);
    expect(invalid.getLoadIssues().some((entry) => entry.path.endsWith('.health'))).toBe(true);
  });

  it('persists every CRUD change and reloads the custom registry', () => {
    const storage = new MemoryStorage();
    const store = new ContentEditorStore({ storage });
    expect(store.createCreature(creatureFixture()).ok).toBe(true);
    expect(store.createArtifact(artifactFixture()).ok).toBe(true);
    expect(storage.getItem(CUSTOM_CONTENT_STORAGE_KEY)).toBe(store.exportJson());

    const restored = new ContentEditorStore({ storage });
    expect(restored.getSnapshot()).toEqual(store.getSnapshot());
    expect(restored.updateCreature(creatureFixture().id, { ...creatureFixture(), defense: 20 }).ok).toBe(true);
    expect(new ContentEditorStore({ storage }).getCreature(creatureFixture().id)?.defense).toBe(20);
    expect(restored.reset().ok).toBe(true);
    expect(storage.getItem(CUSTOM_CONTENT_STORAGE_KEY)).toBeNull();
    expect(new ContentEditorStore({ storage }).getSnapshot().creatures).toEqual([]);
  });

  it('surfaces corrupted or unreadable storage without throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem(CUSTOM_CONTENT_STORAGE_KEY, '{broken');
    const corrupted = new ContentEditorStore({ storage });
    expect(corrupted.getSnapshot().creatures).toEqual([]);
    expect(corrupted.getLoadIssues()[0]?.code).toBe('format');

    const unreadable = new MemoryStorage();
    vi.spyOn(unreadable, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const store = new ContentEditorStore({ storage: unreadable });
    expect(store.getLoadIssues()[0]).toMatchObject({ code: 'storage' });
  });

  it('does not commit creates, updates, imports, or resets when persistence fails', () => {
    const storage = new MemoryStorage();
    const setItem = vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const store = new ContentEditorStore({ storage });
    expect(store.createCreature(creatureFixture()).ok).toBe(false);
    expect(store.getSnapshot().creatures).toEqual([]);
    expect(store.importRegistry(registryFixture()).ok).toBe(false);
    expect(store.getSnapshot().creatures).toEqual([]);
    setItem.mockRestore();

    expect(store.createCreature(creatureFixture()).ok).toBe(true);
    const before = store.exportJson();
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(store.updateCreature(creatureFixture().id, { ...creatureFixture(), attack: 99 }).ok).toBe(false);
    expect(store.exportJson()).toBe(before);

    vi.spyOn(storage, 'removeItem').mockImplementation(() => { throw new Error('denied'); });
    expect(store.reset().ok).toBe(false);
    expect(store.exportJson()).toBe(before);
  });

  it('notifies subscribers with isolated snapshots and supports unsubscribe', () => {
    const store = new ContentEditorStore({ storage: null });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    expect(store.createCreature(creatureFixture()).ok).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    const published = listener.mock.calls[0]?.[0] as { creatures: { name: string }[] };
    published.creatures[0]!.name = 'Listener mutation';
    expect(store.getSnapshot().creatures[0]?.name).toBe('Test Vanguard');
    unsubscribe();
    expect(store.createArtifact(artifactFixture()).ok).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
