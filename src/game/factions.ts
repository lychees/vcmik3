import type {
  BuildingDefinition,
  CreatureDefinition,
  FactionDefinition,
  HeroDefinition,
} from './types';

export const FACTIONS = {
  haven: {
    id: 'haven', name: 'Haven', townName: 'Aster Keep', heroId: 'aveline',
    creatureIds: ['militia', 'archer', 'griffin', 'cavalier'],
    buildingIds: ['militiaBarracks', 'archeryRange', 'griffinTower', 'joustingArena'],
  },
  grove: {
    id: 'grove', name: 'Grove', townName: 'Lunar Glade', heroId: 'rowan',
    creatureIds: ['sprite', 'ranger', 'unicorn', 'dragon'],
    buildingIds: ['spriteGlade', 'rangerLodge', 'unicornGrove', 'dragonCliffs'],
  },
  ember: {
    id: 'ember', name: 'Ember', townName: 'Cinder Bastion', heroId: 'seraphine',
    creatureIds: ['imp', 'hellhound', 'ifrit', 'pitFiend'],
    buildingIds: ['impWarrens', 'hellhoundKennels', 'ifritSpire', 'pitFiendAbyss'],
  },
  mire: {
    id: 'mire', name: 'Mire', townName: 'Sunken Fen', heroId: 'morven',
    creatureIds: ['lizardman', 'gorgon', 'wyvern', 'basilisk'],
    buildingIds: ['lizardmanDen', 'gorgonPen', 'wyvernRoost', 'basiliskPit'],
  },
  tower: {
    id: 'tower', name: 'Tower', townName: 'Astral Spire', heroId: 'solmyr',
    creatureIds: ['gremlin', 'stoneGargoyle', 'genie', 'titan'],
    buildingIds: ['gremlinWorkshop', 'gargoyleParapet', 'geniePavilion', 'titanCloudTemple'],
  },
  necropolis: {
    id: 'necropolis', name: 'Necropolis', townName: 'Veil of Souls', heroId: 'isra',
    creatureIds: ['skeleton', 'zombie', 'vampire', 'ghostDragon'],
    buildingIds: ['skeletonCrypt', 'zombieGraveyard', 'vampireEstate', 'ghostDragonSepulcher'],
  },
  dungeon: {
    id: 'dungeon', name: 'Dungeon', townName: 'Obsidian Depths', heroId: 'darkstorn',
    creatureIds: ['troglodyte', 'harpy', 'minotaur', 'redDragon'],
    buildingIds: ['troglodyteWarrens', 'harpyRoost', 'minotaurLabyrinth', 'redDragonCavern'],
  },
  stronghold: {
    id: 'stronghold', name: 'Stronghold', townName: 'Thunder Bastion', heroId: 'yog',
    creatureIds: ['goblin', 'wolfRider', 'ogre', 'behemoth'],
    buildingIds: ['goblinBarracks', 'wolfPen', 'ogreFort', 'behemothCliffs'],
  },
  conflux: {
    id: 'conflux', name: 'Conflux', townName: 'Elemental Nexus', heroId: 'labetha',
    creatureIds: ['pixie', 'airElemental', 'stormElemental', 'phoenix'],
    buildingIds: ['pixieGarden', 'airElementalAltar', 'stormElementalSpire', 'phoenixPyre'],
  },
  cove: {
    id: 'cove', name: 'Cove', townName: 'Tidehaven', heroId: 'derek',
    creatureIds: ['nymph', 'corsair', 'seaWitch', 'seaSerpent'],
    buildingIds: ['nymphGrotto', 'corsairTavern', 'seaWitchTower', 'seaSerpentCove'],
  },
  factory: {
    id: 'factory', name: 'Factory', townName: 'Brasswork Bastion', heroId: 'todd',
    creatureIds: ['halfling', 'automaton', 'dreadnought', 'juggernaut'],
    buildingIds: ['halflingHovels', 'automatonAssembly', 'dreadnoughtFoundry', 'juggernautHangar'],
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark', townName: 'Reedwall Refuge', heroId: 'eliza',
    creatureIds: ['bandit', 'hornet', 'shaman', 'alligator'],
    buildingIds: ['banditHideout', 'hornetNest', 'shamanLodge', 'alligatorPit'],
  },
  courtyard: {
    id: 'courtyard', name: 'Courtyard', townName: 'Rose Court', heroId: 'beatrice',
    creatureIds: ['page', 'duelist', 'courtWizard', 'royalLion'],
    buildingIds: ['pageBarracks', 'duelistSalon', 'courtWizardLibrary', 'royalLionGarden'],
  },
} as const satisfies Record<string, FactionDefinition>;

export const NEW_CREATURES: Record<string, CreatureDefinition> = {
  gremlin: {
    id: 'gremlin', name: 'Tinker Gremlin', faction: 'Tower', tier: 1,
    attack: 3, defense: 3, damage: [1, 3], health: 7, speed: 5, shots: 8,
    cost: { gold: 50 }, growth: 16, abilities: ['ranged'],
  },
  stoneGargoyle: {
    id: 'stoneGargoyle', name: 'Stone Gargoyle', faction: 'Tower', tier: 2,
    attack: 7, defense: 8, damage: [2, 5], health: 22, speed: 7, shots: 0,
    cost: { gold: 150 }, growth: 9, abilities: ['flying'],
  },
  genie: {
    id: 'genie', name: 'Astral Genie', faction: 'Tower', tier: 3,
    attack: 11, defense: 10, damage: [6, 10], health: 40, speed: 8, shots: 0,
    cost: { gold: 360, gems: 1 }, growth: 5, abilities: ['flying', 'spellResistance'],
  },
  titan: {
    id: 'titan', name: 'Storm Titan', faction: 'Tower', tier: 4,
    attack: 18, defense: 16, damage: [16, 24], health: 120, speed: 8, shots: 24,
    cost: { gold: 1050, gems: 3 }, growth: 2, abilities: ['ranged', 'spellResistance'],
  },
  skeleton: {
    id: 'skeleton', name: 'Grave Skeleton', faction: 'Necropolis', tier: 1,
    attack: 4, defense: 3, damage: [1, 3], health: 8, speed: 5, shots: 0,
    cost: { gold: 50 }, growth: 16, abilities: ['retaliation'],
  },
  zombie: {
    id: 'zombie', name: 'Risen Zombie', faction: 'Necropolis', tier: 2,
    attack: 6, defense: 8, damage: [2, 4], health: 24, speed: 4, shots: 0,
    cost: { gold: 140 }, growth: 9, abilities: ['regeneration'],
  },
  vampire: {
    id: 'vampire', name: 'Night Vampire', faction: 'Necropolis', tier: 3,
    attack: 11, defense: 10, damage: [6, 10], health: 40, speed: 8, shots: 0,
    cost: { gold: 380, mercury: 1 }, growth: 5, abilities: ['flying', 'regeneration'],
  },
  ghostDragon: {
    id: 'ghostDragon', name: 'Ghost Dragon', faction: 'Necropolis', tier: 4,
    attack: 17, defense: 15, damage: [15, 25], health: 120, speed: 9, shots: 0,
    cost: { gold: 1000, mercury: 3 }, growth: 2, abilities: ['flying', 'spellResistance'],
  },
  troglodyte: {
    id: 'troglodyte', name: 'Cave Troglodyte', faction: 'Dungeon', tier: 1,
    attack: 5, defense: 4, damage: [1, 4], health: 9, speed: 5, shots: 0,
    cost: { gold: 55 }, growth: 15, abilities: ['retaliation'],
  },
  harpy: {
    id: 'harpy', name: 'Harpy Hag', faction: 'Dungeon', tier: 2,
    attack: 8, defense: 4, damage: [3, 5], health: 16, speed: 9, shots: 0,
    cost: { gold: 155 }, growth: 9, abilities: ['flying', 'doubleStrike'],
  },
  minotaur: {
    id: 'minotaur', name: 'Labyrinth Minotaur', faction: 'Dungeon', tier: 3,
    attack: 12, defense: 11, damage: [7, 12], health: 50, speed: 7, shots: 0,
    cost: { gold: 400 }, growth: 5, abilities: ['retaliation', 'doubleStrike'],
  },
  redDragon: {
    id: 'redDragon', name: 'Cavern Red Dragon', faction: 'Dungeon', tier: 4,
    attack: 18, defense: 17, damage: [17, 26], health: 135, speed: 10, shots: 0,
    cost: { gold: 1100, sulfur: 3 }, growth: 2, abilities: ['flying', 'spellResistance'],
  },
  goblin: {
    id: 'goblin', name: 'War Goblin', faction: 'Stronghold', tier: 1,
    attack: 5, defense: 2, damage: [1, 3], health: 7, speed: 6, shots: 0,
    cost: { gold: 45 }, growth: 18, abilities: ['retaliation'],
  },
  wolfRider: {
    id: 'wolfRider', name: 'Wolf Rider', faction: 'Stronghold', tier: 2,
    attack: 9, defense: 4, damage: [3, 6], health: 18, speed: 9, shots: 0,
    cost: { gold: 150 }, growth: 10, abilities: ['doubleStrike'],
  },
  ogre: {
    id: 'ogre', name: 'War Ogre', faction: 'Stronghold', tier: 3,
    attack: 12, defense: 12, damage: [6, 11], health: 55, speed: 5, shots: 0,
    cost: { gold: 390, sulfur: 1 }, growth: 5, abilities: ['regeneration'],
  },
  behemoth: {
    id: 'behemoth', name: 'Ancient Behemoth', faction: 'Stronghold', tier: 4,
    attack: 19, defense: 15, damage: [18, 28], health: 140, speed: 7, shots: 0,
    cost: { gold: 1050, crystal: 2 }, growth: 2, abilities: ['retaliation'],
  },
  pixie: {
    id: 'pixie', name: 'Spark Pixie', faction: 'Conflux', tier: 1,
    attack: 3, defense: 2, damage: [1, 3], health: 5, speed: 9, shots: 0,
    cost: { gold: 45 }, growth: 18, abilities: ['flying'],
  },
  airElemental: {
    id: 'airElemental', name: 'Air Elemental', faction: 'Conflux', tier: 2,
    attack: 8, defense: 5, damage: [2, 6], health: 20, speed: 8, shots: 0,
    cost: { gold: 145 }, growth: 10, abilities: ['flying'],
  },
  stormElemental: {
    id: 'stormElemental', name: 'Storm Elemental', faction: 'Conflux', tier: 3,
    attack: 11, defense: 9, damage: [5, 10], health: 38, speed: 8, shots: 16,
    cost: { gold: 370, gems: 2 }, growth: 5, abilities: ['ranged', 'spellResistance'],
  },
  phoenix: {
    id: 'phoenix', name: 'Reborn Phoenix', faction: 'Conflux', tier: 4,
    attack: 17, defense: 14, damage: [14, 24], health: 105, speed: 12, shots: 0,
    cost: { gold: 1000, mercury: 2 }, growth: 2, abilities: ['flying', 'regeneration'],
  },
  nymph: {
    id: 'nymph', name: 'Tide Nymph', faction: 'Cove', tier: 1,
    attack: 4, defense: 3, damage: [1, 3], health: 8, speed: 6, shots: 0,
    cost: { gold: 55 }, growth: 15, abilities: ['spellResistance'],
  },
  corsair: {
    id: 'corsair', name: 'Corsair', faction: 'Cove', tier: 2,
    attack: 8, defense: 5, damage: [3, 5], health: 18, speed: 7, shots: 0,
    cost: { gold: 150 }, growth: 10, abilities: ['doubleStrike'],
  },
  seaWitch: {
    id: 'seaWitch', name: 'Sea Witch', faction: 'Cove', tier: 3,
    attack: 10, defense: 9, damage: [5, 9], health: 36, speed: 6, shots: 14,
    cost: { gold: 360, mercury: 2 }, growth: 5, abilities: ['ranged', 'spellResistance'],
  },
  seaSerpent: {
    id: 'seaSerpent', name: 'Abyssal Sea Serpent', faction: 'Cove', tier: 4,
    attack: 17, defense: 17, damage: [16, 25], health: 135, speed: 7, shots: 0,
    cost: { gold: 1100, crystal: 3 }, growth: 2, abilities: ['regeneration'],
  },
  halfling: {
    id: 'halfling', name: 'Halfling Slinger', faction: 'Factory', tier: 1,
    attack: 4, defense: 3, damage: [1, 3], health: 8, speed: 5, shots: 8,
    cost: { gold: 50 }, growth: 16, abilities: ['ranged'],
  },
  automaton: {
    id: 'automaton', name: 'Brass Automaton', faction: 'Factory', tier: 2,
    attack: 7, defense: 9, damage: [2, 5], health: 28, speed: 5, shots: 0,
    cost: { gold: 165, ore: 1 }, growth: 9, abilities: ['retaliation', 'regeneration'],
  },
  dreadnought: {
    id: 'dreadnought', name: 'Iron Dreadnought', faction: 'Factory', tier: 3,
    attack: 12, defense: 13, damage: [6, 11], health: 60, speed: 5, shots: 18,
    cost: { gold: 420, ore: 2 }, growth: 4, abilities: ['ranged', 'regeneration'],
  },
  juggernaut: {
    id: 'juggernaut', name: 'Siege Juggernaut', faction: 'Factory', tier: 4,
    attack: 18, defense: 18, damage: [15, 24], health: 150, speed: 6, shots: 0,
    cost: { gold: 1100, ore: 4 }, growth: 2, abilities: ['doubleStrike', 'spellResistance'],
  },
  bandit: {
    id: 'bandit', name: 'Reed Bandit', faction: 'Bulwark', tier: 1,
    attack: 5, defense: 3, damage: [2, 4], health: 9, speed: 6, shots: 0,
    cost: { gold: 60 }, growth: 15, abilities: ['doubleStrike'],
  },
  hornet: {
    id: 'hornet', name: 'Giant Hornet', faction: 'Bulwark', tier: 2,
    attack: 7, defense: 4, damage: [2, 5], health: 15, speed: 9, shots: 0,
    cost: { gold: 135 }, growth: 11, abilities: ['flying'],
  },
  shaman: {
    id: 'shaman', name: 'Mire Shaman', faction: 'Bulwark', tier: 3,
    attack: 10, defense: 10, damage: [5, 9], health: 38, speed: 6, shots: 12,
    cost: { gold: 350, gems: 1 }, growth: 5, abilities: ['ranged', 'spellResistance'],
  },
  alligator: {
    id: 'alligator', name: 'Ancient Alligator', faction: 'Bulwark', tier: 4,
    attack: 16, defense: 18, damage: [14, 23], health: 140, speed: 5, shots: 0,
    cost: { gold: 1000, mercury: 2 }, growth: 2, abilities: ['regeneration', 'retaliation'],
  },
  page: {
    id: 'page', name: 'Court Page', faction: 'Courtyard', tier: 1,
    attack: 4, defense: 5, damage: [1, 3], health: 10, speed: 5, shots: 0,
    cost: { gold: 60 }, growth: 14, abilities: ['retaliation'],
  },
  duelist: {
    id: 'duelist', name: 'Rose Duelist', faction: 'Courtyard', tier: 2,
    attack: 9, defense: 6, damage: [3, 6], health: 20, speed: 8, shots: 0,
    cost: { gold: 165 }, growth: 9, abilities: ['doubleStrike'],
  },
  courtWizard: {
    id: 'courtWizard', name: 'Court Wizard', faction: 'Courtyard', tier: 3,
    attack: 11, defense: 9, damage: [6, 10], health: 38, speed: 6, shots: 16,
    cost: { gold: 390, gems: 2 }, growth: 5, abilities: ['ranged', 'spellResistance'],
  },
  royalLion: {
    id: 'royalLion', name: 'Royal Winged Lion', faction: 'Courtyard', tier: 4,
    attack: 17, defense: 16, damage: [15, 24], health: 120, speed: 10, shots: 0,
    cost: { gold: 1050, crystal: 2 }, growth: 2, abilities: ['flying', 'doubleStrike'],
  },
};

export const NEW_BUILDINGS: Record<string, BuildingDefinition> = {
  gremlinWorkshop: {
    id: 'gremlinWorkshop', name: 'Gremlin Workshop', description: 'Recruit Tinker Gremlins.',
    cost: { gold: 450, wood: 5 }, prerequisites: ['fort'], creatureId: 'gremlin',
  },
  gargoyleParapet: {
    id: 'gargoyleParapet', name: 'Gargoyle Parapet', description: 'Recruit Stone Gargoyles.',
    cost: { gold: 800, wood: 5, ore: 5 }, prerequisites: ['gremlinWorkshop'], creatureId: 'stoneGargoyle',
  },
  geniePavilion: {
    id: 'geniePavilion', name: 'Genie Pavilion', description: 'Recruit Astral Genies.',
    cost: { gold: 1500, ore: 6, gems: 2 }, prerequisites: ['gargoyleParapet'], creatureId: 'genie',
  },
  titanCloudTemple: {
    id: 'titanCloudTemple', name: 'Titan Cloud Temple', description: 'Recruit Storm Titans.',
    cost: { gold: 3400, wood: 8, ore: 8, gems: 5 }, prerequisites: ['geniePavilion'], creatureId: 'titan',
  },
  skeletonCrypt: {
    id: 'skeletonCrypt', name: 'Skeleton Crypt', description: 'Recruit Grave Skeletons.',
    cost: { gold: 400, wood: 5 }, prerequisites: ['fort'], creatureId: 'skeleton',
  },
  zombieGraveyard: {
    id: 'zombieGraveyard', name: 'Zombie Graveyard', description: 'Recruit Risen Zombies.',
    cost: { gold: 750, wood: 5, mercury: 1 }, prerequisites: ['skeletonCrypt'], creatureId: 'zombie',
  },
  vampireEstate: {
    id: 'vampireEstate', name: 'Vampire Estate', description: 'Recruit Night Vampires.',
    cost: { gold: 1450, ore: 6, mercury: 2 }, prerequisites: ['zombieGraveyard'], creatureId: 'vampire',
  },
  ghostDragonSepulcher: {
    id: 'ghostDragonSepulcher', name: 'Ghost Dragon Sepulcher', description: 'Recruit Ghost Dragons.',
    cost: { gold: 3300, wood: 8, ore: 8, mercury: 5 }, prerequisites: ['vampireEstate'], creatureId: 'ghostDragon',
  },
  troglodyteWarrens: {
    id: 'troglodyteWarrens', name: 'Troglodyte Warrens', description: 'Recruit Cave Troglodytes.',
    cost: { gold: 450, wood: 5 }, prerequisites: ['fort'], creatureId: 'troglodyte',
  },
  harpyRoost: {
    id: 'harpyRoost', name: 'Harpy Roost', description: 'Recruit Harpy Hags.',
    cost: { gold: 800, wood: 6, ore: 4 }, prerequisites: ['troglodyteWarrens'], creatureId: 'harpy',
  },
  minotaurLabyrinth: {
    id: 'minotaurLabyrinth', name: 'Minotaur Labyrinth', description: 'Recruit Labyrinth Minotaurs.',
    cost: { gold: 1500, wood: 6, sulfur: 2 }, prerequisites: ['harpyRoost'], creatureId: 'minotaur',
  },
  redDragonCavern: {
    id: 'redDragonCavern', name: 'Red Dragon Cavern', description: 'Recruit Cavern Red Dragons.',
    cost: { gold: 3500, wood: 10, ore: 8, sulfur: 5 }, prerequisites: ['minotaurLabyrinth'], creatureId: 'redDragon',
  },
  goblinBarracks: {
    id: 'goblinBarracks', name: 'Goblin Barracks', description: 'Recruit War Goblins.',
    cost: { gold: 400, wood: 5 }, prerequisites: ['fort'], creatureId: 'goblin',
  },
  wolfPen: {
    id: 'wolfPen', name: 'Wolf Pen', description: 'Recruit Wolf Riders.',
    cost: { gold: 750, wood: 8 }, prerequisites: ['goblinBarracks'], creatureId: 'wolfRider',
  },
  ogreFort: {
    id: 'ogreFort', name: 'Ogre Fort', description: 'Recruit War Ogres.',
    cost: { gold: 1400, wood: 6, ore: 6 }, prerequisites: ['wolfPen'], creatureId: 'ogre',
  },
  behemothCliffs: {
    id: 'behemothCliffs', name: 'Behemoth Cliffs', description: 'Recruit Ancient Behemoths.',
    cost: { gold: 3200, wood: 10, ore: 10, crystal: 4 }, prerequisites: ['ogreFort'], creatureId: 'behemoth',
  },
  pixieGarden: {
    id: 'pixieGarden', name: 'Pixie Garden', description: 'Recruit Spark Pixies.',
    cost: { gold: 400, wood: 5 }, prerequisites: ['fort'], creatureId: 'pixie',
  },
  airElementalAltar: {
    id: 'airElementalAltar', name: 'Air Elemental Altar', description: 'Recruit Air Elementals.',
    cost: { gold: 800, wood: 5, gems: 1 }, prerequisites: ['pixieGarden'], creatureId: 'airElemental',
  },
  stormElementalSpire: {
    id: 'stormElementalSpire', name: 'Storm Elemental Spire', description: 'Recruit Storm Elementals.',
    cost: { gold: 1450, ore: 5, gems: 2 }, prerequisites: ['airElementalAltar'], creatureId: 'stormElemental',
  },
  phoenixPyre: {
    id: 'phoenixPyre', name: 'Phoenix Pyre', description: 'Recruit Reborn Phoenixes.',
    cost: { gold: 3400, wood: 8, gems: 5, mercury: 2 }, prerequisites: ['stormElementalSpire'], creatureId: 'phoenix',
  },
  nymphGrotto: {
    id: 'nymphGrotto', name: 'Nymph Grotto', description: 'Recruit Tide Nymphs.',
    cost: { gold: 450, wood: 5 }, prerequisites: ['fort'], creatureId: 'nymph',
  },
  corsairTavern: {
    id: 'corsairTavern', name: 'Corsair Tavern', description: 'Recruit Corsairs.',
    cost: { gold: 800, wood: 8 }, prerequisites: ['nymphGrotto'], creatureId: 'corsair',
  },
  seaWitchTower: {
    id: 'seaWitchTower', name: 'Sea Witch Tower', description: 'Recruit Sea Witches.',
    cost: { gold: 1450, wood: 6, mercury: 2 }, prerequisites: ['corsairTavern'], creatureId: 'seaWitch',
  },
  seaSerpentCove: {
    id: 'seaSerpentCove', name: 'Sea Serpent Cove', description: 'Recruit Abyssal Sea Serpents.',
    cost: { gold: 3500, wood: 10, ore: 8, crystal: 5 }, prerequisites: ['seaWitchTower'], creatureId: 'seaSerpent',
  },
  halflingHovels: {
    id: 'halflingHovels', name: 'Halfling Hovels', description: 'Recruit Halfling Slingers.',
    cost: { gold: 450, wood: 5, ore: 2 }, prerequisites: ['fort'], creatureId: 'halfling',
  },
  automatonAssembly: {
    id: 'automatonAssembly', name: 'Automaton Assembly', description: 'Recruit Brass Automatons.',
    cost: { gold: 850, wood: 5, ore: 5 }, prerequisites: ['halflingHovels'], creatureId: 'automaton',
  },
  dreadnoughtFoundry: {
    id: 'dreadnoughtFoundry', name: 'Dreadnought Foundry', description: 'Recruit Iron Dreadnoughts.',
    cost: { gold: 1550, ore: 8, crystal: 2 }, prerequisites: ['automatonAssembly'], creatureId: 'dreadnought',
  },
  juggernautHangar: {
    id: 'juggernautHangar', name: 'Juggernaut Hangar', description: 'Recruit Siege Juggernauts.',
    cost: { gold: 3600, wood: 8, ore: 12, crystal: 4 }, prerequisites: ['dreadnoughtFoundry'], creatureId: 'juggernaut',
  },
  banditHideout: {
    id: 'banditHideout', name: 'Bandit Hideout', description: 'Recruit Reed Bandits.',
    cost: { gold: 400, wood: 5 }, prerequisites: ['fort'], creatureId: 'bandit',
  },
  hornetNest: {
    id: 'hornetNest', name: 'Giant Hornet Nest', description: 'Recruit Giant Hornets.',
    cost: { gold: 750, wood: 6, mercury: 1 }, prerequisites: ['banditHideout'], creatureId: 'hornet',
  },
  shamanLodge: {
    id: 'shamanLodge', name: 'Shaman Lodge', description: 'Recruit Mire Shamans.',
    cost: { gold: 1400, wood: 6, gems: 2 }, prerequisites: ['hornetNest'], creatureId: 'shaman',
  },
  alligatorPit: {
    id: 'alligatorPit', name: 'Ancient Alligator Pit', description: 'Recruit Ancient Alligators.',
    cost: { gold: 3200, wood: 8, ore: 8, mercury: 4 }, prerequisites: ['shamanLodge'], creatureId: 'alligator',
  },
  pageBarracks: {
    id: 'pageBarracks', name: 'Page Barracks', description: 'Recruit Court Pages.',
    cost: { gold: 450, wood: 5 }, prerequisites: ['fort'], creatureId: 'page',
  },
  duelistSalon: {
    id: 'duelistSalon', name: 'Duelist Salon', description: 'Recruit Rose Duelists.',
    cost: { gold: 800, wood: 6, ore: 4 }, prerequisites: ['pageBarracks'], creatureId: 'duelist',
  },
  courtWizardLibrary: {
    id: 'courtWizardLibrary', name: 'Court Wizard Library', description: 'Recruit Court Wizards.',
    cost: { gold: 1500, wood: 5, ore: 5, gems: 2 }, prerequisites: ['duelistSalon'], creatureId: 'courtWizard',
  },
  royalLionGarden: {
    id: 'royalLionGarden', name: 'Royal Lion Garden', description: 'Recruit Royal Winged Lions.',
    cost: { gold: 3400, wood: 10, ore: 8, crystal: 4 }, prerequisites: ['courtWizardLibrary'], creatureId: 'royalLion',
  },
};

export const NEW_HEROES: Record<string, HeroDefinition> = {
  solmyr: {
    id: 'solmyr', name: 'Solmyr', faction: 'Tower', specialty: 'Chain Lightning',
    primarySkills: { attack: 1, defense: 1, spellPower: 3, knowledge: 3 },
    startingArmy: [{ creatureId: 'gremlin', count: 26 }, { creatureId: 'stoneGargoyle', count: 8 }],
    spells: ['magicArrow', 'haste'],
  },
  isra: {
    id: 'isra', name: 'Isra', faction: 'Necropolis', specialty: 'Necromancy',
    primarySkills: { attack: 1, defense: 2, spellPower: 2, knowledge: 3 },
    startingArmy: [{ creatureId: 'skeleton', count: 30 }, { creatureId: 'zombie', count: 10 }],
    spells: ['slow', 'stoneSkin'],
  },
  darkstorn: {
    id: 'darkstorn', name: 'Darkstorn', faction: 'Dungeon', specialty: 'Subterranean Paths',
    primarySkills: { attack: 2, defense: 1, spellPower: 3, knowledge: 2 },
    startingArmy: [{ creatureId: 'troglodyte', count: 24 }, { creatureId: 'harpy', count: 10 }],
    spells: ['fireball', 'slow'],
  },
  yog: {
    id: 'yog', name: 'Yog', faction: 'Stronghold', specialty: 'Offense',
    primarySkills: { attack: 3, defense: 2, spellPower: 1, knowledge: 1 },
    startingArmy: [{ creatureId: 'goblin', count: 32 }, { creatureId: 'wolfRider', count: 10 }],
    spells: ['haste', 'bless'],
  },
  labetha: {
    id: 'labetha', name: 'Labetha', faction: 'Conflux', specialty: 'Elemental Magic',
    primarySkills: { attack: 1, defense: 1, spellPower: 3, knowledge: 3 },
    startingArmy: [{ creatureId: 'pixie', count: 30 }, { creatureId: 'airElemental', count: 10 }],
    spells: ['magicArrow', 'cure'],
  },
  derek: {
    id: 'derek', name: 'Derek', faction: 'Cove', specialty: 'Navigation',
    primarySkills: { attack: 2, defense: 2, spellPower: 1, knowledge: 2 },
    startingArmy: [{ creatureId: 'nymph', count: 26 }, { creatureId: 'corsair', count: 12 }],
    spells: ['bless', 'haste'],
  },
  todd: {
    id: 'todd', name: 'Todd', faction: 'Factory', specialty: 'Artillery',
    primarySkills: { attack: 2, defense: 3, spellPower: 1, knowledge: 2 },
    startingArmy: [{ creatureId: 'halfling', count: 28 }, { creatureId: 'automaton', count: 8 }],
    spells: ['stoneSkin', 'magicArrow'],
  },
  eliza: {
    id: 'eliza', name: 'Eliza', faction: 'Bulwark', specialty: 'Guerrilla Tactics',
    primarySkills: { attack: 2, defense: 2, spellPower: 2, knowledge: 2 },
    startingArmy: [{ creatureId: 'bandit', count: 26 }, { creatureId: 'hornet', count: 12 }],
    spells: ['slow', 'stoneSkin'],
  },
  beatrice: {
    id: 'beatrice', name: 'Beatrice', faction: 'Courtyard', specialty: 'Diplomacy',
    primarySkills: { attack: 1, defense: 3, spellPower: 2, knowledge: 2 },
    startingArmy: [{ creatureId: 'page', count: 26 }, { creatureId: 'duelist', count: 10 }],
    spells: ['bless', 'cure'],
  },
};
