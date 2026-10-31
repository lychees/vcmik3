import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BUILDINGS } from '../game/content';
import { FACTIONS } from '../game/factions';
import { createBuildingModel, createCoreBuildingModel, disposeTownObject } from './models';
import { registerFactionModelPack } from './packs';
import { BUILDING_MODEL_REGISTRY, getBuildingModelSpec, type FactionId } from './registry';

function signature(group: THREE.Group): string {
  const parts: string[] = [];
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const surface = Array.isArray(child.material) ? child.material[0] : child.material;
    const color = surface && 'color' in surface && surface.color instanceof THREE.Color
      ? surface.color.getHex().toString(16)
      : 'none';
    parts.push([
      child.geometry.type,
      ...child.position.toArray(),
      ...child.scale.toArray(),
      ...child.rotation.toArray().slice(0, 3),
      color,
    ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(','));
  });
  return parts.join('|');
}

function meshCount(group: THREE.Group): number {
  let count = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) count += 1;
  });
  return count;
}

describe('complete procedural town model coverage', () => {
  it('creates distinct, valid built and unbuilt geometry for every building ID', () => {
    const builtSignatures = new Set<string>();
    for (const id of Object.keys(BUILDINGS)) {
      const spec = getBuildingModelSpec(id);
      const faction = spec.faction ?? 'haven';
      const built = createCoreBuildingModel(spec, faction, true);
      const unbuilt = createCoreBuildingModel(spec, faction, false);
      for (const model of [built, unbuilt]) {
        expect(model.userData.buildingId).toBe(id);
        expect(model.userData.faction).toBe(faction);
        expect(model.userData.form).toBe(spec.form);
        expect(meshCount(model)).toBeGreaterThan(5);
        const bounds = new THREE.Box3().setFromObject(model);
        expect(bounds.isEmpty()).toBe(false);
        expect(bounds.min.toArray().every(Number.isFinite)).toBe(true);
        expect(bounds.max.toArray().every(Number.isFinite)).toBe(true);
        expect(bounds.min.y, `${id} (${model.userData.built ? 'built' : 'unbuilt'})`).toBeGreaterThanOrEqual(-0.02);
        expect(model.userData.creatureId).toBe(BUILDINGS[id]!.creatureId);
      }
      expect(built.userData.built).toBe(true);
      expect(unbuilt.userData.built).toBe(false);
      expect(unbuilt.userData.ghost).toBe(true);
      expect(unbuilt.getObjectByName('blueprint-ghost')).toBeInstanceOf(THREE.Mesh);
      expect(unbuilt.getObjectByName('blueprint-outline')).toBeInstanceOf(THREE.LineSegments);
      expect(signature(built)).not.toBe(signature(unbuilt));
      builtSignatures.add(signature(built));
      disposeTownObject(built);
      disposeTownObject(unbuilt);
    }
    expect(builtSignatures.size).toBe(Object.keys(BUILDINGS).length);
  });

  it('gives common civic architecture a distinct silhouette in all 13 factions', () => {
    for (const id of ['townHall', 'capitol', 'market', 'fort', 'mageGuild']) {
      const signatures = new Set<string>();
      for (const faction of Object.keys(FACTIONS) as FactionId[]) {
        const model = createCoreBuildingModel(getBuildingModelSpec(id), faction, true);
        expect(model.userData.faction).toBe(faction);
        signatures.add(signature(model));
        disposeTownObject(model);
      }
      expect(signatures.size, id).toBe(13);
    }
  });

  it('uses registered faction packs first and supports explicit null fallback', () => {
    registerFactionModelPack({
      faction: 'Haven',
      createBuildingModel: (buildingId, built) => {
        const group = new THREE.Group();
        group.userData.packMarker = `${buildingId}:${built}`;
        group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
        return group;
      },
    });
    const custom = createBuildingModel(getBuildingModelSpec('townHall'), 'haven', true);
    expect(custom.userData.packMarker).toBe('townHall:true');
    expect(custom.userData.buildingId).toBe('townHall');
    expect(custom.userData.built).toBe(true);
    disposeTownObject(custom);

    registerFactionModelPack({ faction: 'haven', createBuildingModel: () => null });
    const fallback = createBuildingModel(getBuildingModelSpec('townHall'), 'haven', false);
    expect(fallback.userData.ghost).toBe(true);
    expect(fallback.getObjectByName('blueprint-ghost')).toBeInstanceOf(THREE.Mesh);
    disposeTownObject(fallback);
  });

  it('keeps registry specifications matched to their faction data', () => {
    expect(Object.keys(BUILDING_MODEL_REGISTRY)).toHaveLength(57);
    for (const faction of Object.values(FACTIONS)) {
      for (const buildingId of faction.buildingIds) {
        const model = createCoreBuildingModel(getBuildingModelSpec(buildingId), faction.id, true);
        expect(model.userData.creatureId).toBe(BUILDINGS[buildingId]!.creatureId);
        disposeTownObject(model);
      }
    }
  });
});
