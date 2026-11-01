import { getCreature } from '../game/content';
import { getExpandedSpell } from '../game/spells';
import type {
  ExpandedSpellDefinition,
  ExpandedSpellEffect,
  ExpandedSpellId,
  ExpandedStackModifiers,
} from '../game/spells';
import { hexDistance } from './hex';
import type { BattleHeroState, BattleSideId, BattleStackState } from './types';

export interface ExpandedSpellTargetContext {
  readonly casterSide: BattleSideId;
  readonly stacks: readonly BattleStackState[];
  readonly revivableStackIds?: readonly string[];
}

export interface ExpandedSpellCastContext extends ExpandedSpellTargetContext {
  readonly heroes: Partial<Record<BattleSideId, BattleHeroState>>;
  readonly targetId?: string;
}

export type ExpandedSpellOperation =
  | {
      readonly kind: 'damage';
      readonly targetId: string;
      readonly amount: number;
    }
  | {
      readonly kind: 'heal';
      readonly targetId: string;
      readonly amount: number;
      readonly canRevive: boolean;
    }
  | {
      readonly kind: 'status';
      readonly targetId: string;
      readonly statusId: ExpandedSpellId;
      readonly duration: number;
      readonly modifiers: ExpandedStackModifiers;
    }
  | {
      readonly kind: 'manaBurn' | 'manaDrain' | 'manaRestore';
      readonly side: BattleSideId;
      readonly amount: number;
    };

export interface ExpandedSpellPlan {
  readonly spellId: ExpandedSpellId;
  readonly casterSide: BattleSideId;
  readonly manaCost: number;
  readonly consumeCast: true;
  readonly targetIds: readonly string[];
  readonly operations: readonly ExpandedSpellOperation[];
}

function oppositeSide(side: BattleSideId): BattleSideId {
  return side === 'attacker' ? 'defender' : 'attacker';
}

function currentHealth(stack: BattleStackState): number {
  if (stack.count <= 0) return 0;
  return (stack.count - 1) * getCreature(stack.creatureId).health + stack.topHealth;
}

function maximumHealth(stack: BattleStackState): number {
  return stack.initialCount * getCreature(stack.creatureId).health;
}

function isWoundedLiving(stack: BattleStackState): boolean {
  return stack.count > 0 && currentHealth(stack) < maximumHealth(stack);
}

function isMassTarget(spell: ExpandedSpellDefinition): boolean {
  return spell.target === 'all' || spell.target === 'allAllies' || spell.target === 'allEnemies';
}

function hasSelectedTarget(spell: ExpandedSpellDefinition): boolean {
  return spell.target === 'ally' || spell.target === 'enemy';
}

export function getExpandedSpellTargets(
  spellId: string,
  context: ExpandedSpellTargetContext,
): string[] {
  const spell = getExpandedSpell(spellId);
  const enemySide = oppositeSide(context.casterSide);
  const revivable = new Set(context.revivableStackIds ?? []);

  if (spell.target === 'caster' || spell.target === 'enemyHero') return [];

  return context.stacks.filter((stack) => {
    if (spell.target === 'all') return stack.count > 0;
    if (spell.target === 'allEnemies') return stack.side === enemySide && stack.count > 0;
    if (spell.target === 'enemy') return stack.side === enemySide && stack.count > 0;
    if (stack.side !== context.casterSide) return false;

    if (spell.effect.kind === 'restoration') {
      if (isWoundedLiving(stack)) return true;
      return spell.effect.canRevive && spell.target === 'ally' && stack.count <= 0 &&
        stack.initialCount > 0 && revivable.has(stack.id);
    }
    return stack.count > 0;
  }).map((stack) => stack.id);
}

function scaledAmount(base: number, perPower: number, spellPower: number): number {
  return Math.max(0, Math.floor(base + perPower * spellPower));
}

function chainTargets(
  initialTarget: BattleStackState,
  context: ExpandedSpellCastContext,
  effect: Extract<ExpandedSpellEffect, { kind: 'chainDamage' }>,
): BattleStackState[] {
  const enemySide = oppositeSide(context.casterSide);
  const enemies = context.stacks.filter((stack) => stack.side === enemySide && stack.count > 0);
  const chain = [initialTarget];
  const visited = new Set(chain.map((stack) => stack.id));

  while (chain.length < effect.maxTargets) {
    const previous = chain[chain.length - 1];
    if (!previous) break;
    const next = enemies
      .filter((stack) => !visited.has(stack.id))
      .sort((a, b) => hexDistance(previous.position, a.position) - hexDistance(previous.position, b.position) ||
        a.id.localeCompare(b.id))[0];
    if (!next) break;
    chain.push(next);
    visited.add(next.id);
  }
  return chain;
}

function healingOperation(
  stack: BattleStackState,
  effect: Extract<ExpandedSpellEffect, { kind: 'restoration' }>,
  spellPower: number,
): ExpandedSpellOperation {
  const amount = Math.min(
    scaledAmount(effect.baseAmount, effect.powerAmount, spellPower),
    Math.max(0, maximumHealth(stack) - currentHealth(stack)),
  );
  return { kind: 'heal', targetId: stack.id, amount, canRevive: effect.canRevive };
}

export function createExpandedSpellPlan(
  spellId: string,
  context: ExpandedSpellCastContext,
): ExpandedSpellPlan {
  const spell = getExpandedSpell(spellId);
  const caster = context.heroes[context.casterSide];
  if (!caster) throw new Error('The casting side has no hero');
  if (!caster.spells.includes(spell.id)) throw new Error(`The caster does not know ${spell.name}`);
  if (spell.oncePerRound && caster.castThisRound) {
    throw new Error('The caster has already cast a spell this round');
  }
  if (caster.mana < spell.manaCost) throw new Error('Not enough mana');
  const spellPower = caster.primarySkills.spellPower;
  if (!Number.isInteger(spellPower) || spellPower < 0) {
    throw new Error('Spell Power must be a non-negative integer');
  }

  let targetIds = getExpandedSpellTargets(spell.id, context);
  if (hasSelectedTarget(spell)) {
    if (!context.targetId) throw new Error(`${spell.name} requires a selected stack`);
    if (!targetIds.includes(context.targetId)) throw new Error(`Invalid target for ${spell.name}`);
    targetIds = [context.targetId];
  } else {
    if (context.targetId !== undefined) throw new Error(`${spell.name} does not use a selected stack`);
    if (isMassTarget(spell) && targetIds.length === 0) throw new Error(`No valid targets for ${spell.name}`);
  }

  const stacksById = new Map(context.stacks.map((stack) => [stack.id, stack]));
  const effect = spell.effect;
  let operations: ExpandedSpellOperation[];

  if (effect.kind === 'chainDamage') {
    const initialTarget = stacksById.get(targetIds[0] ?? '');
    if (!initialTarget) throw new Error(`Invalid target for ${spell.name}`);
    const chain = chainTargets(initialTarget, context, effect);
    const initialDamage = scaledAmount(effect.baseDamage, effect.powerDamage, spellPower);
    targetIds = chain.map((stack) => stack.id);
    operations = chain.map((stack, index) => ({
      kind: 'damage',
      targetId: stack.id,
      amount: Math.max(1, Math.floor(initialDamage * effect.falloff ** index)),
    }));
  } else if (effect.kind === 'massDamage') {
    const amount = Math.max(1, scaledAmount(effect.baseDamage, effect.powerDamage, spellPower));
    operations = targetIds.map((targetId) => ({ kind: 'damage', targetId, amount }));
  } else if (effect.kind === 'status') {
    operations = targetIds.map((targetId) => ({
      kind: 'status',
      targetId,
      statusId: spell.id,
      duration: effect.duration,
      modifiers: { ...effect.modifiers },
    }));
  } else if (effect.kind === 'restoration') {
    operations = targetIds.map((targetId) => {
      const stack = stacksById.get(targetId);
      if (!stack) throw new Error(`Invalid target for ${spell.name}`);
      return healingOperation(stack, effect, spellPower);
    });
  } else if (effect.kind === 'manaRestore') {
    if (caster.mana >= caster.maxMana) throw new Error('The caster already has full mana');
    const capacity = Math.max(0, caster.maxMana - (caster.mana - spell.manaCost));
    operations = [{
      kind: 'manaRestore',
      side: context.casterSide,
      amount: Math.min(scaledAmount(effect.baseAmount, effect.powerAmount, spellPower), capacity),
    }];
  } else {
    const enemySide = oppositeSide(context.casterSide);
    const enemy = context.heroes[enemySide];
    if (!enemy) throw new Error('The enemy side has no hero');
    if (enemy.mana <= 0) throw new Error('The enemy hero has no mana to affect');
    const amount = Math.min(
      enemy.mana,
      scaledAmount(effect.baseAmount, effect.powerAmount, spellPower),
    );
    if (effect.kind === 'manaBurn') {
      operations = [{ kind: 'manaBurn', side: enemySide, amount }];
    } else {
      const capacity = Math.max(0, caster.maxMana - (caster.mana - spell.manaCost));
      operations = [
        { kind: 'manaDrain', side: enemySide, amount },
        { kind: 'manaRestore', side: context.casterSide, amount: Math.min(amount, capacity) },
      ];
    }
  }

  return {
    spellId: spell.id,
    casterSide: context.casterSide,
    manaCost: spell.manaCost,
    consumeCast: true,
    targetIds,
    operations,
  };
}
