import * as THREE from 'three';
import { GameStore } from '../game/GameStore';
import { FACTIONS } from '../game/factions';
import type { GameState } from '../game/types';
import type {
  ConstructionModelAnimation,
  ConstructionSpeed,
  ConstructionStage,
  ConstructionStartOptions,
  ConstructionStatus,
} from './construction';
import { COMMON_BUILDING_IDS, type FactionId } from './registry';
import { TownScene, type TownBuildingInteraction } from './TownScene';

interface MeshSnapshot {
  uuid: string;
  geometryUuid: string;
  geometryType: string;
  stage: string;
  animation: string;
  visible: boolean;
  position: number[];
  scale: number[];
  quaternion: number[];
}

interface TownShowcaseApi {
  interactions: TownBuildingInteraction[];
  setTown(faction: FactionId, built: boolean): string[];
  clearInteractions(): void;
  clearTown(): void;
  subscriptionCount(): number;
  constructConfirmed(buildingId: string): ConstructionStatus | null;
  startConstruction(buildingId: string, options?: ConstructionStartOptions): ConstructionStatus | null;
  playConstruction(): ConstructionStatus | null;
  pauseConstruction(): ConstructionStatus | null;
  scrubConstruction(time: number): ConstructionStatus | null;
  speedConstruction(speed: ConstructionSpeed): ConstructionStatus | null;
  previousConstructionStage(): ConstructionStatus | null;
  nextConstructionStage(): ConstructionStatus | null;
  finishConstruction(): ConstructionStatus | null;
  cancelConstruction(): void;
  constructionStatus(): ConstructionStatus | null;
  constructionStages(): ConstructionStage[];
  constructionSnapshot(buildingId: string): MeshSnapshot[];
  reloadStore(): void;
  rendererStats(): { geometries: number; textures: number; highlights: number };
  dispose(): void;
}

declare global {
  interface Window {
    __townShowcase: TownShowcaseApi;
  }
}

const container = document.createElement('div');
container.style.width = '100vw';
container.style.height = '100vh';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(container);

const store = new GameStore({ seed: 'town-scene-showcase', storage: null });
let subscriptions = 0;
const subscribe = store.subscribe.bind(store);
store.subscribe = (listener) => {
  subscriptions += 1;
  const unsubscribe = subscribe(listener);
  let active = true;
  return () => {
    if (!active) return;
    active = false;
    subscriptions -= 1;
    unsubscribe();
  };
};
const interactions: TownBuildingInteraction[] = [];
const scene = new TownScene(container, store, (interaction) => interactions.push(interaction));
const internals = scene as unknown as {
  visuals: Map<string, { model: THREE.Group }>;
  activeConstruction: { timeline: { stages: ConstructionStage[] }; animation: ConstructionModelAnimation } | null;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
};
let activeTown: FactionId | null = null;

function constructionSnapshot(buildingId: string): MeshSnapshot[] {
  const model = internals.visuals.get(buildingId)?.model;
  if (!model) return [];
  const result: MeshSnapshot[] = [];
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    result.push({
      uuid: object.uuid,
      geometryUuid: object.geometry.uuid,
      geometryType: object.geometry.type,
      stage: String(object.userData.constructionStage ?? ''),
      animation: String(object.userData.townAnimation ?? ''),
      visible: object.visible,
      position: object.position.toArray(),
      scale: object.scale.toArray(),
      quaternion: object.quaternion.toArray(),
    });
  });
  return result;
}

window.__townShowcase = {
  interactions,
  setTown(faction, built) {
    const definition = FACTIONS[faction];
    const state = store.getState() as GameState;
    const town = state.towns[faction];
    if (!definition || !town) throw new Error(`Missing showcase town: ${faction}`);
    town.buildings = built ? [...COMMON_BUILDING_IDS, ...definition.buildingIds] : [];
    const result = store.loadSerialized(JSON.stringify(state));
    if (!result.ok) throw new Error(result.error);
    scene.setTown(faction);
    activeTown = faction;
    interactions.length = 0;
    return [...COMMON_BUILDING_IDS, ...definition.buildingIds];
  },
  clearInteractions() {
    interactions.length = 0;
  },
  clearTown() {
    scene.setTown(null);
    activeTown = null;
  },
  subscriptionCount() {
    return subscriptions;
  },
  constructConfirmed(buildingId) {
    if (!activeTown) throw new Error('No active showcase town');
    const result = store.constructBuilding(activeTown, buildingId);
    if (!result.ok) throw new Error(result.error);
    return scene.getConstructionStatus();
  },
  startConstruction(buildingId, options = {}) {
    return activeTown ? scene.startConstruction(activeTown, buildingId, options) : null;
  },
  playConstruction() {
    return scene.playConstruction();
  },
  pauseConstruction() {
    return scene.pauseConstruction();
  },
  scrubConstruction(time) {
    return scene.setConstructionTime(time);
  },
  speedConstruction(speed) {
    return scene.setConstructionSpeed(speed);
  },
  previousConstructionStage() {
    return scene.previousConstructionStage();
  },
  nextConstructionStage() {
    return scene.nextConstructionStage();
  },
  finishConstruction() {
    return scene.finishConstruction();
  },
  cancelConstruction() {
    scene.cancelConstruction();
  },
  constructionStatus() {
    return scene.getConstructionStatus();
  },
  constructionStages() {
    return [...(internals.activeConstruction?.timeline.stages ?? [])];
  },
  constructionSnapshot,
  reloadStore() {
    const result = store.loadSerialized(JSON.stringify(store.getState()));
    if (!result.ok) throw new Error(result.error);
  },
  rendererStats() {
    return {
      geometries: internals.renderer.info.memory.geometries,
      textures: internals.renderer.info.memory.textures,
      highlights: internals.scene.children.filter((child) => child.name === 'construction-component-highlight').length,
    };
  },
  dispose() {
    scene.dispose();
    scene.dispose();
  },
};
