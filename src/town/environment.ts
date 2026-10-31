import * as THREE from 'three';
import { FACTION_ARCHITECTURE, type FactionArchitecture } from './architecture';
import { TOWN_LAYOUT_BOUNDS, type TownBuildingPlacement } from './layout';
import type { FactionId } from './registry';

function material(color: THREE.ColorRepresentation, roughness = 0.88): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
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

function addRoad(
  parent: THREE.Group,
  x: number,
  z: number,
  border: THREE.Material,
  paving: THREE.Material,
): void {
  const length = Math.hypot(x, z);
  const angle = Math.atan2(x, z);
  const borderRoad = box(parent, 1.45, 0.09, length + 0.8, border, x / 2, 0.055, z / 2);
  borderRoad.rotation.y = angle;
  const road = box(parent, 1.18, 0.11, length + 0.65, paving, x / 2, 0.105, z / 2);
  road.rotation.y = angle;
  const steps = Math.max(2, Math.floor(length / 1.1));
  for (let index = 1; index < steps; index += 1) {
    const ratio = index / steps;
    const stone = box(parent, 0.82, 0.025, 0.055, border, x * ratio, 0.17, z * ratio);
    stone.rotation.y = angle;
  }
}

function addTree(
  parent: THREE.Group,
  palette: FactionArchitecture,
  x: number,
  z: number,
  height: number,
): void {
  const trunk = material(0x66503a);
  const leaves = material(palette.foliage);
  cylinder(parent, 0.11, 0.19, height * 0.62, 7, trunk, x, height * 0.31, z);
  const crown = addMesh(parent, new THREE.DodecahedronGeometry(height * 0.34, 1), leaves, x, height * 0.79, z);
  crown.scale.set(1, 0.9, 1);
  const top = addMesh(parent, new THREE.DodecahedronGeometry(height * 0.23, 0), leaves,
    x + height * 0.14, height * 1.02, z - height * 0.08);
  top.scale.y = 0.85;
}

function addRock(
  parent: THREE.Group,
  surface: THREE.Material,
  x: number,
  z: number,
  size: number,
): void {
  const rock = addMesh(parent, new THREE.DodecahedronGeometry(size, 0), surface, x, size * 0.55, z);
  rock.scale.set(1.15, 0.75, 0.85);
  rock.rotation.y = x * 0.7 + z;
}

function addLamp(
  parent: THREE.Group,
  palette: FactionArchitecture,
  x: number,
  z: number,
): void {
  const metal = material(palette.trim, 0.55);
  const glow = material(palette.accent, 0.3);
  glow.emissive.setHex(palette.accent);
  glow.emissiveIntensity = 0.65;
  cylinder(parent, 0.045, 0.07, 1.9, 7, metal, x, 0.95, z);
  box(parent, 0.32, 0.42, 0.32, glow, x, 1.95, z);
  cone(parent, 0.29, 0.35, 4, metal, x, 2.32, z).rotation.y = Math.PI / 4;
}

function addFactionTerrainDetails(parent: THREE.Group, faction: FactionId, palette: FactionArchitecture): void {
  const accent = material(palette.accent, 0.38);
  accent.emissive.setHex(palette.accent);
  accent.emissiveIntensity = faction === 'ember' || faction === 'conflux' ? 0.55 : 0.18;
  const dark = material(palette.trim);
  if (faction === 'cove' || faction === 'mire') {
    const water = material(faction === 'cove' ? 0x3f9ca8 : 0x466f61, 0.28);
    for (const [x, z, scale] of [[-12, -7, 1.5], [12, 7, 1.2]] as const) {
      const pool = cylinder(parent, 1.4 * scale, 1.55 * scale, 0.09, 18, water, x, 0.12, z);
      pool.scale.z = 0.6;
      for (let index = 0; index < 5; index += 1) {
        const reed = cylinder(parent, 0.025, 0.035, 0.9, 5, dark,
          x - 1 + index * 0.43, 0.48, z + 0.65);
        reed.rotation.z = (index - 2) * 0.08;
      }
    }
  } else if (faction === 'ember' || faction === 'dungeon') {
    for (const [x, z] of [[-12, -7], [12, 6], [-11, 8]] as const) {
      for (let index = 0; index < 3; index += 1) {
        const shard = cone(parent, 0.25 + index * 0.08, 1.3 + index * 0.55, 6,
          index === 1 ? accent : dark, x + index * 0.5, 0.7 + index * 0.25, z);
        shard.rotation.z = (index - 1) * 0.18;
      }
    }
  } else if (faction === 'necropolis') {
    for (const [x, z] of [[-12, -7], [12, 7], [-12, 7]] as const) {
      for (let index = 0; index < 3; index += 1) {
        box(parent, 0.48, 0.85, 0.18, dark, x + index * 0.65, 0.45, z);
        box(parent, 0.28, 0.06, 0.04, accent, x + index * 0.65, 0.55, z + 0.12);
      }
    }
  } else if (faction === 'factory') {
    for (const [x, z] of [[-12, -7], [12, 7]] as const) {
      cylinder(parent, 0.16, 0.2, 2.4, 8, dark, x, 1.2, z);
      const pipe = cylinder(parent, 0.14, 0.14, 2.1, 8, accent, x + 0.85, 1.9, z);
      pipe.rotation.z = Math.PI / 2;
      const gear = addMesh(parent, new THREE.TorusGeometry(0.65, 0.12, 6, 12), accent, x, 1.1, z + 0.3);
      gear.userData.townAnimation = 'spinZ';
    }
  } else if (faction === 'stronghold' || faction === 'bulwark') {
    for (const side of [-1, 1]) {
      for (let index = 0; index < 6; index += 1) {
        const x = side * (10.8 + index * 0.35);
        cylinder(parent, 0.09, 0.13, 1.5 + (index % 2) * 0.35, 6, dark, x, 0.8, -8.5);
        cone(parent, 0.14, 0.4, 6, accent, x, 1.75 + (index % 2) * 0.35, -8.5);
      }
    }
  } else if (faction === 'conflux' || faction === 'tower') {
    for (const [x, z] of [[-12, -7], [12, 7], [-12, 7], [12, -7]] as const) {
      cylinder(parent, 0.18, 0.3, 1.25, 8, dark, x, 0.65, z);
      const crystal = addMesh(parent, new THREE.OctahedronGeometry(0.48, 0), accent, x, 1.85, z);
      crystal.scale.y = 1.6;
      crystal.userData.townAnimation = 'float';
      crystal.userData.baseY = crystal.position.y;
    }
  } else {
    for (const [x, z] of [[-12, -7], [12, 7], [-12, 7], [12, -7]] as const) addLamp(parent, palette, x, z);
  }
}

export function createTownEnvironment(
  faction: FactionId,
  layout: readonly TownBuildingPlacement[],
): THREE.Group {
  const palette = FACTION_ARCHITECTURE[faction];
  const group = new THREE.Group();
  group.name = `town-environment-${faction}`;
  group.userData.faction = faction;
  const earth = material(palette.terrain);
  const ground = material(palette.ground);
  const border = material(palette.trim);
  const paving = material(new THREE.Color(palette.wall).multiplyScalar(0.78));
  const base = cylinder(group, 17.2, 18.0, 0.85, 48, earth, 0, -0.43, 0);
  base.scale.z = TOWN_LAYOUT_BOUNDS.depth / TOWN_LAYOUT_BOUNDS.width;
  const lawn = cylinder(group, 16.9, 17.1, 0.24, 48, ground, 0, -0.02, 0);
  lawn.scale.z = TOWN_LAYOUT_BOUNDS.depth / TOWN_LAYOUT_BOUNDS.width;
  cylinder(group, 3.35, 3.5, 0.15, 24, border, 0, 0.08, 0);
  cylinder(group, 3.05, 3.15, 0.17, 24, paving, 0, 0.16, 0);
  const medallion = cylinder(group, 1.05, 1.05, 0.035, 16, material(palette.accent), 0, 0.265, 0);
  medallion.receiveShadow = true;
  for (const placement of layout) addRoad(group, placement.x, placement.z, border, paving);

  const offset = Object.keys(FACTION_ARCHITECTURE).indexOf(faction) * 0.37;
  for (let index = 0; index < 25; index += 1) {
    const angle = index * 2.399963 + offset;
    const x = Math.sin(angle) * (12.4 + (index % 3) * 0.8);
    const z = Math.cos(angle) * (10.1 + (index % 4) * 0.55);
    if (faction === 'ember' || faction === 'dungeon' || faction === 'necropolis' || faction === 'factory') {
      addRock(group, index % 4 === 0 ? border : earth, x, z, 0.45 + (index % 3) * 0.18);
    } else {
      addTree(group, palette, x, z, 1.5 + (index % 4) * 0.28);
    }
  }
  for (const [x, z] of [[-3.4, -2.6], [3.4, -2.6], [-3.4, 2.6], [3.4, 2.6]] as const) {
    addLamp(group, palette, x, z);
  }
  addFactionTerrainDetails(group, faction, palette);
  return group;
}
