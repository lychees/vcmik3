import * as THREE from 'three';

type Vec3 = [number, number, number];

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness: 0.82, flatShading: true, ...extra });
  result.userData.baseColor = color;
  return result;
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: Vec3,
  scale: Vec3 = [1, 1, 1],
  rotation: Vec3 = [0, 0, 0],
  name?: string,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(...position);
  result.scale.set(...scale);
  result.rotation.set(...rotation);
  result.castShadow = true;
  result.receiveShadow = true;
  if (name) result.name = name;
  parent.add(result);
  return result;
}

function box(parent: THREE.Object3D, size: Vec3, surface: THREE.Material, position: Vec3, name?: string): THREE.Mesh {
  return addMesh(parent, new THREE.BoxGeometry(...size), surface, position, [1, 1, 1], [0, 0, 0], name);
}

function cylinder(
  parent: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  surface: THREE.Material,
  position: Vec3,
  segments = 8,
  name?: string,
): THREE.Mesh {
  return addMesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, position, [1, 1, 1], [0, 0, 0], name);
}

function cone(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  surface: THREE.Material,
  position: Vec3,
  segments = 8,
  name?: string,
): THREE.Mesh {
  return addMesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, position, [1, 1, 1], [0, 0, 0], name);
}

function addBookHalf(
  parent: THREE.Object3D,
  name: string,
  position: Vec3,
  angle: number,
  cover: THREE.Material,
  pages: THREE.Material,
  ink: THREE.Material,
): THREE.Group {
  const book = new THREE.Group();
  book.name = name;
  book.position.set(...position);
  book.rotation.z = angle;
  parent.add(book);
  box(book, [0.61, 0.055, 0.88], cover, [0, 0, 0], `${name}-cover`);
  box(book, [0.565, 0.075, 0.825], pages, [0, 0.058, 0], `${name}-pages`);
  for (const z of [-0.27, -0.13, 0.01, 0.15, 0.29]) {
    box(book, [0.39, 0.009, 0.014], ink, [0, 0.1, z], `${name}-script`);
  }
  return book;
}

function addSpire(
  parent: THREE.Group,
  name: string,
  x: number,
  z: number,
  height: number,
  radius: number,
  stone: THREE.Material,
  roof: THREE.Material,
  glow: THREE.Material,
): THREE.Group {
  const spire = new THREE.Group();
  spire.name = name;
  spire.userData.architecture = 'spire';
  parent.add(spire);
  cylinder(spire, radius * 0.82, radius, height, stone, [x, 0.12 + height / 2, z], 8, `${name}-tower`);
  cylinder(spire, radius * 1.16, radius * 1.16, 0.075, roof, [x, 0.15 + height, z], 8, `${name}-cornice`);
  cone(spire, radius * 1.42, 0.4, roof, [x, 0.37 + height, z], 8, `${name}-roof`);
  addMesh(spire, new THREE.OctahedronGeometry(radius * 0.43, 0), glow, [x, 0.61 + height, z], [1, 1.45, 1], [0, 0, 0], `${name}-crystal`);
  return spire;
}

export function createArcaneLibraryModel(): THREE.Group {
  const group = new THREE.Group();
  const stone = material(0x8994a3);
  const paleStone = material(0xb9c1c5);
  const darkStone = material(0x4b5365);
  const roof = material(0x4c4778, { roughness: 0.68 });
  const gold = material(0xd2b768, { metalness: 0.38, roughness: 0.48 });
  const pages = material(0xe5d9b5);
  const ink = material(0x76638e);
  const door = material(0x302d43);
  const glow = material(0x83d8df, { emissive: 0x4c9fc4, emissiveIntensity: 0.75, roughness: 0.35 });
  const violetGlow = material(0xb89ae5, { emissive: 0x7250a6, emissiveIntensity: 0.65, roughness: 0.4 });

  cylinder(group, 0.76, 0.82, 0.12, darkStone, [0, 0.06, 0], 10, 'arcane-library-foundation');
  cylinder(group, 0.7, 0.75, 0.075, paleStone, [0, 0.135, 0], 10, 'arcane-library-plinth');
  box(group, [0.9, 0.74, 0.72], stone, [0, 0.49, 0], 'arcane-library-hall');
  box(group, [0.94, 0.09, 0.76], darkStone, [0, 0.22, 0], 'arcane-library-lower-course');
  box(group, [0.96, 0.075, 0.77], paleStone, [0, 0.85, 0], 'arcane-library-entablature');

  box(group, [0.42, 0.12, 0.18], paleStone, [0, 0.06, 0.43], 'arcane-library-step-top');
  box(group, [0.54, 0.08, 0.16], stone, [0, 0.04, 0.57], 'arcane-library-step-middle');
  box(group, [0.66, 0.04, 0.14], darkStone, [0, 0.02, 0.69], 'arcane-library-step-bottom');
  box(group, [0.23, 0.42, 0.04], door, [0, 0.34, 0.38], 'arcane-library-door');
  addMesh(group, new THREE.TorusGeometry(0.13, 0.026, 5, 12, Math.PI), gold, [0, 0.54, 0.405], [1, 1, 1], [0, 0, 0], 'arcane-library-door-arch');
  box(group, [0.035, 0.32, 0.045], gold, [-0.13, 0.36, 0.405]);
  box(group, [0.035, 0.32, 0.045], gold, [0.13, 0.36, 0.405]);
  addMesh(group, new THREE.OctahedronGeometry(0.025, 0), glow, [0.065, 0.34, 0.413], [1, 1, 1], [0, 0, 0], 'arcane-library-door-rune');

  for (const side of [-1, 1]) {
    cylinder(group, 0.047, 0.057, 0.57, paleStone, [side * 0.32, 0.48, 0.4], 8, `arcane-library-column-${side}`);
    cylinder(group, 0.072, 0.072, 0.055, gold, [side * 0.32, 0.19, 0.4], 8);
    cylinder(group, 0.07, 0.055, 0.065, gold, [side * 0.32, 0.79, 0.4], 8);
    box(group, [0.09, 0.19, 0.025], glow, [side * 0.22, 0.65, 0.373], `arcane-library-window-${side}`);
    box(group, [0.028, 0.21, 0.035], gold, [side * 0.22, 0.65, 0.389]);
  }

  addBookHalf(group, 'arcane-library-open-book-left', [-0.275, 1.055, 0], 0.32, roof, pages, ink);
  addBookHalf(group, 'arcane-library-open-book-right', [0.275, 1.055, 0], -0.32, roof, pages, ink);
  cylinder(group, 0.045, 0.045, 0.94, gold, [0, 1.15, 0], 8, 'arcane-library-book-spine').rotation.x = Math.PI / 2;
  for (const z of [-0.45, 0.45]) {
    addMesh(group, new THREE.OctahedronGeometry(0.055, 0), violetGlow, [0, 1.15, z], [1, 1, 1], [0, 0, 0], 'arcane-library-bookmark');
  }

  addSpire(group, 'arcane-library-spire-front-left', -0.51, 0.29, 0.72, 0.105, stone, roof, glow);
  addSpire(group, 'arcane-library-spire-front-right', 0.51, 0.29, 0.83, 0.105, stone, roof, glow);
  addSpire(group, 'arcane-library-spire-back-left', -0.51, -0.29, 0.91, 0.11, stone, roof, violetGlow);
  addSpire(group, 'arcane-library-spire-back-right', 0.51, -0.29, 0.76, 0.105, stone, roof, glow);
  addSpire(group, 'arcane-library-spire-astral', 0, -0.24, 1.34, 0.125, paleStone, roof, violetGlow);

  const grimoire = new THREE.Group();
  grimoire.name = 'arcane-library-floating-grimoire';
  grimoire.userData.detail = 'floating-book';
  grimoire.position.set(0, 1.43, 0.48);
  grimoire.rotation.x = -0.18;
  grimoire.scale.setScalar(0.42);
  group.add(grimoire);
  addBookHalf(grimoire, 'grimoire-left', [-0.27, 0, 0], 0.28, roof, pages, ink);
  addBookHalf(grimoire, 'grimoire-right', [0.27, 0, 0], -0.28, roof, pages, ink);
  cylinder(grimoire, 0.04, 0.04, 0.9, gold, [0, 0.08, 0], 8).rotation.x = Math.PI / 2;

  const halo = addMesh(group, new THREE.TorusGeometry(0.21, 0.018, 5, 20), glow, [0, 2.02, -0.24], [1, 1, 1], [0.72, 0.25, 0], 'arcane-library-astral-halo');
  halo.userData.detail = 'arcane-orbit';
  addMesh(group, new THREE.IcosahedronGeometry(0.085, 0), violetGlow, [0, 2.02, -0.24], [1, 1.25, 1], [0, 0, 0], 'arcane-library-astral-orb');

  const runePositions: Vec3[] = [[-0.64, 0.25, 0.36], [0.64, 0.25, 0.36], [-0.61, 0.25, -0.42], [0.61, 0.25, -0.42]];
  for (let index = 0; index < runePositions.length; index += 1) {
    addMesh(group, new THREE.OctahedronGeometry(0.075, 0), index % 2 === 0 ? glow : violetGlow, runePositions[index]!, [0.7, 1.65, 0.7], [0, index * 0.4, 0], `arcane-library-rune-${index + 1}`);
  }

  group.name = 'arcane-library';
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.userData.landmarkId = 'arcaneLibrary';
  group.userData.kind = 'landmark';
  group.userData.archetype = 'open-book-arcane-library';
  group.userData.animationPivot = 'ground';
  group.userData.visualHeight = size.y;
  group.userData.labelHeight = bounds.max.y + 0.45;
  group.userData.footprint = [size.x, size.z];
  group.userData.palette = [0x8994a3, 0x4c4778, 0x83d8df];
  group.userData.raycastable = true;
  return group;
}
