import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../resources';
import type { BattleSideId } from '../types';
import { createUndeadMonsterModel } from './undead';

const UNDEAD_IDS = ['lich', 'wraith'] as const;
const SIDES: readonly BattleSideId[] = ['attacker', 'defender'];
const liveModels: THREE.Group[] = [];

function createModel(creatureId: string, side: BattleSideId = 'attacker'): THREE.Group {
  const model = createUndeadMonsterModel(creatureId, side);
  if (!model) throw new Error(`Expected an undead model for ${creatureId}`);
  liveModels.push(model);
  return model;
}

function getMeshes(model: THREE.Group): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) result.push(object);
  });
  return result;
}

function getBounds(model: THREE.Group): THREE.Box3 {
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model);
}

function getResources(model: THREE.Group): {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
} {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const mesh of getMeshes(model)) {
    geometries.add(mesh.geometry);
    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of meshMaterials) materials.add(material);
  }
  return { geometries, materials };
}

function silhouette(model: THREE.Group): string {
  return getMeshes(model).map((mesh) => [
    mesh.geometry.type,
    mesh.geometry.getAttribute('position').count,
    ...mesh.position.toArray(),
    ...mesh.scale.toArray(),
    ...mesh.rotation.toArray().slice(0, 3),
  ].join(',')).join('|');
}

afterEach(() => {
  for (const model of liveModels) disposeBattleResources(model);
  liveModels.length = 0;
});

describe('undead neutral monster models', () => {
  it.each(UNDEAD_IDS)('builds %s as a raw, grounded, ring-free neutral creature', (id) => {
    const model = createModel(id);
    expect(model).toBeInstanceOf(THREE.Group);
    expect(model.name).toBe(`creature-${id}`);
    expect(model.userData).toMatchObject({
      creatureId: id,
      faction: 'Neutral',
      animationPivot: 'ground',
      side: 'attacker',
      factionColor: model.userData.palette[0],
    });
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    expect(model.getObjectByName('faction-ring')).toBeUndefined();
    expect(getMeshes(model).length).toBeGreaterThan(15);
    expect(model.userData.palette).toHaveLength(3);
  });

  it('returns null for inherited, unknown, empty, and non-undead IDs', () => {
    for (const id of ['toString', 'constructor', '__proto__', 'unknown', '', 'skeleton', 'vampire', 'Lich']) {
      for (const side of SIDES) expect(createUndeadMonsterModel(id, side)).toBeNull();
    }
  });

  it('preserves side metadata and turns only defenders around', () => {
    for (const id of UNDEAD_IDS) {
      for (const side of SIDES) {
        const model = createModel(id, side);
        expect(model.userData.side).toBe(side);
        expect(model.rotation.y).toBe(side === 'attacker' ? 0 : Math.PI);
      }
    }
  });

  it('gives the lich and wraith different anatomy and silhouettes', () => {
    const lich = createModel('lich');
    const wraith = createModel('wraith');
    expect(silhouette(lich)).not.toBe(silhouette(wraith));
    expect(lich.userData.archetype).toBe('crowned-undead-caster');
    expect(wraith.userData.archetype).toBe('hooded-spectral-revenant');
    expect(lich.getObjectByName('lich-crown')).toBeInstanceOf(THREE.Mesh);
    expect(lich.getObjectByName('lich-staff')).toBeInstanceOf(THREE.Mesh);
    expect(lich.getObjectByName('lich-skull')).toBeInstanceOf(THREE.Mesh);
    expect(wraith.getObjectByName('wraith-hood')).toBeInstanceOf(THREE.Mesh);
    expect(wraith.getObjectByName('wraith-shroud')).toBeInstanceOf(THREE.Mesh);
    expect(wraith.getObjectByName('wraith-claw-left')).toBeInstanceOf(THREE.Mesh);
    expect(wraith.getObjectByName('wraith-claw-right')).toBeInstanceOf(THREE.Mesh);
    expect(wraith.getObjectByName('lich-staff')).toBeUndefined();
  });

  it.each(UNDEAD_IDS)('keeps %s finite, grounded, compact, and label-safe on both sides', (id) => {
    for (const side of SIDES) {
      const model = createModel(id, side);
      const bounds = getBounds(model);
      const size = bounds.getSize(new THREE.Vector3());
      expect(bounds.isEmpty()).toBe(false);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.0001);
      expect(bounds.min.y).toBeCloseTo(0, 4);
      expect(size.y).toBeGreaterThan(1.7);
      expect(size.y).toBeLessThan(2.5);
      expect(size.x).toBeLessThan(1.6);
      expect(size.z).toBeLessThan(1.6);
      for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
      expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
      for (const mesh of getMeshes(model)) {
        expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
        expect(mesh.geometry.getAttribute('position').array.every(Number.isFinite)).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
      }
    }
  });

  it.each(UNDEAD_IDS)('provides real pickable mesh geometry for %s on both sides', (id) => {
    for (const side of SIDES) {
      const model = createModel(id, side);
      model.updateMatrixWorld(true);
      const origin = new THREE.Vector3(side === 'attacker' ? 4 : -4, 1.05, 0);
      const direction = new THREE.Vector3(0, 1.05, 0).sub(origin).normalize();
      const hits = new THREE.Raycaster(origin, direction).intersectObject(model, true);
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]?.object).toBeInstanceOf(THREE.Mesh);
    }
  });

  it.each(UNDEAD_IDS)('does not share disposable resources between %s calls', (id) => {
    const first = getResources(createModel(id));
    const second = getResources(createModel(id));
    for (const geometry of second.geometries) expect(first.geometries.has(geometry)).toBe(false);
    for (const material of second.materials) expect(first.materials.has(material)).toBe(false);
  });

  it.each(UNDEAD_IDS)('disposes every unique %s geometry and material exactly once', (id) => {
    const model = createUndeadMonsterModel(id, 'attacker');
    if (!model) throw new Error(`Expected ${id}`);
    const { geometries, materials } = getResources(model);
    const geometrySpies = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...materials].map((material) => vi.spyOn(material, 'dispose'));
    disposeBattleResources(model);
    for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).toHaveBeenCalledTimes(1);
  });
});
