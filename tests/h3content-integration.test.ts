import { afterEach, describe, expect, it } from 'vitest';
import {
  BattleEngine,
  chooseAiSpell,
  performAiTurn,
  runTacticalAutoBattle,
} from '../src/battle';
import {
  ContentEditorStore,
  createCustomContentBattleHooks,
  disposeCustomContentModel,
} from '../src/editor';
import {
  ARTIFACT_LIST,
  CREATURES,
  EXPANDED_SPELL_LIST,
  EXTENDED_RESOURCE_TYPES,
  GameStore,
  NEW_RESOURCES,
  NEW_RESOURCE_TYPES,
  addArtifact,
  createAdventureMap,
  createArtifactInventory,
  createDefaultSpellbook,
  createInitialGameState,
  equipArtifact,
  getArtifactCount,
  getCreature,
  getEffectivePrimarySkills,
  getHeroMaxMana,
  getReachableTiles,
  isGameState,
  parseGameState,
  registerCustomArtifacts,
  registerCustomCreatures,
  serializeGameState,
  toTileIndex,
} from '../src/game';
import type { BattleSetup, ExpandedSpellId, GameState } from '../src/game';
import { RESOURCE_META } from '../src/ui/format';
import { resourceIcon } from '../src/ui/icons';
import { createSandboxBattleSetup } from '../src/integration/GameApplication';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function mutableState(store: GameStore): GameState {
  return store.getState() as GameState;
}

function spellSetup(spellId: ExpandedSpellId, attackerMana = 60): BattleSetup {
  return {
    id: `expanded-${spellId}`,
    seed: `expanded-${spellId}-seed`,
    source: { heroId: 'attacker-hero', objectId: 'expanded-target', kind: 'monster' },
    attacker: {
      ownerId: 'red', heroId: 'attacker-hero',
      primarySkills: { attack: 0, defense: 0, spellPower: 2, knowledge: 6 },
      army: [{ creatureId: 'dragon', count: 4 }, { creatureId: 'militia', count: 5 }],
      spells: [spellId, 'magicArrow'], mana: attackerMana, maxMana: 60,
    },
    defender: {
      ownerId: 'blue', heroId: 'defender-hero',
      primarySkills: { attack: 0, defense: 0, spellPower: 0, knowledge: 4 },
      army: [{ creatureId: 'militia', count: 20 }, { creatureId: 'archer', count: 10 }],
      spells: ['magicArrow'], mana: 30, maxMana: 40,
    },
    rewards: { experience: 0, resources: {} },
  };
}

function spellEngine(spellId: ExpandedSpellId, attackerMana = 60): BattleEngine {
  return new BattleEngine(spellSetup(spellId, attackerMana), {
    obstacles: [],
    attackerPositions: [{ x: 1, y: 5 }, { x: 1, y: 2 }],
    defenderPositions: [{ x: 13, y: 5 }, { x: 13, y: 8 }],
  });
}

function selectedTarget(spellId: ExpandedSpellId): string | undefined {
  if (spellId === 'stormRelay') return 'defender:0';
  if (spellId === 'graniteAegis' || spellId === 'fountainOfLife') return 'attacker:0';
  return undefined;
}

afterEach(() => {
  registerCustomCreatures([]);
  registerCustomArtifacts([]);
});

describe('all twelve expanded spells in real tactical combat', () => {
  it.each(EXPANDED_SPELL_LIST)('$id spends mana, emits combat events, and enforces one cast per round', (spell) => {
    const mana = spell.id === 'spiritChannel' || spell.id === 'manaSiphon' ? 30 : 60;
    const engine = spellEngine(spell.id, mana);
    const wounded = engine.getStack('attacker:0')!;
    const secondWounded = engine.getStack('attacker:1')!;
    if (spell.id === 'fountainOfLife') wounded.topHealth = 20;
    if (spell.id === 'tidalRenewal') {
      wounded.topHealth = 20;
      secondWounded.topHealth = 2;
    }
    const result = engine.castSpell(spell.id, 'attacker', selectedTarget(spell.id));
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    if (!result.ok) return;
    const event = result.value.find((entry) => entry.kind === 'spell');
    expect(event).toMatchObject({ kind: 'spell', spellId: spell.id, side: 'attacker' });
    expect(engine.getHero('attacker')?.mana).toBe(mana - spell.manaCost +
      (spell.id === 'spiritChannel' ? 12 : spell.id === 'manaSiphon' ? 12 : 0));
    expect(engine.getHero('attacker')?.castThisRound).toBe(true);
    expect(engine.getActiveStack()?.id).toBe('attacker:0');
    expect(engine.getState().log.some((entry) => entry.text.includes(spell.name))).toBe(true);
    expect(engine.castSpell('magicArrow', 'attacker', 'defender:0').ok).toBe(false);
  });

  it('chains Storm Relay to the nearest unhit enemy with falloff', () => {
    const engine = spellEngine('stormRelay');
    const result = engine.castSpell('stormRelay', 'attacker', 'defender:0');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const event = result.value.find((entry) => entry.kind === 'spell');
    expect(event?.kind === 'spell' && event.targetIds).toEqual(['defender:0', 'defender:1']);
    expect(event?.kind === 'spell' && event.amounts).toMatchObject({ 'defender:0': 48, 'defender:1': 33 });
    expect(engine.getStackHealth(engine.getStack('defender:0')!)).toBe(160 - 48);
    expect(engine.getStackHealth(engine.getStack('defender:1')!)).toBe(100 - 33);
  });

  it('applies mass damage to the correct sides', () => {
    const quake = spellEngine('quakePulse');
    const attackerHealth = quake.getStackHealth(quake.getStack('attacker:0')!);
    const defenderHealth = quake.getStackHealth(quake.getStack('defender:0')!);
    expect(quake.castSpell('quakePulse', 'attacker').ok).toBe(true);
    expect(quake.getStackHealth(quake.getStack('attacker:0')!)).toBe(attackerHealth - 16);
    expect(quake.getStackHealth(quake.getStack('defender:0')!)).toBe(defenderHealth - 32);

    const ember = spellEngine('emberVolley');
    const allyHealth = ember.getStackHealth(ember.getStack('attacker:0')!);
    expect(ember.castSpell('emberVolley', 'attacker').ok).toBe(true);
    expect(ember.getStackHealth(ember.getStack('defender:0')!)).toBe(160 - 30);
    expect(ember.getStackHealth(ember.getStack('defender:1')!)).toBe(100 - 30);
    expect(ember.getStackHealth(ember.getStack('attacker:0')!)).toBe(allyHealth);
  });

  it('advances to a living activation when Quake Pulse defeats the caster’s active stack', () => {
    const engine = spellEngine('quakePulse');
    const active = engine.getStack('attacker:0')!;
    active.count = 1;
    active.topHealth = 1;
    expect(engine.castSpell('quakePulse', 'attacker').ok).toBe(true);
    expect(active.count).toBe(0);
    expect(engine.getResult()).toBeNull();
    expect(engine.getActiveStack()?.count).toBeGreaterThan(0);
    expect(performAiTurn(engine).ok).toBe(true);
  });

  it('applies expanded attack, defense, speed, and mitigation modifiers', () => {
    const tailwind = spellEngine('tailwind');
    const speed = tailwind.getStackSpeed(tailwind.getStack('attacker:0')!);
    expect(tailwind.castSpell('tailwind', 'attacker').ok).toBe(true);
    expect(tailwind.getStackSpeed(tailwind.getStack('attacker:0')!)).toBe(speed + 2);
    expect(tailwind.getStackSpeed(tailwind.getStack('attacker:1')!)).toBe(6);

    const fervor = spellEngine('battleFervor');
    const attack = fervor.getStackAttack(fervor.getStack('attacker:0')!);
    expect(fervor.castSpell('battleFervor', 'attacker').ok).toBe(true);
    expect(fervor.getStackAttack(fervor.getStack('attacker:0')!)).toBe(attack + 3);

    const mire = spellEngine('mireHex');
    const defender = mire.getStack('defender:0')!;
    const mireAttack = mire.getStackAttack(defender);
    const mireSpeed = mire.getStackSpeed(defender);
    expect(mire.castSpell('mireHex', 'attacker').ok).toBe(true);
    expect(mire.getStackAttack(defender)).toBe(mireAttack - 3);
    expect(mire.getStackSpeed(defender)).toBe(mireSpeed - 1);

    const granite = spellEngine('graniteAegis');
    const protectedStack = granite.getStack('attacker:0')!;
    const defense = granite.getStackDefense(protectedStack);
    expect(granite.castSpell('graniteAegis', 'attacker', protectedStack.id).ok).toBe(true);
    expect(granite.getStackDefense(protectedStack)).toBe(defense + 5);
    expect(granite.defend().ok).toBe(true);
    expect(granite.getActiveStack()?.side).toBe('defender');
    const before = granite.getStackHealth(protectedStack);
    expect(granite.castSpell('magicArrow', 'defender', protectedStack.id).ok).toBe(true);
    expect(before - granite.getStackHealth(protectedStack)).toBe(5);
  });

  it('burns, drains, and restores hero mana with exact post-cost caps', () => {
    const burn = spellEngine('staticDisruption');
    expect(burn.castSpell('staticDisruption', 'attacker').ok).toBe(true);
    expect(burn.getHero('defender')?.mana).toBe(20);
    expect(burn.getHero('attacker')?.mana).toBe(53);

    const drain = spellEngine('manaSiphon', 30);
    expect(drain.castSpell('manaSiphon', 'attacker').ok).toBe(true);
    expect(drain.getHero('defender')?.mana).toBe(18);
    expect(drain.getHero('attacker')?.mana).toBe(33);

    const restore = spellEngine('spiritChannel', 30);
    expect(restore.castSpell('spiritChannel', 'attacker').ok).toBe(true);
    expect(restore.getHero('attacker')?.mana).toBe(37);
  });

  it('heals wounded allies and revives only an eligible fallen stack', () => {
    const fountain = spellEngine('fountainOfLife');
    const wounded = fountain.getStack('attacker:0')!;
    wounded.topHealth = 20;
    expect(fountain.castSpell('fountainOfLife', 'attacker', wounded.id).ok).toBe(true);
    expect(wounded.topHealth).toBe(80);

    const revival = spellEngine('fountainOfLife');
    const fallen = revival.getStack('attacker:1')!;
    fallen.count = 0;
    fallen.topHealth = 0;
    const result = revival.castSpell('fountainOfLife', 'attacker', fallen.id);
    expect(result.ok, result.ok ? '' : result.error).toBe(true);
    expect(fallen.count).toBe(5);
    expect(fallen.topHealth).toBe(8);

    const tidal = spellEngine('tidalRenewal');
    const first = tidal.getStack('attacker:0')!;
    const second = tidal.getStack('attacker:1')!;
    first.topHealth = 20;
    second.topHealth = 2;
    expect(tidal.castSpell('tidalRenewal', 'attacker').ok).toBe(true);
    expect(first.topHealth).toBe(46);
    expect(second.topHealth).toBe(8);
  });

  it('expires expanded statuses and renews the hero cast on a new round', () => {
    const engine = spellEngine('tailwind');
    expect(engine.castSpell('tailwind', 'attacker').ok).toBe(true);
    let guards = 0;
    while (engine.getState().round === 1 && guards < 10) {
      expect(engine.defend().ok).toBe(true);
      guards += 1;
    }
    expect(engine.getState().round).toBe(2);
    expect(engine.getStack('attacker:0')?.expandedStatuses?.tailwind?.duration).toBe(2);
    expect(engine.getHero('attacker')?.castThisRound).toBe(false);
  });
});

describe('expanded tactical AI and campaign battle persistence', () => {
  it('chooses and executes a valid expanded spell before the stack action', () => {
    const engine = spellEngine('manaSiphon', 30);
    const hero = engine.getHero('attacker')!;
    hero.spells = ['manaSiphon'];
    const decision = chooseAiSpell(engine, 'attacker');
    expect(decision).toEqual({ spellId: 'manaSiphon', targetId: undefined });
    const result = performAiTurn(engine);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.some((event) => event.kind === 'spell' && event.spellId === 'manaSiphon')).toBe(true);
    expect(hero.castThisRound).toBe(true);
    expect(result.value.some((event) => event.kind === 'attack' || event.kind === 'defend' || event.kind === 'move')).toBe(true);
  });

  it('stops after self-Quake instead of acting for the next human stack', () => {
    const setup = spellSetup('quakePulse');
    setup.attacker.army = [
      { creatureId: 'militia', count: 20 },
      { creatureId: 'archer', count: 10 },
      { creatureId: 'militia', count: 20 },
      { creatureId: 'archer', count: 10 },
    ];
    setup.attacker.spells = [];
    setup.attacker.mana = 0;
    setup.attacker.maxMana = 0;
    setup.defender.army = [{ creatureId: 'dragon', count: 1 }, { creatureId: 'militia', count: 20 }];
    setup.defender.primarySkills = { attack: 0, defense: 0, spellPower: 6, knowledge: 6 };
    setup.defender.spells = ['quakePulse'];
    setup.defender.mana = 60;
    setup.defender.maxMana = 60;
    const engine = new BattleEngine(setup, {
      obstacles: [],
      attackerPositions: [{ x: 1, y: 5 }, { x: 1, y: 2 }, { x: 1, y: 8 }, { x: 1, y: 0 }],
      defenderPositions: [{ x: 13, y: 5 }, { x: 13, y: 8 }],
    });
    const original = engine.getActiveStack();
    expect(original?.id).toBe('defender:0');
    original!.topHealth = 1;
    const result = performAiTurn(engine);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((event) => event.kind)).toEqual(['spell']);
    expect(original!.count).toBe(0);
    expect(engine.getResult()).toBeNull();
    expect(engine.getActiveStack()?.id).toBe('attacker:1');
    expect(engine.getActiveStack()?.side).toBe('attacker');
  });

  it('returns remaining tactical mana through a real store result and save/load', () => {
    const store = new GameStore({ seed: 'expanded-result-save', storage: null });
    const state = mutableState(store);
    const hero = state.heroes['hero-aveline']!;
    const monster = state.map.objects['monster-west']!;
    hero.position = { ...monster.position };
    const initiated = store.initiateBattle(hero.id, monster.id);
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;
    expect(initiated.value.attacker.spells).toEqual(createDefaultSpellbook());
    const restoredPending = new GameStore({ storage: null });
    expect(restoredPending.loadSerialized(serializeGameState(state)).ok).toBe(true);
    const pending = restoredPending.getState().pendingBattle;
    expect(pending?.attacker.mana).toBe(hero.mana);
    expect(pending?.attacker.spells).toEqual(hero.spells);

    const result = runTacticalAutoBattle(pending!).getResult();
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.attackerMana).toBeTypeOf('number');
    expect(restoredPending.applyBattleResult(result).ok).toBe(true);
    const resultingHero = restoredPending.getState().heroes[hero.id]!;
    expect(resultingHero.mana).toBe(result.attackerMana);
    const restored = new GameStore({ storage: null });
    expect(restored.loadSerialized(serializeGameState(restoredPending.getState())).ok).toBe(true);
    expect(restored.getState().heroes[hero.id]?.mana).toBe(result.attackerMana);
  });
});

describe('extended resource economy and validation', () => {
  it.each(NEW_RESOURCE_TYPES)('%s has a real pickup and daily mine', (resource) => {
    const store = new GameStore({ seed: `resource-${resource}`, storage: null });
    const state = mutableState(store);
    const hero = state.heroes['hero-aveline']!;
    const player = state.players.red!;
    const pickup = state.map.objects[`${resource}-cache`]!;
    expect(pickup.kind).toBe('resource');
    if (pickup.kind !== 'resource') return;
    const amount = pickup.resources[resource]!;
    expect(amount).toBeGreaterThanOrEqual(NEW_RESOURCES[resource].pickupRange[0]);
    expect(amount).toBeLessThanOrEqual(NEW_RESOURCES[resource].pickupRange[1]);
    const before = player.resources[resource];
    hero.position = { ...pickup.position };
    const collected = store.interact(hero.id);
    expect(collected.ok).toBe(true);
    expect(player.resources[resource]).toBe(before + amount);
    expect(state.map.objects[pickup.id]).toBeUndefined();

    const mine = state.map.objects[`${resource}-mine`]!;
    expect(mine.kind).toBe('mine');
    if (mine.kind !== 'mine') return;
    hero.position = { ...mine.position };
    expect(store.interact(hero.id).ok).toBe(true);
    expect(mine.ownerId).toBe('red');
    for (const candidate of Object.values(state.heroes)) {
      if (candidate.ownerId === 'blue') candidate.alive = false;
    }
    const beforeDay = player.resources[resource];
    expect(store.endTurn().ok).toBe(true);
    expect(player.resources[resource]).toBe(beforeDay + NEW_RESOURCES[resource].mineDailyOutput);
  });

  it('spends new resources in real advanced construction', () => {
    const store = new GameStore({ seed: 'extended-costs', storage: null });
    const state = mutableState(store);
    const player = state.players.red!;
    player.resources.gold = 20_000;
    const town = state.towns.haven!;
    const before = { ...player.resources };
    expect(store.constructBuilding(town.id, 'mageGuild').ok).toBe(true);
    expect(player.resources.essence).toBe(before.essence - 1);
    town.builtToday = false;
    expect(store.constructBuilding(town.id, 'capitol').ok).toBe(true);
    expect(player.resources.mithril).toBe(before.mithril - 2);
    expect(player.resources.obsidian).toBe(before.obsidian - 1);
  });

  it('exposes all ten resources with distinct metadata and icons', () => {
    expect(EXTENDED_RESOURCE_TYPES).toHaveLength(10);
    const colors = new Set(Object.values(NEW_RESOURCES).map((resource) => resource.color));
    expect(colors.size).toBe(3);
    for (const resource of EXTENDED_RESOURCE_TYPES) {
      expect(RESOURCE_META[resource].name.length).toBeGreaterThan(0);
      expect(resourceIcon(resource)).toContain(`h3-resource-${resource}`);
    }
  });

  it('migrates legacy resources and inventories without refilling saved spellbooks', () => {
    const legacy = structuredClone(createInitialGameState('legacy-h3content'));
    for (const player of Object.values(legacy.players)) {
      for (const resource of NEW_RESOURCE_TYPES) delete player.resources[resource];
    }
    for (const hero of Object.values(legacy.heroes)) {
      delete (hero as Partial<GameState['heroes'][string]>).artifacts;
      hero.spells = [];
    }
    expect(isGameState(legacy)).toBe(true);
    const migrated = parseGameState(JSON.stringify(legacy));
    for (const player of Object.values(migrated.players)) {
      for (const resource of NEW_RESOURCE_TYPES) expect(player.resources[resource]).toBe(0);
    }
    for (const hero of Object.values(migrated.heroes)) {
      expect(hero.artifacts).toEqual({ items: {}, equipped: {} });
      expect(hero.spells).toEqual([]);
    }
  });

  it('continues Capitol and Mage Guild construction from a pre-M43 map without new-resource sources', () => {
    const legacy = createInitialGameState('pre-m43-construction');
    for (const object of Object.values(legacy.map.objects)) {
      const expandedPickup = object.kind === 'resource' &&
        NEW_RESOURCE_TYPES.some((resource) => (object.resources[resource] ?? 0) > 0);
      const expandedMine = object.kind === 'mine' &&
        (NEW_RESOURCE_TYPES as readonly string[]).includes(object.resource);
      if (object.kind === 'artifact' || expandedPickup || expandedMine) {
        legacy.map.tiles[toTileIndex(legacy.map, object.position)]!.objectId = null;
        delete legacy.map.objects[object.id];
      }
      if (object.kind === 'monster') {
        for (const resource of NEW_RESOURCE_TYPES) delete object.treasure[resource];
      }
    }
    for (const player of Object.values(legacy.players)) {
      for (const resource of NEW_RESOURCE_TYPES) delete player.resources[resource];
      player.resources.gold = 20_000;
      player.resources.wood = 100;
      player.resources.ore = 100;
      player.resources.mercury = 20;
      player.resources.crystal = 20;
    }
    for (const hero of Object.values(legacy.heroes)) {
      delete (hero as Partial<GameState['heroes'][string]>).artifacts;
      hero.spells = ['haste', 'magicArrow'];
      if (hero.ownerId === 'blue') hero.alive = false;
    }
    expect(Object.values(legacy.map.objects).every((object) =>
      object.kind !== 'artifact' &&
      (object.kind !== 'resource' || NEW_RESOURCE_TYPES.every((resource) => !object.resources[resource])) &&
      (object.kind !== 'mine' || !(NEW_RESOURCE_TYPES as readonly string[]).includes(object.resource)))).toBe(true);
    expect(isGameState(legacy)).toBe(true);

    const store = new GameStore({ storage: null });
    expect(store.loadSerialized(JSON.stringify(legacy)).ok).toBe(true);
    const state = mutableState(store);
    expect(isGameState(state)).toBe(true);
    const hero = state.heroes['hero-aveline']!;
    const reachable = new Set(getReachableTiles(state.map, hero.position, Number.POSITIVE_INFINITY)
      .map((tile) => tile.tileIndex));
    for (const resource of NEW_RESOURCE_TYPES) {
      expect(state.players.red!.resources[resource]).toBe(0);
      const mine = state.map.objects[`${resource}-mine`];
      expect(mine?.kind).toBe('mine');
      if (mine?.kind !== 'mine') continue;
      expect(mine.resource).toBe(resource);
      expect(reachable.has(toTileIndex(state.map, mine.position))).toBe(true);
      hero.position = { ...mine.position };
      expect(store.interact(hero.id).ok).toBe(true);
      expect(mine.ownerId).toBe('red');
    }
    expect(store.endTurn().ok).toBe(true);
    expect(store.constructBuilding('haven', 'mageGuild').ok).toBe(true);
    expect(store.endTurn().ok).toBe(true);
    expect(store.constructBuilding('haven', 'capitol').ok).toBe(true);
    expect(state.players.red!.resources.mithril).toBe(0);
    expect(state.players.red!.resources.obsidian).toBe(1);
    expect(state.players.red!.resources.essence).toBe(1);
  });

  it('rejects malformed new resources and prototype keys without replacing state', () => {
    const store = new GameStore({ seed: 'extended-validation', storage: null });
    const before = store.getState();
    const malformedValues = [-1, 1.5, Number.MAX_SAFE_INTEGER + 1];
    for (const value of malformedValues) {
      const malformed = structuredClone(before);
      malformed.players.red!.resources.mithril = value;
      expect(store.loadSerialized(JSON.stringify(malformed)).ok).toBe(false);
      expect(store.getState()).toBe(before);
    }
    for (const key of ['__proto__', 'constructor', 'toString']) {
      const malformed = structuredClone(before);
      const resources = malformed.players.red!.resources as Record<string, number>;
      Object.defineProperty(resources, key, { value: 2, enumerable: true, configurable: true, writable: true });
      expect(store.loadSerialized(JSON.stringify(malformed)).ok).toBe(false);
      expect(store.getState()).toBe(before);
    }
  });
});

describe('all twenty artifact pickups, equipment, stats, and saves', () => {
  it('places exactly one connected pickup for every artifact', () => {
    for (const seed of ['artifact-connectivity-a', 'artifact-connectivity-b']) {
      const map = createAdventureMap(seed);
      const artifacts = Object.values(map.objects).filter((object) => object.kind === 'artifact');
      expect(artifacts).toHaveLength(20);
      expect(new Set(artifacts.map((object) => object.kind === 'artifact' && object.artifactId))).toEqual(
        new Set(ARTIFACT_LIST.map((artifact) => artifact.id)),
      );
      const reachable = new Set(getReachableTiles(map, { x: 3, y: Math.floor(map.height / 2) }, Number.POSITIVE_INFINITY)
        .map((tile) => tile.tileIndex));
      for (const object of artifacts) expect(reachable.has(toTileIndex(map, object.position)), object.id).toBe(true);
    }
  });

  it.each(ARTIFACT_LIST)('$id is collectible, equipable, battle-effective, and persistent', (artifact) => {
    const store = new GameStore({ seed: `artifact-${artifact.id}`, storage: null });
    const state = mutableState(store);
    const hero = state.heroes['hero-aveline']!;
    const object = state.map.objects[`artifact-${artifact.id}`]!;
    expect(object.kind).toBe('artifact');
    hero.position = { ...object.position };
    const picked = store.interact(hero.id);
    expect(picked.ok).toBe(true);
    expect(getArtifactCount(hero.artifacts, artifact.id)).toBe(1);
    expect(state.map.objects[object.id]).toBeUndefined();
    expect(store.equipArtifact(hero.id, artifact.id).ok).toBe(true);
    expect(hero.artifacts.equipped[artifact.slot]).toBe(artifact.id);
    const effective = getEffectivePrimarySkills(hero);
    for (const stat of ['attack', 'defense', 'spellPower', 'knowledge'] as const) {
      expect(effective[stat]).toBe(hero.primarySkills[stat] + (artifact.bonuses[stat] ?? 0));
    }

    const monster = state.map.objects['monster-west']!;
    hero.position = { ...monster.position };
    const setup = store.createBattleSetup(hero.id, monster.id);
    expect(setup.ok).toBe(true);
    if (!setup.ok) return;
    expect(setup.value.attacker.primarySkills).toEqual(effective);
    expect(setup.value.attacker.maxMana).toBe(getHeroMaxMana(hero));
    const engine = new BattleEngine(setup.value, { obstacles: [] });
    expect(engine.getHero('attacker')?.primarySkills).toEqual(effective);
    expect(engine.getHero('attacker')?.maxMana).toBe(getHeroMaxMana(hero));

    const restored = new GameStore({ storage: null });
    expect(restored.loadSerialized(serializeGameState(state)).ok).toBe(true);
    const loadedHero = restored.getState().heroes[hero.id]!;
    expect(loadedHero.artifacts.equipped[artifact.slot]).toBe(artifact.id);
    expect(getEffectivePrimarySkills(loadedHero)).toEqual(effective);
    expect(restored.unequipArtifact(loadedHero.id, artifact.slot).ok).toBe(true);
    expect(getEffectivePrimarySkills(loadedHero)).toEqual(hero.primarySkills);
    expect(getArtifactCount(loadedHero.artifacts, artifact.id)).toBe(1);
  });
});

describe('custom editor content in a real sandbox battle', () => {
  it('persists, registers, renders, and fights with custom definitions while preserving built-ins', () => {
    const storage = new MemoryStorage();
    const editor = new ContentEditorStore({ storage, autoLoad: false, randomToken: () => 'fixed' });
    const creatureResult = editor.createCreature({
      id: 'custom-test-drake', name: 'Test Drake', faction: 'Neutral', tier: 2,
      attack: 8, defense: 8, damage: [4, 7], health: 30, speed: 7, shots: 8,
      cost: { gold: 180, mithril: 1, obsidian: 2, essence: 3 }, growth: 6, abilities: ['ranged'],
    });
    const artifactResult = editor.createArtifact({
      id: 'custom-test-focus', name: 'Test Focus', description: 'A custom focus for sandbox integration.',
      slot: 'trinket', rarity: 'rare', bonuses: { attack: 3, knowledge: 2 },
    });
    expect(creatureResult.ok).toBe(true);
    expect(artifactResult.ok).toBe(true);
    if (!creatureResult.ok || !artifactResult.ok) return;
    const registry = editor.getSnapshot();
    registerCustomCreatures(registry.creatures);
    registerCustomArtifacts(registry.artifacts);
    expect(Object.keys(CREATURES)).toHaveLength(72);
    expect(ARTIFACT_LIST).toHaveLength(20);
    expect(getCreature(creatureResult.value.id).name).toBe('Test Drake');

    const setup = createSandboxBattleSetup(creatureResult.value, artifactResult.value);
    expect(setup.attacker.primarySkills).toMatchObject({ attack: 5, defense: 2, spellPower: 2, knowledge: 6 });
    expect(setup.attacker.maxMana).toBe(60);
    expect(setup.attacker.spells).toHaveLength(19);
    expect(setup.defender.army).toEqual([{ creatureId: 'militia', count: 12 }]);
    const engine = runTacticalAutoBattle(setup, { obstacles: [] });
    expect(engine.getResult()).not.toBeNull();
    expect(engine.getState().stacks.some((stack) => stack.creatureId === creatureResult.value.id)).toBe(true);

    const hooks = createCustomContentBattleHooks(editor);
    const model = hooks.createCreatureModel(creatureResult.value.id);
    expect(model?.userData.customContent).toBe(true);
    expect(model?.userData.definition).toMatchObject({ id: creatureResult.value.id, name: 'Test Drake' });
    if (model) disposeCustomContentModel(model);

    const exported = editor.exportJson();
    const imported = new ContentEditorStore({ storage: null, autoLoad: false });
    expect(imported.importJson(exported).ok).toBe(true);
    expect(imported.getSnapshot()).toEqual(registry);
    const persisted = new ContentEditorStore({ storage, autoLoad: true });
    expect(persisted.getSnapshot()).toEqual(registry);
    expect(() => registerCustomCreatures([{ ...creatureResult.value, id: 'militia' }])).toThrow(/duplicate/);
    expect(() => registerCustomArtifacts([{ ...artifactResult.value, id: 'copperSunblade' }])).toThrow(/duplicate/);
    expect(() => getCreature('__proto__')).toThrow(/Unknown creature/);
  });

  it('locks campaign commands and saves for the entire custom content session', () => {
    const storage = new MemoryStorage();
    const store = new GameStore({ seed: 'editor-command-lock', storage });
    const initialSave = store.saveGame();
    expect(initialSave.ok).toBe(true);
    if (!initialSave.ok) return;
    const saved = storage.getItem(initialSave.value);
    const before = serializeGameState(store.getState());
    store.setCampaignCommandsSuspended(true);
    const results = [
      store.endTurn(),
      store.selectHero('hero-aveline'),
      store.newGame('blocked-new-campaign'),
      store.saveGame(),
      store.loadGame(),
      store.loadSerialized(before),
    ];
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('suspended');
    }
    expect(serializeGameState(store.getState())).toBe(before);
    expect(storage.getItem(initialSave.value)).toBe(saved);
    store.setCampaignCommandsSuspended(false);
    expect(store.selectHero('hero-aveline').ok).toBe(true);
  });

  it('keeps inventory helpers compatible with valid custom artifact definitions', () => {
    registerCustomArtifacts([{
      id: 'custom-inventory-focus', name: 'Inventory Focus', description: 'A custom artifact for inventory integration.',
      slot: 'trinket', rarity: 'common', bonuses: { spellPower: 1 },
    }]);
    let inventory = createArtifactInventory();
    inventory = addArtifact(inventory, 'custom-inventory-focus');
    inventory = equipArtifact(inventory, 'custom-inventory-focus');
    expect(inventory.equipped.trinket).toBe('custom-inventory-focus');
  });
});
