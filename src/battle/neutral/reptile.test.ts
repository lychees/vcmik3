import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../resources';
import { createReptileMonsterModel } from './reptile';

const REPTILE_IDS = ['hydra', 'basiliskKing'] as const;

function getMeshes(group: THREE.Group): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) result.push(child);
  });
  return result;
}

function getMaterials(group: THREE.Group): Set<THREE.Material> {
  const result = new Set<THREE.Material>();
  for (const mesh of getMeshes(group)) {
    const surfaces = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const surface of surfaces) result.add(surface);
  }
  return result;
}

function geometrySignature(group: THREE.Group): string {
  return getMeshes(group).map((mesh) => [
    mesh.geometry.type,
    ...mesh.position.toArray(),
    ...mesh.scale.toArray(),
    ...mesh.quaternion.toArray(),
  ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(':')).join('|');
}

function expectIndependentDisposal(first: THREE.Group, second: THREE.Group): void {
  const firstGeometries = new Set(getMeshes(first).map((mesh) => mesh.geometry));
  const secondGeometries = new Set(getMeshes(second).map((mesh) => mesh.geometry));
  const firstMaterials = getMaterials(first);
  const secondMaterials = getMaterials(second);
  for (const geometry of firstGeometries) expect(secondGeometries.has(geometry)).toBe(false);
  for (const surface of firstMaterials) expect(secondMaterials.has(surface)).toBe(false);

  const geometrySpies = [...secondGeometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
  const materialSpies = [...secondMaterials].map((surface) => vi.spyOn(surface, 'dispose'));
  disposeBattleResources(first);
  for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).not.toHaveBeenCalled();
  disposeBattleResources(second);
  for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).toHaveBeenCalledTimes(1);
}

describe('reptile neutral monster models', () => {
  it.each(REPTILE_IDS)('builds only the exact %s ID with raw metadata and defender facing', (id) => {
    for (const side of ['attacker', 'defender'] as const) {
      const model = createReptileMonsterModel(id, side);
      expect(model).toBeInstanceOf(THREE.Group);
      expect(model?.name).toBe(`creature-${id}`);
      expect(model?.userData).toMatchObject({
        creatureId: id,
        faction: 'Neutral',
        animationPivot: 'ground',
        side,
      });
      expect(model?.position.toArray()).toEqual([0, 0, 0]);
      expect(model?.rotation.y).toBe(side === 'attacker' ? 0 : Math.PI);
      expect(model?.getObjectByName('faction-ring')).toBeUndefined();
      expect(model?.userData.palette).toHaveLength(3);
    }
  });

  it('returns null for unknown, inherited, and existing non-reptile IDs', () => {
    for (const id of [
      'basilisk', 'dragon', 'unknown', 'Hydra', 'basiliskking', '__proto__', 'constructor', 'toString', 'valueOf', '',
    ]) {
      expect(createReptileMonsterModel(id, 'attacker')).toBeNull();
    }
  });

  it('gives the hydra three heads and the basilisk king a distinct crown and hood', () => {
    const hydra = createReptileMonsterModel('hydra', 'attacker')!;
    const basiliskKing = createReptileMonsterModel('basiliskKing', 'attacker')!;
    expect(getMeshes(hydra).filter((mesh) => mesh.userData.anatomy === 'head')).toHaveLength(3);
    expect(getMeshes(hydra).filter((mesh) => mesh.userData.anatomy === 'neck')).toHaveLength(3);
    expect(basiliskKing.getObjectByName('basilisk-king-crown')).toBeInstanceOf(THREE.Group);
    expect(basiliskKing.getObjectByName('basilisk-king-hood')).toBeInstanceOf(THREE.Mesh);
    expect(getMeshes(basiliskKing).filter((mesh) => mesh.name.startsWith('basilisk-king-crown-spike-'))).toHaveLength(5);
    expect(geometrySignature(hydra)).not.toBe(geometrySignature(basiliskKing));
    disposeBattleResources(hydra);
    disposeBattleResources(basiliskKing);
  });

  it.each(REPTILE_IDS)('%s has finite geometry, grounded safe bounds, and body picking', (id) => {
    const model = createReptileMonsterModel(id, 'attacker')!;
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(bounds.max.y).toBeGreaterThan(1.2);
    expect(bounds.max.y).toBeLessThan(2.75);
    expect(size.x).toBeLessThan(3.4);
    expect(size.z).toBeLessThan(2.4);
    expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(model.userData.labelHeight).toBeGreaterThan(bounds.max.y);
    for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    for (const mesh of getMeshes(model)) {
      const positions = mesh.geometry.getAttribute('position');
      expect(positions).toBeDefined();
      expect(positions.array.every(Number.isFinite)).toBe(true);
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
    }
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(0, 8, 0),
      new THREE.Vector3(0, -1, 0),
    );
    expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
    disposeBattleResources(model);
  });

  it.each(REPTILE_IDS)('%s owns independent, exactly-once disposable resources', (id) => {
    const first = createReptileMonsterModel(id, 'attacker')!;
    const second = createReptileMonsterModel(id, 'defender')!;
    expectIndependentDisposal(first, second);
  });
});
