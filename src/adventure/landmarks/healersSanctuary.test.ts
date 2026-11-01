import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../../battle/resources';
import { createHealersSanctuaryModel } from './healersSanctuary';

function getMeshes(group: THREE.Group): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) result.push(child);
  });
  return result;
}

function getMaterials(group: THREE.Group): Set<THREE.Material> {
  const result = new Set<THREE.Material>();
  for (const mesh of getMeshes(group)) {
    const surfaces = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const surface of surfaces) result.add(surface);
  }
  return result;
}

describe('healers sanctuary model', () => {
  it('builds a recognizable healing pool, four columns, herb beds, and restorative symbols', () => {
    const model = createHealersSanctuaryModel();
    expect(model.name).toBe('healersSanctuary');
    expect(model.userData).toMatchObject({
      landmarkId: 'healersSanctuary',
      animationPivot: 'ground',
    });
    expect(model.getObjectByName('healing-pool')).toBeInstanceOf(THREE.Mesh);
    const water = model.getObjectByName('healing-water') as THREE.Mesh;
    expect(water).toBeInstanceOf(THREE.Mesh);
    expect((water.material as THREE.MeshStandardMaterial).transparent).toBe(true);
    expect((water.material as THREE.MeshStandardMaterial).emissiveIntensity).toBeGreaterThan(0);

    const columns: THREE.Object3D[] = [];
    const herbBeds: THREE.Object3D[] = [];
    model.traverse((child) => {
      if (child.userData.anatomy === 'column') columns.push(child);
      if (child.userData.anatomy === 'herbBed') herbBeds.push(child);
    });
    expect(columns).toHaveLength(4);
    expect(herbBeds).toHaveLength(2);
    expect(model.getObjectByName('restorative-cross')).toBeInstanceOf(THREE.Group);
    expect(model.getObjectByName('sanctuary-pediment')).toBeInstanceOf(THREE.Mesh);
    expect(getMeshes(model).filter((mesh) => mesh.name.startsWith('healing-lotus-petal-'))).toHaveLength(5);
    expect(getMeshes(model).filter((mesh) => mesh.name.startsWith('restorative-mote-'))).toHaveLength(3);
    disposeBattleResources(model);
  });

  it('has finite geometry, grounded compact bounds, and raycastable pool and structure', () => {
    const model = createHealersSanctuaryModel();
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(bounds.max.y).toBeGreaterThan(1.8);
    expect(bounds.max.y).toBeLessThan(2.3);
    expect(size.x).toBeLessThan(2.7);
    expect(size.z).toBeLessThan(2.9);
    expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(model.userData.labelHeight).toBeGreaterThan(bounds.max.y);
    expect(getMeshes(model).length).toBeGreaterThan(45);
    expect(getMeshes(model).length).toBeLessThan(90);

    for (const mesh of getMeshes(model)) {
      const positions = mesh.geometry.getAttribute('position');
      expect(positions).toBeDefined();
      expect(positions.array.every(Number.isFinite)).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
    }
    for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
      expect(Number.isFinite(value)).toBe(true);
    }

    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 8, 0.18),
      new THREE.Vector3(0, -1, 0),
    );
    expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
    expect(raycaster.intersectObject(model.getObjectByName('healing-water')!, true).length).toBeGreaterThan(0);
    const groundLevel = new THREE.Raycaster(
      new THREE.Vector3(0, 0.22, 5),
      new THREE.Vector3(0, 0, -1),
    );
    expect(groundLevel.intersectObject(model, true).length).toBeGreaterThan(0);
    disposeBattleResources(model);
  });

  it('gives each sanctuary independently disposable geometry and materials', () => {
    const first = createHealersSanctuaryModel();
    const second = createHealersSanctuaryModel();
    const firstGeometries = new Set(getMeshes(first).map((mesh) => mesh.geometry));
    const secondGeometries = new Set(getMeshes(second).map((mesh) => mesh.geometry));
    const firstMaterials = getMaterials(first);
    const secondMaterials = getMaterials(second);
    for (const geometry of firstGeometries) expect(secondGeometries.has(geometry)).toBe(false);
    for (const surface of firstMaterials) expect(secondMaterials.has(surface)).toBe(false);

    const geometrySpies = [...secondGeometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...secondMaterials].map((surface) => vi.spyOn(surface, 'dispose'));
    disposeBattleResources(first);
    for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).not.toHaveBeenCalled();
    disposeBattleResources(second);
    for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).toHaveBeenCalledTimes(1);
  });
});
