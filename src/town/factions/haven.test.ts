import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDINGS, CREATURES } from '../../game/content';
import { FACTIONS } from '../../game/factions';
import havenModelPack from './haven';

interface FactionModelPack {
  faction: string;
  createBuildingModel(buildingId: string, built: boolean): THREE.Group | null;
}

const pack: FactionModelPack = havenModelPack;
const HAVEN_DWELLING_IDS = FACTIONS.haven.buildingIds;
const LIMITS: Readonly<Record<string, { footprint: readonly [number, number]; height: number }>> = {
  militiaBarracks: { footprint: [3.7, 3.5], height: 3.2 },
  archeryRange: { footprint: [3.7, 3.5], height: 3.3 },
  griffinTower: { footprint: [3.7, 3.5], height: 5.2 },
  joustingArena: { footprint: [3.7, 3.5], height: 3.5 },
};
const BUILT_DETAILS: Readonly<Record<string, string>> = {
  militiaBarracks: 'militia-shield',
  archeryRange: 'archery-target',
  griffinTower: 'griffin-crest',
  joustingArena: 'jousting-barrier',
};

const liveModels = new Set<THREE.Group>();

function createModel(buildingId: string, built: boolean): THREE.Group {
  const model = pack.createBuildingModel(buildingId, built);
  expect(model).toBeInstanceOf(THREE.Group);
  liveModels.add(model!);
  return model!;
}

function resources(model: THREE.Group): { geometries: Set<THREE.BufferGeometry>; materials: Set<THREE.Material> } {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    geometries.add(child.geometry);
    for (const surface of Array.isArray(child.material) ? child.material : [child.material]) materials.add(surface);
  });
  return { geometries, materials };
}

function bounds(model: THREE.Group): THREE.Box3 {
  return new THREE.Box3().setFromObject(model);
}

afterEach(() => {
  for (const model of liveModels) {
    const owned = resources(model);
    for (const geometry of owned.geometries) geometry.dispose();
    for (const surface of owned.materials) surface.dispose();
  }
  liveModels.clear();
});

describe('Haven faction model pack contract', () => {
  it('covers exactly the four Haven dwellings declared by the game content', () => {
    const contentIds = Object.values(BUILDINGS)
      .filter((building) => building.creatureId !== undefined && CREATURES[building.creatureId]?.faction === 'Haven')
      .map((building) => building.id);
    expect([...HAVEN_DWELLING_IDS].sort()).toEqual(contentIds.sort());
    expect(HAVEN_DWELLING_IDS).toEqual([
      'militiaBarracks',
      'archeryRange',
      'griffinTower',
      'joustingArena',
    ]);
    expect(pack.faction).toBe('Haven');
  });

  it('returns null for common buildings, other factions, and unknown IDs', () => {
    for (const id of ['townHall', 'capitol', 'market', 'fort', 'mageGuild', 'spriteGlade', 'impWarrens', 'unknown', 'toString']) {
      expect(pack.createBuildingModel(id, true)).toBeNull();
      expect(pack.createBuildingModel(id, false)).toBeNull();
    }
  });

  it.each(HAVEN_DWELLING_IDS)('creates distinct built and unbuilt states for %s with unit and tier metadata', (id) => {
    const built = createModel(id, true);
    const unbuilt = createModel(id, false);
    const building = BUILDINGS[id]!;
    const creature = CREATURES[building.creatureId!]!;
    for (const [model, state] of [[built, true], [unbuilt, false]] as const) {
      expect(model.name).toBe(id);
      expect(model.userData.faction).toBe('Haven');
      expect(model.userData.buildingId).toBe(id);
      expect(model.userData.creatureId).toBe(building.creatureId);
      expect(model.userData.tier).toBe(creature.tier);
      expect(model.userData.built).toBe(state);
      expect(model.userData.constructionState).toBe(state ? 'complete' : 'underConstruction');
      expect(model.children.length).toBeGreaterThan(0);
    }
    expect(bounds(built).max.y).toBeGreaterThan(bounds(unbuilt).max.y);
    expect(built.getObjectByName(BUILT_DETAILS[id]!)).toBeDefined();
    expect(unbuilt.getObjectByName(BUILT_DETAILS[id]!)).toBeUndefined();
  });
});

describe('Haven dwelling geometry', () => {
  it.each(HAVEN_DWELLING_IDS)('keeps %s grounded, finite, bounded, shadowed, and raycast-pickable in both states', (id) => {
    for (const built of [true, false]) {
      const model = createModel(id, built);
      const box = bounds(model);
      const size = box.getSize(new THREE.Vector3());
      const limits = LIMITS[id]!;
      expect(box.min.y).toBeGreaterThanOrEqual(-0.000001);
      expect(box.min.y).toBeCloseTo(0, 5);
      expect(size.x).toBeGreaterThan(1);
      expect(size.z).toBeGreaterThan(1);
      expect(size.x).toBeLessThanOrEqual(limits.footprint[0] + 0.000001);
      expect(size.z).toBeLessThanOrEqual(limits.footprint[1] + 0.000001);
      expect(box.max.y).toBeLessThanOrEqual(limits.height + 0.000001);
      for (const value of [...box.min.toArray(), ...box.max.toArray()]) expect(Number.isFinite(value)).toBe(true);

      let meshCount = 0;
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        meshCount += 1;
        expect(child.castShadow).toBe(true);
        expect(child.receiveShadow).toBe(true);
        expect(child.visible).toBe(true);
        const position = child.geometry.getAttribute('position');
        expect(position.count).toBeGreaterThan(0);
        for (let index = 0; index < position.array.length; index += 1) {
          expect(Number.isFinite(position.array[index])).toBe(true);
        }
      });
      expect(meshCount).toBeGreaterThan(10);

      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(0, 0.08, 10),
        new THREE.Vector3(0, 0, -1),
      );
      expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
    }
  });

  it.each(HAVEN_DWELLING_IDS)('gives %s independent geometry and materials for core-owned disposal', (id) => {
    const first = resources(createModel(id, true));
    const second = resources(createModel(id, true));
    for (const geometry of first.geometries) expect(second.geometries.has(geometry)).toBe(false);
    for (const surface of first.materials) expect(second.materials.has(surface)).toBe(false);
  });

  it('provides four different finished architectural silhouettes', () => {
    const signatures = new Set<string>();
    for (const id of HAVEN_DWELLING_IDS) {
      const model = createModel(id, true);
      const parts: string[] = [];
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        parts.push(`${child.geometry.type}:${child.position.toArray().map((value) => value.toFixed(3)).join(',')}`);
      });
      signatures.add(parts.join('|'));
    }
    expect(signatures.size).toBe(4);
  });
});
