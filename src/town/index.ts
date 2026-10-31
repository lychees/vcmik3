export { TownScene, type TownBuildingInteraction } from './TownScene';
export {
  BUILDING_MODEL_REGISTRY,
  COMMON_BUILDING_IDS,
  getBuildingModelSpec,
  getTownBuildingSpecs,
  resolveFactionId,
  type BuildingModelSpec,
  type CommonBuildingForm,
  type DwellingForm,
  type FactionId,
} from './registry';
export { registerFactionModelPack, type FactionModelPack } from './packs';
export { createBuildingModel, createCoreBuildingModel, disposeTownObject } from './models';
export { createTownLayout, TOWN_LAYOUT_BOUNDS, type TownBuildingPlacement } from './layout';
