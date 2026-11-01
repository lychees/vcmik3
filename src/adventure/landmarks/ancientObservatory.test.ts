import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../../battle/resources';
import { createAncientObservatoryModel } from './ancientObservatory';

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
  for (const part of meshes(model)) {
    geometries.add(part.geometry);
    for (const surface of Array.isArray(part.material) ? part.material : [part.material]) materials.add(surface);
  }
  return { geometries, materials };
}

describe('ancient observatory landmark', () => {
  it('builds a grounded observatory with a dome, telescope and celestial instruments', () => {
    const model = createAncientObservatoryModel();
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(model.name).toBe('ancientObservatory');
    expect(model.userData).toMatchObject({
      landmarkId: 'ancientObservatory',
      kind: 'landmark',
      animationPivot: 'ground',
    });
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    expect(model.getObjectByName('faction-ring')).toBeUndefined();
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(bounds.max.y).toBeGreaterThan(1.6);
    expect(bounds.max.y).toBeLessThan(2.2);
    expect(size.x).toBeLessThan(1.8);
    expect(size.z).toBeLessThan(1.8);
    expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(model.userData.labelHeight).toBeGreaterThan(bounds.max.y);
    expect(meshes(model).length).toBeGreaterThan(25);
    expect(meshes(model).length).toBeLessThan(45);

    const dome = model.getObjectByName('observatory-dome') as THREE.Mesh;
    expect(dome.geometry).toBeInstanceOf(THREE.SphereGeometry);
    expect((dome.geometry as THREE.SphereGeometry).parameters.thetaLength).toBe(Math.PI / 2);
    expect(model.getObjectByName('observatory-telescope')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('observatory-telescope-lens')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('observatory-dome-slit')).toBeInstanceOf(THREE.Mesh);
    expect(meshes(model).filter((part) => part.name.startsWith('observatory-star-'))).toHaveLength(3);
    expect(meshes(model).filter((part) => part.name.startsWith('observatory-orrery-ring-'))).toHaveLength(3);
    expect(model.getObjectByName('observatory-crescent')).toBeInstanceOf(THREE.Mesh);
  });

  it('uses finite geometry and shadow-enabled solid parts', () => {
    const model = createAncientObservatoryModel();
    for (const part of meshes(model)) {
      expect(part.castShadow).toBe(true);
      expect(part.receiveShadow).toBe(true);
      part.geometry.computeBoundingBox();
      expect(part.geometry.boundingBox!.isEmpty()).toBe(false);
      const positions = part.geometry.getAttribute('position');
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
    }
  });

  it('supports raycast picking from above and from the front', () => {
    const model = createAncientObservatoryModel();
    model.updateMatrixWorld(true);
    const rays = [
      new THREE.Raycaster(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, -1, 0)),
      new THREE.Raycaster(new THREE.Vector3(0, 0.65, 3), new THREE.Vector3(0, 0, -1)),
    ];
    for (const ray of rays) {
      const hits = ray.intersectObject(model, true);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]!.object).toBeInstanceOf(THREE.Mesh);
    }
  });

  it('owns independent resources and disposes one model without affecting another', () => {
    const first = createAncientObservatoryModel();
    const second = createAncientObservatoryModel();
    const firstResources = resources(first);
    const secondResources = resources(second);
    for (const geometry of firstResources.geometries) expect(secondResources.geometries.has(geometry)).toBe(false);
    for (const surface of firstResources.materials) expect(secondResources.materials.has(surface)).toBe(false);
    const firstSpies = [
      ...[...firstResources.geometries].map((geometry) => vi.spyOn(geometry, 'dispose')),
      ...[...firstResources.materials].map((surface) => vi.spyOn(surface, 'dispose')),
    ];
    const secondSpies = [
      ...[...secondResources.geometries].map((geometry) => vi.spyOn(geometry, 'dispose')),
      ...[...secondResources.materials].map((surface) => vi.spyOn(surface, 'dispose')),
    ];
    disposeBattleResources(first);
    for (const spy of firstSpies) expect(spy).toHaveBeenCalledTimes(1);
    for (const spy of secondSpies) expect(spy).not.toHaveBeenCalled();
    disposeBattleResources(second);
  });
});
