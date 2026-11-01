import * as THREE from 'three';
import { createCreatureModel, getCreatureVisualFaction } from '../battle/creatures';
import { HOTA_CREATURE_FACTIONS } from '../battle/hotaCreatures';
import { getArtifact } from '../game/artifacts';
import { EXTENDED_RESOURCE_TYPES as RESOURCE_TYPES, NEW_RESOURCES } from '../game/resources';
import {
  addHotaArchitecture,
  addHotaDwellingDetails,
  HOTA_FACTION_PALETTES,
} from './hotaArchitecture';
import { hasVisitedLandmark, isLandmarkUsed } from '../game/landmarks';
import { createArcaneLibraryModel } from './landmarks/arcaneLibrary';
import { createWarriorsArenaModel } from './landmarks/warriorsArena';
import { createHeroesShrineModel } from './landmarks/heroesShrine';
import { createHuntersLodgeModel } from './landmarks/huntersLodge';
import { createWaterwheelModel } from './landmarks/waterwheel';
import { createElementalForgeModel } from './landmarks/elementalForge';
import { createAncientObservatoryModel } from './landmarks/ancientObservatory';
import { createHealersSanctuaryModel } from './landmarks/healersSanctuary';
import { createWayfarerPortalModel } from './landmarks/wayfarerPortal';
import { createMerchantsTentModel } from './landmarks/merchantsTent';
import type {
  DwellingObject,
  GameState,
  HeroState,
  LandmarkObject,
  LandmarkType,
  MapObject,
  MineObject,
  MonsterObject,
  ResourceObject,
  ResourceType,
  TownObject,
} from '../game/types';

export interface AdventureModel {
  group: THREE.Group;
  flags: THREE.Mesh[];
}

const RESOURCE_COLORS: Record<ResourceType, number> = {
  gold: 0xf2c14e,
  wood: 0x8d5c36,
  ore: 0x9ca2a6,
  crystal: 0x6ad5e7,
  gems: 0xc17be8,
  mercury: 0xb9d6db,
  sulfur: 0xe4d65b,
  mithril: NEW_RESOURCES.mithril.color,
  obsidian: NEW_RESOURCES.obsidian.color,
  essence: NEW_RESOURCES.essence.color,
};

function material(color: THREE.ColorRepresentation, roughness = 0.82): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
  result.userData.baseColor = result.color.getHex();
  return result;
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  segments: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return addMesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, x, y, z);
}

function box(
  parent: THREE.Object3D,
  width: number,
  height: number,
  depth: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return addMesh(parent, new THREE.BoxGeometry(width, height, depth), surface, x, y, z);
}

function cone(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  segments: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return addMesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, x, y, z);
}

export function createGroundMarker(color: THREE.ColorRepresentation, radius = 0.48): THREE.Mesh {
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.78, radius, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.86, side: THREE.DoubleSide, depthWrite: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.022;
  marker.renderOrder = 5;
  return marker;
}

function createFlag(color: THREE.ColorRepresentation, height = 1.25): { group: THREE.Group; flag: THREE.Mesh } {
  const group = new THREE.Group();
  cylinder(group, 0.018, 0.022, height, 6, material(0x5d4430), 0, height / 2, 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    0.43, -0.09, 0.035,
    0, -0.27, 0,
  ], 3));
  geometry.computeVertexNormals();
  const flag = addMesh(group, geometry, new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    flatShading: true,
    side: THREE.DoubleSide,
  }), 0, height - 0.05, 0);
  (flag.material as THREE.MeshStandardMaterial).userData.baseColor = (flag.material as THREE.MeshStandardMaterial).color.getHex();
  group.add(createFinial(height));
  return { group, flag };
}

function createFinial(height: number): THREE.Mesh {
  const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), material(0xe7c46a));
  finial.position.y = height + 0.025;
  finial.castShadow = true;
  return finial;
}

function addOwnershipFlag(model: AdventureModel, color: THREE.ColorRepresentation, x: number, z: number, height = 1.2): void {
  const ownership = createFlag(color, height);
  ownership.group.position.set(x, 0, z);
  model.group.add(ownership.group);
  model.flags.push(ownership.flag);
}

function createChest(): THREE.Group {
  const chest = new THREE.Group();
  const wood = material(0x79502f);
  const metal = material(0xd5a943, 0.45);
  box(chest, 0.45, 0.24, 0.32, wood, 0, 0.14, 0);
  const lid = addMesh(chest, new THREE.CylinderGeometry(0.16, 0.16, 0.45, 8, 1, false, 0, Math.PI), wood, 0, 0.28, 0);
  lid.rotation.z = Math.PI / 2;
  lid.rotation.y = Math.PI / 2;
  box(chest, 0.05, 0.35, 0.335, metal, 0, 0.2, 0);
  box(chest, 0.08, 0.09, 0.025, metal, 0, 0.19, 0.172);
  return chest;
}

function createArtifactModel(artifactId: string): AdventureModel {
  const artifact = getArtifact(artifactId);
  const colors = { common: 0xb7c4b0, rare: 0x73b9e6, epic: 0xb58ae6, legendary: 0xf0c75e } as const;
  const color = artifact ? colors[artifact.rarity] : colors.common;
  const model: AdventureModel = { group: new THREE.Group(), flags: [] };
  model.group.add(createChest());
  const focus = addMesh(model.group, new THREE.OctahedronGeometry(0.18, 0), material(color, 0.28), 0, 0.72, 0);
  focus.scale.y = 1.35;
  focus.userData.artifactId = artifactId;
  model.group.add(createGroundMarker(color, 0.48));
  model.group.userData.kind = 'artifact';
  model.group.userData.artifactId = artifactId;
  return model;
}

function createResourceModel(object: ResourceObject): AdventureModel {
  const model: AdventureModel = { group: new THREE.Group(), flags: [] };
  const resource = RESOURCE_TYPES.find((type) => (object.resources[type] ?? 0) > 0) ?? 'gold';
  if (resource === 'gold') {
    model.group.add(createChest());
    for (let index = 0; index < 5; index += 1) {
      cylinder(model.group, 0.055, 0.055, 0.018, 10, material(0xf0c34e, 0.4),
        -0.28 + index * 0.12, 0.025, 0.27 + (index % 2) * 0.05);
    }
  } else if (resource === 'wood') {
    const bark = material(0x79502f);
    const cut = material(0xc18b52);
    for (let index = 0; index < 4; index += 1) {
      const log = cylinder(model.group, 0.095, 0.095, 0.55, 8, bark,
        (index % 2) * 0.18 - 0.09, 0.1 + Math.floor(index / 2) * 0.15, 0);
      log.rotation.z = Math.PI / 2;
      const end = cylinder(model.group, 0.075, 0.075, 0.012, 8, cut, 0.2, log.position.y, 0);
      end.rotation.z = Math.PI / 2;
    }
  } else {
    const color = RESOURCE_COLORS[resource];
    const gem = material(color, 0.35);
    for (let index = 0; index < 5; index += 1) {
      const shard = addMesh(model.group,
        resource === 'ore' || resource === 'mercury'
          ? new THREE.DodecahedronGeometry(0.13 + (index % 2) * 0.045, 0)
          : new THREE.OctahedronGeometry(0.16 + (index % 2) * 0.04, 0),
        gem, (index - 2) * 0.12, 0.12 + (index % 2) * 0.07, (index % 3 - 1) * 0.12);
      shard.scale.y = resource === 'ore' ? 0.8 : 1.65;
      shard.rotation.y = index * 0.8;
    }
  }
  model.group.add(createGroundMarker(RESOURCE_COLORS[resource], 0.43));
  return model;
}

function createMineModel(object: MineObject, ownerColor: THREE.ColorRepresentation): AdventureModel {
  const model: AdventureModel = { group: new THREE.Group(), flags: [] };
  const timber = material(0x62432d);
  const stone = material(0x6c6d67);
  if (object.resource === 'wood') {
    box(model.group, 0.64, 0.38, 0.52, material(0x9b7045), -0.05, 0.2, 0);
    const roof = cone(model.group, 0.52, 0.34, 4, material(0x496443), -0.05, 0.55, 0);
    roof.rotation.y = Math.PI / 4;
    const wheel = addMesh(model.group, new THREE.TorusGeometry(0.19, 0.035, 5, 12), timber, 0.32, 0.22, 0.1);
    wheel.rotation.y = Math.PI / 2;
    for (let index = 0; index < 3; index += 1) {
      const log = cylinder(model.group, 0.065, 0.065, 0.45, 7, timber, -0.3 + index * 0.13, 0.08, 0.38);
      log.rotation.z = Math.PI / 2;
    }
  } else {
    const mound = addMesh(model.group, new THREE.DodecahedronGeometry(0.48, 0), stone, 0, 0.23, -0.05);
    mound.scale.set(1.05, 0.75, 0.85);
    box(model.group, 0.43, 0.32, 0.05, material(0x202725), 0, 0.17, 0.34);
    box(model.group, 0.07, 0.42, 0.08, timber, -0.23, 0.22, 0.36);
    box(model.group, 0.07, 0.42, 0.08, timber, 0.23, 0.22, 0.36);
    box(model.group, 0.54, 0.07, 0.08, timber, 0, 0.43, 0.36);
    const ore = material(RESOURCE_COLORS[object.resource], 0.4);
    for (let index = 0; index < 3; index += 1) {
      addMesh(model.group, new THREE.OctahedronGeometry(0.09, 0), ore, -0.25 + index * 0.25, 0.07, 0.48);
    }
  }
  addOwnershipFlag(model, ownerColor, -0.46, -0.25, 1.05);
  model.group.add(createGroundMarker(ownerColor));
  return model;
}

const EXPANSION_FACTIONS: Record<string, 'Ember' | 'Mire'> = {
  imp: 'Ember',
  hellhound: 'Ember',
  ifrit: 'Ember',
  pitFiend: 'Ember',
  lizardman: 'Mire',
  gorgon: 'Mire',
  wyvern: 'Mire',
  basilisk: 'Mire',
};

function addHavenArchitecture(group: THREE.Group): void {
  const stone = material(0xc1b99f);
  const darkStone = material(0x8f8979);
  const roof = material(0x8c4f3e);
  cylinder(group, 0.55, 0.62, 0.13, 8, darkStone, 0, 0.065, 0);
  box(group, 0.55, 0.58, 0.48, stone, 0, 0.4, 0);
  cone(group, 0.44, 0.4, 4, roof, 0, 0.89, 0).rotation.y = Math.PI / 4;
  for (const [x, z] of [[-0.37, -0.29], [0.37, -0.29], [-0.37, 0.29], [0.37, 0.29]] as const) {
    cylinder(group, 0.13, 0.16, 0.58, 6, stone, x, 0.36, z);
    cone(group, 0.21, 0.32, 6, roof, x, 0.79, z);
    box(group, 0.09, 0.13, 0.09, darkStone, x, 0.69, z);
  }
  box(group, 0.15, 0.28, 0.035, material(0x3a3028), 0, 0.25, 0.258);
  for (const x of [-0.17, 0.17]) box(group, 0.075, 0.11, 0.025, material(0x82c8d4, 0.3), x, 0.51, 0.255);
  box(group, 0.05, 0.2, 0.05, material(0xd7c785, 0.45), 0, 1.18, 0);
  box(group, 0.15, 0.045, 0.05, material(0xd7c785, 0.45), 0, 1.2, 0);
}

function addGroveArchitecture(group: THREE.Group): void {
  const bark = material(0x66513a);
  const leaf = material(0x426f59);
  const leafLight = material(0x6f9663);
  const stone = material(0x9cae9b);
  cylinder(group, 0.55, 0.62, 0.12, 9, material(0x63776a), 0, 0.06, 0);
  cylinder(group, 0.15, 0.25, 0.82, 7, bark, 0, 0.49, 0);
  addMesh(group, new THREE.IcosahedronGeometry(0.43, 1), leaf, 0, 1.03, 0).scale.set(1.15, 0.72, 1.05);
  addMesh(group, new THREE.IcosahedronGeometry(0.25, 1), leafLight, -0.18, 1.27, 0.02).scale.y = 0.7;
  for (const [x, z] of [[-0.34, 0.2], [0.34, 0.18], [0, -0.35]] as const) {
    cylinder(group, 0.16, 0.19, 0.36, 7, stone, x, 0.28, z);
    cone(group, 0.29, 0.35, 7, leaf, x, 0.59, z);
    box(group, 0.07, 0.1, 0.025, material(0xb9e2bd, 0.35), x, 0.31, z + 0.18);
  }
  for (const [x, z, angle] of [[0.32, 0, -1.05], [-0.32, 0, 1.05], [0, 0.32, 0], [0, -0.32, 0]] as const) {
    const root = cone(group, 0.09, 0.55, 6, bark, x, 0.16, z);
    root.rotation.z = angle;
    if (z !== 0) root.rotation.x = z > 0 ? 1.05 : -1.05;
  }
}

function addEmberArchitecture(group: THREE.Group): void {
  const basalt = material(0x41383a);
  const obsidian = material(0x27232b, 0.55);
  const lava = material(0xe16a32, 0.35);
  lava.emissive.setHex(0x7a210d);
  cylinder(group, 0.57, 0.64, 0.16, 8, obsidian, 0, 0.08, 0);
  box(group, 0.65, 0.25, 0.55, basalt, 0, 0.25, 0);
  box(group, 0.48, 0.3, 0.42, basalt, 0, 0.51, 0);
  box(group, 0.31, 0.25, 0.3, obsidian, 0, 0.78, 0);
  cone(group, 0.24, 0.48, 5, lava, 0, 1.12, 0);
  for (const [x, z, height] of [[-0.37, -0.24, 0.65], [0.37, -0.24, 0.82], [-0.37, 0.25, 0.48], [0.37, 0.25, 0.55]] as const) {
    cylinder(group, 0.1, 0.16, height, 5, obsidian, x, height / 2 + 0.12, z);
    cone(group, 0.13, 0.35, 5, lava, x, height + 0.27, z);
  }
  box(group, 0.16, 0.28, 0.035, lava, 0, 0.28, 0.294);
  for (const x of [-0.2, 0.2]) box(group, 0.045, 0.32, 0.025, lava, x, 0.49, 0.225);
  box(group, 0.5, 0.035, 0.04, lava, 0, 0.13, 0.34);
}

function addMireArchitecture(group: THREE.Group): void {
  const timber = material(0x59604a);
  const darkTimber = material(0x37483e);
  const reed = material(0x52796a);
  const glow = material(0x91d2b3, 0.35);
  cylinder(group, 0.59, 0.64, 0.1, 9, material(0x43534a), 0, 0.05, 0);
  for (const [x, z] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]] as const) {
    cylinder(group, 0.045, 0.065, 0.43, 6, darkTimber, x, 0.25, z);
  }
  box(group, 0.57, 0.4, 0.45, timber, 0, 0.57, 0);
  const roof = cone(group, 0.49, 0.45, 5, reed, 0, 0.98, 0);
  roof.rotation.y = 0.35;
  roof.rotation.z = 0.08;
  box(group, 0.13, 0.28, 0.035, darkTimber, 0, 0.48, 0.244);
  for (const x of [-0.18, 0.18]) box(group, 0.075, 0.1, 0.025, glow, x, 0.65, 0.24);
  for (const [x, z] of [[-0.42, 0.12], [0.4, -0.16]] as const) {
    cylinder(group, 0.11, 0.14, 0.3, 6, timber, x, 0.32, z);
    cone(group, 0.23, 0.34, 5, reed, x, 0.59, z).rotation.z = x * 0.18;
  }
  box(group, 0.25, 0.055, 0.65, darkTimber, 0.36, 0.16, 0.25).rotation.y = -0.25;
  for (const side of [-1, 1]) {
    const root = cylinder(group, 0.035, 0.055, 0.55, 6, darkTimber, side * 0.36, 0.18, -0.27);
    root.rotation.z = side * 0.85;
  }
}

function createTownModel(object: TownObject, state: Readonly<GameState>): AdventureModel {
  const model: AdventureModel = { group: new THREE.Group(), flags: [] };
  const town = state.towns[object.townId];
  const ownerColor = town ? state.players[town.ownerId]?.color ?? '#aaaaaa' : '#aaaaaa';
  const faction = town?.faction ?? 'Haven';
  const hotaArchitecture = addHotaArchitecture(model.group, faction);
  if (!hotaArchitecture) {
    if (faction === 'Grove') addGroveArchitecture(model.group);
    else if (faction === 'Ember') addEmberArchitecture(model.group);
    else if (faction === 'Mire') addMireArchitecture(model.group);
    else addHavenArchitecture(model.group);
  }
  model.group.userData.faction = faction;
  model.group.userData.architecture = hotaArchitecture ??
    (faction === 'Grove' || faction === 'Ember' || faction === 'Mire' ? faction : 'Haven');
  const palette = HOTA_FACTION_PALETTES[faction];
  if (palette) model.group.userData.palette = [palette.wall, palette.roof, palette.accent];
  addOwnershipFlag(model, ownerColor, -0.55, -0.42, 1.35);
  model.group.add(createGroundMarker(ownerColor, 0.57));
  return model;
}

function createDwellingModel(object: DwellingObject): AdventureModel {
  const model: AdventureModel = { group: new THREE.Group(), flags: [] };
  const depleted = object.available <= 0;
  const faction = EXPANSION_FACTIONS[object.creatureId] ?? HOTA_CREATURE_FACTIONS[object.creatureId];
  const hotaPalette = HOTA_FACTION_PALETTES[faction ?? ''];
  const wallColor = hotaPalette?.wall ?? (faction === 'Ember' ? 0x514144 : faction === 'Mire' ? 0x77806a : 0xb59a70);
  const roofColor = hotaPalette?.roof ??
    (faction === 'Ember' ? 0x352d34 : faction === 'Mire' ? 0x4d7461 : object.creatureId === 'sprite' ? 0x4b8067 : 0x8d5540);
  const wall = material(depleted ? 0x77776c : wallColor);
  const roof = material(depleted ? 0x66665f : roofColor);
  if (faction === 'Mire') {
    for (const x of [-0.22, 0.22]) {
      for (const z of [-0.17, 0.17]) cylinder(model.group, 0.035, 0.05, 0.28, 5, material(0x3d4b3e), x, 0.14, z);
    }
  }
  box(model.group, 0.62, 0.42, 0.52, wall, 0, faction === 'Mire' ? 0.36 : 0.23, 0);
  const roofMesh = cone(model.group, faction === 'Mire' ? 0.56 : 0.52, 0.42, faction ? 6 : 4, roof,
    0, faction === 'Mire' ? 0.77 : 0.64, 0);
  roofMesh.rotation.y = faction ? 0.2 : Math.PI / 4;
  if (faction === 'Mire') roofMesh.rotation.z = 0.08;
  box(model.group, 0.15, 0.27, 0.035, material(faction === 'Ember' ? 0xe0783c : 0x40352b, 0.5),
    0, faction === 'Mire' ? 0.3 : 0.17, 0.278);
  cylinder(model.group, 0.055, 0.07, 0.4, 6, material(faction === 'Ember' ? 0x342d32 : 0x736048), 0.24, 0.74, -0.12);
  const fence = material(faction === 'Ember' ? 0x4a3b3b : 0x7b5b3d);
  for (const x of [-0.48, 0.48]) {
    for (let index = 0; index < 3; index += 1) {
      cone(model.group, 0.04, 0.3, 4, fence, x, 0.15, -0.25 + index * 0.24);
    }
  }
  if (faction === 'Ember') {
    for (const x of [-0.26, 0.26]) cone(model.group, 0.07, 0.4, 5, roof, x, 0.94, 0).rotation.z = x * 1.2;
  }
  if (faction) addHotaDwellingDetails(model.group, faction, depleted);
  if (faction) {
    const effigy = createCreatureModel(object.creatureId, 'attacker', { factionRing: false });
    effigy.scale.setScalar(hotaPalette ? (effigy.userData.visualHeight > 1.8 ? 0.23 : 0.29) : 0.26);
    effigy.position.set(0.05, faction === 'Mire' ? 0.87 : 0.76, 0);
    model.group.add(effigy);
  }
  const essenceColor = hotaPalette?.accent ?? (faction === 'Ember' ? 0xf08a42 : faction === 'Mire' ? 0x8fc776 : 0x92dfcf);
  const essence = addMesh(model.group, new THREE.OctahedronGeometry(0.1, 0),
    material(depleted ? 0x777777 : essenceColor, 0.35), faction ? -0.3 : 0, faction ? 0.88 : 0.98, 0);
  essence.scale.y = 1.5;
  model.group.userData.creatureId = object.creatureId;
  model.group.userData.faction = faction ?? 'Haven';
  model.group.add(createGroundMarker(depleted ? 0x7d827b : hotaPalette?.ground ??
    (faction === 'Ember' ? 0xe37c45 : faction === 'Mire' ? 0x83b56d : 0x77d6bd)));
  return model;
}

function createHumanoid(parent: THREE.Group, color: number): void {
  const body = material(color);
  const skin = material(0xd2a276);
  cylinder(parent, 0.12, 0.18, 0.42, 6, body, 0, 0.42, 0);
  addMesh(parent, new THREE.IcosahedronGeometry(0.13, 0), skin, 0, 0.72, 0);
  cone(parent, 0.18, 0.22, 6, material(0x636b68), 0, 0.87, 0);
  for (const x of [-0.09, 0.09]) cylinder(parent, 0.045, 0.055, 0.32, 5, material(0x423b34), x, 0.16, 0);
  const spear = cylinder(parent, 0.018, 0.018, 0.85, 5, material(0x6b4b31), 0.24, 0.46, 0);
  spear.rotation.z = -0.15;
  cone(parent, 0.055, 0.17, 4, material(0xbfc4bd, 0.4), 0.3, 0.92, 0).rotation.z = -0.15;
}

function createDragon(parent: THREE.Group): void {
  const scales = material(0x47794f);
  const wing = material(0x86a65d);
  const body = addMesh(parent, new THREE.DodecahedronGeometry(0.29, 0), scales, 0, 0.46, 0);
  body.scale.set(1.25, 0.85, 0.8);
  const neck = cylinder(parent, 0.09, 0.13, 0.42, 6, scales, 0.23, 0.67, 0);
  neck.rotation.z = -0.55;
  addMesh(parent, new THREE.DodecahedronGeometry(0.16, 0), scales, 0.36, 0.87, 0);
  for (const side of [-1, 1]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, -0.15, 0.46, side * 0.54, 0.32, 0.13, side * 0.36,
    ], 3));
    geometry.computeVertexNormals();
    addMesh(parent, geometry, new THREE.MeshStandardMaterial({ color: wing.color, side: THREE.DoubleSide, flatShading: true }),
      -0.05, 0.5, 0);
    cone(parent, 0.045, 0.18, 5, material(0xe2d6aa), 0.34, 1.05, side * 0.09).rotation.z = -0.35;
  }
  const tail = cone(parent, 0.12, 0.65, 6, scales, -0.43, 0.4, 0);
  tail.rotation.z = Math.PI / 2.5;
}

function createSprite(parent: THREE.Group): void {
  const glow = material(0x72d7bd, 0.3);
  addMesh(parent, new THREE.OctahedronGeometry(0.2, 0), glow, 0, 0.52, 0).scale.y = 1.5;
  addMesh(parent, new THREE.IcosahedronGeometry(0.11, 0), material(0xe6c6a0), 0, 0.82, 0);
  for (const side of [-1, 1]) {
    const wing = addMesh(parent, new THREE.CircleGeometry(0.22, 3), new THREE.MeshStandardMaterial({
      color: 0xb4e9d9,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      flatShading: true,
    }), side * 0.2, 0.6, -0.03);
    wing.rotation.y = side * 0.55;
    wing.rotation.z = side * 0.45;
  }
}

function createMonsterModel(object: MonsterObject): AdventureModel {
  const model: AdventureModel = { group: new THREE.Group(), flags: [] };
  const creatureId = object.army[0]?.creatureId ?? 'militia';
  const faction = getCreatureVisualFaction(creatureId);
  const hasExpansionModel = Boolean(EXPANSION_FACTIONS[creatureId] || HOTA_CREATURE_FACTIONS[creatureId] || faction === 'Neutral');
  if (faction === 'Neutral') {
    object.army.slice(0, 2).forEach((stack, index) => {
      const creature = createCreatureModel(stack.creatureId, 'attacker', { factionRing: false });
      creature.scale.setScalar(creature.userData.visualHeight > 1.8 ? 0.36 : 0.46);
      creature.position.set(index === 0 ? -0.25 : 0.25, 0, -0.12);
      model.group.add(creature);
    });
  } else if (hasExpansionModel) {
    const creature = createCreatureModel(creatureId, 'attacker', { factionRing: false });
    const large = creatureId === 'pitFiend' || (HOTA_CREATURE_FACTIONS[creatureId] && creature.userData.visualHeight > 1.8);
    creature.scale.setScalar(large ? 0.45 : 0.58);
    creature.position.set(-0.08, 0, -0.05);
    model.group.add(creature);
  } else if (creatureId === 'dragon') createDragon(model.group);
  else if (creatureId === 'sprite') createSprite(model.group);
  else createHumanoid(model.group, creatureId === 'archer' ? 0x56754b : 0x884f45);
  const chest = createChest();
  chest.scale.setScalar(faction === 'Neutral' ? 0.35 : 0.45);
  chest.position.set(faction === 'Neutral' ? 0 : 0.37, 0, faction === 'Neutral' ? 0.38 : 0.24);
  model.group.add(chest);
  model.group.userData.creatureId = creatureId;
  model.group.userData.creatureIds = object.army.map((stack) => stack.creatureId);
  model.group.userData.faction = faction ?? 'Haven';
  model.group.add(createGroundMarker(0xd96556, 0.47));
  return model;
}

const LANDMARK_MODEL_FACTORIES: Record<LandmarkType, () => THREE.Group> = {
  arcaneLibrary: createArcaneLibraryModel,
  warriorsArena: createWarriorsArenaModel,
  heroesShrine: createHeroesShrineModel,
  huntersLodge: createHuntersLodgeModel,
  waterwheel: createWaterwheelModel,
  elementalForge: createElementalForgeModel,
  ancientObservatory: createAncientObservatoryModel,
  healersSanctuary: createHealersSanctuaryModel,
  wayfarerPortal: createWayfarerPortalModel,
  merchantsTent: createMerchantsTentModel,
};

function createLandmarkModel(object: LandmarkObject, state: Readonly<GameState>): AdventureModel {
  const group = LANDMARK_MODEL_FACTORIES[object.landmarkId]();
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(1, 1.04 / Math.max(size.x, size.z, 0.01));
  group.scale.setScalar(scale);
  const heroId = state.selectedHeroId ?? '';
  const visited = hasVisitedLandmark(object, heroId);
  const depleted = isLandmarkUsed(object, heroId, state.calendar.day);
  if (depleted) {
    const surfaces = new Set<THREE.Material>();
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const surface of materials) surfaces.add(surface);
    });
    for (const surface of surfaces) {
      if (!('color' in surface) || !(surface.color instanceof THREE.Color)) continue;
      surface.color.multiplyScalar(0.58);
      surface.userData.fogBaseColor = surface.color.getHex();
    }
  }
  group.userData.landmarkId = object.landmarkId;
  group.userData.kind = 'landmark';
  group.userData.faction = 'Neutral';
  group.userData.visited = visited;
  group.userData.depleted = depleted;
  group.userData.visualHeight = size.y * scale;
  group.userData.labelHeight = bounds.max.y * scale + 0.45;
  group.add(createGroundMarker(depleted ? 0x777b76 : object.landmarkId === 'wayfarerPortal' ? 0x72d9e8 : 0xe2c675, 0.5));
  return { group, flags: [] };
}

export function createObjectModel(object: MapObject, state: Readonly<GameState>): AdventureModel {
  switch (object.kind) {
    case 'resource': return createResourceModel(object);
    case 'artifact': return createArtifactModel(object.artifactId);
    case 'mine': {
      const color = object.ownerId ? state.players[object.ownerId]?.color ?? '#aaaaaa' : '#a7a693';
      return createMineModel(object, color);
    }
    case 'town': return createTownModel(object, state);
    case 'dwelling': return createDwellingModel(object);
    case 'monster': return createMonsterModel(object);
    case 'landmark': return createLandmarkModel(object, state);
  }
}

export function createHeroModel(hero: HeroState, color: THREE.ColorRepresentation): AdventureModel {
  const model: AdventureModel = { group: new THREE.Group(), flags: [] };
  const horse = material(hero.definitionId === 'rowan' ? 0xd6d0b8 : 0x76513a);
  const tack = material(0x3b302b);
  const body = addMesh(model.group, new THREE.DodecahedronGeometry(0.25, 0), horse, 0, 0.43, 0);
  body.scale.set(0.8, 0.8, 1.35);
  const neck = cylinder(model.group, 0.09, 0.13, 0.36, 6, horse, 0, 0.64, -0.25);
  neck.rotation.x = -0.35;
  addMesh(model.group, new THREE.DodecahedronGeometry(0.13, 0), horse, 0, 0.82, -0.34).scale.z = 1.35;
  for (const x of [-0.13, 0.13]) {
    for (const z of [-0.2, 0.2]) cylinder(model.group, 0.035, 0.045, 0.38, 5, horse, x, 0.2, z);
  }
  box(model.group, 0.28, 0.07, 0.31, tack, 0, 0.62, 0.03);
  cylinder(model.group, 0.1, 0.15, 0.37, 6, material(color), 0, 0.85, 0.02);
  addMesh(model.group, new THREE.IcosahedronGeometry(0.11, 0), material(0xd5aa83), 0, 1.1, 0.02);
  cone(model.group, 0.15, 0.18, 6, material(0xc2b993, 0.45), 0, 1.23, 0.02);
  const cape = cone(model.group, 0.2, 0.43, 5, material(color), 0, 0.82, 0.18);
  cape.rotation.x = -0.18;
  addOwnershipFlag(model, color, -0.29, 0.17, 1.4);
  model.group.add(createGroundMarker(color, 0.45));
  model.group.scale.setScalar(0.88);
  return model;
}
