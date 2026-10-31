export type ResourceType =
  | 'gold'
  | 'wood'
  | 'ore'
  | 'crystal'
  | 'gems'
  | 'mercury'
  | 'sulfur';

export type ResourceBundle = Record<ResourceType, number>;
export type ResourceCost = Partial<Record<ResourceType, number>>;

export interface Point {
  x: number;
  y: number;
}

export type TerrainType =
  | 'grass'
  | 'dirt'
  | 'forest'
  | 'swamp'
  | 'sand'
  | 'water'
  | 'mountain';

export interface TerrainDefinition {
  id: TerrainType;
  name: string;
  movementCost: number;
  passable: boolean;
  color: number;
}

export type CreatureAbility =
  | 'ranged'
  | 'flying'
  | 'retaliation'
  | 'doubleStrike'
  | 'regeneration'
  | 'spellResistance';

export interface FactionDefinition {
  id: string;
  name: string;
  townName: string;
  creatureIds: readonly [string, string, string, string];
  buildingIds: readonly [string, string, string, string];
  heroId: string;
}

export interface CreatureDefinition {
  id: string;
  name: string;
  faction: string;
  tier: number;
  attack: number;
  defense: number;
  damage: readonly [number, number];
  health: number;
  speed: number;
  shots: number;
  cost: ResourceCost;
  growth: number;
  abilities: readonly CreatureAbility[];
}

export interface ArmyStack {
  creatureId: string;
  count: number;
}

export interface PrimarySkills {
  attack: number;
  defense: number;
  spellPower: number;
  knowledge: number;
}

export interface HeroDefinition {
  id: string;
  name: string;
  faction: string;
  specialty: string;
  primarySkills: PrimarySkills;
  startingArmy: ArmyStack[];
  spells: string[];
}

export interface HeroState {
  id: string;
  definitionId: string;
  name: string;
  ownerId: string;
  position: Point;
  level: number;
  experience: number;
  primarySkills: PrimarySkills;
  mana: number;
  maxMana: number;
  movementPoints: number;
  maxMovementPoints: number;
  army: ArmyStack[];
  spells: string[];
  alive: boolean;
}

export type SpellSchool = 'air' | 'earth' | 'fire' | 'water';

export interface SpellDefinition {
  id: string;
  name: string;
  school: SpellSchool;
  level: number;
  manaCost: number;
  target: 'self' | 'ally' | 'enemy' | 'allEnemies';
  effect: 'heal' | 'damage' | 'haste' | 'slow' | 'shield' | 'bless';
  power: number;
}

export interface BuildingDefinition {
  id: string;
  name: string;
  description: string;
  cost: ResourceCost;
  prerequisites: string[];
  dailyIncome?: ResourceCost;
  creatureId?: string;
}

export interface TownState {
  id: string;
  name: string;
  ownerId: string;
  faction: string;
  position: Point;
  buildings: string[];
  garrison: ArmyStack[];
  dwellingPools: Record<string, number>;
  builtToday: boolean;
}

interface MapObjectBase {
  id: string;
  position: Point;
  name: string;
}

export interface ResourceObject extends MapObjectBase {
  kind: 'resource';
  resources: ResourceCost;
}

export interface MineObject extends MapObjectBase {
  kind: 'mine';
  ownerId: string | null;
  resource: ResourceType;
  dailyOutput: number;
}

export interface DwellingObject extends MapObjectBase {
  kind: 'dwelling';
  creatureId: string;
  available: number;
}

export interface MonsterObject extends MapObjectBase {
  kind: 'monster';
  army: ArmyStack[];
  experienceReward: number;
  treasure: ResourceCost;
}

export interface TownObject extends MapObjectBase {
  kind: 'town';
  townId: string;
}

export type MapObject =
  | ResourceObject
  | MineObject
  | DwellingObject
  | MonsterObject
  | TownObject;

export interface MapTile {
  x: number;
  y: number;
  terrain: TerrainType;
  road: boolean;
  obstacle: boolean;
  objectId: string | null;
}

export interface AdventureMap {
  seed: string;
  width: number;
  height: number;
  tiles: MapTile[];
  objects: Record<string, MapObject>;
}

export interface PlayerState {
  id: string;
  name: string;
  color: string;
  isAI: boolean;
  resources: ResourceBundle;
}

export interface FogState {
  visible: number[];
  explored: number[];
}

export interface CalendarState {
  day: number;
  week: number;
  month: number;
  dayOfWeek: number;
}

export interface BattleRewards {
  experience: number;
  resources: ResourceCost;
}

export interface BattleSide {
  ownerId: string;
  heroId: string | null;
  primarySkills: PrimarySkills;
  army: ArmyStack[];
}

export interface BattleSetup {
  id: string;
  seed: string;
  source: {
    heroId: string;
    objectId: string;
    kind: 'monster' | 'town';
  };
  attacker: BattleSide;
  defender: BattleSide;
  rewards: BattleRewards;
}

export interface BattleResult {
  setupId: string;
  winner: 'attacker' | 'defender' | 'draw';
  attackerArmy: ArmyStack[];
  defenderArmy: ArmyStack[];
  rewards: BattleRewards;
  rounds: number;
}

export interface GameEvent {
  day: number;
  kind: string;
  message: string;
}

export interface GameState {
  version: 1;
  seed: string;
  rngState: number;
  revision: number;
  map: AdventureMap;
  players: Record<string, PlayerState>;
  playerOrder: string[];
  activePlayerId: string;
  selectedHeroId: string | null;
  heroes: Record<string, HeroState>;
  towns: Record<string, TownState>;
  fog: Record<string, FogState>;
  calendar: CalendarState;
  pendingBattle: BattleSetup | null;
  phase: 'playing' | 'victory' | 'defeat';
  winnerId: string | null;
  log: GameEvent[];
}

export interface PathResult {
  path: Point[];
  cost: number;
}

export interface ReachableTile extends PathResult {
  position: Point;
  tileIndex: number;
}

export interface PathfindingOptions {
  blockedTiles?: ReadonlySet<number>;
  maxCost?: number;
}

export type InteractionResult =
  | { kind: 'none'; message: string }
  | { kind: 'resource'; message: string; resources: ResourceCost }
  | { kind: 'mine'; message: string; ownerId: string }
  | { kind: 'dwelling'; message: string; dwellingId: string }
  | { kind: 'town'; message: string; townId: string }
  | { kind: 'battle'; message: string; setup: BattleSetup };

export interface MovementResult {
  heroId: string;
  path: Point[];
  cost: number;
  movementPoints: number;
  interaction: InteractionResult;
}

export interface TurnSummary {
  calendar: CalendarState;
  events: GameEvent[];
}

export type ActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export type StateListener = (state: Readonly<GameState>) => void;

export interface GameStoreOptions {
  seed?: string;
  storage?: Storage | null;
  autoLoad?: boolean;
}
