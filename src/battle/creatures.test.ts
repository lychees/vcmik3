import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createCreatureModel } from './creatures';

const EXPANSION = [
  ['imp', 'Ember', 'hunched-fiend'],
  ['hellhound', 'Ember', 'canine-quadruped'],
  ['ifrit', 'Ember', 'winged-caster'],
  ['pitFiend', 'Ember', 'large-demon'],
  ['lizardman', 'Mire', 'reptilian-humanoid'],
  ['gorgon', 'Mire', 'armored-bull'],
  ['wyvern', 'Mire', 'two-legged-wyvern'],
  ['basilisk', 'Mire', 'serpentine'],
] as const;

function meshes(model: THREE.Group): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) result.push(child);
  });
  return result;
}

function silhouette(model: THREE.Group): string {
  return meshes(model)
    .filter((mesh) => mesh.name !== 'faction-ring')
    .map((mesh) => [
      mesh.geometry.type,
      ...mesh.position.toArray(),
      ...mesh.scale.toArray(),
      ...mesh.rotation.toArray().slice(0, 3),
    ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(','))
    .join('|');
}

describe('expansion creature models', () => {
  it.each(EXPANSION)('builds %s with its own faction, scale, and ground pivot', (id, faction, archetype) => {
    const model = createCreatureModel(id, 'attacker');
    const bounds = new THREE.Box3();
    for (const mesh of meshes(model)) {
      if (mesh.name !== 'faction-ring') bounds.expandByObject(mesh);
    }
    expect(model.userData.creatureId).toBe(id);
    expect(model.userData.faction).toBe(faction);
    expect(model.userData.archetype).toBe(archetype);
    expect(model.userData.animationPivot).toBe('ground');
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.03);
    expect(bounds.max.y).toBeGreaterThan(0.9);
    expect(bounds.max.y).toBeLessThan(3);
    expect(model.userData.visualHeight).toBeCloseTo(bounds.max.y - bounds.min.y, 6);
    expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
    expect(meshes(model).length).toBeGreaterThan(12);
    expect(meshes(model).length).toBeLessThan(40);
    expect(model.getObjectByName('faction-ring')).toBeDefined();
  });

  it('gives all eight units distinct silhouettes and palettes', () => {
    const models = EXPANSION.map(([id]) => createCreatureModel(id, 'attacker'));
    expect(new Set(models.map(silhouette)).size).toBe(EXPANSION.length);
    expect(new Set(models.map((model) => (model.userData.palette as number[]).join(','))).size).toBe(EXPANSION.length);
  });

  it('supports compact adventure models without battle rings and preserves defender facing', () => {
    const adventure = createCreatureModel('wyvern', 'attacker', { factionRing: false });
    expect(adventure.getObjectByName('faction-ring')).toBeUndefined();
    const defender = createCreatureModel('pitFiend', 'defender');
    expect(defender.rotation.y).toBe(Math.PI);
  });

  it('derives label clearance for existing large and small units too', () => {
    for (const id of ['militia', 'archer', 'griffin', 'cavalier', 'sprite', 'ranger', 'unicorn', 'dragon']) {
      const model = createCreatureModel(id, 'attacker');
      const bounds = new THREE.Box3().setFromObject(model);
      expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
    }
  });
});
