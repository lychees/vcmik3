import {
  FACTIONS,
  NEW_BUILDINGS,
  NEW_CREATURES,
  NEW_HEROES,
} from './factions';
import type {
  BuildingDefinition,
  CreatureDefinition,
  FactionDefinition,
  HeroDefinition,
  ResourceBundle,
  ResourceCost,
  ResourceType,
  SpellDefinition,
  TerrainDefinition,
  TerrainType,
} from './types';

export const RESOURCE_TYPES = [
  'gold',
  'wood',
  'ore',
  'crystal',
  'gems',
  'mercury',
  'sulfur',
] as const satisfies readonly ResourceType[];

export const TERRAIN: Record<TerrainType, TerrainDefinition> = {
  grass: { id: 'grass', name: 'Meadow', movementCost: 100, passable: true, color: 0x6f9f55 },
  dirt: { id: 'dirt', name: 'Highlands', movementCost: 100, passable: true, color: 0xa58b5b },
  forest: { id: 'forest', name: 'Forest', movementCost: 125, passable: true, color: 0x355f3d },
  swamp: { id: 'swamp', name: 'Wetland', movementCost: 175, passable: true, color: 0x667557 },
  sand: { id: 'sand', name: 'Badlands', movementCost: 150, passable: true, color: 0xc2aa70 },
  water: { id: 'water', name: 'Water', movementCost: Number.POSITIVE_INFINITY, passable: false, color: 0x397a9b },
  mountain: { id: 'mountain', name: 'Mountains', movementCost: Number.POSITIVE_INFINITY, passable: false, color: 0x74756f },
};

export const CREATURES: Record<string, CreatureDefinition> = {
  militia: {
    id: 'militia', name: 'Militia', faction: 'Haven', tier: 1,
    attack: 3, defense: 4, damage: [1, 3], health: 8, speed: 4, shots: 0,
    cost: { gold: 55 }, growth: 14, abilities: ['retaliation'],
  },
  archer: {
    id: 'archer', name: 'Longbow Archer', faction: 'Haven', tier: 2,
    attack: 6, defense: 3, damage: [2, 4], health: 10, speed: 5, shots: 12,
    cost: { gold: 110 }, growth: 9, abilities: ['ranged'],
  },
  griffin: {
    id: 'griffin', name: 'Storm Griffin', faction: 'Haven', tier: 3,
    attack: 8, defense: 8, damage: [3, 6], health: 25, speed: 7, shots: 0,
    cost: { gold: 220 }, growth: 6, abilities: ['flying', 'retaliation'],
  },
  cavalier: {
    id: 'cavalier', name: 'Sun Cavalier', faction: 'Haven', tier: 4,
    attack: 12, defense: 11, damage: [8, 12], health: 55, speed: 8, shots: 0,
    cost: { gold: 420 }, growth: 4, abilities: ['doubleStrike'],
  },
  sprite: {
    id: 'sprite', name: 'Glimmer Sprite', faction: 'Grove', tier: 1,
    attack: 4, defense: 2, damage: [1, 3], health: 5, speed: 7, shots: 0,
    cost: { gold: 50 }, growth: 16, abilities: ['flying'],
  },
  ranger: {
    id: 'ranger', name: 'Thorn Ranger', faction: 'Grove', tier: 2,
    attack: 7, defense: 4, damage: [3, 5], health: 12, speed: 6, shots: 16,
    cost: { gold: 130 }, growth: 9, abilities: ['ranged'],
  },
  unicorn: {
    id: 'unicorn', name: 'Moon Unicorn', faction: 'Grove', tier: 3,
    attack: 10, defense: 10, damage: [6, 10], health: 40, speed: 8, shots: 0,
    cost: { gold: 320, gems: 1 }, growth: 5, abilities: ['spellResistance'],
  },
  dragon: {
    id: 'dragon', name: 'Verdant Dragon', faction: 'Grove', tier: 4,
    attack: 16, defense: 16, damage: [15, 25], health: 110, speed: 9, shots: 0,
    cost: { gold: 950, crystal: 2 }, growth: 2, abilities: ['flying', 'spellResistance'],
  },
  imp: {
    id: 'imp', name: 'Cinder Imp', faction: 'Ember', tier: 1,
    attack: 4, defense: 2, damage: [1, 3], health: 6, speed: 6, shots: 0,
    cost: { gold: 45 }, growth: 16, abilities: ['flying'],
  },
  hellhound: {
    id: 'hellhound', name: 'Hellhound', faction: 'Ember', tier: 2,
    attack: 7, defense: 4, damage: [3, 5], health: 14, speed: 8, shots: 0,
    cost: { gold: 135 }, growth: 9, abilities: ['doubleStrike'],
  },
  ifrit: {
    id: 'ifrit', name: 'Ifrit', faction: 'Ember', tier: 3,
    attack: 10, defense: 10, damage: [6, 10], health: 40, speed: 8, shots: 0,
    cost: { gold: 350, sulfur: 1 }, growth: 5, abilities: ['flying'],
  },
  pitFiend: {
    id: 'pitFiend', name: 'Pit Fiend', faction: 'Ember', tier: 4,
    attack: 15, defense: 15, damage: [14, 22], health: 100, speed: 8, shots: 0,
    cost: { gold: 900, sulfur: 3 }, growth: 2, abilities: ['regeneration'],
  },
  lizardman: {
    id: 'lizardman', name: 'Mire Lizardman', faction: 'Mire', tier: 1,
    attack: 4, defense: 5, damage: [2, 3], health: 10, speed: 4, shots: 0,
    cost: { gold: 65 }, growth: 12, abilities: ['retaliation'],
  },
  gorgon: {
    id: 'gorgon', name: 'Bog Gorgon', faction: 'Mire', tier: 2,
    attack: 7, defense: 8, damage: [3, 6], health: 24, speed: 5, shots: 0,
    cost: { gold: 160, mercury: 1 }, growth: 8, abilities: ['regeneration'],
  },
  wyvern: {
    id: 'wyvern', name: 'Marsh Wyvern', faction: 'Mire', tier: 3,
    attack: 11, defense: 9, damage: [7, 11], health: 45, speed: 8, shots: 0,
    cost: { gold: 360, mercury: 1 }, growth: 5, abilities: ['flying'],
  },
  basilisk: {
    id: 'basilisk', name: 'Basilisk', faction: 'Mire', tier: 4,
    attack: 14, defense: 16, damage: [12, 20], health: 105, speed: 6, shots: 0,
    cost: { gold: 875, crystal: 2 }, growth: 2, abilities: ['regeneration', 'spellResistance'],
  },
  ...NEW_CREATURES,
};

export const BUILDINGS: Record<string, BuildingDefinition> = {
  townHall: {
    id: 'townHall', name: 'Town Hall', description: 'Provides 500 gold each day.',
    cost: { gold: 1500, wood: 5, ore: 5 }, prerequisites: [], dailyIncome: { gold: 500 },
  },
  capitol: {
    id: 'capitol', name: 'Capitol', description: 'Provides 1,000 additional gold each day.',
    cost: { gold: 5000, wood: 5, ore: 5, crystal: 3 }, prerequisites: ['townHall'], dailyIncome: { gold: 1000 },
  },
  market: {
    id: 'market', name: 'Market', description: 'Provides 250 gold in daily trade.',
    cost: { gold: 800, wood: 5 }, prerequisites: ['townHall'], dailyIncome: { gold: 250 },
  },
  fort: {
    id: 'fort', name: 'Fort', description: 'Unlocks military dwellings and protects the garrison.',
    cost: { gold: 1200, wood: 10, ore: 10 }, prerequisites: ['townHall'],
  },
  mageGuild: {
    id: 'mageGuild', name: 'Mage Guild', description: 'A repository for adventure and battle magic.',
    cost: { gold: 1200, wood: 5, ore: 5, mercury: 2 }, prerequisites: ['townHall'],
  },
  militiaBarracks: {
    id: 'militiaBarracks', name: 'Militia Barracks', description: 'Recruit Militia.',
    cost: { gold: 400, wood: 5 }, prerequisites: ['fort'], creatureId: 'militia',
  },
  archeryRange: {
    id: 'archeryRange', name: 'Archery Range', description: 'Recruit Longbow Archers.',
    cost: { gold: 700, wood: 8 }, prerequisites: ['fort'], creatureId: 'archer',
  },
  griffinTower: {
    id: 'griffinTower', name: 'Griffin Tower', description: 'Recruit Storm Griffins.',
    cost: { gold: 1200, wood: 5, ore: 8 }, prerequisites: ['archeryRange'], creatureId: 'griffin',
  },
  joustingArena: {
    id: 'joustingArena', name: 'Jousting Arena', description: 'Recruit Sun Cavaliers.',
    cost: { gold: 2200, wood: 10, ore: 10, crystal: 2 }, prerequisites: ['griffinTower'], creatureId: 'cavalier',
  },
  spriteGlade: {
    id: 'spriteGlade', name: 'Sprite Glade', description: 'Recruit Glimmer Sprites.',
    cost: { gold: 400, wood: 5 }, prerequisites: ['fort'], creatureId: 'sprite',
  },
  rangerLodge: {
    id: 'rangerLodge', name: 'Ranger Lodge', description: 'Recruit Thorn Rangers.',
    cost: { gold: 750, wood: 8 }, prerequisites: ['fort'], creatureId: 'ranger',
  },
  unicornGrove: {
    id: 'unicornGrove', name: 'Unicorn Grove', description: 'Recruit Moon Unicorns.',
    cost: { gold: 1400, wood: 6, gems: 3 }, prerequisites: ['rangerLodge'], creatureId: 'unicorn',
  },
  dragonCliffs: {
    id: 'dragonCliffs', name: 'Dragon Cliffs', description: 'Recruit Verdant Dragons.',
    cost: { gold: 3500, wood: 10, ore: 10, crystal: 6 }, prerequisites: ['unicornGrove'], creatureId: 'dragon',
  },
  impWarrens: {
    id: 'impWarrens', name: 'Imp Warrens', description: 'Recruit Cinder Imps.',
    cost: { gold: 400, wood: 5 }, prerequisites: ['fort'], creatureId: 'imp',
  },
  hellhoundKennels: {
    id: 'hellhoundKennels', name: 'Hellhound Kennels', description: 'Recruit Hellhounds.',
    cost: { gold: 750, wood: 6, ore: 4, sulfur: 1 }, prerequisites: ['impWarrens'], creatureId: 'hellhound',
  },
  ifritSpire: {
    id: 'ifritSpire', name: 'Ifrit Spire', description: 'Recruit Ifrits.',
    cost: { gold: 1400, ore: 6, sulfur: 3 }, prerequisites: ['hellhoundKennels'], creatureId: 'ifrit',
  },
  pitFiendAbyss: {
    id: 'pitFiendAbyss', name: 'Pit Fiend Abyss', description: 'Recruit Pit Fiends.',
    cost: { gold: 3200, wood: 8, ore: 8, sulfur: 6 }, prerequisites: ['ifritSpire'], creatureId: 'pitFiend',
  },
  lizardmanDen: {
    id: 'lizardmanDen', name: 'Lizardman Den', description: 'Recruit Mire Lizardmen.',
    cost: { gold: 450, wood: 5 }, prerequisites: ['fort'], creatureId: 'lizardman',
  },
  gorgonPen: {
    id: 'gorgonPen', name: 'Gorgon Pen', description: 'Recruit Bog Gorgons.',
    cost: { gold: 800, wood: 6, ore: 4, mercury: 1 }, prerequisites: ['lizardmanDen'], creatureId: 'gorgon',
  },
  wyvernRoost: {
    id: 'wyvernRoost', name: 'Wyvern Roost', description: 'Recruit Marsh Wyverns.',
    cost: { gold: 1350, wood: 8, mercury: 2 }, prerequisites: ['gorgonPen'], creatureId: 'wyvern',
  },
  basiliskPit: {
    id: 'basiliskPit', name: 'Basilisk Pit', description: 'Recruit Basilisks.',
    cost: { gold: 3000, wood: 8, ore: 8, crystal: 4, mercury: 2 }, prerequisites: ['wyvernRoost'], creatureId: 'basilisk',
  },
  ...NEW_BUILDINGS,
};

export const SPELLS: Record<string, SpellDefinition> = {
  magicArrow: { id: 'magicArrow', name: 'Magic Arrow', school: 'air', level: 1, manaCost: 5, target: 'enemy', effect: 'damage', power: 12 },
  stoneSkin: { id: 'stoneSkin', name: 'Stone Skin', school: 'earth', level: 1, manaCost: 6, target: 'ally', effect: 'shield', power: 3 },
  haste: { id: 'haste', name: 'Haste', school: 'air', level: 1, manaCost: 6, target: 'ally', effect: 'haste', power: 3 },
  slow: { id: 'slow', name: 'Slow', school: 'earth', level: 2, manaCost: 8, target: 'enemy', effect: 'slow', power: 3 },
  cure: { id: 'cure', name: 'Cure', school: 'water', level: 2, manaCost: 8, target: 'ally', effect: 'heal', power: 20 },
  fireball: { id: 'fireball', name: 'Fireball', school: 'fire', level: 3, manaCost: 15, target: 'allEnemies', effect: 'damage', power: 30 },
  bless: { id: 'bless', name: 'Bless', school: 'water', level: 1, manaCost: 5, target: 'ally', effect: 'bless', power: 2 },
};

export const HEROES: Record<string, HeroDefinition> = {
  aveline: {
    id: 'aveline', name: 'Aveline', faction: 'Haven', specialty: 'Logistics',
    primarySkills: { attack: 2, defense: 2, spellPower: 1, knowledge: 2 },
    startingArmy: [{ creatureId: 'militia', count: 24 }, { creatureId: 'archer', count: 12 }],
    spells: ['haste', 'magicArrow'],
  },
  rowan: {
    id: 'rowan', name: 'Rowan', faction: 'Grove', specialty: 'Scouting',
    primarySkills: { attack: 1, defense: 2, spellPower: 2, knowledge: 2 },
    startingArmy: [{ creatureId: 'sprite', count: 28 }, { creatureId: 'ranger', count: 10 }],
    spells: ['cure', 'stoneSkin'],
  },
  seraphine: {
    id: 'seraphine', name: 'Seraphine', faction: 'Ember', specialty: 'Fire Magic',
    primarySkills: { attack: 2, defense: 1, spellPower: 3, knowledge: 2 },
    startingArmy: [{ creatureId: 'imp', count: 28 }, { creatureId: 'hellhound', count: 8 }],
    spells: ['fireball', 'magicArrow'],
  },
  morven: {
    id: 'morven', name: 'Morven', faction: 'Mire', specialty: 'Swamp Lore',
    primarySkills: { attack: 1, defense: 3, spellPower: 2, knowledge: 2 },
    startingArmy: [{ creatureId: 'lizardman', count: 24 }, { creatureId: 'gorgon', count: 8 }],
    spells: ['slow', 'stoneSkin'],
  },
  ...NEW_HEROES,
};

export { FACTIONS };

export function emptyResources(): ResourceBundle {
  return { gold: 0, wood: 0, ore: 0, crystal: 0, gems: 0, mercury: 0, sulfur: 0 };
}

export function startingResources(): ResourceBundle {
  return { gold: 6000, wood: 25, ore: 25, crystal: 8, gems: 8, mercury: 8, sulfur: 8 };
}

export function getFaction(id: string): FactionDefinition {
  const faction = Object.hasOwn(FACTIONS, id) ? FACTIONS[id as keyof typeof FACTIONS] : undefined;
  if (!faction) throw new Error(`Unknown faction: ${id}`);
  return faction;
}

export function getCreature(id: string): CreatureDefinition {
  const creature = Object.hasOwn(CREATURES, id) ? CREATURES[id] : undefined;
  if (!creature) throw new Error(`Unknown creature: ${id}`);
  return creature;
}

export function getBuilding(id: string): BuildingDefinition {
  const building = Object.hasOwn(BUILDINGS, id) ? BUILDINGS[id] : undefined;
  if (!building) throw new Error(`Unknown building: ${id}`);
  return building;
}

export function getSpell(id: string): SpellDefinition {
  const spell = Object.hasOwn(SPELLS, id) ? SPELLS[id] : undefined;
  if (!spell) throw new Error(`Unknown spell: ${id}`);
  return spell;
}

export function getHeroDefinition(id: string): HeroDefinition {
  const hero = Object.hasOwn(HEROES, id) ? HEROES[id] : undefined;
  if (!hero) throw new Error(`Unknown hero: ${id}`);
  return hero;
}

export function getTerrain(id: TerrainType): TerrainDefinition {
  const terrain = Object.hasOwn(TERRAIN, id) ? TERRAIN[id] : undefined;
  if (!terrain) throw new Error(`Unknown terrain: ${id}`);
  return terrain;
}

export function canAfford(resources: ResourceBundle, cost: ResourceCost): boolean {
  return RESOURCE_TYPES.every((resource) => resources[resource] >= (cost[resource] ?? 0));
}

export function spendResources(resources: ResourceBundle, cost: ResourceCost): boolean {
  if (!canAfford(resources, cost)) return false;
  for (const resource of RESOURCE_TYPES) resources[resource] -= cost[resource] ?? 0;
  return true;
}

export function addResources(resources: ResourceBundle, gain: ResourceCost): void {
  for (const resource of RESOURCE_TYPES) resources[resource] += gain[resource] ?? 0;
}
