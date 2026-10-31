import { getCreature } from './content';
import type { ArmyStack } from './types';

export const MAX_ARMY_STACKS = 7;

export function cloneArmy(army: readonly ArmyStack[]): ArmyStack[] {
  return army.map((stack) => ({ ...stack }));
}

export function normalizeArmy(army: readonly ArmyStack[]): ArmyStack[] {
  const counts = new Map<string, number>();
  for (const stack of army) {
    if (!Number.isInteger(stack.count) || stack.count < 0) throw new Error('Army counts must be non-negative integers');
    getCreature(stack.creatureId);
    if (stack.count > 0) counts.set(stack.creatureId, (counts.get(stack.creatureId) ?? 0) + stack.count);
  }
  return [...counts].map(([creatureId, count]) => ({ creatureId, count }));
}

export function armySize(army: readonly ArmyStack[]): number {
  return army.reduce((total, stack) => total + stack.count, 0);
}

export function armyPower(army: readonly ArmyStack[]): number {
  return army.reduce((total, stack) => {
    const creature = getCreature(stack.creatureId);
    return total + stack.count * (creature.health + creature.attack * 2 + (creature.damage[0] + creature.damage[1]) * 2);
  }, 0);
}

export function addToArmy(army: ArmyStack[], creatureId: string, count: number): boolean {
  if (!Number.isInteger(count) || count <= 0) return false;
  getCreature(creatureId);
  const existing = army.find((stack) => stack.creatureId === creatureId);
  if (existing) {
    existing.count += count;
    return true;
  }
  if (army.length >= MAX_ARMY_STACKS) return false;
  army.push({ creatureId, count });
  return true;
}

export function removeFromArmy(army: ArmyStack[], creatureId: string, count: number): boolean {
  if (!Number.isInteger(count) || count <= 0) return false;
  const available = army
    .filter((stack) => stack.creatureId === creatureId)
    .reduce((total, stack) => total + stack.count, 0);
  if (available < count) return false;
  let remaining = count;
  for (let index = army.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const stack = army[index];
    if (!stack || stack.creatureId !== creatureId) continue;
    const removed = Math.min(stack.count, remaining);
    stack.count -= removed;
    remaining -= removed;
    if (stack.count === 0) army.splice(index, 1);
  }
  return true;
}

export function isSurvivingArmy(original: readonly ArmyStack[], surviving: readonly ArmyStack[]): boolean {
  try {
    const before = new Map(normalizeArmy(original).map((stack) => [stack.creatureId, stack.count]));
    const after = normalizeArmy(surviving);
    return after.every((stack) => stack.count <= (before.get(stack.creatureId) ?? 0));
  } catch {
    return false;
  }
}
