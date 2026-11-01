import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../resources';
import { createInfernalMonsterModel } from './infernal';

const IDS = ['cerberus', 'balor'] as const;

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

function silhouette(model: THREE.Group): string {
  return meshes(model).map((mesh) => [
    mesh.geometry.type,
    ...mesh.position.toArray(),
    ...mesh.scale.toArray(),
    ...mesh.rotation.toArray().slice(0, 3),
  ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(',')).join('|');
}

describe('Infernal monster models', () => {
  it.each(IDS)('creates grounded, bounded, ring-free %s models for both sides', (id) => {
    for (const side of ['attacker', 'defender'] as const) {
      const model = createInfernalMonsterModel(id, side);
      expect(model).toBeInstanceOf(THREE.Group);
      if (!model) return;
      expect(model.name).toBe(`creature-${id}`);
      expect(model.userData.creatureId).toBe(id);
      expect(model.userData.faction).toBe('Infernal');
      expect(model.userData.side).toBe(side);
      expect(model.userData.animationPivot).toBe('ground');
      expect(model.userData.palette).toHaveLength(3);
      expect(model.userData.factionColor).toBe(model.userData.palette[0]);
      expect(model.position.toArray()).toEqual([0, 0, 0]);
      expect(model.rotation.y).toBe(side === 'attacker' ? 0 : Math.PI);
      expect(model.getObjectByName('faction-ring')).toBeUndefined();
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      expect(bounds.isEmpty()).toBe(false);
      expect([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)).toBe(true);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
      expect(bounds.max.y).toBeGreaterThan(1);
      expect(bounds.max.y).toBeLessThan(3);
      expect(size.x).toBeLessThan(3);
      expect(size.z).toBeLessThan(3);
      expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
      expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
      expect(meshes(model).length).toBeGreaterThan(15);
      for (const mesh of meshes(model)) {
        expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
      }
    }
  });

  it.each(['attacker', 'defender'] as const)('returns null for unknown, inherited, and incorrectly cased IDs for %s', (side) => {
    const inheritedIds = ['constructor', 'toString', '__proto__', 'hasOwnProperty'];
    for (const id of ['unknown', '', 'imp', 'hellhound', 'pitFiend', 'dragon', 'Cerberus', 'Balor', ...inheritedIds]) {
      expect(createInfernalMonsterModel(id, side)).toBeNull();
    }
  });

  it('gives cerberus three heads and balor a distinct winged, armed silhouette', () => {
    const cerberus = createInfernalMonsterModel('cerberus', 'attacker');
    const balor = createInfernalMonsterModel('balor', 'attacker');
    expect(cerberus).not.toBeNull();
    expect(balor).not.toBeNull();
    if (!cerberus || !balor) return;
    for (const name of ['cerberus-head-left', 'cerberus-head-center', 'cerberus-head-right']) {
      const head = cerberus.getObjectByName(name);
      expect(head).toBeInstanceOf(THREE.Group);
      expect(head?.userData.anatomy).toBe('head');
      expect(meshes(head!).length).toBeGreaterThan(5);
    }
    expect(cerberus.userData.archetype).toBe('three-headed-hound');
    expect(balor.userData.archetype).toBe('winged-fire-demon');
    const wings = meshes(balor).filter((mesh) => mesh.userData.anatomy === 'wing');
    expect(wings).toHaveLength(2);
    expect(balor.getObjectByName('balor-wing-left')?.position.z).toBeLessThan(0);
    expect(balor.getObjectByName('balor-wing-right')?.position.z).toBeGreaterThan(0);
    expect(balor.getObjectByName('balor-flame-sword')).toBeInstanceOf(THREE.Group);
    expect(balor.getObjectByName('balor-fire-whip')).toBeInstanceOf(THREE.Mesh);
    expect(silhouette(cerberus)).not.toBe(silhouette(balor));
  });

  it.each(IDS)('supports ordinary recursive raycast picking for %s', (id) => {
    const model = createInfernalMonsterModel(id, 'attacker');
    expect(model).not.toBeNull();
    if (!model) return;
    model.updateMatrixWorld(true);
    const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(4, center.y, center.z),
      new THREE.Vector3(-1, 0, 0),
    );
    expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
  });

  it.each(IDS)('creates independent geometry, materials, and metadata for each %s call', (id) => {
    const first = createInfernalMonsterModel(id, 'attacker');
    const second = createInfernalMonsterModel(id, 'attacker');
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    if (!first || !second) return;
    const firstResources = resources(first);
    const secondResources = resources(second);
    expect([...firstResources.geometries].some((geometry) => secondResources.geometries.has(geometry))).toBe(false);
    expect([...firstResources.materials].some((material) => secondResources.materials.has(material))).toBe(false);
    expect(first.userData.palette).not.toBe(second.userData.palette);
    const firstMaterial = meshes(first)[0]!.material as THREE.MeshStandardMaterial;
    const secondMaterial = meshes(second)[0]!.material as THREE.MeshStandardMaterial;
    const originalColor = secondMaterial.color.getHex();
    firstMaterial.color.setHex(0x010203);
    expect(secondMaterial.color.getHex()).toBe(originalColor);
    disposeBattleResources(first);
    expect(secondMaterial.color.getHex()).toBe(originalColor);
    expect(meshes(second)[0]!.geometry.getAttribute('position').count).toBeGreaterThan(0);
  });

  it.each(IDS)('disposes every unique %s geometry and material exactly once', (id) => {
    const model = createInfernalMonsterModel(id, 'attacker');
    expect(model).not.toBeNull();
    if (!model) return;
    const modelResources = resources(model);
    const spies = [
      ...[...modelResources.geometries].map((geometry) => vi.spyOn(geometry, 'dispose')),
      ...[...modelResources.materials].map((material) => vi.spyOn(material, 'dispose')),
    ];
    disposeBattleResources(model);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
  });
});
