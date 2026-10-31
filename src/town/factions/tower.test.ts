import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../../game/content';
import { FACTIONS } from '../../game/factions';
import towerPack, { createBuildingModel } from './tower';

const TOWER_DWELLINGS = FACTIONS.tower.buildingIds;
const HEIGHTS: Readonly<Record<string, number>> = {
  gremlinWorkshop: 3.4,
  gargoyleParapet: 4.0,
  geniePavilion: 4.6,
  titanCloudTemple: 6.0,
};

function meshes(model: THREE.Group): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) result.push(child);
  });
  return result;
}

function bounds(model: THREE.Group): THREE.Box3 {
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model);
}

function signature(model: THREE.Group): string {
  return meshes(model).map((part) => [
    part.geometry.type,
    ...part.position.toArray(),
    ...part.scale.toArray(),
    part.rotation.x,
    part.rotation.y,
    part.rotation.z,
  ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(':')).join('|');
}

function resources(model: THREE.Group): {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
} {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const part of meshes(model)) {
    geometries.add(part.geometry);
    for (const material of Array.isArray(part.material) ? part.material : [part.material]) {
      materials.add(material);
    }
  }
  return { geometries, materials };
}

describe('Tower faction model pack', () => {
  it('exports the standalone faction pack contract and covers the actual Tower roster', () => {
    expect(towerPack.faction).toBe('Tower');
    expect(towerPack.createBuildingModel).toBe(createBuildingModel);
    expect(TOWER_DWELLINGS).toEqual([
      'gremlinWorkshop',
      'gargoyleParapet',
      'geniePavilion',
      'titanCloudTemple',
    ]);
    for (const [index, id] of TOWER_DWELLINGS.entries()) {
      expect(BUILDINGS[id]?.creatureId).toBe(FACTIONS.tower.creatureIds[index]);
      expect(createBuildingModel(id, true)).toBeInstanceOf(THREE.Group);
      expect(createBuildingModel(id, false)).toBeInstanceOf(THREE.Group);
    }
  });

  it('returns null for common buildings, other factions, and unknown IDs', () => {
    const uncustomized = [
      'townHall',
      'capitol',
      'market',
      'fort',
      'mageGuild',
      'militiaBarracks',
      'stormElementalSpire',
      'notABuilding',
      '__proto__',
    ];
    for (const id of uncustomized) {
      expect(createBuildingModel(id, true)).toBeNull();
      expect(createBuildingModel(id, false)).toBeNull();
    }
  });

  it.each(TOWER_DWELLINGS)('keeps %s grounded, bounded, and complete in both states', (id) => {
    for (const built of [true, false]) {
      const model = createBuildingModel(id, built);
      expect(model).not.toBeNull();
      if (!model) return;
      expect(model.name).toBe(id);
      expect(model.userData).toMatchObject({ buildingId: id, built, faction: 'Tower' });
      expect(model.position.toArray()).toEqual([0, 0, 0]);
      expect(Boolean(model.getObjectByName('completed'))).toBe(built);
      expect(Boolean(model.getObjectByName('construction'))).toBe(!built);

      const parts = meshes(model);
      expect(parts.length).toBeGreaterThan(8);
      for (const part of parts) {
        expect(part.geometry.getAttribute('position').count).toBeGreaterThan(0);
        expect(part.castShadow).toBe(true);
        expect(part.receiveShadow).toBe(true);
        expect(part.visible).toBe(true);
      }

      const box = bounds(model);
      const size = box.getSize(new THREE.Vector3());
      for (const value of [...box.min.toArray(), ...box.max.toArray()]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(box.min.y).toBeGreaterThanOrEqual(-0.000001);
      expect(box.min.y).toBeCloseTo(0, 6);
      expect(size.x).toBeLessThanOrEqual(3.700001);
      expect(size.z).toBeLessThanOrEqual(3.500001);
      expect(size.y).toBeLessThanOrEqual(HEIGHTS[id]! + 0.000001);
      expect(size.y).toBeGreaterThan(1.5);
    }
  });

  it('gives every built dwelling a distinct silhouette and a different construction state', () => {
    const builtSignatures = new Set<string>();
    for (const id of TOWER_DWELLINGS) {
      const built = createBuildingModel(id, true)!;
      const unbuilt = createBuildingModel(id, false)!;
      builtSignatures.add(signature(built));
      expect(signature(built)).not.toBe(signature(unbuilt));
      expect(bounds(built).getSize(new THREE.Vector3()).y)
        .toBeGreaterThan(bounds(unbuilt).getSize(new THREE.Vector3()).y);
      const ghostParts = meshes(unbuilt).filter((part) => {
        const material = part.material as THREE.MeshStandardMaterial;
        return material.transparent && material.opacity < 1;
      });
      expect(ghostParts.length).toBeGreaterThan(0);
    }
    expect(builtSignatures.size).toBe(TOWER_DWELLINGS.length);
  });

  it.each(TOWER_DWELLINGS)('keeps %s pickable as ordinary mesh geometry in both states', (id) => {
    for (const built of [true, false]) {
      const model = createBuildingModel(id, built)!;
      model.updateMatrixWorld(true);
      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(0, 1.1, 8),
        new THREE.Vector3(0, 0, -1),
      );
      expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
    }
  });

  it('uses independent disposable resources for separate model instances', () => {
    const first = createBuildingModel('titanCloudTemple', true)!;
    const second = createBuildingModel('titanCloudTemple', true)!;
    const firstResources = resources(first);
    const secondResources = resources(second);
    expect(firstResources.geometries.size).toBe(meshes(first).length);
    expect(firstResources.materials.size).toBeGreaterThan(3);
    for (const geometry of firstResources.geometries) {
      expect(secondResources.geometries.has(geometry)).toBe(false);
    }
    for (const material of firstResources.materials) {
      expect(secondResources.materials.has(material)).toBe(false);
    }
    for (const geometry of firstResources.geometries) geometry.dispose();
    for (const material of firstResources.materials) material.dispose();
    expect(meshes(second).every((part) => part.geometry.getAttribute('position').count > 0)).toBe(true);
    for (const geometry of secondResources.geometries) geometry.dispose();
    for (const material of secondResources.materials) material.dispose();
  });
});
