import { describe, expect, it } from 'vitest';
import type { ArmyStack, BattleSetup, PrimarySkills } from '../game/types';
import { BattleEngine } from './BattleEngine';
import { hexDistance } from './hex';
import type { BattleEngineOptions } from './types';

const skills = (overrides: Partial<PrimarySkills> = {}): PrimarySkills => ({
  attack: 0,
  defense: 0,
  spellPower: 0,
  knowledge: 0,
  ...overrides,
});

function makeSetup(
  attackerArmy: ArmyStack[],
  defenderArmy: ArmyStack[],
  attackerSkills = skills(),
): BattleSetup {
  return {
    id: 'test-battle',
    seed: 'deterministic-test-seed',
    source: { heroId: 'hero-test', objectId: 'test-object', kind: 'monster' },
    attacker: {
      ownerId: 'red', heroId: 'hero-test', primarySkills: attackerSkills, army: attackerArmy,
    },
    defender: {
      ownerId: 'neutral', heroId: null, primarySkills: skills(), army: defenderArmy,
    },
    rewards: { experience: 120, resources: { gold: 300 } },
  };
}

function engine(
  attackerArmy: ArmyStack[],
  defenderArmy: ArmyStack[],
  options: BattleEngineOptions,
  attackerSkills = skills(),
): BattleEngine {
  return new BattleEngine(makeSetup(attackerArmy, defenderArmy, attackerSkills), options);
}

describe('hex deployment and movement', () => {
  it('deploys both armies and starts the fastest stack with deterministic initiative', () => {
    const battle = engine(
      [{ creatureId: 'militia', count: 12 }, { creatureId: 'archer', count: 5 }],
      [{ creatureId: 'griffin', count: 3 }],
      { obstacles: [] },
    );
    expect(battle.getActiveStack()?.id).toBe('defender:0');
    expect(battle.getState().initiative).toEqual(['defender:0', 'attacker:1', 'attacker:0']);
    expect(battle.getStack('attacker:0')?.position).toEqual({ x: 1, y: 5 });
    expect(battle.getStack('defender:0')?.position).toEqual({ x: 13, y: 5 });
    expect(battle.getStack('attacker:0')?.count).toBe(12);
  });

  it('routes walkers around obstacles and rejects blocked or occupied landings', () => {
    const battle = engine(
      [{ creatureId: 'militia', count: 10 }],
      [{ creatureId: 'militia', count: 10 }],
      {
        attackerPositions: [{ x: 1, y: 5 }],
        defenderPositions: [{ x: 4, y: 5 }],
        obstacles: [{ position: { x: 2, y: 5 }, kind: 'rock' }],
      },
    );
    const path = battle.findPath({ x: 3, y: 5 });
    expect(path).not.toBeNull();
    expect(path?.path.some((hex) => hex.x === 2 && hex.y === 5)).toBe(false);
    expect(battle.findPath({ x: 2, y: 5 })).toBeNull();
    expect(battle.findPath({ x: 4, y: 5 })).toBeNull();
    expect(battle.findPath({ x: 30, y: 5 })).toBeNull();
  });

  it('lets flyers cross a wall but not land on it', () => {
    const battle = engine(
      [{ creatureId: 'griffin', count: 2 }],
      [{ creatureId: 'militia', count: 10 }],
      {
        attackerPositions: [{ x: 1, y: 5 }],
        defenderPositions: [{ x: 13, y: 5 }],
        obstacles: [{ position: { x: 2, y: 5 }, kind: 'wall' }],
      },
    );
    expect(battle.findPath({ x: 4, y: 5 })).toEqual({
      path: [{ x: 1, y: 5 }, { x: 4, y: 5 }],
      cost: 3,
    });
    expect(battle.findPath({ x: 2, y: 5 })).toBeNull();
  });
});

describe('attacks and retaliation', () => {
  it('resolves melee damage and one standard retaliation before advancing the turn', () => {
    const battle = engine(
      [{ creatureId: 'militia', count: 10 }],
      [{ creatureId: 'militia', count: 10 }],
      {
        attackerPositions: [{ x: 5, y: 5 }], defenderPositions: [{ x: 6, y: 5 }], obstacles: [],
      },
    );
    const result = battle.attack('defender:0');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.filter((event) => event.kind === 'attack')).toHaveLength(2);
    expect(result.value.filter((event) => event.kind === 'attack' && event.retaliation)).toHaveLength(1);
    expect(battle.getStack('defender:0')?.retaliationsUsed).toBe(1);
    expect(battle.getStack('defender:0')?.count).toBeLessThan(10);
    expect(battle.getStack('attacker:0')?.count).toBeLessThan(10);
    expect(battle.getActiveStack()?.id).toBe('defender:0');
  });

  it('resolves cavalier double strikes around the defender retaliation', () => {
    const battle = engine(
      [{ creatureId: 'cavalier', count: 20 }],
      [{ creatureId: 'militia', count: 100 }],
      {
        attackerPositions: [{ x: 5, y: 5 }], defenderPositions: [{ x: 6, y: 5 }], obstacles: [],
      },
    );
    const result = battle.attack('defender:0');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const attacks = result.value.filter((event) => event.kind === 'attack');
    expect(attacks.map((event) => event.kind === 'attack' && event.retaliation)).toEqual([false, true, false]);
  });

  it('applies long-range and intervening obstacle or wall penalties to shots', () => {
    const armies: [ArmyStack[], ArmyStack[]] = [
      [{ creatureId: 'archer', count: 10 }],
      [{ creatureId: 'militia', count: 100 }],
    ];
    const clear = engine(...armies, {
      attackerPositions: [{ x: 1, y: 5 }], defenderPositions: [{ x: 13, y: 5 }], obstacles: [],
    });
    const rock = engine(...armies, {
      attackerPositions: [{ x: 1, y: 5 }],
      defenderPositions: [{ x: 13, y: 5 }],
      obstacles: [{ position: { x: 7, y: 5 }, kind: 'rock' }],
    });
    const wall = engine(...armies, {
      attackerPositions: [{ x: 1, y: 5 }],
      defenderPositions: [{ x: 13, y: 5 }],
      obstacles: [{ position: { x: 7, y: 5 }, kind: 'wall' }],
    });
    const clearPreview = clear.getAttackPreview('defender:0');
    const rockPreview = rock.getAttackPreview('defender:0');
    const wallPreview = wall.getAttackPreview('defender:0');
    expect(clearPreview?.kind).toBe('ranged');
    expect(clearPreview?.rangePenalty).toBe(true);
    expect(rockPreview?.obstaclePenalty).toBe(true);
    expect(wallPreview?.wallPenalty).toBe(true);
    expect(rockPreview?.max).toBeLessThan(clearPreview?.max ?? 0);
    expect(wallPreview?.max).toBeLessThan(clearPreview?.max ?? 0);
    const shot = clear.attack('defender:0');
    expect(shot.ok).toBe(true);
    expect(clear.getStack('attacker:0')?.shots).toBe(11);
    expect(shot.ok && shot.value.some((event) => event.kind === 'attack' && event.retaliation)).toBe(false);
  });
});

describe('turns and spells', () => {
  it('supports waiting in reverse order, defending, and round renewal', () => {
    const battle = engine(
      [{ creatureId: 'dragon', count: 2 }, { creatureId: 'archer', count: 5 }],
      [{ creatureId: 'militia', count: 10 }],
      { obstacles: [] },
    );
    expect(battle.getActiveStack()?.id).toBe('attacker:0');
    expect(battle.wait().ok).toBe(true);
    expect(battle.getActiveStack()?.id).toBe('attacker:1');
    expect(battle.defend().ok).toBe(true);
    expect(battle.getActiveStack()?.id).toBe('defender:0');
    expect(battle.defend().ok).toBe(true);
    expect(battle.getActiveStack()?.id).toBe('attacker:0');
    expect(battle.wait().ok).toBe(false);
    expect(battle.defend().ok).toBe(true);
    expect(battle.getState().round).toBe(2);
    expect(battle.getActiveStack()?.id).toBe('attacker:0');
    expect(battle.getStack('attacker:1')?.defending).toBe(true);
  });

  it('enforces mana, valid targets, and once-per-round casting', () => {
    const battle = engine(
      [{ creatureId: 'dragon', count: 2 }],
      [{ creatureId: 'militia', count: 10 }],
      { obstacles: [] },
      skills({ spellPower: 2, knowledge: 5 }),
    );
    expect(battle.canCastSpell('magicArrow', 'attacker', 'attacker:0').ok).toBe(false);
    const cast = battle.castSpell('magicArrow', 'attacker', 'defender:0');
    expect(cast.ok).toBe(true);
    expect(battle.getHero('attacker')?.mana).toBe(45);
    expect(battle.getHero('attacker')?.castThisRound).toBe(true);
    expect(battle.castSpell('haste', 'attacker', 'attacker:0').ok).toBe(false);
    expect(battle.getActiveStack()?.id).toBe('attacker:0');
  });

  it('damages every enemy with fireball and applies haste and slow modifiers', () => {
    const area = engine(
      [{ creatureId: 'dragon', count: 2 }],
      [{ creatureId: 'militia', count: 10 }, { creatureId: 'archer', count: 10 }],
      { obstacles: [] },
      skills({ spellPower: 1, knowledge: 5 }),
    );
    const cast = area.castSpell('fireball', 'attacker');
    expect(cast.ok).toBe(true);
    if (cast.ok) {
      const spell = cast.value.find((event) => event.kind === 'spell');
      expect(spell?.kind === 'spell' && spell.targetIds).toEqual(['defender:0', 'defender:1']);
    }
    expect(area.getStackHealth(area.getStack('defender:0')!)).toBe(40);
    expect(area.getStackHealth(area.getStack('defender:1')!)).toBe(60);

    const haste = engine(
      [{ creatureId: 'dragon', count: 2 }],
      [{ creatureId: 'militia', count: 10 }],
      { obstacles: [] }, skills({ knowledge: 5 }),
    );
    const originalSpeed = haste.getStackSpeed(haste.getStack('attacker:0')!);
    expect(haste.castSpell('haste', 'attacker', 'attacker:0').ok).toBe(true);
    expect(haste.getStackSpeed(haste.getStack('attacker:0')!)).toBe(originalSpeed + 3);

    const slow = engine(
      [{ creatureId: 'dragon', count: 2 }],
      [{ creatureId: 'militia', count: 10 }],
      { obstacles: [] }, skills({ knowledge: 5 }),
    );
    const defender = slow.getStack('defender:0')!;
    const defenderSpeed = slow.getStackSpeed(defender);
    expect(slow.castSpell('slow', 'attacker', defender.id).ok).toBe(true);
    expect(slow.getStackSpeed(defender)).toBe(defenderSpeed - 3);
  });

  it('revives a fallen ally without exceeding its original stack size', () => {
    const battle = engine(
      [{ creatureId: 'militia', count: 1 }, { creatureId: 'dragon', count: 2 }],
      [{ creatureId: 'cavalier', count: 20 }],
      {
        attackerPositions: [{ x: 5, y: 5 }, { x: 1, y: 8 }],
        defenderPositions: [{ x: 6, y: 5 }],
        obstacles: [],
      },
      skills({ spellPower: 5, knowledge: 5 }),
    );
    expect(battle.getActiveStack()?.id).toBe('attacker:1');
    expect(battle.defend().ok).toBe(true);
    expect(battle.getActiveStack()?.id).toBe('defender:0');
    expect(battle.attack('attacker:0').ok).toBe(true);
    expect(battle.getStack('attacker:0')?.count).toBe(0);
    expect(battle.getResult()).toBeNull();
    expect(battle.getActiveStack()?.id).toBe('attacker:1');
    const cure = battle.castSpell('cure', 'attacker', 'attacker:0');
    expect(cure.ok).toBe(true);
    expect(battle.getStack('attacker:0')?.count).toBe(1);
    expect(battle.getStackHealth(battle.getStack('attacker:0')!)).toBe(8);
  });
});

describe('battle results', () => {
  it('returns strict winner and survivor semantics with the original rewards', () => {
    const battle = engine(
      [{ creatureId: 'dragon', count: 2 }],
      [{ creatureId: 'militia', count: 1 }],
      {
        attackerPositions: [{ x: 5, y: 5 }], defenderPositions: [{ x: 6, y: 5 }], obstacles: [],
      },
    );
    expect(battle.attack('defender:0').ok).toBe(true);
    expect(battle.getResult()).toEqual({
      setupId: 'test-battle',
      winner: 'attacker',
      attackerArmy: [{ creatureId: 'dragon', count: 2 }],
      defenderArmy: [],
      rewards: { experience: 120, resources: { gold: 300 } },
      rounds: 1,
    });
  });

  it('preserves both armies and returns no rewards on a round-limit draw', () => {
    const battle = engine(
      [{ creatureId: 'militia', count: 10 }],
      [{ creatureId: 'militia', count: 10 }],
      { obstacles: [], maxRounds: 1 },
    );
    expect(battle.defend().ok).toBe(true);
    expect(battle.defend().ok).toBe(true);
    expect(battle.getResult()?.winner).toBe('draw');
    expect(battle.getResult()?.attackerArmy).toEqual([{ creatureId: 'militia', count: 10 }]);
    expect(battle.getResult()?.defenderArmy).toEqual([{ creatureId: 'militia', count: 10 }]);
    expect(battle.getResult()?.rewards).toEqual({ experience: 0, resources: {} });
  });

  it('uses hex distance for melee approach paths', () => {
    const battle = engine(
      [{ creatureId: 'griffin', count: 2 }],
      [{ creatureId: 'militia', count: 10 }],
      {
        attackerPositions: [{ x: 5, y: 5 }], defenderPositions: [{ x: 8, y: 5 }], obstacles: [],
      },
    );
    const preview = battle.getAttackPreview('defender:0');
    expect(preview?.kind).toBe('melee');
    expect(preview?.path?.cost).toBe(2);
    const destination = preview?.path?.path.at(-1);
    expect(destination && hexDistance(destination, { x: 8, y: 5 })).toBe(1);
  });
});
