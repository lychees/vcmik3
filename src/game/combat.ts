import { cloneArmy } from './army';
import { getCreature } from './content';
import { SeededRandom } from './random';
import type { ArmyStack, BattleResult, BattleSetup, BattleSide } from './types';

interface CombatStack extends ArmyStack {
  currentHealth: number;
  side: 'attacker' | 'defender';
  order: number;
}

function combatStacks(army: readonly ArmyStack[], side: 'attacker' | 'defender'): CombatStack[] {
  return army.map((stack, order) => ({
    ...stack,
    currentHealth: getCreature(stack.creatureId).health,
    side,
    order,
  }));
}

function dealDamage(stack: CombatStack, damage: number): void {
  const health = getCreature(stack.creatureId).health;
  const totalHealth = Math.max(0, (stack.count - 1) * health + stack.currentHealth);
  const remaining = Math.max(0, totalHealth - Math.max(0, Math.floor(damage)));
  stack.count = Math.ceil(remaining / health);
  stack.currentHealth = stack.count > 0 ? remaining - (stack.count - 1) * health : 0;
}

function totalHealth(stack: CombatStack): number {
  const health = getCreature(stack.creatureId).health;
  return Math.max(0, (stack.count - 1) * health + stack.currentHealth);
}

function survivingArmy(stacks: readonly CombatStack[]): ArmyStack[] {
  return stacks.filter((stack) => stack.count > 0).map(({ creatureId, count }) => ({ creatureId, count }));
}

export function resolveBattleAutomatically(setup: BattleSetup): BattleResult {
  const random = new SeededRandom(setup.seed);
  const attackers = combatStacks(setup.attacker.army, 'attacker');
  const defenders = combatStacks(setup.defender.army, 'defender');
  const all = [...attackers, ...defenders];
  let rounds = 0;

  const living = (side: 'attacker' | 'defender'): CombatStack[] =>
    all.filter((stack) => stack.side === side && stack.count > 0);

  while (living('attacker').length > 0 && living('defender').length > 0 && rounds < 100) {
    rounds += 1;
    const initiative = all
      .filter((stack) => stack.count > 0)
      .sort((a, b) => {
        const speedDifference = getCreature(b.creatureId).speed - getCreature(a.creatureId).speed;
        if (speedDifference !== 0) return speedDifference;
        if (a.side !== b.side) return a.side === 'attacker' ? -1 : 1;
        return a.order - b.order;
      });
    for (const attacker of initiative) {
      if (attacker.count <= 0) continue;
      const targets = living(attacker.side === 'attacker' ? 'defender' : 'attacker');
      const target = targets[0];
      if (!target) break;
      const creature = getCreature(attacker.creatureId);
      const targetCreature = getCreature(target.creatureId);
      const side: BattleSide = attacker.side === 'attacker' ? setup.attacker : setup.defender;
      const defendingSide: BattleSide = attacker.side === 'attacker' ? setup.defender : setup.attacker;
      const attack = creature.attack + side.primarySkills.attack;
      const defense = targetCreature.defense + defendingSide.primarySkills.defense;
      const attackModifier = Math.min(3, Math.max(0.3, 1 + (attack - defense) * 0.05));
      const damage = attacker.count * random.integer(creature.damage[0], creature.damage[1]) * attackModifier;
      dealDamage(target, damage);
    }
  }

  const attackerHealth = living('attacker').reduce((sum, stack) => sum + totalHealth(stack), 0);
  const defenderHealth = living('defender').reduce((sum, stack) => sum + totalHealth(stack), 0);
  let winner: BattleResult['winner'] = 'draw';
  if (attackerHealth > 0 && defenderHealth === 0) winner = 'attacker';
  else if (defenderHealth > 0 && attackerHealth === 0) winner = 'defender';

  return {
    setupId: setup.id,
    winner,
    attackerArmy: survivingArmy(attackers),
    defenderArmy: survivingArmy(defenders),
    rewards: winner === 'draw'
      ? { experience: 0, resources: {} }
      : { experience: setup.rewards.experience, resources: { ...setup.rewards.resources } },
    rounds,
  };
}

export function cloneBattleSetup(setup: BattleSetup): BattleSetup {
  return {
    ...setup,
    source: { ...setup.source },
    attacker: {
      ...setup.attacker,
      primarySkills: { ...setup.attacker.primarySkills },
      army: cloneArmy(setup.attacker.army),
      spells: setup.attacker.spells ? [...setup.attacker.spells] : undefined,
    },
    defender: {
      ...setup.defender,
      primarySkills: { ...setup.defender.primarySkills },
      army: cloneArmy(setup.defender.army),
      spells: setup.defender.spells ? [...setup.defender.spells] : undefined,
    },
    rewards: { experience: setup.rewards.experience, resources: { ...setup.rewards.resources } },
  };
}
