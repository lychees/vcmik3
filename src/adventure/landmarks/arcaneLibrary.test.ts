import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createArcaneLibraryModel } from './arcaneLibrary';

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

function dispose(model: THREE.Object3D): void {
  const { geometries, materials } = resources(model);
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

describe('arcane library landmark', () => {
  it('builds grounded library architecture with books, spires, magical details, and safe bounds', () => {
    const model = createArcaneLibraryModel();
    expect(model).toBeInstanceOf(THREE.Group);
    expect(model.name).toBe('arcane-library');
    expect(model.userData.landmarkId).toBe('arcaneLibrary');
    expect(model.userData.kind).toBe('landmark');
    expect(model.userData.animationPivot).toBe('ground');
    expect(model.userData.raycastable).toBe(true);
    expect(model.position.toArray()).toEqual([0, 0, 0]);

    const allMeshes = meshes(model);
    expect(allMeshes.length).toBeGreaterThan(45);
    for (const mesh of allMeshes) {
      expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
    }

    expect(model.getObjectByName('arcane-library-open-book-left')).toBeInstanceOf(THREE.Group);
    expect(model.getObjectByName('arcane-library-open-book-right')).toBeInstanceOf(THREE.Group);
    expect(model.getObjectByName('arcane-library-open-book-left-pages')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('arcane-library-open-book-right-pages')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('arcane-library-floating-grimoire')).toBeInstanceOf(THREE.Group);
    expect(model.getObjectByName('arcane-library-astral-halo')).toBeInstanceOf(THREE.Mesh);

    const spires = model.children.filter((child) => child.userData.architecture === 'spire');
    expect(spires).toHaveLength(5);
    for (const spire of spires) expect(meshes(spire).length).toBeGreaterThanOrEqual(4);
    expect(allMeshes.filter((mesh) => mesh.name.startsWith('arcane-library-rune-'))).toHaveLength(4);

    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.isEmpty()).toBe(false);
    expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(bounds.min.y).toBeLessThanOrEqual(0.001);
    expect(bounds.max.y).toBeGreaterThan(1.8);
    expect(bounds.max.y).toBeLessThan(2.6);
    expect(size.x).toBeLessThan(2);
    expect(size.z).toBeLessThan(2);
    expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
    expect(model.userData.footprint).toEqual([size.x, size.z]);
  });

  it('is raycastable through its solid entrance geometry', () => {
    const model = createArcaneLibraryModel();
    model.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0.44, 3), new THREE.Vector3(0, 0, -1));
    const intersections = raycaster.intersectObject(model, true);
    expect(intersections.length).toBeGreaterThan(0);
    expect(intersections[0]?.object).toBeInstanceOf(THREE.Mesh);
    expect(intersections[0]?.distance).toBeGreaterThan(0);
  });

  it('uses independent resources and disposes each resource exactly once', () => {
    const first = createArcaneLibraryModel();
    const second = createArcaneLibraryModel();
    const firstResources = resources(first);
    const secondResources = resources(second);
    for (const geometry of secondResources.geometries) expect(firstResources.geometries.has(geometry)).toBe(false);
    for (const material of secondResources.materials) expect(firstResources.materials.has(material)).toBe(false);

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
    dispose(second);
    for (const spy of secondSpies) expect(spy).toHaveBeenCalledTimes(1);
  });
});
