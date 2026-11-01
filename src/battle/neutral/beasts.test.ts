import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../resources';
import { createBeastsMonsterModel } from './beasts';

const BEAST_IDS = ['direBear', 'manticore'] as const;
const SIDES = ['attacker', 'defender'] as const;

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

function silhouette(model: THREE.Group): string {
  return meshes(model).map((mesh) => [
    mesh.geometry.type,
    ...mesh.position.toArray(),
    ...mesh.scale.toArray(),
    ...mesh.rotation.toArray().slice(0, 3),
  ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(',')).join('|');
}

describe('neutral beast models', () => {
  it.each(BEAST_IDS)('creates only the exact %s ID with neutral ground-pivot metadata', (id) => {
    const model = createBeastsMonsterModel(id, 'attacker')!;
    expect(model).toBeInstanceOf(THREE.Group);
    expect(model.name).toBe(`creature-${id}`);
    expect(model.userData.creatureId).toBe(id);
    expect(model.userData.faction).toBe('Neutral');
    expect(model.userData.side).toBe('attacker');
    expect(model.userData.animationPivot).toBe('ground');
    expect(model.userData.palette).toHaveLength(3);
    expect(model.userData.factionColor).toBe(model.userData.palette[0]);
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    expect(model.scale.toArray()).toEqual([1, 1, 1]);
  });

  it.each(['unknown', 'militia', 'royalLion', '__proto__', 'constructor', 'toString'])('returns null for %s', (id) => {
    expect(createBeastsMonsterModel(id, 'attacker')).toBeNull();
  });

  it('gives the bear and manticore distinct, recognizable anatomy', () => {
    const bear = createBeastsMonsterModel('direBear', 'attacker')!;
    const manticore = createBeastsMonsterModel('manticore', 'attacker')!;
    expect(bear.getObjectByName('direBear-shoulder-hump')).toBeInstanceOf(THREE.Mesh);
    expect(bear.getObjectByName('direBear-muzzle')).toBeInstanceOf(THREE.Mesh);
    expect(meshes(bear).filter((mesh) => mesh.name.includes('paw'))).toHaveLength(4);
    expect(meshes(manticore).filter((mesh) => mesh.userData.anatomy === 'wing')).toHaveLength(2);
    expect(manticore.getObjectByName('manticore-lion-body')).toBeInstanceOf(THREE.Mesh);
    expect(manticore.getObjectByName('manticore-scorpion-stinger')).toBeInstanceOf(THREE.Mesh);
    expect(meshes(manticore).filter((mesh) => mesh.name.startsWith('manticore-tail-segment-'))).toHaveLength(5);
    expect(silhouette(bear)).not.toBe(silhouette(manticore));
  });

  it.each(BEAST_IDS)('keeps %s finite, grounded, compact, shadowed, and ring-free on both sides', (id) => {
    for (const side of SIDES) {
      const model = createBeastsMonsterModel(id, side)!;
      const modelMeshes = meshes(model);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      expect(modelMeshes.length).toBeGreaterThan(20);
      expect(bounds.isEmpty()).toBe(false);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
      expect(bounds.max.y).toBeGreaterThan(0.9);
      expect(bounds.max.y).toBeLessThan(2.2);
      expect(Math.max(size.x, size.z)).toBeLessThan(3);
      expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
      expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
      expect(model.rotation.y).toBe(side === 'defender' ? Math.PI : 0);
      expect(model.getObjectByName('faction-ring')).toBeUndefined();
      for (const mesh of modelMeshes) {
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
        expect(mesh.name).not.toContain('ring');
        const positions = mesh.geometry.getAttribute('position');
        expect(positions.count).toBeGreaterThan(0);
        for (const value of positions.array) expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it.each(BEAST_IDS)('supports recursive raycast picking for %s', (id) => {
    for (const side of SIDES) {
      const model = createBeastsMonsterModel(id, side)!;
      model.updateMatrixWorld(true);
      const raycaster = new THREE.Raycaster(new THREE.Vector3(3, 0.7, 0), new THREE.Vector3(-1, 0, 0));
      expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
    }
  });

  it.each(BEAST_IDS)('owns independent resources and disposes %s without affecting another instance', (id) => {
    const first = createBeastsMonsterModel(id, 'attacker')!;
    const second = createBeastsMonsterModel(id, 'attacker')!;
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
    disposeBattleResources(first);
    for (const spy of firstSpies) expect(spy).toHaveBeenCalledTimes(1);
    for (const spy of secondSpies) expect(spy).not.toHaveBeenCalled();
  });
});
