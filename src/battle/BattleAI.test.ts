import { describe, expect, it } from 'vitest';
import { GameStore } from '../game/GameStore';
import type { BattleSetup, GameState } from '../game/types';
import { chooseAiAction, chooseAiSpell, runTacticalAutoBattle } from './BattleAI';
import { BattleEngine } from './BattleEngine';
import { hexDistance } from './hex';

function setup(): BattleSetup {
  return {
    id: 'ai-battle',
    seed: 'ai-determinism',
    source: { heroId: 'hero-aveline', objectId: 'monster-test', kind: 'monster' },
    attacker: {
      ownerId: 'red',
      heroId: 'hero-aveline',
      primarySkills: { attack: 2, defense: 2, spellPower: 2, knowledge: 3 },
      army: [{ creatureId: 'militia', count: 18 }, { creatureId: 'archer', count: 8 }],
    },
    defender: {
      ownerId: 'neutral',
      heroId: null,
      primarySkills: { attack: 0, defense: 0, spellPower: 0, knowledge: 0 },
      army: [{ creatureId: 'militia', count: 12 }, { creatureId: 'ranger', count: 4 }],
    },
    rewards: { experience: 200, resources: { gold: 100 } },
  };
}

describe('tactical AI', () => {
  it('shoots with a ranged stack instead of passing', () => {
    const battle = new BattleEngine(setup(), {
      attackerPositions: [{ x: 1, y: 2 }, { x: 1, y: 5 }],
      defenderPositions: [{ x: 13, y: 2 }, { x: 13, y: 8 }],
      obstacles: [],
    });
    battle.castSpell('magicArrow', 'attacker', 'defender:0');
    battle.defend();
    expect(battle.getActiveStack()?.id).toBe('attacker:1');
    expect(chooseAiAction(battle)).toMatchObject({ type: 'attack' });
  });

  it('moves a melee stack toward an enemy outside its movement range', () => {
    const custom = setup();
    custom.attacker.heroId = null;
    custom.attacker.primarySkills.knowledge = 0;
    custom.attacker.army = [{ creatureId: 'militia', count: 10 }];
    custom.defender.army = [{ creatureId: 'militia', count: 10 }];
    const battle = new BattleEngine(custom, {
      attackerPositions: [{ x: 1, y: 5 }], defenderPositions: [{ x: 13, y: 5 }], obstacles: [],
    });
    const active = battle.getActiveStack();
    const target = battle.getStack('defender:0');
    if (!active || !target) throw new Error('Missing AI fixture stacks');
    const before = hexDistance(active.position, target.position);
    const decision = chooseAiAction(battle);
    expect(decision.type).toBe('move');
    expect(decision.destination && hexDistance(decision.destination, target.position)).toBeLessThan(before);
  });

  it('selects a useful combat spell with a valid target', () => {
    const custom = setup();
    custom.defender.army = [{ creatureId: 'militia', count: 12 }];
    const battle = new BattleEngine(custom, { obstacles: [] });
    const decision = chooseAiSpell(battle, 'attacker');
    expect(decision).not.toBeNull();
    if (!decision) return;
    expect(['fireball', 'magicArrow', 'haste']).toContain(decision.spellId);
    expect(battle.canCastSpell(decision.spellId, 'attacker', decision.targetId).ok).toBe(true);
  });

  it('completes real battles deterministically with valid surviving armies', () => {
    const first = runTacticalAutoBattle(setup(), { obstacles: [] });
    const second = runTacticalAutoBattle(setup(), { obstacles: [] });
    const result = first.getResult();
    expect(result).not.toBeNull();
    expect(result).toEqual(second.getResult());
    expect(result?.rounds).toBeGreaterThan(0);
    expect(result?.winner).toMatch(/attacker|defender|draw/);
    expect(result?.attackerArmy.every((stack) => stack.count > 0)).toBe(true);
    expect(result?.defenderArmy.every((stack) => stack.count > 0)).toBe(true);
    if (result?.winner === 'attacker') {
      expect(result.attackerArmy.length).toBeGreaterThan(0);
      expect(result.defenderArmy).toEqual([]);
      expect(result.rewards).toEqual({ experience: 200, resources: { gold: 100 } });
    }
    if (result?.winner === 'defender') {
      expect(result.attackerArmy).toEqual([]);
      expect(result.defenderArmy.length).toBeGreaterThan(0);
    }
  });

  it('returns a real encounter result accepted by the core store', () => {
    const store = new GameStore({ seed: 'tactical-store-handoff', storage: null });
    const state = store.getState() as GameState;
    const hero = state.heroes['hero-aveline'];
    const monster = state.map.objects['monster-west'];
    if (!hero || monster?.kind !== 'monster') throw new Error('Missing core battle fixture');
    hero.position = { ...monster.position };
    const initiated = store.initiateBattle(hero.id, monster.id);
    expect(initiated.ok).toBe(true);
    if (!initiated.ok) return;
    const result = runTacticalAutoBattle(initiated.value).getResult();
    expect(result).not.toBeNull();
    if (!result) return;
    expect(store.applyBattleResult(result).ok).toBe(true);
    expect(state.pendingBattle).toBeNull();
    expect(hero.army).toEqual(result.winner === 'defender' ? [] : result.attackerArmy);
  });
});
