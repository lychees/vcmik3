import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../../battle/resources';
import { createWayfarerPortalModel } from './wayfarerPortal';

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

describe('wayfarer portal landmark model', () => {
  it('builds twin pillars, a connecting arch, and three dimensional swirling details', () => {
    const model = createWayfarerPortalModel();
    const left = model.getObjectByName('portal-pillar-left') as THREE.Mesh;
    const right = model.getObjectByName('portal-pillar-right') as THREE.Mesh;
    const arch = model.getObjectByName('portal-arch') as THREE.Mesh;
    const surface = model.getObjectByName('portal-surface') as THREE.Mesh;
    const swirls = meshes(model).filter((child) => child.userData.portalDetail === 'swirl');

    expect(model.name).toBe('landmark-wayfarerPortal');
    expect(model.userData.landmarkId).toBe('wayfarerPortal');
    expect(model.userData.objectKind).toBe('landmark');
    expect(left).toBeInstanceOf(THREE.Mesh);
    expect(right).toBeInstanceOf(THREE.Mesh);
    expect(left.position.x).toBeLessThan(0);
    expect(right.position.x).toBeGreaterThan(0);
    expect(left.position.y).toBe(right.position.y);
    expect(arch.geometry).toBeInstanceOf(THREE.TorusGeometry);
    expect(arch.position.y).toBeGreaterThan(left.position.y);
    expect(surface.geometry).toBeInstanceOf(THREE.CircleGeometry);
    expect((surface.material as THREE.MeshStandardMaterial).side).toBe(THREE.DoubleSide);
    expect(swirls).toHaveLength(3);
    expect(model.userData.swirlCount).toBe(swirls.length);
    for (const swirl of swirls) {
      expect(swirl.geometry).toBeInstanceOf(THREE.TubeGeometry);
      expect(swirl.geometry.getAttribute('position').count).toBeGreaterThan(40);
    }
  });

  it('stays grounded within landmark bounds and supports direct mesh raycasting', () => {
    const model = createWayfarerPortalModel();
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    expect(model.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(model.userData.animationPivot).toBe('ground');
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(bounds.max.y).toBeGreaterThan(2);
    expect(bounds.max.y).toBeLessThan(3);
    expect(size.x).toBeLessThan(2.2);
    expect(size.z).toBeLessThan(1);
    expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
    expect(model.getObjectByName('faction-ring')).toBeUndefined();

    for (const child of meshes(model)) {
      const positions = child.geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
    }

    model.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 1.05, 4), new THREE.Vector3(0, 0, -1));
    const hits = raycaster.intersectObject(model, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((hit) => hit.object === model.getObjectByName('portal-surface'))).toBe(true);
  });

  it('uses independent resources and disposes shared geometry and material instances once', () => {
    const first = createWayfarerPortalModel();
    const second = createWayfarerPortalModel();
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
