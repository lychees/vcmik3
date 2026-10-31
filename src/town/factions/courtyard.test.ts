import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDINGS, CREATURES } from '../../game/content';
import courtyard from './courtyard';

const DWELLING_IDS = ['pageBarracks', 'duelistSalon', 'courtWizardLibrary', 'royalLionGarden'] as const;
const STATES = DWELLING_IDS.flatMap((id) => [{ id, built: true }, { id, built: false }]);
const LANDMARKS = {
  pageBarracks: 'practice-dummy',
  duelistSalon: 'crossed-rapiers',
  courtWizardLibrary: 'astrolabe',
  royalLionGarden: 'winged-lion',
} as const;

const liveModels: THREE.Group[] = [];

function createModel(buildingId: string, built: boolean): THREE.Group {
  const model = courtyard.createBuildingModel(buildingId, built);
  if (!model) throw new Error(`Missing Courtyard model: ${buildingId}`);
  liveModels.push(model);
  return model;
}

function meshes(model: THREE.Group): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) result.push(child);
  });
  return result;
}

function silhouette(model: THREE.Group): string {
  return meshes(model).map((mesh) => [
    mesh.geometry.type,
    ...mesh.position.toArray(),
    ...mesh.scale.toArray(),
    ...mesh.rotation.toArray().slice(0, 3),
  ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(',')).join('|');
}

function disposeModel(model: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const mesh of meshes(model)) {
    geometries.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

afterEach(() => {
  for (const model of liveModels) disposeModel(model);
  liveModels.length = 0;
});

describe('Courtyard building model pack', () => {
  it('exports the standalone faction contract and covers the actual Courtyard registry roster', () => {
    expect(courtyard.faction).toBe('Courtyard');
    expect(typeof courtyard.createBuildingModel).toBe('function');
    const registryIds = Object.values(BUILDINGS).filter((building) => {
      const creature = building.creatureId ? CREATURES[building.creatureId] : undefined;
      return creature?.faction === 'Courtyard';
    }).map((building) => building.id);
    expect(registryIds).toHaveLength(4);
    expect([...registryIds].sort()).toEqual([...DWELLING_IDS].sort());
  });

  it('returns null for common, other-faction, unknown, and prototype-shaped building IDs', () => {
    const ids = ['townHall', 'capitol', 'market', 'fort', 'mageGuild', 'militiaBarracks', 'unknown', 'toString', '__proto__'];
    for (const id of ids) {
      expect(courtyard.createBuildingModel(id, true)).toBeNull();
      expect(courtyard.createBuildingModel(id, false)).toBeNull();
    }
  });

  it.each(STATES)('creates grounded, bounded, pickable geometry for $id (built: $built)', ({ id, built }) => {
    const model = createModel(id, built);
    const parts = meshes(model);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());

    expect(model.name).toBe(`Courtyard:${id}:${built ? 'built' : 'unbuilt'}`);
    expect(model.userData).toMatchObject({ buildingId: id, faction: 'Courtyard', built });
    expect(model.userData.tier).toBe(DWELLING_IDS.indexOf(id) + 1);
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    expect(parts.length).toBeGreaterThan(20);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.000001);
    expect(bounds.min.y).toBeCloseTo(0, 6);
    expect(bounds.max.y).toBeGreaterThan(0.6);
    expect(bounds.max.y).toBeLessThan(3.5);
    expect(size.x).toBeLessThanOrEqual(2.3);
    expect(size.z).toBeLessThanOrEqual(2);
    expect(model.userData.labelHeight).toBeCloseTo(bounds.max.y + 0.35, 6);

    for (const part of parts) {
      expect(part.castShadow).toBe(true);
      expect(part.receiveShadow).toBe(true);
      expect(part.geometry.getAttribute('position').count).toBeGreaterThan(0);
      expect(part.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      for (const value of part.geometry.getAttribute('position').array) expect(Number.isFinite(value)).toBe(true);
    }

    model.updateMatrixWorld(true);
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0.5, 4), new THREE.Vector3(0, 0, -1));
    expect(raycaster.intersectObject(model, true).length).toBeGreaterThan(0);
  });

  it.each(DWELLING_IDS)('gives %s materially different built and unbuilt structures', (id) => {
    const built = createModel(id, true);
    const unbuilt = createModel(id, false);
    expect(built.getObjectByName('completed-dwelling')).toBeDefined();
    expect(built.getObjectByName('construction-site')).toBeUndefined();
    expect(unbuilt.getObjectByName('construction-site')).toBeDefined();
    expect(unbuilt.getObjectByName('completed-dwelling')).toBeUndefined();
    expect(silhouette(built)).not.toBe(silhouette(unbuilt));
    expect(built.getObjectByName(LANDMARKS[id])).toBeDefined();
    expect(unbuilt.getObjectByName(LANDMARKS[id])).toBeUndefined();
    for (const part of meshes(unbuilt)) {
      const material = part.material as THREE.MeshStandardMaterial;
      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1);
    }
  });

  it('gives all four completed dwellings and all four construction sites distinct silhouettes', () => {
    const built = DWELLING_IDS.map((id) => createModel(id, true));
    const unbuilt = DWELLING_IDS.map((id) => createModel(id, false));
    expect(new Set(built.map(silhouette)).size).toBe(DWELLING_IDS.length);
    expect(new Set(unbuilt.map(silhouette)).size).toBe(DWELLING_IDS.length);
  });

  it('does not share disposable geometry or materials between model instances', () => {
    const first = meshes(createModel('courtWizardLibrary', true));
    const second = meshes(createModel('courtWizardLibrary', true));
    const firstGeometries = new Set(first.map((mesh) => mesh.geometry));
    const secondGeometries = new Set(second.map((mesh) => mesh.geometry));
    const firstMaterials = new Set(first.map((mesh) => mesh.material));
    const secondMaterials = new Set(second.map((mesh) => mesh.material));

    for (const geometry of firstGeometries) expect(secondGeometries.has(geometry)).toBe(false);
    for (const material of firstMaterials) expect(secondMaterials.has(material)).toBe(false);
    expect(() => disposeModel(createModel('royalLionGarden', false))).not.toThrow();
  });
});
