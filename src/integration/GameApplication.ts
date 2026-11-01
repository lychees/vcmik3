import { AdventureMap } from '../adventure';
import { BattleView } from '../battle';
import { ContentEditor, ContentEditorStore, createCustomContentBattleHooks } from '../editor';
import type { CustomContentBattleHooks } from '../editor';
import {
  DEFAULT_MAP_HEIGHT,
  DEFAULT_MAP_WIDTH,
  FACTIONS,
  GameStore,
  createDefaultSpellbook,
  registerCustomArtifacts,
  registerCustomCreatures,
} from '../game';
import type { ArtifactDefinition, BattleResult, BattleSetup, CreatureDefinition, PrimarySkills } from '../game';
import { GameUI } from '../ui/GameUI';
import { factionIcon } from '../ui/icons';
import { getFactionVisual, ROSTER_COUNTS } from '../ui/presentation';
import { BattleHandoff } from './BattleHandoff';
import './styles.css';
import '../ui/h3content.css';

export interface GameApplicationOptions {
  store?: GameStore;
  showOnboarding?: boolean;
}

export function createSandboxBattleSetup(
  creature: CreatureDefinition,
  artifact?: ArtifactDefinition,
): BattleSetup {
  const primarySkills: PrimarySkills = { attack: 2, defense: 2, spellPower: 2, knowledge: 4 };
  if (artifact) {
    for (const [stat, amount] of Object.entries(artifact.bonuses)) {
      primarySkills[stat as keyof PrimarySkills] += amount ?? 0;
    }
  }
  return {
    id: `sandbox:${creature.id}:${artifact?.id ?? 'none'}`,
    seed: `sandbox:${creature.id}:${artifact?.id ?? 'none'}`,
    source: { heroId: 'sandbox-hero', objectId: 'custom-content-sandbox', kind: 'monster' },
    attacker: {
      ownerId: 'sandbox-red', heroId: 'sandbox-hero', primarySkills,
      army: [{ creatureId: creature.id, count: 12 }], spells: createDefaultSpellbook(),
      mana: primarySkills.knowledge * 10, maxMana: primarySkills.knowledge * 10,
    },
    defender: {
      ownerId: 'sandbox-blue', heroId: 'sandbox-enemy',
      primarySkills: { attack: 1, defense: 1, spellPower: 1, knowledge: 4 },
      army: [{ creatureId: 'militia', count: 12 }], spells: createDefaultSpellbook(), mana: 40, maxMana: 40,
    },
    rewards: { experience: 0, resources: {} },
  };
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
  private readonly editorStore: ContentEditorStore;
  private readonly editor: ContentEditor;
  private readonly customHooks: CustomContentBattleHooks;
  private readonly editorLayer: HTMLElement;
  private readonly editorLaunch: HTMLButtonElement;
  private sandbox: BattleView | null = null;
  private readonly abort = new AbortController();
  private readonly resizeObserver: ResizeObserver | null;
  private disposed = false;

  constructor(container: HTMLElement, options: GameApplicationOptions = {}) {
    this.store = options.store ?? new GameStore({ autoLoad: false });
    this.editorStore = new ContentEditorStore();
    this.customHooks = createCustomContentBattleHooks(this.editorStore);
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
      <button class="h3-editor-launch" type="button" data-action="open-editor" aria-label="Open custom content editor">Content editor</button>
      <section class="h3-editor-layer" aria-label="Custom content workspace" hidden>
        <div class="h3-editor-frame">
          <header class="h3-editor-toolbar">
            <div><strong>H3CONTENT workshop</strong><p class="h3-sandbox-result" role="status"></p></div>
            <div class="h3-sandbox-controls">
              <label for="h3-sandbox-creature">Creature</label><select id="h3-sandbox-creature"></select>
              <label for="h3-sandbox-artifact">Artifact</label><select id="h3-sandbox-artifact"></select>
              <button type="button" data-action="start-sandbox">Start sandbox battle</button>
              <button type="button" data-action="leave-sandbox" hidden>Leave sandbox</button>
              <button type="button" data-action="close-editor" aria-label="Close content editor">Close</button>
            </div>
          </header>
          <div class="h3-editor-workspace"><div class="h3-editor-host"></div></div>
          <div class="h3-sandbox-host" hidden></div>
        </div>
      </section>
      <section class="h3-onboarding" id="h3-onboarding" aria-labelledby="h3-onboarding-title">
        <div class="h3-onboarding-panel">
          <div class="h3-onboarding-sigil" aria-hidden="true"><span>AV</span></div>
          <p class="h3-onboarding-eyebrow">${ROSTER_COUNTS.factions} factions · ${ROSTER_COUNTS.units} units · ${ROSTER_COUNTS.factions} accessible towns</p>
          <h1 id="h3-onboarding-title">Aster Vale</h1>
          <p class="h3-onboarding-intro">Command heroes across an enlarged ${DEFAULT_MAP_WIDTH} × ${DEFAULT_MAP_HEIGHT} realm with 19 tactical spells, 10 resource types, and 20 collectible artifacts. Develop faction-specific towns and unite every stronghold.</p>
          <ul class="h3-onboarding-roster" aria-label="${ROSTER_COUNTS.factions} faction roster">${factionRoster}</ul>
          <ol class="h3-onboarding-steps">
            <li><strong>Explore</strong><span>Collect treasure and artifacts, claim mines, and equip finds from the hero panel to strengthen primary stats.</span></li>
            <li><strong>Build</strong><span>Develop all 13 faction towns, recruit their 72-unit roster, and review each hero’s expanded spellbook.</span></li>
            <li><strong>Create</strong><span>Use the content editor to register custom creatures and artifacts, then test them in an isolated tactical sandbox.</span></li>
          </ol>
          <label class="h3-onboarding-seed" for="h3-seed">Campaign seed</label>
          <input id="h3-seed" type="text" maxlength="80" autocomplete="off">
          <p class="h3-onboarding-error" role="alert" hidden></p>
          <div class="h3-onboarding-actions">
            <button class="h3-start-primary" type="button" data-action="start-new">Begin new campaign</button>
            <button class="h3-start-secondary" id="h3-continue" type="button" data-action="continue" hidden>Continue autosave</button>
            <button class="h3-start-secondary" type="button" data-action="onboarding-editor">Open content editor</button>
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
    this.editorLayer = this.query('.h3-editor-layer');
    this.editorLaunch = this.query<HTMLButtonElement>('[data-action="open-editor"]');
    this.editor = new ContentEditor(this.query('.h3-editor-host'), {
      store: this.editorStore,
      onChange: () => this.syncCustomContent(),
    });
    this.syncCustomContent();
    const seedInput = this.query<HTMLInputElement>('#h3-seed');
    seedInput.value = this.store.getState().seed;
    const continueButton = this.query<HTMLButtonElement>('#h3-continue');
    continueButton.hidden = !this.store.hasSavedGame();
    if (options.showOnboarding === false) this.onboarding.hidden = true;

    const signal = this.abort.signal;
    this.editorLaunch.addEventListener('click', () => this.openEditor(), { signal });
    this.query<HTMLButtonElement>('[data-action="onboarding-editor"]').addEventListener('click', () => this.openEditor(), { signal });
    this.query<HTMLButtonElement>('[data-action="close-editor"]').addEventListener('click', () => this.closeEditor(), { signal });
    this.query<HTMLButtonElement>('[data-action="start-sandbox"]').addEventListener('click', () => this.startSandbox(), { signal });
    this.query<HTMLButtonElement>('[data-action="leave-sandbox"]').addEventListener('click', () => this.closeSandbox(), { signal });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.editorLayer.hidden && !this.sandbox) this.closeEditor();
    }, { signal });
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
      createView: (setup, onComplete) => new BattleView(this.battleLayer, setup, onComplete, {
        createCustomCreatureModel: this.customHooks.createCreatureModel,
      }),
      onVisibilityChange: (active) => this.setBattleVisibility(active),
      onError: (error) => this.showFatal(error),
    });
    this.resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      this.adventure.resize();
      this.handoff.resize();
      this.sandbox?.resize();
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

  private syncCustomContent(): void {
    if (this.disposed) return;
    const registry = this.editorStore.getSnapshot();
    registerCustomCreatures(registry.creatures);
    registerCustomArtifacts(registry.artifacts);
    const creatureSelect = this.query<HTMLSelectElement>('#h3-sandbox-creature');
    const artifactSelect = this.query<HTMLSelectElement>('#h3-sandbox-artifact');
    const selectedCreature = creatureSelect.value;
    const selectedArtifact = artifactSelect.value;
    creatureSelect.replaceChildren();
    for (const creature of registry.creatures) {
      const option = document.createElement('option');
      option.value = creature.id;
      option.textContent = `${creature.name} · Tier ${creature.tier}`;
      creatureSelect.appendChild(option);
    }
    if (registry.creatures.some((creature) => creature.id === selectedCreature)) creatureSelect.value = selectedCreature;
    artifactSelect.replaceChildren();
    const noArtifact = document.createElement('option');
    noArtifact.value = '';
    noArtifact.textContent = 'No custom artifact';
    artifactSelect.appendChild(noArtifact);
    for (const artifact of registry.artifacts) {
      const option = document.createElement('option');
      option.value = artifact.id;
      option.textContent = `${artifact.name} · ${artifact.slot}`;
      artifactSelect.appendChild(option);
    }
    if (registry.artifacts.some((artifact) => artifact.id === selectedArtifact)) artifactSelect.value = selectedArtifact;
    this.query<HTMLButtonElement>('[data-action="start-sandbox"]').disabled = registry.creatures.length === 0 || Boolean(this.sandbox);
  }

  private openEditor(): void {
    if (this.disposed || this.store.getState().pendingBattle) return;
    this.store.setCampaignCommandsSuspended(true);
    this.ui.setEditorActive(true);
    this.editorLayer.hidden = false;
    this.root.dataset.editorOpen = 'true';
    this.syncCustomContent();
    this.query<HTMLButtonElement>('[data-action="close-editor"]').focus({ preventScroll: true });
  }

  private closeEditor(): void {
    if (this.editorLayer.hidden) return;
    this.closeSandbox();
    this.editorLayer.hidden = true;
    this.root.dataset.editorOpen = 'false';
    this.store.setCampaignCommandsSuspended(false);
    this.ui.setEditorActive(false);
    const returnTarget = this.onboarding.hidden
      ? this.editorLaunch
      : this.query<HTMLButtonElement>('[data-action="onboarding-editor"]');
    returnTarget.focus({ preventScroll: true });
  }

  private startSandbox(): void {
    if (this.sandbox || this.store.getState().pendingBattle) return;
    const creatureId = this.query<HTMLSelectElement>('#h3-sandbox-creature').value;
    const creature = this.editorStore.getCreature(creatureId);
    if (!creature) return;
    const artifactId = this.query<HTMLSelectElement>('#h3-sandbox-artifact').value;
    const artifact = artifactId ? this.editorStore.getArtifact(artifactId) : undefined;
    const setup = createSandboxBattleSetup(creature, artifact);
    this.query<HTMLElement>('.h3-editor-workspace').hidden = true;
    const host = this.query<HTMLElement>('.h3-sandbox-host');
    host.hidden = false;
    this.query<HTMLButtonElement>('[data-action="start-sandbox"]').hidden = true;
    this.query<HTMLButtonElement>('[data-action="leave-sandbox"]').hidden = false;
    this.sandbox = new BattleView(host, setup, (result) => this.completeSandbox(result), {
      createCustomCreatureModel: this.customHooks.createCreatureModel,
    });
  }

  private completeSandbox(result: BattleResult): void {
    const summary = `Sandbox complete: ${result.winner} wins after ${result.rounds} round${result.rounds === 1 ? '' : 's'}. Campaign state was not changed.`;
    this.closeSandbox();
    this.query<HTMLElement>('.h3-sandbox-result').textContent = summary;
  }

  private closeSandbox(): void {
    this.sandbox?.dispose();
    this.sandbox = null;
    const host = this.root.querySelector<HTMLElement>('.h3-sandbox-host');
    if (host) {
      host.hidden = true;
      host.replaceChildren();
    }
    const workspace = this.root.querySelector<HTMLElement>('.h3-editor-workspace');
    if (workspace) workspace.hidden = false;
    const start = this.root.querySelector<HTMLButtonElement>('[data-action="start-sandbox"]');
    if (start) start.hidden = false;
    const leave = this.root.querySelector<HTMLButtonElement>('[data-action="leave-sandbox"]');
    if (leave) leave.hidden = true;
    if (!this.editorLayer.hidden) this.syncCustomContent();
  }

  private setBattleVisibility(active: boolean): void {
    if (active) this.closeEditor();
    this.editorLaunch.hidden = active;
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
    this.sandbox?.dispose();
    this.sandbox = null;
    this.editor.dispose();
    this.ui.dispose();
    this.adventure.dispose();
    this.root.remove();
  }
}
