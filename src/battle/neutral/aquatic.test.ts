import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../resources';
import type { BattleSideId } from '../types';
import { createAquaticMonsterModel } from './aquatic';

const IDS = ['kraken', 'seaHag'] as const;

function model(creatureId: string, side: BattleSideId = 'attacker'): THREE.Group {
  const result = createAquaticMonsterModel(creatureId, side);
  if (!result) throw new Error(`Missing aquatic model: ${creatureId}`);
  return result;
}

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

function signature(root: THREE.Object3D): string {
  return meshes(root).map((child) => [
    child.geometry.type,
    ...child.position.toArray(),
    ...child.scale.toArray(),
    ...child.rotation.toArray().slice(0, 3),
  ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(',')).join('|');
}

describe('aquatic neutral creature models', () => {
  it.each(IDS)('creates only the explicit %s ID with raw neutral metadata', (id) => {
    const attacker = model(id);
    const defender = model(id, 'defender');
    expect(attacker).toBeInstanceOf(THREE.Group);
    expect(attacker.name).toBe(`creature-${id}`);
    expect(attacker.userData.creatureId).toBe(id);
    expect(attacker.userData.faction).toBe('Neutral');
    expect(attacker.userData.animationPivot).toBe('ground');
    expect(attacker.userData.side).toBe('attacker');
    expect(attacker.userData.modelPack).toBe('aquatic');
    expect(attacker.position.toArray()).toEqual([0, 0, 0]);
    expect(attacker.rotation.y).toBe(0);
    expect(attacker.getObjectByName('faction-ring')).toBeUndefined();
    expect(defender.rotation.y).toBe(Math.PI);
    expect(defender.userData.side).toBe('defender');
    expect(defender.getObjectByName('faction-ring')).toBeUndefined();
  });

  it.each(['unknown', 'seaWitch', 'constructor', 'toString', '__proto__'])('returns null for unregistered or inherited ID %s', (id) => {
    expect(createAquaticMonsterModel(id, 'attacker')).toBeNull();
  });

  it('builds recognizable and distinct kraken and sea hag anatomy', () => {
    const kraken = model('kraken');
    const seaHag = model('seaHag');
    const tentacles: THREE.Object3D[] = [];
    kraken.traverse((child) => {
      if (child.userData.anatomy === 'tentacle') tentacles.push(child);
    });
    expect(tentacles).toHaveLength(8);
    expect(kraken.getObjectByName('kraken-mantle')).toBeInstanceOf(THREE.Mesh);
    expect(kraken.getObjectByName('kraken-beak')).toBeInstanceOf(THREE.Mesh);
    expect(kraken.getObjectByName('kraken-eye-left')).toBeInstanceOf(THREE.Mesh);
    expect(kraken.getObjectByName('kraken-eye-right')).toBeInstanceOf(THREE.Mesh);
    expect(seaHag.getObjectByName('sea-hag-robe')).toBeInstanceOf(THREE.Mesh);
    expect(seaHag.getObjectByName('sea-hag-staff')).toBeInstanceOf(THREE.Mesh);
    expect(seaHag.getObjectByName('sea-hag-pearl')).toBeInstanceOf(THREE.Mesh);
    expect(seaHag.getObjectByName('sea-hag-hair-0')).toBeInstanceOf(THREE.Mesh);
    expect(meshes(kraken).length).toBeGreaterThan(30);
    expect(meshes(seaHag).length).toBeGreaterThan(20);
    expect(signature(kraken)).not.toBe(signature(seaHag));
  });

  it.each(IDS)('keeps %s grounded, bounded, finite, and raycastable', (id) => {
    const root = model(id);
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(size.y).toBeGreaterThan(1);
    expect(size.y).toBeLessThan(2.5);
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
    const origin = center.clone().add(new THREE.Vector3(3, 1.1, 3));
    const raycaster = new THREE.Raycaster(origin, center.clone().sub(origin).normalize());
    expect(raycaster.intersectObject(root, true).length).toBeGreaterThan(0);
  });

  it.each(IDS)('allocates independent geometry and materials for every %s instance', (id) => {
    const first = model(id);
    const second = model(id);
    const firstResources = resources(first);
    const secondResources = resources(second);
    for (const geometry of firstResources.geometries) expect(secondResources.geometries.has(geometry)).toBe(false);
    for (const surface of firstResources.materials) expect(secondResources.materials.has(surface)).toBe(false);
  });

  it.each(IDS)('disposes every unique %s geometry and material exactly once', (id) => {
    const root = model(id);
    const owned = resources(root);
    const geometrySpies = [...owned.geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...owned.materials].map((surface) => vi.spyOn(surface, 'dispose'));
    disposeBattleResources(root);
    for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).toHaveBeenCalledTimes(1);
  });
});
