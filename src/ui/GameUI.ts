import '../styles.css';
import '../town/factions';
import { TownScene, type TownBuildingInteraction } from '../town/TownScene';
import { MAX_ARMY_STACKS } from '../game/army';
import {
  ARTIFACT_SLOTS,
  aggregateArtifactBonuses,
  getArtifact,
  getEffectivePrimarySkills,
} from '../game/artifacts';
import {
  getBuilding,
  getCreature,
  getHeroDefinition,
} from '../game/content';
import { GameStore } from '../game/GameStore';
import { EXTENDED_RESOURCE_TYPES as RESOURCE_TYPES } from '../game/resources';
import { getCombatSpell } from '../game/spellbook';
import { getObjectAt } from '../game/map';
import type {
  GameEvent,
  GameState,
  HeroState,
  InteractionResult,
  Point,
  PrimarySkills,
  ResourceBundle,
  TownState,
} from '../game/types';
import { DialogManager } from './DialogManager';
import {
  DAY_NAMES,
  RESOURCE_META,
  armyCount,
  escapeHtml,
  formatCalendar,
  formatCalendarShort,
  formatCost,
  formatNumber,
  getBuildingAvailability,
  getCurrentObjective,
  getDailyIncome,
  getHeroCycleTarget,
  getLevelProgress,
  getNewLogEvents,
  getRecruitLimit,
  getTownBuildings,
  getTransferLimit,
  hasResourceCost,
  multiplyCost,
} from './format';
import { creaturePortrait, factionIcon, heroPortrait, icon, resourceIcon, townBanner } from './icons';
import { Minimap } from './Minimap';
import { getFactionVisual, ROSTER_COUNTS } from './presentation';
import { getTownBuildingDestination, type TownTab } from './townInteractions';

type ToastTone = 'info' | 'success' | 'warning' | 'error';

interface HeroSnapshot {
  level: number;
  skills: PrimarySkills;
}

const SAVE_SLOTS = ['autosave', 'slot-1', 'slot-2', 'slot-3'] as const;

export class GameUI {
  private readonly container: HTMLElement;
  private readonly store: GameStore;
  private readonly root: HTMLDivElement;
  private readonly dialogs: DialogManager;
  private readonly minimap: Minimap;
  private readonly unsubscribe: () => void;
  private readonly toastTimers = new Set<ReturnType<typeof setTimeout>>();
  private readonly handledInteractionEvents = new WeakSet<Event>();
  private readonly heroSnapshots = new Map<string, HeroSnapshot>();
  private lastState: Readonly<GameState>;
  private eventLogSnapshot: readonly GameEvent[];
  private lastPhase: GameState['phase'];
  private lastBattleId: string | null;
  private activeTownId: string | null = null;
  private townTab: TownTab = 'overview';
  private townScene: TownScene | null = null;
  private townScreenTownId: string | null = null;
  private focusedTownBuildingId: string | null = null;
  private focusedCreatureId: string | null = null;
  private battleActive = false;
  private editorActive = false;
  private minimapExpanded = false;
  private disposed = false;

  constructor(container: HTMLElement, store: GameStore) {
    this.container = container;
    this.store = store;
    this.lastState = store.getState();
    this.eventLogSnapshot = [...this.lastState.log];
    this.lastPhase = this.lastState.phase;
    this.lastBattleId = this.lastState.pendingBattle?.id ?? null;
    for (const hero of Object.values(this.lastState.heroes)) {
      this.heroSnapshots.set(hero.id, { level: hero.level, skills: { ...hero.primarySkills } });
    }

    this.root = document.createElement('div');
    this.root.className = 'h3-ui';
    this.root.dataset.battleActive = 'false';
    this.root.innerHTML = `
      <header class="h3-topbar" aria-label="Realm resources and calendar">
        <button type="button" class="h3-brand" data-action="game-menu" aria-label="Open campaign menu" title="Campaign menu">
          <span class="h3-brand-sigil" aria-hidden="true">${icon('compass')}</span>
          <span><strong>H3CORE</strong><small>ASTER VALE</small></span>
        </button>
        <ul class="h3-resources" aria-label="Player resources"></ul>
        <div class="h3-calendar" aria-label="Game calendar"></div>
        <button type="button" class="h3-icon-button h3-help-button" data-action="help" aria-label="Open field guide and keyboard shortcuts" title="Field guide (?)">${icon('help')}</button>
      </header>

      <aside class="h3-hero-panel h3-panel" aria-label="Selected hero"></aside>

      <section class="h3-objective h3-panel" aria-live="polite" aria-label="Current objective"></section>

      <aside class="h3-minimap-panel h3-panel" aria-label="Strategic overview">
        <header><span>${icon('map')} Strategic map</span><button type="button" class="h3-icon-button" data-action="minimap-expand" aria-label="Expand strategic map and town atlas" aria-pressed="false" title="Expand map and town atlas (M)">${icon('compass')}</button></header>
        <p class="h3-minimap-summary"></p>
        <canvas class="h3-minimap" tabindex="0" role="button" aria-label="Strategic minimap. Click a tile to select a hero or travel. Use arrow keys to choose a tile and Enter to travel."></canvas>
        <div class="h3-town-atlas" aria-label="Town atlas" hidden></div>
        <footer><span class="h3-map-legend"><i></i> Faction colors</span><span>Owner outlines</span></footer>
      </aside>

      <nav class="h3-command-bar h3-panel" aria-label="Adventure commands">
        <button type="button" class="h3-command" data-action="previous-hero" aria-label="Select previous hero" title="Previous hero (Shift+H)">${icon('left')}<span>Previous</span></button>
        <button type="button" class="h3-command" data-action="next-hero" aria-label="Select next hero" title="Next hero (H)">${icon('hero')}<span>Next hero</span><kbd>H</kbd></button>
        <button type="button" class="h3-command" data-action="interact" aria-label="Interact with current tile" title="Interact (Space)">${icon('spark')}<span>Interact</span><kbd>Space</kbd></button>
        <button type="button" class="h3-command" data-action="enter-town" aria-label="Enter the town at the selected hero position" title="Enter town (T)">${icon('castle')}<span>Enter town</span><kbd>T</kbd></button>
        <button type="button" class="h3-command" data-action="game-menu" aria-label="Open save, load, and new campaign menu" title="Campaign menu">${icon('save')}<span>Campaign</span></button>
        <button type="button" class="h3-command h3-end-turn" data-action="end-turn" aria-label="End the current turn" title="End turn (N)">${icon('endTurn')}<span>End turn</span><kbd>N</kbd></button>
      </nav>

      <section class="h3-town-layer" aria-label="Town interface" hidden></section>
      <div class="h3-battle-status" role="status" hidden>${icon('sword')}<span><strong>Tactical battle in progress</strong><small>Adventure commands are paused until combat is resolved.</small></span></div>
      <div class="h3-toasts" aria-live="polite" aria-relevant="additions"></div>
    `;
    this.container.appendChild(this.root);
    this.root.addEventListener('click', this.handleClick);
    this.root.addEventListener('input', this.handleInput);
    this.root.addEventListener('change', this.handleChange);
    document.addEventListener('keydown', this.handleKeyDown);
    this.container.addEventListener('adventure-interaction', this.handleAdventureInteraction);
    document.addEventListener('adventure-interaction', this.handleAdventureInteraction);
    this.dialogs = new DialogManager(this.root);
    const canvas = this.root.querySelector<HTMLCanvasElement>('.h3-minimap');
    if (!canvas) throw new Error('Minimap canvas could not be created');
    this.minimap = new Minimap(canvas, (point) => this.navigateFromMinimap(point));
    this.unsubscribe = this.store.subscribe(this.handleStateChange);
    this.render();
    if (this.lastState.pendingBattle) this.showBattleHandoff(this.lastState);
    if (this.lastState.phase !== 'playing') this.showOutcome(this.lastState);
    this.notify('Welcome to Aster Vale', 'Choose a reachable tile to travel. Press ? for the field guide.', 'info', 6000);
  }

  private query<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`UI element is missing: ${selector}`);
    return element;
  }

  private readonly handleStateChange = (state: Readonly<GameState>): void => {
    if (this.disposed) return;
    const replaced = state !== this.lastState;
    if (replaced) {
      this.activeTownId = null;
      this.dialogs.clear();
      this.eventLogSnapshot = [...state.log];
      this.heroSnapshots.clear();
      for (const hero of Object.values(state.heroes)) {
        this.heroSnapshots.set(hero.id, { level: hero.level, skills: { ...hero.primarySkills } });
      }
    } else {
      const events = getNewLogEvents(this.eventLogSnapshot, state.log);
      this.eventLogSnapshot = [...state.log];
      for (const event of events) this.notifyGameEvent(event);
      for (const hero of Object.values(state.heroes)) {
        const previous = this.heroSnapshots.get(hero.id);
        if (previous && hero.level > previous.level) this.showLevelUp(hero, previous);
        this.heroSnapshots.set(hero.id, { level: hero.level, skills: { ...hero.primarySkills } });
      }
    }
    const battleId = state.pendingBattle?.id ?? null;
    if (battleId && battleId !== this.lastBattleId && !replaced) {
      this.activeTownId = null;
      this.showBattleHandoff(state);
    }
    if (state.phase !== this.lastPhase && state.phase !== 'playing') this.showOutcome(state);
    this.lastPhase = state.phase;
    this.lastBattleId = battleId;
    this.lastState = state;
    this.render();
  };

  private render(): void {
    if (this.disposed) return;
    const state = this.store.getState();
    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusAction = activeElement?.dataset.action;
    const focusCreature = activeElement?.dataset.creatureId;
    const focusBuilding = activeElement?.dataset.buildingId;
    const focusTownTab = activeElement?.dataset.townTab;
    const focusTownId = activeElement?.dataset.townId;
    const focusDirection = activeElement?.dataset.direction;
    this.root.dataset.phase = state.phase;
    this.root.dataset.editorActive = String(this.editorActive);
    this.root.dataset.townOpen = String(Boolean(this.activeTownId && !this.battleActive));
    const adventureInert = this.battleActive || this.editorActive || Boolean(this.activeTownId);
    for (const selector of ['.h3-topbar', '.h3-hero-panel', '.h3-minimap-panel', '.h3-command-bar']) {
      this.query<HTMLElement>(selector).inert = adventureInert;
    }
    this.renderResources(state);
    this.renderHero(state);
    this.renderObjective(state);
    this.renderCommands(state);
    this.renderTown(state);
    const battleStatus = this.query<HTMLElement>('.h3-battle-status');
    battleStatus.hidden = !this.battleActive;
    this.root.dataset.battleActive = String(this.battleActive);
    this.minimap.setEnabled(!this.battleActive && !this.editorActive && state.phase === 'playing' && !state.pendingBattle && !this.activeTownId);
    const reachable = !this.battleActive && !this.editorActive && !this.activeTownId ? this.store.getReachableTiles() : [];
    this.minimap.render(state, reachable);
    if (focusAction) {
      const candidates = [...this.root.querySelectorAll<HTMLElement>('[data-action]')];
      const target = candidates.find((element) =>
        element.dataset.action === focusAction &&
        element.dataset.creatureId === focusCreature &&
        element.dataset.buildingId === focusBuilding &&
        element.dataset.townTab === focusTownTab &&
        element.dataset.townId === focusTownId &&
        element.dataset.direction === focusDirection &&
        !element.hasAttribute('disabled'));
      target?.focus({ preventScroll: true });
    }
  }

  private renderResources(state: Readonly<GameState>): void {
    const player = state.players[state.activePlayerId];
    const resources = this.query<HTMLUListElement>('.h3-resources');
    resources.innerHTML = RESOURCE_TYPES.map((resource) => {
      const amount = player?.resources[resource] ?? 0;
      return `<li class="h3-resource" title="${RESOURCE_META[resource].name}: ${formatNumber(amount)}" aria-label="${RESOURCE_META[resource].name} ${formatNumber(amount)}">
        ${resourceIcon(resource)}<span>${formatNumber(amount)}</span>
      </li>`;
    }).join('');
    const calendar = this.query<HTMLElement>('.h3-calendar');
    calendar.innerHTML = `<span class="h3-calendar-day">${escapeHtml(DAY_NAMES[state.calendar.dayOfWeek - 1] ?? `Day ${state.calendar.dayOfWeek}`)}</span>
      <strong>Week ${state.calendar.week}</strong><small>Month ${state.calendar.month} · Day ${state.calendar.day}</small>`;
    calendar.title = formatCalendar(state.calendar);
  }

  private renderHero(_state: Readonly<GameState>): void {
    const panel = this.query<HTMLElement>('.h3-hero-panel');
    const hero = this.store.getSelectedHero();
    if (!hero || !hero.alive) {
      panel.innerHTML = `<div class="h3-empty-hero">${icon('hero')}<h2>No hero selected</h2><p>Select a friendly hero on the adventure map or strategic overview.</p></div>`;
      return;
    }
    const definition = getHeroDefinition(hero.definitionId);
    const progress = getLevelProgress(hero);
    const effectiveSkills = getEffectivePrimarySkills(hero);
    const artifactCount = Object.values(hero.artifacts.items).reduce((total, count) => total + count, 0);
    const skills: Array<{ key: keyof PrimarySkills; label: string; icon: 'sword' | 'shield' | 'spark' | 'book' }> = [
      { key: 'attack', label: 'Attack', icon: 'sword' },
      { key: 'defense', label: 'Defense', icon: 'shield' },
      { key: 'spellPower', label: 'Spell power', icon: 'spark' },
      { key: 'knowledge', label: 'Knowledge', icon: 'book' },
    ];
    const army = Array.from({ length: MAX_ARMY_STACKS }, (_, index) => {
      const stack = hero.army[index];
      if (!stack) return '<div class="h3-army-slot is-empty" aria-label="Empty army slot"><span>+</span></div>';
      const creature = getCreature(stack.creatureId);
      return `<div class="h3-army-slot" title="${escapeHtml(creature.name)} · ${stack.count} creatures · Tier ${creature.tier}" aria-label="${stack.count} ${escapeHtml(creature.name)}">
        ${creaturePortrait(stack.creatureId)}<strong>${formatNumber(stack.count)}</strong><small>${escapeHtml(creature.name)}</small>
      </div>`;
    }).join('');
    const spells = hero.spells.map((id) => getCombatSpell(id).name).join(' · ');
    panel.innerHTML = `
      <div class="h3-hero-heading">
        <div class="h3-portrait-frame">${heroPortrait(hero.definitionId, hero.name)}<span>LV ${hero.level}</span></div>
        <div class="h3-hero-identity"><p class="h3-eyebrow">${escapeHtml(definition.faction)} · ${escapeHtml(definition.specialty)}</p><h2>${escapeHtml(hero.name)}</h2>
          <div class="h3-xp" title="${formatNumber(hero.experience)} total experience"><span style="width:${progress.percent.toFixed(1)}%"></span></div>
          <small>${formatNumber(progress.current)} / ${formatNumber(progress.required)} XP</small>
        </div>
      </div>
      <div class="h3-primary-stats">${skills.map((skill) => {
        const bonus = effectiveSkills[skill.key] - hero.primarySkills[skill.key];
        return `<div title="${skill.label}: ${effectiveSkills[skill.key]} total (${hero.primarySkills[skill.key]} base ${bonus >= 0 ? '+' : ''}${bonus} equipment)">${icon(skill.icon)}<span>${skill.label}</span><strong>${effectiveSkills[skill.key]}</strong></div>`;
      }).join('')}</div>
      <div class="h3-vitals">
        <div><span>${icon('movement')} Movement</span><strong>${formatNumber(hero.movementPoints)} / ${formatNumber(hero.maxMovementPoints)}</strong><div class="h3-meter"><i style="width:${Math.max(0, Math.min(100, hero.movementPoints / hero.maxMovementPoints * 100))}%"></i></div></div>
        <div><span>${icon('mana')} Mana</span><strong>${hero.mana} / ${hero.maxMana}</strong><div class="h3-meter is-mana"><i style="width:${Math.max(0, Math.min(100, hero.mana / hero.maxMana * 100))}%"></i></div></div>
      </div>
      <section class="h3-army" aria-label="${escapeHtml(hero.name)} army"><header><h3>Army</h3><span>${formatNumber(armyCount(hero.army))} troops · ${hero.army.length}/${MAX_ARMY_STACKS} stacks</span></header><div class="h3-army-grid">${army}</div></section>
      <button type="button" class="h3-button h3-equipment-button" data-action="open-inventory">${icon('shield')} Equipment <span>${artifactCount} in backpack</span></button>
      ${spells ? `<p class="h3-spell-line" title="${escapeHtml(spells)}">${icon('book')}<span>${escapeHtml(spells)}</span></p>` : ''}
    `;
  }

  private renderObjective(state: Readonly<GameState>): void {
    const objective = getCurrentObjective(state);
    const latest = state.log.at(-1);
    this.query<HTMLElement>('.h3-objective').innerHTML = `
      <div class="h3-objective-marker is-${objective.tone}">${icon(objective.tone === 'danger' ? 'sword' : objective.tone === 'complete' ? 'star' : 'compass')}</div>
      <div><p class="h3-eyebrow">Current objective</p><h2>${escapeHtml(objective.title)}</h2><p>${escapeHtml(objective.detail)}</p>
      ${latest ? `<small class="h3-latest-event">Day ${latest.day} · ${escapeHtml(latest.message)}</small>` : ''}</div>`;
  }

  private renderCommands(state: Readonly<GameState>): void {
    const hero = this.store.getSelectedHero();
    const object = hero ? getObjectAt(state.map, hero.position) : undefined;
    const friendlyTown = object?.kind === 'town' && state.towns[object.townId]?.ownerId === state.activePlayerId;
    const unavailable = this.battleActive || state.phase !== 'playing' || Boolean(state.pendingBattle) || !hero;
    const heroes = Object.values(state.heroes).filter((candidate) => candidate.ownerId === state.activePlayerId && candidate.alive);
    const setDisabled = (action: string, disabled: boolean, title?: string): void => {
      const button = this.root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      if (!button) return;
      button.disabled = disabled;
      button.setAttribute('aria-disabled', String(disabled));
      if (title) button.title = title;
    };
    setDisabled('previous-hero', unavailable || heroes.length < 2, heroes.length < 2 ? 'No other surviving heroes' : 'Previous hero (Shift+H)');
    setDisabled('next-hero', unavailable || heroes.length < 2, heroes.length < 2 ? 'No other surviving heroes' : 'Next hero (H)');
    setDisabled('interact', unavailable || !object, object ? 'Interact (Space)' : 'There is nothing to interact with on this tile');
    setDisabled('enter-town', unavailable || !friendlyTown, friendlyTown ? 'Enter town (T)' : 'Move a hero onto a friendly town to enter');
    setDisabled('end-turn', this.battleActive || state.phase !== 'playing' || Boolean(state.pendingBattle), state.pendingBattle ? 'Resolve the battle before ending the turn' : 'End turn (N)');
    const interact = this.root.querySelector<HTMLButtonElement>('[data-action="interact"] span');
    if (interact) {
      interact.textContent = object?.kind === 'resource' || object?.kind === 'artifact' ? 'Collect'
        : object?.kind === 'mine' ? 'Claim'
          : object?.kind === 'dwelling' ? 'Recruit'
            : object?.kind === 'monster' ? 'Battle'
              : object?.kind === 'landmark' ? object.landmarkId === 'wayfarerPortal' ? 'Travel'
                : object.landmarkId === 'merchantsTent' ? 'Trade' : 'Visit'
                : object?.kind === 'town' ? friendlyTown ? 'Enter town' : 'Besiege' : 'Interact';
    }
    const minimapButton = this.root.querySelector<HTMLButtonElement>('[data-action="minimap-expand"]');
    minimapButton?.setAttribute('aria-pressed', String(this.minimapExpanded));
    minimapButton?.setAttribute('aria-label', this.minimapExpanded ? 'Collapse strategic map and town atlas' : 'Expand strategic map and town atlas');
    this.query<HTMLElement>('.h3-minimap-panel').classList.toggle('is-expanded', this.minimapExpanded);
    this.renderMinimapAtlas(state);
  }

  private renderMinimapAtlas(state: Readonly<GameState>): void {
    const towns = Object.values(state.towns).sort((a, b) => a.faction.localeCompare(b.faction));
    this.query<HTMLElement>('.h3-minimap-summary').textContent =
      `${towns.length} towns · ${ROSTER_COUNTS.factions} factions · ${ROSTER_COUNTS.units} units`;
    const atlas = this.query<HTMLElement>('.h3-town-atlas');
    atlas.hidden = !this.minimapExpanded;
    if (!this.minimapExpanded) {
      atlas.replaceChildren();
      return;
    }
    atlas.innerHTML = towns.map((town) => {
      const visual = getFactionVisual(town.faction);
      const owner = state.players[town.ownerId]?.name ?? town.ownerId;
      const relationship = town.ownerId === state.activePlayerId ? 'Friendly' : 'Hostile';
      return `<button type="button" class="h3-atlas-town" data-action="town-navigate" data-town-id="${escapeHtml(town.id)}" style="--h3-faction:${visual.primary}" aria-label="Travel to ${escapeHtml(town.name)}, ${escapeHtml(town.faction)}, ${escapeHtml(relationship)}">
        ${factionIcon(town.faction)}<span><strong>${escapeHtml(town.name)}</strong><small>${escapeHtml(town.faction)} · ${escapeHtml(relationship)}</small></span><small>${town.position.x + 1}, ${town.position.y + 1}</small><span class="sr-only">Owned by ${escapeHtml(owner)}</span>
      </button>`;
    }).join('');
  }

  private renderTown(state: Readonly<GameState>): void {
    const layer = this.query<HTMLElement>('.h3-town-layer');
    const town = this.activeTownId ? this.store.getTown(this.activeTownId) : undefined;
    const player = state.players[state.activePlayerId];
    if (this.battleActive || !town || town.ownerId !== state.activePlayerId || !player) {
      this.destroyTownScreen();
      if (town?.ownerId !== state.activePlayerId) this.activeTownId = null;
      return;
    }
    layer.hidden = false;
    const income = getDailyIncome(town);
    const visual = getFactionVisual(town.faction);
    if (this.townScreenTownId !== town.id || !this.townScene) {
      this.destroyTownScreen();
      layer.hidden = false;
      layer.innerHTML = `
        <div class="h3-town-screen" role="region" aria-label="${escapeHtml(town.name)} town" data-faction="${escapeHtml(town.faction)}" style="--h3-faction:${visual.primary};--h3-faction-accent:${visual.accent};--h3-faction-dark:${visual.dark}">
          <header class="h3-town-header"></header>
          <nav class="h3-town-tabs" aria-label="Town sections"></nav>
          <div class="h3-town-content"><div class="h3-town-workspace"><section class="h3-town-model" aria-label="Interactive town model"><div class="h3-town-scene-host"></div></section><div class="h3-town-panel"></div></div></div>
          <footer class="h3-town-footer"></footer>
        </div>`;
      const host = layer.querySelector<HTMLElement>('.h3-town-scene-host');
      if (!host) throw new Error('Town scene host could not be created');
      this.townScene = new TownScene(host, this.store, this.handleTownBuildingInteraction);
      this.townScreenTownId = town.id;
      this.townScene.setTown(town.id);
    }
    const screen = layer.querySelector<HTMLElement>('.h3-town-screen');
    if (!screen) throw new Error('Town screen could not be rendered');
    const tabs: Array<{ id: TownTab; label: string; icon: 'castle' | 'construction' | 'recruit' | 'army' | 'book' }> = [
      { id: 'overview', label: 'Town overview', icon: 'castle' },
      { id: 'construction', label: 'Construction', icon: 'construction' },
      { id: 'recruitment', label: 'Recruitment', icon: 'recruit' },
      { id: 'army', label: 'Army management', icon: 'army' },
      { id: 'spellbook', label: 'Spellbook', icon: 'book' },
    ];
    let content = '';
    if (this.townTab === 'overview') content = this.renderTownOverview(town, player.resources);
    else if (this.townTab === 'construction') content = this.renderConstruction(town, player.resources);
    else if (this.townTab === 'recruitment') content = this.renderRecruitment(town, player.resources);
    else if (this.townTab === 'army') content = this.renderArmyManagement(state, town);
    else content = this.renderSpellbook(town);
    screen.querySelector<HTMLElement>('.h3-town-header')!.innerHTML = `
      <div class="h3-town-banner">${townBanner(town.faction)}<div><p class="h3-eyebrow">${factionIcon(town.faction)} ${escapeHtml(town.faction)} stronghold · Four-tier roster</p><h1>${escapeHtml(town.name)}</h1><p>${hasResourceCost(income) ? `${formatCost(income)} each day` : 'A quiet frontier settlement'}</p></div></div>
      <div class="h3-town-header-actions"><span class="h3-build-status ${town.builtToday ? 'is-waiting' : ''}">${icon(town.builtToday ? 'check' : 'construction')}${town.builtToday ? 'Construction complete today' : 'Construction available'}</span><button type="button" class="h3-button" data-action="town-exit" aria-label="Leave ${escapeHtml(town.name)} and return to the adventure map">${icon('close')} Leave town <kbd>Esc</kbd></button></div>`;
    screen.querySelector<HTMLElement>('.h3-town-tabs')!.innerHTML = tabs.map((tab) => `<button type="button" data-action="town-tab" data-town-tab="${tab.id}" class="${this.townTab === tab.id ? 'is-active' : ''}" aria-pressed="${this.townTab === tab.id}">${icon(tab.icon)}<span>${tab.label}</span></button>`).join('');
    screen.querySelector<HTMLElement>('.h3-town-panel')!.innerHTML = content;
    screen.querySelector<HTMLElement>('.h3-town-footer')!.innerHTML = `<span>${icon('coins')} Treasury: <strong>${formatNumber(player.resources.gold)} gold</strong></span><span>${formatCalendarShort(state.calendar)}</span><span>One building may be completed per town each day.</span>`;
  }

  private destroyTownScreen(): void {
    this.townScene?.dispose();
    this.townScene = null;
    this.townScreenTownId = null;
    const layer = this.root.querySelector<HTMLElement>('.h3-town-layer');
    if (layer) {
      layer.hidden = true;
      layer.replaceChildren();
    }
  }

  private renderTownOverview(town: TownState, resources: ResourceBundle): string {
    const income = getDailyIncome(town);
    const built = town.buildings.map((id) => getBuilding(id));
    const dwellingBuildings = built.filter((building) => building.creatureId);
    const visitingHero = this.getVisitingHero(town);
    return `<div class="h3-town-overview">
      <section class="h3-town-summary-grid" aria-label="Town summary">
        <article><span class="h3-summary-icon">${icon('coins')}</span><div><small>Daily income</small><strong>${hasResourceCost(income) ? formatCost(income) : 'None'}</strong><p>Credited at the start of each new day.</p></div></article>
        <article><span class="h3-summary-icon">${icon('shield')}</span><div><small>Garrison</small><strong>${formatNumber(armyCount(town.garrison))} defenders</strong><p>${town.garrison.length} of ${MAX_ARMY_STACKS} army stacks occupied.</p></div></article>
        <article><span class="h3-summary-icon">${icon('recruit')}</span><div><small>Available recruits</small><strong>${formatNumber(Object.values(town.dwellingPools).reduce((sum, count) => sum + count, 0))} creatures</strong><p>Growth arrives at the start of each week.</p></div></article>
        <article><span class="h3-summary-icon">${icon('hero')}</span><div><small>Visiting hero</small><strong>${visitingHero ? escapeHtml(visitingHero.name) : 'No visitor'}</strong><p>${visitingHero ? 'Army transfers are ready.' : 'Bring a hero here to manage armies.'}</p></div></article>
      </section>
      <div class="h3-town-overview-columns">
        <section class="h3-town-section"><header><div><p class="h3-eyebrow">Infrastructure</p><h2>Built structures</h2></div><span>${built.length} / ${getTownBuildings(town).length}</span></header>
          <div class="h3-built-list">${built.map((building) => `<article data-overview-building="${escapeHtml(building.id)}" class="${this.focusedTownBuildingId === building.id ? 'is-focused' : ''}" tabindex="-1"><span>${icon(building.creatureId ? 'recruit' : building.dailyIncome ? 'coins' : 'castle')}</span><div><strong>${escapeHtml(building.name)}</strong><p>${escapeHtml(building.description)}</p>${building.dailyIncome ? `<small>+${formatCost(building.dailyIncome)} daily</small>` : ''}</div>${icon('check')}</article>`).join('')}</div>
          <button type="button" class="h3-button h3-section-action" data-action="town-tab" data-town-tab="construction">${icon('construction')} View construction options ${icon('right')}</button>
        </section>
        <section class="h3-town-section"><header><div><p class="h3-eyebrow">Military dwellings</p><h2>Weekly growth</h2></div><span>${dwellingBuildings.length} dwellings</span></header>
          ${dwellingBuildings.length ? `<div class="h3-growth-list">${dwellingBuildings.map((building) => {
            const creature = getCreature(building.creatureId ?? '');
            return `<article>${creaturePortrait(creature.id)}<div><strong>${escapeHtml(creature.name)}</strong><p>+${creature.growth} each week · ${town.dwellingPools[creature.id] ?? 0} available</p><small>${formatCost(creature.cost)} each</small></div></article>`;
          }).join('')}</div>` : '<p class="h3-empty-state">Construct a creature dwelling to begin recruitment.</p>'}
          <div class="h3-overview-actions"><button type="button" class="h3-button" data-action="town-tab" data-town-tab="recruitment">${icon('recruit')} Recruit armies</button><button type="button" class="h3-button is-secondary" data-action="town-tab" data-town-tab="army">${icon('army')} Manage garrison</button></div>
        </section>
      </div>
      <p class="h3-town-tip">${icon('info')} Resources are shared across your realm. Current stock: ${formatCost(resources)}.</p>
    </div>`;
  }

  private costHtml(cost: ReturnType<typeof multiplyCost>, resources?: ResourceBundle): string {
    const parts = RESOURCE_TYPES.filter((resource) => (cost[resource] ?? 0) > 0).map((resource) => {
      const lacking = resources ? resources[resource] < (cost[resource] ?? 0) : false;
      return `<span class="h3-cost ${lacking ? 'is-lacking' : ''}" title="${RESOURCE_META[resource].name}${lacking ? ' — insufficient' : ''}">${resourceIcon(resource)}${formatNumber(cost[resource] ?? 0)}</span>`;
    });
    return parts.length ? parts.join('') : '<span class="h3-cost">Free</span>';
  }

  private renderConstruction(town: TownState, resources: ResourceBundle): string {
    const buildings = getTownBuildings(town);
    return `<section class="h3-construction"><header class="h3-section-heading"><div><p class="h3-eyebrow">Build the stronghold</p><h2>Construction</h2><p>Prerequisites, costs, and benefits are shown before you commit. Construction cannot be undone.</p></div><span class="h3-build-status ${town.builtToday ? 'is-waiting' : ''}">${town.builtToday ? 'Next project available tomorrow' : 'Ready for one project today'}</span></header>
      <div class="h3-building-grid">${buildings.map((building) => {
        const availability = getBuildingAvailability(town, resources, building);
        const creature = building.creatureId ? getCreature(building.creatureId) : null;
        return `<article class="h3-building-card is-${availability.status} ${this.focusedTownBuildingId === building.id ? 'is-focused' : ''}" data-building-card="${escapeHtml(building.id)}" tabindex="-1">
          <header><span class="h3-building-icon">${icon(creature ? 'recruit' : building.dailyIncome ? 'coins' : building.id === 'mageGuild' ? 'book' : 'castle')}</span><div><h3>${escapeHtml(building.name)}</h3><p>${escapeHtml(building.description)}</p></div><span class="h3-status-badge">${availability.status === 'built' ? 'Built' : availability.status === 'ready' ? 'Available' : availability.status === 'locked' ? 'Locked' : availability.status === 'wait' ? 'Tomorrow' : 'Resources needed'}</span></header>
          <div class="h3-building-benefits">${building.dailyIncome ? `<span>${icon('coins')} +${formatCost(building.dailyIncome)} / day</span>` : ''}${creature ? `<span>${icon('recruit')} +${creature.growth} ${escapeHtml(creature.name)} / week</span>` : ''}</div>
          <div class="h3-prerequisites"><small>Prerequisites</small>${building.prerequisites.length ? building.prerequisites.map((id) => {
            const met = town.buildings.includes(id);
            return `<span class="${met ? 'is-met' : ''}">${icon(met ? 'check' : 'lock')}${escapeHtml(getBuilding(id).name)}</span>`;
          }).join('') : '<span class="is-met">None</span>'}</div>
          <div class="h3-building-cost"><small>Cost</small><div>${this.costHtml(building.cost, resources)}</div></div>
          <p class="h3-availability">${icon(availability.status === 'ready' ? 'check' : availability.status === 'built' ? 'check' : 'info')}${escapeHtml(availability.reason)}</p>
          <button type="button" class="h3-button" data-action="construct-building" data-building-id="${escapeHtml(building.id)}" ${availability.status !== 'ready' ? 'disabled' : ''} aria-label="Construct ${escapeHtml(building.name)} for ${escapeHtml(formatCost(building.cost))}">${icon(availability.status === 'built' ? 'check' : 'construction')}${availability.status === 'built' ? 'Constructed' : 'Construct'}</button>
        </article>`;
      }).join('')}</div>
    </section>`;
  }

  private renderRecruitment(town: TownState, resources: ResourceBundle): string {
    const dwellings = town.buildings.map((id) => getBuilding(id)).filter((building) => building.creatureId);
    if (!dwellings.length) {
      return `<div class="h3-empty-state h3-large-empty">${icon('recruit')}<h2>No creature dwellings</h2><p>Build a military dwelling before recruiting creatures.</p><button type="button" class="h3-button" data-action="town-tab" data-town-tab="construction">${icon('construction')} View construction</button></div>`;
    }
    return `<section class="h3-recruitment"><header class="h3-section-heading"><div><p class="h3-eyebrow">Muster the realm</p><h2>Recruitment</h2><p>Recruits join the town garrison. Transfer them to a visiting hero in Army management.</p></div><span>${dwellings.length}/${ROSTER_COUNTS.tiers} dwellings · ${town.garrison.length}/${MAX_ARMY_STACKS} garrison stacks</span></header>
      <div class="h3-recruit-grid">${dwellings.map((building) => {
        const creature = getCreature(building.creatureId ?? '');
        const visual = getFactionVisual(creature.faction);
        const available = town.dwellingPools[creature.id] ?? 0;
        const limit = getRecruitLimit(town, resources, creature.id);
        const quantity = limit > 0 ? 1 : 0;
        return `<article class="h3-recruit-card ${this.focusedCreatureId === creature.id ? 'is-focused' : ''}" data-creature-card="${escapeHtml(creature.id)}" style="--h3-faction:${visual.primary}" tabindex="-1">
          <header><div class="h3-creature-frame">${creaturePortrait(creature.id)}<span>Tier ${creature.tier}</span></div><div><p class="h3-eyebrow">${factionIcon(creature.faction)} ${escapeHtml(creature.faction)} · ${escapeHtml(building.name)}</p><h3>${escapeHtml(creature.name)}</h3><p>${creature.abilities.length ? creature.abilities.map((ability) => escapeHtml(ability.replace(/([A-Z])/g, ' $1'))).join(' · ') : 'Steady frontline troops'}</p></div><div class="h3-recruit-available"><strong>${available}</strong><span>available</span><small>+${creature.growth} / week</small></div></header>
          <div class="h3-creature-stats"><span>Attack <strong>${creature.attack}</strong></span><span>Defense <strong>${creature.defense}</strong></span><span>Damage <strong>${creature.damage[0]}–${creature.damage[1]}</strong></span><span>Health <strong>${creature.health}</strong></span><span>Speed <strong>${creature.speed}</strong></span>${creature.shots ? `<span>Shots <strong>${creature.shots}</strong></span>` : ''}</div>
          <div class="h3-recruit-cost"><span>Each</span>${this.costHtml(creature.cost, resources)}</div>
          <div class="h3-quantity-row"><div class="h3-quantity-control"><button type="button" class="h3-icon-button" data-action="recruit-adjust" data-creature-id="${escapeHtml(creature.id)}" data-delta="-1" aria-label="Decrease ${escapeHtml(creature.name)} recruitment count">−</button><input type="number" min="${limit > 0 ? 1 : 0}" max="${limit}" value="${quantity}" step="1" inputmode="numeric" data-recruit-input data-creature-id="${escapeHtml(creature.id)}" data-max="${limit}" aria-label="Number of ${escapeHtml(creature.name)} to recruit"><button type="button" class="h3-icon-button" data-action="recruit-adjust" data-creature-id="${escapeHtml(creature.id)}" data-delta="1" aria-label="Increase ${escapeHtml(creature.name)} recruitment count">+</button></div><button type="button" class="h3-button is-secondary" data-action="recruit-max" data-creature-id="${escapeHtml(creature.id)}" ${limit <= 0 ? 'disabled' : ''}>Max ${limit}</button></div>
          <div class="h3-recruit-total" aria-live="polite"><span>Total</span><strong>${quantity ? formatCost(multiplyCost(creature.cost, quantity)) : 'Unavailable'}</strong></div>
          <button type="button" class="h3-button" data-action="recruit-creature" data-creature-id="${escapeHtml(creature.id)}" ${limit <= 0 ? 'disabled' : ''} aria-label="Recruit ${escapeHtml(creature.name)} into the garrison">${icon('recruit')} Recruit to garrison</button>
          ${available > 0 && limit === 0 ? `<p class="h3-availability is-warning">${icon('info')}${town.garrison.length >= MAX_ARMY_STACKS && !town.garrison.some((stack) => stack.creatureId === creature.id) ? 'No free garrison stack is available.' : 'Insufficient resources for one recruit.'}</p>` : ''}
        </article>`;
      }).join('')}</div>
    </section>`;
  }

  private getVisitingHero(town: TownState): Readonly<HeroState> | null {
    const hero = this.store.getSelectedHero();
    return hero && hero.alive && hero.ownerId === town.ownerId &&
      hero.position.x === town.position.x && hero.position.y === town.position.y ? hero : null;
  }

  private renderArmyRows(
    source: readonly { creatureId: string; count: number }[],
    target: readonly { creatureId: string; count: number }[],
    direction: 'toHero' | 'toGarrison',
    enabled: boolean,
  ): string {
    if (!source.length) return '<p class="h3-empty-state">No creatures stationed here.</p>';
    return source.map((stack) => {
      const creature = getCreature(stack.creatureId);
      const limit = getTransferLimit(source, target, stack.creatureId);
      const destination = direction === 'toHero' ? 'hero' : 'garrison';
      return `<article class="h3-transfer-row"><div class="h3-transfer-creature">${creaturePortrait(creature.id)}<div><strong>${escapeHtml(creature.name)}</strong><span>${formatNumber(stack.count)} troops</span></div></div>
        <div class="h3-transfer-controls"><input type="number" min="1" max="${Math.max(1, limit)}" value="1" step="1" inputmode="numeric" data-transfer-input data-creature-id="${escapeHtml(creature.id)}" data-direction="${direction}" aria-label="Number of ${escapeHtml(creature.name)} to transfer to ${destination}" ${!enabled || limit <= 0 ? 'disabled' : ''}>
        <button type="button" class="h3-button is-secondary" data-action="transfer-creatures" data-creature-id="${escapeHtml(creature.id)}" data-direction="${direction}" ${!enabled || limit <= 0 ? 'disabled' : ''} aria-label="Transfer ${escapeHtml(creature.name)} to ${destination}">${direction === 'toHero' ? icon('left') : icon('right')} Move</button>
        <button type="button" class="h3-button is-quiet" data-action="transfer-creatures" data-creature-id="${escapeHtml(creature.id)}" data-direction="${direction}" data-all="true" ${!enabled || limit <= 0 ? 'disabled' : ''} aria-label="Transfer all ${stack.count} ${escapeHtml(creature.name)} to ${destination}">All</button></div>
        ${enabled && limit === 0 ? '<small class="h3-transfer-warning">Destination has no free stack.</small>' : ''}
      </article>`;
    }).join('');
  }

  private renderArmyManagement(state: Readonly<GameState>, town: TownState): string {
    const hero = this.getVisitingHero(town);
    return `<section class="h3-army-management"><header class="h3-section-heading"><div><p class="h3-eyebrow">Organize your forces</p><h2>Hero & garrison</h2><p>Move individual stacks or entire creature groups. Each army holds up to ${MAX_ARMY_STACKS} different stacks.</p></div><span>${hero ? `${escapeHtml(hero.name)} is visiting` : 'No visiting hero'}</span></header>
      ${!hero ? `<p class="h3-town-tip">${icon('info')} Select a friendly hero standing on ${escapeHtml(town.name)} to enable transfers. The garrison remains visible below.</p>` : ''}
      <div class="h3-transfer-columns ${hero ? '' : 'is-readonly'}">
        <section class="h3-town-section"><header><div><p class="h3-eyebrow">Town defenders</p><h3>Garrison</h3></div><span>${formatNumber(armyCount(town.garrison))} troops</span></header><div class="h3-transfer-list">${this.renderArmyRows(town.garrison, hero?.army ?? [], 'toHero', Boolean(hero))}</div></section>
        <div class="h3-transfer-emblem" aria-hidden="true">${icon('army')}<span>⇄</span></div>
        <section class="h3-town-section"><header><div><p class="h3-eyebrow">Traveling company</p><h3>${hero ? escapeHtml(hero.name) : 'Visiting hero'}</h3></div><span>${hero ? `${formatNumber(armyCount(hero.army))} troops` : '—'}</span></header><div class="h3-transfer-list">${this.renderArmyRows(hero?.army ?? [], town.garrison, 'toGarrison', Boolean(hero))}</div></section>
      </div>
      <footer class="h3-army-summary"><span>${icon('shield')} Garrison stacks: ${town.garrison.length}/${MAX_ARMY_STACKS}</span><span>${icon('hero')} Hero stacks: ${hero?.army.length ?? 0}/${MAX_ARMY_STACKS}</span><span>Position: ${town.position.x + 1}, ${town.position.y + 1} · ${formatCalendarShort(state.calendar)}</span></footer>
    </section>`;
  }

  private renderSpellbook(town: TownState): string {
    if (!town.buildings.includes('mageGuild')) {
      return `<div class="h3-empty-state h3-large-empty" data-spellbook="locked">${icon('book')}<h2 data-spellbook-heading tabindex="-1">Mage Guild required</h2><p>Construct the Mage Guild to review the visiting hero’s spellbook.</p><button type="button" class="h3-button" data-action="town-focus-building" data-building-id="mageGuild">${icon('construction')} View Mage Guild construction</button></div>`;
    }
    const hero = this.getVisitingHero(town);
    const spells = hero?.spells.map((id) => getCombatSpell(id)) ?? [];
    const effects = { heal: 'Restore health', damage: 'Magical damage', haste: 'Increase speed', slow: 'Reduce speed', shield: 'Increase defense', bless: 'Improve damage' } as const;
    const targets: Record<string, string> = {
      self: 'Self', ally: 'One allied stack', enemy: 'One enemy stack', allEnemies: 'All enemy stacks',
      all: 'Every stack on both sides', allAllies: 'All allied stacks', caster: 'Casting hero', enemyHero: 'Enemy hero',
    };
    const effectText = (spell: (typeof spells)[number]): string => typeof spell.effect === 'string'
      ? `${effects[spell.effect]} · ${spell.power} power`
      : spell.description;
    return `<section class="h3-spellbook" data-spellbook="ready"><header class="h3-section-heading"><div><p class="h3-eyebrow">Mage Guild repository</p><h2 data-spellbook-heading tabindex="-1">Hero spellbook</h2><p>Review the spells known by the visiting hero. Casting remains part of tactical combat.</p></div><span>${hero ? `${escapeHtml(hero.name)} · ${hero.mana}/${hero.maxMana} mana` : 'No visiting hero'}</span></header>
      ${hero ? `<div class="h3-spellbook-hero"><div class="h3-portrait-frame">${heroPortrait(hero.definitionId, hero.name)}<span>LV ${hero.level}</span></div><div><h3>${escapeHtml(hero.name)}</h3><p>${spells.length} known spells · Spell power ${hero.primarySkills.spellPower} · Knowledge ${hero.primarySkills.knowledge}</p><div class="h3-meter is-mana" aria-label="${hero.mana} of ${hero.maxMana} mana"><i style="width:${Math.max(0, Math.min(100, hero.mana / hero.maxMana * 100))}%"></i></div></div></div>` : `<p class="h3-town-tip">${icon('info')} Bring a friendly hero to ${escapeHtml(town.name)} to open their spellbook.</p>`}
      ${hero && spells.length ? `<div class="h3-spell-grid">${spells.map((spell) => `<article class="h3-spell-card" data-spell-id="${escapeHtml(spell.id)}"><header><span>${icon('spark')}</span><div><h3>${escapeHtml(spell.name)}</h3><p>Level ${spell.level} · ${escapeHtml(spell.school)} magic</p></div><strong>${spell.manaCost} mana</strong></header><dl><div><dt>Effect</dt><dd>${escapeHtml(effectText(spell))}</dd></div><div><dt>Target</dt><dd>${escapeHtml(targets[spell.target] ?? spell.target)}</dd></div></dl></article>`).join('')}</div>` : hero ? '<p class="h3-empty-state">This hero has not learned any spells.</p>' : ''}
      <p class="h3-town-tip">${icon('info')} The spellbook reflects the hero’s current saved spell list and mana. It does not teach spells, spend mana, or bypass combat rules.</p>
    </section>`;
  }

  private readonly handleClick = (event: MouseEvent): void => {
    if (this.editorActive) return;
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest<HTMLButtonElement>('button[data-action]');
    if (!button || !this.root.contains(button) || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'game-menu') this.openGameMenu();
    else if (action === 'help') this.openHelp();
    else if (action === 'open-inventory') this.openInventory();
    else if (action === 'equip-artifact' && button.dataset.artifactId) this.changeEquipment('equip', button.dataset.artifactId);
    else if (action === 'unequip-artifact' && button.dataset.slot) this.changeEquipment('unequip', button.dataset.slot);
    else if (action === 'previous-hero') this.cycleHero(-1);
    else if (action === 'next-hero') this.cycleHero(1);
    else if (action === 'interact') this.interact();
    else if (action === 'enter-town') this.enterTown();
    else if (action === 'end-turn') this.endTurn();
    else if (action === 'minimap-expand') this.toggleMinimap();
    else if (action === 'town-navigate') {
      const town = button.dataset.townId ? this.store.getTown(button.dataset.townId) : undefined;
      if (town) this.navigateFromMinimap({ ...town.position });
    }
    else if (action === 'town-exit') this.exitTown();
    else if (action === 'town-tab') {
      const tab = button.dataset.townTab;
      if (tab === 'overview' || tab === 'construction' || tab === 'recruitment' || tab === 'army' || tab === 'spellbook') {
        this.townTab = tab;
        this.focusedTownBuildingId = null;
        this.focusedCreatureId = null;
        this.render();
        this.root.querySelector<HTMLButtonElement>(`[data-town-tab="${tab}"]`)?.focus({ preventScroll: true });
      }
    } else if (action === 'town-focus-building') {
      if (button.dataset.buildingId) this.focusConstructionCard(button.dataset.buildingId);
    } else if (action === 'construct-building') {
      const townId = this.activeTownId;
      const buildingId = button.dataset.buildingId;
      if (townId && buildingId) this.confirmConstruction(townId, buildingId);
    } else if (action === 'recruit-adjust' || action === 'recruit-max') {
      const card = button.closest<HTMLElement>('[data-creature-card]');
      const input = card?.querySelector<HTMLInputElement>('[data-recruit-input]');
      if (!input) return;
      const maximum = Math.max(0, Number(input.dataset.max) || 0);
      if (action === 'recruit-max') input.value = String(maximum);
      else {
        const delta = Number(button.dataset.delta) || 0;
        const current = Number(input.value) || 0;
        input.value = String(Math.max(maximum > 0 ? 1 : 0, Math.min(maximum, current + delta)));
      }
      this.updateRecruitTotal(input);
    } else if (action === 'recruit-creature') {
      this.recruitForTown(button);
    } else if (action === 'transfer-creatures') {
      this.transferCreatures(button);
    }
  };

  private readonly handleInput = (event: Event): void => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (input?.matches('[data-recruit-input]')) this.updateRecruitTotal(input);
  };

  private readonly handleChange = (event: Event): void => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input) return;
    if (input.matches('[data-recruit-input]')) {
      const maximum = Math.max(0, Number(input.max) || 0);
      const minimum = maximum > 0 ? 1 : 0;
      input.value = String(Math.max(minimum, Math.min(maximum, Math.floor(Number(input.value) || 0))));
      this.updateRecruitTotal(input);
    } else if (input.matches('[data-transfer-input]')) {
      const maximum = Math.max(1, Number(input.max) || 1);
      input.value = String(Math.max(1, Math.min(maximum, Math.floor(Number(input.value) || 1))));
    }
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disposed || this.battleActive || this.editorActive || event.defaultPrevented || this.dialogs.isOpen) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 's') {
      event.preventDefault();
      this.saveGame('autosave');
      return;
    }
    if ((event.ctrlKey || event.metaKey) && key === 'o') {
      event.preventDefault();
      this.openGameMenu();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      if (this.activeTownId) {
        event.preventDefault();
        this.exitTown();
      } else if (this.minimapExpanded) {
        event.preventDefault();
        this.toggleMinimap();
      }
    } else if (key === '?' || event.key === 'F1') {
      event.preventDefault();
      this.openHelp();
    } else if (key === 'h') {
      event.preventDefault();
      this.cycleHero(event.shiftKey ? -1 : 1);
    } else if (key === 't') {
      event.preventDefault();
      this.enterTown();
    } else if (key === 'n') {
      event.preventDefault();
      this.endTurn();
    } else if (key === 'm') {
      event.preventDefault();
      this.toggleMinimap();
    } else if (event.code === 'Space' && !(target instanceof HTMLButtonElement)) {
      event.preventDefault();
      this.interact();
    }
  };

  private readonly handleAdventureInteraction = (event: Event): void => {
    if (this.editorActive || this.handledInteractionEvents.has(event)) return;
    this.handledInteractionEvents.add(event);
    const detail = event instanceof CustomEvent ? event.detail as unknown : null;
    if (!detail || typeof detail !== 'object') return;
    const wrapped = 'interaction' in detail;
    const interaction = wrapped ? (detail as { interaction?: unknown }).interaction : detail;
    if (!interaction || typeof interaction !== 'object' || !('kind' in interaction)) return;
    const heroId = wrapped && 'heroId' in detail && typeof detail.heroId === 'string' ? detail.heroId : undefined;
    this.handleInteraction(interaction as InteractionResult, heroId);
  };

  private cycleHero(direction: -1 | 1): void {
    const hero = getHeroCycleTarget(this.store.getState(), direction);
    if (!hero) {
      this.notify('No hero available', 'There are no surviving heroes to select.', 'warning');
      return;
    }
    const result = this.store.selectHero(hero.id);
    if (!result.ok) this.notify('Cannot select hero', result.error, 'error');
    else this.notify('Hero selected', `${hero.name} awaits your command.`, 'info', 2500);
  }

  private navigateFromMinimap(point: Point): void {
    if (this.battleActive || this.activeTownId) return;
    const state = this.store.getState();
    const hero = Object.values(state.heroes).find((candidate) =>
      candidate.alive && candidate.ownerId === state.activePlayerId &&
      candidate.position.x === point.x && candidate.position.y === point.y);
    if (hero) {
      const result = this.store.selectHero(hero.id);
      if (!result.ok) this.notify('Cannot select hero', result.error, 'error');
      else this.notify('Hero selected', `${hero.name} · ${hero.position.x + 1}, ${hero.position.y + 1}`, 'info', 2500);
      return;
    }
    const result = this.store.moveSelectedHero(point);
    if (!result.ok) {
      this.notify('Destination unreachable', result.error, 'warning');
      return;
    }
    this.handleInteraction(result.value.interaction, result.value.heroId);
  }

  private interact(): void {
    if (this.battleActive) return;
    const result = this.store.interact();
    if (!result.ok) {
      this.notify('Cannot interact', result.error, 'warning');
      return;
    }
    this.handleInteraction(result.value);
  }

  private handleInteraction(interaction: InteractionResult, heroId?: string): void {
    if (interaction.kind === 'town') this.openTown(interaction.townId);
    else if (interaction.kind === 'dwelling') this.openDwelling(interaction.dwellingId, heroId);
    else if (interaction.kind === 'resource') {
      this.notify('Treasure claimed', `${interaction.message} ${formatCost(interaction.resources)}`, 'success');
    } else if (interaction.kind === 'artifact') {
      const artifact = getArtifact(interaction.artifactId);
      this.notify('Artifact found', interaction.message, 'success');
      if (artifact) this.notify('Equipment ready', `${artifact.name} is in the hero’s backpack. Open Equipment to equip it.`, 'info', 5000);
    } else if (interaction.kind === 'mine') {
      this.notify('Mine claimed', interaction.message, 'success');
    } else if (interaction.kind === 'landmark') {
      const title = interaction.effect === 'portal' ? 'Portal traversed'
        : interaction.effect === 'trade' ? 'Merchant trade'
          : interaction.effect === 'spell' ? 'Spell learned'
            : interaction.effect === 'experience' ? 'Hero inspired'
              : interaction.effect === 'reveal' ? 'Realm revealed'
                : interaction.effect === 'movement' || interaction.effect === 'mana' ? 'Hero restored' : 'Landmark visited';
      const unavailable = /already|occupied|requires/.test(interaction.message);
      this.notify(title, interaction.message, unavailable ? 'info' : 'success');
    } else if (interaction.kind === 'none') {
      this.notify('Nothing here', interaction.message, 'info', 3000);
    }
  }

  private enterTown(): void {
    const state = this.store.getState();
    const hero = this.store.getSelectedHero();
    const object = hero ? getObjectAt(state.map, hero.position) : undefined;
    if (!hero || object?.kind !== 'town' || state.towns[object.townId]?.ownerId !== state.activePlayerId) {
      this.notify('Town is out of reach', 'Move a friendly hero onto one of your towns before entering.', 'warning');
      return;
    }
    this.interact();
  }

  private openTown(townId: string): void {
    const town = this.store.getTown(townId);
    if (!town || town.ownerId !== this.store.getState().activePlayerId || this.battleActive) return;
    this.activeTownId = townId;
    this.townTab = 'overview';
    this.focusedTownBuildingId = null;
    this.focusedCreatureId = null;
    this.minimapExpanded = false;
    this.render();
    this.root.querySelector<HTMLButtonElement>('[data-action="town-exit"]')?.focus({ preventScroll: true });
  }

  private readonly handleTownBuildingInteraction = (interaction: TownBuildingInteraction): void => {
    const town = this.store.getTown(interaction.townId);
    if (this.disposed || this.battleActive || !town || this.activeTownId !== town.id) return;
    const destination = getTownBuildingDestination({
      ...interaction,
      built: town.buildings.includes(interaction.buildingId),
    });
    this.townTab = destination.tab;
    this.focusedTownBuildingId = destination.buildingId ?? null;
    this.focusedCreatureId = destination.creatureId ?? null;
    this.render();
    if (destination.tab === 'construction') this.focusTownElement(`[data-building-card="${interaction.buildingId}"]`);
    else if (destination.tab === 'recruitment' && destination.creatureId) this.focusTownElement(`[data-creature-card="${destination.creatureId}"]`);
    else if (destination.tab === 'overview') this.focusTownElement(`[data-overview-building="${interaction.buildingId}"]`);
    else if (destination.tab === 'army') this.focusTownElement('.h3-army-management h2');
    else if (destination.tab === 'spellbook') this.focusTownElement('[data-spellbook-heading]');
  };

  private focusConstructionCard(buildingId: string): void {
    if (!this.activeTownId) return;
    getBuilding(buildingId);
    this.townTab = 'construction';
    this.focusedTownBuildingId = buildingId;
    this.focusedCreatureId = null;
    this.render();
    this.focusTownElement(`[data-building-card="${buildingId}"]`);
  }

  private focusTownElement(selector: string): void {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (!element) return;
    element.tabIndex = -1;
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  private exitTown(): void {
    if (!this.activeTownId) return;
    this.activeTownId = null;
    this.render();
    this.root.querySelector<HTMLButtonElement>('[data-action="enter-town"]')?.focus({ preventScroll: true });
  }

  private toggleMinimap(): void {
    if (this.battleActive || this.activeTownId) return;
    this.minimapExpanded = !this.minimapExpanded;
    this.render();
    const button = this.root.querySelector<HTMLButtonElement>('[data-action="minimap-expand"]');
    if (button) button.title = this.minimapExpanded ? 'Collapse map and town atlas (M)' : 'Expand map and town atlas (M)';
  }

  private endTurn(): void {
    if (this.battleActive) return;
    const result = this.store.endTurn();
    if (!result.ok) {
      this.notify('Cannot end turn', result.error, 'warning');
      return;
    }
    this.notify('A new day dawns', `${formatCalendar(result.value.calendar)}. Movement, mana, and town income have been restored.`, 'success');
  }

  private recruitForTown(button: HTMLButtonElement): void {
    const townId = this.activeTownId;
    const creatureId = button.dataset.creatureId;
    const input = button.closest<HTMLElement>('[data-creature-card]')?.querySelector<HTMLInputElement>('[data-recruit-input]');
    if (!townId || !creatureId || !input) return;
    const count = Math.floor(Number(input.value));
    if (!Number.isFinite(count) || count <= 0) {
      this.notify('Choose a recruitment count', 'Enter a positive whole number of creatures.', 'warning');
      input.focus();
      return;
    }
    const result = this.store.recruitCreature(townId, creatureId, count);
    if (!result.ok) {
      this.notify('Recruitment failed', result.error, 'error');
      return;
    }
    this.notify('Reinforcements ready', `${count} ${getCreature(creatureId).name} joined the ${result.value.name} garrison.`, 'success');
  }

  private updateRecruitTotal(input: HTMLInputElement): void {
    const creatureId = input.dataset.creatureId;
    const card = input.closest<HTMLElement>('[data-creature-card]');
    if (!creatureId || !card) return;
    const count = Math.max(0, Math.floor(Number(input.value) || 0));
    const maximum = Math.max(0, Number(input.dataset.max) || 0);
    const total = card.querySelector<HTMLElement>('.h3-recruit-total strong');
    if (total) total.textContent = count > 0 ? formatCost(multiplyCost(getCreature(creatureId).cost, count)) : 'Unavailable';
    const button = card.querySelector<HTMLButtonElement>('[data-action="recruit-creature"]');
    if (button) button.disabled = count <= 0 || count > maximum || maximum <= 0;
  }

  private transferCreatures(button: HTMLButtonElement): void {
    const townId = this.activeTownId;
    const hero = this.store.getSelectedHero();
    const creatureId = button.dataset.creatureId;
    const direction = button.dataset.direction;
    if (!townId || !hero || !creatureId || (direction !== 'toHero' && direction !== 'toGarrison')) return;
    const input = button.closest<HTMLElement>('.h3-transfer-row')?.querySelector<HTMLInputElement>('[data-transfer-input]');
    const source = direction === 'toHero' ? this.store.getTown(townId)?.garrison ?? [] : hero.army;
    const target = direction === 'toHero' ? hero.army : this.store.getTown(townId)?.garrison ?? [];
    const count = button.dataset.all === 'true' ? getTransferLimit(source, target, creatureId) : Math.floor(Number(input?.value));
    if (!Number.isFinite(count) || count <= 0) {
      this.notify('Choose a transfer count', 'Enter a positive whole number of creatures.', 'warning');
      input?.focus();
      return;
    }
    const result = this.store.transferCreatures(hero.id, townId, creatureId, count, direction);
    if (!result.ok) this.notify('Transfer failed', result.error, 'error');
    else this.notify('Army reorganized', `${count} ${getCreature(creatureId).name} transferred to the ${direction === 'toHero' ? 'hero' : 'garrison'}.`, 'success', 3000);
  }

  private saveGame(slot: string): void {
    const write = (): void => {
      const result = this.store.saveGame(slot);
      if (!result.ok) this.notify('Save failed', result.error, 'error', 7000);
      else this.notify('Campaign saved', `Your progress is safe in ${slot.replace('-', ' ')}.`, 'success');
    };
    if (this.store.hasSavedGame(slot)) {
      this.showConfirmation('Overwrite saved campaign?', `The existing ${slot.replace('-', ' ')} will be replaced by your current progress.`, 'Overwrite save', write, false);
    } else write();
  }

  private loadGame(slot: string): void {
    this.showConfirmation('Load saved campaign?', 'Your current unsaved progress will be replaced by this saved campaign.', 'Load campaign', () => {
      const result = this.store.loadGame(slot);
      if (!result.ok) {
        this.notify('Load failed', result.error, 'error', 7000);
        return;
      }
      this.activeTownId = null;
      this.townTab = 'overview';
      this.notify('Campaign restored', `Welcome back to ${formatCalendar(result.value.calendar)}.`, 'success');
    }, true);
  }

  private newGame(seed: string): void {
    this.showConfirmation('Begin a new campaign?', 'Your current unsaved progress will be lost. Saved campaigns will remain available.', 'Begin new campaign', () => {
      const result = this.store.newGame(seed.trim() || 'h3core-default');
      if (!result.ok) {
        this.notify('New campaign failed', result.error, 'error');
        return;
      }
      this.activeTownId = null;
      this.townTab = 'overview';
      this.minimapExpanded = false;
      this.notify('A new realm awaits', 'The race for Aster Vale begins again.', 'success');
    }, true);
  }

  private confirmConstruction(townId: string, buildingId: string): void {
    const town = this.store.getTown(townId);
    const player = this.store.getState().players[this.store.getState().activePlayerId];
    if (!town || !player || this.activeTownId !== townId) return;
    const building = getBuilding(buildingId);
    const availability = getBuildingAvailability(town, player.resources, building);
    if (availability.status !== 'ready') {
      this.notify('Construction unavailable', availability.reason, 'warning');
      return;
    }
    const prerequisites = building.prerequisites.length
      ? building.prerequisites.map((id) => getBuilding(id).name).join(', ')
      : 'None';
    this.dialogs.show({
      title: `Construct ${building.name}?`,
      eyebrow: `${town.name} · One project per day`,
      body: `<p>${escapeHtml(building.description)}</p><div class="h3-construction-confirmation"><span>Cost</span><div>${this.costHtml(building.cost, player.resources)}</div><span>Prerequisites</span><strong>${escapeHtml(prerequisites)}</strong></div><p>Construction is permanent and uses this town’s project for today. The game will check costs and prerequisites again before building.</p>`,
      actions: [
        { label: 'Cancel', className: 'is-secondary' },
        { label: 'Construct building', icon: 'check', autofocus: true, onSelect: () => {
          if (this.activeTownId !== townId) return;
          const result = this.store.constructBuilding(townId, buildingId);
          if (!result.ok) this.notify('Construction unavailable', result.error, 'error');
          else this.notify('Construction complete', `${building.name} now stands in ${result.value.name}.`, 'success');
        } },
      ],
    });
  }

  private showConfirmation(
    title: string,
    message: string,
    confirmLabel: string,
    onConfirm: () => void,
    destructive: boolean,
  ): void {
    this.dialogs.show({
      title,
      eyebrow: destructive ? 'Please confirm' : 'Campaign storage',
      body: `<p>${escapeHtml(message)}</p>`,
      actions: [
        { label: 'Cancel', className: 'is-secondary' },
        { label: confirmLabel, className: destructive ? 'is-danger' : '', onSelect: onConfirm, autofocus: true },
      ],
    });
  }

  private openGameMenu(): void {
    const state = this.store.getState();
    const body = document.createElement('div');
    body.className = 'h3-save-menu';
    body.innerHTML = `<p>Save your campaign locally in this browser, restore an earlier journey, or generate a fresh realm.</p>
      <div class="h3-save-slots">${SAVE_SLOTS.map((slot) => {
        const saved = this.store.hasSavedGame(slot);
        return `<article><div>${icon('save')}<span><strong>${slot === 'autosave' ? 'Autosave' : `Campaign ${slot.at(-1)}`}</strong><small>${saved ? 'Saved campaign available' : 'Empty slot'}</small></span></div><div><button type="button" class="h3-button is-secondary" data-save="${slot}">${icon('save')} Save</button><button type="button" class="h3-button is-secondary" data-load="${slot}" ${saved ? '' : 'disabled'}>${icon('book')} Load</button></div></article>`;
      }).join('')}</div>
      <div class="h3-new-campaign"><label for="h3-seed-input">New campaign seed</label><div><input id="h3-seed-input" type="text" maxlength="80" value="${escapeHtml(state.seed)}" autocomplete="off"><button type="button" class="h3-button is-danger" data-new-game>${icon('spark')} New campaign</button></div><small>The same seed recreates the same deterministic map and simulation.</small></div>`;
    body.querySelectorAll<HTMLButtonElement>('[data-save]').forEach((button) => button.addEventListener('click', () => {
      const slot = button.dataset.save;
      if (!slot) return;
      this.dialogs.close();
      this.saveGame(slot);
    }));
    body.querySelectorAll<HTMLButtonElement>('[data-load]').forEach((button) => button.addEventListener('click', () => {
      const slot = button.dataset.load;
      if (!slot) return;
      this.dialogs.close();
      this.loadGame(slot);
    }));
    body.querySelector('[data-new-game]')?.addEventListener('click', () => {
      const seed = body.querySelector<HTMLInputElement>('#h3-seed-input')?.value ?? state.seed;
      this.dialogs.close();
      this.newGame(seed);
    });
    this.dialogs.show({
      title: 'Campaign journal',
      eyebrow: `${formatCalendarShort(state.calendar)} · ${state.players[state.activePlayerId]?.name ?? 'Adventure'}`,
      body,
      className: 'h3-wide-dialog',
      actions: [{ label: 'Return to adventure', className: 'is-secondary' }],
    });
  }

  private openInventory(): void {
    const hero = this.store.getSelectedHero();
    if (!hero || this.battleActive) return;
    const bonuses = aggregateArtifactBonuses(hero.artifacts);
    const equipped = ARTIFACT_SLOTS.map((slot) => {
      const id = hero.artifacts.equipped[slot];
      const artifact = id ? getArtifact(id) : undefined;
      return `<article class="h3-equipment-slot" data-slot="${slot}"><header><strong>${slot}</strong><span>${artifact ? escapeHtml(artifact.rarity) : 'Empty'}</span></header>
        ${artifact ? `<h3>${escapeHtml(artifact.name)}</h3><p>${escapeHtml(artifact.description)}</p><small>${Object.entries(artifact.bonuses).map(([stat, amount]) => `+${amount} ${stat}`).join(' · ')}</small>
          <button type="button" class="h3-button is-secondary" data-action="unequip-artifact" data-slot="${slot}">Unequip</button>` : '<p>No artifact equipped in this slot.</p>'}
      </article>`;
    }).join('');
    const items = Object.entries(hero.artifacts.items).map(([id, count]) => ({ artifact: getArtifact(id), id, count }))
      .filter((entry): entry is { artifact: NonNullable<ReturnType<typeof getArtifact>>; id: string; count: number } => Boolean(entry.artifact))
      .sort((a, b) => a.artifact.name.localeCompare(b.artifact.name));
    const backpack = items.length > 0 ? items.map(({ artifact, id, count }) => {
      const equippedId = hero.artifacts.equipped[artifact.slot];
      return `<article class="h3-artifact-card" data-artifact-id="${escapeHtml(id)}"><header><div><h3>${escapeHtml(artifact.name)}</h3><p>${artifact.rarity} · ${artifact.slot}</p></div><strong>×${count}</strong></header>
        <p>${escapeHtml(artifact.description)}</p><small>${Object.entries(artifact.bonuses).map(([stat, amount]) => `+${amount} ${stat}`).join(' · ')}</small>
        <button type="button" class="h3-button" data-action="equip-artifact" data-artifact-id="${escapeHtml(id)}" ${equippedId === id ? 'disabled' : ''}>${equippedId === id ? 'Equipped' : equippedId ? `Replace ${escapeHtml(getArtifact(equippedId)?.name ?? equippedId)}` : 'Equip'}</button>
      </article>`;
    }).join('') : '<p class="h3-empty-state">The backpack is empty. Explore the realm to collect artifacts.</p>';
    this.dialogs.show({
      title: `${hero.name} · Equipment`,
      eyebrow: 'Artifacts apply only while equipped',
      className: 'h3-wide-dialog h3-inventory-dialog',
      body: `<div class="h3-equipment-summary"><strong>Equipped bonuses</strong><span>Attack +${bonuses.attack}</span><span>Defense +${bonuses.defense}</span><span>Spell power +${bonuses.spellPower}</span><span>Knowledge +${bonuses.knowledge}</span></div>
        <section><h3>Equipped slots</h3><div class="h3-equipment-grid">${equipped}</div></section>
        <section><h3>Backpack</h3><div class="h3-artifact-grid">${backpack}</div></section>`,
      actions: [{ label: 'Return to adventure', className: 'is-secondary' }],
    });
  }

  private changeEquipment(action: 'equip' | 'unequip', id: string): void {
    const hero = this.store.getSelectedHero();
    if (!hero) return;
    const result = action === 'equip' ? this.store.equipArtifact(hero.id, id) : this.store.unequipArtifact(hero.id, id);
    if (!result.ok) {
      this.notify('Equipment unavailable', result.error, 'warning');
      return;
    }
    this.notify(action === 'equip' ? 'Artifact equipped' : 'Artifact unequipped', `${hero.name}'s effective stats and mana capacity were updated.`, 'success', 3000);
    this.dialogs.close();
    this.openInventory();
  }

  private openHelp(): void {
    this.dialogs.show({
      title: 'Field guide to Aster Vale',
      eyebrow: 'Adventure, camera & combat',
      className: 'h3-help-dialog',
      body: `<div class="h3-help-grid">
        <section><h3>${icon('movement')} Movement & selection</h3><p>Left-click an owned hero to select them. Left-click a highlighted reachable tile or object to travel; the store checks the path and spends movement points. Click the object beneath your hero to interact again.</p><p>The strategic map also supports click travel. Focus it and use <kbd>Arrow keys</kbd> to choose a tile, then <kbd>Enter</kbd> to travel.</p></section>
        <section><h3>${icon('compass')} Adventure camera</h3><p><strong>Left-drag</strong> or <strong>middle-drag</strong> to pan. <strong>Right-drag</strong> rotates and adjusts pitch. Use the <strong>mouse wheel</strong> or <strong>Ctrl + wheel</strong> to zoom; <strong>Shift + wheel</strong> pans.</p><p><kbd>Arrow keys</kbd> pan, <kbd>Q</kbd>/<kbd>E</kbd> rotate, <kbd>+</kbd>/<kbd>−</kbd> zoom, and <kbd>F</kbd> focuses the selected hero.</p></section>
        <section><h3>${icon('castle')} Towns & armies</h3><p>Every faction’s buildings appear in its interactive 3D town. Click a built dwelling for its recruitment card, the Fort for army transfers, the Mage Guild for the visiting hero’s spellbook, or a civic building for economy details.</p><p>Click an unbuilt model to focus its construction card. Costs, prerequisites, the one-project-per-day limit, and confirmation still apply. Creature growth arrives weekly; income arrives daily.</p></section>
        <section><h3>${icon('construction')} Town model & keyboard</h3><p>Drag to pan, right-drag to rotate, and use the wheel or camera buttons to zoom. The Town buildings list provides a button for every model, including touch and keyboard access.</p><p>On the town canvas, <kbd>Arrow keys</kbd> pan, <kbd>Q</kbd>/<kbd>E</kbd> rotate, <kbd>[</kbd>/<kbd>]</kbd> select buildings, and <kbd>Enter</kbd> activates the selection. Use the town tabs for the same functions without clicking a model.</p></section>
        <section><h3>${icon('endTurn')} Turns & battle</h3><p>End the turn to restore hero movement and mana, collect town and mine income, and allow opposing players to act. Monday brings new creature growth.</p><p>Moving onto hostile forces creates a battle handoff. The tactical battlefield takes control; adventure commands resume only after its result is applied to the campaign.</p></section>
        <section><h3>${icon('spark')} Hero magic</h3><p>Heroes can know up to 19 spells across four schools. Cast once per round during your own army’s turn, with valid targets and enough mana. Mass and hero-targeted spells resolve immediately; ally and enemy spells use highlighted targets.</p><p>Spell Power strengthens expanded effects. Mana spent in tactical combat is returned with the result and preserved in saves.</p></section>
        <section><h3>${icon('shield')} Resources & equipment</h3><p>The realm tracks gold, six classic materials, mithril, obsidian, and essence. Collect caches and claim mines for daily income; advanced construction spends all ten types.</p><p>Twenty artifact pickups wait on the map. Open Equipment in the hero panel to equip or unequip five slots. Only equipped artifacts add Attack, Defense, Spell Power, and Knowledge.</p></section>
        <section><h3>${icon('construction')} Content editor</h3><p>Open Content editor from onboarding or the lower-right adventure button. Create and validate custom creatures and artifacts, import or export versioned JSON, and keep the registry in local browser storage.</p><p>Choose a custom creature and optional artifact to start a real sandbox battle. Sandbox results never change campaign armies, resources, pending battles, or saves.</p></section>
        <section><h3>${icon('map')} Realm roster</h3><p>${ROSTER_COUNTS.factions} factions field ${ROSTER_COUNTS.factions * ROSTER_COUNTS.tiers} recruitable units, alongside ${ROSTER_COUNTS.units - ROSTER_COUNTS.factions * ROSTER_COUNTS.tiers} neutral creatures. Every town has its own construction chain and recruitment pool.</p><p>Expand the strategic map to open the town atlas. It lists every town in the current campaign, including older two- and four-town saves, with faction colors and ownership.</p></section>
      </div>
      <section class="h3-shortcuts"><h3>Interface shortcuts</h3><div><span><kbd>H</kbd> Next hero</span><span><kbd>Shift + H</kbd> Previous hero</span><span><kbd>Space</kbd> Interact</span><span><kbd>T</kbd> Enter town</span><span><kbd>N</kbd> End turn</span><span><kbd>M</kbd> Expand map</span><span><kbd>Ctrl / ⌘ + S</kbd> Save</span><span><kbd>Ctrl / ⌘ + O</kbd> Campaign menu</span><span><kbd>?</kbd> Field guide</span><span><kbd>Esc</kbd> Leave town / close dialog</span></div></section>`,
      actions: [{ label: 'Ready for adventure', icon: 'check', autofocus: true }],
    });
  }

  private openDwelling(dwellingId: string, heroId = this.store.getState().selectedHeroId ?? ''): void {
    const state = this.store.getState();
    const dwelling = state.map.objects[dwellingId];
    const hero = this.store.getHero(heroId);
    if (!dwelling || dwelling.kind !== 'dwelling' || !hero) {
      this.notify('Recruitment unavailable', 'The selected dwelling or hero is no longer available.', 'warning');
      return;
    }
    const creature = getCreature(dwelling.creatureId);
    const body = document.createElement('div');
    body.className = 'h3-dwelling-dialog';
    body.innerHTML = `<div class="h3-dwelling-creature">${creaturePortrait(creature.id)}<div><h3>${escapeHtml(creature.name)}</h3><p>${escapeHtml(dwelling.name)} has <strong>${dwelling.available}</strong> recruits available.</p><small>+${creature.growth} growth each week · ${formatCost(creature.cost)} each</small></div></div>
      <label for="h3-dwelling-count">Number to recruit</label><div class="h3-dwelling-count"><input id="h3-dwelling-count" type="number" min="1" max="${dwelling.available}" value="${Math.min(1, dwelling.available)}" step="1" inputmode="numeric"><button type="button" class="h3-button is-secondary" data-dwelling-max>Maximum</button></div><p class="h3-dwelling-total">Total: <strong>${dwelling.available > 0 ? formatCost(creature.cost) : 'Unavailable'}</strong></p>`;
    const input = body.querySelector<HTMLInputElement>('#h3-dwelling-count');
    const updateTotal = (): void => {
      const count = Math.max(0, Math.floor(Number(input?.value) || 0));
      const total = body.querySelector<HTMLElement>('.h3-dwelling-total strong');
      if (total) total.textContent = count ? formatCost(multiplyCost(creature.cost, count)) : 'Unavailable';
    };
    input?.addEventListener('input', updateTotal);
    body.querySelector('[data-dwelling-max]')?.addEventListener('click', () => {
      if (input) input.value = String(dwelling.available);
      updateTotal();
    });
    this.dialogs.show({
      title: `Recruit at ${dwelling.name}`,
      eyebrow: `${hero.name} · Adventure dwelling`,
      body,
      actions: [
        { label: 'Not now', className: 'is-secondary' },
        { label: 'Recruit for hero', icon: 'check', close: false, autofocus: true, onSelect: () => {
          const count = Math.floor(Number(input?.value));
          const result = this.store.recruitFromDwelling(hero.id, dwelling.id, count);
          if (!result.ok) {
            this.notify('Recruitment failed', result.error, 'error');
            return;
          }
          this.dialogs.close();
          this.notify('Reinforcements recruited', `${count} ${creature.name} joined ${hero.name}.`, 'success');
        } },
      ],
    });
  }

  private notifyGameEvent(event: GameEvent): void {
    if (event.kind === 'week') this.notify('Creature growth', event.message, 'info');
    else if (event.kind === 'conquest') this.notify('Town captured', event.message, 'success');
    else if (event.kind === 'battle' && event.message.includes('ends')) this.notify('Battle concluded', event.message, 'info');
  }

  private showLevelUp(hero: HeroState, previous: HeroSnapshot): void {
    if (hero.ownerId !== this.store.getState().activePlayerId) return;
    const labels: Record<keyof PrimarySkills, string> = { attack: 'Attack', defense: 'Defense', spellPower: 'Spell Power', knowledge: 'Knowledge' };
    const gains = (Object.keys(labels) as Array<keyof PrimarySkills>)
      .filter((skill) => hero.primarySkills[skill] > previous.skills[skill])
      .map((skill) => `<span>${icon('spark')} ${labels[skill]} +${hero.primarySkills[skill] - previous.skills[skill]}</span>`).join('');
    this.dialogs.show({
      title: `${hero.name} reached level ${hero.level}`,
      eyebrow: 'A hero grows in renown',
      className: 'h3-level-dialog',
      body: `<div class="h3-level-emblem">${icon('star')}<strong>${hero.level}</strong></div><p>Experience has strengthened ${escapeHtml(hero.name)}. New skills apply immediately to adventure and combat.</p><div class="h3-level-gains">${gains || '<span>Hero attributes increased.</span>'}<span>${icon('movement')} Maximum movement +${25 * (hero.level - previous.level)}</span></div>`,
      actions: [{ label: 'Continue the journey', icon: 'check', autofocus: true }],
    });
  }

  private showBattleHandoff(state: Readonly<GameState>): void {
    const battle = state.pendingBattle;
    if (!battle) return;
    const encounter = state.map.objects[battle.source.objectId];
    const rewards = battle.rewards.experience > 0 || hasResourceCost(battle.rewards.resources)
      ? `${formatNumber(battle.rewards.experience)} XP${hasResourceCost(battle.rewards.resources) ? ` · ${formatCost(battle.rewards.resources)}` : ''}`
      : 'Honor and survival';
    this.dialogs.show({
      title: encounter?.name ?? 'Hostile forces engaged',
      eyebrow: battle.source.kind === 'town' ? 'Siege battle' : 'Combat handoff',
      className: 'h3-battle-dialog',
      body: `<div class="h3-battle-versus"><div>${icon('hero')}<strong>${formatNumber(armyCount(battle.attacker.army))}</strong><span>Your troops</span></div><span>${icon('sword')}</span><div>${icon('skull')}<strong>${formatNumber(armyCount(battle.defender.army))}</strong><span>Defenders</span></div></div><p>The tactical battlefield will now take command. Adventure movement, construction, and turns are paused until the battle result returns to the campaign.</p><p class="h3-battle-rewards">${icon('star')} Potential rewards: <strong>${escapeHtml(rewards)}</strong></p>`,
      actions: [{ label: 'Prepare for battle', icon: 'check', autofocus: true }],
    });
  }

  private showOutcome(state: Readonly<GameState>): void {
    const victory = state.phase === 'victory';
    this.activeTownId = null;
    this.dialogs.show({
      title: victory ? 'Aster Vale is united!' : 'The realm has fallen',
      eyebrow: victory ? 'Campaign victory' : 'Campaign defeat',
      className: victory ? 'h3-victory-dialog' : 'h3-defeat-dialog',
      dismissible: false,
      body: `<div class="h3-outcome-emblem">${icon(victory ? 'star' : 'skull')}</div><p>${victory ? 'Your banners fly over every stronghold. The realm will remember this triumph.' : 'No friendly heroes or towns remain to carry your banner. Restore a saved campaign or begin another journey.'}</p><p>Final calendar: <strong>${formatCalendar(state.calendar)}</strong></p>`,
      actions: [
        { label: 'Load campaign', className: 'is-secondary', onSelect: () => this.openGameMenu() },
        { label: 'Begin new campaign', icon: 'spark', onSelect: () => this.newGame(state.seed), autofocus: true },
      ],
    });
  }

  private notify(title: string, message: string, tone: ToastTone = 'info', duration = 4500): void {
    if (this.disposed) return;
    const region = this.query<HTMLElement>('.h3-toasts');
    while (region.childElementCount >= 4) region.firstElementChild?.remove();
    const toast = document.createElement('article');
    toast.className = `h3-toast is-${tone}`;
    toast.setAttribute('role', tone === 'error' ? 'alert' : 'status');
    toast.innerHTML = `<span class="h3-toast-icon">${icon(tone === 'success' ? 'check' : tone === 'error' ? 'close' : tone === 'warning' ? 'info' : 'spark')}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div><button type="button" class="h3-icon-button" aria-label="Dismiss notification">${icon('close')}</button>`;
    region.appendChild(toast);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const remove = (): void => {
      if (timer) {
        clearTimeout(timer);
        this.toastTimers.delete(timer);
      }
      toast.classList.add('is-leaving');
      const removalTimer = setTimeout(() => {
        toast.remove();
        this.toastTimers.delete(removalTimer);
      }, 180);
      this.toastTimers.add(removalTimer);
    };
    toast.querySelector('button')?.addEventListener('click', remove);
    timer = setTimeout(remove, duration);
    this.toastTimers.add(timer);
  }

  setEditorActive(active: boolean): void {
    if (this.disposed) return;
    this.editorActive = active;
    if (active) {
      this.minimapExpanded = false;
      this.dialogs.clear();
    }
    this.render();
  }

  setBattleActive(active: boolean): void {
    if (this.disposed) return;
    this.battleActive = active;
    if (active) {
      this.activeTownId = null;
      this.minimapExpanded = false;
      this.dialogs.clear();
    }
    this.render();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.destroyTownScreen();
    this.unsubscribe();
    this.minimap.dispose();
    this.dialogs.dispose();
    for (const timer of this.toastTimers) clearTimeout(timer);
    this.toastTimers.clear();
    this.root.removeEventListener('click', this.handleClick);
    this.root.removeEventListener('input', this.handleInput);
    this.root.removeEventListener('change', this.handleChange);
    document.removeEventListener('keydown', this.handleKeyDown);
    this.container.removeEventListener('adventure-interaction', this.handleAdventureInteraction);
    document.removeEventListener('adventure-interaction', this.handleAdventureInteraction);
    this.root.remove();
  }
}

export default GameUI;
