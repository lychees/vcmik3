import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BUILDINGS, CREATURES, FACTIONS } from '../../game/content';
import covePack from './cove';

const COVE_DWELLINGS = [
  'nymphGrotto',
  'corsairTavern',
  'seaWitchTower',
  'seaSerpentCove',
] as const;

function meshes(model: THREE.Group): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) result.push(child);
  });
  return result;
}

function signature(model: THREE.Group): string {
  return meshes(model).map((part) => {
    const surface = part.material as THREE.MeshStandardMaterial;
    return [
      part.geometry.type,
      ...part.position.toArray(),
      ...part.scale.toArray(),
      surface.color.getHex(),
    ].join(':');
  }).join('|');
}

function dispose(model: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const part of meshes(model)) {
    geometries.add(part.geometry);
    for (const surface of Array.isArray(part.material) ? part.material : [part.material]) {
      materials.add(surface);
    }
  }
  for (const geometry of geometries) geometry.dispose();
  for (const surface of materials) surface.dispose();
}

describe('Cove faction model pack', () => {
  it('exports the standalone pack contract and covers the actual Cove dwelling roster', () => {
    expect(covePack.faction).toBe('Cove');
    expect(typeof covePack.createBuildingModel).toBe('function');
    expect(Object.keys(covePack).sort()).toEqual(['createBuildingModel', 'faction']);

    const contentIds = Object.values(BUILDINGS)
      .filter((building) => building.creatureId && CREATURES[building.creatureId]?.faction === 'Cove')
      .map((building) => building.id)
      .sort();
    expect(contentIds).toEqual([...COVE_DWELLINGS].sort());
    expect([...FACTIONS.cove.buildingIds].sort()).toEqual([...COVE_DWELLINGS].sort());
  });

  it.each(COVE_DWELLINGS)('creates built and unbuilt models for %s with explicit state metadata', (buildingId) => {
    for (const built of [false, true]) {
      const model = covePack.createBuildingModel(buildingId, built);
      expect(model).toBeInstanceOf(THREE.Group);
      expect(model?.userData).toMatchObject({
        faction: 'Cove',
        buildingId,
        built,
        modelPack: 'Cove',
      });
      expect(model?.name).toBe(`cove-${buildingId}-${built ? 'built' : 'unbuilt'}`);
      expect(meshes(model!).length).toBeGreaterThan(8);
      dispose(model!);
    }
  });

  it('returns null for every common or other-faction building and unknown IDs', () => {
    const uncustomized = Object.keys(BUILDINGS).filter((id) => !COVE_DWELLINGS.includes(id as typeof COVE_DWELLINGS[number]));
    for (const buildingId of [...uncustomized, 'notABuilding', '__proto__', 'toString']) {
      expect(covePack.createBuildingModel(buildingId, false)).toBeNull();
      expect(covePack.createBuildingModel(buildingId, true)).toBeNull();
    }
  });

  it.each(COVE_DWELLINGS)('keeps %s grounded, bounded, finite, shadowed, and raycastable in both states', (buildingId) => {
    for (const built of [false, true]) {
      const model = covePack.createBuildingModel(buildingId, built)!;
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.0001);
      expect(bounds.max.y).toBeGreaterThan(0.5);
      expect(bounds.max.y).toBeLessThanOrEqual(3.2);
      expect(size.x).toBeGreaterThan(0.8);
      expect(size.x).toBeLessThanOrEqual(2.4);
      expect(size.z).toBeGreaterThan(0.8);
      expect(size.z).toBeLessThanOrEqual(2.4);

      for (const part of meshes(model)) {
        const positions = part.geometry.getAttribute('position');
        expect(positions.count).toBeGreaterThan(0);
        for (let index = 0; index < positions.count; index += 1) {
          expect(Number.isFinite(positions.getX(index))).toBe(true);
          expect(Number.isFinite(positions.getY(index))).toBe(true);
          expect(Number.isFinite(positions.getZ(index))).toBe(true);
        }
        expect(part.matrixWorld.elements.every(Number.isFinite)).toBe(true);
        expect(part.castShadow).toBe(true);
        expect(part.receiveShadow).toBe(true);
        expect(part.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      }

      const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0.16, 4), new THREE.Vector3(0, 0, -1));
      expect(raycaster.intersectObject(model, true).length, `${buildingId} ${built}`).toBeGreaterThan(0);
      dispose(model);
    }
  });

  it('gives all completed dwellings distinct silhouettes and visibly different construction states', () => {
    const completedSignatures = new Set<string>();
    for (const buildingId of COVE_DWELLINGS) {
      const built = covePack.createBuildingModel(buildingId, true)!;
      const unbuilt = covePack.createBuildingModel(buildingId, false)!;
      completedSignatures.add(signature(built));
      expect(signature(unbuilt)).not.toBe(signature(built));
      expect(meshes(unbuilt).some((part) => part.geometry instanceof THREE.BoxGeometry)).toBe(true);
      dispose(built);
      dispose(unbuilt);
    }
    expect(completedSignatures.size).toBe(COVE_DWELLINGS.length);
  });

  it('does not share disposable geometry or materials between model instances', () => {
    const first = covePack.createBuildingModel('corsairTavern', true)!;
    const second = covePack.createBuildingModel('corsairTavern', true)!;
    const secondMaterials = new Set<THREE.Material>();
    for (const part of meshes(second)) {
      for (const surface of Array.isArray(part.material) ? part.material : [part.material]) {
        secondMaterials.add(surface);
      }
    }
    let prematureDisposals = 0;
    for (const surface of secondMaterials) {
      surface.addEventListener('dispose', () => {
        prematureDisposals += 1;
      });
    }
    const intactSignature = signature(second);
    dispose(first);
    expect(prematureDisposals).toBe(0);
    expect(signature(second)).toBe(intactSignature);
    dispose(second);
  });
});
