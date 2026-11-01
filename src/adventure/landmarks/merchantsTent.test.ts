import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../../battle/resources';
import { createMerchantsTentModel } from './merchantsTent';

function meshes(model: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) result.push(child);
  });
  return result;
}

function geometrySet(model: THREE.Object3D): Set<THREE.BufferGeometry> {
  return new Set(meshes(model).map((mesh) => mesh.geometry));
}

function materialSet(model: THREE.Object3D): Set<THREE.Material> {
  const result = new Set<THREE.Material>();
  for (const mesh of meshes(model)) {
    const surfaces = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const surface of surfaces) result.add(surface);
  }
  return result;
}

describe('merchantsTent model', () => {
  it('builds a recognizable market tent with canopy, crates, scales, and trade goods', () => {
    const model = createMerchantsTentModel();
    expect(model).toBeInstanceOf(THREE.Group);
    expect(model.name).toBe('merchantsTent');
    expect(model.userData.landmarkId).toBe('merchantsTent');
    expect(model.userData.animationPivot).toBe('ground');
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    expect(model.getObjectByName('faction-ring')).toBeUndefined();

    const canopy = model.getObjectByName('merchant-canopy');
    const crates = model.getObjectByName('merchant-crates');
    const scales = model.getObjectByName('merchant-scales');
    const goods = model.getObjectByName('merchant-trade-goods');
    expect(canopy).toBeInstanceOf(THREE.Group);
    expect(crates).toBeInstanceOf(THREE.Group);
    expect(scales).toBeInstanceOf(THREE.Group);
    expect(goods).toBeInstanceOf(THREE.Group);
    expect(meshes(canopy!).filter((mesh) => mesh.name === 'canopy-roof-panel')).toHaveLength(16);
    expect(meshes(canopy!).some((mesh) => (mesh.material as THREE.MeshStandardMaterial).side === THREE.DoubleSide)).toBe(true);
    expect(meshes(crates!).length).toBe(14);
    expect(meshes(scales!).filter((mesh) => mesh.name === 'scales-pan')).toHaveLength(2);
    expect(meshes(scales!).filter((mesh) => mesh.name === 'scales-chain')).toHaveLength(4);
    expect(meshes(goods!).filter((mesh) => mesh.name === 'trade-coins').length).toBeGreaterThanOrEqual(6);
    expect(meshes(goods!).filter((mesh) => mesh.name === 'trade-gems')).toHaveLength(3);
    expect(goods!.getObjectByName('trade-jar')).toBeInstanceOf(THREE.Mesh);
    expect(goods!.getObjectByName('trade-cloth')).toBeInstanceOf(THREE.Mesh);
  });

  it('uses finite raycastable geometry within grounded adventure-map bounds', () => {
    const model = createMerchantsTentModel();
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.025);
    expect(bounds.max.y).toBeGreaterThan(1.4);
    expect(bounds.max.y).toBeLessThan(2.5);
    expect(size.x).toBeLessThan(2.8);
    expect(size.z).toBeLessThan(2);
    expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(model.userData.labelHeight).toBeCloseTo(bounds.max.y + 0.45, 6);

    const modelMeshes = meshes(model);
    expect(modelMeshes.length).toBeGreaterThan(60);
    for (const mesh of modelMeshes) {
      const positions = mesh.geometry.getAttribute('position');
      const normals = mesh.geometry.getAttribute('normal');
      expect(positions.count).toBeGreaterThan(0);
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
      expect(normals.count).toBe(positions.count);
      expect(Array.from(normals.array).every(Number.isFinite)).toBe(true);
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
    }

    model.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0.8, 3), new THREE.Vector3(0, 0, -1));
    const hits = raycaster.intersectObject(model, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.object).toBeInstanceOf(THREE.Mesh);
  });

  it('owns independent resources and disposes the complete model exactly once', () => {
    const first = createMerchantsTentModel();
    const second = createMerchantsTentModel();
    const firstGeometries = geometrySet(first);
    const secondGeometries = geometrySet(second);
    const firstMaterials = materialSet(first);
    const secondMaterials = materialSet(second);
    for (const geometry of firstGeometries) expect(secondGeometries.has(geometry)).toBe(false);
    for (const surface of firstMaterials) expect(secondMaterials.has(surface)).toBe(false);

    const firstGeometrySpies = [...firstGeometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const firstMaterialSpies = [...firstMaterials].map((surface) => vi.spyOn(surface, 'dispose'));
    const secondGeometrySpies = [...secondGeometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const secondMaterialSpies = [...secondMaterials].map((surface) => vi.spyOn(surface, 'dispose'));
    disposeBattleResources(first);
    for (const spy of [...firstGeometrySpies, ...firstMaterialSpies]) expect(spy).toHaveBeenCalledTimes(1);
    for (const spy of [...secondGeometrySpies, ...secondMaterialSpies]) expect(spy).not.toHaveBeenCalled();
    expect(meshes(second).every((mesh) => mesh.geometry.getAttribute('position').count > 0)).toBe(true);
    disposeBattleResources(second);
  });
});
