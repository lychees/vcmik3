import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { disposeBattleResources } from '../../battle/resources';
import { createHeroesShrineModel } from './heroesShrine';

const liveModels: THREE.Group[] = [];

function createModel(): THREE.Group {
  const model = createHeroesShrineModel();
  liveModels.push(model);
  return model;
}

function getMeshes(model: THREE.Object3D): THREE.Mesh[] {
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

afterEach(() => {
  for (const model of liveModels) disposeBattleResources(model);
  liveModels.length = 0;
});

describe('heroesShrine landmark model', () => {
  it('builds a grounded shrine with a heroic statue, offering altar, and radiant details', () => {
    const model = createModel();
    expect(model).toBeInstanceOf(THREE.Group);
    expect(model.name).toBe('heroesShrine');
    expect(model.userData).toMatchObject({
      landmarkId: 'heroesShrine',
      animationPivot: 'ground',
    });
    expect(model.position.toArray()).toEqual([0, 0, 0]);

    const statue = model.getObjectByName('shrine-statue');
    const altar = model.getObjectByName('shrine-altar');
    const radiance = model.getObjectByName('shrine-radiance');
    expect(statue).toBeInstanceOf(THREE.Group);
    expect(altar).toBeInstanceOf(THREE.Group);
    expect(radiance).toBeInstanceOf(THREE.Group);
    expect(getMeshes(statue!).length).toBeGreaterThan(15);
    expect(getMeshes(altar!).length).toBeGreaterThanOrEqual(5);
    expect(getMeshes(radiance!).length).toBeGreaterThanOrEqual(15);
    expect(model.getObjectByName('shrine-statue-shield')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('shrine-altar-offering')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('shrine-halo')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('shrine-flame-left')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('shrine-flame-right')).toBeInstanceOf(THREE.Mesh);
  });

  it('uses real emissive geometry for the halo, runes, offering, and flames', () => {
    const model = createModel();
    const emissiveMeshes = getMeshes(model).filter((mesh) => {
      const surface = mesh.material as THREE.MeshStandardMaterial;
      return surface.emissive.getHex() !== 0 && surface.emissiveIntensity > 0;
    });
    expect(emissiveMeshes.length).toBeGreaterThanOrEqual(15);
    expect(model.getObjectByName('shrine-rune-0')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('shrine-rune-5')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('shrine-halo-ray-0')).toBeInstanceOf(THREE.Mesh);
    expect(model.getObjectByName('shrine-halo-ray-7')).toBeInstanceOf(THREE.Mesh);
  });

  it('keeps all geometry finite, grounded, and within compact overworld bounds', () => {
    const model = createModel();
    const bounds = getBounds(model);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.0001);
    expect(bounds.min.y).toBeCloseTo(0, 4);
    expect(size.y).toBeGreaterThan(2);
    expect(size.y).toBeLessThan(2.7);
    expect(size.x).toBeLessThan(2);
    expect(size.z).toBeLessThan(2);
    for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
      expect(Number.isFinite(value)).toBe(true);
    }
    expect(model.userData.visualHeight).toBeCloseTo(size.y, 6);
    expect(model.userData.labelHeight).toBeCloseTo(bounds.max.y + 0.45, 6);
    for (const mesh of getMeshes(model)) {
      expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
      expect(mesh.geometry.getAttribute('position').array.every(Number.isFinite)).toBe(true);
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
    }
  });

  it('can be picked with real front and overhead raycasts', () => {
    const model = createModel();
    model.updateMatrixWorld(true);
    const frontHits = new THREE.Raycaster(
      new THREE.Vector3(0, 1.35, 4),
      new THREE.Vector3(0, 0, -1),
    ).intersectObject(model, true);
    const overheadHits = new THREE.Raycaster(
      new THREE.Vector3(0, 5, 0),
      new THREE.Vector3(0, -1, 0),
    ).intersectObject(model, true);
    expect(frontHits.length).toBeGreaterThan(0);
    expect(overheadHits.length).toBeGreaterThan(0);
    expect(frontHits[0]?.object).toBeInstanceOf(THREE.Mesh);
    expect(overheadHits[0]?.object).toBeInstanceOf(THREE.Mesh);
  });

  it('does not share disposable geometry, materials, or palette metadata between calls', () => {
    const firstModel = createModel();
    const secondModel = createModel();
    const first = getResources(firstModel);
    const second = getResources(secondModel);
    for (const geometry of second.geometries) expect(first.geometries.has(geometry)).toBe(false);
    for (const material of second.materials) expect(first.materials.has(material)).toBe(false);
    expect(firstModel.userData.palette).not.toBe(secondModel.userData.palette);
  });

  it('disposes every unique shrine geometry and material exactly once', () => {
    const model = createHeroesShrineModel();
    const { geometries, materials } = getResources(model);
    const geometrySpies = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...materials].map((material) => vi.spyOn(material, 'dispose'));
    disposeBattleResources(model);
    for (const spy of [...geometrySpies, ...materialSpies]) expect(spy).toHaveBeenCalledTimes(1);
  });
});
