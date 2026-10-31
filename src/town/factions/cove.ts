import * as THREE from 'three';

interface CovePalette {
  timber: THREE.MeshStandardMaterial;
  darkWood: THREE.MeshStandardMaterial;
  teal: THREE.MeshStandardMaterial;
  rope: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  bone: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  canvas: THREE.MeshStandardMaterial;
  flag: THREE.MeshStandardMaterial;
}

function material(color: number, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}

function createPalette(): CovePalette {
  const water = material(0x2b8797, 0.28, 0.08);
  water.transparent = true;
  water.opacity = 0.82;
  const glass = material(0x8ce3cf, 0.32, 0.08);
  glass.emissive.setHex(0x3b9f91);
  glass.emissiveIntensity = 0.65;
  return {
    timber: material(0x826143),
    darkWood: material(0x3f3530),
    teal: material(0x286373),
    rope: material(0xc0a876),
    stone: material(0x758783),
    bone: material(0xd8cda7),
    metal: material(0x8c8267, 0.42, 0.55),
    water,
    glass,
    canvas: new THREE.MeshStandardMaterial({
      color: 0xe2d5ae,
      roughness: 0.94,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
    flag: new THREE.MeshStandardMaterial({
      color: 0x172f3a,
      roughness: 0.9,
      flatShading: true,
      side: THREE.DoubleSide,
    }),
  };
}

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, surface: THREE.Material,
  x = 0, y = 0, z = 0): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function box(parent: THREE.Object3D, width: number, height: number, depth: number,
  surface: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  return mesh(parent, new THREE.BoxGeometry(width, height, depth), surface, x, y, z);
}

function cylinder(parent: THREE.Object3D, top: number, bottom: number, height: number,
  segments: number, surface: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, x, y, z);
}

function cone(parent: THREE.Object3D, radius: number, height: number, segments: number,
  surface: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  return mesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, x, y, z);
}

function ball(parent: THREE.Object3D, radius: number, surface: THREE.Material,
  x = 0, y = 0, z = 0): THREE.Mesh {
  return mesh(parent, new THREE.DodecahedronGeometry(radius, 0), surface, x, y, z);
}

function beam(parent: THREE.Object3D, start: THREE.Vector3, end: THREE.Vector3,
  radius: number, surface: THREE.Material): THREE.Mesh {
  const direction = new THREE.Vector3().subVectors(end, start);
  const result = cylinder(parent, radius, radius, direction.length(), 6, surface);
  result.position.copy(start).add(end).multiplyScalar(0.5);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function triangle(parent: THREE.Object3D, points: readonly number[], surface: THREE.Material,
  x = 0, y = 0, z = 0): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return mesh(parent, geometry, surface, x, y, z);
}

function addFoundation(group: THREE.Group, palette: CovePalette, width: number, depth: number,
  round = false): void {
  if (round) {
    const base = cylinder(group, width, width * 1.05, 0.14, 12, palette.stone, 0, 0.07);
    base.scale.z = depth / width;
  } else {
    box(group, width * 2, 0.14, depth * 2, palette.stone, 0, 0.07);
  }
}

function addTidalPool(group: THREE.Group, palette: CovePalette, radius: number): void {
  addFoundation(group, palette, radius, radius * 0.9, true);
  const pool = cylinder(group, radius * 0.82, radius * 0.82, 0.035, 24, palette.water, 0, 0.15);
  pool.scale.z = 0.9;
}

function addLumber(group: THREE.Group, palette: CovePalette, x: number, z: number): void {
  const stack = new THREE.Group();
  stack.position.set(x, 0, z);
  stack.rotation.y = 0.22;
  group.add(stack);
  for (let index = 0; index < 3; index += 1) {
    box(stack, 0.48, 0.055, 0.09, palette.timber, 0, 0.17 + index * 0.057, 0);
  }
  const coil = mesh(stack, new THREE.TorusGeometry(0.1, 0.022, 5, 14), palette.rope, -0.25, 0.18, 0.22);
  coil.rotation.x = Math.PI / 2;
}

function addScaffold(group: THREE.Group, palette: CovePalette, width: number, depth: number,
  height: number): void {
  const base = 0.14;
  for (const x of [-width, width]) {
    for (const z of [-depth, depth]) {
      box(group, 0.065, height, 0.065, palette.darkWood, x, base + height / 2, z);
    }
  }
  for (const z of [-depth, depth]) {
    box(group, width * 2 + 0.1, 0.06, 0.06, palette.timber, 0, base + height, z);
    beam(group, new THREE.Vector3(-width, base + 0.05, z),
      new THREE.Vector3(width, base + height - 0.05, z), 0.025, palette.rope);
  }
  box(group, 0.06, 0.06, depth * 2, palette.timber, -width, base + height, 0);
  box(group, 0.06, 0.06, depth * 2, palette.timber, width, base + height, 0);
}

function addBarrel(group: THREE.Group, palette: CovePalette, x: number, y: number, z: number): void {
  cylinder(group, 0.12, 0.12, 0.28, 10, palette.timber, x, y + 0.14, z);
  for (const offset of [0.055, 0.225]) {
    const band = mesh(group, new THREE.TorusGeometry(0.122, 0.012, 4, 10), palette.metal, x, y + offset, z);
    band.rotation.x = Math.PI / 2;
  }
}

function addAnchor(group: THREE.Group, palette: CovePalette, x: number, y: number, z: number): void {
  const anchor = new THREE.Group();
  anchor.position.set(x, y, z);
  group.add(anchor);
  cylinder(anchor, 0.025, 0.025, 0.34, 6, palette.metal, 0, 0.19);
  box(anchor, 0.26, 0.035, 0.035, palette.metal, 0, 0.24);
  const arms = mesh(anchor, new THREE.TorusGeometry(0.13, 0.025, 5, 14, Math.PI), palette.metal, 0, 0.1);
  arms.rotation.z = Math.PI;
  const ring = mesh(anchor, new THREE.TorusGeometry(0.052, 0.014, 5, 12), palette.metal, 0, 0.39);
  ring.scale.y = 1.1;
}

function addCoral(group: THREE.Group, palette: CovePalette, x: number, z: number): void {
  const root = new THREE.Vector3(x, 0.16, z);
  const tip = new THREE.Vector3(x, 0.52, z);
  beam(group, root, tip, 0.035, palette.teal);
  beam(group, new THREE.Vector3(x, 0.31, z), new THREE.Vector3(x - 0.13, 0.43, z + 0.03), 0.025, palette.teal);
  beam(group, new THREE.Vector3(x, 0.37, z), new THREE.Vector3(x + 0.14, 0.5, z - 0.02), 0.025, palette.teal);
  ball(group, 0.045, palette.glass, tip.x, tip.y, tip.z);
}

function buildNymphGrotto(group: THREE.Group, palette: CovePalette, built: boolean): void {
  addTidalPool(group, palette, 0.9);
  if (!built) {
    addScaffold(group, palette, 0.63, 0.48, 0.54);
    for (const [x, y, z] of [[-0.52, 0.29, -0.22], [-0.37, 0.57, -0.25], [0.51, 0.27, -0.2]] as const) {
      ball(group, 0.16, palette.stone, x, y, z);
    }
    addLumber(group, palette, 0.48, 0.53);
    return;
  }

  const arch = mesh(group, new THREE.TorusGeometry(0.53, 0.1, 6, 20, Math.PI), palette.stone, 0, 0.35, -0.27);
  arch.scale.z = 0.72;
  for (let index = 0; index <= 6; index += 1) {
    const angle = index * Math.PI / 6;
    const stone = ball(group, 0.13, palette.stone,
      Math.cos(angle) * 0.54, 0.35 + Math.sin(angle) * 0.54, -0.27);
    stone.scale.set(1, 0.85, 0.8);
    stone.rotation.z = angle;
  }

  const lowerShell = mesh(group, new THREE.SphereGeometry(0.39, 12, 6), palette.bone, 0, 0.27, 0.2);
  lowerShell.scale.set(1, 0.22, 0.72);
  const upperShell = mesh(group, new THREE.SphereGeometry(0.4, 12, 6), palette.bone, 0, 0.53, 0.08);
  upperShell.scale.set(1, 0.2, 0.75);
  upperShell.rotation.x = -0.48;
  ball(group, 0.115, palette.glass, 0, 0.38, 0.28);
  for (let index = -2; index <= 2; index += 1) {
    beam(group, new THREE.Vector3(0, 0.3, -0.06),
      new THREE.Vector3(index * 0.14, 0.32, 0.44), 0.012, palette.rope);
  }
  addCoral(group, palette, -0.68, 0.23);
  addCoral(group, palette, 0.66, 0.1);
  addBarrel(group, palette, 0.56, 0.14, 0.54);
}

function buildCorsairTavern(group: THREE.Group, palette: CovePalette, built: boolean): void {
  addFoundation(group, palette, 0.88, 0.73);
  for (let index = 0; index < 8; index += 1) {
    box(group, 1.82, 0.055, 0.15, palette.timber, 0, 0.165, -0.59 + index * 0.17);
  }
  if (!built) {
    addScaffold(group, palette, 0.59, 0.44, 0.91);
    box(group, 1.1, 0.08, 0.82, palette.timber, 0, 0.56, 0);
    addLumber(group, palette, 0.62, 0.55);
    addBarrel(group, palette, -0.65, 0.19, 0.51);
    return;
  }

  for (const x of [-0.54, 0.54]) {
    for (const z of [-0.4, 0.4]) {
      cylinder(group, 0.065, 0.085, 0.42, 7, palette.darkWood, x, 0.36, z);
    }
  }
  box(group, 1.18, 0.73, 0.91, palette.timber, 0, 0.86, 0);
  for (const x of [-0.5, 0.5]) {
    box(group, 0.075, 0.75, 0.94, palette.darkWood, x, 0.86, 0);
  }
  const roof = cone(group, 0.88, 0.5, 4, palette.teal, 0, 1.475, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.76;
  box(group, 0.25, 0.48, 0.045, palette.darkWood, 0, 0.74, 0.478);
  for (const x of [-0.34, 0.34]) {
    box(group, 0.2, 0.24, 0.04, palette.glass, x, 0.96, 0.48);
    box(group, 0.025, 0.25, 0.055, palette.rope, x, 0.96, 0.5);
    box(group, 0.21, 0.025, 0.055, palette.rope, x, 0.96, 0.5);
  }

  box(group, 1.35, 0.08, 0.36, palette.darkWood, 0, 0.55, 0.58);
  for (const x of [-0.6, -0.3, 0.3, 0.6]) {
    box(group, 0.045, 0.31, 0.045, palette.rope, x, 0.74, 0.73);
  }
  box(group, 1.28, 0.045, 0.045, palette.rope, 0, 0.88, 0.73);
  addBarrel(group, palette, -0.69, 0.19, 0.42);
  addBarrel(group, palette, 0.67, 0.19, 0.47);

  box(group, 0.32, 0.29, 0.055, palette.darkWood, -0.73, 0.98, 0.49);
  addAnchor(group, palette, -0.73, 0.84, 0.53);
  cylinder(group, 0.025, 0.035, 1.7, 7, palette.darkWood, 0.51, 1.08, -0.26);
  triangle(group, [0, 0, 0, 0, 0.8, 0, -0.58, 0.18, 0], palette.canvas, 0.5, 0.91, -0.24);
  triangle(group, [0, 0, 0, 0, 0.22, 0, 0.34, 0.17, 0], palette.flag, 0.52, 1.87, -0.26);
  ball(group, 0.055, palette.bone, 0.67, 1.99, -0.25);
}

function buildSeaWitchTower(group: THREE.Group, palette: CovePalette, built: boolean): void {
  addTidalPool(group, palette, 0.82);
  if (!built) {
    cylinder(group, 0.39, 0.47, 0.43, 8, palette.stone, 0, 0.355);
    addScaffold(group, palette, 0.55, 0.5, 1.39);
    addLumber(group, palette, 0.52, 0.55);
    const cap = mesh(group, new THREE.TorusGeometry(0.39, 0.035, 5, 12), palette.rope, 0, 0.57);
    cap.rotation.x = Math.PI / 2;
    return;
  }

  cylinder(group, 0.43, 0.54, 0.36, 8, palette.stone, 0, 0.32);
  cylinder(group, 0.31, 0.42, 1.19, 8, palette.bone, -0.055, 1.055);
  cylinder(group, 0.24, 0.31, 0.49, 8, palette.teal, 0.04, 1.855);
  for (const [y, radius] of [[0.62, 0.4], [1.22, 0.34], [1.62, 0.3]] as const) {
    const band = mesh(group, new THREE.TorusGeometry(radius, 0.026, 5, 16), palette.rope, 0, y);
    band.rotation.x = Math.PI / 2;
  }

  for (let index = 0; index < 9; index += 1) {
    const angle = index * 0.63;
    const step = box(group, 0.31, 0.055, 0.15, palette.timber,
      Math.cos(angle) * 0.51, 0.31 + index * 0.125, Math.sin(angle) * 0.51);
    step.rotation.y = -angle;
  }
  const balcony = mesh(group, new THREE.TorusGeometry(0.42, 0.035, 6, 18), palette.darkWood, 0, 1.49);
  balcony.rotation.x = Math.PI / 2;
  for (const [x, y, z] of [[-0.05, 0.88, 0.38], [-0.03, 1.32, 0.32], [0.05, 1.86, 0.255]] as const) {
    box(group, 0.15, 0.23, 0.035, palette.glass, x, y, z);
    box(group, 0.025, 0.24, 0.045, palette.darkWood, x, y, z + 0.015);
  }

  const roof = cone(group, 0.47, 0.56, 8, palette.teal, 0.04, 2.38);
  roof.rotation.y = Math.PI / 8;
  cylinder(group, 0.025, 0.035, 0.43, 6, palette.metal, 0.04, 2.79);
  for (const x of [-0.11, 0, 0.11]) {
    cone(group, 0.042, x === 0 ? 0.23 : 0.18, 5, palette.metal, 0.04 + x, x === 0 ? 3.02 : 2.95);
  }
  box(group, 0.27, 0.035, 0.035, palette.metal, 0.04, 2.89);
  ball(group, 0.12, palette.glass, 0.43, 1.55, 0.05);
  beam(group, new THREE.Vector3(0.34, 1.67, 0.04), new THREE.Vector3(0.43, 1.62, 0.05), 0.018, palette.rope);
  for (const [x, y, z] of [[0.5, 0.82, 0.08], [-0.47, 0.68, 0.14]] as const) {
    beam(group, new THREE.Vector3(x * 0.75, y + 0.24, z), new THREE.Vector3(x, y + 0.08, z), 0.015, palette.rope);
    const buoy = ball(group, 0.09, palette.teal, x, y, z);
    buoy.scale.y = 1.25;
  }
}

function addSerpentRib(group: THREE.Group, palette: CovePalette, radius: number, z: number): void {
  const rib = mesh(group, new THREE.TorusGeometry(radius, 0.045, 6, 20, Math.PI), palette.bone, 0, 0.22, z);
  rib.scale.z = 0.85;
  for (const side of [-1, 1]) {
    cone(group, 0.065, 0.25, 6, palette.bone, side * radius, 0.24, z).rotation.z = side * 0.35;
  }
}

function buildSeaSerpentCove(group: THREE.Group, palette: CovePalette, built: boolean): void {
  addTidalPool(group, palette, 0.98);
  if (!built) {
    addSerpentRib(group, palette, 0.61, -0.42);
    addSerpentRib(group, palette, 0.53, -0.08);
    beam(group, new THREE.Vector3(0, 0.28, -0.75), new THREE.Vector3(0, 0.28, 0.6), 0.05, palette.timber);
    addScaffold(group, palette, 0.69, 0.59, 0.56);
    addLumber(group, palette, 0.58, 0.61);
    return;
  }

  for (let index = 0; index < 5; index += 1) {
    addSerpentRib(group, palette, 0.65 - index * 0.055, -0.58 + index * 0.27);
  }
  beam(group, new THREE.Vector3(0, 0.82, -0.62), new THREE.Vector3(0, 0.67, 0.55), 0.048, palette.bone);
  const tail = cone(group, 0.17, 0.54, 7, palette.teal, 0, 0.35, -0.82);
  tail.rotation.x = -Math.PI / 2;
  for (const side of [-1, 1]) {
    const fin = triangle(group, [0, 0, 0, side * 0.3, 0.18, 0, 0, 0.34, 0], palette.teal, 0, 0.32, -0.78);
    fin.rotation.x = -0.35;
  }

  const head = new THREE.Group();
  head.position.set(0, 0.48, 0.64);
  group.add(head);
  const skull = ball(head, 0.31, palette.teal, 0, 0.08, 0);
  skull.scale.set(1, 0.76, 1.08);
  box(head, 0.43, 0.1, 0.38, palette.teal, 0, -0.08, 0.13);
  box(head, 0.35, 0.045, 0.3, palette.bone, 0, -0.025, 0.17);
  for (const side of [-1, 1]) {
    ball(head, 0.055, palette.glass, side * 0.15, 0.16, 0.245);
    const horn = cone(head, 0.065, 0.34, 6, palette.bone, side * 0.21, 0.34, -0.1);
    horn.rotation.z = side * -0.35;
    cone(head, 0.035, 0.13, 5, palette.bone, side * 0.13, -0.14, 0.29).rotation.x = Math.PI;
  }
  for (let index = 0; index < 5; index += 1) {
    box(group, 0.52, 0.055, 0.14, palette.timber, -0.7, 0.2, 0.25 + index * 0.16);
  }
  cylinder(group, 0.04, 0.055, 0.56, 7, palette.darkWood, -0.92, 0.35, 0.83);
  const mooring = mesh(group, new THREE.TorusGeometry(0.1, 0.022, 5, 14), palette.rope, -0.92, 0.58, 0.83);
  mooring.rotation.x = Math.PI / 2;
  addBarrel(group, palette, 0.7, 0.15, 0.58);
}

const BUILDERS: Readonly<Record<string, (group: THREE.Group, palette: CovePalette, built: boolean) => void>> = {
  nymphGrotto: buildNymphGrotto,
  corsairTavern: buildCorsairTavern,
  seaWitchTower: buildSeaWitchTower,
  seaSerpentCove: buildSeaSerpentCove,
};

function createBuildingModel(buildingId: string, built: boolean): THREE.Group | null {
  if (!Object.hasOwn(BUILDERS, buildingId)) return null;
  const group = new THREE.Group();
  group.name = `cove-${buildingId}-${built ? 'built' : 'unbuilt'}`;
  group.userData = {
    faction: 'Cove',
    buildingId,
    built,
    modelPack: 'Cove',
  };
  BUILDERS[buildingId]!(group, createPalette(), built);
  return group;
}

export default {
  faction: 'Cove',
  createBuildingModel,
};
