import type { BattleSideId } from '../types';
import { isNeutralCreatureId } from '../../game/neutral';
import { createArcaneMonsterModel } from './arcane';
import { createAquaticMonsterModel } from './aquatic';
import { createBeastsMonsterModel } from './beasts';
import { createDesertMonsterModel } from './desert';
import { createForestMonsterModel } from './forest';
import { createIceMonsterModel } from './ice';
import { createInfernalMonsterModel } from './infernal';
import { createReptileMonsterModel } from './reptile';
import { createSwarmMonsterModel } from './swarm';
import { createUndeadMonsterModel } from './undead';
import type * as THREE from 'three';

const FACTORIES = [
  createArcaneMonsterModel,
  createAquaticMonsterModel,
  createBeastsMonsterModel,
  createDesertMonsterModel,
  createForestMonsterModel,
  createIceMonsterModel,
  createInfernalMonsterModel,
  createReptileMonsterModel,
  createSwarmMonsterModel,
  createUndeadMonsterModel,
] as const;

export { isNeutralCreatureId } from '../../game/neutral';
export { NEUTRAL_CREATURE_IDS } from '../../game/neutral';

export function createNeutralCreatureModel(creatureId: string, side: BattleSideId): THREE.Group | null {
  if (!isNeutralCreatureId(creatureId)) return null;
  for (const factory of FACTORIES) {
    const model = factory(creatureId, side);
    if (model) {
      model.userData.faction = 'Neutral';
      return model;
    }
  }
  throw new Error(`Neutral creature model is not registered: ${creatureId}`);
}
