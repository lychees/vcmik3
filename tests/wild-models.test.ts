import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createObjectModel } from '../src/adventure/models';
import { createMapSnapshot } from '../src/adventure/presentation';
import { createCreatureModel, getCreatureVisualFaction } from '../src/battle/creatures';
import { createNeutralCreatureModel, NEUTRAL_CREATURE_IDS } from '../src/battle/neutral';
import { disposeBattleResources } from '../src/battle/resources';
import { LANDMARK_IDS } from '../src/game/landmarks';
import { createInitialGameState } from '../src/game/scenario';
import type { GameState, LandmarkObject, MonsterObject } from '../src/game/types';

function bodyBounds(model: THREE.Group): THREE.Box3 {
  const bounds = new THREE.Box3();
  model.traverse((child) => {
    if (child instanceof THREE.Mesh && child.name !== 'faction-ring') bounds.expandByObject(child);
  });
  return bounds;
}

function neutralEncounters(state: GameState): MonsterObject[] {
  return Object.values(state.map.objects).filter((object): object is MonsterObject =>
    object.kind === 'monster' && object.id.startsWith('monster-neutral-'));
}

describe('complete neutral battle and overworld model registry', () => {
  it.each(NEUTRAL_CREATURE_IDS)('%s has a bounded neutral model with label clearance and battle feedback', (id) => {
    const model = createCreatureModel(id, 'attacker');
    const bounds = bodyBounds(model);
    expect(model.name).toBe(`creature-${id}`);
    expect(model.userData.creatureId).toBe(id);
    expect(model.userData.faction).toBe('Neutral');
    expect(getCreatureVisualFaction(id)).toBe('Neutral');
    expect(model.userData.archetype).not.toBe(id);
    expect(model.userData.animationPivot).toBe('ground');
    expect(model.userData.side).toBe('attacker');
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.04);
    expect(bounds.max.y).toBeGreaterThan(0.8);
    expect(bounds.max.y).toBeLessThan(4);
    expect(model.userData.visualHeight).toBeCloseTo(bounds.max.y - bounds.min.y, 5);
    expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
    expect(model.userData.palette).toHaveLength(3);
    expect(model.getObjectByName('faction-ring')).toBeDefined();
    disposeBattleResources(model);
  });

  it('keeps all 20 model archetypes distinct and supports compact models and defender facing', () => {
    const models = NEUTRAL_CREATURE_IDS.map((id) => createCreatureModel(id, 'defender', { factionRing: false }));
    expect(new Set(models.map((model) => model.userData.archetype)).size).toBe(20);
    for (const model of models) {
      expect(model.getObjectByName('faction-ring')).toBeUndefined();
      expect(model.userData.side).toBe('defender');
      const body = model.children.find((child) => child.name === model.name);
      expect(body?.rotation.y).toBe(Math.PI);
      disposeBattleResources(model);
    }
  });

  it('renders both stacks of every mixed encounter and disposes their geometry', () => {
    const state = createInitialGameState('wild-overworld-models') as GameState;
    const encountered = new Set<string>();
    for (const object of neutralEncounters(state)) {
      const model = createObjectModel(object, state);
      expect(model.group.userData.faction).toBe('Neutral');
      expect(model.group.userData.creatureIds).toEqual(object.army.map((stack) => stack.creatureId));
      for (const stack of object.army) {
        encountered.add(stack.creatureId);
        const creature = model.group.getObjectByName(`creature-${stack.creatureId}`);
        expect(creature).toBeInstanceOf(THREE.Group);
        expect(creature?.userData.faction).toBe('Neutral');
        expect(creature?.getObjectByName('faction-ring')).toBeUndefined();
      }
      const mesh = model.group.getObjectByName(`creature-${object.army[0]?.creatureId}`)?.getObjectByProperty('isMesh', true);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      if (mesh instanceof THREE.Mesh) {
        let disposed = false;
        mesh.geometry.addEventListener('dispose', () => { disposed = true; });
        disposeBattleResources(model.group);
        expect(disposed).toBe(true);
      }
    }
    expect(encountered).toEqual(new Set(NEUTRAL_CREATURE_IDS));
  });

  it('rejects unregistered inherited IDs instead of producing a fallback neutral', () => {
    expect(createNeutralCreatureModel('toString', 'attacker')).toBeNull();
    expect(createNeutralCreatureModel('militia', 'attacker')).toBeNull();
  });
});

describe('landmark model and snapshot registry', () => {
  it('renders every landmark type with finite bounds and neutral metadata', () => {
    const state = createInitialGameState('wild-landmark-models') as GameState;
    const rendered = new Set<string>();
    for (const object of Object.values(state.map.objects)) {
      if (object.kind !== 'landmark') continue;
      const model = createObjectModel(object, state);
      rendered.add(object.landmarkId);
      expect(model.group.userData.landmarkId).toBe(object.landmarkId);
      expect(model.group.userData.kind).toBe('landmark');
      expect(model.group.userData.faction).toBe('Neutral');
      expect(model.group.userData.visited).toBe(false);
      expect(model.group.userData.depleted).toBe(false);
      expect(Number.isFinite(model.group.userData.visualHeight)).toBe(true);
      expect(model.group.userData.visualHeight).toBeGreaterThan(0);
      expect(model.group.userData.labelHeight).toBeGreaterThan(model.group.userData.visualHeight);
      const bounds = new THREE.Box3().setFromObject(model.group);
      expect(bounds.isEmpty()).toBe(false);
      expect(bounds.max.x - bounds.min.x).toBeLessThanOrEqual(1.2);
      expect(bounds.max.z - bounds.min.z).toBeLessThanOrEqual(1.2);
      let meshes = 0;
      model.group.traverse((child) => { if (child instanceof THREE.Mesh) meshes += 1; });
      expect(meshes).toBeGreaterThan(3);
      disposeBattleResources(model.group);
    }
    expect(rendered).toEqual(new Set(LANDMARK_IDS));
  });

  it('distinguishes permanent visits, daily availability, and reusable portals', () => {
    const state = createInitialGameState('wild-landmark-states') as GameState;
    const heroId = state.selectedHeroId!;
    const arena = state.map.objects['landmark-warriorsArena'] as LandmarkObject;
    arena.visits[heroId] = 1;
    const arenaModel = createObjectModel(arena, state);
    expect(arenaModel.group.userData).toMatchObject({ visited: true, depleted: true });

    const waterwheel = state.map.objects['landmark-waterwheel'] as LandmarkObject;
    waterwheel.visits[heroId] = 1;
    expect(createObjectModel(waterwheel, state).group.userData).toMatchObject({ visited: true, depleted: true });
    state.calendar = { day: 2, week: 1, month: 1, dayOfWeek: 2 };
    expect(createObjectModel(waterwheel, state).group.userData).toMatchObject({ visited: true, depleted: false });

    const portal = state.map.objects['landmark-wayfarerPortal-west'] as LandmarkObject;
    portal.visits[heroId] = 2;
    expect(createObjectModel(portal, state).group.userData).toMatchObject({ visited: true, depleted: false });

    const snapshot = createMapSnapshot(state);
    expect(snapshot.objects.find((object) => object.id === arena.id)).toMatchObject({
      landmarkId: 'warriorsArena', visited: true, depleted: true,
    });
    expect(snapshot.objects.find((object) => object.id === waterwheel.id)).toMatchObject({
      landmarkId: 'waterwheel', visited: true, depleted: false,
    });
    expect(snapshot.objects.find((object) => object.id === portal.id)).toMatchObject({
      landmarkId: 'wayfarerPortal', visited: true, depleted: false,
    });
    disposeBattleResources(arenaModel.group);
  });
});
