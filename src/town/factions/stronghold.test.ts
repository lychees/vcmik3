import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDINGS, CREATURES } from '../../game/content';
import { FACTIONS } from '../../game/factions';
import strongholdPack, { createBuildingModel } from './stronghold';

interface FactionModelPack {
  faction: string;
  createBuildingModel(buildingId: string, built: boolean): THREE.Group | null;
}

const pack: FactionModelPack = strongholdPack;
const DWELLING_IDS = FACTIONS.stronghold.buildingIds;
const HEIGHT_LIMITS: Readonly<Record<string, number>> = {
  goblinBarracks: 3.2,
  wolfPen: 3,
  ogreFort: 4.4,
  behemothCliffs: 5.2,
};
const BUILT_MARKERS: Readonly<Record<string, string>> = {
  goblinBarracks: 'goblin-war-standard',
  wolfPen: 'wolf-totem',
  ogreFort: 'ogre-war-club',
  behemothCliffs: 'behemoth-skull',
};

const liveModels = new Set<THREE.Group>();

function createModel(buildingId: string, built: boolean): THREE.Group {
  const model = pack.createBuildingModel(buildingId, built);
  if (!model) throw new Error(`Expected Stronghold model: ${buildingId}`);
  liveModels.add(model);
  return model;
}

function meshesIn(model: THREE.Group): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  model.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  return meshes;
}

function resourcesIn(model: THREE.Group): {
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
} {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const mesh of meshesIn(model)) {
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  }
  return { geometries, materials };
}

function boundsOf(model: THREE.Group): THREE.Box3 {
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(model);
}

function signatureOf(model: THREE.Group): string {
  return meshesIn(model).map((mesh) => [
    mesh.geometry.type,
    ...mesh.position.toArray(),
    ...mesh.scale.toArray(),
  ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(':')).join('|');
}

afterEach(() => {
  for (const model of liveModels) {
    const { geometries, materials } = resourcesIn(model);
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }
  liveModels.clear();
});

describe('Stronghold faction model pack contract', () => {
  it('exports the pack contract and covers exactly the four Stronghold dwellings in game content', () => {
    expect(pack.faction).toBe('Stronghold');
    expect(pack.createBuildingModel).toBe(createBuildingModel);
    expect(DWELLING_IDS).toEqual(['goblinBarracks', 'wolfPen', 'ogreFort', 'behemothCliffs']);

    const contentIds = Object.values(BUILDINGS)
      .filter((building) => building.creatureId !== undefined && CREATURES[building.creatureId]?.faction === 'Stronghold')
      .map((building) => building.id);
    expect([...DWELLING_IDS].sort()).toEqual(contentIds.sort());
    expect(DWELLING_IDS).toHaveLength(4);

    for (const [index, id] of DWELLING_IDS.entries()) {
      expect(BUILDINGS[id]?.creatureId).toBe(FACTIONS.stronghold.creatureIds[index]);
      expect(createModel(id, true)).toBeInstanceOf(THREE.Group);
      expect(createModel(id, false)).toBeInstanceOf(THREE.Group);
    }
  });

  it('returns null for uncustomized common, foreign, unknown, and inherited IDs', () => {
    const ids = [
      'townHall', 'capitol', 'market', 'fort', 'mageGuild',
      'militiaBarracks', 'troglodyteWarrens', 'pixieGarden',
      'unknown', 'toString', '__proto__', '',
    ];
    for (const id of ids) {
      expect(pack.createBuildingModel(id, true)).toBeNull();
      expect(pack.createBuildingModel(id, false)).toBeNull();
    }
  });

  it.each(DWELLING_IDS)('provides complete and under-construction states for %s', (id) => {
    const built = createModel(id, true);
    const unbuilt = createModel(id, false);
    const building = BUILDINGS[id]!;
    const creature = CREATURES[building.creatureId!]!;

    for (const [model, state] of [[built, true], [unbuilt, false]] as const) {
      expect(model.name).toBe(id);
      expect(model.position.toArray()).toEqual([0, 0, 0]);
      expect(model.userData).toMatchObject({
        faction: 'stronghold',
        buildingId: id,
        creatureId: building.creatureId,
        tier: creature.tier,
        built: state,
        constructionState: state ? 'complete' : 'underConstruction',
      });
      expect(meshesIn(model).length).toBeGreaterThan(10);
    }

    expect(built.getObjectByName(BUILT_MARKERS[id]!)).toBeDefined();
    expect(built.getObjectByName('construction-site')).toBeUndefined();
    expect(unbuilt.getObjectByName(BUILT_MARKERS[id]!)).toBeUndefined();
    expect(unbuilt.getObjectByName('construction-site')).toBeDefined();
    expect(unbuilt.getObjectByName(`${id}-blueprint`)).toBeDefined();
    expect(boundsOf(built).max.y).toBeGreaterThan(boundsOf(unbuilt).max.y);
    expect(signatureOf(built)).not.toBe(signatureOf(unbuilt));
  });
});

describe('Stronghold dwelling geometry', () => {
  it.each(DWELLING_IDS)('keeps %s finite, grounded, bounded, shadowed, and pickable in both states', (id) => {
    for (const built of [true, false]) {
      const model = createModel(id, built);
      const bounds = boundsOf(model);
      const size = bounds.getSize(new THREE.Vector3());

      expect(bounds.min.y).toBeGreaterThanOrEqual(-0.000001);
      expect(bounds.min.y).toBeCloseTo(0, 5);
      expect(bounds.max.y).toBeLessThanOrEqual(HEIGHT_LIMITS[id]! + 0.000001);
      expect(bounds.min.x).toBeGreaterThanOrEqual(-1.85 - 0.000001);
      expect(bounds.max.x).toBeLessThanOrEqual(1.85 + 0.000001);
      expect(bounds.min.z).toBeGreaterThanOrEqual(-1.75 - 0.000001);
      expect(bounds.max.z).toBeLessThanOrEqual(1.75 + 0.000001);
      expect(size.x).toBeGreaterThan(1);
      expect(size.y).toBeGreaterThan(0.5);
      expect(size.z).toBeGreaterThan(1);
      for (const value of [...bounds.min.toArray(), ...bounds.max.toArray()]) {
        expect(Number.isFinite(value)).toBe(true);
      }

      for (const mesh of meshesIn(model)) {
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
        expect(mesh.visible).toBe(true);
        const positions = mesh.geometry.getAttribute('position');
        expect(positions.count).toBeGreaterThan(0);
        expect(positions.array.every(Number.isFinite)).toBe(true);
      }

      const raycaster = new THREE.Raycaster(
        new THREE.Vector3(0, 0.08, 10),
        new THREE.Vector3(0, 0, -1),
      );
      expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
    }
  });

  it.each(DWELLING_IDS)('gives %s independent geometry and materials for core-owned disposal', (id) => {
    for (const built of [true, false]) {
      const first = resourcesIn(createModel(id, built));
      const second = resourcesIn(createModel(id, built));
      for (const geometry of second.geometries) expect(first.geometries.has(geometry)).toBe(false);
      for (const material of second.materials) expect(first.materials.has(material)).toBe(false);
    }
  });

  it('provides four different finished architectural silhouettes', () => {
    const signatures = new Set(DWELLING_IDS.map((id) => signatureOf(createModel(id, true))));
    expect(signatures.size).toBe(4);
  });
});
