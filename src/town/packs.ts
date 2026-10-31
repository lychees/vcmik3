import type * as THREE from 'three';
import { resolveFactionId, type FactionId } from './registry';

export interface FactionModelPack {
  faction: string;
  createBuildingModel(buildingId: string, built: boolean): THREE.Group | null;
}

const packs = new Map<FactionId, FactionModelPack>();

export function registerFactionModelPack(pack: FactionModelPack): void {
  packs.set(resolveFactionId(pack.faction), pack);
}

export function createFactionPackModel(
  faction: FactionId,
  buildingId: string,
  built: boolean,
): THREE.Group | null {
  return packs.get(faction)?.createBuildingModel(buildingId, built) ?? null;
}
