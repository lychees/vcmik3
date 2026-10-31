import * as THREE from 'three';
import { BUILDINGS } from '../game/content';
import { FACTION_ARCHITECTURE, type FactionArchitecture } from './architecture';
import { createFactionPackModel } from './packs';
import type { BuildingModelSpec, FactionId } from './registry';

interface ModelMaterials {
  wall: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
}

function material(
  color: THREE.ColorRepresentation,
  roughness = 0.82,
  metalness = 0,
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}

function luminous(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  const result = material(color, 0.32, 0.08);
  result.emissive.set(color);
  result.emissiveIntensity = 0.48;
  return result;
}

function createMaterials(palette: FactionArchitecture): ModelMaterials {
  return {
    wall: material(palette.wall),
    trim: material(palette.trim),
    roof: material(palette.roof),
    accent: material(palette.accent, 0.42, 0.28),
    dark: material(0x292b2c),
    wood: material(palette.construction === 'timber' ? palette.wall : 0x725139),
    glass: luminous(palette.construction === 'basalt' ? palette.accent : 0x91cbd1),
    glow: luminous(palette.accent),
  };
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

function polyhedron(
  parent: THREE.Object3D,
  radius: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  detail = 0,
): THREE.Mesh {
  return addMesh(parent, new THREE.DodecahedronGeometry(radius, detail), surface, x, y, z);
}

function torus(
  parent: THREE.Object3D,
  radius: number,
  tube: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  arc = Math.PI * 2,
): THREE.Mesh {
  return addMesh(parent, new THREE.TorusGeometry(radius, tube, 5, 20, arc), surface, x, y, z);
}

function roof(
  parent: THREE.Object3D,
  width: number,
  depth: number,
  height: number,
  y: number,
  surface: THREE.Material,
  sides: number,
): THREE.Mesh {
  const result = cone(parent, width * 0.72, height, sides, surface, 0, y, 0);
  result.scale.z = depth / width;
  if (sides === 4) result.rotation.y = Math.PI / 4;
  return result;
}

function addDoor(parent: THREE.Object3D, mats: ModelMaterials, y: number, z: number, width = 0.5): void {
  box(parent, width, y * 1.45, 0.08, mats.dark, 0, y * 0.72, z);
  polyhedron(parent, 0.045, mats.accent, width * 0.28, y * 0.74, z + 0.06);
}

function addWindows(
  parent: THREE.Object3D,
  mats: ModelMaterials,
  positions: readonly (readonly [number, number, number])[],
): void {
  for (const [x, y, z] of positions) {
    box(parent, 0.34, 0.48, 0.055, mats.trim, x, y, z);
    box(parent, 0.24, 0.37, 0.065, mats.glass, x, y, z + 0.012);
    box(parent, 0.035, 0.38, 0.075, mats.accent, x, y, z + 0.025);
  }
}

function addBanner(
  parent: THREE.Object3D,
  mats: ModelMaterials,
  x: number,
  y: number,
  z: number,
  height = 1.5,
): void {
  cylinder(parent, 0.025, 0.035, height, 6, mats.wood, x, y + height / 2, z);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, 0.65, -0.14, 0.04, 0, -0.52, 0,
  ], 3));
  geometry.computeVertexNormals();
  const cloth = new THREE.MeshStandardMaterial({
    color: mats.accent.color,
    roughness: 0.9,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  addMesh(parent, geometry, cloth, x, y + height - 0.05, z);
  polyhedron(parent, 0.065, mats.accent, x, y + height + 0.03, z);
}

function addCrenellations(
  parent: THREE.Object3D,
  mats: ModelMaterials,
  width: number,
  depth: number,
  y: number,
): void {
  for (let index = -2; index <= 2; index += 1) {
    box(parent, 0.34, 0.38, 0.32, mats.trim, index * width / 5, y, depth / 2);
    box(parent, 0.34, 0.38, 0.32, mats.trim, index * width / 5, y, -depth / 2);
  }
  for (const side of [-1, 1]) {
    for (const z of [-depth * 0.22, 0, depth * 0.22]) {
      box(parent, 0.32, 0.38, 0.34, mats.trim, side * width / 2, y, z);
    }
  }
}

function addTarget(parent: THREE.Object3D, mats: ModelMaterials, x: number, y: number, z: number): void {
  box(parent, 0.08, y, 0.08, mats.wood, x, y / 2, z - 0.05);
  const disk = cylinder(parent, 0.34, 0.34, 0.08, 16, mats.wall, x, y, z);
  disk.rotation.x = Math.PI / 2;
  torus(parent, 0.23, 0.035, mats.roof, x, y, z + 0.055);
  const bullseye = cylinder(parent, 0.075, 0.075, 0.09, 12, mats.accent, x, y, z + 0.03);
  bullseye.rotation.x = Math.PI / 2;
}

function addCrossedWeapons(
  parent: THREE.Object3D,
  mats: ModelMaterials,
  x: number,
  y: number,
  z: number,
  size = 1,
): void {
  for (const side of [-1, 1]) {
    const blade = box(parent, 0.07 * size, 1.15 * size, 0.055 * size, mats.accent, x, y, z);
    blade.rotation.z = side * 0.62;
    const guard = box(parent, 0.36 * size, 0.07 * size, 0.09 * size, mats.trim,
      x - side * 0.31 * size, y - 0.45 * size, z + 0.02);
    guard.rotation.z = side * 0.62;
  }
}

function addHorns(
  parent: THREE.Object3D,
  mats: ModelMaterials,
  x: number,
  y: number,
  z: number,
  size = 1,
): void {
  for (const side of [-1, 1]) {
    const horn = cone(parent, 0.16 * size, 1.05 * size, 7, mats.accent,
      x + side * 0.38 * size, y, z);
    horn.rotation.z = side * 0.78;
  }
}

function addWings(
  parent: THREE.Object3D,
  surface: THREE.Material,
  x: number,
  y: number,
  z: number,
  size = 1,
): void {
  for (const side of [-1, 1]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0,
      side * 1.25 * size, 0.72 * size, 0,
      side * 0.86 * size, -0.42 * size, 0,
      0, 0, 0,
      side * 0.86 * size, -0.42 * size, 0,
      side * 0.42 * size, -0.2 * size, 0,
    ], 3));
    geometry.computeVertexNormals();
    addMesh(parent, geometry, surface, x, y, z);
  }
}

function addGear(
  parent: THREE.Object3D,
  mats: ModelMaterials,
  x: number,
  y: number,
  z: number,
  radius = 0.48,
): THREE.Group {
  const gear = new THREE.Group();
  torus(gear, radius, radius * 0.17, mats.accent);
  cylinder(gear, radius * 0.17, radius * 0.17, 0.13, 10, mats.trim).rotation.x = Math.PI / 2;
  for (let index = 0; index < 10; index += 1) {
    const angle = index / 10 * Math.PI * 2;
    const tooth = box(gear, radius * 0.2, radius * 0.34, 0.14, mats.accent,
      Math.sin(angle) * radius, Math.cos(angle) * radius, 0);
    tooth.rotation.z = -angle;
  }
  gear.position.set(x, y, z);
  gear.userData.townAnimation = 'spinZ';
  parent.add(gear);
  return gear;
}

function addFlame(
  parent: THREE.Object3D,
  mats: ModelMaterials,
  x: number,
  y: number,
  z: number,
  size = 1,
): void {
  const flame = new THREE.Group();
  cone(flame, 0.32 * size, 1.05 * size, 7, mats.glow, 0, 0.48 * size, 0);
  const inner = cone(flame, 0.17 * size, 0.72 * size, 6, luminous(0xffd36a), 0.08 * size, 0.35 * size, 0.04);
  inner.rotation.z = -0.18;
  flame.position.set(x, y, z);
  flame.userData.townAnimation = 'pulse';
  parent.add(flame);
}

function addMushrooms(parent: THREE.Object3D, mats: ModelMaterials, glowing = false): void {
  for (const [x, z, size] of [[-0.8, 0.6, 0.7], [0.75, 0.5, 1], [0.45, -0.75, 0.58]] as const) {
    cylinder(parent, 0.07 * size, 0.1 * size, 0.55 * size, 7, mats.wall, x, 0.28 * size, z);
    const cap = addMesh(parent, new THREE.SphereGeometry(0.29 * size, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      glowing ? mats.glow : mats.roof, x, 0.53 * size, z);
    cap.scale.y = 0.65;
  }
}

function addGravestones(parent: THREE.Object3D, mats: ModelMaterials, count = 4): void {
  for (let index = 0; index < count; index += 1) {
    const x = (index % 2 === 0 ? -1 : 1) * (0.65 + Math.floor(index / 2) * 0.3);
    const z = 0.75 - Math.floor(index / 2) * 1.35;
    box(parent, 0.38, 0.65, 0.16, mats.trim, x, 0.35, z);
    polyhedron(parent, 0.2, mats.trim, x, 0.68, z).scale.set(1, 0.7, 0.42);
    box(parent, 0.2, 0.045, 0.03, mats.accent, x, 0.42, z + 0.1);
  }
}

function addLightning(
  parent: THREE.Object3D,
  mats: ModelMaterials,
  x: number,
  y: number,
  z: number,
  size = 1,
): void {
  const upper = box(parent, 0.17 * size, 0.85 * size, 0.1 * size, mats.glow, x, y + 0.28 * size, z);
  upper.rotation.z = -0.42;
  const lower = box(parent, 0.17 * size, 0.8 * size, 0.1 * size, mats.glow,
    x + 0.18 * size, y - 0.38 * size, z);
  lower.rotation.z = -0.42;
}

function addBeast(
  parent: THREE.Object3D,
  mats: ModelMaterials,
  color: THREE.ColorRepresentation,
  options: { horn?: boolean; wings?: boolean; mane?: boolean; horns?: boolean } = {},
): void {
  const hide = material(color);
  const body = polyhedron(parent, 0.52, hide, 0, 0.83, 0);
  body.scale.set(1.25, 0.75, 0.72);
  polyhedron(parent, 0.29, hide, 0.58, 1.12, 0.03);
  for (const x of [-0.35, 0.35]) {
    for (const z of [-0.24, 0.24]) cylinder(parent, 0.07, 0.09, 0.58, 6, hide, x, 0.36, z);
  }
  if (options.horn) cone(parent, 0.07, 0.65, 7, mats.accent, 0.68, 1.57, 0.03).rotation.z = -0.18;
  if (options.horns) addHorns(parent, mats, 0.55, 1.45, 0.03, 0.55);
  if (options.mane) torus(parent, 0.36, 0.15, mats.accent, 0.48, 1.12, 0.02);
  if (options.wings) addWings(parent, mats.accent, -0.1, 1.2, -0.18, 0.8);
}

function addSkull(
  parent: THREE.Object3D,
  mats: ModelMaterials,
  x: number,
  y: number,
  z: number,
  spectral = false,
): void {
  const bone = spectral ? mats.glow : material(0xd5d0b6);
  const skull = polyhedron(parent, 0.48, bone, x, y, z);
  skull.scale.set(1, 0.82, 0.72);
  box(parent, 0.46, 0.24, 0.36, bone, x, y - 0.36, z + 0.08);
  for (const side of [-1, 1]) polyhedron(parent, 0.1, mats.dark, x + side * 0.18, y + 0.05, z + 0.34);
  addHorns(parent, mats, x, y + 0.35, z - 0.05, 0.75);
}

function addBook(parent: THREE.Object3D, mats: ModelMaterials, x: number, y: number, z: number): void {
  for (const side of [-1, 1]) {
    const page = box(parent, 0.68, 0.09, 0.86, mats.wall, x + side * 0.3, y, z);
    page.rotation.z = side * 0.22;
    const cover = box(parent, 0.72, 0.07, 0.91, mats.roof, x + side * 0.31, y - 0.08, z);
    cover.rotation.z = side * 0.22;
  }
  polyhedron(parent, 0.1, mats.glow, x, y + 0.34, z);
}

function addTree(
  parent: THREE.Object3D,
  trunk: THREE.Material,
  leaves: THREE.Material,
  x: number,
  z: number,
  height: number,
): void {
  cylinder(parent, 0.12 * height / 2, 0.2 * height / 2, height * 0.65, 7, trunk, x, height * 0.325, z);
  const crown = polyhedron(parent, height * 0.32, leaves, x, height * 0.78, z, 1);
  crown.scale.set(1, 0.85, 1);
  polyhedron(parent, height * 0.2, leaves, x + height * 0.15, height * 0.98, z).scale.y = 0.8;
}

function createTownHall(parent: THREE.Group, mats: ModelMaterials, palette: FactionArchitecture): void {
  box(parent, 4.6, 0.28, 3.8, mats.trim, 0, 0.14, 0);
  box(parent, 3.6, 2.15, 2.65, mats.wall, 0, 1.35, 0);
  roof(parent, 3.2, 3.05, 1.25, 2.95, mats.roof, palette.roofSides);
  addDoor(parent, mats, 0.92, 1.37, 0.65);
  addWindows(parent, mats, [[-1.05, 1.55, 1.36], [1.05, 1.55, 1.36]]);
  for (const side of [-1, 1]) {
    cylinder(parent, 0.47, 0.56, 2.45, 8, mats.wall, side * 1.82, 1.38, 0);
    cone(parent, 0.7, 1.1, palette.roofSides, mats.roof, side * 1.82, 3.12, 0);
  }
  box(parent, 1.25, 1.55, 1.2, mats.wall, 0, 3.38, -0.15);
  roof(parent, 1.45, 1.4, 1.15, 4.65, mats.roof, palette.roofSides).position.z = -0.15;
  addWindows(parent, mats, [[0, 3.5, 0.48]]);
  addBanner(parent, mats, -0.75, 0.1, 1.75, 2.0);
}

function createCapitol(parent: THREE.Group, mats: ModelMaterials, palette: FactionArchitecture): void {
  for (let index = 0; index < 3; index += 1) {
    box(parent, 4.4 - index * 0.35, 0.18, 3.9 - index * 0.35, mats.trim, 0, 0.09 + index * 0.17, 0);
  }
  box(parent, 3.75, 2.25, 2.8, mats.wall, 0, 1.65, -0.1);
  for (const x of [-1.35, -0.48, 0.48, 1.35]) {
    cylinder(parent, 0.12, 0.16, 1.95, 10, mats.trim, x, 1.55, 1.43);
    cylinder(parent, 0.2, 0.2, 0.12, 10, mats.accent, x, 2.55, 1.43);
  }
  box(parent, 4.05, 0.25, 3.1, mats.trim, 0, 2.82, -0.05);
  const dome = addMesh(parent, new THREE.SphereGeometry(1.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    mats.roof, 0, 2.93, -0.1);
  dome.scale.y = 1.15;
  cylinder(parent, 0.09, 0.14, 1.2, 8, mats.accent, 0, 4.55, -0.1);
  polyhedron(parent, 0.2, mats.glow, 0, 5.22, -0.1);
  addDoor(parent, mats, 0.85, 1.47, 0.7);
  addWindows(parent, mats, [[-1.25, 1.85, 1.32], [1.25, 1.85, 1.32]]);
  addBanner(parent, mats, 1.8, 0.3, 1.45, 2.4);
  roof(parent, 1.0, 1.0, 0.55, 3.28, mats.roof, palette.roofSides).position.x = -1.55;
}

function createMarket(parent: THREE.Group, mats: ModelMaterials, palette: FactionArchitecture): void {
  cylinder(parent, 2.15, 2.3, 0.22, 12, mats.trim, 0, 0.11, 0);
  const stalls = [[-1.1, -0.55], [1.1, -0.55], [0, 0.95]] as const;
  for (let index = 0; index < stalls.length; index += 1) {
    const [x, z] = stalls[index]!;
    const stall = new THREE.Group();
    box(stall, 1.55, 0.18, 1.15, mats.wood, 0, 0.78, 0);
    for (const side of [-1, 1]) {
      for (const depth of [-1, 1]) cylinder(stall, 0.04, 0.05, 1.75, 6, mats.wood, side * 0.65, 0.88, depth * 0.43);
    }
    const awning = roof(stall, 1.75, 1.45, 0.72, 1.95, index % 2 === 0 ? mats.roof : mats.accent, palette.roofSides);
    awning.scale.y = 0.8;
    for (let good = 0; good < 4; good += 1) {
      polyhedron(stall, 0.12, good % 2 === 0 ? mats.glow : mats.wall, -0.5 + good * 0.32, 0.96, 0.05);
    }
    stall.position.set(x, 0, z);
    stall.rotation.y = index === 2 ? Math.PI : index === 0 ? 0.35 : -0.35;
    parent.add(stall);
  }
  for (const [x, z] of [[-1.55, 1.2], [1.5, 1.15]] as const) {
    box(parent, 0.48, 0.45, 0.48, mats.wood, x, 0.28, z);
    box(parent, 0.52, 0.06, 0.52, mats.accent, x, 0.42, z);
  }
  torus(parent, 0.4, 0.055, mats.accent, 0, 2.45, 0).rotation.x = Math.PI / 2;
}

function createFort(parent: THREE.Group, mats: ModelMaterials, palette: FactionArchitecture): void {
  box(parent, 4.8, 0.24, 4.0, mats.trim, 0, 0.12, 0);
  box(parent, 4.1, 1.75, 0.55, mats.wall, 0, 1.05, -1.45);
  for (const side of [-1, 1]) box(parent, 0.55, 1.75, 3.1, mats.wall, side * 1.82, 1.05, 0);
  box(parent, 1.25, 1.75, 0.55, mats.wall, -1.43, 1.05, 1.45);
  box(parent, 1.25, 1.75, 0.55, mats.wall, 1.43, 1.05, 1.45);
  box(parent, 1.65, 0.48, 0.55, mats.wall, 0, 1.68, 1.45);
  box(parent, 1.45, 1.45, 0.12, mats.dark, 0, 0.82, 1.55);
  for (const x of [-0.55, -0.27, 0, 0.27, 0.55]) box(parent, 0.055, 1.5, 0.08, mats.accent, x, 0.84, 1.64);
  for (const [x, z] of [[-1.85, -1.45], [1.85, -1.45], [-1.85, 1.45], [1.85, 1.45]] as const) {
    cylinder(parent, 0.64, 0.72, 2.45, 8, mats.wall, x, 1.35, z);
    cylinder(parent, 0.76, 0.76, 0.18, 8, mats.trim, x, 2.6, z);
    cone(parent, 0.72, 1.0, palette.roofSides, mats.roof, x, 3.15, z);
  }
  addCrenellations(parent, mats, 3.7, 2.65, 2.12);
  addBanner(parent, mats, 0, 1.8, -1.25, 2.1);
}

function createMageGuild(parent: THREE.Group, mats: ModelMaterials, palette: FactionArchitecture): void {
  cylinder(parent, 1.8, 2.0, 0.3, 12, mats.trim, 0, 0.15, 0);
  cylinder(parent, 1.28, 1.55, 1.2, 10, mats.wall, 0, 0.9, 0);
  cylinder(parent, 0.92, 1.18, 2.2, 10, mats.wall, 0, 2.55, 0);
  cylinder(parent, 1.18, 1.18, 0.2, 10, mats.trim, 0, 3.65, 0);
  cone(parent, 1.35, 2.0, palette.roofSides, mats.roof, 0, 4.72, 0);
  addDoor(parent, mats, 0.75, 1.49, 0.58);
  addWindows(parent, mats, [[-0.62, 2.5, 0.88], [0.62, 2.5, 0.88], [0, 3.15, 0.94]]);
  const crystal = polyhedron(parent, 0.42, mats.glow, 0, 5.95, 0);
  crystal.scale.y = 1.55;
  crystal.userData.townAnimation = 'float';
  crystal.userData.baseY = crystal.position.y;
  for (const [radius, y, tilt] of [[1.15, 4.15, 0.55], [0.82, 5.55, -0.45]] as const) {
    const ring = torus(parent, radius, 0.055, mats.accent, 0, y, 0);
    ring.rotation.x = Math.PI / 2 + tilt;
    ring.userData.townAnimation = 'spin';
  }
  for (const side of [-1, 1]) cone(parent, 0.18, 1.4, 6, mats.accent, side * 1.35, 1.25, 0).rotation.z = side * 0.18;
}

function createDwellingBase(
  parent: THREE.Group,
  spec: BuildingModelSpec,
  mats: ModelMaterials,
  palette: FactionArchitecture,
): void {
  const tier = spec.tier;
  if (spec.form === 'hall') {
    box(parent, 3.15, 0.22, 2.85, mats.trim, 0, 0.11, 0);
    box(parent, 2.65, 1.45 + tier * 0.12, 2.1, mats.wall, 0, 0.9 + tier * 0.06, 0);
    roof(parent, 2.65, 2.55, 1.1, 2.05 + tier * 0.12, mats.roof, palette.roofSides);
    addDoor(parent, mats, 0.65, 1.09);
    addWindows(parent, mats, [[-0.78, 1.15, 1.08], [0.78, 1.15, 1.08]]);
    box(parent, 0.35, 1.05, 0.38, mats.trim, 0.82, 2.3, -0.45);
  } else if (spec.form === 'bastion') {
    box(parent, 3.35, 0.25, 3.05, mats.trim, 0, 0.125, 0);
    box(parent, 2.9, 1.6 + tier * 0.12, 2.5, mats.wall, 0, 1.0 + tier * 0.06, 0);
    addCrenellations(parent, mats, 2.85, 2.45, 1.98 + tier * 0.12);
    addDoor(parent, mats, 0.72, 1.3, 0.62);
    for (const side of [-1, 1]) {
      cylinder(parent, 0.35, 0.43, 2.0 + tier * 0.15, 8, mats.wall, side * 1.35, 1.15 + tier * 0.075, -0.85);
      cone(parent, 0.46, 0.8, palette.roofSides, mats.roof, side * 1.35, 2.5 + tier * 0.15, -0.85);
    }
  } else if (spec.form === 'tower') {
    const height = 2.35 + tier * 0.4;
    cylinder(parent, 1.55, 1.72, 0.25, 12, mats.trim, 0, 0.125, 0);
    cylinder(parent, 0.9, 1.25, height, 10, mats.wall, 0, height / 2 + 0.22, 0);
    cylinder(parent, 1.18, 1.18, 0.2, 10, mats.trim, 0, height + 0.25, 0);
    cone(parent, 1.35, 1.4, palette.roofSides, mats.roof, 0, height + 1.0, 0);
    addDoor(parent, mats, 0.66, 1.19);
    addWindows(parent, mats, [[0, height * 0.62, 1.03], [0, height * 0.88, 0.95]]);
  } else if (spec.form === 'grove') {
    cylinder(parent, 1.7, 1.85, 0.2, 12, mats.trim, 0, 0.1, 0);
    addTree(parent, mats.wood, material(palette.foliage), -0.85, -0.45, 2.6 + tier * 0.25);
    addTree(parent, mats.wood, material(palette.foliage), 0.9, -0.55, 2.1 + tier * 0.2);
    addTree(parent, mats.wood, mats.roof, 0.2, 0.75, 1.75 + tier * 0.16);
    cylinder(parent, 0.65, 0.72, 0.12, 12, mats.glass, 0.55, 0.12, 0.65);
  } else if (spec.form === 'cavern') {
    cylinder(parent, 1.75, 1.9, 0.22, 10, mats.trim, 0, 0.11, 0);
    for (const [x, z, size] of [[-0.85, -0.25, 1.2], [0.65, -0.5, 1.45], [0, -1, 1.35], [1.1, 0.4, 0.75]] as const) {
      const rock = polyhedron(parent, size, mats.wall, x, size * 1.05, z);
      rock.scale.set(1, 1.05, 0.8);
    }
    box(parent, 1.15, 1.25, 0.15, mats.dark, 0, 0.72, 1.05);
    torus(parent, 0.68, 0.16, mats.trim, 0, 1.1, 1.03, Math.PI);
    for (const side of [-1, 1]) {
      const height = 1.2 + tier * 0.15;
      cone(parent, 0.2, height, 6, mats.accent, side * 1.3, height / 2 + 0.2, 0.65).rotation.z = side * 0.22;
    }
  } else if (spec.form === 'pen') {
    cylinder(parent, 1.8, 1.95, 0.16, 12, mats.trim, 0, 0.08, 0);
    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * Math.PI * 2;
      const x = Math.sin(angle) * 1.65;
      const z = Math.cos(angle) * 1.45;
      cylinder(parent, 0.055, 0.075, 1.05, 6, mats.wood, x, 0.53, z);
      if (index % 2 === 0) cone(parent, 0.1, 0.3, 6, mats.accent, x, 1.18, z);
    }
    torus(parent, 1.55, 0.055, mats.wood, 0, 0.65, 0).rotation.x = Math.PI / 2;
    box(parent, 1.45, 1.1, 1.25, mats.wall, 0, 0.7, -0.65);
    roof(parent, 1.5, 1.5, 0.75, 1.55, mats.roof, palette.roofSides).position.z = -0.65;
  } else if (spec.form === 'ritual') {
    cylinder(parent, 1.75, 1.95, 0.25, 12, mats.trim, 0, 0.125, 0);
    cylinder(parent, 1.35, 1.55, 0.35, 12, mats.wall, 0, 0.42, 0);
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2;
      const x = Math.sin(angle) * 1.3;
      const z = Math.cos(angle) * 1.3;
      cylinder(parent, 0.11, 0.18, 1.55 + tier * 0.15, 7, mats.wall, x, 1.15, z);
      polyhedron(parent, 0.15, mats.glow, x, 2.0 + tier * 0.15, z);
    }
    const orb = polyhedron(parent, 0.48 + tier * 0.05, mats.glow, 0, 1.75, 0);
    orb.scale.y = 1.35;
    orb.userData.townAnimation = 'float';
    orb.userData.baseY = orb.position.y;
    const ring = torus(parent, 1.05, 0.05, mats.accent, 0, 1.75, 0);
    ring.rotation.x = 0.8;
    ring.userData.townAnimation = 'spin';
  } else if (spec.form === 'ruins') {
    box(parent, 3.2, 0.22, 2.9, mats.trim, 0, 0.11, 0);
    box(parent, 2.4, 1.2, 0.35, mats.wall, 0, 0.75, -1.0);
    for (const [x, z, height] of [[-1.15, -0.8, 2.3], [1.15, -0.8, 1.75], [-1.15, 0.75, 1.25], [1.15, 0.75, 2.0]] as const) {
      cylinder(parent, 0.18, 0.25, height, 8, mats.wall, x, height / 2 + 0.2, z);
      cylinder(parent, 0.3, 0.3, 0.12, 8, mats.trim, x, height + 0.22, z);
    }
    box(parent, 1.2, 0.65, 1.8, mats.roof, 0, 0.5, 0);
    addDoor(parent, mats, 0.52, 0.94, 0.58);
  } else if (spec.form === 'industrial') {
    box(parent, 3.35, 0.25, 3.0, mats.trim, 0, 0.125, 0);
    box(parent, 2.85, 1.75 + tier * 0.12, 2.35, mats.wall, 0, 1.08 + tier * 0.06, 0);
    const barrelRoof = cylinder(parent, 1.35, 1.35, 2.45, 12, mats.roof, 0, 2.05 + tier * 0.12, 0);
    barrelRoof.rotation.z = Math.PI / 2;
    barrelRoof.scale.z = 0.55;
    for (const [x, height] of [[-0.85, 2.8], [0.85, 2.35]] as const) {
      cylinder(parent, 0.16, 0.23, height, 8, mats.trim, x, height / 2 + 0.7, -0.65);
      cylinder(parent, 0.26, 0.18, 0.25, 8, mats.accent, x, height + 0.78, -0.65);
    }
    addDoor(parent, mats, 0.72, 1.22, 0.75);
    addWindows(parent, mats, [[-0.85, 1.35, 1.2], [0.85, 1.35, 1.2]]);
  } else if (spec.form === 'aquatic') {
    cylinder(parent, 1.85, 2.0, 0.2, 16, mats.trim, 0, 0.1, 0);
    cylinder(parent, 1.58, 1.58, 0.12, 16, mats.glass, 0, 0.22, 0);
    for (const x of [-0.85, 0.85]) {
      for (const z of [-0.65, 0.45]) cylinder(parent, 0.07, 0.1, 1.1, 7, mats.wood, x, 0.63, z);
    }
    box(parent, 1.9, 1.05, 1.45, mats.wall, 0, 1.25, -0.15);
    roof(parent, 2.05, 1.8, 0.85, 2.15, mats.roof, palette.roofSides).position.z = -0.15;
    for (let index = 0; index < 4; index += 1) box(parent, 0.48, 0.1, 1.3, mats.wood, -0.75 + index * 0.5, 0.38, 1.05);
  } else {
    throw new Error(`No dwelling base for form: ${spec.form}`);
  }
}

function addDwellingLandmark(parent: THREE.Group, spec: BuildingModelSpec, mats: ModelMaterials): void {
  switch (spec.id) {
    case 'militiaBarracks': {
      cylinder(parent, 0.09, 0.12, 1.2, 7, mats.wood, 0.9, 0.65, 1.1);
      box(parent, 0.7, 0.18, 0.18, mats.wall, 0.9, 1.25, 1.1);
      polyhedron(parent, 0.22, mats.wall, 0.9, 1.65, 1.1);
      addCrossedWeapons(parent, mats, -0.75, 1.25, 1.34, 0.65);
      break;
    }
    case 'archeryRange':
      addTarget(parent, mats, -0.8, 1.15, 1.25);
      addTarget(parent, mats, 0.15, 1.0, 1.35);
      addTarget(parent, mats, 0.95, 0.85, 1.2);
      break;
    case 'griffinTower':
      box(parent, 2.25, 0.18, 0.65, mats.wood, 0, 3.45, 0.45);
      addWings(parent, mats.accent, 0, 4.25, 0.55, 0.85);
      cone(parent, 0.16, 0.65, 6, mats.accent, 0, 4.25, 0.65).rotation.z = -Math.PI / 2;
      break;
    case 'joustingArena':
      box(parent, 0.18, 0.55, 2.65, mats.roof, 0, 0.55, 0.2);
      for (const side of [-1, 1]) {
        const lance = cylinder(parent, 0.035, 0.055, 2.65, 6, mats.wood, side * 0.9, 1.25, 0.8);
        lance.rotation.z = side * 0.85;
        cone(parent, 0.1, 0.4, 6, mats.accent, side * 1.85, 2.1, 0.8).rotation.z = side * 0.85;
      }
      break;
    case 'spriteGlade':
      addMushrooms(parent, mats, true);
      addWings(parent, mats.glow, 0, 2.25, 0.8, 0.55);
      polyhedron(parent, 0.17, mats.glow, 0, 2.25, 0.85);
      break;
    case 'rangerLodge':
      addTarget(parent, mats, 1.0, 1.1, 1.1);
      addCrossedWeapons(parent, mats, -0.85, 1.25, 1.15, 0.55);
      for (let index = 0; index < 4; index += 1) {
        const arrow = cylinder(parent, 0.018, 0.018, 1.15, 5, mats.wood, -1.15 + index * 0.1, 0.72, 0.9);
        arrow.rotation.z = -0.15;
      }
      break;
    case 'unicornGrove':
      addBeast(parent, mats, 0xe4e1d2, { horn: true });
      torus(parent, 1.25, 0.045, mats.glow, 0, 0.3, 0).rotation.x = Math.PI / 2;
      break;
    case 'dragonCliffs':
      addSkull(parent, mats, 0, 2.15, 0.8);
      addWings(parent, mats.roof, 0, 2.3, 0.4, 1.2);
      for (const x of [-0.75, 0.75]) polyhedron(parent, 0.28, mats.glow, x, 0.4, 1.1).scale.y = 1.35;
      break;
    case 'impWarrens':
      addFlame(parent, mats, -0.7, 0.45, 1.0, 0.55);
      addFlame(parent, mats, 0.65, 0.55, 0.85, 0.75);
      addHorns(parent, mats, 0, 1.6, 1.15, 0.55);
      break;
    case 'hellhoundKennels':
      for (const side of [-1, 1]) {
        polyhedron(parent, 0.38, mats.dark, side * 0.55, 1.05, 0.75);
        cone(parent, 0.12, 0.5, 5, mats.accent, side * 0.55, 1.55, 0.75).rotation.z = side * 0.35;
        polyhedron(parent, 0.07, mats.glow, side * 0.55, 1.12, 1.1);
      }
      box(parent, 0.75, 0.16, 0.18, material(0xd6ccb0), 0, 0.35, 1.35).rotation.z = 0.25;
      break;
    case 'ifritSpire':
      addFlame(parent, mats, 0, 3.8, 0, 1.05);
      torus(parent, 0.75, 0.06, mats.accent, 0, 3.7, 0).rotation.x = 0.7;
      break;
    case 'pitFiendAbyss':
      cylinder(parent, 1.05, 1.25, 0.15, 12, mats.dark, 0, 0.68, 0);
      cylinder(parent, 0.85, 0.85, 0.08, 12, mats.glow, 0, 0.77, 0);
      addHorns(parent, mats, 0, 2.75, 0.25, 1.45);
      addFlame(parent, mats, 0, 0.8, 0, 0.85);
      break;
    case 'lizardmanDen':
      addBeast(parent, mats, 0x648359, { horn: false });
      for (let index = 0; index < 4; index += 1) cone(parent, 0.09, 0.4, 5, mats.accent, -0.4 + index * 0.25, 1.42, -0.1);
      break;
    case 'gorgonPen':
      addBeast(parent, mats, 0x596356, { horns: true });
      box(parent, 1.6, 0.18, 0.18, mats.wood, 0, 1.15, 1.35);
      break;
    case 'wyvernRoost':
      box(parent, 2.4, 0.16, 1.3, mats.wood, 0, 3.15, 0);
      addWings(parent, mats.roof, 0, 3.95, 0.45, 1.0);
      cone(parent, 0.13, 1.2, 6, mats.accent, 0, 3.75, 0.4).rotation.z = -Math.PI / 2;
      break;
    case 'basiliskPit':
      for (let index = 0; index < 9; index += 1) {
        const angle = index / 9 * Math.PI * 2;
        cone(parent, 0.13, 0.9, 6, mats.accent, Math.sin(angle) * 1.1, 1.0, Math.cos(angle) * 1.1).rotation.z = Math.sin(angle) * 0.35;
      }
      polyhedron(parent, 0.42, mats.glow, 0, 1.6, 0.4).scale.set(1.35, 0.6, 0.5);
      polyhedron(parent, 0.16, mats.dark, 0, 1.6, 0.63).scale.set(0.35, 1, 0.3);
      break;
    case 'gremlinWorkshop':
      addGear(parent, mats, 0.65, 1.45, 1.25, 0.55);
      addGear(parent, mats, -0.55, 1.0, 1.25, 0.35);
      box(parent, 0.18, 0.8, 0.15, mats.wood, -1.0, 0.65, 0.85).rotation.z = -0.55;
      break;
    case 'gargoyleParapet':
      for (const side of [-1, 1]) {
        polyhedron(parent, 0.3, mats.trim, side * 0.85, 2.4, 0.9);
        addWings(parent, mats.trim, side * 0.85, 2.65, 0.85, 0.42);
        addHorns(parent, mats, side * 0.85, 2.9, 0.85, 0.25);
      }
      break;
    case 'geniePavilion':
      const lamp = polyhedron(parent, 0.35, mats.accent, 0, 1.25, 0.8);
      lamp.scale.set(1.25, 0.65, 0.75);
      torus(parent, 0.28, 0.055, mats.accent, 0.42, 1.35, 0.8, Math.PI * 1.5);
      cone(parent, 0.15, 0.65, 8, mats.accent, -0.48, 1.35, 0.8).rotation.z = Math.PI / 2;
      polyhedron(parent, 0.22, mats.glow, 0, 2.15, 0.5);
      break;
    case 'titanCloudTemple':
      for (const x of [-1.1, -0.55, 0.55, 1.1]) cylinder(parent, 0.11, 0.16, 2.25, 9, mats.wall, x, 1.4, 0.9);
      for (const [x, y] of [[-0.65, 4.2], [0, 4.5], [0.7, 4.15]] as const) polyhedron(parent, 0.55, mats.wall, x, y, 0).scale.set(1.25, 0.65, 0.8);
      addLightning(parent, mats, 0, 3.4, 0.85, 1.1);
      break;
    case 'skeletonCrypt':
      addSkull(parent, mats, 0, 1.8, 0.85);
      addCrossedWeapons(parent, mats, 0, 0.75, 1.1, 0.55);
      break;
    case 'zombieGraveyard':
      addGravestones(parent, mats, 6);
      for (const x of [-0.35, 0.35]) {
        cylinder(parent, 0.055, 0.08, 0.7, 6, mats.glow, x, 0.55, 0.5).rotation.z = x;
        polyhedron(parent, 0.12, mats.glow, x * 1.5, 0.9, 0.5);
      }
      break;
    case 'vampireEstate':
      box(parent, 2.9, 0.25, 2.4, mats.trim, 0, 2.15, 0);
      for (const side of [-1, 1]) cone(parent, 0.28, 1.7, 5, mats.roof, side * 1.1, 3.2, -0.55);
      addWings(parent, mats.dark, 0, 2.8, 1.15, 0.85);
      addWindows(parent, mats, [[-0.65, 1.5, 1.12], [0.65, 1.5, 1.12]]);
      break;
    case 'ghostDragonSepulcher':
      addSkull(parent, mats, 0, 2.55, 0.7, true);
      addWings(parent, mats.glow, 0, 2.75, 0.25, 1.25);
      torus(parent, 1.25, 0.055, mats.glow, 0, 2.3, 0).rotation.x = 0.65;
      break;
    case 'troglodyteWarrens':
      addMushrooms(parent, mats, true);
      for (const x of [-0.35, 0.35]) polyhedron(parent, 0.12, mats.glow, x, 1.15, 1.25);
      break;
    case 'harpyRoost':
      addWings(parent, mats.accent, 0, 3.4, 0.65, 1.15);
      for (const side of [-1, 1]) cone(parent, 0.12, 1.15, 5, mats.wall, side * 0.65, 2.4, 0.7).rotation.z = side * 0.35;
      break;
    case 'minotaurLabyrinth':
      for (const [x, z, w, d] of [[-0.8, 0.65, 1.3, 0.18], [0.65, 0.1, 0.18, 1.25], [0, -0.55, 1.45, 0.18], [-0.15, 0.3, 0.18, 0.75]] as const) {
        box(parent, w, 0.85, d, mats.trim, x, 0.55, z);
      }
      addHorns(parent, mats, 0, 2.65, 1.15, 0.9);
      break;
    case 'redDragonCavern':
      addSkull(parent, mats, 0, 2.15, 0.9);
      addWings(parent, material(0x9b493e), 0, 2.4, 0.4, 1.25);
      for (const side of [-1, 1]) polyhedron(parent, 0.28, mats.glow, side * 1.1, 1.1, 0.6).scale.y = 2.1;
      break;
    case 'goblinBarracks':
      for (const side of [-1, 1]) cone(parent, 0.12, 1.25, 5, mats.accent, side * 1.1, 2.4, 0.9).rotation.z = side * 0.55;
      cylinder(parent, 0.45, 0.45, 0.12, 10, mats.roof, 0, 1.25, 1.35).rotation.x = Math.PI / 2;
      addCrossedWeapons(parent, mats, 0, 1.3, 1.46, 0.5);
      break;
    case 'wolfPen':
      addBeast(parent, mats, 0x67645c);
      for (const side of [-1, 1]) cone(parent, 0.13, 0.5, 5, mats.dark, 0.55 + side * 0.18, 1.55, 0).rotation.z = side * 0.3;
      addHorns(parent, mats, -0.9, 1.4, 1.1, 0.4);
      break;
    case 'ogreFort':
      cylinder(parent, 0.15, 0.22, 2.4, 7, mats.wood, 0.4, 1.4, 1.15).rotation.z = -0.55;
      polyhedron(parent, 0.52, mats.trim, 1.05, 2.35, 1.15).scale.set(1.35, 0.75, 0.75);
      addHorns(parent, mats, -0.55, 2.4, 1.15, 0.75);
      break;
    case 'behemothCliffs':
      addBeast(parent, mats, 0x7c6a52, { horns: true, mane: true });
      for (const side of [-1, 1]) cone(parent, 0.17, 1.55, 8, material(0xd8cbaa), side * 0.8, 1.0, 1.1).rotation.z = side * 0.7;
      break;
    case 'pixieGarden':
      for (let index = 0; index < 8; index += 1) {
        const angle = index / 8 * Math.PI * 2;
        polyhedron(parent, 0.13, index % 2 === 0 ? mats.glow : mats.accent,
          Math.sin(angle) * 1.15, 0.55 + (index % 3) * 0.25, Math.cos(angle) * 1.15);
      }
      addWings(parent, mats.glow, 0, 2.1, 0.75, 0.55);
      break;
    case 'airElementalAltar':
      for (let index = 0; index < 3; index += 1) {
        const ring = torus(parent, 0.55 + index * 0.25, 0.045, mats.glow, 0, 1.4 + index * 0.4, 0);
        ring.rotation.x = 0.55 + index * 0.35;
        ring.userData.townAnimation = 'spin';
      }
      break;
    case 'stormElementalSpire':
      addLightning(parent, mats, 0, 4.15, 0.75, 1.15);
      for (const side of [-1, 1]) torus(parent, 0.55, 0.05, mats.accent, 0, 3.4 + side * 0.4, 0).rotation.x = side * 0.7;
      break;
    case 'phoenixPyre':
      cylinder(parent, 0.75, 1.0, 0.65, 10, mats.trim, 0, 0.85, 0);
      addFlame(parent, mats, 0, 1.15, 0, 1.4);
      addWings(parent, mats.glow, 0, 2.8, 0.2, 1.15);
      break;
    case 'nymphGrotto':
      for (const side of [-1, 1]) {
        const shell = addMesh(parent, new THREE.SphereGeometry(0.45, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), mats.accent, side * 0.9, 0.45, 0.8);
        shell.scale.set(1, 0.45, 0.8);
      }
      torus(parent, 0.8, 0.055, mats.glow, 0, 1.4, 0.5, Math.PI);
      break;
    case 'corsairTavern':
      cylinder(parent, 0.035, 0.05, 3.4, 7, mats.wood, -1.15, 1.75, -0.65);
      const sail = addMesh(parent, new THREE.CircleGeometry(0.85, 3), new THREE.MeshStandardMaterial({ color: mats.accent.color, side: THREE.DoubleSide, roughness: 0.9 }), -1.05, 2.25, -0.55);
      sail.scale.set(0.75, 1.3, 1);
      cylinder(parent, 0.28, 0.34, 0.55, 10, mats.accent, 0.85, 1.25, 1.15);
      torus(parent, 0.23, 0.055, mats.accent, 1.17, 1.3, 1.15, Math.PI * 1.6);
      break;
    case 'seaWitchTower':
      polyhedron(parent, 0.42, mats.glow, 0, 4.1, 0.35);
      for (const x of [-0.32, 0, 0.32]) cone(parent, 0.07, 1.15, 6, mats.accent, x, 2.25, 1.0);
      box(parent, 0.75, 0.08, 0.08, mats.accent, 0, 1.85, 1.0);
      break;
    case 'seaSerpentCove':
      for (let index = 0; index < 6; index += 1) {
        const angle = index * 0.72;
        polyhedron(parent, 0.38 - index * 0.035, mats.roof,
          Math.sin(angle) * (0.4 + index * 0.15), 0.65 + Math.sin(index * 1.3) * 0.35 + index * 0.18, Math.cos(angle) * 0.65);
      }
      addHorns(parent, mats, 0.4, 2.25, 0.4, 0.35);
      break;
    case 'halflingHovels':
      for (const x of [-0.75, 0.75]) {
        const door = cylinder(parent, 0.43, 0.43, 0.1, 16, mats.roof, x, 0.72, 1.12);
        door.rotation.x = Math.PI / 2;
        polyhedron(parent, 0.06, mats.accent, x + 0.2, 0.72, 1.2);
      }
      addTarget(parent, mats, 0, 1.4, 1.15);
      break;
    case 'automatonAssembly':
      box(parent, 0.75, 0.85, 0.55, mats.accent, 0, 1.4, 1.05);
      box(parent, 0.58, 0.5, 0.5, mats.trim, 0, 2.15, 1.05);
      for (const side of [-1, 1]) {
        box(parent, 0.18, 1.1, 0.18, mats.accent, side * 0.58, 1.35, 1.05).rotation.z = side * 0.35;
        polyhedron(parent, 0.07, mats.glow, side * 0.16, 2.2, 1.32);
      }
      addGear(parent, mats, 0, 1.45, 1.36, 0.28);
      break;
    case 'dreadnoughtFoundry':
      const barrel = cylinder(parent, 0.18, 0.28, 2.4, 10, mats.trim, 0.4, 1.8, 1.0);
      barrel.rotation.z = -1.05;
      torus(parent, 0.42, 0.1, mats.accent, -0.55, 0.75, 1.1);
      torus(parent, 0.42, 0.1, mats.accent, 0.55, 0.75, 1.1);
      addGear(parent, mats, -0.85, 2.3, 1.25, 0.45);
      break;
    case 'juggernautHangar':
      box(parent, 2.15, 0.85, 1.15, mats.trim, 0, 0.85, 0.85);
      box(parent, 1.2, 0.65, 0.95, mats.accent, 0, 1.55, 0.85);
      const cannon = cylinder(parent, 0.13, 0.2, 2.25, 10, mats.trim, 0.65, 1.85, 0.85);
      cannon.rotation.z = -Math.PI / 2;
      for (const side of [-1, 1]) for (const x of [-0.75, 0, 0.75]) torus(parent, 0.32, 0.11, mats.dark, x, 0.45, 0.85 + side * 0.58);
      addGear(parent, mats, 0, 2.65, 1.25, 0.55);
      break;
    case 'banditHideout':
      addCrossedWeapons(parent, mats, 0, 1.35, 1.15, 0.75);
      box(parent, 1.15, 0.38, 0.08, mats.dark, 0, 2.05, 1.15);
      for (const side of [-1, 1]) polyhedron(parent, 0.08, mats.glow, side * 0.25, 2.08, 1.22);
      break;
    case 'hornetNest':
      for (let index = 0; index < 7; index += 1) {
        const angle = index / 6 * Math.PI * 2;
        const cell = cylinder(parent, 0.32, 0.32, 0.25, 6, mats.accent,
          index === 6 ? 0 : Math.sin(angle) * 0.55, 1.6 + (index === 6 ? 0.55 : Math.cos(angle) * 0.45), 0.65);
        cell.rotation.x = Math.PI / 2;
      }
      cone(parent, 0.18, 1.25, 7, mats.dark, 0, 0.75, 0.65).rotation.z = Math.PI;
      addWings(parent, mats.glow, 0, 2.75, 0.4, 0.65);
      break;
    case 'shamanLodge':
      for (const side of [-1, 1]) {
        cylinder(parent, 0.12, 0.18, 2.5, 7, mats.wood, side * 0.85, 1.4, 0.9);
        box(parent, 0.65, 0.75, 0.25, side === 1 ? mats.roof : mats.accent, side * 0.85, 2.15, 0.95);
        for (const eye of [-1, 1]) polyhedron(parent, 0.07, mats.glow, side * 0.85 + eye * 0.16, 2.25, 1.1);
      }
      addHorns(parent, mats, 0, 2.8, 0.4, 0.65);
      break;
    case 'alligatorPit':
      const jaw = box(parent, 2.1, 0.35, 0.85, mats.roof, 0, 0.85, 0.75);
      jaw.rotation.x = -0.15;
      for (let index = 0; index < 7; index += 1) {
        cone(parent, 0.09, 0.42, 5, material(0xdcd4b6), -0.85 + index * 0.28, 1.15, 1.12).rotation.x = Math.PI;
        polyhedron(parent, 0.07, mats.glow, -0.7 + index * 0.23, 1.12, 0.35);
      }
      break;
    case 'pageBarracks':
      cylinder(parent, 0.55, 0.55, 0.14, 12, mats.roof, 0, 1.35, 1.35).rotation.x = Math.PI / 2;
      polyhedron(parent, 0.22, mats.accent, 0, 1.35, 1.46).scale.set(0.45, 1.3, 0.3);
      addCrossedWeapons(parent, mats, 0, 1.35, 1.52, 0.55);
      break;
    case 'duelistSalon':
      addCrossedWeapons(parent, mats, 0, 1.75, 1.18, 1.1);
      for (const side of [-1, 1]) torus(parent, 0.23, 0.04, mats.accent, side * 0.58, 1.05, 1.2);
      roof(parent, 1.4, 0.75, 0.6, 2.85, mats.accent, 4);
      break;
    case 'courtWizardLibrary':
      addBook(parent, mats, 0, 3.25, 0.75);
      for (const [x, y] of [[-0.85, 3.5], [0.85, 3.8], [0.55, 4.35]] as const) polyhedron(parent, 0.12, mats.glow, x, y, 0.4);
      break;
    case 'royalLionGarden':
      addBeast(parent, mats, 0xc69a55, { mane: true, wings: true });
      torus(parent, 1.35, 0.055, mats.accent, 0, 0.3, 0).rotation.x = Math.PI / 2;
      break;
    default:
      throw new Error(`No procedural landmark for dwelling: ${spec.id}`);
  }
}

function addFactionSignature(
  parent: THREE.Group,
  faction: FactionId,
  mats: ModelMaterials,
  y: number,
): void {
  const x = -1.15;
  const z = -0.65;
  switch (faction) {
    case 'haven':
      box(parent, 0.09, 0.85, 0.09, mats.accent, x, y, z);
      box(parent, 0.58, 0.09, 0.09, mats.accent, x, y + 0.17, z);
      break;
    case 'grove':
      for (const side of [-1, 1]) {
        const branch = cylinder(parent, 0.035, 0.06, 0.85, 6, mats.wood, x + side * 0.18, y, z);
        branch.rotation.z = side * 0.65;
        polyhedron(parent, 0.2, mats.glow, x + side * 0.42, y + 0.3, z);
      }
      break;
    case 'ember':
      addFlame(parent, mats, x, y - 0.4, z, 0.55);
      break;
    case 'mire':
      for (const offset of [-0.18, 0, 0.18]) {
        const reed = cylinder(parent, 0.025, 0.04, 0.9, 6, mats.wood, x + offset, y, z);
        reed.rotation.z = offset * 1.2;
        cylinder(parent, 0.07, 0.07, 0.25, 7, mats.accent, x + offset * 1.4, y + 0.42, z);
      }
      break;
    case 'tower': {
      const ring = torus(parent, 0.43, 0.045, mats.accent, x, y, z);
      ring.rotation.x = 0.65;
      ring.userData.townAnimation = 'spin';
      polyhedron(parent, 0.14, mats.glow, x, y, z);
      break;
    }
    case 'necropolis':
      box(parent, 0.12, 0.95, 0.12, mats.accent, x, y, z);
      box(parent, 0.65, 0.12, 0.12, mats.accent, x, y + 0.15, z);
      for (const side of [-1, 1]) cone(parent, 0.08, 0.55, 5, mats.trim, x + side * 0.38, y - 0.1, z).rotation.z = side * 0.5;
      break;
    case 'dungeon':
      for (const [offset, scale] of [[-0.25, 0.8], [0, 1.3], [0.28, 0.65]] as const) {
        const shard = polyhedron(parent, 0.18, mats.glow, x + offset, y, z);
        shard.scale.y = scale * 2;
      }
      break;
    case 'stronghold':
      addHorns(parent, mats, x, y, z, 0.65);
      break;
    case 'conflux': {
      const ring = torus(parent, 0.48, 0.04, mats.glow, x, y, z);
      ring.rotation.x = 0.75;
      ring.userData.townAnimation = 'spin';
      for (let index = 0; index < 4; index += 1) {
        const angle = index / 4 * Math.PI * 2;
        polyhedron(parent, 0.09, mats.accent, x + Math.sin(angle) * 0.48, y + Math.cos(angle) * 0.48, z);
      }
      break;
    }
    case 'cove': {
      cylinder(parent, 0.025, 0.035, 1.15, 6, mats.wood, x, y, z);
      const sail = addMesh(parent, new THREE.CircleGeometry(0.48, 3), new THREE.MeshStandardMaterial({
        color: mats.accent.color, side: THREE.DoubleSide, roughness: 0.9,
      }), x + 0.15, y + 0.15, z);
      sail.scale.set(0.65, 1.15, 1);
      break;
    }
    case 'factory':
      addGear(parent, mats, x, y, z, 0.42);
      break;
    case 'bulwark':
      for (const offset of [-0.3, 0, 0.3]) {
        cylinder(parent, 0.055, 0.075, 0.85, 6, mats.wood, x + offset, y, z);
        cone(parent, 0.09, 0.28, 6, mats.accent, x + offset, y + 0.55, z);
      }
      box(parent, 0.85, 0.09, 0.09, mats.trim, x, y, z + 0.02);
      break;
    case 'courtyard':
      for (const offset of [-0.25, 0, 0.25]) {
        cone(parent, 0.08, 0.75 + (offset === 0 ? 0.3 : 0), 6, mats.accent, x + offset, y, z);
        polyhedron(parent, 0.09, mats.glow, x + offset, y + 0.48 + (offset === 0 ? 0.15 : 0), z);
      }
      break;
    default:
      throw new Error(`No architectural signature for faction: ${faction}`);
  }
}

function createConstructionModel(spec: BuildingModelSpec, mats: ModelMaterials): THREE.Group {
  const group = new THREE.Group();
  const [width, depth] = spec.footprint;
  const slabWidth = width * 0.86;
  const slabDepth = depth * 0.86;
  box(group, slabWidth, 0.24, slabDepth, mats.trim, 0, 0.12, 0);
  box(group, slabWidth * 0.88, 0.08, slabDepth * 0.88, mats.wall, 0, 0.28, 0);
  const scaffoldHeight = Math.min(3.4, Math.max(1.5, spec.height * 0.55));
  for (const x of [-slabWidth * 0.43, slabWidth * 0.43]) {
    for (const z of [-slabDepth * 0.43, slabDepth * 0.43]) {
      cylinder(group, 0.045, 0.065, scaffoldHeight, 6, mats.wood, x, scaffoldHeight / 2 + 0.25, z);
      cone(group, 0.09, 0.25, 6, mats.accent, x, scaffoldHeight + 0.36, z);
    }
  }
  for (const z of [-slabDepth * 0.43, slabDepth * 0.43]) {
    box(group, slabWidth * 0.94, 0.09, 0.09, mats.wood, 0, scaffoldHeight * 0.72, z);
    const brace = box(group, slabWidth * 0.9, 0.065, 0.065, mats.wood, 0, scaffoldHeight * 0.48, z);
    brace.rotation.z = 0.42;
  }
  const ghostMaterial = new THREE.MeshStandardMaterial({
    color: mats.glow.color,
    emissive: mats.glow.color,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const ghostHeight = Math.max(1.1, spec.height * 0.68);
  const ghost = box(group, width * 0.64, ghostHeight, depth * 0.62, ghostMaterial, 0, ghostHeight / 2 + 0.3, 0);
  ghost.name = 'blueprint-ghost';
  ghost.castShadow = false;
  ghost.receiveShadow = false;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(width * 0.64, ghostHeight, depth * 0.62)),
    new THREE.LineBasicMaterial({ color: mats.glow.color, transparent: true, opacity: 0.62, depthWrite: false }),
  );
  edges.position.copy(ghost.position);
  edges.name = 'blueprint-outline';
  group.add(edges);
  for (let index = 0; index < 4; index += 1) {
    box(group, 0.35, 0.22, 0.28, index % 2 === 0 ? mats.wood : mats.trim,
      -0.65 + index * 0.42, 0.42, slabDepth * 0.25);
  }
  group.userData.ghost = true;
  return group;
}

function annotateModel(
  group: THREE.Group,
  spec: BuildingModelSpec,
  faction: FactionId,
  built: boolean,
): THREE.Group {
  group.name = `building-${spec.id}-${built ? 'built' : 'unbuilt'}`;
  group.userData.buildingId = spec.id;
  group.userData.built = built;
  group.userData.faction = faction;
  group.userData.category = spec.category;
  group.userData.tier = spec.tier;
  group.userData.form = spec.form;
  const creatureId = BUILDINGS[spec.id]?.creatureId;
  if (creatureId) group.userData.creatureId = creatureId;
  return group;
}

export function createCoreBuildingModel(
  spec: BuildingModelSpec,
  faction: FactionId,
  built: boolean,
): THREE.Group {
  const palette = FACTION_ARCHITECTURE[faction];
  const mats = createMaterials(palette);
  const group = new THREE.Group();
  if (!built) return annotateModel(createConstructionModel(spec, mats), spec, faction, false);

  if (spec.category === 'common') {
    if (spec.form === 'townHall') createTownHall(group, mats, palette);
    else if (spec.form === 'capitol') createCapitol(group, mats, palette);
    else if (spec.form === 'market') createMarket(group, mats, palette);
    else if (spec.form === 'fort') createFort(group, mats, palette);
    else if (spec.form === 'mageGuild') createMageGuild(group, mats, palette);
  } else {
    if (spec.faction !== faction) {
      throw new Error(`Building ${spec.id} does not belong to faction ${faction}`);
    }
    createDwellingBase(group, spec, mats, palette);
    addDwellingLandmark(group, spec, mats);
  }
  addFactionSignature(group, faction, mats, Math.min(spec.height - 0.45, 3.25));
  return annotateModel(group, spec, faction, true);
}

export function createBuildingModel(
  spec: BuildingModelSpec,
  faction: FactionId,
  built: boolean,
): THREE.Group {
  const custom = createFactionPackModel(faction, spec.id, built);
  return annotateModel(custom ?? createCoreBuildingModel(spec, faction, built), spec, faction, built);
}

export function disposeTownObject(object: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Line) && !(child instanceof THREE.Points)) return;
    geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    for (const surface of childMaterials) {
      materials.add(surface);
      for (const value of Object.values(surface)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const surface of materials) surface.dispose();
}
