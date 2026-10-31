import {
  addToArmy,
  armyPower,
  armySize,
  cloneArmy,
  isSurvivingArmy,
  removeFromArmy,
} from './army';
import { cloneBattleSetup, resolveBattleAutomatically } from './combat';
import {
  addResources,
  getBuilding,
  getCreature,
  RESOURCE_TYPES,
  spendResources,
} from './content';
import { updateAllFog, updateFog } from './fog';
import { getObjectAt, getTile, toTileIndex } from './map';
import { findPath, getReachableTiles } from './pathfinding';
import { parseGameState, SAVE_KEY_PREFIX, serializeGameState } from './persistence';
import { gainExperience } from './progression';
import { nextRandom } from './random';
import { createInitialGameState, HUMAN_PLAYER_ID } from './scenario';
import type {
  ArmyStack,
  BattleResult,
  BattleSetup,
  BuildingDefinition,
  DwellingObject,
  GameEvent,
  GameState,
  GameStoreOptions,
  HeroState,
  InteractionResult,
  MapObject,
  MonsterObject,
  MovementResult,
  PathResult,
  PlayerState,
  Point,
  ReachableTile,
  ResourceCost,
  StateListener,
  ActionResult,
  TownObject,
  TownState,
  TurnSummary,
} from './types';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown game action error';
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function scaleCost(cost: ResourceCost, multiplier: number): ResourceCost {
  const scaled: ResourceCost = {};
  for (const resource of RESOURCE_TYPES) {
    const amount = cost[resource];
    if (amount !== undefined) scaled[resource] = amount * multiplier;
  }
  return scaled;
}

export class GameStore {
  private state: GameState;
  private readonly listeners = new Set<StateListener>();
  private readonly storage: Storage | null;

  constructor(options: GameStoreOptions = {}) {
    this.state = createInitialGameState(options.seed);
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    if (options.autoLoad && this.storage) this.loadGame();
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  getHero(heroId: string): Readonly<HeroState> | undefined {
    return Object.hasOwn(this.state.heroes, heroId) ? this.state.heroes[heroId] : undefined;
  }

  getSelectedHero(): Readonly<HeroState> | null {
    return this.state.selectedHeroId ? this.getHero(this.state.selectedHeroId) ?? null : null;
  }

  getTown(townId: string): Readonly<TownState> | undefined {
    return Object.hasOwn(this.state.towns, townId) ? this.state.towns[townId] : undefined;
  }

  getPlayer(playerId: string): Readonly<PlayerState> | undefined {
    return Object.hasOwn(this.state.players, playerId) ? this.state.players[playerId] : undefined;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private commit(): void {
    this.state.revision += 1;
    for (const listener of this.listeners) listener(this.state);
  }

  private attempt<T>(action: () => T, notify = true): ActionResult<T> {
    try {
      const value = action();
      if (notify) this.commit();
      return { ok: true, value };
    } catch (error) {
      return { ok: false, error: errorMessage(error) };
    }
  }

  private log(kind: string, message: string): void {
    this.state.log.push({ day: this.state.calendar.day, kind, message });
    if (this.state.log.length > 100) this.state.log.splice(0, this.state.log.length - 100);
  }

  private assertPlaying(): void {
    if (this.state.phase !== 'playing') throw new Error('The game has already finished');
  }

  private requireHero(heroId: string, controlled = true): HeroState {
    const hero = this.state.heroes[heroId];
    if (!hero || !hero.alive) throw new Error(`Unknown or defeated hero: ${heroId}`);
    if (controlled && hero.ownerId !== this.state.activePlayerId) throw new Error('Hero belongs to another player');
    return hero;
  }

  private requireControlledTown(townId: string): TownState {
    const town = this.state.towns[townId];
    if (!town) throw new Error(`Unknown town: ${townId}`);
    if (town.ownerId !== this.state.activePlayerId) throw new Error('Town belongs to another player');
    return town;
  }

  private blockedByHeroes(exceptHeroId: string): Set<number> {
    const blocked = new Set<number>();
    for (const hero of Object.values(this.state.heroes)) {
      if (hero.id !== exceptHeroId && hero.alive) blocked.add(toTileIndex(this.state.map, hero.position));
    }
    return blocked;
  }

  selectHero(heroId: string): ActionResult<HeroState> {
    return this.attempt(() => {
      this.assertPlaying();
      const hero = this.requireHero(heroId);
      this.state.selectedHeroId = hero.id;
      return hero;
    });
  }

  getReachableTiles(heroId = this.state.selectedHeroId ?? ''): ReachableTile[] {
    const hero = Object.hasOwn(this.state.heroes, heroId) ? this.state.heroes[heroId] : undefined;
    if (!hero || !hero.alive || this.state.pendingBattle || this.state.phase !== 'playing') return [];
    return getReachableTiles(this.state.map, hero.position, hero.movementPoints, {
      blockedTiles: this.blockedByHeroes(hero.id),
    });
  }

  findHeroPath(heroId: string, destination: Point): PathResult | null {
    const hero = Object.hasOwn(this.state.heroes, heroId) ? this.state.heroes[heroId] : undefined;
    if (!hero || !hero.alive) return null;
    return findPath(this.state.map, hero.position, destination, {
      maxCost: hero.movementPoints,
      blockedTiles: this.blockedByHeroes(hero.id),
    });
  }

  private removeObject(object: MapObject): void {
    delete this.state.map.objects[object.id];
    const tile = getTile(this.state.map, object.position);
    if (tile?.objectId === object.id) tile.objectId = null;
  }

  private buildBattleSetup(hero: HeroState, object: MonsterObject | TownObject): BattleSetup {
    if (hero.position.x !== object.position.x || hero.position.y !== object.position.y) {
      throw new Error('Hero must be on the encounter tile');
    }
    if (object.kind === 'monster') {
      return {
        id: `battle:${hero.id}:${object.id}:${this.state.calendar.day}:${this.state.revision}`,
        seed: `${this.state.seed}:${this.state.rngState}:${hero.id}:${object.id}`,
        source: { heroId: hero.id, objectId: object.id, kind: 'monster' },
        attacker: {
          ownerId: hero.ownerId,
          heroId: hero.id,
          primarySkills: { ...hero.primarySkills },
          army: cloneArmy(hero.army),
        },
        defender: {
          ownerId: 'neutral',
          heroId: null,
          primarySkills: { attack: 0, defense: 0, spellPower: 0, knowledge: 0 },
          army: cloneArmy(object.army),
        },
        rewards: { experience: object.experienceReward, resources: { ...object.treasure } },
      };
    }
    const town = this.state.towns[object.townId];
    if (!town) throw new Error(`Unknown town: ${object.townId}`);
    if (town.ownerId === hero.ownerId) throw new Error('Cannot attack a friendly town');
    return {
      id: `battle:${hero.id}:${object.id}:${this.state.calendar.day}:${this.state.revision}`,
      seed: `${this.state.seed}:${this.state.rngState}:${hero.id}:${object.id}`,
      source: { heroId: hero.id, objectId: object.id, kind: 'town' },
      attacker: {
        ownerId: hero.ownerId,
        heroId: hero.id,
        primarySkills: { ...hero.primarySkills },
        army: cloneArmy(hero.army),
      },
      defender: {
        ownerId: town.ownerId,
        heroId: null,
        primarySkills: { attack: 1, defense: 4, spellPower: 0, knowledge: 0 },
        army: cloneArmy(town.garrison),
      },
      rewards: { experience: 1000, resources: { gold: 1000 } },
    };
  }

  private initiateBattleInternal(hero: HeroState, object: MonsterObject | TownObject): BattleSetup {
    if (this.state.pendingBattle) throw new Error('Another battle is awaiting resolution');
    if (armySize(hero.army) === 0) throw new Error('A hero without an army cannot attack');
    const setup = this.buildBattleSetup(hero, object);
    this.state.rngState = nextRandom(this.state.rngState).state;
    this.state.pendingBattle = setup;
    this.log('battle', `${hero.name} engages ${object.name}.`);
    return setup;
  }

  private interactInternal(hero: HeroState): InteractionResult {
    const object = getObjectAt(this.state.map, hero.position);
    if (!object) return { kind: 'none', message: 'There is nothing to interact with here.' };
    const player = this.state.players[hero.ownerId];
    if (!player) throw new Error(`Unknown player: ${hero.ownerId}`);
    if (object.kind === 'resource') {
      addResources(player.resources, object.resources);
      this.removeObject(object);
      gainExperience(hero, 50);
      this.log('pickup', `${hero.name} collects ${object.name}.`);
      return { kind: 'resource', message: `${object.name} collected.`, resources: { ...object.resources } };
    }
    if (object.kind === 'mine') {
      object.ownerId = hero.ownerId;
      this.log('mine', `${player.name} claims ${object.name}.`);
      return { kind: 'mine', message: `${object.name} now belongs to ${player.name}.`, ownerId: hero.ownerId };
    }
    if (object.kind === 'dwelling') {
      return { kind: 'dwelling', message: `${object.name} offers recruits.`, dwellingId: object.id };
    }
    if (object.kind === 'monster') {
      const setup = this.initiateBattleInternal(hero, object);
      return { kind: 'battle', message: `Battle with ${object.name}.`, setup };
    }
    const town = this.state.towns[object.townId];
    if (!town) throw new Error(`Unknown town: ${object.townId}`);
    if (town.ownerId !== hero.ownerId) {
      const setup = this.initiateBattleInternal(hero, object);
      return { kind: 'battle', message: `Siege of ${town.name}.`, setup };
    }
    return { kind: 'town', message: `Welcome to ${town.name}.`, townId: town.id };
  }

  private moveHeroInternal(heroId: string, destination: Point): MovementResult {
    this.assertPlaying();
    if (this.state.pendingBattle) throw new Error('Resolve the pending battle before moving');
    const hero = this.requireHero(heroId);
    const path = findPath(this.state.map, hero.position, destination, {
      maxCost: hero.movementPoints,
      blockedTiles: this.blockedByHeroes(hero.id),
    });
    if (!path || path.path.length < 2) throw new Error('Destination is not reachable with remaining movement points');
    const destinationObject = getObjectAt(this.state.map, destination);
    const hostileTown = destinationObject?.kind === 'town' &&
      this.state.towns[destinationObject.townId]?.ownerId !== hero.ownerId;
    if ((destinationObject?.kind === 'monster' || hostileTown) && armySize(hero.army) === 0) {
      throw new Error('A hero without an army cannot attack');
    }
    const previousPosition = hero.position;
    const previousMovementPoints = hero.movementPoints;
    hero.position = { ...destination };
    hero.movementPoints -= path.cost;
    let interaction: InteractionResult;
    try {
      interaction = this.interactInternal(hero);
    } catch (error) {
      hero.position = previousPosition;
      hero.movementPoints = previousMovementPoints;
      throw error;
    }
    updateFog(this.state, hero.ownerId);
    return {
      heroId,
      path: path.path,
      cost: path.cost,
      movementPoints: hero.movementPoints,
      interaction,
    };
  }

  moveHero(heroId: string, destination: Point): ActionResult<MovementResult> {
    return this.attempt(() => this.moveHeroInternal(heroId, destination));
  }

  moveSelectedHero(destination: Point): ActionResult<MovementResult> {
    if (!this.state.selectedHeroId) return { ok: false, error: 'No hero is selected' };
    return this.moveHero(this.state.selectedHeroId, destination);
  }

  interact(heroId = this.state.selectedHeroId ?? ''): ActionResult<InteractionResult> {
    return this.attempt(() => {
      this.assertPlaying();
      if (this.state.pendingBattle) throw new Error('Resolve the pending battle first');
      return this.interactInternal(this.requireHero(heroId));
    });
  }

  createBattleSetup(heroId: string, objectId: string): ActionResult<BattleSetup> {
    return this.attempt(() => {
      const hero = this.requireHero(heroId);
      const object = this.state.map.objects[objectId];
      if (!object || (object.kind !== 'monster' && object.kind !== 'town')) {
        throw new Error('Encounter must be a monster or enemy town');
      }
      return cloneBattleSetup(this.buildBattleSetup(hero, object));
    }, false);
  }

  initiateBattle(heroId: string, objectId: string): ActionResult<BattleSetup> {
    return this.attempt(() => {
      this.assertPlaying();
      const hero = this.requireHero(heroId);
      const object = this.state.map.objects[objectId];
      if (!object || (object.kind !== 'monster' && object.kind !== 'town')) {
        throw new Error('Encounter must be a monster or enemy town');
      }
      return this.initiateBattleInternal(hero, object);
    });
  }

  private validateBattleResult(result: BattleResult, setup: BattleSetup): void {
    if (result.setupId !== setup.id) throw new Error('Battle result does not match the pending setup');
    if (!['attacker', 'defender', 'draw'].includes(result.winner)) throw new Error('Invalid battle winner');
    if (!Number.isInteger(result.rounds) || result.rounds < 0) throw new Error('Invalid battle round count');
    if (!isSurvivingArmy(setup.attacker.army, result.attackerArmy)) throw new Error('Invalid attacking survivors');
    if (!isSurvivingArmy(setup.defender.army, result.defenderArmy)) throw new Error('Invalid defending survivors');
    const attackersRemain = armySize(result.attackerArmy) > 0;
    const defendersRemain = armySize(result.defenderArmy) > 0;
    const outcomeMatchesSurvivors =
      (result.winner === 'attacker' && attackersRemain && !defendersRemain) ||
      (result.winner === 'defender' && !attackersRemain && defendersRemain) ||
      (result.winner === 'draw' && attackersRemain === defendersRemain);
    if (!outcomeMatchesSurvivors) throw new Error('Battle outcome is inconsistent with surviving armies');
    if (!Number.isInteger(result.rewards.experience) || result.rewards.experience < 0) {
      throw new Error('Invalid experience reward');
    }
    for (const resource of RESOURCE_TYPES) {
      const amount = result.rewards.resources[resource];
      if (amount !== undefined && (!Number.isInteger(amount) || amount < 0)) throw new Error('Invalid resource reward');
    }
  }

  private applyBattleResultInternal(result: BattleResult): BattleResult {
    const setup = this.state.pendingBattle;
    if (!setup) throw new Error('There is no pending battle');
    this.validateBattleResult(result, setup);
    const hero = this.state.heroes[setup.attacker.heroId ?? ''];
    if (!hero) throw new Error('Attacking hero no longer exists');
    const object = this.state.map.objects[setup.source.objectId];
    if (!object || (object.kind !== 'monster' && object.kind !== 'town')) {
      throw new Error('Battle encounter no longer exists');
    }

    hero.army = result.winner === 'defender' ? [] : cloneArmy(result.attackerArmy);
    hero.alive = armySize(hero.army) > 0;
    if (object.kind === 'monster') {
      if (result.winner === 'attacker' || armySize(result.defenderArmy) === 0) this.removeObject(object);
      else object.army = cloneArmy(result.defenderArmy);
    } else {
      const town = this.state.towns[object.townId];
      if (!town) throw new Error('Town no longer exists');
      if (result.winner === 'attacker') {
        town.ownerId = hero.ownerId;
        town.garrison = [];
        this.log('conquest', `${hero.name} captures ${town.name}.`);
      } else {
        town.garrison = cloneArmy(result.defenderArmy);
      }
    }

    if (result.winner !== 'draw') {
      const winningSide = result.winner === 'attacker' ? setup.attacker : setup.defender;
      const winningHero = winningSide.heroId ? this.state.heroes[winningSide.heroId] : undefined;
      if (winningHero) {
        const levels = gainExperience(winningHero, result.rewards.experience);
        if (levels > 0) this.log('level', `${winningHero.name} reaches level ${winningHero.level}.`);
      }
      const winningPlayer = this.state.players[winningSide.ownerId];
      if (winningPlayer) addResources(winningPlayer.resources, result.rewards.resources);
    }

    this.state.pendingBattle = null;
    if (!hero.alive && this.state.selectedHeroId === hero.id) {
      this.state.selectedHeroId = Object.values(this.state.heroes).find((candidate) =>
        candidate.ownerId === hero.ownerId && candidate.alive)?.id ?? null;
    }
    this.log('battle', `${hero.name}'s battle ends: ${result.winner}.`);
    updateAllFog(this.state);
    this.checkVictory();
    return result;
  }

  applyBattleResult(result: BattleResult): ActionResult<BattleResult> {
    return this.attempt(() => this.applyBattleResultInternal(result));
  }

  resolveBattleAutomatically(): ActionResult<BattleResult> {
    return this.attempt(() => {
      if (!this.state.pendingBattle) throw new Error('There is no pending battle');
      return this.applyBattleResultInternal(resolveBattleAutomatically(this.state.pendingBattle));
    });
  }

  constructBuilding(townId: string, buildingId: string): ActionResult<TownState> {
    return this.attempt(() => {
      this.assertPlaying();
      const town = this.requireControlledTown(townId);
      const building = getBuilding(buildingId);
      if (town.builtToday) throw new Error('This town has already constructed a building today');
      if (town.buildings.includes(buildingId)) throw new Error('Building is already constructed');
      if (building.creatureId && getCreature(building.creatureId).faction !== town.faction) {
        throw new Error(`${building.name} belongs to the ${getCreature(building.creatureId).faction} faction`);
      }
      const missing = building.prerequisites.filter((prerequisite) => !town.buildings.includes(prerequisite));
      if (missing.length > 0) throw new Error(`Missing prerequisites: ${missing.join(', ')}`);
      const player = this.state.players[town.ownerId];
      if (!player || !spendResources(player.resources, building.cost)) throw new Error('Insufficient resources');
      town.buildings.push(buildingId);
      town.builtToday = true;
      if (building.creatureId) {
        town.dwellingPools[building.creatureId] =
          (town.dwellingPools[building.creatureId] ?? 0) + getCreature(building.creatureId).growth;
      }
      this.log('construction', `${town.name} completes ${building.name}.`);
      return town;
    });
  }

  private findTownDwelling(town: TownState, creatureId: string): BuildingDefinition {
    const building = this.buildingForCreature(town, creatureId);
    if (!building) throw new Error('The required creature dwelling has not been built');
    return building;
  }

  private buildingForCreature(town: TownState, creatureId: string): BuildingDefinition | undefined {
    return town.buildings
      .map((buildingId) => getBuilding(buildingId))
      .find((building) => building.creatureId === creatureId);
  }

  recruitCreature(townId: string, creatureId: string, count: number): ActionResult<TownState> {
    return this.attempt(() => {
      this.assertPlaying();
      const town = this.requireControlledTown(townId);
      if (!Number.isInteger(count) || count <= 0) throw new Error('Recruitment count must be a positive integer');
      this.findTownDwelling(town, creatureId);
      const available = town.dwellingPools[creatureId] ?? 0;
      if (available < count) throw new Error('Not enough creatures are available');
      const player = this.state.players[town.ownerId];
      const cost = scaleCost(getCreature(creatureId).cost, count);
      const nextGarrison = cloneArmy(town.garrison);
      if (!addToArmy(nextGarrison, creatureId, count)) throw new Error('The garrison has no free army slots');
      if (!player || !spendResources(player.resources, cost)) throw new Error('Insufficient resources');
      town.garrison = nextGarrison;
      town.dwellingPools[creatureId] = available - count;
      this.log('recruitment', `${town.name} recruits ${count} ${getCreature(creatureId).name}.`);
      return town;
    });
  }

  private recruitFromDwellingInternal(hero: HeroState, dwelling: DwellingObject, count: number): HeroState {
    if (hero.position.x !== dwelling.position.x || hero.position.y !== dwelling.position.y) {
      throw new Error('Hero must visit the dwelling to recruit');
    }
    if (!Number.isInteger(count) || count <= 0) throw new Error('Recruitment count must be a positive integer');
    if (dwelling.available < count) throw new Error('Not enough creatures are available');
    const player = this.state.players[hero.ownerId];
    const cost = scaleCost(getCreature(dwelling.creatureId).cost, count);
    const nextArmy = cloneArmy(hero.army);
    if (!addToArmy(nextArmy, dwelling.creatureId, count)) throw new Error('The hero has no free army slots');
    if (!player || !spendResources(player.resources, cost)) throw new Error('Insufficient resources');
    hero.army = nextArmy;
    dwelling.available -= count;
    this.log('recruitment', `${hero.name} recruits at ${dwelling.name}.`);
    return hero;
  }

  recruitFromDwelling(heroId: string, dwellingId: string, count: number): ActionResult<HeroState> {
    return this.attempt(() => {
      this.assertPlaying();
      const hero = this.requireHero(heroId);
      const dwelling = this.state.map.objects[dwellingId];
      if (!dwelling || dwelling.kind !== 'dwelling') throw new Error('Unknown adventure dwelling');
      return this.recruitFromDwellingInternal(hero, dwelling, count);
    });
  }

  transferCreatures(
    heroId: string,
    townId: string,
    creatureId: string,
    count: number,
    direction: 'toHero' | 'toGarrison',
  ): ActionResult<{ heroArmy: ArmyStack[]; garrison: ArmyStack[] }> {
    return this.attempt(() => {
      this.assertPlaying();
      const hero = this.requireHero(heroId);
      const town = this.requireControlledTown(townId);
      if (hero.position.x !== town.position.x || hero.position.y !== town.position.y) {
        throw new Error('Hero must be inside the town');
      }
      const source = direction === 'toHero' ? town.garrison : hero.army;
      const target = direction === 'toHero' ? hero.army : town.garrison;
      const nextSource = cloneArmy(source);
      const nextTarget = cloneArmy(target);
      if (!removeFromArmy(nextSource, creatureId, count)) throw new Error('Not enough creatures in the source army');
      if (!addToArmy(nextTarget, creatureId, count)) throw new Error('The destination has no free army slots');
      if (direction === 'toHero') {
        town.garrison = nextSource;
        hero.army = nextTarget;
      } else {
        hero.army = nextSource;
        town.garrison = nextTarget;
      }
      return { heroArmy: cloneArmy(hero.army), garrison: cloneArmy(town.garrison) };
    });
  }

  private startNewDay(): void {
    const day = this.state.calendar.day + 1;
    this.state.calendar = {
      day,
      dayOfWeek: ((day - 1) % 7) + 1,
      week: Math.floor((day - 1) / 7) + 1,
      month: Math.floor((day - 1) / 28) + 1,
    };
    for (const town of Object.values(this.state.towns)) town.builtToday = false;

    for (const playerId of this.state.playerOrder) {
      const player = this.state.players[playerId];
      if (!player) continue;
      for (const town of Object.values(this.state.towns)) {
        if (town.ownerId !== playerId) continue;
        for (const buildingId of town.buildings) {
          const income = getBuilding(buildingId).dailyIncome;
          if (income) addResources(player.resources, income);
        }
      }
      for (const object of Object.values(this.state.map.objects)) {
        if (object.kind === 'mine' && object.ownerId === playerId) {
          addResources(player.resources, { [object.resource]: object.dailyOutput });
        }
      }
    }

    if (this.state.calendar.dayOfWeek === 1) {
      for (const town of Object.values(this.state.towns)) {
        for (const buildingId of town.buildings) {
          const building = getBuilding(buildingId);
          if (!building.creatureId) continue;
          town.dwellingPools[building.creatureId] =
            (town.dwellingPools[building.creatureId] ?? 0) + getCreature(building.creatureId).growth;
        }
      }
      for (const object of Object.values(this.state.map.objects)) {
        if (object.kind === 'dwelling') object.available += getCreature(object.creatureId).growth;
      }
      this.log('week', `Week ${this.state.calendar.week} brings new creature growth.`);
    }
    this.log('day', `Day ${day} begins.`);
  }

  private restorePlayer(playerId: string): void {
    for (const hero of Object.values(this.state.heroes)) {
      if (hero.ownerId !== playerId || !hero.alive) continue;
      hero.movementPoints = hero.maxMovementPoints;
      hero.mana = hero.maxMana;
    }
  }

  private aiTargetScore(object: MapObject): number {
    if (object.kind === 'resource') return 0;
    if (object.kind === 'mine') return 1;
    if (object.kind === 'monster') return 2;
    if (object.kind === 'dwelling') return 3;
    return 100;
  }

  private runAiTurnInternal(playerId: string): GameEvent[] {
    const firstLogEntry = this.state.log.length;
    const heroes = Object.values(this.state.heroes).filter((hero) => hero.ownerId === playerId && hero.alive);
    for (const hero of heroes) {
      for (let move = 0; move < 4 && hero.alive && this.state.phase === 'playing'; move += 1) {
        if (this.state.pendingBattle) {
          this.applyBattleResultInternal(resolveBattleAutomatically(this.state.pendingBattle));
          continue;
        }
        const reachable = this.getReachableTiles(hero.id);
        const reachableByIndex = new Map(reachable.map((tile) => [tile.tileIndex, tile]));
        const targets = Object.values(this.state.map.objects).filter((object) => {
          if (object.kind === 'resource') return true;
          if (object.kind === 'mine') return object.ownerId !== playerId;
          if (object.kind === 'dwelling') return object.available > 0;
          if (object.kind === 'monster') return armyPower(hero.army) >= armyPower(object.army) * 0.75;
          return false;
        }).sort((a, b) => {
          const score = this.aiTargetScore(a) - this.aiTargetScore(b);
          if (score !== 0) return score;
          const distanceA = Math.abs(a.position.x - hero.position.x) + Math.abs(a.position.y - hero.position.y);
          const distanceB = Math.abs(b.position.x - hero.position.x) + Math.abs(b.position.y - hero.position.y);
          return distanceA - distanceB || a.id.localeCompare(b.id);
        });
        const target = targets[0];
        if (!target) break;
        const direct = reachableByIndex.get(toTileIndex(this.state.map, target.position));
        let destination = direct && direct.cost > 0 ? direct.position : undefined;
        if (!destination) {
          const candidates = reachable.filter((tile) => tile.cost > 0).sort((a, b) => {
            const distanceA = Math.abs(a.position.x - target.position.x) + Math.abs(a.position.y - target.position.y);
            const distanceB = Math.abs(b.position.x - target.position.x) + Math.abs(b.position.y - target.position.y);
            return distanceA - distanceB || a.cost - b.cost || a.tileIndex - b.tileIndex;
          });
          destination = candidates[0]?.position;
        }
        if (!destination) break;
        const before = hero.position;
        if (before.x === destination.x && before.y === destination.y) break;
        const movement = this.moveHeroInternal(hero.id, destination);
        if (movement.interaction.kind === 'dwelling') {
          const dwelling = this.state.map.objects[movement.interaction.dwellingId];
          if (dwelling?.kind === 'dwelling' && dwelling.available > 0) {
            const affordableCount = Math.min(dwelling.available, 5);
            try {
              this.recruitFromDwellingInternal(hero, dwelling, affordableCount);
            } catch {
              break;
            }
          }
        }
        if (this.state.pendingBattle) this.applyBattleResultInternal(resolveBattleAutomatically(this.state.pendingBattle));
      }
    }
    return this.state.log.slice(firstLogEntry);
  }

  runAiTurn(playerId = this.state.activePlayerId): ActionResult<GameEvent[]> {
    return this.attempt(() => {
      this.assertPlaying();
      if (this.state.pendingBattle) throw new Error('Resolve the pending battle first');
      if (playerId !== this.state.activePlayerId || !this.state.players[playerId]?.isAI) {
        throw new Error('The requested player cannot take an AI turn');
      }
      return this.runAiTurnInternal(playerId);
    });
  }

  endTurn(): ActionResult<TurnSummary> {
    return this.attempt(() => {
      this.assertPlaying();
      if (this.state.pendingBattle) throw new Error('Resolve the pending battle before ending the turn');
      const firstLogEntry = this.state.log.length;
      let index = this.state.playerOrder.indexOf(this.state.activePlayerId);
      if (index < 0) throw new Error('Active player is missing from turn order');
      for (let steps = 0; steps < this.state.playerOrder.length * 2; steps += 1) {
        index += 1;
        if (index >= this.state.playerOrder.length) {
          index = 0;
          this.startNewDay();
        }
        const playerId = this.state.playerOrder[index];
        if (!playerId) break;
        this.state.activePlayerId = playerId;
        this.restorePlayer(playerId);
        const player = this.state.players[playerId];
        if (!player) throw new Error(`Unknown player: ${playerId}`);
        if (player.isAI) {
          this.runAiTurnInternal(playerId);
          if (this.state.phase !== 'playing') break;
          continue;
        }
        break;
      }
      updateAllFog(this.state);
      this.checkVictory();
      return {
        calendar: { ...this.state.calendar },
        events: this.state.log.slice(firstLogEntry),
      };
    });
  }

  private checkVictory(): void {
    const contenders = this.state.playerOrder.filter((playerId) => {
      const hasTown = Object.values(this.state.towns).some((town) => town.ownerId === playerId);
      const hasHero = Object.values(this.state.heroes).some((hero) => hero.ownerId === playerId && hero.alive);
      return hasTown || hasHero;
    });
    if (contenders.length === 1 && this.state.playerOrder.length > 1) {
      const winnerId = contenders[0] ?? null;
      this.state.winnerId = winnerId;
      this.state.phase = winnerId === HUMAN_PLAYER_ID ? 'victory' : 'defeat';
      this.log('victory', winnerId ? `${this.state.players[winnerId]?.name ?? winnerId} wins the scenario.` : 'Scenario complete.');
    }
  }

  newGame(seed = this.state.seed): ActionResult<Readonly<GameState>> {
    this.state = createInitialGameState(seed);
    this.commit();
    return { ok: true, value: this.state };
  }

  saveGame(slot = 'autosave'): ActionResult<string> {
    if (!this.storage) return { ok: false, error: 'Local storage is unavailable' };
    if (!/^[\w-]+$/.test(slot)) return { ok: false, error: 'Invalid save slot' };
    try {
      const key = `${SAVE_KEY_PREFIX}${slot}`;
      this.storage.setItem(key, serializeGameState(this.state));
      return { ok: true, value: key };
    } catch (error) {
      return { ok: false, error: `Unable to save game: ${errorMessage(error)}` };
    }
  }

  loadGame(slot = 'autosave'): ActionResult<Readonly<GameState>> {
    if (!this.storage) return { ok: false, error: 'Local storage is unavailable' };
    if (!/^[\w-]+$/.test(slot)) return { ok: false, error: 'Invalid save slot' };
    try {
      const serialized = this.storage.getItem(`${SAVE_KEY_PREFIX}${slot}`);
      if (!serialized) return { ok: false, error: 'No saved game exists in this slot' };
      return this.loadSerialized(serialized);
    } catch (error) {
      return { ok: false, error: `Unable to load game: ${errorMessage(error)}` };
    }
  }

  loadSerialized(serialized: string): ActionResult<Readonly<GameState>> {
    return this.attempt(() => {
      this.state = parseGameState(serialized);
      return this.state;
    });
  }

  hasSavedGame(slot = 'autosave'): boolean {
    if (!this.storage || !/^[\w-]+$/.test(slot)) return false;
    try {
      return this.storage.getItem(`${SAVE_KEY_PREFIX}${slot}`) !== null;
    } catch {
      return false;
    }
  }
}
