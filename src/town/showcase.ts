import { GameStore } from '../game/GameStore';
import { FACTIONS } from '../game/factions';
import type { GameState } from '../game/types';
import { COMMON_BUILDING_IDS, type FactionId } from './registry';
import { TownScene, type TownBuildingInteraction } from './TownScene';

interface TownShowcaseApi {
  interactions: TownBuildingInteraction[];
  setTown(faction: FactionId, built: boolean): string[];
  clearInteractions(): void;
  clearTown(): void;
  subscriptionCount(): number;
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
    interactions.length = 0;
    return [...COMMON_BUILDING_IDS, ...definition.buildingIds];
  },
  clearInteractions() {
    interactions.length = 0;
  },
  clearTown() {
    scene.setTown(null);
  },
  subscriptionCount() {
    return subscriptions;
  },
  dispose() {
    scene.dispose();
    scene.dispose();
  },
};
