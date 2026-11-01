import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../resources';
import { createSwarmMonsterModel } from './swarm';

const IDS = ['ratling', 'broodMother'] as const;

function build(id: string): THREE.Group {
  const model = createSwarmMonsterModel(id, 'attacker');
  if (!model) throw new Error(`Missing swarm model: ${id}`);
  return model;
}

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

function silhouette(model: THREE.Object3D): string {
  return meshes(model).map((mesh) => [
    mesh.geometry.type,
    ...mesh.position.toArray(),
    ...mesh.scale.toArray(),
    mesh.quaternion.toArray().join(','),
  ].join(':')).join('|');
}

describe('swarm monster models', () => {
  it('accepts only ratling and broodMother, never unknown or inherited IDs', () => {
    for (const side of ['attacker', 'defender'] as const) {
      for (const id of IDS) expect(createSwarmMonsterModel(id, side)).toBeInstanceOf(THREE.Group);
      for (const id of [
        '', 'rat', 'Ratling', 'militia', 'dragon', 'basilisk', 'royalLion',
        'constructor', 'toString', '__proto__', 'hasOwnProperty',
      ]) {
        expect(createSwarmMonsterModel(id, side)).toBeNull();
      }
    }
  });

  it.each(IDS)('builds %s with finite geometry, grounded bounds, and battle metadata', (id) => {
    const model = build(id);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(model.name).toBe(`creature-${id}`);
    expect(model.userData.creatureId).toBe(id);
    expect(model.userData.faction).toBe('Neutral');
    expect(model.userData.animationPivot).toBe('ground');
    expect(model.userData.side).toBe('attacker');
    expect(model.userData.palette).toHaveLength(3);
    expect(model.userData.factionColor).toBe(model.userData.palette[0]);
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    expect(model.rotation.y).toBe(0);
    expect(model.getObjectByName('faction-ring')).toBeUndefined();
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.025);
    expect(bounds.max.y).toBeGreaterThan(1);
    expect(bounds.max.y).toBeLessThan(2.5);
    expect(size.x).toBeLessThan(3.2);
    expect(size.z).toBeLessThan(2.2);
    expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(model.userData.labelHeight).toBeCloseTo(bounds.max.y + 0.45, 6);

    const modelMeshes = meshes(model);
    expect(modelMeshes.length).toBeGreaterThan(25);
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
  });

  it('gives the scavenger and brood queen distinct anatomy and silhouettes', () => {
    const ratling = build('ratling');
    const broodMother = build('broodMother');
    expect(silhouette(ratling)).not.toBe(silhouette(broodMother));
    expect(ratling.userData.archetype).not.toBe(broodMother.userData.archetype);
    expect(ratling.getObjectByName('ratling-tail')).toBeInstanceOf(THREE.Mesh);
    expect(ratling.getObjectByName('ratling-dagger')).toBeInstanceOf(THREE.Mesh);
    expect(ratling.getObjectByName('ratling-snout')).toBeInstanceOf(THREE.Mesh);
    expect(broodMother.getObjectByName('broodMother-tail')).toBeInstanceOf(THREE.Mesh);
    expect(meshes(broodMother).filter((mesh) => mesh.name.startsWith('broodMother-leg-'))).toHaveLength(12);
    expect(meshes(broodMother).filter((mesh) => mesh.name === 'broodMother-brood-sac')).toHaveLength(6);
    expect(meshes(broodMother).filter((mesh) => mesh.name === 'broodMother-crown')).toHaveLength(3);
    expect(new THREE.Box3().setFromObject(broodMother).max.y).toBeGreaterThan(new THREE.Box3().setFromObject(ratling).max.y);
  });

  it.each(IDS)('preserves defender facing and supports recursive raycast picking for %s', (id) => {
    for (const side of ['attacker', 'defender'] as const) {
      const model = createSwarmMonsterModel(id, side);
      if (!model) throw new Error(`Missing swarm model: ${id}`);
      expect(model.userData.side).toBe(side);
      expect(model.rotation.y).toBe(side === 'attacker' ? 0 : Math.PI);
      model.updateMatrixWorld(true);
      const center = new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
      const raycaster = new THREE.Raycaster(new THREE.Vector3(center.x, center.y, 4), new THREE.Vector3(0, 0, -1));
      const hits = raycaster.intersectObject(model, true);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]!.object).toBeInstanceOf(THREE.Mesh);
    }
  });

  it.each(IDS)('owns independent geometry and materials and disposes %s exactly once', (id) => {
    const first = build(id);
    const second = build(id);
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
