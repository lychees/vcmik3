import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { BUILDINGS, CREATURES } from '../../game/content';
import confluxPack from './conflux';

const EXPECTED_MODELS = {
  pixieGarden: { height: 3.6, tier: 1 },
  airElementalAltar: { height: 4.2, tier: 2 },
  stormElementalSpire: { height: 5.5, tier: 3 },
  phoenixPyre: { height: 5.1, tier: 4 },
} as const;

const DWELLING_IDS = Object.values(BUILDINGS)
  .filter((building) => building.creatureId && CREATURES[building.creatureId]?.faction === 'Conflux')
  .map((building) => building.id) as (keyof typeof EXPECTED_MODELS)[];

type ModelMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material>;

function meshes(model: THREE.Group): ModelMesh[] {
  const result: ModelMesh[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.Mesh && !Array.isArray(object.material)) {
      result.push(object as ModelMesh);
    }
  });
  return result;
}

function resources(model: THREE.Group): {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
} {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const object of meshes(model)) {
    geometries.add(object.geometry);
    for (const surface of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(surface);
    }
  }
  return { geometries, materials };
}

function signature(model: THREE.Group): string {
  return JSON.stringify(meshes(model).map((object) => ({
    geometry: object.geometry.type,
    position: object.position.toArray().map((value) => value.toFixed(3)),
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z].map((value) => value.toFixed(3)),
    scale: object.scale.toArray().map((value) => value.toFixed(3)),
  })));
}

describe('Conflux faction model pack', () => {
  it('matches the four Conflux dwellings in BUILDINGS and exports the pack contract', () => {
    expect([...DWELLING_IDS].sort()).toEqual(Object.keys(EXPECTED_MODELS).sort());
    expect(DWELLING_IDS).toHaveLength(4);
    expect(confluxPack.faction).toBe('Conflux');
    expect(confluxPack.createBuildingModel).toBeTypeOf('function');
  });

  it.each(['townHall', 'capitol', 'market', 'fort', 'mageGuild', 'militiaBarracks', 'unknown', ''])(
    'returns null for uncustomized building %s',
    (buildingId) => {
      expect(confluxPack.createBuildingModel(buildingId, true)).toBeNull();
      expect(confluxPack.createBuildingModel(buildingId, false)).toBeNull();
    },
  );

  it.each(DWELLING_IDS)('creates grounded, bounded, finite and pickable states for %s', (buildingId) => {
    for (const built of [true, false]) {
      const model = confluxPack.createBuildingModel(buildingId, built);
      expect(model).toBeInstanceOf(THREE.Group);
      if (!model) throw new Error('Expected a Conflux model');
      expect(model.userData).toMatchObject({
        faction: 'Conflux',
        buildingId,
        built,
        tier: EXPECTED_MODELS[buildingId].tier,
      });

      const objects = meshes(model);
      expect(objects.length).toBeGreaterThanOrEqual(10);
      for (const object of objects) {
        const positions = object.geometry.getAttribute('position');
        expect(positions.count).toBeGreaterThan(0);
        expect(Array.from(positions.array).every(Number.isFinite)).toBe(true);
        expect(object.castShadow).toBe(!object.material.transparent);
        expect(object.receiveShadow).toBe(true);
      }

      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      expect(bounds.min.y).toBeCloseTo(0, 5);
      expect(size.x).toBeLessThanOrEqual(3.7);
      expect(size.z).toBeLessThanOrEqual(3.5);
      expect(bounds.max.y).toBeLessThanOrEqual(EXPECTED_MODELS[buildingId].height + 0.00001);
      expect(Array.from(bounds.min.toArray()).every(Number.isFinite)).toBe(true);
      expect(Array.from(bounds.max.toArray()).every(Number.isFinite)).toBe(true);

      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(0, 10, 0),
        new THREE.Vector3(0, -1, 0),
      );
      expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
    }
  });

  it.each(DWELLING_IDS)('makes built and unbuilt states visibly different for %s', (buildingId) => {
    const built = confluxPack.createBuildingModel(buildingId, true);
    const unbuilt = confluxPack.createBuildingModel(buildingId, false);
    expect(built).not.toBeNull();
    expect(unbuilt).not.toBeNull();
    if (!built || !unbuilt) throw new Error('Expected both Conflux states');

    expect(signature(built)).not.toBe(signature(unbuilt));
    expect(meshes(built).length).toBeGreaterThan(meshes(unbuilt).length);
    expect(meshes(unbuilt).some((object) => object.material.transparent)).toBe(true);
    expect(unbuilt.name).toContain('unbuilt');
    expect(built.name).toContain('built');
  });

  it('gives every completed dwelling a distinct procedural silhouette', () => {
    const silhouettes = DWELLING_IDS.map((buildingId) => {
      const model = confluxPack.createBuildingModel(buildingId, true);
      if (!model) throw new Error(`Expected model for ${buildingId}`);
      return signature(model);
    });
    expect(new Set(silhouettes).size).toBe(DWELLING_IDS.length);
  });

  it('does not share disposable geometry or materials between model instances', () => {
    const first = confluxPack.createBuildingModel('airElementalAltar', true);
    const second = confluxPack.createBuildingModel('airElementalAltar', true);
    if (!first || !second) throw new Error('Expected independent air altars');
    const firstResources = resources(first);
    const secondResources = resources(second);

    for (const geometry of firstResources.geometries) {
      expect(secondResources.geometries.has(geometry)).toBe(false);
    }
    for (const surface of firstResources.materials) {
      expect(secondResources.materials.has(surface)).toBe(false);
    }
  });

  it.each(DWELLING_IDS)('owns fully disposable resources in both states for %s', (buildingId) => {
    for (const built of [true, false]) {
      const model = confluxPack.createBuildingModel(buildingId, built);
      if (!model) throw new Error('Expected disposable Conflux model');
      const { geometries, materials } = resources(model);
      const geometryDisposals = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
      const materialDisposals = [...materials].map((surface) => vi.spyOn(surface, 'dispose'));

      for (const geometry of geometries) geometry.dispose();
      for (const surface of materials) surface.dispose();

      expect(geometries.size).toBeGreaterThan(0);
      expect(materials.size).toBeGreaterThan(0);
      expect(geometryDisposals.every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
      expect(materialDisposals.every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
    }
  });
});
