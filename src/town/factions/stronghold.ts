import * as THREE from 'three';

const DWELLING_IDS = ['goblinBarracks', 'wolfPen', 'ogreFort', 'behemothCliffs'] as const;

type BuildingId = typeof DWELLING_IDS[number];
type Point = readonly [number, number, number];

interface StrongholdPalette {
  timber: THREE.MeshStandardMaterial;
  darkTimber: THREE.MeshStandardMaterial;
  hide: THREE.MeshStandardMaterial;
  redHide: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  darkStone: THREE.MeshStandardMaterial;
  bone: THREE.MeshStandardMaterial;
  iron: THREE.MeshStandardMaterial;
  earth: THREE.MeshStandardMaterial;
  shadow: THREE.MeshStandardMaterial;
  ember: THREE.MeshStandardMaterial;
}

interface DwellingDefinition {
  creatureId: 'goblin' | 'wolfRider' | 'ogre' | 'behemoth';
  tier: 1 | 2 | 3 | 4;
  form: 'bastion' | 'pen' | 'cavern';
  build: (parent: THREE.Group, palette: StrongholdPalette) => void;
}

function material(color: number, roughness = 0.88, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}

function createPalette(): StrongholdPalette {
  const ember = material(0xe19046, 0.5);
  ember.emissive.setHex(0x8a351d);
  ember.emissiveIntensity = 0.65;
  return {
    timber: material(0x806348),
    darkTimber: material(0x514237),
    hide: material(0xa7835a),
    redHide: material(0x823f32),
    stone: material(0x756a57),
    darkStone: material(0x514b41),
    bone: material(0xd2c39e),
    iron: material(0x494a45, 0.55, 0.42),
    earth: material(0x806849),
    shadow: material(0x211d19),
    ember,
  };
}

function mesh(
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
  return mesh(parent, new THREE.BoxGeometry(width, height, depth), surface, x, y, z);
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
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, x, y, z);
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
  return mesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, x, y, z);
}

function beam(parent: THREE.Object3D, start: Point, end: Point, radius: number, surface: THREE.Material): THREE.Mesh {
  const origin = new THREE.Vector3(...start);
  const direction = new THREE.Vector3(...end).sub(origin);
  const result = mesh(parent, new THREE.CylinderGeometry(radius * 0.82, radius, direction.length(), 7), surface);
  result.position.copy(origin).addScaledVector(direction, 0.5);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function rock(
  parent: THREE.Object3D,
  radius: number,
  surface: THREE.Material,
  x: number,
  y: number,
  z: number,
  scale: Point = [1, 1, 1],
): THREE.Mesh {
  const result = mesh(parent, new THREE.DodecahedronGeometry(radius, 0), surface, x, y, z);
  result.scale.set(...scale);
  result.rotation.set(x * 0.17, z * 0.31, x * z * 0.08);
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
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -halfWidth, 0, -halfDepth, halfWidth, 0, -halfDepth, 0, height, -halfDepth,
    -halfWidth, 0, halfDepth, halfWidth, 0, halfDepth, 0, height, halfDepth,
  ], 3));
  geometry.setIndex([
    0, 2, 1, 3, 4, 5,
    0, 3, 5, 0, 5, 2,
    1, 2, 5, 1, 5, 4,
    0, 1, 4, 0, 4, 3,
  ]);
  geometry.computeVertexNormals();
  return mesh(parent, geometry, surface, x, y, z);
}

function addFoundation(parent: THREE.Group, palette: StrongholdPalette, width = 3.35, depth = 3.15): void {
  box(parent, width, 0.16, depth, palette.darkStone, 0, 0.08, 0);
  box(parent, width - 0.16, 0.055, depth - 0.16, palette.earth, 0, 0.1875, 0);
  for (const [x, z] of [[-1.48, -1.32], [1.48, -1.32], [-1.48, 1.32], [1.48, 1.32]] as const) {
    rock(parent, 0.17, palette.stone, x, 0.24, z, [1.1, 0.65, 0.9]);
  }
}

function addSpike(parent: THREE.Object3D, palette: StrongholdPalette, x: number, z: number, height: number): void {
  cylinder(parent, 0.055, 0.085, height, 6, palette.darkTimber, x, height / 2 + 0.16, z);
  cone(parent, 0.095, 0.3, 6, palette.bone, x, height + 0.29, z);
}

function addWarBanner(
  parent: THREE.Object3D,
  palette: StrongholdPalette,
  x: number,
  baseY: number,
  z: number,
  height: number,
): void {
  cylinder(parent, 0.025, 0.045, height, 6, palette.darkTimber, x, baseY + height / 2, z);
  cone(parent, 0.07, 0.24, 5, palette.bone, x, baseY + height + 0.1, z);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, 0.58, -0.12, 0.035, 0, -0.48, 0,
    0.58, -0.12, 0.035, 0.44, -0.42, 0.025, 0, -0.48, 0,
  ], 3));
  geometry.computeVertexNormals();
  mesh(parent, geometry, palette.redHide, x, baseY + height - 0.08, z);
  box(parent, 0.075, 0.25, 0.025, palette.bone, x + 0.16, baseY + height - 0.31, z + 0.04).rotation.z = -0.55;
}

function addHorns(parent: THREE.Object3D, palette: StrongholdPalette, x: number, y: number, z: number, size: number): void {
  for (const side of [-1, 1]) {
    const horn = cone(parent, 0.13 * size, 0.9 * size, 7, palette.bone, x + side * 0.28 * size, y, z);
    horn.rotation.z = side * 0.78;
  }
}

function addTorch(parent: THREE.Object3D, palette: StrongholdPalette, x: number, z: number): void {
  cylinder(parent, 0.035, 0.05, 0.65, 6, palette.darkTimber, x, 0.5, z);
  const flame = cone(parent, 0.1, 0.32, 6, palette.ember, x, 0.96, z);
  flame.rotation.z = x * 0.08;
}

function createGoblinBarracks(parent: THREE.Group, palette: StrongholdPalette): void {
  const hall = new THREE.Group();
  hall.name = 'goblin-longhouse';
  parent.add(hall);
  addFoundation(hall, palette, 3.25, 2.95);
  box(hall, 2.35, 1.25, 1.85, palette.timber, 0, 0.84, -0.18);
  for (const x of [-1.04, -0.52, 0, 0.52, 1.04]) {
    box(hall, 0.075, 1.29, 1.9, palette.darkTimber, x, 0.86, -0.18);
  }
  gableRoof(hall, 2.8, 2.25, 0.8, palette.hide, 0, 1.47, -0.18);
  box(hall, 0.52, 0.92, 0.065, palette.shadow, 0, 0.68, 0.78);
  box(hall, 0.62, 0.1, 0.12, palette.bone, 0, 1.18, 0.82);
  for (const side of [-1, 1]) {
    const tusk = cone(hall, 0.1, 0.72, 6, palette.bone, side * 0.4, 1.55, 0.76);
    tusk.rotation.z = side * 0.62;
  }
  for (const [x, z] of [[-1.43, -1.12], [1.43, -1.12], [-1.43, 1.1], [1.43, 1.1]] as const) {
    addSpike(hall, palette, x, z, 1.25);
  }
  for (const side of [-1, 1]) {
    const stake = cylinder(hall, 0.045, 0.075, 1.25, 6, palette.darkTimber, side * 1.05, 0.65, 1.16);
    stake.rotation.z = side * 0.65;
    const point = cone(hall, 0.08, 0.32, 6, palette.iron, side * 1.43, 1.16, 1.16);
    point.rotation.z = side * 0.65;
  }
  const standard = new THREE.Group();
  standard.name = 'goblin-war-standard';
  standard.position.set(-0.72, 1.0, 0.85);
  hall.add(standard);
  cylinder(standard, 0.29, 0.29, 0.075, 10, palette.redHide).rotation.x = Math.PI / 2;
  box(standard, 0.08, 0.42, 0.085, palette.bone, 0, 0, 0.05).rotation.z = 0.65;
  box(standard, 0.08, 0.42, 0.085, palette.bone, 0, 0, 0.05).rotation.z = -0.65;
  addWarBanner(hall, palette, 0.75, 1.55, -0.2, 1.25);
  addTorch(hall, palette, -0.46, 0.97);
  addTorch(hall, palette, 0.46, 0.97);
}

function createWolfPen(parent: THREE.Group, palette: StrongholdPalette): void {
  const pen = new THREE.Group();
  pen.name = 'wolf-rider-enclosure';
  parent.add(pen);
  addFoundation(pen, palette, 3.45, 3.25);
  const fencePoints: Point[] = [];
  for (let index = 0; index < 14; index += 1) {
    const angle = index * Math.PI * 2 / 14;
    const x = Math.sin(angle) * 1.52;
    const z = Math.cos(angle) * 1.37;
    fencePoints.push([x, 0, z]);
    if (z > 1.15 && Math.abs(x) < 0.55) continue;
    addSpike(pen, palette, x, z, 0.68);
  }
  for (let index = 0; index < fencePoints.length; index += 1) {
    const start = fencePoints[index]!;
    const end = fencePoints[(index + 1) % fencePoints.length]!;
    if ((start[2] + end[2]) / 2 > 1.15 && Math.abs((start[0] + end[0]) / 2) < 0.75) continue;
    beam(pen, [start[0], 0.53, start[2]], [end[0], 0.53, end[2]], 0.035, palette.timber);
  }
  box(pen, 1.65, 0.85, 1.05, palette.timber, 0, 0.65, -0.72);
  gableRoof(pen, 1.95, 1.35, 0.65, palette.redHide, 0, 1.08, -0.72);
  box(pen, 0.72, 0.59, 0.055, palette.shadow, 0, 0.51, -0.17);
  for (const side of [-1, 1]) {
    beam(pen, [side * 0.65, 0.2, 0.82], [side * 0.65, 1.65, 0.82], 0.055, palette.darkTimber);
  }
  beam(pen, [-0.72, 1.56, 0.82], [0.72, 1.56, 0.82], 0.065, palette.darkTimber);
  const totem = new THREE.Group();
  totem.name = 'wolf-totem';
  totem.position.set(0, 1.7, 0.84);
  pen.add(totem);
  rock(totem, 0.31, palette.darkStone, 0, 0, 0, [1, 0.78, 0.62]);
  rock(totem, 0.18, palette.stone, 0, -0.09, 0.22, [0.8, 0.65, 1]);
  for (const side of [-1, 1]) {
    cone(totem, 0.12, 0.42, 5, palette.darkStone, side * 0.2, 0.31, -0.02).rotation.z = side * -0.2;
    rock(totem, 0.045, palette.ember, side * 0.11, 0.04, 0.2);
  }
  for (const [x, z, rotation] of [[-0.65, 0.38, 0.35], [0.65, 0.2, -0.45]] as const) {
    const bone = cylinder(pen, 0.055, 0.055, 0.55, 7, palette.bone, x, 0.27, z);
    bone.rotation.z = Math.PI / 2;
    bone.rotation.y = rotation;
  }
  addWarBanner(pen, palette, -1.12, 0.18, -0.65, 2.2);
}

function createOgreFort(parent: THREE.Group, palette: StrongholdPalette): void {
  const fort = new THREE.Group();
  fort.name = 'ogre-bastion';
  parent.add(fort);
  addFoundation(fort, palette, 3.5, 3.2);
  cylinder(fort, 1.25, 1.43, 2.05, 8, palette.darkStone, 0, 1.22, -0.12);
  cylinder(fort, 1.39, 1.39, 0.18, 8, palette.stone, 0, 2.29, -0.12);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    const x = Math.sin(angle) * 1.23;
    const z = Math.cos(angle) * 1.23 - 0.12;
    box(fort, 0.38, 0.45, 0.34, palette.stone, x, 2.56, z).rotation.y = angle;
  }
  box(fort, 0.78, 1.28, 0.09, palette.shadow, 0, 0.86, 1.15);
  for (const x of [-0.29, 0, 0.29]) box(fort, 0.065, 1.34, 0.08, palette.iron, x, 0.89, 1.22);
  for (const side of [-1, 1]) {
    cylinder(fort, 0.36, 0.46, 2.25, 7, palette.stone, side * 1.25, 1.33, -0.68);
    cone(fort, 0.54, 0.75, 7, palette.hide, side * 1.25, 2.82, -0.68);
    addSpike(fort, palette, side * 1.48, 0.85, 1.55);
  }
  const club = new THREE.Group();
  club.name = 'ogre-war-club';
  fort.add(club);
  beam(club, [-0.9, 0.25, 1.0], [0.48, 3.48, 0.86], 0.13, palette.darkTimber);
  const head = rock(club, 0.52, palette.stone, 0.55, 3.62, 0.85, [0.85, 1.25, 0.8]);
  head.rotation.z = -0.4;
  for (const [x, y] of [[0.19, 3.56], [0.79, 3.72], [0.47, 4.03]] as const) {
    cone(club, 0.085, 0.34, 5, palette.iron, x, y, 0.86).rotation.z = x - 0.5;
  }
  const skull = new THREE.Group();
  skull.name = 'ogre-gate-skull';
  skull.position.set(0, 1.9, 1.18);
  fort.add(skull);
  rock(skull, 0.31, palette.bone, 0, 0, 0, [1.05, 0.85, 0.55]);
  box(skull, 0.32, 0.18, 0.16, palette.bone, 0, -0.23, 0.06);
  for (const side of [-1, 1]) rock(skull, 0.075, palette.shadow, side * 0.12, 0.03, 0.17);
  addHorns(fort, palette, 0, 2.45, 1.0, 0.9);
  addWarBanner(fort, palette, -1.05, 2.25, -0.25, 1.55);
}

function createBehemothCliffs(parent: THREE.Group, palette: StrongholdPalette): void {
  const cliffs = new THREE.Group();
  cliffs.name = 'behemoth-cliff-den';
  parent.add(cliffs);
  addFoundation(cliffs, palette, 3.5, 3.25);
  rock(cliffs, 1.25, palette.darkStone, 0, 1.35, -0.47, [1.15, 1.15, 0.85]);
  rock(cliffs, 0.95, palette.stone, -0.92, 1.19, -0.05, [0.85, 1.2, 0.9]);
  rock(cliffs, 1.0, palette.stone, 0.9, 1.39, -0.16, [0.82, 1.35, 0.85]);
  rock(cliffs, 0.76, palette.darkStone, 0.05, 2.65, -0.65, [0.85, 1.65, 0.8]);
  const cave = mesh(cliffs, new THREE.CircleGeometry(0.72, 16), palette.shadow, 0, 0.94, 0.54);
  cave.scale.y = 1.16;
  const arch = mesh(cliffs, new THREE.TorusGeometry(0.78, 0.16, 6, 18, Math.PI), palette.stone, 0, 0.96, 0.59);
  arch.scale.y = 1.12;
  for (const side of [-1, 1]) {
    rock(cliffs, 0.27, palette.stone, side * 0.73, 0.51, 0.57, [0.85, 1.5, 0.8]);
    const tusk = cone(cliffs, 0.18, 1.75, 8, palette.bone, side * 1.15, 1.14, 0.84);
    tusk.rotation.z = side * 0.48;
  }
  for (let index = 0; index < 4; index += 1) {
    const rib = mesh(cliffs, new THREE.TorusGeometry(0.48 - index * 0.045, 0.055, 5, 12, Math.PI), palette.bone,
      -0.82 + index * 0.52, 0.46, 1.12);
    rib.rotation.z = index % 2 === 0 ? 0.12 : -0.12;
  }
  const skull = new THREE.Group();
  skull.name = 'behemoth-skull';
  skull.position.set(0, 3.6, -0.05);
  cliffs.add(skull);
  rock(skull, 0.52, palette.bone, 0, 0, 0, [1.2, 0.8, 0.75]);
  rock(skull, 0.29, palette.bone, 0, -0.29, 0.22, [1.1, 0.7, 0.85]);
  for (const side of [-1, 1]) {
    rock(skull, 0.1, palette.shadow, side * 0.22, 0.04, 0.36);
    const horn = cone(skull, 0.18, 1.65, 8, palette.bone, side * 0.65, 0.4, -0.03);
    horn.rotation.z = side * 0.83;
  }
  for (const x of [-0.24, 0, 0.24]) cone(skull, 0.075, 0.35, 6, palette.bone, x, -0.52, 0.3).rotation.z = Math.PI;
  addWarBanner(cliffs, palette, 1.25, 1.65, -0.65, 1.6);
}

const DWELLINGS: Readonly<Record<BuildingId, DwellingDefinition>> = {
  goblinBarracks: { creatureId: 'goblin', tier: 1, form: 'bastion', build: createGoblinBarracks },
  wolfPen: { creatureId: 'wolfRider', tier: 2, form: 'pen', build: createWolfPen },
  ogreFort: { creatureId: 'ogre', tier: 3, form: 'bastion', build: createOgreFort },
  behemothCliffs: { creatureId: 'behemoth', tier: 4, form: 'cavern', build: createBehemothCliffs },
};

function addConstructionSite(parent: THREE.Group, palette: StrongholdPalette, id: BuildingId): void {
  const site = new THREE.Group();
  site.name = 'construction-site';
  parent.add(site);
  addFoundation(site, palette);
  const definition = DWELLINGS[id];
  const ghostMaterial = new THREE.MeshStandardMaterial({
    color: 0xd7bd86,
    emissive: 0x4b3520,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    roughness: 0.8,
    wireframe: true,
  });
  const ghostHeight = 0.75 + definition.tier * 0.15;
  let ghost: THREE.Mesh;
  if (id === 'behemothCliffs') {
    ghost = rock(site, 0.9, ghostMaterial, 0, 0.24 + ghostHeight / 2, -0.15, [1, ghostHeight / 1.8, 0.8]);
  } else if (id === 'ogreFort') {
    ghost = cylinder(site, 1.0, 1.25, ghostHeight, 8, ghostMaterial, 0, 0.24 + ghostHeight / 2, -0.1);
  } else {
    ghost = box(site, id === 'wolfPen' ? 2.6 : 2.35, ghostHeight, 1.9, ghostMaterial, 0, 0.24 + ghostHeight / 2, -0.15);
  }
  ghost.name = `${id}-blueprint`;
  for (const [x, z] of [[-1.3, -1.12], [1.3, -1.12], [-1.3, 1.12], [1.3, 1.12]] as const) {
    cylinder(site, 0.04, 0.065, 1.2, 6, palette.timber, x, 0.82, z);
  }
  for (const z of [-1.12, 1.12]) {
    beam(site, [-1.3, 1.37, z], [1.3, 1.37, z], 0.04, palette.timber);
    beam(site, [-1.3, 0.35, z], [1.3, 1.28, z], 0.025, palette.darkTimber);
  }
  if (id === 'goblinBarracks') {
    box(site, 2.15, 0.55, 0.16, palette.timber, 0, 0.5, -0.75);
    for (const x of [-0.8, 0, 0.8]) addSpike(site, palette, x, 0.75, 0.42);
  } else if (id === 'wolfPen') {
    for (const x of [-1.05, -0.35, 0.35, 1.05]) addSpike(site, palette, x, -0.8, 0.48);
    box(site, 1.25, 0.12, 0.85, palette.timber, 0, 0.3, -0.4);
  } else if (id === 'ogreFort') {
    cylinder(site, 1.05, 1.2, 0.62, 8, palette.darkStone, 0, 0.53, -0.1);
    rock(site, 0.34, palette.stone, 0.85, 0.44, 0.75, [1.2, 0.7, 0.9]);
  } else {
    rock(site, 0.55, palette.darkStone, -0.4, 0.64, -0.25, [1.2, 0.85, 1]);
    rock(site, 0.4, palette.stone, 0.45, 0.48, 0.1, [1, 0.8, 1]);
    beam(site, [-0.8, 0.25, -0.6], [-0.8, 1.85, -0.6], 0.065, palette.darkTimber);
    beam(site, [-0.8, 1.8, -0.6], [0.55, 1.8, -0.6], 0.055, palette.darkTimber);
  }
  for (const [x, z, rotation] of [[-0.72, 1.3, 0.15], [0, 1.28, -0.1], [0.72, 1.22, 0.2]] as const) {
    box(site, 0.62, 0.1, 0.19, palette.timber, x, 0.28, z).rotation.y = rotation;
  }
}

export function createBuildingModel(buildingId: string, built: boolean): THREE.Group | null {
  if (!Object.hasOwn(DWELLINGS, buildingId)) return null;
  const id = buildingId as BuildingId;
  const definition = DWELLINGS[id];
  const model = new THREE.Group();
  model.name = id;
  model.userData = {
    faction: 'stronghold',
    buildingId: id,
    creatureId: definition.creatureId,
    tier: definition.tier,
    form: definition.form,
    built,
    constructionState: built ? 'complete' : 'underConstruction',
    modelPack: 'stronghold',
  };
  const palette = createPalette();
  if (built) definition.build(model, palette);
  else addConstructionSite(model, palette, id);
  return model;
}

export default { faction: 'Stronghold', createBuildingModel } as const;
