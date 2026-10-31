import { FACTIONS } from '../game/factions';

export type FactionId = keyof typeof FACTIONS;
export type CommonBuildingForm = 'townHall' | 'capitol' | 'market' | 'fort' | 'mageGuild';
export type DwellingForm =
  | 'hall'
  | 'bastion'
  | 'tower'
  | 'grove'
  | 'cavern'
  | 'pen'
  | 'ritual'
  | 'ruins'
  | 'industrial'
  | 'aquatic';

export interface BuildingModelSpec {
  id: string;
  category: 'common' | 'dwelling';
  faction: FactionId | null;
  tier: 0 | 1 | 2 | 3 | 4;
  form: CommonBuildingForm | DwellingForm;
  footprint: readonly [number, number];
  height: number;
}

export const COMMON_BUILDING_IDS = ['townHall', 'capitol', 'market', 'fort', 'mageGuild'] as const;

function common(
  id: CommonBuildingForm,
  footprint: readonly [number, number],
  height: number,
): BuildingModelSpec {
  return { id, category: 'common', faction: null, tier: 0, form: id, footprint, height };
}

function dwelling(
  id: string,
  faction: FactionId,
  tier: 1 | 2 | 3 | 4,
  form: DwellingForm,
  height: number,
  footprint: readonly [number, number] = [3.7, 3.5],
): BuildingModelSpec {
  return { id, category: 'dwelling', faction, tier, form, footprint, height };
}

export const BUILDING_MODEL_REGISTRY: Readonly<Record<string, BuildingModelSpec>> = Object.freeze({
  townHall: common('townHall', [5.4, 4.6], 5.4),
  capitol: common('capitol', [4.8, 4.4], 5.8),
  market: common('market', [4.8, 4.2], 3.4),
  fort: common('fort', [5.2, 4.5], 4.4),
  mageGuild: common('mageGuild', [4.3, 4.3], 6.5),

  militiaBarracks: dwelling('militiaBarracks', 'haven', 1, 'bastion', 3.2),
  archeryRange: dwelling('archeryRange', 'haven', 2, 'hall', 3.3),
  griffinTower: dwelling('griffinTower', 'haven', 3, 'tower', 5.2),
  joustingArena: dwelling('joustingArena', 'haven', 4, 'pen', 3.5),
  spriteGlade: dwelling('spriteGlade', 'grove', 1, 'grove', 3.7),
  rangerLodge: dwelling('rangerLodge', 'grove', 2, 'hall', 3.3),
  unicornGrove: dwelling('unicornGrove', 'grove', 3, 'grove', 4.3),
  dragonCliffs: dwelling('dragonCliffs', 'grove', 4, 'cavern', 5.0),
  impWarrens: dwelling('impWarrens', 'ember', 1, 'cavern', 2.9),
  hellhoundKennels: dwelling('hellhoundKennels', 'ember', 2, 'pen', 3.2),
  ifritSpire: dwelling('ifritSpire', 'ember', 3, 'tower', 5.4),
  pitFiendAbyss: dwelling('pitFiendAbyss', 'ember', 4, 'ritual', 4.7),
  lizardmanDen: dwelling('lizardmanDen', 'mire', 1, 'cavern', 3.0),
  gorgonPen: dwelling('gorgonPen', 'mire', 2, 'pen', 3.2),
  wyvernRoost: dwelling('wyvernRoost', 'mire', 3, 'tower', 4.8),
  basiliskPit: dwelling('basiliskPit', 'mire', 4, 'ritual', 4.0),

  gremlinWorkshop: dwelling('gremlinWorkshop', 'tower', 1, 'industrial', 3.4),
  gargoyleParapet: dwelling('gargoyleParapet', 'tower', 2, 'bastion', 4.0),
  geniePavilion: dwelling('geniePavilion', 'tower', 3, 'ritual', 4.6),
  titanCloudTemple: dwelling('titanCloudTemple', 'tower', 4, 'tower', 6.0),
  skeletonCrypt: dwelling('skeletonCrypt', 'necropolis', 1, 'ruins', 3.2),
  zombieGraveyard: dwelling('zombieGraveyard', 'necropolis', 2, 'ruins', 3.0),
  vampireEstate: dwelling('vampireEstate', 'necropolis', 3, 'hall', 4.8),
  ghostDragonSepulcher: dwelling('ghostDragonSepulcher', 'necropolis', 4, 'ruins', 5.5),
  troglodyteWarrens: dwelling('troglodyteWarrens', 'dungeon', 1, 'cavern', 3.1),
  harpyRoost: dwelling('harpyRoost', 'dungeon', 2, 'tower', 4.5),
  minotaurLabyrinth: dwelling('minotaurLabyrinth', 'dungeon', 3, 'bastion', 4.1),
  redDragonCavern: dwelling('redDragonCavern', 'dungeon', 4, 'cavern', 5.4),
  goblinBarracks: dwelling('goblinBarracks', 'stronghold', 1, 'bastion', 3.2),
  wolfPen: dwelling('wolfPen', 'stronghold', 2, 'pen', 3.0),
  ogreFort: dwelling('ogreFort', 'stronghold', 3, 'bastion', 4.4),
  behemothCliffs: dwelling('behemothCliffs', 'stronghold', 4, 'cavern', 5.2),
  pixieGarden: dwelling('pixieGarden', 'conflux', 1, 'grove', 3.6),
  airElementalAltar: dwelling('airElementalAltar', 'conflux', 2, 'ritual', 4.2),
  stormElementalSpire: dwelling('stormElementalSpire', 'conflux', 3, 'tower', 5.5),
  phoenixPyre: dwelling('phoenixPyre', 'conflux', 4, 'ritual', 5.1),
  nymphGrotto: dwelling('nymphGrotto', 'cove', 1, 'aquatic', 3.3),
  corsairTavern: dwelling('corsairTavern', 'cove', 2, 'hall', 3.8),
  seaWitchTower: dwelling('seaWitchTower', 'cove', 3, 'tower', 5.1),
  seaSerpentCove: dwelling('seaSerpentCove', 'cove', 4, 'aquatic', 4.6),
  halflingHovels: dwelling('halflingHovels', 'factory', 1, 'hall', 2.9),
  automatonAssembly: dwelling('automatonAssembly', 'factory', 2, 'industrial', 4.0),
  dreadnoughtFoundry: dwelling('dreadnoughtFoundry', 'factory', 3, 'industrial', 4.7),
  juggernautHangar: dwelling('juggernautHangar', 'factory', 4, 'industrial', 5.0),
  banditHideout: dwelling('banditHideout', 'bulwark', 1, 'hall', 3.1),
  hornetNest: dwelling('hornetNest', 'bulwark', 2, 'grove', 4.2),
  shamanLodge: dwelling('shamanLodge', 'bulwark', 3, 'ritual', 4.3),
  alligatorPit: dwelling('alligatorPit', 'bulwark', 4, 'aquatic', 3.8),
  pageBarracks: dwelling('pageBarracks', 'courtyard', 1, 'bastion', 3.4),
  duelistSalon: dwelling('duelistSalon', 'courtyard', 2, 'hall', 3.8),
  courtWizardLibrary: dwelling('courtWizardLibrary', 'courtyard', 3, 'tower', 5.0),
  royalLionGarden: dwelling('royalLionGarden', 'courtyard', 4, 'grove', 4.8),
});

export function getBuildingModelSpec(buildingId: string): BuildingModelSpec {
  const spec = Object.hasOwn(BUILDING_MODEL_REGISTRY, buildingId)
    ? BUILDING_MODEL_REGISTRY[buildingId]
    : undefined;
  if (!spec) throw new Error(`No town model specification for building: ${buildingId}`);
  return spec;
}

export function resolveFactionId(faction: string): FactionId {
  if (Object.hasOwn(FACTIONS, faction)) return faction as FactionId;
  const match = Object.values(FACTIONS).find((candidate) => candidate.name === faction);
  if (!match) throw new Error(`No town model architecture for faction: ${faction}`);
  return match.id;
}

export function getTownBuildingSpecs(factionId: FactionId): BuildingModelSpec[] {
  const faction = FACTIONS[factionId];
  return [
    ...COMMON_BUILDING_IDS.map(getBuildingModelSpec),
    ...faction.buildingIds.map(getBuildingModelSpec),
  ];
}
