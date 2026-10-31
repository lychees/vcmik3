import { registerFactionModelPack, type FactionModelPack } from '../packs';
import bulwark from './bulwark';
import conflux from './conflux';
import courtyard from './courtyard';
import cove from './cove';
import dungeon from './dungeon';
import ember from './ember';
import factory from './factory';
import grove from './grove';
import haven from './haven';
import mire from './mire';
import necropolis from './necropolis';
import stronghold from './stronghold';
import tower from './tower';

export const FACTION_MODEL_PACKS: readonly FactionModelPack[] = Object.freeze([
  haven,
  grove,
  ember,
  mire,
  tower,
  necropolis,
  dungeon,
  stronghold,
  conflux,
  cove,
  factory,
  bulwark,
  courtyard,
]);

export function registerFactionModelPacks(): void {
  for (const pack of FACTION_MODEL_PACKS) registerFactionModelPack(pack);
}

registerFactionModelPacks();

export {
  bulwark as bulwarkModelPack,
  conflux as confluxModelPack,
  courtyard as courtyardModelPack,
  cove as coveModelPack,
  dungeon as dungeonModelPack,
  ember as emberModelPack,
  factory as factoryModelPack,
  grove as groveModelPack,
  haven as havenModelPack,
  mire as mireModelPack,
  necropolis as necropolisModelPack,
  stronghold as strongholdModelPack,
  tower as towerModelPack,
};
