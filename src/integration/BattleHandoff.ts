import type { GameStore } from '../game/GameStore';
import type { BattleResult, BattleSetup } from '../game/types';

export interface BattleViewContract {
  resize(): void;
  dispose(): void;
}

export interface BattleUIContract {
  setBattleActive(active: boolean): void;
}

export type BattleViewFactory = (
  setup: BattleSetup,
  onComplete: (result: BattleResult) => void,
) => BattleViewContract;

interface BattleHandoffOptions {
  store: GameStore;
  ui: BattleUIContract;
  createView: BattleViewFactory;
  onVisibilityChange: (active: boolean) => void;
  onError: (error: Error) => void;
}

export class BattleHandoff {
  private readonly store: GameStore;
  private readonly ui: BattleUIContract;
  private readonly createView: BattleViewFactory;
  private readonly onVisibilityChange: (active: boolean) => void;
  private readonly onError: (error: Error) => void;
  private readonly unsubscribe: () => void;
  private view: BattleViewContract | null = null;
  private battleId: string | null = null;
  private active = false;
  private completing = false;
  private disposed = false;

  constructor(options: BattleHandoffOptions) {
    this.store = options.store;
    this.ui = options.ui;
    this.createView = options.createView;
    this.onVisibilityChange = options.onVisibilityChange;
    this.onError = options.onError;
    this.unsubscribe = this.store.subscribe(this.sync);
    this.sync();
  }

  private readonly sync = (): void => {
    if (this.disposed) return;
    const setup = this.store.getState().pendingBattle;
    if (setup && setup.id === this.battleId) return;
    this.clearView();
    if (!setup) return;

    this.battleId = setup.id;
    this.active = true;
    this.ui.setBattleActive(true);
    this.onVisibilityChange(true);
    try {
      this.view = this.createView(setup, this.complete);
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error('Unable to create the tactical battle'));
    }
  };

  private readonly complete = (result: BattleResult): void => {
    if (this.disposed || this.completing) return;
    const pending = this.store.getState().pendingBattle;
    if (!pending || pending.id !== this.battleId || result.setupId !== pending.id) return;
    this.completing = true;
    const applied = this.store.applyBattleResult(result);
    this.completing = false;
    if (!applied.ok) this.onError(new Error(applied.error));
  };

  private clearView(): void {
    const view = this.view;
    this.view = null;
    this.battleId = null;
    if (this.active) {
      this.active = false;
      this.ui.setBattleActive(false);
      this.onVisibilityChange(false);
    }
    view?.dispose();
  }

  resize(): void {
    this.view?.resize();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.clearView();
  }
}
