import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { createWarriorsArenaModel } from './warriorsArena';

const liveModels = new Set<THREE.Group>();

function createModel(): THREE.Group {
  const model = createWarriorsArenaModel();
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

afterEach(() => {
  for (const model of liveModels) {
    const { geometries, materials } = resourcesIn(model);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }
  liveModels.clear();
});

describe('warriors arena landmark', () => {
  it('builds a grounded arena with sands, stepped seating, banners, a gate, and combat details', () => {
    const model = createModel();
    const meshes = meshesIn(model);
    expect(model.name).toBe('warriorsArena');
    expect(model.userData).toMatchObject({
      landmarkId: 'warriorsArena',
      faction: 'Neutral',
      animationPivot: 'ground',
    });
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    expect(model.getObjectByName('arena-sands')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('arena-gate')).toBeInstanceOf(THREE.Group);
    expect(model.getObjectByName('combat-ring')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('crossed-swords')?.children).toHaveLength(2);
    expect(meshes.filter((mesh) => mesh.userData.feature === 'seating')).toHaveLength(39);
    expect(meshes.filter((mesh) => mesh.userData.feature === 'combatRing')).toHaveLength(5);
    expect(meshes.filter((mesh) => /^arena-banner-cloth-/.test(mesh.name))).toHaveLength(4);
    for (let index = 0; index < 4; index += 1) {
      expect(model.getObjectByName(`arena-banner-${index}`)).toBeInstanceOf(THREE.Group);
      expect(model.getObjectByName(`arena-banner-emblem-${index}`)).toBeInstanceOf(THREE.Mesh);
    }
  });

  it('uses finite, compact, shadowed geometry with ground-level and overhead picking', () => {
    const model = createModel();
    const bounds = boundsOf(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.000001);
    expect(bounds.min.y).toBeCloseTo(0, 5);
    expect(bounds.max.y).toBeGreaterThan(1.5);
    expect(bounds.max.y).toBeLessThan(2.4);
    expect(size.x).toBeGreaterThan(3);
    expect(size.x).toBeLessThan(4.5);
    expect(size.z).toBeGreaterThan(3);
    expect(size.z).toBeLessThan(4.5);
    expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
    for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
      expect(Number.isFinite(value)).toBe(true);
    }

    const meshes = meshesIn(model);
    expect(meshes.length).toBeGreaterThan(60);
    expect(meshes.length).toBeLessThan(100);
    for (const mesh of meshes) {
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
      expect(mesh.visible).toBe(true);
      const positions = mesh.geometry.getAttribute('position');
      expect(positions.count).toBeGreaterThan(0);
      expect(positions.array.every(Number.isFinite)).toBe(true);
      const surface = mesh.material as THREE.MeshStandardMaterial;
      expect(surface.userData.baseColor).toBe(surface.color.getHex());
    }

    const overhead = new THREE.Raycaster(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, -1, 0));
    expect(overhead.intersectObject(model, true).length).toBeGreaterThan(0);
    const groundLevel = new THREE.Raycaster(new THREE.Vector3(0, 0.22, 5), new THREE.Vector3(0, 0, -1));
    expect(groundLevel.intersectObject(model, true).length).toBeGreaterThan(0);
  });

  it('gives separate arenas independent disposable geometry and materials', () => {
    const first = resourcesIn(createModel());
    const second = resourcesIn(createModel());
    expect(first.geometries.size).toBeGreaterThan(0);
    expect(first.materials.size).toBeGreaterThan(0);
    for (const geometry of second.geometries) expect(first.geometries.has(geometry)).toBe(false);
    for (const material of second.materials) expect(first.materials.has(material)).toBe(false);
  });
});
