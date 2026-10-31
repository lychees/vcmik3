import { afterEach, describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { FACTIONS } from '../src/game/factions';
import {
  FACTION_MODEL_PACKS,
  registerFactionModelPacks,
} from '../src/town/factions';
import { createBuildingModel, disposeTownObject } from '../src/town/models';
import { createFactionPackModel } from '../src/town/packs';
import { getBuildingModelSpec, getTownBuildingSpecs, resolveFactionId } from '../src/town/registry';
import { getTownBuildingDestination } from '../src/ui/townInteractions';

const liveModels = new Set<THREE.Group>();

function track(model: THREE.Group): THREE.Group {
  liveModels.add(model);
  return model;
}

afterEach(() => {
  for (const model of liveModels) disposeTownObject(model);
  liveModels.clear();
});

describe('full faction pack registration', () => {
  it('registers exactly the 13 content factions and uses every pack through core model creation', () => {
    registerFactionModelPacks();
    expect(FACTION_MODEL_PACKS).toHaveLength(13);
    expect(new Set(FACTION_MODEL_PACKS.map((pack) => resolveFactionId(pack.faction))))
      .toEqual(new Set(Object.keys(FACTIONS)));

    for (const pack of FACTION_MODEL_PACKS) {
      const faction = resolveFactionId(pack.faction);
      const definition = FACTIONS[faction];
      expect(getTownBuildingSpecs(faction)).toHaveLength(9);
      for (const buildingId of definition.buildingIds) {
        for (const built of [false, true]) {
          const custom = createFactionPackModel(faction, buildingId, built);
          expect(custom, `${faction}:${buildingId}:${built}`).not.toBeNull();
          track(custom!);
          expect(custom!.userData.buildingId).toBe(buildingId);
          expect(custom!.userData.built).toBe(built);

          const integrated = track(createBuildingModel(getBuildingModelSpec(buildingId), faction, built));
          expect(integrated.name).toBe(`building-${buildingId}-${built ? 'built' : 'unbuilt'}`);
          expect(integrated.userData).toMatchObject({ buildingId, faction, built });
          expect(integrated.children.length).toBeGreaterThan(0);
        }
      }
      for (const commonId of ['townHall', 'capitol', 'market', 'fort', 'mageGuild']) {
        expect(createFactionPackModel(faction, commonId, true)).toBeNull();
        const common = track(createBuildingModel(getBuildingModelSpec(commonId), faction, true));
        expect(common.userData).toMatchObject({ buildingId: commonId, faction, built: true });
      }
    }
  });
});

describe('town building interaction routing', () => {
  it.each([
    { buildingId: 'archeryRange', creatureId: 'archer', tab: 'recruitment' },
    { buildingId: 'fort', tab: 'army' },
    { buildingId: 'mageGuild', tab: 'spellbook' },
    { buildingId: 'townHall', tab: 'overview' },
    { buildingId: 'capitol', tab: 'overview' },
    { buildingId: 'market', tab: 'overview' },
  ])('routes built $buildingId to $tab without a game-state mutation', ({ buildingId, creatureId, tab }) => {
    const destination = getTownBuildingDestination({ townId: 'haven', buildingId, built: true, creatureId });
    expect(destination.tab).toBe(tab);
    expect(destination.buildingId).toBe(buildingId);
    expect(destination.creatureId).toBe(creatureId);
  });

  it.each(['archeryRange', 'fort', 'mageGuild', 'capitol', 'market'])(
    'routes unbuilt %s to its construction card even when a creature is present',
    (buildingId) => {
      expect(getTownBuildingDestination({
        townId: 'haven', buildingId, built: false, creatureId: 'archer',
      })).toEqual({ tab: 'construction', buildingId });
    },
  );
});
