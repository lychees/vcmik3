import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createHuntersLodgeModel } from './huntersLodge';

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
  for (const mesh of meshes(model)) {
    geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) materials.add(material);
  }
  return { geometries, materials };
}

function dispose(model: THREE.Group): void {
  const modelResources = resources(model);
  for (const geometry of modelResources.geometries) geometry.dispose();
  for (const material of modelResources.materials) material.dispose();
}

describe('hunters lodge landmark model', () => {
  it('creates a grounded landmark with timber, trophies, pelts, and woodland details', () => {
    const model = createHuntersLodgeModel();
    const modelMeshes = meshes(model);
    expect(model.name).toBe('huntersLodge');
    expect(model.userData.landmarkId).toBe('huntersLodge');
    expect(model.userData.kind).toBe('landmark');
    expect(model.userData.animationPivot).toBe('ground');
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    expect(model.scale.toArray()).toEqual([1, 1, 1]);
    expect(model.getObjectByName('lodge-foundation')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('lodge-roof-left')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('lodge-roof-right')).toBeInstanceOf(THREE.Mesh);
    expect(modelMeshes.filter((mesh) => mesh.name.includes('timber')).length).toBeGreaterThanOrEqual(7);
    expect(modelMeshes.filter((mesh) => mesh.name.includes('trophy')).length).toBeGreaterThanOrEqual(8);
    expect(modelMeshes.filter((mesh) => mesh.userData.detail === 'pelt')).toHaveLength(2);
    expect(modelMeshes.filter((mesh) => /pine|firewood/.test(mesh.name)).length).toBeGreaterThanOrEqual(10);
    expect(modelMeshes.length).toBeGreaterThan(35);
    expect(model.getObjectByName('faction-ring')).toBeUndefined();
    expect(model.getObjectByName('ground-marker')).toBeUndefined();
  });

  it('uses finite, compact, shadowed geometry with a ground-level foundation', () => {
    const model = createHuntersLodgeModel();
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(bounds.max.y).toBeGreaterThan(1.3);
    expect(bounds.max.y).toBeLessThan(1.8);
    expect(size.x).toBeLessThan(2.5);
    expect(size.z).toBeLessThan(2.5);
    for (const mesh of meshes(model)) {
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
      const positions = mesh.geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
      for (const value of positions.array) expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('can be picked through its front facade with an ordinary recursive raycast', () => {
    const model = createHuntersLodgeModel();
    model.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0.45, 4), new THREE.Vector3(0, 0, -1));
    const hits = raycaster.intersectObject(model, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.object).toBeInstanceOf(THREE.Mesh);
  });

  it('owns independent geometry and materials and disposes only its own resources', () => {
    const first = createHuntersLodgeModel();
    const second = createHuntersLodgeModel();
    const firstResources = resources(first);
    const secondResources = resources(second);
    for (const geometry of firstResources.geometries) expect(secondResources.geometries.has(geometry)).toBe(false);
    for (const material of firstResources.materials) expect(secondResources.materials.has(material)).toBe(false);

    const firstSpies = [
      ...[...firstResources.geometries].map((geometry) => vi.spyOn(geometry, 'dispose')),
      ...[...firstResources.materials].map((material) => vi.spyOn(material, 'dispose')),
    ];
    const secondSpies = [
      ...[...secondResources.geometries].map((geometry) => vi.spyOn(geometry, 'dispose')),
      ...[...secondResources.materials].map((material) => vi.spyOn(material, 'dispose')),
    ];
    dispose(first);
    for (const spy of firstSpies) expect(spy).toHaveBeenCalledTimes(1);
    for (const spy of secondSpies) expect(spy).not.toHaveBeenCalled();
  });
});
