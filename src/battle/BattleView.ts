import type * as THREE from 'three';
import { getCreature, HEROES } from '../game/content';
import { getCombatSpell } from '../game/spellbook';
import type { CombatSpellDefinition } from '../game/spellbook';
import type { BattleResult, BattleSetup } from '../game/types';
import { performAiTurn } from './BattleAI';
import { BattleEngine } from './BattleEngine';
import { BattleScene } from './BattleScene';
import { hexKey } from './hex';
import './styles.css';
import type {
  BattleActionResult,
  BattleEvent,
  BattleSideId,
  BattleStackState,
  HexCoord,
  ReachableHex,
} from './types';

interface HoverPayload {
  stackId: string | null;
  hex: HexCoord | null;
  clientX: number;
  clientY: number;
}

export interface BattleViewOptions {
  createCustomCreatureModel?: (creatureId: string, side: BattleSideId) => THREE.Group | undefined;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

function sideName(side: BattleSideId): string {
  return side === 'attacker' ? 'Attacker' : 'Defender';
}

export class BattleView {
  private readonly container: HTMLElement;
  private readonly onComplete: (result: BattleResult) => void;
  private readonly engine: BattleEngine;
  private readonly scene: BattleScene;
  private readonly root: HTMLDivElement;
  private readonly listeners = new AbortController();
  private readonly resizeObserver: ResizeObserver | null;
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  private busy = false;
  private auto = false;
  private disposed = false;
  private spellbookOpen = false;
  private selectedSpell: string | null = null;
  private error: string | null = null;
  private resultDelivered = false;
  private currentReachable: ReachableHex[] = [];

  constructor(
    container: HTMLElement,
    setup: BattleSetup,
    onComplete: (result: BattleResult) => void,
    options: BattleViewOptions = {},
  ) {
    this.container = container;
    this.onComplete = onComplete;
    this.engine = new BattleEngine(setup);
    this.root = document.createElement('div');
    this.root.className = 'h3b-root';
    this.root.tabIndex = 0;
    this.root.innerHTML = `
      <div class="h3b-scene"></div>
      <div class="h3b-hud">
        <div class="h3b-topbar h3b-panel">
          <span class="h3b-title">Tactical battle</span>
          <strong class="h3b-round"></strong>
          <div class="h3b-camera" aria-label="Camera controls">
            <button class="h3b-icon-button" data-action="rotate-left" type="button" title="Rotate camera left">↶</button>
            <button class="h3b-icon-button" data-action="camera-reset" type="button" title="Reset camera (R)">⌂</button>
            <button class="h3b-icon-button" data-action="rotate-right" type="button" title="Rotate camera right">↷</button>
            <button class="h3b-icon-button" data-action="zoom-out" type="button" title="Zoom out">−</button>
            <button class="h3b-icon-button" data-action="zoom-in" type="button" title="Zoom in">+</button>
          </div>
        </div>
        <div class="h3b-initiative h3b-panel" aria-label="Initiative order"></div>
        <div class="h3b-heroes"></div>
        <aside class="h3b-log h3b-panel" aria-label="Combat log">
          <div class="h3b-log-title">Combat log</div>
          <ol class="h3b-log-list" aria-live="polite"></ol>
        </aside>
        <section class="h3b-active h3b-panel" aria-label="Active stack"></section>
        <div class="h3b-hint" role="status"></div>
        <div class="h3b-actions h3b-panel" aria-label="Battle actions">
          <button class="h3b-action" data-action="spell" type="button">Spell<span class="h3b-key">S</span></button>
          <button class="h3b-action" data-action="wait" type="button">Wait<span class="h3b-key">W</span></button>
          <button class="h3b-action" data-action="defend" type="button">Defend<span class="h3b-key">D</span></button>
          <button class="h3b-action" data-action="auto" type="button" aria-pressed="false">Auto<span class="h3b-key">A</span></button>
          <button class="h3b-action" data-action="help" type="button">Help<span class="h3b-key">H</span></button>
        </div>
        <section class="h3b-spellbook h3b-panel" hidden aria-label="Hero spellbook"></section>
        <div class="h3b-tooltip h3b-panel" hidden></div>
        <div class="h3b-modal" data-modal="help" hidden>
          <section class="h3b-dialog h3b-panel" role="dialog" aria-modal="true" aria-labelledby="h3b-help-title">
            <h2 id="h3b-help-title">Battlefield guide</h2>
            <p>Destroy every enemy stack while preserving your army. Your blue-ringed stacks deploy on the left; red-ringed enemies deploy on the right. The glowing gold ring marks the active stack.</p>
            <h3>Move and fight</h3>
            <ul>
              <li>Click a green hex to move. Click a red-ringed enemy to shoot or to move into an adjacent hex and make a melee attack.</li>
              <li>Shooters have limited ammunition, deal half damage in melee, and suffer penalties beyond six hexes or through rocks, trees, and walls. Flying stacks cross blockers but need a clear landing hex.</li>
              <li>Living stacks normally retaliate once per round to melee attacks. The Retaliation trait permits two; Double Strike attacks twice with retaliation between the strikes.</li>
              <li>Wait acts again in reverse order at the end of the round. Defend ends the activation and grants 25% defense until the stack’s next turn.</li>
            </ul>
            <h3>Hero magic</h3>
            <p>Each hero may cast once per round during their own army’s turn without consuming the stack’s action. Choose one of 19 spells, then a highlighted target when required. Mass, caster, and enemy-hero spells resolve immediately. Cure and Fountain of Life can revive a fallen ally on its original, unobstructed hex; Tidal Renewal heals wounded living allies only. Quake Pulse damages both armies.</p>
            <h3>Camera and controls</h3>
            <p>Right-drag to orbit, middle-drag or Shift-drag to pan, and use the wheel to zoom. On touchscreens, drag to orbit and tap to act. Keyboard: S spell, W wait, D defend, A auto combat, R reset camera, H help, Escape cancel. Auto hands both armies to the tactical AI.</p>
            <div class="h3b-dialog-footer"><button class="h3b-primary" data-action="close-help" type="button">Return to battle</button></div>
          </section>
        </div>
        <div class="h3b-modal h3b-result" data-modal="result" hidden>
          <section class="h3b-dialog h3b-panel" role="dialog" aria-modal="true" aria-labelledby="h3b-result-title">
            <div class="h3b-result-content"></div>
            <div class="h3b-dialog-footer"><button class="h3b-primary" data-action="complete" type="button">Return to adventure</button></div>
          </section>
        </div>
      </div>`;
    this.container.appendChild(this.root);
    this.scene = new BattleScene(this.query('.h3b-scene'), this.engine, {
      onStackClick: (stackId) => this.handleStackClick(stackId),
      onHexClick: (hex) => this.handleHexClick(hex),
      onHover: (payload) => this.handleHover(payload),
    }, { createCustomCreatureModel: options.createCustomCreatureModel });
    this.bindInput();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    } else this.resizeObserver = null;
    window.addEventListener('resize', () => this.resize(), { signal: this.listeners.signal });
    this.refresh();
    if (this.engine.getResult()) this.showResult();
    else this.scheduleAi();
  }

  resize(): void {
    if (!this.disposed) this.scene.resize();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearAiTimer();
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.listeners.abort();
    this.resizeObserver?.disconnect();
    this.scene.dispose();
    this.root.remove();
  }

  private query<T extends HTMLElement>(selector: string): T {
    const element = this.root.querySelector<T>(selector);
    if (!element) throw new Error(`Battle interface element is missing: ${selector}`);
    return element;
  }

  private bindInput(): void {
    const signal = this.listeners.signal;
    this.root.addEventListener('click', (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const button = target?.closest<HTMLButtonElement>('button[data-action], button[data-spell]');
      if (!button || !this.root.contains(button)) return;
      const spellId = button.dataset.spell;
      if (spellId) this.selectSpell(spellId);
      else if (button.dataset.action) this.handleAction(button.dataset.action);
    }, { signal });
    window.addEventListener('keydown', (event) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || this.disposed) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const key = event.key.toLowerCase();
      const actions: Record<string, string> = { w: 'wait', d: 'defend', s: 'spell', a: 'auto', h: 'help', r: 'camera-reset' };
      if (key === 'escape') {
        this.selectedSpell = null;
        this.spellbookOpen = false;
        this.query<HTMLElement>('[data-modal="help"]').hidden = true;
        this.refresh();
      } else if (actions[key]) {
        event.preventDefault();
        this.handleAction(actions[key]!);
      }
    }, { signal });
  }

  private handleAction(action: string): void {
    if (this.disposed) return;
    if (action === 'help') {
      this.query<HTMLElement>('[data-modal="help"]').hidden = false;
      return;
    }
    if (action === 'close-help') {
      this.query<HTMLElement>('[data-modal="help"]').hidden = true;
      return;
    }
    if (action === 'camera-reset') this.scene.resetCamera();
    else if (action === 'rotate-left') this.scene.rotateCamera(-1);
    else if (action === 'rotate-right') this.scene.rotateCamera(1);
    else if (action === 'zoom-in') this.scene.zoomBy(1.18);
    else if (action === 'zoom-out') this.scene.zoomBy(1 / 1.18);
    else if (action === 'auto' && !this.engine.getResult()) {
      this.auto = !this.auto;
      if (!this.auto) this.clearAiTimer();
      this.selectedSpell = null;
      this.spellbookOpen = false;
      this.refresh();
      this.scheduleAi();
    } else if (action === 'complete') this.deliverResult();
    else if (action === 'spell') {
      if (!this.canControl()) return;
      this.spellbookOpen = !this.spellbookOpen;
      this.selectedSpell = null;
      this.refresh();
    } else if (action === 'wait' && this.canControl()) {
      void this.perform(() => this.engine.wait());
    } else if (action === 'defend' && this.canControl()) {
      void this.perform(() => this.engine.defend());
    }
  }

  private canControl(): boolean {
    const active = this.engine.getActiveStack();
    return !this.busy && !this.auto && active?.side === 'attacker' && !this.engine.getResult();
  }

  private handleStackClick(stackId: string): void {
    if (!this.canControl()) return;
    const target = this.engine.getStack(stackId);
    if (!target) return;
    if (this.selectedSpell) {
      const spellId = this.selectedSpell;
      void this.perform(() => this.engine.castSpell(spellId, 'attacker', stackId));
      return;
    }
    const active = this.engine.getActiveStack();
    if (active && target.side !== active.side && target.count > 0) {
      void this.perform(() => this.engine.attack(stackId));
    }
  }

  private handleHexClick(hex: HexCoord): void {
    if (!this.canControl()) return;
    if (this.selectedSpell) {
      this.showError('Choose one of the highlighted creature targets, or press Escape to cancel.');
      return;
    }
    void this.perform(() => this.engine.move(hex));
  }

  private selectSpell(spellId: string): void {
    if (!this.canControl()) return;
    const spell = getCombatSpell(spellId);
    if (spell.target === 'allEnemies' ||
      typeof spell.effect !== 'string' && spell.target !== 'ally' && spell.target !== 'enemy') {
      void this.perform(() => this.engine.castSpell(spellId, 'attacker'));
      return;
    }
    this.selectedSpell = this.selectedSpell === spellId ? null : spellId;
    this.spellbookOpen = false;
    this.refresh();
    if (this.selectedSpell && this.engine.getSpellTargets(spellId, 'attacker').length === 0) {
      this.showError('There is no valid target for that spell right now.');
    }
  }

  private async perform(action: () => BattleActionResult<BattleEvent[]>): Promise<void> {
    if (this.busy || this.disposed) return;
    this.clearAiTimer();
    const result = action();
    if (!result.ok) {
      this.showError(result.error);
      return;
    }
    this.busy = true;
    this.error = null;
    this.selectedSpell = null;
    this.spellbookOpen = false;
    this.scene.setHighlights([], []);
    this.query<HTMLElement>('.h3b-tooltip').hidden = true;
    this.refresh();
    await this.scene.animate(result.value);
    if (this.disposed) return;
    this.busy = false;
    this.refresh();
    if (this.engine.getResult()) this.showResult();
    else this.scheduleAi();
  }

  private scheduleAi(): void {
    this.clearAiTimer();
    if (!this.shouldScheduleAi()) return;
    this.aiTimer = setTimeout(() => {
      this.aiTimer = null;
      if (!this.shouldScheduleAi()) return;
      void this.perform(() => performAiTurn(this.engine));
    }, this.auto ? 180 : 480);
  }

  private shouldScheduleAi(): boolean {
    const active = this.engine.getActiveStack();
    return !this.disposed && !this.busy && !this.engine.getResult() &&
      Boolean(active && (active.side === 'defender' || this.auto));
  }

  private clearAiTimer(): void {
    if (this.aiTimer !== null) clearTimeout(this.aiTimer);
    this.aiTimer = null;
  }

  private refresh(): void {
    if (this.disposed) return;
    const active = this.engine.getActiveStack();
    this.query('.h3b-round').textContent = `Round ${this.engine.getState().round}`;
    this.refreshInitiative();
    this.refreshActive(active);
    this.refreshHeroes();
    this.refreshLog();
    const canControl = this.canControl();
    for (const action of ['spell', 'wait', 'defend']) {
      const button = this.root.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      if (button) button.disabled = !canControl;
    }
    const spellButton = this.root.querySelector<HTMLButtonElement>('[data-action="spell"]');
    const hero = this.engine.getHero('attacker');
    if (spellButton) spellButton.disabled = !canControl || !hero || hero.castThisRound || hero.maxMana === 0;
    const autoButton = this.root.querySelector<HTMLButtonElement>('[data-action="auto"]');
    if (autoButton) {
      autoButton.disabled = Boolean(this.engine.getResult());
      autoButton.setAttribute('aria-pressed', String(this.auto));
      autoButton.innerHTML = `${this.auto ? 'Auto on' : 'Auto'}<span class="h3b-key">A</span>`;
    }
    this.refreshSpellbook();
    this.currentReachable = canControl && !this.selectedSpell ? this.engine.getReachable() : [];
    const targets = canControl
      ? this.selectedSpell
        ? this.engine.getSpellTargets(this.selectedSpell, 'attacker')
        : this.engine.getLivingStacks('defender').filter((stack) => this.engine.getAttackPreview(stack.id)).map((stack) => stack.id)
      : [];
    this.scene.setHighlights(this.currentReachable, targets, this.selectedSpell ? 0xb792ed : 0xe66858);
    const hint = this.query<HTMLElement>('.h3b-hint');
    hint.dataset.error = String(Boolean(this.error));
    hint.textContent = this.error ?? this.defaultHint(active);
  }

  private refreshInitiative(): void {
    const activeId = this.engine.getActiveStack()?.id;
    this.query('.h3b-initiative').innerHTML = this.engine.getState().initiative.map((id) => {
      const stack = this.engine.getStack(id);
      if (!stack) return '';
      const creature = getCreature(stack.creatureId);
      return `<div class="h3b-turn" data-side="${stack.side}" data-active="${stack.id === activeId}" data-dead="${stack.count <= 0}" title="${escapeHtml(creature.name)} · speed ${this.engine.getStackSpeed(stack)}">
        <span class="h3b-turn-silhouette">${escapeHtml(creature.name.charAt(0))}</span>
        <span>${escapeHtml(creature.name.split(' ').at(-1) ?? creature.name)}</span>
        <span class="h3b-turn-count">×${stack.count}</span>
      </div>`;
    }).join('');
  }

  private refreshActive(active: BattleStackState | null): void {
    const panel = this.query('.h3b-active');
    if (!active) {
      panel.innerHTML = '<div class="h3b-eyebrow">Battle complete</div><div class="h3b-active-name">No active stack</div>';
      return;
    }
    const creature = getCreature(active.creatureId);
    const statuses = [...Object.keys(active.statuses), ...Object.keys(active.expandedStatuses ?? {})];
    if (active.defending) statuses.push('defending');
    if (active.waited) statuses.push('waited');
    const traits = creature.abilities.length > 0 ? creature.abilities.join(' · ') : 'no special traits';
    panel.innerHTML = `<div class="h3b-eyebrow">${sideName(active.side)} · Active stack</div>
      <div class="h3b-active-name">${escapeHtml(creature.name)}</div>
      <div class="h3b-active-count">×${active.count} · ${this.engine.getStackHealth(active)} total health · ${escapeHtml(traits)}</div>
      <div class="h3b-stats">
        <div class="h3b-stat"><small>Attack</small><strong>${this.engine.getStackAttack(active)}</strong></div>
        <div class="h3b-stat"><small>Defense</small><strong>${this.engine.getStackDefense(active)}</strong></div>
        <div class="h3b-stat"><small>Speed</small><strong>${this.engine.getStackSpeed(active)}</strong></div>
        <div class="h3b-stat"><small>Damage</small><strong>${creature.damage[0]}–${creature.damage[1]}</strong></div>
        <div class="h3b-stat"><small>Shots</small><strong>${creature.abilities.includes('ranged') ? active.shots : '—'}</strong></div>
        <div class="h3b-stat"><small>Top HP</small><strong>${active.topHealth}/${creature.health}</strong></div>
      </div>
      <div class="h3b-statuses">${statuses.length > 0 ? escapeHtml(statuses.join(' · ')) : 'Ready for orders'}</div>`;
  }

  private refreshHeroes(): void {
    this.query('.h3b-heroes').innerHTML = (['attacker', 'defender'] as const).map((side) => {
      const hero = this.engine.getHero(side);
      if (!hero) {
        return `<section class="h3b-hero h3b-panel" data-side="${side}"><div class="h3b-hero-name">${sideName(side)}</div><div class="h3b-hero-meta"><span>No hero</span><span>No magic</span></div></section>`;
      }
      const definitionId = hero.heroId.replace(/^hero-/, '');
      const definition = Object.hasOwn(HEROES, definitionId) ? HEROES[definitionId] : undefined;
      const manaPercent = hero.maxMana > 0 ? hero.mana / hero.maxMana * 100 : 0;
      return `<section class="h3b-hero h3b-panel" data-side="${side}">
        <div class="h3b-hero-name">${escapeHtml(definition?.name ?? hero.heroId)}</div>
        <div class="h3b-mana"><div class="h3b-mana-fill" style="width:${manaPercent}%"></div></div>
        <div class="h3b-hero-meta"><span>${hero.mana}/${hero.maxMana} mana</span><span>${hero.castThisRound ? 'Cast this round' : 'Spell ready'}</span></div>
      </section>`;
    }).join('');
  }

  private refreshLog(): void {
    const list = this.query<HTMLOListElement>('.h3b-log-list');
    list.innerHTML = this.engine.getState().log.map((entry) =>
      `<li class="h3b-log-entry" data-tone="${entry.tone}"><span class="h3b-log-round">R${entry.round}</span>${escapeHtml(entry.text)}</li>`).join('');
    list.scrollTop = list.scrollHeight;
  }

  private refreshSpellbook(): void {
    const panel = this.query<HTMLElement>('.h3b-spellbook');
    panel.hidden = !this.spellbookOpen;
    if (!this.spellbookOpen) return;
    const hero = this.engine.getHero('attacker');
    if (!hero) {
      panel.innerHTML = '<div class="h3b-spellbook-title">No hero is present to cast spells.</div>';
      return;
    }
    panel.innerHTML = `<div class="h3b-spellbook-head"><span class="h3b-spellbook-title">Spellbook · ${hero.mana} mana</span><button class="h3b-icon-button h3b-spellbook-close" data-action="spell" type="button" aria-label="Close spellbook">×</button></div>
      <div class="h3b-spells">${this.engine.getSpellbook('attacker').map((spell) => {
        const disabled = hero.castThisRound || hero.mana < spell.manaCost;
        return `<button class="h3b-spell" data-spell="${spell.id}" data-selected="${this.selectedSpell === spell.id}" type="button" ${disabled ? 'disabled' : ''}>
          <span class="h3b-spell-cost">${spell.manaCost} mana</span><span class="h3b-spell-name">${escapeHtml(spell.name)}</span>
          <span class="h3b-spell-description">${escapeHtml(this.describeSpell(spell))}</span>
        </button>`;
      }).join('')}</div>`;
  }

  private describeSpell(spell: CombatSpellDefinition): string {
    if (typeof spell.effect !== 'string') return spell.description;
    const amount = this.engine.getSpellAmount(spell.id, 'attacker');
    if (spell.effect === 'damage') return `${amount} ${spell.target === 'allEnemies' ? 'damage to every enemy' : 'damage to one enemy'}; resistance halves it.`;
    if (spell.effect === 'heal') return `Restore up to ${amount} health and revive fallen creatures.`;
    if (spell.effect === 'haste') return `+${spell.power} speed for three rounds.`;
    if (spell.effect === 'slow') return `−${spell.power} enemy speed for three rounds.`;
    if (spell.effect === 'shield') return `+${spell.power} defense for three rounds.`;
    return `+${spell.power} minimum and maximum damage for three rounds.`;
  }

  private defaultHint(active: BattleStackState | null): string {
    if (this.engine.getResult()) return 'Battle complete. Review the survivors and return to the adventure.';
    if (this.busy) return this.auto ? 'Tactical AI is resolving the battle…' : 'Resolving the activation…';
    if (this.selectedSpell) return `${getCombatSpell(this.selectedSpell).name}: choose a purple-ringed target · Escape cancels`;
    if (this.auto) return 'Auto combat is on. Disable it at any attacker turn to take control.';
    if (active?.side === 'defender') return 'The enemy commander is choosing a tactical action…';
    return 'Click a green hex to move · Click a red-ringed enemy to attack · H opens the guide';
  }

  private handleHover(payload: HoverPayload): void {
    this.scene.setHover(payload.stackId, payload.hex);
    const tooltip = this.query<HTMLElement>('.h3b-tooltip');
    if (this.busy || !this.query<HTMLElement>('[data-modal="result"]').hidden || !payload.stackId && !payload.hex) {
      tooltip.hidden = true;
      return;
    }
    const stack = payload.stackId ? this.engine.getStack(payload.stackId) : undefined;
    let content = '';
    if (stack) {
      const creature = getCreature(stack.creatureId);
      content = `<strong>${escapeHtml(creature.name)} ×${stack.count}</strong><div>${sideName(stack.side)} · ${this.engine.getStackHealth(stack)}/${this.engine.getStackMaxHealth(stack)} total HP</div>`;
      if (this.selectedSpell) {
        const valid = this.engine.getSpellTargets(this.selectedSpell, 'attacker').includes(stack.id);
        content += `<div>${valid ? `Cast ${escapeHtml(getCombatSpell(this.selectedSpell).name)}` : 'Invalid target for this spell'}</div>`;
      } else if (this.canControl() && stack.side === 'defender' && stack.count > 0) {
        const preview = this.engine.getAttackPreview(stack.id);
        if (preview) {
          const penalties = [preview.rangePenalty ? 'long range ½' : '', preview.obstaclePenalty ? 'obstacle ½' : '', preview.wallPenalty ? 'wall ½' : ''].filter(Boolean);
          content += `<div>${preview.kind === 'ranged' ? 'Shoot' : 'Melee'}: ${preview.min}–${preview.max} damage${preview.path?.cost ? ` · move ${preview.path.cost}` : ''}</div>`;
          if (penalties.length > 0) content += `<div class="h3b-warning">${escapeHtml(penalties.join(' · '))}</div>`;
          content += `<div>${preview.canRetaliate ? 'Enemy can retaliate' : 'No retaliation available'}</div>`;
        } else content += '<div>No route to attack this turn</div>';
      }
    } else if (payload.hex) {
      const reachable = this.currentReachable.find((tile) => hexKey(tile.position) === hexKey(payload.hex!));
      const obstacle = this.engine.getState().obstacles.find((item) => hexKey(item.position) === hexKey(payload.hex!));
      if (reachable) content = `<strong>Move here</strong><div>${reachable.cost} hex${reachable.cost === 1 ? '' : 'es'} · click to end this activation</div>`;
      else if (obstacle) content = `<strong>Blocked ${obstacle.kind}</strong><div>Ground stacks must go around; shooters may be penalized.</div>`;
    }
    if (!content) {
      tooltip.hidden = true;
      return;
    }
    tooltip.innerHTML = content;
    const bounds = this.root.getBoundingClientRect();
    tooltip.style.left = `${Math.min(bounds.width - 235, Math.max(4, payload.clientX - bounds.left))}px`;
    tooltip.style.top = `${Math.min(bounds.height - 150, Math.max(4, payload.clientY - bounds.top))}px`;
    tooltip.hidden = false;
  }

  private showError(message: string): void {
    this.error = message;
    this.refresh();
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => {
      this.error = null;
      this.refresh();
    }, 2600);
  }

  private showResult(): void {
    const result = this.engine.getResult();
    if (!result) return;
    const title = result.winner === 'draw' ? 'Battle drawn' : result.winner === 'attacker' ? 'Victory' : 'Defeat';
    const army = (side: BattleSideId): string => {
      const stacks = side === 'attacker' ? result.attackerArmy : result.defenderArmy;
      return stacks.length > 0
        ? stacks.map((stack) => `<p>×${stack.count} ${escapeHtml(getCreature(stack.creatureId).name)}</p>`).join('')
        : '<p>No surviving creatures</p>';
    };
    const resources = Object.entries(result.rewards.resources).map(([resource, amount]) => `${amount} ${resource}`).join(' · ');
    this.query('.h3b-result-content').innerHTML = `<h2 id="h3b-result-title">${title}</h2>
      <p>${result.rounds} round${result.rounds === 1 ? '' : 's'} · ${sideName(result.winner === 'draw' ? 'attacker' : result.winner)}${result.winner === 'draw' ? ' and Defender' : ''} ${result.winner === 'draw' ? 'withdraw' : 'prevails'}.</p>
      <div class="h3b-result-summary"><section class="h3b-survivors"><h3>Attacking survivors</h3>${army('attacker')}</section><section class="h3b-survivors"><h3>Defending survivors</h3>${army('defender')}</section></div>
      <p class="h3b-rewards">${result.winner === 'draw' ? 'No rewards in a draw.' : `Rewards: ${result.rewards.experience} experience${resources ? ` · ${escapeHtml(resources)}` : ''}`}</p>`;
    this.query<HTMLElement>('[data-modal="result"]').hidden = false;
    this.root.querySelector<HTMLButtonElement>('[data-action="complete"]')?.focus();
  }

  private deliverResult(): void {
    const result = this.engine.getResult();
    if (!result || this.resultDelivered) return;
    this.resultDelivered = true;
    this.onComplete(result);
  }
}

export default BattleView;
