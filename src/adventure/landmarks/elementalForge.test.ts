import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createElementalForgeModel } from './elementalForge';

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
  for (const mesh of meshes(root)) {
    geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) materials.add(material);
  }
  return { geometries, materials };
}

function dispose(root: THREE.Object3D): void {
  const rootResources = resources(root);
  for (const geometry of rootResources.geometries) geometry.dispose();
  for (const material of rootResources.materials) material.dispose();
}

describe('elemental forge model', () => {
  it('builds recognizable furnace, anvil, chimney, and four elemental glows', () => {
    const model = createElementalForgeModel();
    expect(model).toBeInstanceOf(THREE.Group);
    expect(model.name).toBe('elemental-forge');
    expect(model.userData.landmarkId).toBe('elementalForge');
    expect(model.userData.animationPivot).toBe('ground');
    for (const name of ['furnace', 'anvil', 'chimney']) {
      const part = model.getObjectByName(name);
      expect(part).toBeInstanceOf(THREE.Group);
      expect(part?.userData.part).toBe(name);
      expect(meshes(part!).length).toBeGreaterThan(2);
    }
    expect(model.getObjectByName('furnace-fire')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('anvil-horn')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('chimney-opening')).toBeInstanceOf(THREE.Mesh);
    const elements = meshes(model).filter((mesh) => typeof mesh.userData.element === 'string');
    expect(elements.map((mesh) => mesh.userData.element).sort()).toEqual(['air', 'earth', 'fire', 'water']);
    const glowColors = new Set(elements.map((mesh) => {
      const surface = mesh.material as THREE.MeshStandardMaterial;
      expect(surface.emissiveIntensity).toBeGreaterThan(0);
      expect(surface.emissive.getHex()).not.toBe(0);
      return surface.emissive.getHex();
    }));
    expect(glowColors.size).toBe(4);
  });

  it('is grounded, finite, bounded, shadowed, and raycast-pickable', () => {
    const model = createElementalForgeModel();
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.isEmpty()).toBe(false);
    expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(bounds.max.y).toBeGreaterThan(1.5);
    expect(bounds.max.y).toBeLessThan(2.1);
    expect(size.x).toBeLessThan(2);
    expect(size.z).toBeLessThan(2);
    expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(model.userData.labelHeight).toBeGreaterThan(bounds.max.y);
    expect(meshes(model).length).toBeGreaterThan(20);
    for (const mesh of meshes(model)) {
      expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
    }
    model.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0.65, 4), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
  });

  it('keeps resources independent across calls and disposes each resource exactly once', () => {
    const first = createElementalForgeModel();
    const second = createElementalForgeModel();
    const firstResources = resources(first);
    const secondResources = resources(second);
    expect([...firstResources.geometries].some((geometry) => secondResources.geometries.has(geometry))).toBe(false);
    expect([...firstResources.materials].some((material) => secondResources.materials.has(material))).toBe(false);
    const firstMaterial = meshes(first)[0]!.material as THREE.MeshStandardMaterial;
    const secondMaterial = meshes(second)[0]!.material as THREE.MeshStandardMaterial;
    const originalColor = secondMaterial.color.getHex();
    firstMaterial.color.setHex(0x010203);
    expect(secondMaterial.color.getHex()).toBe(originalColor);
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
    expect(secondMaterial.color.getHex()).toBe(originalColor);
    dispose(second);
    for (const spy of secondSpies) expect(spy).toHaveBeenCalledTimes(1);
  });
});
