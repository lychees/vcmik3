import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { BUILDINGS } from '../../game/content';
import { FACTIONS } from '../../game/factions';
import dungeonPack, { createBuildingModel } from './dungeon';

const DWELLING_IDS = FACTIONS.dungeon.buildingIds;
const BUILT_MARKERS: Record<string, string> = {
  troglodyteWarrens: 'warrens-mound',
  harpyRoost: 'harpy-crown',
  minotaurLabyrinth: 'labyrinth-maze',
  redDragonCavern: 'red-dragon-maw',
};

function requireModel(buildingId: string, built: boolean): THREE.Group {
  const model = createBuildingModel(buildingId, built);
  if (!model) throw new Error(`Missing Dungeon model: ${buildingId}`);
  return model;
}

function meshesIn(model: THREE.Group): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  return meshes;
}

function materialsIn(meshes: THREE.Mesh[]): THREE.Material[] {
  return meshes.flatMap((mesh) => Array.isArray(mesh.material) ? mesh.material : [mesh.material]);
}

describe('Dungeon faction model pack', () => {
  it('exports the pack contract and covers exactly the four Dungeon dwellings in BUILDINGS', () => {
    expect(dungeonPack.faction).toBe('Dungeon');
    expect(dungeonPack.createBuildingModel).toBe(createBuildingModel);
    expect(DWELLING_IDS).toEqual([
      'troglodyteWarrens',
      'harpyRoost',
      'minotaurLabyrinth',
      'redDragonCavern',
    ]);
    expect(DWELLING_IDS).toHaveLength(4);

    for (const [index, buildingId] of DWELLING_IDS.entries()) {
      expect(BUILDINGS[buildingId]?.id).toBe(buildingId);
      expect(BUILDINGS[buildingId]?.creatureId).toBe(FACTIONS.dungeon.creatureIds[index]);
      expect(requireModel(buildingId, true)).toBeInstanceOf(THREE.Group);
      expect(requireModel(buildingId, false)).toBeInstanceOf(THREE.Group);
    }
  });

  it('returns null for common, foreign, and unknown buildings in both states', () => {
    const uncustomized = ['townHall', 'capitol', 'market', 'fort', 'mageGuild', 'militiaBarracks', 'unknown'];
    for (const buildingId of uncustomized) {
      expect(createBuildingModel(buildingId, true)).toBeNull();
      expect(createBuildingModel(buildingId, false)).toBeNull();
    }
  });

  it.each(['constructor', 'toString', '__proto__'])(
    'returns null for inherited property name %s in both states',
    (buildingId) => {
      expect(createBuildingModel(buildingId, true)).toBeNull();
      expect(createBuildingModel(buildingId, false)).toBeNull();
    },
  );

  for (const buildingId of DWELLING_IDS) {
    describe(buildingId, () => {
      it.each([true, false])('has finite, grounded geometry within its plot (built=%s)', (built) => {
        const model = requireModel(buildingId, built);
        model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());

        expect(model.userData).toMatchObject({ faction: 'Dungeon', buildingId, built });
        expect(bounds.min.y).toBeCloseTo(0, 5);
        expect(bounds.min.x).toBeGreaterThanOrEqual(-1.85);
        expect(bounds.max.x).toBeLessThanOrEqual(1.85);
        expect(bounds.min.z).toBeGreaterThanOrEqual(-1.75);
        expect(bounds.max.z).toBeLessThanOrEqual(1.75);
        expect(size.y).toBeLessThanOrEqual(4);
        for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
          expect(Number.isFinite(value)).toBe(true);
        }

        const meshes = meshesIn(model);
        expect(meshes.length).toBeGreaterThan(5);
        for (const mesh of meshes) {
          expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
          expect(mesh.castShadow).toBe(true);
          expect(mesh.receiveShadow).toBe(true);
          const positions = mesh.geometry.getAttribute('position');
          expect(positions).toBeDefined();
          expect(positions.array.every(Number.isFinite)).toBe(true);
        }
      });

      it('uses a recognizable complete model or a distinct construction site', () => {
        const built = requireModel(buildingId, true);
        const unbuilt = requireModel(buildingId, false);

        expect(built.getObjectByName(`${buildingId}-complete`)).toBeDefined();
        expect(built.getObjectByName(BUILT_MARKERS[buildingId] as string)).toBeDefined();
        expect(built.getObjectByName('construction-site')).toBeUndefined();
        expect(unbuilt.getObjectByName('construction-site')).toBeDefined();
        expect(unbuilt.getObjectByName(`${buildingId}-blueprint`)).toBeDefined();
        expect(unbuilt.getObjectByName(`${buildingId}-complete`)).toBeUndefined();
        expect(meshesIn(built).length).toBeGreaterThan(meshesIn(unbuilt).length);

        const unbuiltMaterials = materialsIn(meshesIn(unbuilt));
        expect(unbuiltMaterials.some((material) => material.transparent && material.opacity < 1)).toBe(true);
      });

      it.each([true, false])('owns independent disposable resources (built=%s)', (built) => {
        const first = requireModel(buildingId, built);
        const second = requireModel(buildingId, built);
        const firstMeshes = meshesIn(first);
        const secondMeshes = meshesIn(second);
        const firstGeometries = new Set(firstMeshes.map((mesh) => mesh.geometry));
        const firstMaterials = new Set(materialsIn(firstMeshes));

        for (const mesh of secondMeshes) {
          expect(firstGeometries.has(mesh.geometry)).toBe(false);
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            expect(firstMaterials.has(material)).toBe(false);
          }
        }

        const geometries = new Set(firstMeshes.map((mesh) => mesh.geometry));
        const materials = new Set(materialsIn(firstMeshes));
        const geometrySpies = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
        const materialSpies = [...materials].map((material) => vi.spyOn(material, 'dispose'));

        const disposedGeometries = new Set<THREE.BufferGeometry>();
        const disposedMaterials = new Set<THREE.Material>();
        for (const mesh of firstMeshes) {
          if (!disposedGeometries.has(mesh.geometry)) {
            mesh.geometry.dispose();
            disposedGeometries.add(mesh.geometry);
          }
          for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            if (!disposedMaterials.has(material)) {
              material.dispose();
              disposedMaterials.add(material);
            }
          }
        }

        expect(disposedGeometries.size).toBe(geometries.size);
        expect(disposedMaterials.size).toBe(materials.size);
        for (const spy of [...geometrySpies, ...materialSpies]) {
          expect(spy).toHaveBeenCalledTimes(1);
        }
      });
    });
  }
});
