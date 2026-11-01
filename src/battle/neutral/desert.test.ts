import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import type { BattleSideId } from '../types';
import { createDesertMonsterModel } from './desert';

const DESERT_IDS = ['mummy', 'sandWyrm'] as const;
const liveModels = new Set<THREE.Group>();

function createModel(id: string, side: BattleSideId = 'attacker'): THREE.Group {
  const model = createDesertMonsterModel(id, side);
  if (!model) throw new Error(`Expected desert model: ${id}`);
  liveModels.add(model);
  return model;
}

function meshesIn(model: THREE.Group): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  return meshes;
}

function resourcesIn(model: THREE.Group): {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
} {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const mesh of meshesIn(model)) {
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  }
  return { geometries, materials };
}

function boundsOf(model: THREE.Group): THREE.Box3 {
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model);
}

function signatureOf(model: THREE.Group): string {
  return meshesIn(model).map((mesh) => [
    mesh.geometry.type,
    ...mesh.position.toArray(),
    ...mesh.scale.toArray(),
    ...mesh.rotation.toArray().slice(0, 3),
  ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(':')).join('|');
}

afterEach(() => {
  for (const model of liveModels) {
    const { geometries, materials } = resourcesIn(model);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }
  liveModels.clear();
});

describe('desert monster factory contract', () => {
  it.each(DESERT_IDS)('creates %s with battle metadata and no faction ring for either side', (id) => {
    for (const side of ['attacker', 'defender'] as const) {
      const model = createModel(id, side);
      expect(model).toBeInstanceOf(THREE.Group);
      expect(model.name).toBe(`creature-${id}`);
      expect(model.userData).toMatchObject({
        creatureId: id,
        faction: 'Neutral',
        animationPivot: 'ground',
        side,
      });
      expect(model.userData.archetype).not.toBe(id);
      expect(model.userData.palette).toHaveLength(3);
      expect(model.userData.factionColor).toBe(model.userData.palette[0]);
      expect(model.rotation.y).toBe(side === 'attacker' ? 0 : Math.PI);
      expect(model.position.toArray()).toEqual([0, 0, 0]);
      expect(model.getObjectByName('faction-ring')).toBeUndefined();
      expect(meshesIn(model).some((mesh) => mesh.geometry instanceof THREE.TorusGeometry)).toBe(false);
    }
  });

  it('returns null for unknown, inherited, foreign, and incorrectly cased IDs', () => {
    const ids = [
      'unknown', 'militia', 'skeleton', 'imp', 'basilisk', 'Mummy', 'sandwyrm',
      'toString', 'valueOf', 'constructor', '__proto__', '',
    ];
    for (const id of ids) expect(createDesertMonsterModel(id, 'attacker')).toBeNull();
  });

  it('gives the mummy wrappings and the sand wyrm a segmented jawed silhouette', () => {
    const mummy = createModel('mummy');
    const wyrm = createModel('sandWyrm');
    const mummyMeshes = meshesIn(mummy);
    const wyrmMeshes = meshesIn(wyrm);

    expect(mummyMeshes.filter((mesh) => mesh.userData.detail === 'bandage').length).toBeGreaterThanOrEqual(20);
    expect(mummy.getObjectByName('mummy-eye-left')).toBeInstanceOf(THREE.Mesh);
    expect(mummy.getObjectByName('mummy-eye-right')).toBeInstanceOf(THREE.Mesh);
    expect(wyrmMeshes.filter((mesh) => mesh.userData.anatomy === 'bodySegment')).toHaveLength(5);
    expect(wyrmMeshes.filter((mesh) => mesh.userData.detail === 'tooth')).toHaveLength(8);
    expect(wyrm.getObjectByName('sand-wyrm-head')).toBeInstanceOf(THREE.Mesh);
    expect(wyrm.getObjectByName('sand-wyrm-jaw')).toBeInstanceOf(THREE.Mesh);
    expect(signatureOf(mummy)).not.toBe(signatureOf(wyrm));
  });
});

describe('desert monster geometry and ownership', () => {
  it.each(DESERT_IDS)('keeps %s finite, grounded, compact, shadowed, and pickable', (id) => {
    const model = createModel(id);
    const bounds = boundsOf(model);
    const size = bounds.getSize(new THREE.Vector3());

    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.000001);
    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(bounds.max.y).toBeGreaterThan(0.85);
    expect(bounds.max.y).toBeLessThan(3);
    expect(size.x).toBeLessThan(3);
    expect(size.z).toBeLessThan(2);
    expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
    for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
      expect(Number.isFinite(value)).toBe(true);
    }

    const meshes = meshesIn(model);
    expect(meshes.length).toBeGreaterThan(30);
    expect(meshes.length).toBeLessThan(70);
    for (const mesh of meshes) {
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
      expect(mesh.visible).toBe(true);
      const positions = mesh.geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
      expect(positions.array.every(Number.isFinite)).toBe(true);
    }

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0));
    expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
  });

  it.each(DESERT_IDS)('gives each %s instance independent disposable geometry and materials', (id) => {
    const first = resourcesIn(createModel(id));
    const second = resourcesIn(createModel(id));
    expect(first.geometries.size).toBeGreaterThan(0);
    expect(first.materials.size).toBeGreaterThan(0);
    for (const geometry of second.geometries) expect(first.geometries.has(geometry)).toBe(false);
    for (const material of second.materials) expect(first.materials.has(material)).toBe(false);
  });
});
