import { AdventureMap } from '../adventure';
import { BattleView } from '../battle';
import { DEFAULT_MAP_HEIGHT, DEFAULT_MAP_WIDTH, FACTIONS, GameStore } from '../game';
import { GameUI } from '../ui/GameUI';
import { factionIcon } from '../ui/icons';
import { getFactionVisual, ROSTER_COUNTS } from '../ui/presentation';
import { BattleHandoff } from './BattleHandoff';
import './styles.css';

export interface GameApplicationOptions {
  store?: GameStore;
  showOnboarding?: boolean;
}

export class GameApplication {
  private readonly root: HTMLDivElement;
  private readonly store: GameStore;
  private readonly adventureLayer: HTMLDivElement;
  private readonly battleLayer: HTMLDivElement;
  private readonly onboarding: HTMLElement;
  private readonly adventure: AdventureMap;
  private readonly ui: GameUI;
  private readonly handoff: BattleHandoff;
  private readonly abort = new AbortController();
  private readonly resizeObserver: ResizeObserver | null;
  private disposed = false;

  constructor(container: HTMLElement, options: GameApplicationOptions = {}) {
    this.store = options.store ?? new GameStore({ autoLoad: false });
    this.root = document.createElement('div');
    this.root.className = 'h3-application';
    this.root.dataset.mode = 'adventure';
    const factionRoster = Object.values(FACTIONS).map((faction) => {
      const visual = getFactionVisual(faction.name);
      return `<li data-faction="${faction.name}" title="${faction.name}: four unit tiers" style="--h3-faction:${visual.primary}">${factionIcon(faction.name)}<span>${faction.name}</span></li>`;
    }).join('');
    this.root.innerHTML = `
      <div class="h3-adventure-layer" data-testid="adventure-layer"></div>
      <div class="h3-battle-layer" data-testid="battle-layer" hidden></div>
      <div class="h3-ui-layer"></div>
      <section class="h3-onboarding" id="h3-onboarding" aria-labelledby="h3-onboarding-title">
        <div class="h3-onboarding-panel">
          <div class="h3-onboarding-sigil" aria-hidden="true"><span>AV</span></div>
          <p class="h3-onboarding-eyebrow">${ROSTER_COUNTS.factions} factions · ${ROSTER_COUNTS.units} units · ${ROSTER_COUNTS.factions} accessible towns</p>
          <h1 id="h3-onboarding-title">Aster Vale</h1>
          <p class="h3-onboarding-intro">Command heroes across an enlarged ${DEFAULT_MAP_WIDTH} × ${DEFAULT_MAP_HEIGHT} realm, develop faction-specific towns, and unite every stronghold in tactical turn-based combat.</p>
          <ul class="h3-onboarding-roster" aria-label="${ROSTER_COUNTS.factions} faction roster">${factionRoster}</ul>
          <ol class="h3-onboarding-steps">
            <li><strong>Explore</strong><span>Select your hero and choose a highlighted tile. Collect treasure and claim mines.</span></li>
            <li><strong>Build</strong><span>Visit Aster Keep or Cinder Bastion, then develop any captured faction’s four-tier town chain.</span></li>
            <li><strong>Conquer</strong><span>Engage hostile forces on a 3D battlefield and capture every enemy town in the current campaign.</span></li>
          </ol>
          <label class="h3-onboarding-seed" for="h3-seed">Campaign seed</label>
          <input id="h3-seed" type="text" maxlength="80" autocomplete="off">
          <p class="h3-onboarding-error" role="alert" hidden></p>
          <div class="h3-onboarding-actions">
            <button class="h3-start-primary" type="button" data-action="start-new">Begin new campaign</button>
            <button class="h3-start-secondary" id="h3-continue" type="button" data-action="continue" hidden>Continue autosave</button>
          </div>
          <p class="h3-onboarding-footnote">Runs entirely in your browser · Local saves · No account or backend required</p>
        </div>
      </section>
      <section class="h3-application-fatal" role="alert" hidden>
        <div><strong>The realm could not be displayed</strong><p></p><button type="button" data-action="reload">Reload application</button></div>
      </section>
    `;
    container.replaceChildren(this.root);

    this.adventureLayer = this.query('.h3-adventure-layer');
    this.battleLayer = this.query('.h3-battle-layer');
    this.onboarding = this.query('.h3-onboarding');
    const seedInput = this.query<HTMLInputElement>('#h3-seed');
    seedInput.value = this.store.getState().seed;
    const continueButton = this.query<HTMLButtonElement>('#h3-continue');
    continueButton.hidden = !this.store.hasSavedGame();
    if (options.showOnboarding === false) this.onboarding.hidden = true;

    const signal = this.abort.signal;
    this.query<HTMLButtonElement>('[data-action="start-new"]').addEventListener('click', () => {
      const result = this.store.newGame(seedInput.value.trim() || 'h3core-default');
      if (!result.ok) {
        this.showOnboardingError(result.error);
        return;
      }
      this.closeOnboarding();
    }, { signal });
    continueButton.addEventListener('click', () => {
      const result = this.store.loadGame();
      if (!result.ok) {
        this.showOnboardingError(result.error);
        continueButton.hidden = !this.store.hasSavedGame();
        return;
      }
      seedInput.value = result.value.seed;
      this.closeOnboarding();
    }, { signal });
    this.query<HTMLButtonElement>('[data-action="reload"]').addEventListener('click', () => {
      window.location.reload();
    }, { signal });

    this.adventure = new AdventureMap(this.adventureLayer, this.store);
    this.ui = new GameUI(this.query('.h3-ui-layer'), this.store);
    this.handoff = new BattleHandoff({
      store: this.store,
      ui: this.ui,
      createView: (setup, onComplete) => new BattleView(this.battleLayer, setup, onComplete),
      onVisibilityChange: (active) => this.setBattleVisibility(active),
      onError: (error) => this.showFatal(error),
    });
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      this.adventure.resize();
      this.handoff.resize();
    });
    this.resizeObserver?.observe(this.root);
    this.setBattleVisibility(Boolean(this.store.getState().pendingBattle));
    if (this.onboarding.hidden) this.focusActiveView();
  }

  private query<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Application element is missing: ${selector}`);
    return element;
  }

  private setBattleVisibility(active: boolean): void {
    this.root.dataset.mode = active ? 'battle' : 'adventure';
    this.adventureLayer.hidden = active;
    this.battleLayer.hidden = !active;
    if (!active) this.adventure.resize();
  }

  private showOnboardingError(message: string): void {
    const error = this.query<HTMLElement>('.h3-onboarding-error');
    error.textContent = message;
    error.hidden = false;
  }

  private closeOnboarding(): void {
    this.query<HTMLElement>('.h3-onboarding-error').hidden = true;
    this.onboarding.hidden = true;
    this.focusActiveView();
  }

  private focusActiveView(): void {
    const target = this.battleLayer.hidden
      ? this.adventureLayer.querySelector<HTMLCanvasElement>('canvas')
      : this.battleLayer.querySelector<HTMLElement>('.h3b-root');
    target?.focus({ preventScroll: true });
  }

  private showFatal(error: Error): void {
    const layer = this.query<HTMLElement>('.h3-application-fatal');
    layer.querySelector('p')!.textContent = error.message;
    layer.hidden = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.resizeObserver?.disconnect();
    this.abort.abort();
    this.handoff.dispose();
    this.ui.dispose();
    this.adventure.dispose();
    this.root.remove();
  }
}
