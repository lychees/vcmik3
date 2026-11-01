import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createWaterwheelModel } from './waterwheel';

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) result.push(child);
  });
  return result;
}

function resources(root: THREE.Object3D): { geometries: Set<THREE.BufferGeometry>; materials: Set<THREE.Material> } {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const child of meshes(root)) {
    geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    for (const surface of childMaterials) materials.add(surface);
  }
  return { geometries, materials };
}

function dispose(root: THREE.Object3D): void {
  const owned = resources(root);
  for (const geometry of owned.geometries) geometry.dispose();
  for (const surface of owned.materials) surface.dispose();
}

describe('waterwheel landmark model', () => {
  it('creates a raw grounded landmark with integration metadata', () => {
    const root = createWaterwheelModel();
    expect(root).toBeInstanceOf(THREE.Group);
    expect(root.name).toBe('waterwheel');
    expect(root.userData.landmarkId).toBe('waterwheel');
    expect(root.userData.animationPivot).toBe('ground');
    expect(root.position.toArray()).toEqual([0, 0, 0]);
    expect(root.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
    expect(root.getObjectByName('faction-ring')).toBeUndefined();
  });

  it('includes a mill, rotating wheel, twelve paddles, axle, and flowing water details', () => {
    const root = createWaterwheelModel();
    const mill = root.getObjectByName('waterwheel-mill');
    const wheel = root.getObjectByName('waterwheel-wheel');
    const water = root.getObjectByName('waterwheel-water');
    expect(mill).toBeInstanceOf(THREE.Group);
    expect(wheel).toBeInstanceOf(THREE.Group);
    expect(water).toBeInstanceOf(THREE.Mesh);
    expect(root.getObjectByName('waterwheel-mill-roof')).toBeInstanceOf(THREE.Mesh);
    expect(root.getObjectByName('waterwheel-mill-door')).toBeInstanceOf(THREE.Mesh);
    expect(root.getObjectByName('waterwheel-axle')).toBeInstanceOf(THREE.Mesh);
    expect(root.getObjectByName('waterwheel-wheel-rim-front')).toBeInstanceOf(THREE.Mesh);
    expect(root.getObjectByName('waterwheel-wheel-hub')).toBeInstanceOf(THREE.Mesh);
    expect(wheel?.userData.animationAxis).toBe('z');
    const paddles = wheel?.children.filter((child) => child.userData.anatomy === 'paddle') ?? [];
    expect(paddles).toHaveLength(12);
    for (const paddle of paddles) {
      expect(paddle).toBeInstanceOf(THREE.Mesh);
      expect(paddle.name).toMatch(/^waterwheel-paddle-\d+$/);
    }
    expect((water as THREE.Mesh).geometry.getAttribute('position').count).toBeGreaterThan(0);
    expect(((water as THREE.Mesh).material as THREE.MeshStandardMaterial).transparent).toBe(true);
    expect(meshes(root).filter((child) => child.name.startsWith('waterwheel-foam-')).length).toBeGreaterThanOrEqual(5);
  });

  it('has finite geometry, safe ground-pivot bounds, and a raycastable silhouette', () => {
    const root = createWaterwheelModel();
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(size.y).toBeGreaterThan(1);
    expect(size.y).toBeLessThan(2);
    expect(size.x).toBeLessThan(2.5);
    expect(size.z).toBeLessThan(2.5);
    expect(root.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(root.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
    for (const child of meshes(root)) {
      const positions = child.geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
      expect(child.geometry.getAttribute('normal')).toBeDefined();
      expect(child.castShadow).toBe(true);
    }
    const center = bounds.getCenter(new THREE.Vector3());
    const origin = center.clone().add(new THREE.Vector3(3, 1.2, 4));
    const raycaster = new THREE.Raycaster(origin, center.clone().sub(origin).normalize());
    expect(raycaster.intersectObject(root, true).length).toBeGreaterThan(0);
  });

  it('does not share geometry or materials between instances', () => {
    const first = resources(createWaterwheelModel());
    const second = resources(createWaterwheelModel());
    for (const geometry of first.geometries) expect(second.geometries.has(geometry)).toBe(false);
    for (const surface of first.materials) expect(second.materials.has(surface)).toBe(false);
  });

  it('disposes each unique geometry and material exactly once despite shared wheel parts', () => {
    const root = createWaterwheelModel();
    const owned = resources(root);
    const geometrySpies = [...owned.geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...owned.materials].map((surface) => vi.spyOn(surface, 'dispose'));
    dispose(root);
    for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).toHaveBeenCalledTimes(1);
  });
});
