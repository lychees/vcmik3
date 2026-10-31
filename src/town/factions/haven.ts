import * as THREE from 'three';

interface HavenMaterials {
  stone: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  blue: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
  earth: THREE.MeshStandardMaterial;
  canvas: THREE.MeshStandardMaterial;
}

type BuildingId = 'militiaBarracks' | 'archeryRange' | 'griffinTower' | 'joustingArena';
type Point = readonly [number, number, number];

function material(color: number, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  result.userData.baseColor = result.color.getHex();
  return result;
}

function createMaterials(): HavenMaterials {
  const blue = material(0x365d91);
  blue.side = THREE.DoubleSide;
  const gold = material(0xf0cf72, 0.42, 0.3);
  gold.side = THREE.DoubleSide;
  return {
    stone: material(0xd6c9a8),
    trim: material(0x8f8978),
    roof: material(0x8e4d3f),
    wood: material(0x725037),
    dark: material(0x382f2a),
    gold,
    blue,
    glass: material(0x91c9d4, 0.28),
    earth: material(0x9b8058),
    canvas: material(0xeee2bd),
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

function beam(parent: THREE.Object3D, start: Point, end: Point, radius: number, surface: THREE.Material): THREE.Mesh {
  const origin = new THREE.Vector3(...start);
  const direction = new THREE.Vector3(...end).sub(origin);
  const result = addMesh(parent, new THREE.CylinderGeometry(radius, radius, direction.length(), 6), surface);
  result.position.copy(origin.addScaledVector(direction, 0.5));
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

function addFlag(
  parent: THREE.Object3D,
  surfaces: HavenMaterials,
  x: number,
  y: number,
  z: number,
  height: number,
  rotation = 0,
): void {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  parent.add(group);
  cylinder(group, 0.025, 0.035, height, 6, surfaces.wood, 0, height / 2, 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, 0.5, -0.12, 0.035, 0, -0.32, 0,
  ], 3));
  geometry.computeVertexNormals();
  addMesh(group, geometry, surfaces.blue, 0, height - 0.05, 0);
  addMesh(group, new THREE.OctahedronGeometry(0.055, 0), surfaces.gold, 0, height + 0.025, 0);
}

function addDoor(
  parent: THREE.Object3D,
  surfaces: HavenMaterials,
  x: number,
  base: number,
  z: number,
  width: number,
  height: number,
): void {
  box(parent, width, height, 0.055, surfaces.dark, x, base + height / 2, z);
  box(parent, 0.075, height + 0.08, 0.08, surfaces.trim, x - width / 2 - 0.035, base + height / 2, z + 0.005);
  box(parent, 0.075, height + 0.08, 0.08, surfaces.trim, x + width / 2 + 0.035, base + height / 2, z + 0.005);
  box(parent, width + 0.14, 0.09, 0.08, surfaces.trim, x, base + height + 0.035, z + 0.005);
  addMesh(parent, new THREE.SphereGeometry(0.035, 6, 4), surfaces.gold, x + width * 0.28, base + height * 0.48, z + 0.055);
}

function addWindow(parent: THREE.Object3D, surfaces: HavenMaterials, x: number, y: number, z: number): void {
  box(parent, 0.28, 0.4, 0.045, surfaces.trim, x, y, z);
  box(parent, 0.19, 0.3, 0.055, surfaces.glass, x, y, z + 0.025);
  box(parent, 0.025, 0.3, 0.065, surfaces.gold, x, y, z + 0.04);
  box(parent, 0.19, 0.025, 0.065, surfaces.gold, x, y, z + 0.04);
}

function addShield(parent: THREE.Object3D, surfaces: HavenMaterials, x: number, y: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  cylinder(group, 0.2, 0.2, 0.065, 12, surfaces.blue).rotation.x = Math.PI / 2;
  box(group, 0.055, 0.29, 0.075, surfaces.gold, 0, 0, 0.045);
  box(group, 0.27, 0.055, 0.075, surfaces.gold, 0, 0.025, 0.045);
  return group;
}

function addTarget(parent: THREE.Object3D, surfaces: HavenMaterials, x: number, z: number): void {
  const target = new THREE.Group();
  target.name = 'archery-target';
  target.position.set(x, 0, z);
  parent.add(target);
  beam(target, [-0.23, 0.14, 0], [0, 0.72, 0], 0.035, surfaces.wood);
  beam(target, [0.23, 0.14, 0], [0, 0.72, 0], 0.035, surfaces.wood);
  cylinder(target, 0.32, 0.32, 0.07, 16, surfaces.canvas, 0, 0.78, 0).rotation.x = Math.PI / 2;
  cylinder(target, 0.22, 0.22, 0.075, 16, surfaces.blue, 0, 0.78, 0.045).rotation.x = Math.PI / 2;
  cylinder(target, 0.095, 0.095, 0.08, 12, surfaces.gold, 0, 0.78, 0.085).rotation.x = Math.PI / 2;
  beam(target, [0.04, 0.8, 0.13], [0.04, 0.8, 0.36], 0.012, surfaces.dark);
}

function triangleWing(parent: THREE.Object3D, surface: THREE.Material, side: number): void {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, side * 0.68, 0.42, 0, side * 0.43, -0.08, 0,
    side * 0.08, -0.02, 0, side * 0.53, -0.22, 0, side * 0.28, -0.15, 0,
  ], 3));
  geometry.computeVertexNormals();
  addMesh(parent, geometry, surface);
}

function addGriffinCrest(parent: THREE.Object3D, surfaces: HavenMaterials): void {
  const crest = new THREE.Group();
  crest.name = 'griffin-crest';
  crest.position.set(0, 3.63, 0.77);
  parent.add(crest);
  addMesh(crest, new THREE.SphereGeometry(0.15, 8, 6), surfaces.gold).scale.set(1, 1.25, 0.8);
  addMesh(crest, new THREE.SphereGeometry(0.1, 8, 6), surfaces.gold, 0, 0.2, 0.025);
  cone(crest, 0.055, 0.15, 6, surfaces.gold, 0, 0.18, 0.13).rotation.x = Math.PI / 2;
  triangleWing(crest, surfaces.gold, -1);
  triangleWing(crest, surfaces.gold, 1);
  beam(crest, [-0.08, -0.12, 0], [-0.13, -0.32, 0.04], 0.025, surfaces.gold);
  beam(crest, [0.08, -0.12, 0], [0.13, -0.32, 0.04], 0.025, surfaces.gold);
}

function addFoundation(parent: THREE.Object3D, surfaces: HavenMaterials, radius = 1.64): void {
  cylinder(parent, radius, radius, 0.14, 16, surfaces.trim, 0, 0.07, 0);
  cylinder(parent, radius - 0.08, radius - 0.08, 0.045, 16, surfaces.earth, 0, 0.1475, 0);
}

function createMilitiaBarracks(): THREE.Group {
  const group = new THREE.Group();
  const surfaces = createMaterials();
  addFoundation(group, surfaces);
  box(group, 2.35, 1.35, 1.75, surfaces.stone, 0, 0.815, -0.12);
  box(group, 2.45, 0.16, 1.85, surfaces.trim, 0, 0.24, -0.12);
  gableRoof(group, 2.65, 2.05, 0.72, surfaces.roof, 0, 1.49, -0.12);
  for (const x of [-1.12, 1.12]) {
    cylinder(group, 0.27, 0.31, 1.35, 10, surfaces.stone, x, 0.815, 0.48);
    cylinder(group, 0.34, 0.34, 0.12, 10, surfaces.trim, x, 1.47, 0.48);
    cone(group, 0.39, 0.5, 10, surfaces.roof, x, 1.78, 0.48);
  }
  for (const x of [-0.9, -0.45, 0, 0.45, 0.9]) {
    box(group, 0.22, 0.28, 0.2, surfaces.stone, x, 1.57, 0.77);
  }
  addDoor(group, surfaces, 0, 0.17, 0.79, 0.43, 0.76);
  const leftShield = addShield(group, surfaces, -0.65, 0.88, 0.81);
  leftShield.name = 'militia-shield';
  addShield(group, surfaces, 0.65, 0.88, 0.81);
  for (const z of [-0.42, -0.1, 0.22]) {
    cylinder(group, 0.022, 0.028, 1.15, 6, surfaces.wood, 1.39, 0.715, z);
    cone(group, 0.07, 0.22, 6, surfaces.trim, 1.39, 1.4, z);
  }
  box(group, 0.09, 0.1, 0.9, surfaces.wood, 1.38, 0.65, -0.1);
  addFlag(group, surfaces, 0, 2.18, -0.12, 0.7);
  return group;
}

function createArcheryRange(): THREE.Group {
  const group = new THREE.Group();
  const surfaces = createMaterials();
  addFoundation(group, surfaces);
  box(group, 2.55, 1.2, 1.65, surfaces.stone, -0.15, 0.74, -0.38);
  box(group, 2.62, 0.16, 1.72, surfaces.wood, -0.15, 1.23, -0.38);
  gableRoof(group, 2.85, 1.95, 0.8, surfaces.roof, -0.15, 1.34, -0.38);
  cylinder(group, 0.29, 0.34, 1.75, 10, surfaces.stone, -1, 1.015, -0.6);
  cone(group, 0.43, 0.65, 10, surfaces.roof, -1, 2.215, -0.6);
  addDoor(group, surfaces, -0.15, 0.16, 0.47, 0.4, 0.72);
  addWindow(group, surfaces, -0.83, 0.85, 0.47);
  addWindow(group, surfaces, 0.53, 0.85, 0.47);
  for (const x of [-0.95, 0, 0.95]) addTarget(group, surfaces, x, 1.03);
  addFlag(group, surfaces, -1, 2.52, -0.6, 0.56);
  return group;
}

function createGriffinTower(): THREE.Group {
  const group = new THREE.Group();
  const surfaces = createMaterials();
  addFoundation(group, surfaces);
  cylinder(group, 0.83, 1.02, 2.8, 12, surfaces.stone, 0, 1.54, -0.08);
  for (const [x, z] of [[-0.82, -0.55], [0.82, -0.55], [-0.82, 0.4], [0.82, 0.4]] as const) {
    cylinder(group, 0.11, 0.2, 2.05, 6, surfaces.trim, x, 1.165, z);
    cone(group, 0.17, 0.42, 6, surfaces.roof, x, 2.4, z);
  }
  cylinder(group, 1.06, 1.06, 0.18, 12, surfaces.trim, 0, 2.86, -0.08);
  for (let index = 0; index < 10; index += 1) {
    const angle = index * Math.PI * 2 / 10;
    box(group, 0.2, 0.28, 0.2, surfaces.stone,
      Math.cos(angle) * 0.91, 3.04, Math.sin(angle) * 0.91 - 0.08).rotation.y = -angle;
  }
  cone(group, 1.16, 1.15, 12, surfaces.roof, 0, 3.65, -0.08);
  addDoor(group, surfaces, 0, 0.17, 0.94, 0.43, 0.85);
  addWindow(group, surfaces, 0, 1.55, 0.855);
  addWindow(group, surfaces, 0, 2.25, 0.79);
  addGriffinCrest(group, surfaces);
  beam(group, [-1.23, 2.62, 0.18], [-0.7, 2.62, 0.18], 0.055, surfaces.wood);
  beam(group, [0.7, 2.62, 0.18], [1.23, 2.62, 0.18], 0.055, surfaces.wood);
  addFlag(group, surfaces, 0, 4.2, -0.08, 0.72);
  return group;
}

function addHorseCrest(parent: THREE.Object3D, surfaces: HavenMaterials): void {
  const horse = new THREE.Group();
  horse.name = 'cavalier-crest';
  horse.position.set(0, 2.66, -0.78);
  parent.add(horse);
  box(horse, 0.42, 0.2, 0.16, surfaces.gold, 0, 0, 0);
  box(horse, 0.13, 0.3, 0.14, surfaces.gold, 0.2, 0.18, 0).rotation.z = -0.25;
  box(horse, 0.18, 0.12, 0.14, surfaces.gold, 0.26, 0.34, 0);
  for (const x of [-0.14, 0.13]) {
    box(horse, 0.055, 0.3, 0.07, surfaces.gold, x, -0.22, 0);
  }
  cone(horse, 0.06, 0.28, 6, surfaces.gold, -0.29, 0.02, 0).rotation.z = -1.1;
}

function createJoustingArena(): THREE.Group {
  const group = new THREE.Group();
  const surfaces = createMaterials();
  addFoundation(group, surfaces, 1.67);
  const points: Point[] = [];
  for (let index = 0; index < 12; index += 1) {
    const angle = index * Math.PI * 2 / 12;
    const x = Math.cos(angle) * 1.47;
    const z = Math.sin(angle) * 1.25;
    points.push([x, 0, z]);
    cylinder(group, 0.045, 0.06, 0.68, 6, surfaces.wood, x, 0.48, z);
    cone(group, 0.075, 0.14, 6, surfaces.gold, x, 0.89, z);
  }
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]!;
    const end = points[(index + 1) % points.length]!;
    if ((start[2] + end[2]) / 2 > 1.05 && Math.abs((start[0] + end[0]) / 2) < 0.8) continue;
    beam(group, [start[0], 0.43, start[2]], [end[0], 0.43, end[2]], 0.025, surfaces.wood);
    beam(group, [start[0], 0.67, start[2]], [end[0], 0.67, end[2]], 0.025, surfaces.wood);
  }
  box(group, 2.15, 0.4, 0.7, surfaces.wood, 0, 0.35, -0.76);
  for (const z of [-0.94, -0.7, -0.48]) {
    box(group, 2.05, 0.09, 0.15, surfaces.canvas, 0, 0.59 + (z + 0.94) * 0.35, z);
  }
  for (const x of [-0.95, 0.95]) {
    for (const z of [-1.05, -0.48]) {
      cylinder(group, 0.035, 0.045, 1.35, 6, surfaces.wood, x, 1.225, z);
    }
  }
  gableRoof(group, 2.45, 1, 0.55, surfaces.blue, 0, 1.85, -0.77);
  box(group, 2.48, 0.08, 0.08, surfaces.gold, 0, 1.88, -0.25);
  const barrier = box(group, 0.12, 0.38, 1.4, surfaces.wood, 0, 0.34, 0.17);
  barrier.name = 'jousting-barrier';
  for (const z of [-0.42, 0.12, 0.66]) {
    box(group, 0.32, 0.08, 0.12, surfaces.canvas, 0, 0.57, z);
  }
  beam(group, [-0.96, 0.17, 0.98], [-0.55, 2.12, 0.75], 0.025, surfaces.wood);
  beam(group, [0.96, 0.17, 0.98], [0.55, 2.12, 0.75], 0.025, surfaces.wood);
  addMesh(group, new THREE.OctahedronGeometry(0.075, 0), surfaces.gold, -0.55, 2.14, 0.75);
  addMesh(group, new THREE.OctahedronGeometry(0.075, 0), surfaces.gold, 0.55, 2.14, 0.75);
  addShield(group, surfaces, -0.86, 0.85, 1.01);
  addShield(group, surfaces, 0.86, 0.85, 1.01);
  addFlag(group, surfaces, -1.08, 0.14, 0.64, 2.48);
  addFlag(group, surfaces, 1.08, 0.14, 0.64, 2.48, Math.PI);
  addHorseCrest(group, surfaces);
  addFlag(group, surfaces, 0, 2.39, -0.77, 0.72);
  return group;
}

function addScaffolding(group: THREE.Object3D, surfaces: HavenMaterials, height: number): void {
  for (const x of [-1.37, 1.37]) {
    for (const z of [-1.08, 1.08]) {
      cylinder(group, 0.035, 0.05, height, 6, surfaces.wood, x, 0.14 + height / 2, z);
    }
  }
  for (const z of [-1.08, 1.08]) {
    beam(group, [-1.37, 0.28, z], [1.37, height + 0.08, z], 0.025, surfaces.wood);
    beam(group, [1.37, 0.28, z], [-1.37, height + 0.08, z], 0.025, surfaces.wood);
    beam(group, [-1.45, height * 0.72, z], [1.45, height * 0.72, z], 0.035, surfaces.wood);
  }
}

function addConstructionMaterials(group: THREE.Object3D, surfaces: HavenMaterials): void {
  for (const [x, z, rotation] of [[-0.8, 1.32, 0.1], [0.05, 1.3, -0.08]] as const) {
    const plank = box(group, 0.65, 0.09, 0.16, surfaces.wood, x, 0.22, z);
    plank.rotation.y = rotation;
  }
  for (const [x, z] of [[0.82, 1.22], [1.03, 1.15], [0.88, 0.98]] as const) {
    box(group, 0.25, 0.18, 0.22, surfaces.stone, x, 0.25, z).rotation.y = x;
  }
}

function createConstructionSite(id: BuildingId): THREE.Group {
  const group = new THREE.Group();
  const surfaces = createMaterials();
  const tier = BUILDING_DETAILS[id].tier;
  if (id === 'griffinTower') {
    cylinder(group, 1.52, 1.52, 0.14, 16, surfaces.trim, 0, 0.07, 0);
    cylinder(group, 0.91, 1.02, 0.82, 12, surfaces.stone, 0, 0.55, -0.08);
    cylinder(group, 1.06, 1.06, 0.12, 12, surfaces.trim, 0, 0.91, -0.08);
  } else if (id === 'joustingArena') {
    cylinder(group, 1.58, 1.58, 0.14, 16, surfaces.trim, 0, 0.07, 0);
    cylinder(group, 1.4, 1.4, 0.05, 16, surfaces.earth, 0, 0.165, 0);
    for (const x of [-1.2, -0.6, 0, 0.6, 1.2]) {
      cylinder(group, 0.04, 0.055, 0.72, 6, surfaces.wood, x, 0.5, -1.03);
    }
    beam(group, [-1.2, 0.67, -1.03], [1.2, 0.67, -1.03], 0.035, surfaces.wood);
    box(group, 0.12, 0.28, 1.25, surfaces.wood, 0, 0.31, 0.12);
  } else {
    box(group, 2.95, 0.14, 2.55, surfaces.trim, 0, 0.07, 0);
    if (id === 'militiaBarracks') {
      box(group, 2.25, 0.55, 0.25, surfaces.stone, 0, 0.415, -0.85);
      box(group, 0.25, 0.85, 1.45, surfaces.stone, -1, 0.565, -0.2);
      box(group, 0.25, 0.32, 1.45, surfaces.stone, 1, 0.3, -0.2);
    } else {
      for (const x of [-1.02, 0, 1.02]) {
        for (const z of [-0.75, 0.45]) {
          box(group, 0.12, 1.25, 0.12, surfaces.wood, x, 0.765, z);
        }
        beam(group, [x, 1.39, -0.75], [x, 1.39, 0.45], 0.045, surfaces.wood);
      }
      beam(group, [-1.12, 1.39, -0.75], [1.12, 1.39, -0.75], 0.05, surfaces.wood);
    }
  }
  addScaffolding(group, surfaces, 1.35 + tier * 0.13);
  addConstructionMaterials(group, surfaces);
  return group;
}

const BUILDING_DETAILS: Readonly<Record<BuildingId, {
  creatureId: 'militia' | 'archer' | 'griffin' | 'cavalier';
  tier: 1 | 2 | 3 | 4;
  form: 'bastion' | 'hall' | 'tower' | 'pen';
  builder: () => THREE.Group;
}>> = {
  militiaBarracks: { creatureId: 'militia', tier: 1, form: 'bastion', builder: createMilitiaBarracks },
  archeryRange: { creatureId: 'archer', tier: 2, form: 'hall', builder: createArcheryRange },
  griffinTower: { creatureId: 'griffin', tier: 3, form: 'tower', builder: createGriffinTower },
  joustingArena: { creatureId: 'cavalier', tier: 4, form: 'pen', builder: createJoustingArena },
};

function createDwelling(id: BuildingId, built: boolean): THREE.Group {
  const details = BUILDING_DETAILS[id];
  const group = built ? details.builder() : createConstructionSite(id);
  group.name = id;
  group.userData.faction = 'Haven';
  group.userData.buildingId = id;
  group.userData.creatureId = details.creatureId;
  group.userData.tier = details.tier;
  group.userData.form = details.form;
  group.userData.built = built;
  group.userData.constructionState = built ? 'complete' : 'underConstruction';
  return group;
}

const havenModelPack = {
  faction: 'Haven',
  createBuildingModel(buildingId: string, built: boolean): THREE.Group | null {
    if (!Object.hasOwn(BUILDING_DETAILS, buildingId)) return null;
    return createDwelling(buildingId as BuildingId, built);
  },
};

export default havenModelPack;
