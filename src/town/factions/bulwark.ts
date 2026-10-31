import * as THREE from 'three';

type BulwarkBuildingId = 'banditHideout' | 'hornetNest' | 'shamanLodge' | 'alligatorPit';
type Point = readonly [number, number, number];

interface BulwarkPalette {
  stone: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  snow: THREE.MeshStandardMaterial;
  timber: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  rune: THREE.MeshStandardMaterial;
  amber: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  earth: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  hive: THREE.MeshStandardMaterial;
}

interface DwellingDetails {
  creatureId: 'bandit' | 'hornet' | 'shaman' | 'alligator';
  tier: 1 | 2 | 3 | 4;
  form: 'hall' | 'grove' | 'ritual' | 'aquatic';
  build: (group: THREE.Group, palette: BulwarkPalette) => void;
  buildConstruction: (group: THREE.Group, palette: BulwarkPalette) => void;
}

function material(color: number, roughness = 0.84, metalness = 0): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  result.userData.baseColor = color;
  return result;
}

function createPalette(): BulwarkPalette {
  const rune = material(0x8fe3df, 0.34);
  rune.emissive.setHex(0x4caaa9);
  rune.emissiveIntensity = 0.65;
  const amber = material(0xe7bd67, 0.38);
  amber.emissive.setHex(0x9b682c);
  amber.emissiveIntensity = 0.35;
  const snow = material(0xe4edf0, 0.94);
  snow.side = THREE.DoubleSide;
  return {
    stone: material(0x69777a),
    trim: material(0x46575b),
    snow,
    timber: material(0x596052),
    dark: material(0x293b3d),
    roof: material(0x3f565d),
    rune,
    amber,
    metal: material(0x819094, 0.45, 0.5),
    earth: material(0x5c665b),
    water: material(0x477f88, 0.25, 0.08),
    hive: material(0xb39557),
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

function beam(parent: THREE.Object3D, from: Point, to: Point, radius: number, surface: THREE.Material): THREE.Mesh {
  const start = new THREE.Vector3(...from);
  const direction = new THREE.Vector3(...to).sub(start);
  const result = addMesh(parent, new THREE.CylinderGeometry(radius, radius, direction.length(), 6), surface);
  result.position.copy(start).addScaledVector(direction, 0.5);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function gableRoof(
  parent: THREE.Object3D,
  width: number,
  depth: number,
  height: number,
  surface: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const w = width / 2;
  const d = depth / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -w, 0, -d, w, 0, -d, 0, height, -d,
    -w, 0, d, w, 0, d, 0, height, d,
  ], 3));
  geometry.setIndex([
    0, 2, 1, 3, 4, 5,
    0, 3, 5, 0, 5, 2,
    1, 2, 5, 1, 5, 4,
    0, 1, 4, 0, 4, 3,
  ]);
  geometry.computeVertexNormals();
  return addMesh(parent, geometry, surface, x, y, z);
}

function triangle(parent: THREE.Object3D, points: readonly number[], surface: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return addMesh(parent, geometry, surface);
}

function addFoundation(group: THREE.Group, palette: BulwarkPalette, width = 3.25, depth = 2.9): void {
  box(group, width, 0.16, depth, palette.trim, 0, 0.08, 0);
  box(group, width - 0.16, 0.055, depth - 0.16, palette.stone, 0, 0.1875, 0);
  for (const [x, z, scale] of [[-1.34, -1.05, 1], [1.3, 0.92, 0.8], [-1.25, 1.08, 0.65]] as const) {
    const drift = addMesh(group, new THREE.SphereGeometry(0.29, 8, 5), palette.snow, x, 0.22, z);
    drift.scale.set(scale, 0.35, 0.72);
  }
}

function addDoor(group: THREE.Group, palette: BulwarkPalette, x: number, base: number, z: number): void {
  box(group, 0.42, 0.74, 0.065, palette.dark, x, base + 0.37, z);
  for (const side of [-1, 1]) {
    box(group, 0.08, 0.84, 0.09, palette.timber, x + side * 0.25, base + 0.4, z + 0.01);
  }
  box(group, 0.58, 0.09, 0.09, palette.snow, x, base + 0.8, z + 0.01);
  addMesh(group, new THREE.OctahedronGeometry(0.035, 0), palette.rune, x + 0.12, base + 0.36, z + 0.055);
}

function addWindow(group: THREE.Group, palette: BulwarkPalette, x: number, y: number, z: number): void {
  box(group, 0.29, 0.35, 0.055, palette.trim, x, y, z);
  box(group, 0.2, 0.26, 0.06, palette.amber, x, y, z + 0.025);
  box(group, 0.025, 0.27, 0.065, palette.metal, x, y, z + 0.04);
  box(group, 0.21, 0.025, 0.065, palette.metal, x, y, z + 0.04);
  box(group, 0.36, 0.055, 0.12, palette.snow, x, y + 0.21, z + 0.025);
}

function addRuneStone(
  group: THREE.Group,
  palette: BulwarkPalette,
  x: number,
  z: number,
  height = 0.85,
  base = 0.21,
): THREE.Group {
  const stone = new THREE.Group();
  stone.position.set(x, base, z);
  group.add(stone);
  box(stone, 0.26, height, 0.22, palette.stone, 0, height / 2, 0);
  cone(stone, 0.18, 0.2, 4, palette.snow, 0, height + 0.08, 0).rotation.y = Math.PI / 4;
  box(stone, 0.035, height * 0.48, 0.025, palette.rune, 0, height * 0.55, 0.125);
  const leftRune = box(stone, 0.025, height * 0.28, 0.025, palette.rune, -0.055, height * 0.63, 0.126);
  leftRune.rotation.z = -0.55;
  const rightRune = box(stone, 0.025, height * 0.28, 0.025, palette.rune, 0.055, height * 0.63, 0.126);
  rightRune.rotation.z = 0.55;
  return stone;
}

function addTimberFrame(
  group: THREE.Group,
  palette: BulwarkPalette,
  width: number,
  depth: number,
  base: number,
  height: number,
  zOffset = 0,
): void {
  for (const x of [-width / 2, width / 2]) {
    for (const z of [-depth / 2, depth / 2]) {
      box(group, 0.1, height, 0.1, palette.timber, x, base + height / 2, z + zOffset);
    }
  }
  for (const z of [-depth / 2, depth / 2]) {
    box(group, width + 0.1, 0.1, 0.1, palette.dark, 0, base + height - 0.05, z + zOffset);
  }
}

function addConstructionPile(group: THREE.Group, palette: BulwarkPalette, x: number, z: number): void {
  for (let index = 0; index < 3; index += 1) {
    const plank = box(group, 0.72, 0.075, 0.14, palette.timber, x, 0.255 + index * 0.075, z);
    plank.rotation.y = -0.18 + index * 0.17;
  }
  for (const offset of [-0.13, 0.13]) {
    box(group, 0.22, 0.2, 0.24, palette.stone, x + 0.62 + offset, 0.315, z - 0.08).rotation.y = offset * 2;
  }
}

function addScaffold(
  group: THREE.Group,
  palette: BulwarkPalette,
  width: number,
  depth: number,
  height: number,
): void {
  const x = width / 2;
  const z = depth / 2;
  for (const postX of [-x, x]) {
    for (const postZ of [-z, z]) {
      cylinder(group, 0.035, 0.05, height, 6, palette.timber, postX, 0.21 + height / 2, postZ);
    }
  }
  for (const y of [0.21 + height * 0.55, 0.21 + height]) {
    for (const side of [-1, 1]) {
      box(group, width + 0.08, 0.055, 0.055, palette.timber, 0, y, side * z);
      box(group, 0.055, 0.055, depth, palette.timber, side * x, y, 0);
    }
  }
  beam(group, [-x, 0.3, z], [x, height + 0.16, z], 0.025, palette.dark);
  beam(group, [x, 0.3, -z], [-x, height + 0.16, -z], 0.025, palette.dark);
}

function addConstructionMarker(group: THREE.Group, palette: BulwarkPalette): void {
  for (const x of [-0.18, 0.18]) {
    box(group, 0.045, 0.52, 0.045, palette.timber, x, 0.47, 1.38);
  }
  box(group, 0.5, 0.28, 0.055, palette.snow, 0, 0.66, 1.38).name = 'construction-marker';
  for (const direction of [-1, 1]) {
    const mark = box(group, 0.035, 0.2, 0.025, palette.rune, direction * 0.055, 0.66, 1.42);
    mark.rotation.z = direction * 0.55;
  }
}

function buildBanditHideout(group: THREE.Group, palette: BulwarkPalette): void {
  box(group, 2.2, 1.25, 1.55, palette.stone, 0, 0.835, -0.2);
  addTimberFrame(group, palette, 2.18, 1.54, 0.21, 1.25, -0.2);
  gableRoof(group, 2.65, 1.95, 0.72, palette.snow, 0, 1.46, -0.2);
  beam(group, [0, 2.19, -1.2], [0, 2.19, 0.8], 0.055, palette.roof);
  addDoor(group, palette, 0, 0.21, 0.61);
  addWindow(group, palette, -0.68, 0.95, 0.61);
  addWindow(group, palette, 0.68, 0.95, 0.61);

  cylinder(group, 0.38, 0.45, 2.2, 8, palette.trim, -0.91, 1.31, -0.65);
  cylinder(group, 0.48, 0.48, 0.14, 8, palette.stone, -0.91, 2.43, -0.65);
  cone(group, 0.57, 0.58, 8, palette.snow, -0.91, 2.79, -0.65);
  addWindow(group, palette, -0.91, 1.8, -0.235);

  for (const side of [-1, 1]) {
    for (const z of [-0.8, -0.15, 0.5]) {
      cylinder(group, 0.055, 0.075, 1.05, 6, palette.timber, side * 1.43, 0.735, z);
      cone(group, 0.09, 0.22, 6, palette.snow, side * 1.43, 1.37, z);
    }
    box(group, 0.08, 0.1, 1.5, palette.dark, side * 1.43, 0.82, -0.15);
  }

  const dummy = new THREE.Group();
  dummy.name = 'bandit-dummy';
  dummy.position.set(0.92, 0.21, 1.02);
  group.add(dummy);
  cylinder(dummy, 0.035, 0.05, 0.85, 6, palette.timber, 0, 0.425, 0);
  box(dummy, 0.58, 0.075, 0.075, palette.timber, 0, 0.64, 0);
  cylinder(dummy, 0.2, 0.2, 0.075, 10, palette.hive, 0, 0.72, 0).rotation.x = Math.PI / 2;
  cylinder(dummy, 0.08, 0.08, 0.085, 8, palette.rune, 0, 0.72, 0.045).rotation.x = Math.PI / 2;
  box(dummy, 0.42, 0.06, 0.28, palette.dark, 0, 0.03, 0);
  addRuneStone(group, palette, -1.22, 1.03, 0.72);
}

function buildBanditConstruction(group: THREE.Group, palette: BulwarkPalette): void {
  box(group, 2.15, 0.52, 0.22, palette.stone, 0, 0.47, -0.84);
  box(group, 0.22, 0.82, 1.45, palette.stone, -0.97, 0.62, -0.15);
  box(group, 0.22, 0.32, 1.45, palette.stone, 0.97, 0.37, -0.15);
  addTimberFrame(group, palette, 1.94, 1.4, 0.21, 1.18, -0.15);
  addScaffold(group, palette, 2.75, 2.25, 1.5);
  addConstructionPile(group, palette, -0.7, 1.03);
}

function buildHornetNest(group: THREE.Group, palette: BulwarkPalette): void {
  for (const [x, z] of [[-0.88, -0.68], [0.88, -0.68], [-0.88, 0.68], [0.88, 0.68]] as const) {
    cylinder(group, 0.075, 0.12, 2.45, 7, palette.dark, x, 1.435, z);
    cone(group, 0.12, 0.3, 6, palette.snow, x, 2.8, z);
  }
  box(group, 2.15, 0.16, 1.75, palette.timber, 0, 1.05, 0);
  box(group, 2.3, 0.14, 1.85, palette.trim, 0, 2.55, 0);
  beam(group, [-0.88, 0.25, 0.68], [0.88, 2.48, 0.68], 0.045, palette.timber);
  beam(group, [0.88, 0.25, -0.68], [-0.88, 2.48, -0.68], 0.045, palette.timber);
  cylinder(group, 0.17, 0.25, 3.2, 8, palette.timber, 0, 1.81, -0.08);

  const hive = new THREE.Group();
  hive.name = 'hornet-hive';
  hive.position.set(0, 2.35, 0.05);
  group.add(hive);
  addMesh(hive, new THREE.SphereGeometry(0.78, 12, 9), palette.hive).scale.set(0.96, 1.18, 0.88);
  for (const [y, radius] of [[-0.64, 0.48], [-0.34, 0.68], [0, 0.75], [0.34, 0.67], [0.64, 0.45]] as const) {
    const ring = addMesh(hive, new THREE.TorusGeometry(radius, 0.035, 5, 18), palette.dark, 0, y, 0);
    ring.rotation.x = Math.PI / 2;
    ring.scale.y = 0.88;
  }
  cylinder(hive, 0.19, 0.24, 0.1, 8, palette.dark, 0, -0.15, 0.69).rotation.x = Math.PI / 2;
  cone(hive, 0.5, 0.43, 8, palette.snow, 0, 1.09, 0);
  for (const side of [-1, 1]) {
    triangle(hive, [
      side * 0.45, 0.32, -0.12,
      side * 1.23, 0.83, -0.18,
      side * 0.91, 0.06, -0.08,
    ], palette.snow);
    beam(hive, [side * 0.43, 0.3, -0.1], [side * 1.18, 0.79, -0.17], 0.025, palette.metal);
  }
  cylinder(group, 0.025, 0.04, 0.48, 6, palette.metal, 0, 3.82, 0.05);
  addMesh(group, new THREE.OctahedronGeometry(0.11, 0), palette.rune, 0, 4.08, 0.05);
  addRuneStone(group, palette, -1.3, 0.95, 0.85);
  addRuneStone(group, palette, 1.3, 0.95, 0.85);
}

function buildHornetConstruction(group: THREE.Group, palette: BulwarkPalette): void {
  for (const [x, z] of [[-0.88, -0.68], [0.88, -0.68], [-0.88, 0.68], [0.88, 0.68]] as const) {
    cylinder(group, 0.075, 0.12, 1.85, 7, palette.dark, x, 1.135, z);
  }
  box(group, 2.15, 0.16, 1.75, palette.timber, 0, 1.05, 0);
  cylinder(group, 0.17, 0.25, 1.65, 8, palette.timber, 0, 1.035, -0.08);
  const ring = addMesh(group, new THREE.TorusGeometry(0.62, 0.055, 5, 12, Math.PI * 1.45), palette.hive, 0, 2.05, 0);
  ring.rotation.x = Math.PI / 2;
  addScaffold(group, palette, 2.55, 2.15, 2.05);
  addConstructionPile(group, palette, -0.65, 1.02);
}

function buildShamanLodge(group: THREE.Group, palette: BulwarkPalette): void {
  cylinder(group, 1.24, 1.34, 0.34, 12, palette.trim, 0, 0.38, -0.08);
  cylinder(group, 0.91, 1.08, 1.35, 12, palette.stone, 0, 1.225, -0.08);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    cylinder(group, 0.045, 0.06, 1.34, 6, palette.timber,
      Math.sin(angle) * 0.94, 1.23, Math.cos(angle) * 0.94 - 0.08);
  }
  cone(group, 1.38, 1.05, 12, palette.snow, 0, 2.425, -0.08);
  cylinder(group, 0.12, 0.17, 0.36, 8, palette.roof, 0, 3.04, -0.08);
  cone(group, 0.23, 0.42, 8, palette.roof, 0, 3.4, -0.08);
  cylinder(group, 0.025, 0.04, 0.38, 6, palette.metal, 0, 3.74, -0.08);
  addMesh(group, new THREE.OctahedronGeometry(0.17, 0), palette.rune, 0, 4.02, -0.08).scale.y = 1.35;

  addDoor(group, palette, 0, 0.55, 0.925);
  for (const x of [-0.52, 0.52]) addWindow(group, palette, x, 1.35, 0.75);
  const circle = addMesh(group, new THREE.TorusGeometry(1.42, 0.045, 6, 32), palette.rune, 0, 0.245, -0.02);
  circle.name = 'shaman-rune-circle';
  circle.rotation.x = Math.PI / 2;
  for (const [x, z, height] of [[-1.34, -0.78, 1.15], [1.34, -0.78, 1.15], [-1.34, 0.72, 0.92], [1.34, 0.72, 0.92]] as const) {
    addRuneStone(group, palette, x, z, height);
  }
  const altar = cylinder(group, 0.31, 0.4, 0.36, 8, palette.dark, 0, 0.39, 1.02);
  altar.name = 'shaman-altar';
  addMesh(group, new THREE.OctahedronGeometry(0.14, 0), palette.rune, 0, 0.7, 1.02);
}

function buildShamanConstruction(group: THREE.Group, palette: BulwarkPalette): void {
  cylinder(group, 1.24, 1.34, 0.34, 12, palette.trim, 0, 0.38, -0.08);
  cylinder(group, 0.98, 1.08, 0.72, 12, palette.stone, 0, 0.91, -0.08);
  for (const [x, z] of [[-0.72, -0.6], [0.72, -0.6], [-0.72, 0.48]] as const) {
    cylinder(group, 0.055, 0.075, 1.45, 6, palette.timber, x, 1.475, z);
  }
  beam(group, [-0.72, 2.19, 0.48], [0.72, 2.19, -0.6], 0.045, palette.timber);
  addRuneStone(group, palette, -1.32, 0.74, 0.75);
  addRuneStone(group, palette, 1.32, 0.74, 0.75);
  addScaffold(group, palette, 2.65, 2.15, 1.9);
  addConstructionPile(group, palette, -0.62, 1.04);
}

function addAlligatorCrest(group: THREE.Group, palette: BulwarkPalette): void {
  const crest = new THREE.Group();
  crest.name = 'alligator-crest';
  crest.position.set(0, 2.62, -1.03);
  group.add(crest);
  addMesh(crest, new THREE.SphereGeometry(0.34, 10, 6), palette.metal).scale.set(1.45, 0.42, 0.62);
  box(crest, 0.52, 0.14, 0.3, palette.metal, 0, -0.015, 0.27);
  box(crest, 0.48, 0.035, 0.31, palette.snow, 0, -0.1, 0.28);
  for (const x of [-0.18, 0.18]) {
    addMesh(crest, new THREE.OctahedronGeometry(0.045, 0), palette.rune, x, 0.12, 0.18);
  }
  const tail = cone(crest, 0.13, 0.65, 6, palette.metal, 0, 0, -0.5);
  tail.rotation.x = -Math.PI / 2;
}

function buildAlligatorPit(group: THREE.Group, palette: BulwarkPalette): void {
  const pool = cylinder(group, 1.14, 1.14, 0.09, 24, palette.water, 0, 0.26, 0.12);
  pool.name = 'alligator-pool';
  pool.scale.z = 0.82;
  const rim = addMesh(group, new THREE.TorusGeometry(1.2, 0.12, 7, 24), palette.trim, 0, 0.3, 0.12);
  rim.rotation.x = Math.PI / 2;
  rim.scale.y = 0.82;
  for (const side of [-1, 1]) {
    box(group, 0.24, 0.62, 2.5, palette.stone, side * 1.44, 0.52, 0);
    for (const z of [-1.05, -0.35, 0.35, 1.05]) {
      box(group, 0.32, 0.25, 0.32, palette.snow, side * 1.44, 0.955, z);
    }
    cylinder(group, 0.18, 0.24, 2.25, 8, palette.trim, side * 0.82, 1.335, -1.08);
    cone(group, 0.3, 0.42, 8, palette.snow, side * 0.82, 2.67, -1.08);
  }
  box(group, 1.95, 0.32, 0.34, palette.stone, 0, 2.31, -1.08);
  box(group, 2.08, 0.09, 0.42, palette.snow, 0, 2.515, -1.08);
  box(group, 1.22, 0.85, 0.16, palette.dark, 0, 1.22, -1.14);
  for (const x of [-0.38, 0, 0.38]) {
    box(group, 0.045, 0.52, 0.025, palette.rune, x, 1.3, -1.045);
  }
  addAlligatorCrest(group, palette);
  for (let index = 0; index < 5; index += 1) {
    box(group, 0.82, 0.08, 0.18, palette.timber, 0, 0.37 + index * 0.02, 0.76 + index * 0.16);
  }
  addRuneStone(group, palette, -1.12, 1.16, 0.64);
  addRuneStone(group, palette, 1.12, 1.16, 0.64);
}

function buildAlligatorConstruction(group: THREE.Group, palette: BulwarkPalette): void {
  cylinder(group, 1.15, 1.15, 0.07, 20, palette.earth, 0, 0.25, 0.12).scale.z = 0.82;
  for (const side of [-1, 1]) {
    box(group, 0.24, 0.34, 2.4, palette.stone, side * 1.42, 0.38, 0);
    cylinder(group, 0.18, 0.24, 1.05, 8, palette.trim, side * 0.82, 0.735, -1.08);
  }
  box(group, 1.85, 0.16, 0.3, palette.timber, 0, 1.25, -1.08);
  addScaffold(group, palette, 2.85, 2.45, 1.35);
  addConstructionPile(group, palette, -0.67, 1.03);
}

const DWELLINGS: Readonly<Record<BulwarkBuildingId, DwellingDetails>> = {
  banditHideout: {
    creatureId: 'bandit', tier: 1, form: 'hall',
    build: buildBanditHideout, buildConstruction: buildBanditConstruction,
  },
  hornetNest: {
    creatureId: 'hornet', tier: 2, form: 'grove',
    build: buildHornetNest, buildConstruction: buildHornetConstruction,
  },
  shamanLodge: {
    creatureId: 'shaman', tier: 3, form: 'ritual',
    build: buildShamanLodge, buildConstruction: buildShamanConstruction,
  },
  alligatorPit: {
    creatureId: 'alligator', tier: 4, form: 'aquatic',
    build: buildAlligatorPit, buildConstruction: buildAlligatorConstruction,
  },
};

function createBuildingModel(buildingId: string, built: boolean): THREE.Group | null {
  if (!Object.hasOwn(DWELLINGS, buildingId)) return null;
  const id = buildingId as BulwarkBuildingId;
  const details = DWELLINGS[id];
  const group = new THREE.Group();
  group.name = id;
  group.userData = {
    faction: 'bulwark',
    modelPack: 'bulwark',
    buildingId: id,
    creatureId: details.creatureId,
    category: 'dwelling',
    tier: details.tier,
    form: details.form,
    built,
    constructionState: built ? 'complete' : 'underConstruction',
  };

  const palette = createPalette();
  addFoundation(group, palette);
  const structure = new THREE.Group();
  structure.name = built ? 'completed-dwelling' : 'construction-site';
  group.add(structure);
  if (built) details.build(structure, palette);
  else {
    details.buildConstruction(structure, palette);
    addConstructionMarker(structure, palette);
  }
  const bounds = new THREE.Box3().setFromObject(group);
  group.userData.labelHeight = bounds.max.y + 0.35;
  return group;
}

export default {
  faction: 'Bulwark',
  createBuildingModel,
};
