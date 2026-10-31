import { cloneBattleSetup } from '../game/combat';
import { getCreature, getSpell, SPELLS } from '../game/content';
import { SeededRandom } from '../game/random';
import type {
  ArmyStack,
  BattleResult,
  BattleSetup,
  BattleSide,
  SpellDefinition,
} from '../game/types';
import {
  BATTLEFIELD_COLUMNS,
  BATTLEFIELD_ROWS,
  hexDistance,
  hexKey,
  hexLine,
  hexNeighbors,
  isInsideBattlefield,
  sameHex,
} from './hex';
import type {
  BattleActionResult,
  BattleEngineOptions,
  BattleEvent,
  BattleHeroState,
  BattleObstacle,
  BattleSideId,
  BattleStackState,
  BattleState,
  CombatLogEntry,
  DamagePreview,
  HexCoord,
  HexPath,
  ReachableHex,
  StackStatus,
} from './types';

const DEPLOYMENT_ROWS = [5, 2, 8, 0, 10, 3, 7];
const LONG_RANGE = 6;

function oppositeSide(side: BattleSideId): BattleSideId {
  return side === 'attacker' ? 'defender' : 'attacker';
}

function defaultDeployment(side: BattleSideId, index: number): HexCoord {
  const row = DEPLOYMENT_ROWS[index % DEPLOYMENT_ROWS.length] ?? 5;
  const extraColumn = Math.floor(index / DEPLOYMENT_ROWS.length);
  return {
    x: side === 'attacker' ? 1 + extraColumn : BATTLEFIELD_COLUMNS - 2 - extraColumn,
    y: row,
  };
}

function totalHealth(stack: BattleStackState): number {
  if (stack.count <= 0) return 0;
  return (stack.count - 1) * getCreature(stack.creatureId).health + stack.topHealth;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown battle action error';
}

export class BattleEngine {
  readonly setup: BattleSetup;
  private readonly random: SeededRandom;
  private readonly state: BattleState;
  private readonly maxRounds: number;
  private turnQueue: string[] = [];
  private waitingQueue: string[] = [];
  private nextLogId = 1;
  private regeneratedRound = new Map<string, number>();

  constructor(setup: BattleSetup, options: BattleEngineOptions = {}) {
    this.setup = cloneBattleSetup(setup);
    this.random = new SeededRandom(setup.seed);
    this.maxRounds = options.maxRounds ?? 100;
    if (!Number.isInteger(this.maxRounds) || this.maxRounds < 1) {
      throw new Error('Battle round limit must be a positive integer');
    }
    const obstacles = (options.obstacles ?? this.createObstacles()).map((obstacle) => ({
      position: { ...obstacle.position },
      kind: obstacle.kind,
    }));
    const stacks = [
      ...this.createStacks('attacker', this.setup.attacker, options.attackerPositions),
      ...this.createStacks('defender', this.setup.defender, options.defenderPositions),
    ];
    this.state = {
      round: 0,
      activeStackId: null,
      stacks,
      initiative: [],
      heroes: {
        attacker: this.createHero(this.setup.attacker),
        defender: this.createHero(this.setup.defender),
      },
      obstacles,
      log: [],
      result: null,
    };
    this.validateBoard();
    this.log('neutral', this.setup.source.kind === 'town'
      ? 'The siege begins. The breached gate is the only ground route through the wall.'
      : 'The armies meet on the battlefield.');
    if (!this.checkOutcome([])) this.beginRound([]);
  }

  getState(): Readonly<BattleState> {
    return this.state;
  }

  getResult(): BattleResult | null {
    return this.state.result;
  }

  getStack(id: string): BattleStackState | undefined {
    return this.state.stacks.find((stack) => stack.id === id);
  }

  getActiveStack(): BattleStackState | null {
    return this.state.activeStackId ? this.getStack(this.state.activeStackId) ?? null : null;
  }

  getLivingStacks(side?: BattleSideId): BattleStackState[] {
    return this.state.stacks.filter((stack) => stack.count > 0 && (!side || stack.side === side));
  }

  getHero(side: BattleSideId): BattleHeroState | undefined {
    return this.state.heroes[side];
  }

  getSpellbook(side: BattleSideId): SpellDefinition[] {
    const hero = this.getHero(side);
    return hero ? hero.spells.map((spellId) => getSpell(spellId)) : [];
  }

  getStackSpeed(stack: BattleStackState): number {
    let speed = getCreature(stack.creatureId).speed;
    if (stack.statuses.haste) speed += getSpell('haste').power;
    if (stack.statuses.slow) speed -= getSpell('slow').power;
    return Math.max(1, speed);
  }

  getStackAttack(stack: BattleStackState): number {
    return getCreature(stack.creatureId).attack + this.setup[stack.side].primarySkills.attack;
  }

  getStackDefense(stack: BattleStackState): number {
    const base = getCreature(stack.creatureId).defense +
      this.setup[stack.side].primarySkills.defense + (stack.statuses.shield ? getSpell('stoneSkin').power : 0);
    return base + (stack.defending ? Math.max(1, Math.floor(base * 0.25)) : 0);
  }

  getStackHealth(stack: BattleStackState): number {
    return totalHealth(stack);
  }

  getStackMaxHealth(stack: BattleStackState): number {
    return stack.initialCount * getCreature(stack.creatureId).health;
  }

  getReachable(stackId = this.state.activeStackId ?? ''): ReachableHex[] {
    const stack = this.getStack(stackId);
    if (!stack || stack.count <= 0 || this.state.result) return [];
    const speed = this.getStackSpeed(stack);
    if (getCreature(stack.creatureId).abilities.includes('flying')) {
      const reachable: ReachableHex[] = [];
      for (let y = 0; y < BATTLEFIELD_ROWS; y += 1) {
        for (let x = 0; x < BATTLEFIELD_COLUMNS; x += 1) {
          const position = { x, y };
          const cost = hexDistance(stack.position, position);
          if (cost === 0 || cost > speed || !this.isLandingOpen(position, stack.id)) continue;
          reachable.push({ position, path: [{ ...stack.position }, position], cost });
        }
      }
      return reachable;
    }

    const occupied = this.occupiedHexes(stack.id);
    const blocked = this.obstacleHexes();
    const startKey = hexKey(stack.position);
    const distances = new Map<string, number>([[startKey, 0]]);
    const previous = new Map<string, HexCoord>();
    const queue: HexCoord[] = [{ ...stack.position }];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (!current) continue;
      const currentCost = distances.get(hexKey(current)) ?? 0;
      if (currentCost >= speed) continue;
      for (const neighbor of hexNeighbors(current)) {
        const key = hexKey(neighbor);
        if (distances.has(key) || occupied.has(key) || blocked.has(key)) continue;
        distances.set(key, currentCost + 1);
        previous.set(key, current);
        queue.push(neighbor);
      }
    }
    const reachable: ReachableHex[] = [];
    for (const [key, cost] of distances) {
      if (cost === 0) continue;
      const [xText, yText] = key.split(',');
      const position = { x: Number(xText), y: Number(yText) };
      const path = [position];
      let cursor = position;
      while (hexKey(cursor) !== startKey) {
        const prior = previous.get(hexKey(cursor));
        if (!prior) break;
        path.unshift({ ...prior });
        cursor = prior;
      }
      reachable.push({ position, path, cost });
    }
    return reachable.sort((a, b) => a.cost - b.cost || a.position.y - b.position.y || a.position.x - b.position.x);
  }

  findPath(destination: HexCoord, stackId = this.state.activeStackId ?? ''): HexPath | null {
    const stack = this.getStack(stackId);
    if (!stack || stack.count <= 0 || !isInsideBattlefield(destination) || !this.isLandingOpen(destination, stack.id)) {
      return null;
    }
    if (sameHex(stack.position, destination)) return { path: [{ ...stack.position }], cost: 0 };
    if (getCreature(stack.creatureId).abilities.includes('flying')) {
      const cost = hexDistance(stack.position, destination);
      return cost <= this.getStackSpeed(stack)
        ? { path: [{ ...stack.position }, { ...destination }], cost }
        : null;
    }
    const reachable = this.getReachable(stack.id).find((tile) => sameHex(tile.position, destination));
    return reachable ? { path: reachable.path.map((hex) => ({ ...hex })), cost: reachable.cost } : null;
  }

  findAttackPath(targetId: string): HexPath | null {
    const attacker = this.getActiveStack();
    const target = this.getStack(targetId);
    if (!attacker || !target || attacker.side === target.side || target.count <= 0) return null;
    if (hexDistance(attacker.position, target.position) === 1) return { path: [{ ...attacker.position }], cost: 0 };
    const candidates = hexNeighbors(target.position)
      .filter((hex) => this.isLandingOpen(hex, attacker.id))
      .map((hex) => this.findPath(hex, attacker.id))
      .filter((path): path is HexPath => path !== null)
      .sort((a, b) => a.cost - b.cost || hexDistance(a.path[a.path.length - 1] ?? attacker.position, attacker.position) -
        hexDistance(b.path[b.path.length - 1] ?? attacker.position, attacker.position));
    return candidates[0] ?? null;
  }

  getAttackPreview(targetId: string): DamagePreview | null {
    const attacker = this.getActiveStack();
    const target = this.getStack(targetId);
    if (!attacker || !target || attacker.count <= 0 || target.count <= 0 || attacker.side === target.side) return null;
    const adjacent = hexDistance(attacker.position, target.position) === 1;
    const canShoot = !adjacent && getCreature(attacker.creatureId).abilities.includes('ranged') && attacker.shots > 0;
    const kind = canShoot ? 'ranged' : 'melee';
    const path = kind === 'melee' ? this.findAttackPath(target.id) : null;
    if (kind === 'melee' && !path) return null;
    const rangePenalty = kind === 'ranged' && hexDistance(attacker.position, target.position) > LONG_RANGE;
    const intervening = kind === 'ranged' ? this.interveningObstacles(attacker.position, target.position) : [];
    const wallPenalty = intervening.some((obstacle) => obstacle.kind === 'wall');
    const obstaclePenalty = intervening.some((obstacle) => obstacle.kind !== 'wall');
    const { min, max } = this.damageRange(attacker, target, kind, rangePenalty, obstaclePenalty, wallPenalty);
    return {
      kind,
      min,
      max,
      attack: this.getStackAttack(attacker),
      defense: this.getStackDefense(target),
      rangePenalty,
      obstaclePenalty,
      wallPenalty,
      path,
      canRetaliate: kind === 'melee' && this.canRetaliate(target),
    };
  }

  getSpellTargets(spellId: string, side: BattleSideId): string[] {
    const spell = getSpell(spellId);
    const hero = this.getHero(side);
    if (!hero || !hero.spells.includes(spellId) || this.state.result) return [];
    if (spell.target === 'allEnemies') return [];
    if (spell.target === 'self') {
      const active = this.getActiveStack();
      return active?.side === side ? [active.id] : [];
    }
    return this.state.stacks.filter((stack) => {
      if (spell.target === 'enemy') return stack.side !== side && stack.count > 0;
      if (stack.side !== side) return false;
      if (stack.count > 0) return spell.effect !== 'heal' || totalHealth(stack) < this.getStackMaxHealth(stack);
      if (spell.effect !== 'heal' || !this.isLandingOpen(stack.position, stack.id)) return false;
      return this.getLivingStacks(side).length > 0;
    }).map((stack) => stack.id);
  }

  canCastSpell(spellId: string, side: BattleSideId, targetId?: string): BattleActionResult<true> {
    try {
      this.validateSpell(spellId, side, targetId);
      return { ok: true, value: true };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  }

  getSpellAmount(spellId: string, side: BattleSideId): number {
    const spell = getSpell(spellId);
    return spell.power + this.setup[side].primarySkills.spellPower * 10;
  }

  move(destination: HexCoord): BattleActionResult<BattleEvent[]> {
    return this.attempt(() => {
      const stack = this.requireActive();
      const path = this.findPath(destination, stack.id);
      if (!path || path.cost === 0) throw new Error('That hex is not reachable by this stack');
      stack.position = { ...destination };
      this.log(stack.side, `${this.stackName(stack)} moves ${path.cost} hex${path.cost === 1 ? '' : 'es'}.`);
      const events: BattleEvent[] = [{ kind: 'move', stackId: stack.id, path: path.path.map((hex) => ({ ...hex })) }];
      this.finishActivation(events);
      return events;
    });
  }

  attack(targetId: string): BattleActionResult<BattleEvent[]> {
    return this.attempt(() => {
      const attacker = this.requireActive();
      const target = this.getStack(targetId);
      if (!target || target.count <= 0 || target.side === attacker.side) throw new Error('Choose a living enemy stack');
      const preview = this.getAttackPreview(targetId);
      if (!preview) throw new Error('No attack or route to an adjacent hex is available');
      const events: BattleEvent[] = [];
      if (preview.path && preview.path.cost > 0) {
        const destination = preview.path.path[preview.path.path.length - 1];
        if (!destination) throw new Error('The attack route has no destination');
        attacker.position = { ...destination };
        events.push({ kind: 'move', stackId: attacker.id, path: preview.path.path.map((hex) => ({ ...hex })) });
      }

      if (preview.kind === 'ranged') {
        attacker.shots -= 1;
        this.strike(attacker, target, 'ranged', false, events, preview);
      } else {
        this.strike(attacker, target, 'melee', false, events, preview);
        const doubleStrike = getCreature(attacker.creatureId).abilities.includes('doubleStrike');
        if (doubleStrike && target.count > 0 && attacker.count > 0 && this.canRetaliate(target)) {
          target.retaliationsUsed += 1;
          this.strike(target, attacker, 'melee', true, events);
        }
        if (doubleStrike && target.count > 0 && attacker.count > 0) {
          this.strike(attacker, target, 'melee', false, events);
        }
        if (!doubleStrike && target.count > 0 && attacker.count > 0 && this.canRetaliate(target)) {
          target.retaliationsUsed += 1;
          this.strike(target, attacker, 'melee', true, events);
        }
      }
      this.checkOutcome(events);
      if (!this.state.result) this.finishActivation(events);
      return events;
    });
  }

  wait(): BattleActionResult<BattleEvent[]> {
    return this.attempt(() => {
      const stack = this.requireActive();
      if (stack.waited) throw new Error('This stack has already waited this round');
      if (!this.turnQueue.some((id) => (this.getStack(id)?.count ?? 0) > 0)) {
        throw new Error('The last stack in a round cannot wait');
      }
      stack.waited = true;
      this.waitingQueue.push(stack.id);
      this.state.activeStackId = null;
      this.log(stack.side, `${this.stackName(stack)} waits.`);
      const events: BattleEvent[] = [{ kind: 'wait', stackId: stack.id }];
      this.activateNext(events);
      return events;
    });
  }

  defend(): BattleActionResult<BattleEvent[]> {
    return this.attempt(() => {
      const stack = this.requireActive();
      stack.defending = true;
      this.log(stack.side, `${this.stackName(stack)} takes a defensive stance (+25% defense).`);
      const events: BattleEvent[] = [{ kind: 'defend', stackId: stack.id }];
      this.finishActivation(events);
      return events;
    });
  }

  castSpell(spellId: string, side: BattleSideId, targetId?: string): BattleActionResult<BattleEvent[]> {
    return this.attempt(() => {
      const spell = this.validateSpell(spellId, side, targetId);
      const hero = this.getHero(side);
      if (!hero) throw new Error('This side has no spellcaster');
      const targets = spell.target === 'allEnemies'
        ? this.getLivingStacks(oppositeSide(side))
        : [this.getStack(targetId ?? '')];
      if (targets.some((target) => !target)) throw new Error('The spell target is no longer valid');
      const validTargets = targets.filter((target): target is BattleStackState => target !== undefined);
      hero.mana -= spell.manaCost;
      hero.castThisRound = true;
      const amounts: Record<string, number> = {};
      const events: BattleEvent[] = [];
      let defeated = 0;
      let revived = 0;

      for (const target of validTargets) {
        if (spell.effect === 'damage') {
          const resistance = getCreature(target.creatureId).abilities.includes('spellResistance');
          const amount = Math.max(1, Math.floor(this.getSpellAmount(spellId, side) * (resistance ? 0.5 : 1)));
          const before = totalHealth(target);
          const result = this.applyDamage(target, amount);
          amounts[target.id] = Math.min(before, amount);
          defeated += result;
        } else if (spell.effect === 'heal') {
          const result = this.applyHealing(target, this.getSpellAmount(spellId, side));
          amounts[target.id] = result.healed;
          revived += result.revived;
        } else {
          const status: StackStatus = spell.effect;
          target.statuses[status] = 3;
          amounts[target.id] = spell.power;
        }
      }
      events.push({
        kind: 'spell',
        side,
        spellId,
        targetIds: validTargets.map((target) => target.id),
        amounts,
      });
      const targetNames = validTargets.map((target) => this.stackName(target)).join(', ');
      let detail = targetNames;
      if (spell.effect === 'damage') detail += ` (${defeated} creature${defeated === 1 ? '' : 's'} slain)`;
      if (spell.effect === 'heal' && revived > 0) detail += ` (${revived} creature${revived === 1 ? '' : 's'} revived)`;
      this.log('magic', `${side === 'attacker' ? 'Attacking' : 'Defending'} hero casts ${spell.name} on ${detail}.`);
      this.checkOutcome(events);
      return events;
    });
  }

  private createStacks(
    side: BattleSideId,
    battleSide: BattleSide,
    positions?: HexCoord[],
  ): BattleStackState[] {
    const stacks: BattleStackState[] = [];
    battleSide.army.forEach((armyStack, index) => {
      if (!Number.isInteger(armyStack.count) || armyStack.count < 0) {
        throw new Error('Battle stack counts must be non-negative integers');
      }
      if (armyStack.count === 0) return;
      const creature = getCreature(armyStack.creatureId);
      stacks.push({
        id: `${side}:${index}`,
        side,
        creatureId: armyStack.creatureId,
        initialCount: armyStack.count,
        count: armyStack.count,
        topHealth: creature.health,
        position: { ...(positions?.[index] ?? defaultDeployment(side, index)) },
        shots: creature.shots,
        defending: false,
        waited: false,
        retaliationsUsed: 0,
        statuses: {},
      });
    });
    return stacks;
  }

  private createHero(side: BattleSide): BattleHeroState | undefined {
    if (!side.heroId) return undefined;
    const maxMana = Math.max(0, side.primarySkills.knowledge * 10);
    return {
      heroId: side.heroId,
      primarySkills: { ...side.primarySkills },
      mana: maxMana,
      maxMana,
      spells: Object.values(SPELLS).sort((a, b) => a.level - b.level || a.id.localeCompare(b.id)).map((spell) => spell.id),
      castThisRound: false,
    };
  }

  private createObstacles(): BattleObstacle[] {
    if (this.setup.source.kind === 'town') {
      const obstacles: BattleObstacle[] = [];
      for (let y = 0; y < BATTLEFIELD_ROWS; y += 1) {
        if (y !== 5) obstacles.push({ position: { x: 7, y }, kind: 'wall' });
      }
      return obstacles;
    }
    const random = new SeededRandom(`${this.setup.seed}:battlefield`);
    const obstacles = new Map<string, BattleObstacle>();
    let attempts = 0;
    while (obstacles.size < 7 && attempts < 100) {
      attempts += 1;
      const position = { x: random.integer(4, 10), y: random.integer(0, BATTLEFIELD_ROWS - 1) };
      const key = hexKey(position);
      if (!obstacles.has(key)) {
        obstacles.set(key, { position, kind: random.next() > 0.45 ? 'tree' : 'rock' });
      }
    }
    return [...obstacles.values()];
  }

  private validateBoard(): void {
    const occupied = new Set<string>();
    for (const obstacle of this.state.obstacles) {
      if (!isInsideBattlefield(obstacle.position)) throw new Error('Battle obstacle lies outside the battlefield');
      const key = hexKey(obstacle.position);
      if (occupied.has(key)) throw new Error('Battle obstacles cannot overlap');
      occupied.add(key);
    }
    for (const stack of this.state.stacks) {
      if (!isInsideBattlefield(stack.position)) throw new Error(`${this.stackName(stack)} is deployed outside the battlefield`);
      const key = hexKey(stack.position);
      if (occupied.has(key)) throw new Error(`${this.stackName(stack)} is deployed on a blocked hex`);
      occupied.add(key);
    }
  }

  private obstacleHexes(): Set<string> {
    return new Set(this.state.obstacles.map((obstacle) => hexKey(obstacle.position)));
  }

  private occupiedHexes(exceptId?: string): Set<string> {
    return new Set(this.getLivingStacks().filter((stack) => stack.id !== exceptId).map((stack) => hexKey(stack.position)));
  }

  private isLandingOpen(position: HexCoord, exceptId?: string): boolean {
    return isInsideBattlefield(position) && !this.obstacleHexes().has(hexKey(position)) &&
      !this.occupiedHexes(exceptId).has(hexKey(position));
  }

  private interveningObstacles(start: HexCoord, end: HexCoord): BattleObstacle[] {
    const obstacles = this.obstacleHexes();
    const line = hexLine(start, end).slice(1, -1);
    return this.state.obstacles.filter((obstacle) =>
      obstacles.has(hexKey(obstacle.position)) && line.some((hex) => sameHex(hex, obstacle.position)));
  }

  private requireActive(): BattleStackState {
    if (this.state.result) throw new Error('The battle has already ended');
    const active = this.getActiveStack();
    if (!active || active.count <= 0) throw new Error('There is no active stack');
    return active;
  }

  private validateSpell(spellId: string, side: BattleSideId, targetId?: string): SpellDefinition {
    if (this.state.result) throw new Error('The battle has already ended');
    const active = this.requireActive();
    if (active.side !== side) throw new Error('Heroes can only cast during their own army’s turn');
    const hero = this.getHero(side);
    if (!hero) throw new Error('This side has no hero');
    if (hero.castThisRound) throw new Error('This hero has already cast a spell this round');
    const spell = getSpell(spellId);
    if (!hero.spells.includes(spellId)) throw new Error('This hero does not know that spell');
    if (hero.mana < spell.manaCost) throw new Error('Not enough mana');
    const validTargets = this.getSpellTargets(spellId, side);
    if (spell.target === 'allEnemies') {
      if (this.getLivingStacks(oppositeSide(side)).length === 0) throw new Error('There are no enemy targets');
      return spell;
    }
    if (!targetId || !validTargets.includes(targetId)) {
      throw new Error(spell.effect === 'heal'
        ? 'Choose a wounded ally or an unobstructed fallen ally'
        : 'Choose a valid highlighted target');
    }
    return spell;
  }

  private damageRange(
    attacker: BattleStackState,
    target: BattleStackState,
    kind: 'melee' | 'ranged',
    rangePenalty = false,
    obstaclePenalty = false,
    wallPenalty = false,
  ): { min: number; max: number } {
    const creature = getCreature(attacker.creatureId);
    const bless = attacker.statuses.bless ? getSpell('bless').power : 0;
    const attack = this.getStackAttack(attacker);
    const defense = this.getStackDefense(target);
    const modifier = Math.min(3, Math.max(0.3, 1 + (attack - defense) * 0.05));
    const shotModifier = (rangePenalty ? 0.5 : 1) * (obstaclePenalty ? 0.5 : 1) * (wallPenalty ? 0.5 : 1);
    const kindModifier = kind === 'melee' && creature.abilities.includes('ranged') ? 0.5 : 1;
    const minimum = attacker.count * (creature.damage[0] + bless) * modifier * shotModifier * kindModifier;
    const maximum = attacker.count * (creature.damage[1] + bless) * modifier * shotModifier * kindModifier;
    return { min: Math.max(1, Math.floor(minimum)), max: Math.max(1, Math.floor(maximum)) };
  }

  private strike(
    attacker: BattleStackState,
    target: BattleStackState,
    attackType: 'melee' | 'ranged',
    retaliation: boolean,
    events: BattleEvent[],
    existingPreview?: DamagePreview,
  ): void {
    const preview = existingPreview ?? this.getStrikePreview(attacker, target, attackType);
    const creature = getCreature(attacker.creatureId);
    const bless = attacker.statuses.bless ? getSpell('bless').power : 0;
    const roll = this.random.integer(creature.damage[0] + bless, creature.damage[1] + bless);
    const ratio = creature.damage[1] + bless === creature.damage[0] + bless
      ? 0
      : (roll - creature.damage[0] - bless) / (creature.damage[1] - creature.damage[0]);
    const damage = Math.max(1, Math.round(preview.min + (preview.max - preview.min) * ratio));
    const killed = this.applyDamage(target, damage);
    events.push({
      kind: 'attack',
      attackerId: attacker.id,
      targetId: target.id,
      attackType,
      damage,
      killed,
      retaliation,
    });
    this.log(attacker.side, `${this.stackName(attacker)} ${retaliation ? 'retaliates against' : attackType === 'ranged' ? 'shoots' : 'strikes'} ` +
      `${this.stackName(target)} for ${damage} damage${killed > 0 ? `, slaying ${killed}` : ''}.`);
  }

  private getStrikePreview(
    attacker: BattleStackState,
    target: BattleStackState,
    attackType: 'melee' | 'ranged',
  ): DamagePreview {
    const rangePenalty = attackType === 'ranged' && hexDistance(attacker.position, target.position) > LONG_RANGE;
    const intervening = attackType === 'ranged' ? this.interveningObstacles(attacker.position, target.position) : [];
    const wallPenalty = intervening.some((obstacle) => obstacle.kind === 'wall');
    const obstaclePenalty = intervening.some((obstacle) => obstacle.kind !== 'wall');
    const range = this.damageRange(attacker, target, attackType, rangePenalty, obstaclePenalty, wallPenalty);
    return {
      kind: attackType,
      ...range,
      attack: this.getStackAttack(attacker),
      defense: this.getStackDefense(target),
      rangePenalty,
      obstaclePenalty,
      wallPenalty,
      path: null,
      canRetaliate: false,
    };
  }

  private applyDamage(stack: BattleStackState, amount: number): number {
    const oldCount = stack.count;
    const health = getCreature(stack.creatureId).health;
    const remaining = Math.max(0, totalHealth(stack) - Math.max(0, Math.floor(amount)));
    stack.count = Math.ceil(remaining / health);
    stack.topHealth = stack.count > 0 ? remaining - (stack.count - 1) * health : 0;
    if (stack.count === 0) {
      stack.defending = false;
      stack.statuses = {};
    }
    return oldCount - stack.count;
  }

  private applyHealing(stack: BattleStackState, amount: number): { healed: number; revived: number } {
    const beforeCount = stack.count;
    const beforeHealth = totalHealth(stack);
    const health = getCreature(stack.creatureId).health;
    const remaining = Math.min(this.getStackMaxHealth(stack), beforeHealth + Math.max(0, Math.floor(amount)));
    stack.count = Math.ceil(remaining / health);
    stack.topHealth = stack.count > 0 ? remaining - (stack.count - 1) * health : 0;
    return { healed: remaining - beforeHealth, revived: Math.max(0, stack.count - beforeCount) };
  }

  private canRetaliate(stack: BattleStackState): boolean {
    const limit = getCreature(stack.creatureId).abilities.includes('retaliation') ? 2 : 1;
    return stack.count > 0 && stack.retaliationsUsed < limit;
  }

  private checkOutcome(events: BattleEvent[]): boolean {
    if (this.state.result) return true;
    const attackers = this.getLivingStacks('attacker').length;
    const defenders = this.getLivingStacks('defender').length;
    if (attackers > 0 && defenders > 0) return false;
    const winner: BattleResult['winner'] = attackers === defenders ? 'draw' : attackers > 0 ? 'attacker' : 'defender';
    this.finishBattle(winner, events);
    return true;
  }

  private finishBattle(winner: BattleResult['winner'], events: BattleEvent[]): void {
    const survivingArmy = (side: BattleSideId): ArmyStack[] => this.state.stacks
      .filter((stack) => stack.side === side && stack.count > 0)
      .map((stack) => ({ creatureId: stack.creatureId, count: Math.min(stack.initialCount, stack.count) }));
    const result: BattleResult = {
      setupId: this.setup.id,
      winner,
      attackerArmy: survivingArmy('attacker'),
      defenderArmy: survivingArmy('defender'),
      rewards: winner === 'draw'
        ? { experience: 0, resources: {} }
        : { experience: this.setup.rewards.experience, resources: { ...this.setup.rewards.resources } },
      rounds: this.state.round,
    };
    this.state.result = result;
    this.state.activeStackId = null;
    this.turnQueue = [];
    this.waitingQueue = [];
    this.log(winner === 'draw' ? 'neutral' : winner, winner === 'draw'
      ? 'The battle ends in a draw.'
      : `${winner === 'attacker' ? 'Attacker' : 'Defender'} wins the battle!`);
    events.push({ kind: 'end', result });
  }

  private finishActivation(events: BattleEvent[]): void {
    this.state.activeStackId = null;
    this.activateNext(events);
  }

  private activateNext(events: BattleEvent[]): void {
    if (this.state.result || this.state.activeStackId) return;
    while (!this.state.result) {
      let nextId = this.turnQueue.shift();
      while (nextId && (this.getStack(nextId)?.count ?? 0) <= 0) nextId = this.turnQueue.shift();
      if (!nextId) {
        if (this.waitingQueue.length > 0) {
          this.turnQueue = this.waitingQueue.reverse();
          this.waitingQueue = [];
          continue;
        }
        this.beginRound(events);
        if (this.state.result || this.state.activeStackId) return;
        continue;
      }
      const stack = this.getStack(nextId);
      if (!stack) continue;
      this.state.activeStackId = stack.id;
      stack.defending = false;
      if (getCreature(stack.creatureId).abilities.includes('regeneration') &&
        this.regeneratedRound.get(stack.id) !== this.state.round) {
        this.regeneratedRound.set(stack.id, this.state.round);
        this.applyHealing(stack, Math.max(1, Math.floor(getCreature(stack.creatureId).health * 0.1)));
      }
      return;
    }
  }

  private beginRound(events: BattleEvent[]): void {
    if (this.state.round >= this.maxRounds) {
      this.finishBattle('draw', events);
      return;
    }
    this.state.round += 1;
    for (const stack of this.state.stacks) {
      stack.waited = false;
      stack.retaliationsUsed = 0;
      if (this.state.round > 1) {
        for (const status of Object.keys(stack.statuses) as StackStatus[]) {
          const remaining = stack.statuses[status];
          if (remaining === undefined) continue;
          if (remaining <= 1) delete stack.statuses[status];
          else stack.statuses[status] = remaining - 1;
        }
      }
    }
    for (const side of ['attacker', 'defender'] as const) {
      const hero = this.getHero(side);
      if (hero) hero.castThisRound = false;
    }
    this.state.initiative = this.getLivingStacks().sort((a, b) => {
      const speed = this.getStackSpeed(b) - this.getStackSpeed(a);
      if (speed !== 0) return speed;
      if (a.side !== b.side) return a.side === 'attacker' ? -1 : 1;
      return this.state.stacks.indexOf(a) - this.state.stacks.indexOf(b);
    }).map((stack) => stack.id);
    this.turnQueue = [...this.state.initiative];
    this.waitingQueue = [];
    if (this.state.round > 1) {
      this.log('neutral', `Round ${this.state.round} begins.`);
      events.push({ kind: 'round', round: this.state.round });
    }
    this.activateNext(events);
  }

  private stackName(stack: BattleStackState): string {
    return `${getCreature(stack.creatureId).name} ×${stack.count}`;
  }

  private log(tone: CombatLogEntry['tone'], text: string): void {
    this.state.log.push({ id: this.nextLogId, round: this.state.round, text, tone });
    this.nextLogId += 1;
    if (this.state.log.length > 80) this.state.log.splice(0, this.state.log.length - 80);
  }

  private attempt<T>(action: () => T): BattleActionResult<T> {
    try {
      return { ok: true, value: action() };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  }
}
