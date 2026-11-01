import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ContentEditorStore } from './ContentEditorStore';
import { createCustomContentBattleHooks } from './hooks';
import { createCustomCreatureModel, disposeCustomContentModel } from './models';
import { artifactFixture, creatureFixture } from './testFixtures';

describe('custom creature models', () => {
  it('creates live procedural models with current battle metadata', () => {
    const base = createCustomCreatureModel(creatureFixture());
    const allAbilities = createCustomCreatureModel(creatureFixture('custom-all', {
      tier: 4,
      abilities: ['ranged', 'flying', 'retaliation', 'doubleStrike', 'regeneration', 'spellResistance'],
      shots: 12,
    }), 'defender');
    expect(allAbilities.name).toBe('custom-creature-custom-all');
    expect(allAbilities.userData).toMatchObject({
      creatureId: 'custom-all',
      customContent: true,
      faction: 'Haven',
      archetype: 'custom-humanoid',
      side: 'defender',
      tier: 4,
      animationPivot: 'ground',
    });
    expect(allAbilities.children.length).toBeGreaterThan(base.children.length);
    expect(allAbilities.scale.x).toBeGreaterThan(base.scale.x);
    let meshCount = 0;
    allAbilities.traverse((child) => {
      if (child instanceof THREE.Mesh) meshCount += 1;
    });
    expect(meshCount).toBeGreaterThan(10);
    disposeCustomContentModel(base);
    disposeCustomContentModel(allAbilities);
  });

  it('disposes model geometries and materials for repeated live previews', () => {
    const model = createCustomCreatureModel(creatureFixture());
    let geometry: THREE.BufferGeometry | undefined;
    let material: THREE.Material | undefined;
    model.traverse((child) => {
      if (!geometry && child instanceof THREE.Mesh) {
        geometry = child.geometry;
        material = Array.isArray(child.material) ? child.material[0] : child.material;
      }
    });
    if (!geometry || !material) throw new Error('Expected a mesh');
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    disposeCustomContentModel(model);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });
});

describe('custom-content battle registration hooks', () => {
  it('exposes safe null-prototype registries and own-key lookups', () => {
    const store = new ContentEditorStore({ storage: null });
    expect(store.createCreature(creatureFixture()).ok).toBe(true);
    expect(store.createArtifact(artifactFixture()).ok).toBe(true);
    const hooks = createCustomContentBattleHooks(store);
    const definitions = hooks.getBattleDefinitions();
    expect(Object.getPrototypeOf(definitions.creatures)).toBeNull();
    expect(Object.getPrototypeOf(definitions.artifacts)).toBeNull();
    expect(Object.hasOwn(definitions.creatures, creatureFixture().id)).toBe(true);
    expect(definitions.creatures[creatureFixture().id]).toMatchObject({ attack: 7 });
    expect(definitions.artifacts[artifactFixture().id]).toMatchObject({ bonuses: { attack: 2, knowledge: 1 } });
    expect(hooks.getCreature('constructor')).toBeUndefined();
    expect(hooks.getArtifact('__proto__')).toBeUndefined();
    expect(hooks.createCreatureModel('missing')).toBeUndefined();

    definitions.creatures[creatureFixture().id]!.name = 'Mutated hook';
    expect(hooks.getCreature(creatureFixture().id)?.name).toBe('Test Vanguard');
  });

  it('reads current custom definitions and models after every registry change', () => {
    const store = new ContentEditorStore({ storage: null });
    const hooks = createCustomContentBattleHooks(store);
    expect(store.createCreature(creatureFixture()).ok).toBe(true);
    const first = hooks.createCreatureModel(creatureFixture().id);
    expect(first?.userData.creatureId).toBe(creatureFixture().id);
    if (first) disposeCustomContentModel(first);

    expect(store.updateCreature(creatureFixture().id, { ...creatureFixture(), attack: 30, name: 'Updated' }).ok).toBe(true);
    expect(hooks.getCreature(creatureFixture().id)).toMatchObject({ attack: 30, name: 'Updated' });
    expect(hooks.getSnapshot().creatures).toHaveLength(1);
    expect(store.deleteCreature(creatureFixture().id).ok).toBe(true);
    expect(hooks.getCreature(creatureFixture().id)).toBeUndefined();
    expect(hooks.createCreatureModel(creatureFixture().id)).toBeUndefined();
  });
});
