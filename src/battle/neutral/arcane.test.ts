import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../resources';
import { createArcaneMonsterModel } from './arcane';

const ARCANE_IDS = ['golem', 'beholder'] as const;

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

function silhouette(model: THREE.Group): string {
  return meshes(model).map((part) => [
    part.geometry.type,
    ...part.position.toArray(),
    ...part.scale.toArray(),
    ...part.rotation.toArray().slice(0, 3),
  ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(',')).join('|');
}

describe('arcane neutral monster models', () => {
  it.each(ARCANE_IDS)('builds %s as a bounded, grounded, ring-free neutral creature', (id) => {
    const model = createArcaneMonsterModel(id, 'attacker');
    expect(model).toBeInstanceOf(THREE.Group);
    if (!model) return;
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(model.name).toBe(`creature-${id}`);
    expect(model.userData).toMatchObject({
      creatureId: id,
      faction: 'Neutral',
      side: 'attacker',
      animationPivot: 'ground',
      factionColor: model.userData.palette[0],
    });
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    expect(model.rotation.y).toBe(0);
    expect(model.getObjectByName('faction-ring')).toBeUndefined();
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(bounds.max.y).toBeGreaterThan(1.8);
    expect(bounds.max.y).toBeLessThan(2.6);
    expect(size.x).toBeLessThan(2);
    expect(size.z).toBeLessThan(2);
    expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
    expect(meshes(model).length).toBeGreaterThan(20);
    expect(meshes(model).length).toBeLessThan(45);
    for (const part of meshes(model)) {
      expect(part.castShadow).toBe(true);
      expect(part.receiveShadow).toBe(true);
      const positions = part.geometry.getAttribute('position');
      expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
    }
  });

  it('returns null instead of inheriting another faction or an unknown creature', () => {
    for (const id of ['', 'unknown', 'militia', 'juggernaut', 'stoneGargoyle', 'beholder ', '__proto__', 'toString']) {
      expect(createArcaneMonsterModel(id, 'attacker')).toBeNull();
    }
  });

  it('gives golem and beholder distinct silhouettes and recognizable anatomy', () => {
    const golem = createArcaneMonsterModel('golem', 'attacker')!;
    const beholder = createArcaneMonsterModel('beholder', 'attacker')!;
    expect(silhouette(golem)).not.toBe(silhouette(beholder));
    expect(golem.userData.palette).not.toEqual(beholder.userData.palette);
    expect(golem.getObjectByName('golem-core')).toBeInstanceOf(THREE.Mesh);
    expect(golem.getObjectByName('golem-crown-crystal')).toBeInstanceOf(THREE.Mesh);
    expect(golem.getObjectByName('golem-fist--1')).toBeInstanceOf(THREE.Mesh);
    expect(golem.getObjectByName('golem-fist-1')).toBeInstanceOf(THREE.Mesh);
    expect(beholder.getObjectByName('beholder-eye')).toBeInstanceOf(THREE.Mesh);
    expect(beholder.getObjectByName('beholder-pupil')).toBeInstanceOf(THREE.Mesh);
    expect(meshes(beholder).filter((part) => part.name.startsWith('beholder-eyestalk-'))).toHaveLength(6);
    expect(meshes(beholder).filter((part) => part.name.startsWith('beholder-tendril-'))).toHaveLength(8);
  });

  it('faces defenders without adding a battle ring', () => {
    const model = createArcaneMonsterModel('beholder', 'defender')!;
    expect(model.userData.side).toBe('defender');
    expect(model.rotation.y).toBe(Math.PI);
    expect(model.getObjectByName('faction-ring')).toBeUndefined();
  });

  it.each(ARCANE_IDS)('supports direct raycast picking for %s', (id) => {
    const model = createArcaneMonsterModel(id, 'attacker')!;
    model.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(3, 1.25, 0), new THREE.Vector3(-1, 0, 0));
    const hits = raycaster.intersectObject(model, true);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]!.object).toBeInstanceOf(THREE.Mesh);
    expect(hits[0]!.point.y).toBeCloseTo(1.25, 5);
  });

  it.each(ARCANE_IDS)('owns independent, completely disposable resources for %s', (id) => {
    const first = createArcaneMonsterModel(id, 'attacker')!;
    const second = createArcaneMonsterModel(id, 'attacker')!;
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
