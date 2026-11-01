import { ARTIFACT_LIST } from './artifacts';
import { FACTIONS, getCreature, getTerrain } from './content';
import { LANDMARK_DEFINITIONS } from './landmarks';
import { SeededRandom } from './random';
import { NEW_RESOURCES, NEW_RESOURCE_TYPES } from './resources';
import type {
  AdventureMap,
  ArtifactObject,
  DwellingObject,
  LandmarkObject,
  LandmarkType,
  MapObject,
  MapTile,
  MineObject,
  MonsterObject,
  Point,
  ResourceCost,
  ResourceObject,
  ResourceType,
  TerrainType,
  TownObject,
} from './types';

export const DEFAULT_MAP_WIDTH = 64;
export const DEFAULT_MAP_HEIGHT = 48;

const NEW_FACTION_LAYOUTS = [
  { factionId: 'tower', town: { x: 20, y: 4 }, dwellings: [{ x: 17, y: 7 }, { x: 23, y: 7 }], monster: { x: 20, y: 10 } },
  { factionId: 'necropolis', town: { x: 42, y: 4 }, dwellings: [{ x: 39, y: 7 }, { x: 45, y: 7 }], monster: { x: 42, y: 10 } },
  { factionId: 'dungeon', town: { x: 20, y: 16 }, dwellings: [{ x: 17, y: 19 }, { x: 23, y: 19 }], monster: { x: 20, y: 22 } },
  { factionId: 'stronghold', town: { x: 42, y: 16 }, dwellings: [{ x: 39, y: 19 }, { x: 45, y: 19 }], monster: { x: 42, y: 22 } },
  { factionId: 'conflux', town: { x: 3, y: 36 }, dwellings: [{ x: 6, y: 39 }, { x: 9, y: 39 }], monster: { x: 3, y: 42 } },
  { factionId: 'cove', town: { x: 20, y: 36 }, dwellings: [{ x: 17, y: 39 }, { x: 23, y: 39 }], monster: { x: 20, y: 33 } },
  { factionId: 'factory', town: { x: 42, y: 36 }, dwellings: [{ x: 39, y: 39 }, { x: 45, y: 39 }], monster: { x: 42, y: 33 } },
  { factionId: 'bulwark', town: { x: 20, y: -5 }, dwellings: [{ x: 17, y: -8 }, { x: 23, y: -8 }], monster: { x: 20, y: -2 } },
  { factionId: 'courtyard', town: { x: 42, y: -5 }, dwellings: [{ x: 39, y: -8 }, { x: 45, y: -8 }], monster: { x: 42, y: -2 } },
] as const;

function fromBottom(height: number, point: Point): Point {
  return { x: point.x, y: point.y < 0 ? height + point.y : point.y };
}

export function toTileIndex(map: AdventureMap, position: Point): number {
  return position.y * map.width + position.x;
}

export function fromTileIndex(map: AdventureMap, index: number): Point {
  return { x: index % map.width, y: Math.floor(index / map.width) };
}

export function isInsideMap(map: AdventureMap, position: Point): boolean {
  return position.x >= 0 && position.x < map.width && position.y >= 0 && position.y < map.height;
}

export function getTile(map: AdventureMap, position: Point): MapTile | undefined {
  return isInsideMap(map, position) ? map.tiles[toTileIndex(map, position)] : undefined;
}

export function getObjectAt(map: AdventureMap, position: Point): MapObject | undefined {
  const objectId = getTile(map, position)?.objectId;
  return objectId && Object.hasOwn(map.objects, objectId) ? map.objects[objectId] : undefined;
}

function clearTile(map: AdventureMap, position: Point, road = false): void {
  const tile = getTile(map, position);
  if (!tile) return;
  tile.terrain = road ? 'dirt' : 'grass';
  tile.obstacle = false;
  tile.road = road;
}

function clearArea(map: AdventureMap, position: Point, radius: number): void {
  for (let y = position.y - radius; y <= position.y + radius; y += 1) {
    for (let x = position.x - radius; x <= position.x + radius; x += 1) {
      clearTile(map, { x, y });
    }
  }
}

function addObject(map: AdventureMap, object: MapObject): void {
  if (Object.hasOwn(map.objects, object.id)) throw new Error(`Duplicate map object: ${object.id}`);
  const existing = getObjectAt(map, object.position);
  if (existing) throw new Error(`Overlapping map objects: ${existing.id}, ${object.id}`);
  map.objects[object.id] = object;
  clearArea(map, object.position, 1);
  const tile = getTile(map, object.position);
  if (!tile) throw new Error(`Object outside map: ${object.id}`);
  tile.objectId = object.id;
}

function createLandmark(
  id: string,
  landmarkId: LandmarkType,
  position: Point,
  linkedObjectId: string | null = null,
): LandmarkObject {
  return {
    id: `landmark-${id}`,
    kind: 'landmark',
    landmarkId,
    name: LANDMARK_DEFINITIONS[landmarkId].name,
    position,
    visits: {},
    depleted: false,
    linkedObjectId,
  };
}

export function createAdventureMap(
  seed = 'h3core-default',
  width = DEFAULT_MAP_WIDTH,
  height = DEFAULT_MAP_HEIGHT,
): AdventureMap {
  if (width < DEFAULT_MAP_WIDTH || height < DEFAULT_MAP_HEIGHT) {
    throw new Error(`Map must be at least ${DEFAULT_MAP_WIDTH}x${DEFAULT_MAP_HEIGHT}`);
  }

  const random = new SeededRandom(`${seed}:map`);
  const tiles: MapTile[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const roll = random.next();
      let terrain: TerrainType = 'grass';
      if (roll < 0.075) terrain = 'water';
      else if (roll < 0.16) terrain = 'swamp';
      else if (roll < 0.25) terrain = 'sand';
      else if (roll < 0.43) terrain = 'dirt';
      else if (roll < 0.65) terrain = 'forest';
      else if (roll > 0.945) terrain = 'mountain';
      tiles.push({
        x,
        y,
        terrain,
        road: false,
        obstacle: !getTerrain(terrain).passable,
        objectId: null,
      });
    }
  }

  const map: AdventureMap = { seed, width, height, tiles, objects: {} };
  const roadY = Math.floor(height / 2);
  const roadX = Math.floor(width / 2);
  for (let x = 2; x < width - 2; x += 1) clearTile(map, { x, y: roadY }, true);
  for (let y = 2; y < height - 2; y += 1) clearTile(map, { x: roadX, y }, true);

  clearTile(map, { x: 0, y: 0 });
  const pond = getTile(map, { x: 0, y: 0 });
  if (pond) {
    pond.terrain = 'water';
    pond.obstacle = true;
  }
  clearTile(map, { x: width - 1, y: 0 });
  const peak = getTile(map, { x: width - 1, y: 0 });
  if (peak) {
    peak.terrain = 'mountain';
    peak.obstacle = true;
  }

  const towns: TownObject[] = [
    { id: 'town-haven', kind: 'town', townId: 'haven', name: FACTIONS.haven.townName, position: { x: 3, y: roadY } },
    { id: 'town-grove', kind: 'town', townId: 'grove', name: FACTIONS.grove.townName, position: { x: width - 4, y: roadY } },
    { id: 'town-ember', kind: 'town', townId: 'ember', name: FACTIONS.ember.townName, position: { x: 3, y: 4 } },
    { id: 'town-mire', kind: 'town', townId: 'mire', name: FACTIONS.mire.townName, position: { x: width - 4, y: height - 5 } },
  ];
  const dwellings: DwellingObject[] = [
    { id: 'dwelling-militia', kind: 'dwelling', name: 'Border Barracks', creatureId: 'militia', available: 14, position: { x: 8, y: roadY - 5 } },
    { id: 'dwelling-sprites', kind: 'dwelling', name: 'Glimmer Hollow', creatureId: 'sprite', available: 16, position: { x: width - 9, y: roadY + 5 } },
    { id: 'dwelling-imps', kind: 'dwelling', name: 'Cinder Warrens', creatureId: 'imp', available: 16, position: { x: 7, y: 4 } },
    { id: 'dwelling-hellhounds', kind: 'dwelling', name: 'Ashen Kennels', creatureId: 'hellhound', available: 9, position: { x: 11, y: 5 } },
    { id: 'dwelling-lizardmen', kind: 'dwelling', name: 'Reedwatch Den', creatureId: 'lizardman', available: 12, position: { x: width - 8, y: height - 5 } },
    { id: 'dwelling-gorgons', kind: 'dwelling', name: 'Mossy Gorgon Pen', creatureId: 'gorgon', available: 8, position: { x: width - 12, y: height - 6 } },
  ];
  const monsters: MonsterObject[] = [
    {
      id: 'monster-west', kind: 'monster', name: 'Roadside Brigands', position: { x: 9, y: roadY },
      army: [{ creatureId: 'militia', count: 16 }], experienceReward: 500, treasure: { gold: 400 },
    },
    {
      id: 'monster-east', kind: 'monster', name: 'Wild Sprites', position: { x: width - 10, y: roadY },
      army: [{ creatureId: 'sprite', count: 20 }], experienceReward: 500, treasure: { gems: 2 },
    },
    {
      id: 'monster-dragon', kind: 'monster', name: 'Elder Dragon', position: { x: roadX, y: height - 5 },
      army: [{ creatureId: 'dragon', count: 2 }], experienceReward: 2200, treasure: { gold: 2000, crystal: 4 },
    },
    {
      id: 'monster-ember', kind: 'monster', name: 'Ashen Vanguard', position: { x: 12, y: roadY - 3 },
      army: [{ creatureId: 'ifrit', count: 3 }, { creatureId: 'pitFiend', count: 1 }], experienceReward: 1400, treasure: { gold: 900, sulfur: 2 },
    },
    {
      id: 'monster-mire', kind: 'monster', name: 'Mire Marshals', position: { x: width - 13, y: roadY + 3 },
      army: [{ creatureId: 'wyvern', count: 3 }, { creatureId: 'basilisk', count: 1 }], experienceReward: 1400, treasure: { gold: 900, mercury: 2 },
    },
  ];

  monsters.push(
    {
      id: 'monster-neutral-arcane', kind: 'monster', name: 'Arcane Sentinels', position: { x: 14, y: 10 },
      army: [{ creatureId: 'golem', count: 4 }, { creatureId: 'beholder', count: 2 }], experienceReward: 1800, treasure: { gold: 900, gems: 2 },
    },
    {
      id: 'monster-neutral-aquatic', kind: 'monster', name: 'Tide of Teeth', position: { x: 53, y: 10 },
      army: [{ creatureId: 'kraken', count: 2 }, { creatureId: 'seaHag', count: 8 }], experienceReward: 1800, treasure: { gold: 900, mercury: 2 },
    },
    {
      id: 'monster-neutral-beasts', kind: 'monster', name: 'Savage Menagerie', position: { x: 14, y: 22 },
      army: [{ creatureId: 'direBear', count: 8 }, { creatureId: 'manticore', count: 4 }], experienceReward: 1400, treasure: { gold: 750 },
    },
    {
      id: 'monster-neutral-desert', kind: 'monster', name: 'Dune Revenants', position: { x: 53, y: 22 },
      army: [{ creatureId: 'mummy', count: 16 }, { creatureId: 'sandWyrm', count: 4 }], experienceReward: 1400, treasure: { gold: 750, sulfur: 1 },
    },
    {
      id: 'monster-neutral-forest', kind: 'monster', name: 'Thornwood Guardians', position: { x: 14, y: 33 },
      army: [{ creatureId: 'ent', count: 4 }, { creatureId: 'giantSpider', count: 16 }], experienceReward: 1400, treasure: { gold: 750, wood: 4 },
    },
    {
      id: 'monster-neutral-ice', kind: 'monster', name: 'Frozen Brood', position: { x: 53, y: 33 },
      army: [{ creatureId: 'frostGiant', count: 2 }, { creatureId: 'iceWyrm', count: 4 }], experienceReward: 1800, treasure: { gold: 900, crystal: 2 },
    },
    {
      id: 'monster-neutral-infernal', kind: 'monster', name: 'Infernal Hunt', position: { x: 14, y: 40 },
      army: [{ creatureId: 'cerberus', count: 8 }, { creatureId: 'balor', count: 2 }], experienceReward: 1800, treasure: { gold: 900, sulfur: 2 },
    },
    {
      id: 'monster-neutral-reptile', kind: 'monster', name: 'Crowned Scales', position: { x: 53, y: 40 },
      army: [{ creatureId: 'hydra', count: 2 }, { creatureId: 'basiliskKing', count: 4 }], experienceReward: 1800, treasure: { gold: 900, crystal: 2 },
    },
    {
      id: 'monster-neutral-swarm', kind: 'monster', name: 'Burrow Swarm', position: { x: 27, y: 10 },
      army: [{ creatureId: 'ratling', count: 18 }, { creatureId: 'broodMother', count: 8 }], experienceReward: 1200, treasure: { gold: 650 },
    },
    {
      id: 'monster-neutral-undead', kind: 'monster', name: 'Veiled Court', position: { x: 37, y: 10 },
      army: [{ creatureId: 'lich', count: 4 }, { creatureId: 'wraith', count: 8 }], experienceReward: 1600, treasure: { gold: 850, gems: 1 },
    },
  );

  const landmarks: LandmarkObject[] = [
    createLandmark('arcaneLibrary', 'arcaneLibrary', { x: 14, y: 4 }),
    createLandmark('warriorsArena', 'warriorsArena', { x: 31, y: 4 }),
    createLandmark('heroesShrine', 'heroesShrine', { x: 53, y: 4 }),
    createLandmark('huntersLodge', 'huntersLodge', { x: 14, y: 16 }),
    createLandmark('waterwheel', 'waterwheel', { x: 53, y: 16 }),
    createLandmark('elementalForge', 'elementalForge', { x: 14, y: 36 }),
    createLandmark('ancientObservatory', 'ancientObservatory', { x: 53, y: 36 }),
    createLandmark('healersSanctuary', 'healersSanctuary', { x: 31, y: 36 }),
    createLandmark('wayfarerPortal-west', 'wayfarerPortal', { x: 14, y: 43 }, 'landmark-wayfarerPortal-east'),
    createLandmark('wayfarerPortal-east', 'wayfarerPortal', { x: 53, y: 43 }, 'landmark-wayfarerPortal-west'),
    createLandmark('merchantsTent', 'merchantsTent', { x: 31, y: 16 }),
  ];

  const rareResources: ResourceType[] = ['gems', 'mercury', 'sulfur', 'crystal'];
  NEW_FACTION_LAYOUTS.forEach((layout, index) => {
    const faction = FACTIONS[layout.factionId];
    towns.push({
      id: `town-${faction.id}`, kind: 'town', townId: faction.id, name: faction.townName,
      position: fromBottom(height, layout.town),
    });
    layout.dwellings.forEach((position, dwellingIndex) => {
      const creatureId = faction.creatureIds[dwellingIndex] ?? faction.creatureIds[0];
      const creature = getCreature(creatureId);
      dwellings.push({
        id: `dwelling-${faction.id}-${dwellingIndex + 1}`, kind: 'dwelling',
        name: `${creature.name} Dwelling`, creatureId, available: creature.growth,
        position: fromBottom(height, position),
      });
    });
    const resource = rareResources[index % rareResources.length] ?? 'gold';
    const treasure: ResourceCost = { gold: 900 };
    treasure[resource] = (treasure[resource] ?? 0) + 2;
    monsters.push({
      id: `monster-${faction.id}`, kind: 'monster', name: `${faction.name} Warband`,
      position: fromBottom(height, layout.monster),
      army: [
        { creatureId: faction.creatureIds[2], count: 3 },
        { creatureId: faction.creatureIds[3], count: 1 },
      ],
      experienceReward: 1400,
      treasure,
    });
  });

  const resources: ResourceObject[] = [
    { id: 'gold-west', kind: 'resource', name: 'Abandoned Purse', position: { x: 5, y: roadY }, resources: { gold: 750 } },
    { id: 'wood-west', kind: 'resource', name: 'Timber Cache', position: { x: 11, y: roadY }, resources: { wood: 8 } },
    { id: 'ore-cache-east', kind: 'resource', name: 'Ore Cache', position: { x: width - 12, y: roadY }, resources: { ore: 8 } },
    { id: 'gold-east', kind: 'resource', name: 'Merchant Strongbox', position: { x: width - 6, y: roadY }, resources: { gold: 750 } },
    { id: 'crystal-north', kind: 'resource', name: 'Crystal Shards', position: { x: roadX, y: 5 }, resources: { crystal: 3 } },
  ];
  const mines: MineObject[] = [
    { id: 'sawmill-west', kind: 'mine', name: 'West Sawmill', ownerId: null, resource: 'wood', dailyOutput: 2, position: { x: 6, y: roadY + 4 } },
    { id: 'ore-east', kind: 'mine', name: 'East Ore Pit', ownerId: null, resource: 'ore', dailyOutput: 2, position: { x: width - 7, y: roadY - 4 } },
    { id: 'gold-north', kind: 'mine', name: 'Old Gold Mine', ownerId: null, resource: 'gold', dailyOutput: 1000, position: { x: roadX, y: 3 } },
    { id: 'crystal-south', kind: 'mine', name: 'Crystal Cavern', ownerId: null, resource: 'crystal', dailyOutput: 1, position: { x: roadX + 4, y: height - 4 } },
    { id: 'sulfur-north', kind: 'mine', name: 'Brimstone Vent', ownerId: null, resource: 'sulfur', dailyOutput: 1, position: { x: 10, y: 3 } },
    { id: 'mercury-south', kind: 'mine', name: 'Quicksilver Bog', ownerId: null, resource: 'mercury', dailyOutput: 1, position: { x: width - 11, y: height - 4 } },
  ];

  const extendedResourcePositions = [
    { pickup: { x: 7, y: roadY - 6 }, mine: { x: 9, y: roadY + 6 } },
    { pickup: { x: roadX - 7, y: roadY + 6 }, mine: { x: roadX + 7, y: roadY - 6 } },
    { pickup: { x: width - 8, y: roadY - 6 }, mine: { x: width - 10, y: roadY + 6 } },
  ] as const;
  NEW_RESOURCE_TYPES.forEach((resource, index) => {
    const definition = NEW_RESOURCES[resource];
    const positions = extendedResourcePositions[index]!;
    resources.push({
      id: `${resource}-cache`, kind: 'resource', name: `${definition.name} Cache`, position: { ...positions.pickup },
      resources: { [resource]: random.integer(definition.pickupRange[0], definition.pickupRange[1]) },
    });
    mines.push({
      id: `${resource}-mine`, kind: 'mine', name: `${definition.name} Mine`, ownerId: null,
      resource, dailyOutput: definition.mineDailyOutput, position: { ...positions.mine },
    });
  });
  const artifacts: ArtifactObject[] = ARTIFACT_LIST.map((artifact, index) => ({
    id: `artifact-${artifact.id}`, kind: 'artifact', name: artifact.name, artifactId: artifact.id,
    position: { x: 7 + (index % 10) * 6, y: roadY + (index < 10 ? -1 : 1) },
  }));

  const allObjects = [...towns, ...resources, ...artifacts, ...mines, ...dwellings, ...monsters, ...landmarks];
  for (const object of allObjects) addObject(map, object);
  for (const town of towns) clearArea(map, town.position, 2);

  for (const object of allObjects) {
    const direction = Math.sign(roadY - object.position.y);
    for (let y = object.position.y; y !== roadY; y += direction) {
      clearTile(map, { x: object.position.x, y });
    }
  }
  for (let x = 2; x < width - 2; x += 1) clearTile(map, { x, y: roadY }, true);
  for (let y = 2; y < height - 2; y += 1) clearTile(map, { x: roadX, y }, true);
  for (const object of allObjects) {
    const tile = getTile(map, object.position);
    if (tile) tile.objectId = object.id;
  }

  return map;
}
