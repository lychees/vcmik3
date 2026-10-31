import * as THREE from 'three';

interface MirePalette {
  mud: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  timber: THREE.MeshStandardMaterial;
  darkTimber: THREE.MeshStandardMaterial;
  reed: THREE.MeshStandardMaterial;
  reedLight: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  bone: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
}

type Point = readonly [number, number, number];
type DwellingBuilder = (group: THREE.Group, palette: MirePalette, built: boolean) => void;

function material(color: THREE.ColorRepresentation, roughness = 0.86): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, flatShading: true });
}

function createPalette(): MirePalette {
  const water = material(0x345f59, 0.3);
  water.transparent = true;
  water.opacity = 0.82;
  water.depthWrite = false;
  const bone = material(0xb9b995, 0.72);
  bone.side = THREE.DoubleSide;
  const glow = material(0xa5d99b, 0.38);
  glow.emissive.setHex(0x315d46);
  glow.emissiveIntensity = 0.65;
  return {
    mud: material(0x59634c),
    water,
    timber: material(0x74775a),
    darkTimber: material(0x3e4c40),
    reed: material(0x4c6d5b),
    reedLight: material(0x7f9670),
    stone: material(0x697267),
    bone,
    glow,
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
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
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

function beam(
  parent: THREE.Object3D,
  from: Point,
  to: Point,
  radius: number,
  surface: THREE.Material,
): THREE.Mesh {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = end.clone().sub(start);
  const mesh = addMesh(
    parent,
    new THREE.CylinderGeometry(radius, radius, direction.length(), 6),
    surface,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}

function triangle(parent: THREE.Object3D, points: readonly number[], surface: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return addMesh(parent, geometry, surface);
}

function addFoundation(group: THREE.Group, palette: MirePalette, radius = 1.5): void {
  const water = cylinder(group, radius + 0.12, radius + 0.12, 0.05, 12, palette.water, 0, 0.025);
  water.scale.z = 0.9;
  water.castShadow = false;
  cylinder(group, radius, radius + 0.08, 0.14, 11, palette.mud, 0, 0.1).scale.z = 0.88;
}

function addStiltPlatform(
  group: THREE.Group,
  palette: MirePalette,
  width: number,
  depth: number,
  deckY: number,
): void {
  const x = width / 2 - 0.14;
  const z = depth / 2 - 0.14;
  for (const [postX, postZ] of [[-x, -z], [x, -z], [-x, z], [x, z]] as const) {
    cylinder(group, 0.075, 0.105, deckY, 6, palette.darkTimber, postX, deckY / 2, postZ);
  }
  box(group, width, 0.14, depth, palette.timber, 0, deckY);
  beam(group, [-x, 0.16, z], [x, deckY - 0.05, z], 0.04, palette.darkTimber);
  beam(group, [x, 0.16, -z], [-x, deckY - 0.05, -z], 0.04, palette.darkTimber);
}

function addBoardwalk(group: THREE.Group, palette: MirePalette, deckY: number): void {
  for (let index = 0; index < 5; index += 1) {
    box(group, 0.7, 0.08, 0.17, palette.timber, 0, deckY, 0.72 + index * 0.19);
  }
  for (const x of [-0.26, 0.26]) {
    cylinder(group, 0.045, 0.065, deckY, 6, palette.darkTimber, x, deckY / 2, 1.42);
  }
}

function addReeds(
  group: THREE.Group,
  palette: MirePalette,
  x: number,
  z: number,
  height = 0.65,
): void {
  const stalks = [
    [-0.07, 0, 0.9],
    [0.06, 0.04, 1],
    [0, -0.06, 0.76],
  ] as const;
  for (const [offsetX, offsetZ, scale] of stalks) {
    const stalkHeight = height * scale;
    cylinder(group, 0.018, 0.026, stalkHeight, 5, palette.reedLight,
      x + offsetX, stalkHeight / 2, z + offsetZ);
    cone(group, 0.045, 0.14, 5, palette.reed,
      x + offsetX, stalkHeight + 0.05, z + offsetZ);
  }
}

function addConstructionPile(group: THREE.Group, palette: MirePalette, x: number, z: number): void {
  for (let index = 0; index < 3; index += 1) {
    const plank = box(group, 0.72, 0.08, 0.13, palette.timber,
      x, 0.23 + index * 0.085, z + (index % 2) * 0.08);
    plank.rotation.y = -0.28 + index * 0.25;
  }
  for (const offset of [-0.07, 0.07]) {
    const bundle = cylinder(group, 0.055, 0.055, 0.68, 6, palette.reedLight,
      x + offset, 0.31, z - 0.16);
    bundle.rotation.z = Math.PI / 2;
  }
}

function addWallStuds(
  group: THREE.Group,
  palette: MirePalette,
  width: number,
  depth: number,
  baseY: number,
  topY: number,
): void {
  const height = topY - baseY;
  for (const [x, z] of [
    [-width / 2, -depth / 2],
    [width / 2, -depth / 2],
    [-width / 2, depth / 2],
    [width / 2, depth / 2],
  ] as const) {
    cylinder(group, 0.045, 0.06, height, 6, palette.darkTimber, x, baseY + height / 2, z);
  }
  for (const z of [-depth / 2, depth / 2]) {
    box(group, width + 0.12, 0.09, 0.09, palette.timber, 0, topY, z);
  }
  for (const x of [-width / 2, width / 2]) {
    box(group, 0.09, 0.09, depth, palette.timber, x, topY);
  }
}

function buildLizardmanDen(group: THREE.Group, palette: MirePalette, built: boolean): void {
  addFoundation(group, palette);
  addStiltPlatform(group, palette, 1.75, 1.45, 0.62);
  addBoardwalk(group, palette, 0.46);
  addReeds(group, palette, -1.23, 0.5, 0.62);
  addReeds(group, palette, 1.2, -0.5, 0.72);

  if (!built) {
    addWallStuds(group, palette, 1.3, 1.02, 0.69, 1.65);
    box(group, 0.55, 0.42, 0.07, palette.timber, -0.34, 0.92, -0.51);
    addConstructionPile(group, palette, 0.96, 0.55);
    return;
  }

  box(group, 1.42, 0.88, 1.1, palette.timber, 0, 1.13);
  const roof = cone(group, 1.13, 0.86, 5, palette.reed, 0, 2, 0);
  roof.rotation.y = 0.32;
  roof.scale.z = 0.82;
  cone(group, 0.07, 0.28, 5, palette.reedLight, 0.15, 2.52);
  box(group, 0.35, 0.65, 0.06, palette.darkTimber, 0, 1.02, 0.58);
  for (const x of [-0.43, 0.43]) {
    box(group, 0.22, 0.22, 0.045, palette.glow, x, 1.28, 0.575);
    box(group, 0.035, 0.24, 0.055, palette.darkTimber, x, 1.28, 0.6);
  }
  const tailCrest = addMesh(group,
    new THREE.TorusGeometry(0.15, 0.035, 5, 12, Math.PI * 1.6), palette.bone, 0, 1.48, 0.63);
  tailCrest.rotation.z = 0.4;
  beam(group, [-0.66, 1.58, 0.48], [0.58, 1.66, 0.48], 0.035, palette.reedLight);
}

function buildGorgonPen(group: THREE.Group, palette: MirePalette, built: boolean): void {
  addFoundation(group, palette, 1.55);
  addStiltPlatform(group, palette, 2.75, 2.2, 0.3);
  for (const x of [-1.23, 1.23]) {
    for (const z of [-0.85, -0.15, 0.55]) {
      cylinder(group, 0.05, 0.075, 0.72, 6, palette.darkTimber, x, 0.66, z);
    }
    for (const y of [0.59, 0.87]) {
      box(group, 0.07, 0.07, 1.55, palette.timber, x, y, -0.15);
    }
  }
  for (const y of [0.59, 0.87]) {
    box(group, 2.5, 0.07, 0.07, palette.timber, 0, y, -0.9);
    for (const x of [-0.85, 0.85]) {
      box(group, 0.8, 0.07, 0.07, palette.timber, x, y, 0.9);
    }
  }

  if (!built) {
    const shelter = new THREE.Group();
    shelter.position.z = -0.43;
    group.add(shelter);
    addWallStuds(shelter, palette, 1.35, 0.82, 0.37, 1.58);
    box(shelter, 0.58, 0.42, 0.07, palette.timber, -0.32, 0.59, -0.41);
    addConstructionPile(group, palette, 0.73, 0.37);
    return;
  }

  box(group, 1.45, 0.84, 0.85, palette.timber, 0, 0.79, -0.48);
  const roof = cone(group, 0.98, 0.68, 5, palette.reed, 0, 1.55, -0.48);
  roof.rotation.y = 0.25;
  roof.scale.z = 0.72;
  box(group, 0.38, 0.57, 0.05, palette.darkTimber, 0, 0.68, -0.03);
  const head = addMesh(group, new THREE.DodecahedronGeometry(0.23, 0), palette.bone, 0, 1.93, -0.03);
  head.scale.set(1.15, 0.8, 0.85);
  for (const side of [-1, 1]) {
    const horn = cone(group, 0.1, 0.55, 6, palette.bone, side * 0.29, 2.2, -0.04);
    horn.rotation.z = side * -0.52;
    box(group, 0.06, 0.06, 0.035, palette.glow, side * 0.09, 1.96, 0.175);
  }
  cylinder(group, 0.63, 0.69, 0.07, 9, palette.mud, 0, 0.405, 0.31).scale.z = 0.72;
  box(group, 0.58, 0.24, 0.34, palette.darkTimber, 0.77, 0.49, 0.42);
  box(group, 0.46, 0.025, 0.23, palette.water, 0.77, 0.623, 0.42);
  addReeds(group, palette, -1.35, 0.85, 0.55);
}

function addRoostLadder(group: THREE.Group, palette: MirePalette): void {
  for (const x of [-0.25, 0.25]) {
    beam(group, [x, 0.16, 1.45], [x, 2.58, 0.9], 0.035, palette.darkTimber);
  }
  for (let index = 0; index < 9; index += 1) {
    const t = index / 8;
    const y = 0.27 + t * 2.18;
    const z = 1.42 - t * 0.52;
    beam(group, [-0.25, y, z], [0.25, y, z], 0.028, palette.timber);
  }
}

function buildWyvernRoost(group: THREE.Group, palette: MirePalette, built: boolean): void {
  addFoundation(group, palette, 1.55);
  for (const [x, z] of [[-0.78, -0.66], [0.78, -0.66], [-0.78, 0.66], [0.78, 0.66]] as const) {
    cylinder(group, 0.085, 0.14, 2.75, 7, palette.darkTimber, x, 1.375, z);
  }
  beam(group, [-0.78, 0.18, 0.66], [0.78, 2.48, 0.66], 0.055, palette.timber);
  beam(group, [0.78, 0.18, -0.66], [-0.78, 2.48, -0.66], 0.055, palette.timber);
  beam(group, [-0.78, 0.18, -0.66], [-0.78, 2.48, 0.66], 0.05, palette.timber);
  box(group, 1.9, 0.14, 1.6, palette.timber, 0, 0.55);
  box(group, 2.25, 0.16, 1.85, palette.timber, 0, 2.55);
  addRoostLadder(group, palette);
  addReeds(group, palette, -1.3, -0.55, 0.78);

  if (!built) {
    addWallStuds(group, palette, 1.35, 1.1, 2.63, 3.45);
    beam(group, [-0.67, 2.65, 0.55], [0.67, 3.43, 0.55], 0.04, palette.darkTimber);
    addConstructionPile(group, palette, 1.05, 0.35);
    return;
  }

  box(group, 1.2, 0.72, 1, palette.timber, 0, 3, -0.28);
  box(group, 0.36, 0.55, 0.05, palette.darkTimber, 0, 2.94, 0.245);
  const roof = cone(group, 1.2, 0.9, 5, palette.reed, 0, 3.78, -0.15);
  roof.rotation.y = 0.35;
  roof.scale.z = 0.8;
  cylinder(group, 0.035, 0.05, 0.34, 6, palette.bone, 0.1, 4.36, -0.15);
  cone(group, 0.11, 0.22, 5, palette.reedLight, 0.1, 4.63, -0.15);
  const nest = addMesh(group, new THREE.TorusGeometry(0.48, 0.09, 6, 14), palette.reedLight, 0, 2.72, 0.55);
  nest.rotation.x = Math.PI / 2;
  triangle(group, [
    -0.1, 3.25, 0.56,
    -1.55, 3.72, 0.3,
    -0.82, 3.02, 0.52,
  ], palette.bone);
  triangle(group, [
    0.1, 3.25, 0.56,
    1.55, 3.72, 0.3,
    0.82, 3.02, 0.52,
  ], palette.bone);
  for (const side of [-1, 1]) {
    beam(group, [side * 0.1, 3.24, 0.57], [side * 1.5, 3.7, 0.31], 0.025, palette.darkTimber);
  }
}

function buildBasiliskPit(group: THREE.Group, palette: MirePalette, built: boolean): void {
  addFoundation(group, palette, 1.55);
  cylinder(group, 1.28, 1.4, 0.28, 12, palette.stone, 0, 0.31);
  const rim = addMesh(group, new THREE.TorusGeometry(1.12, 0.14, 6, 18), palette.darkTimber, 0, 0.47);
  rim.rotation.x = Math.PI / 2;

  const pillarCount = built ? 6 : 3;
  for (let index = 0; index < pillarCount; index += 1) {
    const angle = (index / 6) * Math.PI * 2;
    const x = Math.sin(angle) * 1.35;
    const z = Math.cos(angle) * 1.35;
    const height = built ? 0.72 + (index % 2) * 0.28 : 0.48 + index * 0.12;
    cylinder(group, 0.1, 0.16, height, 6, palette.stone, x, 0.17 + height / 2, z);
    if (built) cone(group, 0.18, 0.26, 5, palette.reed, x, 0.3 + height, z);
  }

  const shrine = new THREE.Group();
  shrine.position.z = -0.68;
  group.add(shrine);
  if (!built) {
    addWallStuds(shrine, palette, 1.2, 0.55, 0.17, 1.85);
    beam(shrine, [-0.6, 0.2, 0.27], [0.6, 1.82, 0.27], 0.045, palette.timber);
    addConstructionPile(group, palette, 0.85, 0.45);
    return;
  }

  cylinder(group, 0.96, 0.96, 0.04, 12, palette.glow, 0, 0.47);
  const coil = addMesh(group, new THREE.TorusGeometry(0.31, 0.065, 6, 14, Math.PI * 1.75), palette.bone, 0, 0.57);
  coil.rotation.x = Math.PI / 2;
  coil.rotation.z = 0.4;
  const serpentHead = addMesh(group, new THREE.DodecahedronGeometry(0.18, 0), palette.bone, 0.22, 0.78, 0.05);
  serpentHead.scale.set(0.85, 1.15, 0.9);
  for (const [x, z] of [[-0.58, -0.25], [0.58, -0.25], [-0.58, 0.25], [0.58, 0.25]] as const) {
    cylinder(shrine, 0.065, 0.1, 1.8, 6, palette.darkTimber, x, 0.9, z);
  }
  box(shrine, 1.15, 1, 0.25, palette.timber, 0, 1.35, -0.12);
  const roof = cone(shrine, 0.95, 0.72, 5, palette.reed, 0, 2.25);
  roof.rotation.y = 0.3;
  roof.scale.z = 0.65;
  const skull = addMesh(shrine, new THREE.DodecahedronGeometry(0.26, 0), palette.bone, 0, 2.78);
  skull.scale.set(1.2, 0.78, 0.85);
  const hornHeights = [0.48, 0.62, 0.78, 0.62, 0.48];
  hornHeights.forEach((height, index) => {
    const horn = cone(shrine, 0.075, height, 5, palette.bone,
      (index - 2) * 0.18, 2.9 + height / 2, 0);
    horn.rotation.z = (index - 2) * -0.12;
  });
  for (const x of [-0.1, 0.1]) {
    box(shrine, 0.055, 0.055, 0.035, palette.glow, x, 2.8, 0.215);
  }
  addReeds(group, palette, -1.3, 0.65, 0.72);
  addReeds(group, palette, 1.25, -0.6, 0.62);
}

const DWELLINGS: Readonly<Record<string, { tier: 1 | 2 | 3 | 4; build: DwellingBuilder }>> = {
  lizardmanDen: { tier: 1, build: buildLizardmanDen },
  gorgonPen: { tier: 2, build: buildGorgonPen },
  wyvernRoost: { tier: 3, build: buildWyvernRoost },
  basiliskPit: { tier: 4, build: buildBasiliskPit },
};

function createBuildingModel(buildingId: string, built: boolean): THREE.Group | null {
  if (!Object.hasOwn(DWELLINGS, buildingId)) return null;
  const dwelling = DWELLINGS[buildingId]!;
  const group = new THREE.Group();
  group.name = buildingId;
  group.userData = {
    faction: 'Mire',
    buildingId,
    built,
    tier: dwelling.tier,
    modelPack: 'mire',
  };
  const structure = new THREE.Group();
  structure.name = built ? 'completed-dwelling' : 'construction-site';
  group.add(structure);
  dwelling.build(structure, createPalette(), built);
  return group;
}

export default {
  faction: 'Mire',
  createBuildingModel,
};
