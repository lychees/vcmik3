import * as THREE from 'three';
import type { BattleSideId } from '../types';

type DesertCreatureId = 'mummy' | 'sandWyrm';

function material(
  color: number,
  extra: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.86, flatShading: true, ...extra });
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function detail(mesh: THREE.Mesh, name: string, kind: string): THREE.Mesh {
  mesh.name = name;
  mesh.userData.detail = kind;
  return mesh;
}

function addMummy(parent: THREE.Group): void {
  const linen = material(0xbfae83);
  const paleLinen = material(0xd8cba7);
  const oldLinen = material(0x96835f);
  const skin = material(0x625a45);
  const shadow = material(0x2d3029);
  const gold = material(0xb8964f, { roughness: 0.55, metalness: 0.35 });
  const eye = material(0x83d7bd, { emissive: 0x3f9f85, emissiveIntensity: 1.1 });

  addMesh(parent, new THREE.CylinderGeometry(0.2, 0.27, 0.72, 7), skin, [0, 0.98, 0]);
  const torsoBands = [
    [0.7, 0.265], [0.83, 0.25], [0.96, 0.235], [1.09, 0.22], [1.22, 0.21],
  ] as const;
  for (const [index, [y, radius]] of torsoBands.entries()) {
    const band = addMesh(parent, new THREE.CylinderGeometry(radius, radius + 0.008, 0.078, 7),
      index % 2 === 0 ? paleLinen : linen, [0, y, 0], [1, 1, 1], [0, index * 0.09, 0]);
    detail(band, `mummy-torso-bandage-${index}`, 'bandage');
  }
  addMesh(parent, new THREE.CylinderGeometry(0.23, 0.29, 0.3, 7), oldLinen, [0, 0.56, 0]);
  for (const [index, y] of [0.47, 0.59].entries()) {
    detail(addMesh(parent, new THREE.CylinderGeometry(0.285 - index * 0.025, 0.29 - index * 0.025, 0.065, 7),
      linen, [0, y, 0]), `mummy-skirt-bandage-${index}`, 'bandage');
  }

  addMesh(parent, new THREE.DodecahedronGeometry(0.23, 0), skin, [0.035, 1.51, 0], [0.9, 1.1, 0.9]);
  for (const [index, y] of [1.39, 1.51, 1.63].entries()) {
    const band = addMesh(parent, new THREE.CylinderGeometry(0.213, 0.218, 0.07, 7),
      index === 1 ? paleLinen : linen, [0.025, y, 0], [1, 1, 1], [0, index * 0.12, 0]);
    detail(band, `mummy-head-bandage-${index}`, 'bandage');
  }
  for (const side of [-1, 1]) {
    const flap = addMesh(parent, new THREE.BoxGeometry(0.2, 0.48, 0.095), oldLinen,
      [-0.075, 1.43, side * 0.215], [1, 1, 1], [side * 0.08, 0, -0.08]);
    detail(flap, `mummy-nemes-flap-${side}`, 'headdress');
    for (const [index, y] of [1.31, 1.44, 1.57].entries()) {
      detail(addMesh(parent, new THREE.BoxGeometry(0.21, 0.035, 0.105), paleLinen,
        [-0.068, y, side * 0.218]), `mummy-nemes-bandage-${side}-${index}`, 'bandage');
    }
  }
  addMesh(parent, new THREE.BoxGeometry(0.36, 0.09, 0.47), linen, [-0.025, 1.72, 0]);
  addMesh(parent, new THREE.BoxGeometry(0.035, 0.055, 0.4), gold, [0.225, 1.61, 0]);
  addMesh(parent, new THREE.BoxGeometry(0.025, 0.035, 0.17), shadow, [0.245, 1.4, 0]);
  const eyeGeometry = new THREE.SphereGeometry(0.035, 6, 4);
  for (const side of [-1, 1]) {
    const eyeMesh = addMesh(parent, eyeGeometry, eye, [0.245, 1.53, side * 0.084]);
    eyeMesh.name = side < 0 ? 'mummy-eye-right' : 'mummy-eye-left';
  }

  for (const side of [-1, 1]) {
    const z = side * 0.31;
    addMesh(parent, new THREE.CylinderGeometry(0.06, 0.075, 0.65, 6), skin,
      [0.32, 1.18, z], [1, 1, 1], [0, 0, -Math.PI / 2]);
    for (const [index, x] of [0.1, 0.31, 0.52].entries()) {
      detail(addMesh(parent, new THREE.CylinderGeometry(0.075, 0.077, 0.075, 6),
        index === 1 ? paleLinen : linen, [x, 1.18, z], [1, 1, 1], [0, 0, -Math.PI / 2]),
      `mummy-arm-bandage-${side}-${index}`, 'bandage');
    }
    addMesh(parent, new THREE.DodecahedronGeometry(0.09, 0), skin, [0.69, 1.17, z], [1.25, 0.75, 0.85]);
    detail(addMesh(parent, new THREE.BoxGeometry(0.045, 0.38, 0.075), paleLinen,
      [0.4, 0.96, z + side * 0.025], [1, 1, 1], [0, 0, side * 0.12]),
    `mummy-loose-bandage-${side}`, 'bandage');
  }

  for (const side of [-1, 1]) {
    const x = side < 0 ? -0.07 : 0.035;
    const z = side * 0.14;
    addMesh(parent, new THREE.CylinderGeometry(0.075, 0.095, 0.55, 6), skin, [x, 0.32, z]);
    for (const [index, y] of [0.18, 0.32, 0.46].entries()) {
      detail(addMesh(parent, new THREE.CylinderGeometry(0.09, 0.095, 0.07, 6),
        index === 1 ? paleLinen : linen, [x, y, z]), `mummy-leg-bandage-${side}-${index}`, 'bandage');
    }
    addMesh(parent, new THREE.BoxGeometry(0.26, 0.1, 0.17), oldLinen, [x + 0.075, 0.05, z]);
  }
}

function addSandWyrm(parent: THREE.Group): void {
  const hide = material(0xa8783f);
  const plate = material(0xc49a59);
  const belly = material(0xd0b477);
  const dark = material(0x3c2b24);
  const spine = material(0x7d4932);
  const tooth = material(0xe3d7b0);
  const eye = material(0xf0b94f, { emissive: 0xa64d13, emissiveIntensity: 0.9 });

  const segments = [
    [-0.75, 0.25, 0.07, 0.2],
    [-0.47, 0.34, -0.055, 0.25],
    [-0.17, 0.43, 0.035, 0.29],
    [0.12, 0.53, -0.025, 0.31],
    [0.36, 0.66, 0, 0.32],
  ] as const;
  for (const [index, [x, y, z, radius]] of segments.entries()) {
    const segment = addMesh(parent, new THREE.DodecahedronGeometry(radius, 0), hide,
      [x, y, z], [1.25, 0.82, 1]);
    segment.name = `sand-wyrm-segment-${index}`;
    segment.userData.anatomy = 'bodySegment';
    addMesh(parent, new THREE.BoxGeometry(radius * 1.2, 0.055, radius * 1.25), belly,
      [x + 0.035, y - radius * 0.58, z]);
    for (const side of [-1, 1]) {
      addMesh(parent, new THREE.ConeGeometry(0.052 + index * 0.005, 0.24 + index * 0.025, 5), spine,
        [x - 0.025, y + radius * 0.77, z + side * radius * 0.32], [1, 1, 1], [side * 0.18, 0, -0.12]);
    }
    addMesh(parent, new THREE.BoxGeometry(radius * 1.3, 0.065, radius * 1.4), plate,
      [x, y + radius * 0.61, z], [1, 1, 1], [0, 0, -0.08]);
  }

  addMesh(parent, new THREE.ConeGeometry(0.15, 0.65, 6), hide,
    [-1.03, 0.25, 0.08], [1, 1, 1], [0, 0, Math.PI / 2]);
  addMesh(parent, new THREE.ConeGeometry(0.07, 0.32, 5), spine,
    [-1.22, 0.34, 0.08], [1, 1, 1], [0, 0, Math.PI / 2]);

  const head = addMesh(parent, new THREE.DodecahedronGeometry(0.35, 0), hide,
    [0.66, 0.98, 0], [1.25, 0.85, 1.05]);
  head.name = 'sand-wyrm-head';
  addMesh(parent, new THREE.BoxGeometry(0.42, 0.2, 0.45), plate, [0.96, 0.88, 0]);
  addMesh(parent, new THREE.BoxGeometry(0.38, 0.075, 0.37), dark, [1.0, 0.745, 0]);
  const jaw = addMesh(parent, new THREE.BoxGeometry(0.43, 0.105, 0.42), belly,
    [0.98, 0.655, 0], [1, 1, 1], [0, 0, -0.12]);
  jaw.name = 'sand-wyrm-jaw';
  for (const side of [-1, 1]) {
    addMesh(parent, new THREE.BoxGeometry(0.28, 0.19, 0.075), plate,
      [0.68, 0.86, side * 0.28], [1, 1, 1], [side * 0.2, 0, -0.15]);
    addMesh(parent, new THREE.ConeGeometry(0.07, 0.36, 5), spine,
      [0.48, 1.29, side * 0.2], [1, 1, 1], [side * 0.25, 0, -0.35]);
    const eyeMesh = addMesh(parent, new THREE.SphereGeometry(0.042, 6, 4), eye,
      [0.8, 1.09, side * 0.205]);
    eyeMesh.name = side < 0 ? 'sand-wyrm-eye-right' : 'sand-wyrm-eye-left';
  }
  for (const x of [0.88, 1.1]) {
    for (const side of [-1, 1]) {
      detail(addMesh(parent, new THREE.ConeGeometry(0.035, 0.17, 5), tooth,
        [x, 0.78, side * 0.13], [1, 1, 1], [0, 0, Math.PI]), 'sand-wyrm-upper-tooth', 'tooth');
      detail(addMesh(parent, new THREE.ConeGeometry(0.03, 0.13, 5), tooth,
        [x + 0.015, 0.69, side * 0.13]), 'sand-wyrm-lower-tooth', 'tooth');
    }
  }
}

const BUILDERS: Readonly<Record<DesertCreatureId, (parent: THREE.Group) => void>> = Object.freeze({
  mummy: addMummy,
  sandWyrm: addSandWyrm,
});

const ARCHETYPES: Readonly<Record<DesertCreatureId, string>> = Object.freeze({
  mummy: 'bandaged-undead',
  sandWyrm: 'segmented-desert-wyrm',
});

const PALETTES: Readonly<Record<DesertCreatureId, readonly [number, number, number]>> = Object.freeze({
  mummy: [0xbfae83, 0x83d7bd, 0x625a45],
  sandWyrm: [0xa8783f, 0xf0b94f, 0x3c2b24],
});

export function createDesertMonsterModel(creatureId: string, side: BattleSideId): THREE.Group | null {
  if (!Object.hasOwn(BUILDERS, creatureId)) return null;
  const id = creatureId as DesertCreatureId;
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = id === 'mummy' ? 'mummy-form' : 'sand-wyrm-form';
  BUILDERS[id](body);
  group.add(body);

  const ungroundedBounds = new THREE.Box3().setFromObject(body);
  body.position.y -= ungroundedBounds.min.y;
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  const palette = PALETTES[id];

  group.name = `creature-${id}`;
  group.rotation.y = side === 'attacker' ? 0 : Math.PI;
  group.userData.creatureId = id;
  group.userData.faction = 'Neutral';
  group.userData.archetype = ARCHETYPES[id];
  group.userData.animationPivot = 'ground';
  group.userData.side = side;
  group.userData.visualHeight = size.y;
  group.userData.labelHeight = Math.max(1.85, bounds.max.y + 0.45);
  group.userData.palette = [...palette];
  group.userData.factionColor = palette[0];
  return group;
}
