import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDINGS, CREATURES } from '../../game/content';
import { FACTIONS } from '../../game/factions';
import factoryModelPack from './factory';

interface FactionModelPack {
  faction: string;
  createBuildingModel(buildingId: string, built: boolean): THREE.Group | null;
}

const pack: FactionModelPack = factoryModelPack;
const FACTORY_DWELLING_IDS = FACTIONS.factory.buildingIds;
const LIMITS: Readonly<Record<string, number>> = {
  halflingHovels: 2.9,
  automatonAssembly: 4,
  dreadnoughtFoundry: 4.7,
  juggernautHangar: 5,
};
const BUILT_LANDMARKS: Readonly<Record<string, string>> = {
  halflingHovels: 'halfling-target',
  automatonAssembly: 'automaton-assembly-arms',
  dreadnoughtFoundry: 'dreadnought-cannon',
  juggernautHangar: 'juggernaut-siege-engine',
};

const liveModels = new Set<THREE.Group>();

function createModel(buildingId: string, built: boolean): THREE.Group {
  const model = pack.createBuildingModel(buildingId, built);
  expect(model).toBeInstanceOf(THREE.Group);
  liveModels.add(model!);
  return model!;
}

function meshes(model: THREE.Group): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) result.push(child);
  });
  return result;
}

function resources(model: THREE.Group): {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
} {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const part of meshes(model)) {
    geometries.add(part.geometry);
    for (const surface of Array.isArray(part.material) ? part.material : [part.material]) {
      materials.add(surface);
    }
  }
  return { geometries, materials };
}

function dispose(model: THREE.Group): void {
  const owned = resources(model);
  for (const geometry of owned.geometries) geometry.dispose();
  for (const surface of owned.materials) surface.dispose();
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

afterEach(() => {
  for (const model of liveModels) dispose(model);
  liveModels.clear();
});

describe('Factory faction model pack contract', () => {
  it('exports exactly the standalone pack contract and covers the actual Factory roster', () => {
    const contentIds = Object.values(BUILDINGS)
      .filter((building) => building.creatureId !== undefined
        && CREATURES[building.creatureId]?.faction === 'Factory')
      .map((building) => building.id);
    expect([...FACTORY_DWELLING_IDS].sort()).toEqual(contentIds.sort());
    expect(FACTORY_DWELLING_IDS).toEqual([
      'halflingHovels',
      'automatonAssembly',
      'dreadnoughtFoundry',
      'juggernautHangar',
    ]);
    expect(pack.faction).toBe('Factory');
    expect(Object.keys(factoryModelPack).sort()).toEqual(['createBuildingModel', 'faction']);
  });

  it('returns null for common buildings, other factions, unknown IDs, and object prototype keys', () => {
    const uncustomized = [
      'townHall',
      'capitol',
      'market',
      'fort',
      'mageGuild',
      'gremlinWorkshop',
      'banditHideout',
      'unknown',
      '__proto__',
      'toString',
    ];
    for (const id of uncustomized) {
      expect(pack.createBuildingModel(id, true)).toBeNull();
      expect(pack.createBuildingModel(id, false)).toBeNull();
    }
  });

  it.each(FACTORY_DWELLING_IDS)('creates distinct built and unbuilt states for %s with unit and tier metadata', (id) => {
    const built = createModel(id, true);
    const unbuilt = createModel(id, false);
    const building = BUILDINGS[id]!;
    const creature = CREATURES[building.creatureId!]!;
    for (const [model, state] of [[built, true], [unbuilt, false]] as const) {
      expect(model.name).toBe(id);
      expect(model.userData).toMatchObject({
        faction: 'factory',
        buildingId: id,
        creatureId: building.creatureId,
        tier: creature.tier,
        built: state,
        constructionState: state ? 'complete' : 'underConstruction',
      });
      expect(model.position.toArray()).toEqual([0, 0, 0]);
      expect(Boolean(model.getObjectByName('completed'))).toBe(state);
      expect(Boolean(model.getObjectByName('construction'))).toBe(!state);
      expect(model.children.length).toBeGreaterThan(0);
    }
    expect(bounds(built).max.y).toBeGreaterThan(bounds(unbuilt).max.y);
    expect(built.getObjectByName(BUILT_LANDMARKS[id]!)).toBeDefined();
    expect(unbuilt.getObjectByName(BUILT_LANDMARKS[id]!)).toBeUndefined();
    expect(unbuilt.getObjectByName('blueprint-ghost')).toBeInstanceOf(THREE.Mesh);
    expect(built.getObjectByName('blueprint-ghost')).toBeUndefined();
    expect(signature(built)).not.toBe(signature(unbuilt));
  });
});

describe('Factory dwelling geometry', () => {
  it.each(FACTORY_DWELLING_IDS)('keeps %s grounded, finite, bounded, shadowed, and pickable in both states', (id) => {
    for (const built of [true, false]) {
      const model = createModel(id, built);
      const box = bounds(model);
      const size = box.getSize(new THREE.Vector3());
      for (const value of [...box.min.toArray(), ...box.max.toArray()]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(box.min.y).toBeGreaterThanOrEqual(-0.000001);
      expect(box.min.y).toBeCloseTo(0, 5);
      expect(size.x).toBeGreaterThan(1);
      expect(size.z).toBeGreaterThan(1);
      expect(size.x).toBeLessThanOrEqual(3.700001);
      expect(size.z).toBeLessThanOrEqual(3.500001);
      expect(box.max.y).toBeLessThanOrEqual(LIMITS[id]! + 0.000001);
      expect(size.y).toBeGreaterThan(1);

      const parts = meshes(model);
      expect(parts.length).toBeGreaterThan(10);
      for (const part of parts) {
        expect(part.castShadow).toBe(true);
        expect(part.receiveShadow).toBe(true);
        expect(part.visible).toBe(true);
        const position = part.geometry.getAttribute('position');
        expect(position.count).toBeGreaterThan(0);
        for (let index = 0; index < position.array.length; index += 1) {
          expect(Number.isFinite(position.array[index])).toBe(true);
        }
      }

      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(0, 1, 8),
        new THREE.Vector3(0, 0, -1),
      );
      expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
    }
  });

  it.each(FACTORY_DWELLING_IDS)('gives %s independent geometry and materials for core-owned disposal', (id) => {
    for (const built of [true, false]) {
      const first = createModel(id, built);
      const second = createModel(id, built);
      const firstResources = resources(first);
      const secondResources = resources(second);
      expect(firstResources.geometries.size).toBe(meshes(first).length);
      expect(firstResources.materials.size).toBeGreaterThan(5);
      for (const geometry of firstResources.geometries) {
        expect(secondResources.geometries.has(geometry)).toBe(false);
      }
      for (const surface of firstResources.materials) {
        expect(secondResources.materials.has(surface)).toBe(false);
      }
      dispose(first);
      liveModels.delete(first);
      expect(meshes(second).every((part) => part.geometry.getAttribute('position').count > 0)).toBe(true);
    }
  });

  it('provides four different finished mechanical silhouettes with brass gear details', () => {
    const signatures = new Set<string>();
    for (const id of FACTORY_DWELLING_IDS) {
      const model = createModel(id, true);
      signatures.add(signature(model));
      const brassParts = meshes(model).filter((part) => {
        const surface = Array.isArray(part.material) ? part.material[0] : part.material;
        return surface instanceof THREE.MeshStandardMaterial && surface.metalness >= 0.5;
      });
      expect(brassParts.length).toBeGreaterThan(5);
    }
    expect(signatures.size).toBe(4);
  });
});
