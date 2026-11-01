import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../resources';
import { createForestMonsterModel } from './forest';

const IDS = ['ent', 'giantSpider'] as const;

function meshes(model: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) result.push(child);
  });
  return result;
}

function resources(model: THREE.Object3D): { geometries: Set<THREE.BufferGeometry>; materials: Set<THREE.Material> } {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const mesh of meshes(model)) {
    geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) materials.add(material);
  }
  return { geometries, materials };
}

function silhouette(model: THREE.Group): string {
  return meshes(model).map((mesh) => [
    mesh.geometry.type,
    ...mesh.position.toArray(),
    ...mesh.scale.toArray(),
    ...mesh.quaternion.toArray(),
  ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(',')).join('|');
}

describe('forest monster models', () => {
  it.each(IDS)('builds %s grounded and ring-free with safe metadata for both battle sides', (id) => {
    for (const side of ['attacker', 'defender'] as const) {
      const model = createForestMonsterModel(id, side);
      expect(model).toBeInstanceOf(THREE.Group);
      if (!model) continue;
      expect(model.name).toBe(`creature-${id}`);
      expect(model.userData.creatureId).toBe(id);
      expect(model.userData.faction).toBe('Neutral');
      expect(model.userData.animationPivot).toBe('ground');
      expect(model.userData.side).toBe(side);
      expect(model.userData.palette).toHaveLength(3);
      expect(model.position.toArray()).toEqual([0, 0, 0]);
      expect(model.rotation.y).toBe(side === 'attacker' ? 0 : Math.PI);
      expect(model.getObjectByName('faction-ring')).toBeUndefined();
      expect(meshes(model).length).toBeGreaterThan(20);

      const bounds = new THREE.Box3().setFromObject(model);
      expect(bounds.isEmpty()).toBe(false);
      expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
      expect(bounds.min.y).toBeLessThanOrEqual(0.001);
      expect(bounds.max.y).toBeGreaterThan(0.85);
      expect(bounds.max.y).toBeLessThan(3.2);
      expect(model.userData.visualHeight).toBeCloseTo(bounds.max.y - bounds.min.y, 6);
      expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
      for (const mesh of meshes(model)) {
        expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
      }
    }
  });

  it('gives the ent a leafy crown and the spider eight articulated legs with distinct silhouettes', () => {
    const ent = createForestMonsterModel('ent', 'attacker');
    const spider = createForestMonsterModel('giantSpider', 'attacker');
    expect(ent).not.toBeNull();
    expect(spider).not.toBeNull();
    if (!ent || !spider) return;

    const crown = ent.getObjectByName('ent-crown');
    expect(crown).toBeInstanceOf(THREE.Group);
    expect(crown ? meshes(crown).length : 0).toBeGreaterThanOrEqual(6);
    expect(ent.getObjectByName('ent-trunk')).toBeInstanceOf(THREE.Mesh);

    const legs = spider.children.filter((child) => child.userData.anatomy === 'leg');
    expect(legs).toHaveLength(8);
    for (const leg of legs) {
      expect(leg.getObjectByName('upper-leg')).toBeInstanceOf(THREE.Mesh);
      expect(leg.getObjectByName('lower-leg')).toBeInstanceOf(THREE.Mesh);
      expect(leg.getObjectByName('grounded-foot')).toBeInstanceOf(THREE.Mesh);
    }
    expect(meshes(spider).filter((mesh) => mesh.name.startsWith('giant-spider-eye-'))).toHaveLength(8);
    expect(silhouette(ent)).not.toBe(silhouette(spider));
  });

  it.each(['', 'unknown', 'militia', 'Ent', 'giant-spider', '__proto__', 'constructor', 'toString', 'hasOwnProperty'])(
    'returns null for unknown or inherited ID %s',
    (id) => {
      expect(createForestMonsterModel(id, 'attacker')).toBeNull();
    },
  );

  it.each(IDS)('creates independent resources and disposes every %s resource exactly once', (id) => {
    const first = createForestMonsterModel(id, 'attacker');
    const second = createForestMonsterModel(id, 'defender');
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (!first || !second) return;

    const firstResources = resources(first);
    const secondResources = resources(second);
    for (const geometry of secondResources.geometries) expect(firstResources.geometries.has(geometry)).toBe(false);
    for (const material of secondResources.materials) expect(firstResources.materials.has(material)).toBe(false);

    const geometrySpies = [...firstResources.geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...firstResources.materials].map((material) => vi.spyOn(material, 'dispose'));
    disposeBattleResources(first);
    for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).toHaveBeenCalledTimes(1);
    expect(second.children.length).toBeGreaterThan(0);
    disposeBattleResources(second);
  });
});
