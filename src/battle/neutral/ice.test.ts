import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../resources';
import { createIceMonsterModel } from './ice';

const IDS = ['frostGiant', 'iceWyrm'] as const;

function meshes(model: THREE.Group): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) result.push(child);
  });
  return result;
}

function resources(model: THREE.Group): { geometries: Set<THREE.BufferGeometry>; materials: Set<THREE.Material> } {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const child of meshes(model)) {
    geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    for (const surface of childMaterials) materials.add(surface);
  }
  return { geometries, materials };
}

describe('ice neutral monster models', () => {
  it.each(IDS)('creates only the exact supported ID and preserves battle side metadata for %s', (id) => {
    for (const side of ['attacker', 'defender'] as const) {
      const model = createIceMonsterModel(id, side);
      expect(model).toBeInstanceOf(THREE.Group);
      expect(model?.name).toBe(`creature-${id}`);
      expect(model?.userData.creatureId).toBe(id);
      expect(model?.userData.faction).toBe('Neutral');
      expect(model?.userData.side).toBe(side);
      expect(model?.userData.animationPivot).toBe('ground');
      expect(model?.position.toArray()).toEqual([0, 0, 0]);
      expect(model?.scale.toArray()).toEqual([1, 1, 1]);
      expect(model?.rotation.y).toBe(side === 'attacker' ? 0 : Math.PI);
      expect(model?.getObjectByName('faction-ring')).toBeUndefined();
      expect(meshes(model!).length).toBeGreaterThan(20);
    }
  });

  it.each(['', 'unknown', 'frostgiant', 'titan', 'dragon', '__proto__', 'toString'])(
    'returns null instead of an inherited or fallback model for %s',
    (id) => expect(createIceMonsterModel(id, 'attacker')).toBeNull(),
  );

  it.each(IDS)('gives %s finite geometry, grounded safe bounds, label clearance, and raycast picking', (id) => {
    const model = createIceMonsterModel(id, 'attacker')!;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(bounds.max.y).toBeGreaterThan(1.5);
    expect(bounds.max.y).toBeLessThan(3);
    expect(size.x).toBeLessThan(3.5);
    expect(size.z).toBeLessThan(2.2);
    expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
    for (const child of meshes(model)) {
      const positions = child.geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
      expect(child.castShadow).toBe(true);
      expect(child.receiveShadow).toBe(true);
    }

    model.updateMatrixWorld(true);
    const center = bounds.getCenter(new THREE.Vector3());
    const raycaster = new THREE.Raycaster(center.clone().add(new THREE.Vector3(4, 0, 0)), new THREE.Vector3(-1, 0, 0));
    expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
  });

  it('uses visibly different giant and serpent silhouettes', () => {
    const giant = createIceMonsterModel('frostGiant', 'attacker')!;
    const wyrm = createIceMonsterModel('iceWyrm', 'attacker')!;
    const giantBounds = new THREE.Box3().setFromObject(giant);
    const wyrmBounds = new THREE.Box3().setFromObject(wyrm);
    expect(giant.userData.archetype).not.toBe(wyrm.userData.archetype);
    expect(giantBounds.max.y).toBeGreaterThan(wyrmBounds.max.y);
    expect(wyrmBounds.getSize(new THREE.Vector3()).x).toBeGreaterThan(giantBounds.getSize(new THREE.Vector3()).x * 1.3);
    expect(giant.getObjectByName('frost-giant-maul')).toBeInstanceOf(THREE.Mesh);
    expect(wyrm.getObjectByName('ice-wyrm-head')).toBeInstanceOf(THREE.Mesh);
    expect(meshes(wyrm).filter((child) => child.name.startsWith('ice-wyrm-spine-'))).toHaveLength(4);
  });

  it.each(IDS)('keeps resources independent between calls and disposes each %s resource once', (id) => {
    const first = createIceMonsterModel(id, 'attacker')!;
    const second = createIceMonsterModel(id, 'attacker')!;
    const firstResources = resources(first);
    const secondResources = resources(second);
    expect([...firstResources.geometries].some((geometry) => secondResources.geometries.has(geometry))).toBe(false);
    expect([...firstResources.materials].some((surface) => secondResources.materials.has(surface))).toBe(false);

    const geometrySpies = [...firstResources.geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...firstResources.materials].map((surface) => vi.spyOn(surface, 'dispose'));
    disposeBattleResources(first);
    for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).toHaveBeenCalledTimes(1);
    for (const geometry of secondResources.geometries) expect(geometry.getAttribute('position').count).toBeGreaterThan(0);
  });
});
