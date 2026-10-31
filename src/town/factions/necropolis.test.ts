import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BUILDINGS } from '../../game/content';
import { FACTIONS } from '../../game/factions';
import necropolisPack from './necropolis';

const DWELLING_IDS = [
  'skeletonCrypt',
  'zombieGraveyard',
  'vampireEstate',
  'ghostDragonSepulcher',
] as const;

const HEIGHT_LIMITS: Readonly<Record<(typeof DWELLING_IDS)[number], number>> = {
  skeletonCrypt: 3.2,
  zombieGraveyard: 3,
  vampireEstate: 4.8,
  ghostDragonSepulcher: 5.5,
};

const liveModels: THREE.Group[] = [];

function createModel(buildingId: string, built: boolean): THREE.Group {
  const model = necropolisPack.createBuildingModel(buildingId, built);
  if (!model) throw new Error(`Expected a Necropolis model for ${buildingId}`);
  liveModels.push(model);
  return model;
}

function getMeshes(model: THREE.Group): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  return meshes;
}

function getBounds(model: THREE.Group): THREE.Box3 {
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model);
}

function getResources(models: THREE.Group[]): {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
} {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const model of models) {
    for (const mesh of getMeshes(model)) {
      geometries.add(mesh.geometry);
      const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of meshMaterials) materials.add(material);
    }
  }
  return { geometries, materials };
}

function disposeModel(model: THREE.Group): void {
  const { geometries, materials } = getResources([model]);
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

function geometrySignature(model: THREE.Group): string {
  return getMeshes(model).map((mesh) => {
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    return `${mesh.geometry.type}:${mesh.position.toArray().join(',')}:${bounds?.min.toArray().join(',')}:${bounds?.max.toArray().join(',')}`;
  }).join('|');
}

afterEach(() => {
  for (const model of liveModels) disposeModel(model);
  liveModels.length = 0;
});

describe('Necropolis faction model pack', () => {
  it('covers exactly the four Necropolis dwellings registered in BUILDINGS', () => {
    expect(necropolisPack.faction).toBe('Necropolis');
    expect(FACTIONS.necropolis.buildingIds).toEqual(DWELLING_IDS);

    const dwellingIds = Object.values(BUILDINGS)
      .filter((building) => building.creatureId && FACTIONS.necropolis.creatureIds.some((id) => id === building.creatureId))
      .map((building) => building.id);
    expect(dwellingIds).toEqual(DWELLING_IDS);

    for (const buildingId of DWELLING_IDS) {
      expect(BUILDINGS[buildingId]?.id).toBe(buildingId);
      for (const built of [false, true]) {
        const model = createModel(buildingId, built);
        expect(model).toBeInstanceOf(THREE.Group);
        expect(model.name).toBe(buildingId);
        expect(model.userData).toMatchObject({
          buildingId,
          faction: 'Necropolis',
          built,
          state: built ? 'built' : 'unbuilt',
        });
        expect(model.position.toArray()).toEqual([0, 0, 0]);
        expect(getMeshes(model).length).toBeGreaterThan(10);
      }
    }
  });

  it('returns null for common, other-faction, and unknown buildings', () => {
    const uncustomized = [
      'townHall',
      'capitol',
      'market',
      'fort',
      'mageGuild',
      'militiaBarracks',
      'gremlinWorkshop',
      'unknownBuilding',
      '__proto__',
      '',
    ];
    for (const buildingId of uncustomized) {
      expect(necropolisPack.createBuildingModel(buildingId, false)).toBeNull();
      expect(necropolisPack.createBuildingModel(buildingId, true)).toBeNull();
    }
  });

  it('keeps every variant finite, grounded, and inside its registered plot and height', () => {
    for (const buildingId of DWELLING_IDS) {
      for (const built of [false, true]) {
        const model = createModel(buildingId, built);
        const bounds = getBounds(model);
        const size = bounds.getSize(new THREE.Vector3());
        expect(bounds.min.y, `${buildingId} built=${built} ground`).toBeGreaterThanOrEqual(-0.0001);
        expect(bounds.max.y, `${buildingId} built=${built} height`).toBeLessThanOrEqual(HEIGHT_LIMITS[buildingId] + 0.0001);
        expect(size.x, `${buildingId} built=${built} width`).toBeLessThanOrEqual(3.7 + 0.0001);
        expect(size.z, `${buildingId} built=${built} depth`).toBeLessThanOrEqual(3.5 + 0.0001);
        expect(size.y).toBeGreaterThan(0.5);

        for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
          expect(Number.isFinite(value)).toBe(true);
        }
        for (const mesh of getMeshes(model)) {
          expect(mesh.geometry.getAttribute('position').count).toBeGreaterThan(0);
          expect(mesh.geometry.getAttribute('position').array.every(Number.isFinite)).toBe(true);
          expect(mesh.material).toBeDefined();
        }
      }
    }
  });

  it('gives each dwelling a distinct complete silhouette and a visibly different construction state', () => {
    const completeSignatures = new Set<string>();
    for (const buildingId of DWELLING_IDS) {
      const unbuilt = createModel(buildingId, false);
      const built = createModel(buildingId, true);
      const unbuiltSignature = geometrySignature(unbuilt);
      const builtSignature = geometrySignature(built);
      expect(builtSignature).not.toBe(unbuiltSignature);
      expect(getBounds(built).max.y).toBeGreaterThan(getBounds(unbuilt).max.y + 0.5);
      completeSignatures.add(builtSignature);
    }
    expect(completeSignatures.size).toBe(DWELLING_IDS.length);
  });

  it('provides real mesh geometry that a core raycaster can pick', () => {
    for (const buildingId of DWELLING_IDS) {
      for (const built of [false, true]) {
        const model = createModel(buildingId, built);
        model.updateMatrixWorld(true);
        const raycaster = new THREE.Raycaster(
          new THREE.Vector3(0, 10, 0),
          new THREE.Vector3(0, -1, 0),
        );
        expect(raycaster.intersectObject(model, true).length, `${buildingId} built=${built}`).toBeGreaterThan(0);
      }
    }
  });

  it('does not share disposable geometry or materials between model calls', () => {
    for (const buildingId of DWELLING_IDS) {
      const first = getResources([createModel(buildingId, true)]);
      const second = getResources([createModel(buildingId, true)]);
      for (const geometry of second.geometries) expect(first.geometries.has(geometry)).toBe(false);
      for (const material of second.materials) expect(first.materials.has(material)).toBe(false);
    }
  });
});
