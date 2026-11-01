import type { ExpandedSpellId, ExpandedStackModifiers } from '../game/spells';
import type { BattleResult, PrimarySkills } from '../game/types';

export type BattleSideId = 'attacker' | 'defender';
export type StackStatus = 'haste' | 'slow' | 'shield' | 'bless';

export interface ExpandedStackStatus {
  duration: number;
  modifiers: ExpandedStackModifiers;
}

export interface HexCoord {
  x: number;
  y: number;
}

export interface HexPath {
  path: HexCoord[];
  cost: number;
}

export interface ReachableHex extends HexPath {
  position: HexCoord;
}

export interface BattleObstacle {
  position: HexCoord;
  kind: 'rock' | 'tree' | 'wall';
}

export interface BattleStackState {
  id: string;
  side: BattleSideId;
  creatureId: string;
  initialCount: number;
  count: number;
  topHealth: number;
  position: HexCoord;
  shots: number;
  defending: boolean;
  waited: boolean;
  retaliationsUsed: number;
  statuses: Partial<Record<StackStatus, number>>;
  expandedStatuses?: Partial<Record<ExpandedSpellId, ExpandedStackStatus>>;
}

export interface BattleHeroState {
  heroId: string;
  primarySkills: PrimarySkills;
  mana: number;
  maxMana: number;
  spells: string[];
  castThisRound: boolean;
}

export interface CombatLogEntry {
  id: number;
  round: number;
  text: string;
  tone: 'neutral' | 'attacker' | 'defender' | 'magic' | 'defeat';
}

export interface BattleState {
  round: number;
  activeStackId: string | null;
  stacks: BattleStackState[];
  initiative: string[];
  heroes: Partial<Record<BattleSideId, BattleHeroState>>;
  obstacles: BattleObstacle[];
  log: CombatLogEntry[];
  result: BattleResult | null;
}

export interface DamagePreview {
  kind: 'melee' | 'ranged';
  min: number;
  max: number;
  attack: number;
  defense: number;
  rangePenalty: boolean;
  obstaclePenalty: boolean;
  wallPenalty: boolean;
  path: HexPath | null;
  canRetaliate: boolean;
}

export type BattleEvent =
  | { kind: 'move'; stackId: string; path: HexCoord[] }
  | {
      kind: 'attack';
      attackerId: string;
      targetId: string;
      attackType: 'melee' | 'ranged';
      damage: number;
      killed: number;
      retaliation: boolean;
    }
  | {
      kind: 'spell';
      side: BattleSideId;
      spellId: string;
      targetIds: string[];
      amounts: Record<string, number>;
    }
  | { kind: 'wait' | 'defend'; stackId: string }
  | { kind: 'round'; round: number }
  | { kind: 'end'; result: BattleResult };

export type BattleActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface BattleEngineOptions {
  obstacles?: BattleObstacle[];
  attackerPositions?: HexCoord[];
  defenderPositions?: HexCoord[];
  maxRounds?: number;
}

