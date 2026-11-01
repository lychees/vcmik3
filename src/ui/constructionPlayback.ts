import type { GameStore } from '../game/GameStore';
import type { ConstructionStartOptions, ConstructionStatus } from '../town/construction';
import { TownScene, type TownBuildingInteraction } from '../town/TownScene';

interface ConstructionRequest {
  townId: string;
  buildingId: string;
}

export class ConstructionConfirmation {
  private pending: ConstructionRequest | null = null;

  run<T>(townId: string, buildingId: string, action: () => T): T {
    const request = { townId, buildingId };
    this.pending = request;
    try {
      return action();
    } finally {
      if (this.pending === request) this.pending = null;
    }
  }

  consume(townId: string, buildingId: string): boolean {
    if (this.pending?.townId !== townId || this.pending.buildingId !== buildingId) return false;
    this.pending = null;
    return true;
  }
}

export class ConfirmedConstructionTownScene extends TownScene {
  constructor(
    container: HTMLElement,
    store: GameStore,
    onInteract: (interaction: TownBuildingInteraction) => void,
    private readonly confirmation: ConstructionConfirmation,
  ) {
    super(container, store, onInteract);
    container.querySelector<HTMLInputElement>('.h3-town-scene__construction-progress input')?.setAttribute('step', '0.001');
  }

  override startConstruction(
    townId: string,
    buildingId: string,
    options: ConstructionStartOptions = {},
  ): ConstructionStatus | null {
    if (!this.confirmation.consume(townId, buildingId)) return null;
    return super.startConstruction(townId, buildingId, options);
  }
}
