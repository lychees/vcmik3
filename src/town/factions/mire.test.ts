import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BUILDINGS, CREATURES } from '../../game/content';
import mirePack from './mire';

const DWELLING_CASES = [
  ['lizardmanDen', 3.0, 1],
  ['gorgonPen', 3.2, 2],
  ['wyvernRoost', 4.8, 3],
  ['basiliskPit', 4.0, 4],
] as const;

const MIRE_DWELLING_IDS = Object.values(BUILDINGS)
  .filter((building) => building.creatureId && CREATURES[building.creatureId]?.faction === 'Mire')
  .map((building) => building.id);

function getMeshes(group: THREE.Group): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) meshes.push(child);
  });
  return meshes;
}

function getMaterials(group: THREE.Group): Set<THREE.Material> {
  const materials = new Set<THREE.Material>();
  for (const mesh of getMeshes(group)) {
    const surfaces = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const surface of surfaces) materials.add(surface);
  }
  return materials;
}

function disposeModel(group: THREE.Group): void {
  const geometries = new Set(getMeshes(group).map((mesh) => mesh.geometry));
  for (const geometry of geometries) geometry.dispose();
  for (const surface of getMaterials(group)) surface.dispose();
}

function geometrySignature(group: THREE.Group): string {
  return getMeshes(group).map((mesh) => [
    mesh.geometry.type,
    ...mesh.position.toArray(),
    ...mesh.scale.toArray(),
    ...mesh.quaternion.toArray(),
  ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(':')).join('|');
}

describe('Mire faction model pack', () => {
  it('exports the exact pack contract and covers the Mire dwellings in BUILDINGS', () => {
    expect(Object.keys(mirePack).sort()).toEqual(['createBuildingModel', 'faction']);
    expect(mirePack.faction).toBe('Mire');
    expect(MIRE_DWELLING_IDS).toEqual(DWELLING_CASES.map(([id]) => id));

    for (const [id, , tier] of DWELLING_CASES) {
      for (const built of [false, true]) {
        const model = mirePack.createBuildingModel(id, built);
        expect(model).toBeInstanceOf(THREE.Group);
        expect(model?.name).toBe(id);
        expect(model?.userData).toMatchObject({
          faction: 'Mire',
          buildingId: id,
          built,
          tier,
        });
        expect(model?.getObjectByName(built ? 'completed-dwelling' : 'construction-site')).toBeInstanceOf(THREE.Group);
      }
    }
  });

  it('returns null for every uncustomized common or other-faction building', () => {
    const customized = new Set(MIRE_DWELLING_IDS);
    const uncustomized = Object.keys(BUILDINGS).filter((id) => !customized.has(id));
    expect(uncustomized.length).toBeGreaterThan(0);
    for (const id of uncustomized) {
      expect(mirePack.createBuildingModel(id, true)).toBeNull();
      expect(mirePack.createBuildingModel(id, false)).toBeNull();
    }
    for (const id of ['unknownBuilding', '__proto__', 'toString', '']) {
      expect(mirePack.createBuildingModel(id, true)).toBeNull();
    }
  });

  it.each(DWELLING_CASES)('%s keeps both states grounded, bounded, finite and raycastable', (id, maxHeight) => {
    for (const built of [false, true]) {
      const model = mirePack.createBuildingModel(id, built)!;
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      expect(bounds.isEmpty()).toBe(false);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.001);
      expect(bounds.min.y).toBeCloseTo(0, 4);
      expect(bounds.max.y).toBeLessThanOrEqual(maxHeight + 0.001);
      expect(size.x).toBeLessThanOrEqual(3.7 + 0.001);
      expect(size.z).toBeLessThanOrEqual(3.5 + 0.001);
      expect(size.y).toBeGreaterThan(0.5);
      for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
        expect(Number.isFinite(value)).toBe(true);
      }

      const meshes = getMeshes(model);
      expect(meshes.length).toBeGreaterThan(5);
      expect(meshes.some((mesh) => mesh.castShadow)).toBe(true);
      for (const mesh of meshes) {
        const positions = mesh.geometry.getAttribute('position');
        expect(positions).toBeDefined();
        expect(positions.array.every(Number.isFinite)).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
      }

      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(0, 10, 0),
        new THREE.Vector3(0, -1, 0),
      );
      expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
      disposeModel(model);
    }
  });

  it('gives all four built dwellings distinct silhouettes and visibly different construction states', () => {
    const signatures = new Set<string>();
    for (const [id] of DWELLING_CASES) {
      const built = mirePack.createBuildingModel(id, true)!;
      const unbuilt = mirePack.createBuildingModel(id, false)!;
      const builtSignature = geometrySignature(built);
      signatures.add(builtSignature);
      expect(builtSignature).not.toBe(geometrySignature(unbuilt));
      expect(getMeshes(built).length).not.toBe(getMeshes(unbuilt).length);
      disposeModel(built);
      disposeModel(unbuilt);
    }
    expect(signatures.size).toBe(4);
  });

  it.each(DWELLING_CASES)('%s gives each model instance independently disposable resources', (id) => {
    for (const built of [false, true]) {
      const first = mirePack.createBuildingModel(id, built)!;
      const second = mirePack.createBuildingModel(id, built)!;
      const firstGeometries = new Set(getMeshes(first).map((mesh) => mesh.geometry));
      const secondGeometries = new Set(getMeshes(second).map((mesh) => mesh.geometry));
      const firstMaterials = getMaterials(first);
      const secondMaterials = getMaterials(second);

      for (const geometry of firstGeometries) expect(secondGeometries.has(geometry)).toBe(false);
      for (const surface of firstMaterials) expect(secondMaterials.has(surface)).toBe(false);
      expect(() => {
        disposeModel(first);
        disposeModel(second);
      }).not.toThrow();
    }
  });
});
