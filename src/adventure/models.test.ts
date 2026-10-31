import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/scenario';
import type { DwellingObject, GameState, MonsterObject, TownObject } from '../game/types';
import { createObjectModel } from './models';

const EXPANSION = [
  ['imp', 'Ember'],
  ['hellhound', 'Ember'],
  ['ifrit', 'Ember'],
  ['pitFiend', 'Ember'],
  ['lizardman', 'Mire'],
  ['gorgon', 'Mire'],
  ['wyvern', 'Mire'],
  ['basilisk', 'Mire'],
] as const;

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

function town(id: string): TownObject {
  return { id: `object-${id}`, kind: 'town', name: id, position: { x: 0, y: 0 }, townId: id };
}

function architectureSignature(model: THREE.Group): string {
  const parts: string[] = [];
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    parts.push(`${child.geometry.type}:${child.position.toArray().map((value) => value.toFixed(2)).join(',')}`);
  });
  return parts.join('|');
}

describe('expansion adventure creatures', () => {
  it.each(EXPANSION)('shows %s encounters with the matching creature rather than a humanoid fallback', (id, faction) => {
    const state = createInitialGameState(`monster-${id}`);
    const model = createObjectModel(monster(id), state);
    const creature = model.group.getObjectByName(`creature-${id}`);
    expect(creature).toBeInstanceOf(THREE.Group);
    expect(creature?.userData.creatureId).toBe(id);
    expect(creature?.userData.faction).toBe(faction);
    expect(creature?.getObjectByName('faction-ring')).toBeUndefined();
    expect(model.group.userData.creatureId).toBe(id);
  });

  it.each(EXPANSION)('gives %s dwellings a faction building and recognizable effigy', (id, faction) => {
    const state = createInitialGameState(`dwelling-${id}`);
    const object: DwellingObject = {
      id: `dwelling-${id}`,
      kind: 'dwelling',
      name: id,
      position: { x: 0, y: 0 },
      creatureId: id,
      available: 3,
    };
    const model = createObjectModel(object, state);
    expect(model.group.userData.creatureId).toBe(id);
    expect(model.group.userData.faction).toBe(faction);
    expect(model.group.getObjectByName(`creature-${id}`)).toBeInstanceOf(THREE.Group);
    expect(model.group.getObjectByName(`creature-${id}`)?.getObjectByName('faction-ring')).toBeUndefined();
  });
});

describe('faction town architecture', () => {
  it('creates four distinct town silhouettes with live ownership colors', () => {
    const state = createInitialGameState('town-architecture') as GameState;
    const signatures = new Set<string>();
    for (const faction of ['Haven', 'Grove', 'Ember', 'Mire']) {
      const id = `town-${faction}`;
      const object = town(id);
      state.map.objects[object.id] = object;
      state.towns[id] = {
        id,
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
      expect(model.group.userData.architecture).toBe(faction);
      expect(model.flags).toHaveLength(1);
      const flagMaterial = model.flags[0]!.material as THREE.MeshStandardMaterial;
      expect(flagMaterial.color.getHex()).toBe(new THREE.Color(state.players.red!.color).getHex());
      signatures.add(architectureSignature(model.group));

      state.towns[id]!.ownerId = 'blue';
      const updated = createObjectModel(object, state);
      const updatedMaterial = updated.flags[0]!.material as THREE.MeshStandardMaterial;
      expect(updatedMaterial.color.getHex()).toBe(new THREE.Color(state.players.blue!.color).getHex());
    }
    expect(signatures.size).toBe(4);
  });
});
