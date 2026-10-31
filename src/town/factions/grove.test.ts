import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BUILDINGS, CREATURES } from '../../game/content';
import { FACTIONS } from '../../game/factions';
import grovePack from './grove';

const HEIGHT_LIMITS: Readonly<Record<string, number>> = {
  spriteGlade: 3.7,
  rangerLodge: 3.3,
  unicornGrove: 4.3,
  dragonCliffs: 5,
};

const activeModels: THREE.Group[] = [];

function createModel(buildingId: string, built: boolean): THREE.Group {
  const model = grovePack.createBuildingModel(buildingId, built);
  if (!model) throw new Error(`Missing Grove model: ${buildingId} (${built ? 'built' : 'unbuilt'})`);
  activeModels.push(model);
  return model;
}

function getMeshes(model: THREE.Group): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  return meshes;
}

function disposeModel(model: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const mesh of getMeshes(model)) {
    geometries.add(mesh.geometry);
    for (const surface of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(surface);
    }
  }
  for (const geometry of geometries) geometry.dispose();
  for (const surface of materials) surface.dispose();
}

afterEach(() => {
  for (const model of activeModels.splice(0)) disposeModel(model);
});

describe('Grove faction model pack', () => {
  it('covers exactly the four Grove dwellings present in BUILDINGS', () => {
    const groveDwellingIds = Object.values(BUILDINGS)
      .filter((building) => building.creatureId && CREATURES[building.creatureId]?.faction === 'Grove')
      .map((building) => building.id)
      .sort();

    expect(groveDwellingIds).toHaveLength(4);
    expect(groveDwellingIds).toEqual([...FACTIONS.grove.buildingIds].sort());
    expect(grovePack.faction).toBe('Grove');
    for (const buildingId of groveDwellingIds) {
      expect(createModel(buildingId, true)).toBeInstanceOf(THREE.Group);
      expect(createModel(buildingId, false)).toBeInstanceOf(THREE.Group);
    }
  });

  it('returns null for common, other-faction, and unknown buildings', () => {
    const uncustomizedIds = [
      'townHall',
      'capitol',
      'market',
      'fort',
      'mageGuild',
      'militiaBarracks',
      'impWarrens',
      'unknownBuilding',
      '',
    ];
    for (const buildingId of uncustomizedIds) {
      expect(grovePack.createBuildingModel(buildingId, true)).toBeNull();
      expect(grovePack.createBuildingModel(buildingId, false)).toBeNull();
    }
  });

  it('keeps every state grounded, bounded, finite, and shadow-compatible', () => {
    for (const buildingId of FACTIONS.grove.buildingIds) {
      for (const built of [true, false]) {
        const model = createModel(buildingId, built);
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        expect(bounds.min.y, `${buildingId} ground`).toBeGreaterThanOrEqual(-1e-6);
        expect(bounds.min.y, `${buildingId} ground`).toBeCloseTo(0, 6);
        expect(size.x, `${buildingId} width`).toBeLessThanOrEqual(3.7 + 1e-6);
        expect(size.z, `${buildingId} depth`).toBeLessThanOrEqual(3.5 + 1e-6);
        expect(size.y, `${buildingId} height`).toBeLessThanOrEqual(HEIGHT_LIMITS[buildingId]! + 1e-6);
        expect(size.y, `${buildingId} visible height`).toBeGreaterThan(0.5);

        const meshes = getMeshes(model);
        expect(meshes.length).toBeGreaterThan(8);
        for (const mesh of meshes) {
          expect(mesh.castShadow).toBe(true);
          expect(mesh.receiveShadow).toBe(true);
          expect(mesh.geometry.getAttribute('position')).toBeDefined();
          expect(Array.from(mesh.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
        }
      }
    }
  });

  it('provides distinct construction sites and visibly completed dwellings', () => {
    for (const buildingId of FACTIONS.grove.buildingIds) {
      const built = createModel(buildingId, true);
      const unbuilt = createModel(buildingId, false);
      expect(built.userData).toMatchObject({ faction: 'Grove', buildingId, built: true });
      expect(unbuilt.userData).toMatchObject({ faction: 'Grove', buildingId, built: false });
      expect(built.getObjectByName('completed-dwelling')).toBeDefined();
      expect(unbuilt.getObjectByName('construction-site')).toBeDefined();
      expect(unbuilt.getObjectByName('timber-scaffolding')).toBeDefined();
      expect(built.getObjectByName('timber-scaffolding')).toBeUndefined();
      expect(getMeshes(built).length).toBeGreaterThan(getMeshes(unbuilt).length);
      const builtHeight = new THREE.Box3().setFromObject(built).getSize(new THREE.Vector3()).y;
      const unbuiltHeight = new THREE.Box3().setFromObject(unbuilt).getSize(new THREE.Vector3()).y;
      expect(builtHeight).toBeGreaterThan(unbuiltHeight);
    }
  });

  it('gives the four completed dwellings different procedural silhouettes', () => {
    const signatures = FACTIONS.grove.buildingIds.map((buildingId) => {
      const model = createModel(buildingId, true);
      const meshes = getMeshes(model);
      const geometrySignature = meshes
        .map((mesh) => mesh.geometry.type)
        .sort()
        .join(',');
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
      return `${meshes.length}:${geometrySignature}:${size.y.toFixed(2)}`;
    });
    expect(new Set(signatures).size).toBe(4);
  });

  it('supports recursive mesh raycasts in built and unbuilt states', () => {
    for (const buildingId of FACTIONS.grove.buildingIds) {
      for (const built of [true, false]) {
        const model = createModel(buildingId, built);
        model.updateMatrixWorld(true);
        const raycaster = new THREE.Raycaster(
          new THREE.Vector3(0, 0.08, 6),
          new THREE.Vector3(0, 0, -1),
          0,
          12,
        );
        expect(raycaster.intersectObject(model, true).length, `${buildingId} pickable`).toBeGreaterThan(0);
      }
    }
  });

  it('creates independent geometry and materials for core-owned disposal', () => {
    for (const buildingId of FACTIONS.grove.buildingIds) {
      const first = createModel(buildingId, true);
      const second = createModel(buildingId, true);
      expect(first).not.toBe(second);
      const firstMeshes = getMeshes(first);
      const secondMeshes = getMeshes(second);
      expect(firstMeshes).toHaveLength(secondMeshes.length);
      for (let index = 0; index < firstMeshes.length; index += 1) {
        expect(firstMeshes[index]!.geometry).not.toBe(secondMeshes[index]!.geometry);
        expect(firstMeshes[index]!.material).not.toBe(secondMeshes[index]!.material);
      }
    }
  });
});
