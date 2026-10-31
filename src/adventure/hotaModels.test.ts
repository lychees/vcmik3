import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { HOTA_CREATURE_FACTIONS, HOTA_CREATURE_IDS } from '../battle/hotaCreatures';
import { createInitialGameState } from '../game/scenario';
import type { DwellingObject, GameState, MonsterObject, TownObject } from '../game/types';
import { HOTA_TOWN_IDS } from './hotaArchitecture';
import { createObjectModel } from './models';

const TOWN_FACTIONS: Record<string, string> = {
  Haven: 'Haven', Grove: 'Grove', Ember: 'Ember', Mire: 'Mire', ...HOTA_TOWN_IDS,
};

function monster(id: string): MonsterObject {
  return {
    id: `monster-${id}`,
    kind: 'monster',
    name: id,
    position: { x: 0, y: 0 },
    army: [{ creatureId: id, count: 4 }],
    experienceReward: 10,
    treasure: {},
  };
}

function dwelling(id: string, available = 3): DwellingObject {
  return {
    id: `dwelling-${id}`,
    kind: 'dwelling',
    name: id,
    position: { x: 0, y: 0 },
    creatureId: id,
    available,
  };
}

function meshCount(group: THREE.Group): number {
  let count = 0;
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) count += 1;
  });
  return count;
}

function signature(group: THREE.Group): string {
  const parts: string[] = [];
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const material = child.material as THREE.MeshStandardMaterial;
    parts.push([
      child.geometry.type,
      ...child.position.toArray(),
      ...child.scale.toArray(),
      ...child.rotation.toArray().slice(0, 3),
      material.color?.getHex(),
    ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(','));
  });
  return parts.join('|');
}

describe('new-faction overworld encounters and dwellings', () => {
  it.each(HOTA_CREATURE_IDS)('uses the actual %s silhouette for monsters instead of a fallback', (id) => {
    const state = createInitialGameState(`hota-monster-${id}`);
    const model = createObjectModel(monster(id), state);
    const creature = model.group.getObjectByName(`creature-${id}`);
    expect(creature).toBeInstanceOf(THREE.Group);
    expect(creature?.userData.creatureId).toBe(id);
    expect(creature?.userData.faction).toBe(HOTA_CREATURE_FACTIONS[id]);
    expect(creature?.getObjectByName('faction-ring')).toBeUndefined();
    expect(model.group.userData.creatureId).toBe(id);
    expect(model.group.userData.faction).toBe(HOTA_CREATURE_FACTIONS[id]);
  });

  it.each(HOTA_CREATURE_IDS)('gives %s a faction dwelling with its own ring-free effigy', (id) => {
    const state = createInitialGameState(`hota-dwelling-${id}`);
    const model = createObjectModel(dwelling(id), state);
    const effigy = model.group.getObjectByName(`creature-${id}`);
    expect(model.group.userData.creatureId).toBe(id);
    expect(model.group.userData.faction).toBe(HOTA_CREATURE_FACTIONS[id]);
    expect(effigy).toBeInstanceOf(THREE.Group);
    expect(effigy?.getObjectByName('faction-ring')).toBeUndefined();
    expect(meshCount(model.group)).toBeLessThan(70);
  });

  it('retains the new-faction dwelling silhouette and palette when depleted', () => {
    const state = createInitialGameState('hota-depleted-dwelling');
    const model = createObjectModel(dwelling('juggernaut', 0), state);
    expect(model.group.getObjectByName('creature-juggernaut')).toBeInstanceOf(THREE.Group);
    expect(model.group.userData.faction).toBe('Factory');
  });
});

describe('complete 13-faction town architecture', () => {
  it('creates 13 distinct low-poly towns with canonical architecture IDs and live ownership', () => {
    const state = createInitialGameState('hota-town-architecture') as GameState;
    const signatures = new Set<string>();
    expect(Object.keys(TOWN_FACTIONS)).toHaveLength(13);
    for (const [faction, architecture] of Object.entries(TOWN_FACTIONS)) {
      const townId = faction === 'Haven' || faction === 'Grove' || faction === 'Ember' || faction === 'Mire'
        ? `test-${architecture}` : `town-${architecture}`;
      const object: TownObject = {
        id: `object-${townId}`, kind: 'town', name: faction, position: { x: 0, y: 0 }, townId,
      };
      state.map.objects[object.id] = object;
      state.towns[townId] = {
        id: townId,
        name: faction,
        ownerId: 'red',
        faction,
        position: { x: 0, y: 0 },
        buildings: [],
        garrison: [],
        dwellingPools: {},
        builtToday: false,
      };
      const model = createObjectModel(object, state);
      expect(model.group.userData.faction).toBe(faction);
      expect(model.group.userData.architecture).toBe(architecture);
      expect(model.flags).toHaveLength(1);
      expect(meshCount(model.group)).toBeLessThan(40);
      const bounds = new THREE.Box3().setFromObject(model.group);
      expect(bounds.max.y).toBeLessThan(1.9);
      const flagMaterial = model.flags[0]!.material as THREE.MeshStandardMaterial;
      expect(flagMaterial.color.getHex()).toBe(new THREE.Color(state.players.red!.color).getHex());
      signatures.add(signature(model.group));

      state.towns[townId]!.ownerId = 'blue';
      const updated = createObjectModel(object, state);
      const updatedMaterial = updated.flags[0]!.material as THREE.MeshStandardMaterial;
      expect(updatedMaterial.color.getHex()).toBe(new THREE.Color(state.players.blue!.color).getHex());
      expect(updated.group.userData.architecture).toBe(architecture);
    }
    expect(signatures.size).toBe(13);
  });
});
