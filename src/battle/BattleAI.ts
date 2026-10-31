import { getCreature } from '../game/content';
import type { BattleSetup } from '../game/types';
import { BattleEngine } from './BattleEngine';
import { hexDistance } from './hex';
import type {
  BattleActionResult,
  BattleEngineOptions,
  BattleEvent,
  BattleSideId,
  BattleStackState,
  HexCoord,
} from './types';

export interface AiSpellDecision {
  spellId: string;
  targetId?: string;
}

export interface AiActionDecision {
  type: 'attack' | 'move' | 'wait' | 'defend';
  targetId?: string;
  destination?: HexCoord;
}

interface ScoredSpell extends AiSpellDecision {
  score: number;
}

function averageDamage(stack: BattleStackState): number {
  const creature = getCreature(stack.creatureId);
  return stack.count * (creature.damage[0] + creature.damage[1]) / 2;
}

function enemyThreat(stack: BattleStackState): number {
  const creature = getCreature(stack.creatureId);
  return averageDamage(stack) + creature.tier * 8 + (creature.abilities.includes('ranged') ? 18 : 0);
}

export function chooseAiSpell(engine: BattleEngine, side: BattleSideId): AiSpellDecision | null {
  const hero = engine.getHero(side);
  const active = engine.getActiveStack();
  if (!hero || !active || active.side !== side || hero.castThisRound) return null;
  const candidates: ScoredSpell[] = [];
  for (const spell of engine.getSpellbook(side)) {
    if (hero.mana < spell.manaCost) continue;
    const targets = engine.getSpellTargets(spell.id, side);
    if (spell.target === 'allEnemies') {
      const enemies = engine.getLivingStacks(side === 'attacker' ? 'defender' : 'attacker');
      if (enemies.length === 0) continue;
      const rawAmount = engine.getSpellAmount(spell.id, side);
      const usefulDamage = enemies.reduce((total, target) => {
        const resistance = getCreature(target.creatureId).abilities.includes('spellResistance') ? 0.5 : 1;
        return total + Math.min(engine.getStackHealth(target), rawAmount * resistance);
      }, 0);
      const kills = enemies.filter((target) => engine.getStackHealth(target) <= rawAmount).length;
      candidates.push({ spellId: spell.id, score: usefulDamage * 0.8 + kills * 90 + enemies.length * 12 });
      continue;
    }
    for (const targetId of targets) {
      const target = engine.getStack(targetId);
      if (!target) continue;
      const amount = engine.getSpellAmount(spell.id, side);
      let score = 0;
      if (spell.effect === 'damage') {
        const resistance = getCreature(target.creatureId).abilities.includes('spellResistance') ? 0.5 : 1;
        const damage = amount * resistance;
        score = Math.min(engine.getStackHealth(target), damage) * 1.25 + enemyThreat(target) * 0.2;
        if (damage >= engine.getStackHealth(target)) score += 180;
      } else if (spell.effect === 'heal') {
        const missing = engine.getStackMaxHealth(target) - engine.getStackHealth(target);
        score = Math.min(missing, amount) * 1.4 + (target.count === 0 ? 220 : 0) + enemyThreat(target) * 0.15;
      } else if (spell.effect === 'haste') {
        score = 20 + averageDamage(target) * 0.3 + Math.max(0, 7 - engine.getStackSpeed(target)) * 8;
      } else if (spell.effect === 'slow') {
        score = 18 + enemyThreat(target) * 0.2 + engine.getStackSpeed(target) * 4;
      } else if (spell.effect === 'shield') {
        score = 16 + enemyThreat(target) * 0.35 + (target.defending ? -20 : 0);
      } else if (spell.effect === 'bless') {
        score = 15 + averageDamage(target) * 0.45;
      }
      candidates.push({ spellId: spell.id, targetId, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score || a.spellId.localeCompare(b.spellId) ||
    (a.targetId ?? '').localeCompare(b.targetId ?? ''));
  const best = candidates[0];
  return best && best.score >= 24 ? { spellId: best.spellId, targetId: best.targetId } : null;
}

export function chooseAiAction(engine: BattleEngine): AiActionDecision {
  const active = engine.getActiveStack();
  if (!active) return { type: 'defend' };
  const enemies = engine.getLivingStacks(active.side === 'attacker' ? 'defender' : 'attacker');
  const attacks = enemies.map((target) => {
    const preview = engine.getAttackPreview(target.id);
    if (!preview) return null;
    const expected = (preview.min + preview.max) / 2;
    const health = engine.getStackHealth(target);
    const retaliationRisk = preview.canRetaliate
      ? Math.min(engine.getStackHealth(active), averageDamage(target) * 0.65)
      : 0;
    let score = Math.min(expected, health) * 4 + enemyThreat(target) - retaliationRisk * 1.5;
    if (expected >= health) score += 260;
    if (getCreature(target.creatureId).abilities.includes('ranged')) score += 30;
    score -= (preview.path?.cost ?? 0) * 0.4;
    return { target, score };
  }).filter((choice): choice is { target: BattleStackState; score: number } => choice !== null)
    .sort((a, b) => b.score - a.score || a.target.id.localeCompare(b.target.id));
  const bestAttack = attacks[0];
  if (bestAttack) return { type: 'attack', targetId: bestAttack.target.id };
  if (enemies.length === 0) return { type: 'defend' };

  const target = [...enemies].sort((a, b) => {
    const distanceA = hexDistance(active.position, a.position);
    const distanceB = hexDistance(active.position, b.position);
    const healthRatioA = engine.getStackHealth(a) / engine.getStackMaxHealth(a);
    const healthRatioB = engine.getStackHealth(b) / engine.getStackMaxHealth(b);
    return distanceA - distanceB || healthRatioA - healthRatioB || a.id.localeCompare(b.id);
  })[0];
  if (!target) return { type: 'defend' };
  const currentDistance = hexDistance(active.position, target.position);
  const destinations = engine.getReachable(active.id).map((reachable) => {
    const distance = hexDistance(reachable.position, target.position);
    const adjacentThreats = enemies.filter((enemy) => hexDistance(reachable.position, enemy.position) === 1).length;
    const rangedPenalty = getCreature(active.creatureId).abilities.includes('ranged') && active.shots > 0
      ? adjacentThreats * 25
      : 0;
    return {
      destination: reachable.position,
      distance,
      score: distance * 30 + reachable.cost * 0.15 + rangedPenalty,
    };
  }).sort((a, b) => a.score - b.score || a.destination.y - b.destination.y || a.destination.x - b.destination.x);
  const bestDestination = destinations[0];
  if (bestDestination && bestDestination.distance < currentDistance) {
    return { type: 'move', destination: bestDestination.destination };
  }
  return { type: 'defend' };
}

export function performAiTurn(engine: BattleEngine): BattleActionResult<BattleEvent[]> {
  const active = engine.getActiveStack();
  if (!active) {
    return engine.getResult()
      ? { ok: true, value: [{ kind: 'end', result: engine.getResult() as NonNullable<ReturnType<BattleEngine['getResult']>> }] }
      : { ok: false, error: 'There is no active stack for the AI' };
  }
  const events: BattleEvent[] = [];
  const spell = chooseAiSpell(engine, active.side);
  if (spell) {
    const cast = engine.castSpell(spell.spellId, active.side, spell.targetId);
    if (cast.ok) events.push(...cast.value);
    if (engine.getResult()) return { ok: true, value: events };
  }
  const action = chooseAiAction(engine);
  let result: BattleActionResult<BattleEvent[]>;
  if (action.type === 'attack' && action.targetId) result = engine.attack(action.targetId);
  else if (action.type === 'move' && action.destination) result = engine.move(action.destination);
  else if (action.type === 'wait') result = engine.wait();
  else result = engine.defend();
  if (!result.ok) return result;
  events.push(...result.value);
  return { ok: true, value: events };
}

export function runTacticalAutoBattle(setup: BattleSetup, options: BattleEngineOptions = {}): BattleEngine {
  const engine = new BattleEngine(setup, options);
  let activations = 0;
  while (!engine.getResult() && activations < 5000) {
    const result = performAiTurn(engine);
    if (!result.ok) throw new Error(`AI battle stalled: ${result.error}`);
    activations += 1;
  }
  if (!engine.getResult()) throw new Error('AI battle exceeded the activation safety limit');
  return engine;
}
