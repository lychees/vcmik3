import { getTownBuildingSpecs, type BuildingModelSpec, type FactionId } from './registry';

export interface TownBuildingPlacement {
  spec: BuildingModelSpec;
  x: number;
  z: number;
  rotation: number;
  labelHeight: number;
}

export const TOWN_LAYOUT_BOUNDS = Object.freeze({ width: 28, depth: 27 });

const POSITIONS: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
  townHall: [0, -7],
  capitol: [-7, -6],
  mageGuild: [7, -6],
  fort: [-8, 0.5],
  market: [8, 0.5],
  dwelling1: [-8.1, 7],
  dwelling2: [-2.7, 7.5],
  dwelling3: [2.7, 7.5],
  dwelling4: [8.1, 7],
});

export function createTownLayout(factionId: FactionId): TownBuildingPlacement[] {
  return getTownBuildingSpecs(factionId).map((spec) => {
    const key = spec.category === 'common' ? spec.id : `dwelling${spec.tier}`;
    const position = POSITIONS[key];
    if (!position) throw new Error(`No town layout position for building: ${spec.id}`);
    const [x, z] = position;
    return {
      spec,
      x,
      z,
      rotation: Math.atan2(-x, -z),
      labelHeight: spec.height + 0.65,
    };
  });
}
