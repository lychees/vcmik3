import * as THREE from 'three';
import { createHotaCreature, HOTA_CREATURE_FACTIONS } from './hotaCreatures';
import type { BattleSideId } from './types';

const PALETTES: Record<string, { body: number; accent: number; dark: number }> = {
  militia: { body: 0x8b969b, accent: 0xc6b37a, dark: 0x3d4a50 },
  archer: { body: 0x527a55, accent: 0xd5c39a, dark: 0x2d3e31 },
  griffin: { body: 0xc8994f, accent: 0xf0e2b6, dark: 0x62472e },
  cavalier: { body: 0xd4c9a9, accent: 0xb58a38, dark: 0x4b3428 },
  sprite: { body: 0x75c9c4, accent: 0xe5a7d7, dark: 0x355f6c },
  ranger: { body: 0x446f4a, accent: 0x9fc675, dark: 0x293e32 },
  unicorn: { body: 0xe2e2d7, accent: 0xa6d7e7, dark: 0x626273 },
  dragon: { body: 0x477a4c, accent: 0xa9c65b, dark: 0x263f32 },
  imp: { body: 0xa83f32, accent: 0xffa43b, dark: 0x3e2028 },
  hellhound: { body: 0x4b3030, accent: 0xf07832, dark: 0x211c24 },
  ifrit: { body: 0xc65a2d, accent: 0xffcf57, dark: 0x65252a },
  pitFiend: { body: 0x762e35, accent: 0xe06a37, dark: 0x271d29 },
  lizardman: { body: 0x66845a, accent: 0xa8bc68, dark: 0x2c4440 },
  gorgon: { body: 0x52645a, accent: 0xa49562, dark: 0x293b38 },
  wyvern: { body: 0x397365, accent: 0x86b89b, dark: 0x203d3c },
  basilisk: { body: 0x47765d, accent: 0xb5cb58, dark: 0x263c35 },
};

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.82, ...extra });
}

function addMesh(
  group: THREE.Group,
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
  group.add(mesh);
  return mesh;
}

function addHumanoid(group: THREE.Group, creatureId: string): void {
  const palette = PALETTES[creatureId] ?? PALETTES.militia!;
  const body = material(palette.body);
  const accent = material(palette.accent);
  const dark = material(palette.dark);
  const skin = material(0xd2aa82);
  addMesh(group, new THREE.CylinderGeometry(0.2, 0.31, 0.65, 5), body, [0, 0.66, 0]);
  addMesh(group, new THREE.DodecahedronGeometry(0.19, 0), skin, [0, 1.14, 0]);
  addMesh(group, new THREE.ConeGeometry(0.23, 0.28, 5), creatureId === 'militia' ? accent : body, [0, 1.35, 0]);
  addMesh(group, new THREE.CylinderGeometry(0.065, 0.075, 0.48, 5), dark, [-0.13, 0.25, 0]);
  addMesh(group, new THREE.CylinderGeometry(0.065, 0.075, 0.48, 5), dark, [0.13, 0.25, 0]);
  if (creatureId === 'militia') {
    addMesh(group, new THREE.CylinderGeometry(0.025, 0.025, 1.65, 5), dark, [0.08, 0.85, -0.34], [1, 1, 1], [0.2, 0, -0.2]);
    addMesh(group, new THREE.ConeGeometry(0.09, 0.28, 4), accent, [0.25, 1.65, -0.34], [1, 1, 1], [0, 0, -0.2]);
    addMesh(group, new THREE.CylinderGeometry(0.3, 0.3, 0.07, 8), accent, [0, 0.72, 0.34], [1, 1.25, 1], [Math.PI / 2, 0, 0]);
  } else {
    addMesh(group, new THREE.TorusGeometry(0.34, 0.025, 4, 10, Math.PI * 1.35), accent, [0.06, 0.85, -0.34], [1, 1, 1], [0, Math.PI / 2, -0.6]);
    addMesh(group, new THREE.CylinderGeometry(0.018, 0.018, 0.85, 4), dark, [0.06, 0.85, -0.34], [1, 1, 1], [0, 0, -0.45]);
    if (creatureId === 'ranger') {
      addMesh(group, new THREE.ConeGeometry(0.37, 0.85, 5, 1, true), body, [0, 0.67, 0.16], [1, 1, 0.65], [0.15, 0, 0]);
      addMesh(group, new THREE.ConeGeometry(0.23, 0.34, 5), dark, [0, 1.28, 0]);
    }
  }
}

function addHorse(group: THREE.Group, creatureId: 'cavalier' | 'unicorn'): void {
  const palette = PALETTES[creatureId]!;
  const body = material(palette.body);
  const accent = material(palette.accent, creatureId === 'unicorn' ? { metalness: 0.25 } : {});
  const dark = material(palette.dark);
  addMesh(group, new THREE.DodecahedronGeometry(0.45, 0), body, [0, 0.62, 0], [1.45, 0.75, 0.75]);
  addMesh(group, new THREE.DodecahedronGeometry(0.24, 0), body, [0.58, 0.97, 0], [0.85, 1.25, 0.75], [0, 0, -0.25]);
  for (const x of [-0.38, 0.38]) {
    for (const z of [-0.2, 0.2]) {
      addMesh(group, new THREE.CylinderGeometry(0.055, 0.075, 0.55, 5), dark, [x, 0.28, z]);
    }
  }
  addMesh(group, new THREE.ConeGeometry(0.09, 0.65, 5), dark, [-0.72, 0.61, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
  if (creatureId === 'unicorn') {
    addMesh(group, new THREE.ConeGeometry(0.055, 0.58, 6), accent, [0.73, 1.43, 0], [1, 1, 1], [0, 0, -0.35]);
    addMesh(group, new THREE.ConeGeometry(0.12, 0.7, 5), accent, [-0.1, 0.96, 0.25], [1, 1, 1], [0.4, 0, -0.2]);
  } else {
    addMesh(group, new THREE.CylinderGeometry(0.16, 0.22, 0.48, 5), material(0x8f999f), [-0.05, 1.18, 0]);
    addMesh(group, new THREE.DodecahedronGeometry(0.16, 0), material(0xd2aa82), [-0.05, 1.55, 0]);
    addMesh(group, new THREE.CylinderGeometry(0.025, 0.025, 1.65, 5), dark, [0.38, 1.35, -0.16], [1, 1, 1], [0, 0, -1.1]);
    addMesh(group, new THREE.ConeGeometry(0.075, 0.25, 5), accent, [1.16, 1.65, -0.16], [1, 1, 1], [0, 0, -1.1]);
  }
}

function addWing(group: THREE.Group, color: number, z: number, size = 1): void {
  const geometry = new THREE.BufferGeometry();
  const side = Math.sign(z);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.15, 0.9, z,
    -0.65 * size, 1.45 * size, z + side * 0.9 * size,
    0.45 * size, 1.0, z + side * 0.65 * size,
    -0.15, 0.9, z,
    0.45 * size, 1.0, z + side * 0.65 * size,
    0.65 * size, 0.65, z + side * 0.25,
  ], 3));
  geometry.computeVertexNormals();
  addMesh(group, geometry, material(color, { side: THREE.DoubleSide }), [0, 0, 0]);
}

function addGriffin(group: THREE.Group): void {
  const palette = PALETTES.griffin!;
  const body = material(palette.body);
  const accent = material(palette.accent);
  addMesh(group, new THREE.DodecahedronGeometry(0.43, 0), body, [0, 0.65, 0], [1.25, 0.85, 0.8]);
  addMesh(group, new THREE.DodecahedronGeometry(0.28, 0), accent, [0.48, 1.03, 0]);
  addMesh(group, new THREE.ConeGeometry(0.13, 0.38, 4), material(0xd9a43c), [0.77, 1.01, 0], [1, 1, 1], [0, 0, -Math.PI / 2]);
  addWing(group, palette.accent, 0.16, 0.85);
  addWing(group, palette.accent, -0.16, 0.85);
  for (const z of [-0.2, 0.2]) {
    addMesh(group, new THREE.CylinderGeometry(0.06, 0.075, 0.5, 5), body, [0.25, 0.28, z]);
  }
  addMesh(group, new THREE.ConeGeometry(0.08, 0.65, 5), body, [-0.65, 0.7, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
}

function addDragon(group: THREE.Group): void {
  const palette = PALETTES.dragon!;
  const body = material(palette.body);
  const accent = material(palette.accent);
  addMesh(group, new THREE.IcosahedronGeometry(0.52, 0), body, [-0.1, 0.72, 0], [1.35, 0.9, 0.9]);
  addMesh(group, new THREE.CylinderGeometry(0.18, 0.29, 0.85, 6), body, [0.43, 1.08, 0], [1, 1, 1], [0, 0, -0.65]);
  addMesh(group, new THREE.DodecahedronGeometry(0.3, 0), body, [0.78, 1.45, 0], [1.25, 0.75, 0.85]);
  addMesh(group, new THREE.ConeGeometry(0.07, 0.4, 5), accent, [0.68, 1.82, 0.15], [1, 1, 1], [0.2, 0, -0.3]);
  addMesh(group, new THREE.ConeGeometry(0.07, 0.4, 5), accent, [0.68, 1.82, -0.15], [1, 1, 1], [-0.2, 0, -0.3]);
  addWing(group, palette.dark, 0.22, 1.35);
  addWing(group, palette.dark, -0.22, 1.35);
  addMesh(group, new THREE.ConeGeometry(0.18, 1.45, 6), body, [-0.95, 0.65, 0], [1, 1, 1], [0, 0, Math.PI / 2]);
  for (const x of [-0.35, 0.3]) {
    for (const z of [-0.28, 0.28]) {
      addMesh(group, new THREE.CylinderGeometry(0.09, 0.12, 0.5, 5), body, [x, 0.3, z]);
    }
  }
}

function addSprite(group: THREE.Group): void {
  const palette = PALETTES.sprite!;
  addMesh(group, new THREE.IcosahedronGeometry(0.27, 1), material(palette.body, { emissive: 0x193f42 }), [0, 0.82, 0], [0.75, 1.25, 0.75]);
  addMesh(group, new THREE.DodecahedronGeometry(0.16, 0), material(0xe2b6a5), [0, 1.2, 0]);
  addWing(group, palette.accent, 0.08, 0.55);
  addWing(group, palette.accent, -0.08, 0.55);
  addMesh(group, new THREE.ConeGeometry(0.12, 0.48, 5), material(palette.dark), [0, 0.4, 0]);
}

function addEyes(group: THREE.Group, color: number, x: number, y: number, z: number, radius = 0.035): void {
  const geometry = new THREE.SphereGeometry(radius, 5, 4);
  const surface = material(color, { emissive: color, emissiveIntensity: 0.85 });
  addMesh(group, geometry, surface, [x, y, z]);
  addMesh(group, geometry, surface, [x, y, -z]);
}

function addImp(group: THREE.Group): void {
  const palette = PALETTES.imp!;
  const body = material(palette.body);
  const accent = material(palette.accent, { emissive: 0x6b260c });
  const dark = material(palette.dark);
  addMesh(group, new THREE.DodecahedronGeometry(0.3, 0), body, [-0.08, 0.7, 0], [0.85, 1.2, 0.8], [0, 0, -0.18]);
  addMesh(group, new THREE.DodecahedronGeometry(0.24, 0), body, [0.06, 1.15, 0], [1.05, 0.9, 0.95]);
  addMesh(group, new THREE.ConeGeometry(0.1, 0.28, 5), dark, [0.3, 1.1, 0], [1, 1, 1], [0, 0, -Math.PI / 2]);
  addEyes(group, palette.accent, 0.235, 1.2, 0.1, 0.032);
  for (const side of [-1, 1]) {
    addMesh(group, new THREE.ConeGeometry(0.085, 0.4, 5), body, [0.01, 1.19, side * 0.29], [1, 1, 1], [side * Math.PI / 2, 0, 0]);
    addMesh(group, new THREE.ConeGeometry(0.065, 0.34, 5), dark, [-0.03, 1.43, side * 0.12], [1, 1, 1], [side * 0.2, 0, -0.25]);
    addMesh(group, new THREE.CylinderGeometry(0.045, 0.065, 0.52, 5), body, [0.08, 0.72, side * 0.27], [1, 1, 1], [side * 0.3, 0, -0.5]);
    addMesh(group, new THREE.CylinderGeometry(0.05, 0.075, 0.5, 5), dark, [-0.05, 0.28, side * 0.14], [1, 1, 1], [side * 0.12, 0, 0.18]);
    addMesh(group, new THREE.BoxGeometry(0.18, 0.08, 0.11), dark, [0.06, 0.055, side * 0.16]);
  }
  addMesh(group, new THREE.ConeGeometry(0.065, 0.75, 6), body, [-0.43, 0.59, 0], [1, 1, 1], [0, 0, Math.PI / 2 + 0.25]);
  addMesh(group, new THREE.OctahedronGeometry(0.1, 0), accent, [0.32, 0.61, 0.34]);
}

function addHellhound(group: THREE.Group): void {
  const palette = PALETTES.hellhound!;
  const body = material(palette.body);
  const ember = material(palette.accent, { emissive: 0x7a210d });
  const dark = material(palette.dark);
  addMesh(group, new THREE.DodecahedronGeometry(0.43, 0), body, [-0.12, 0.65, 0], [1.4, 0.72, 0.75]);
  addMesh(group, new THREE.DodecahedronGeometry(0.32, 0), body, [0.31, 0.78, 0], [0.85, 1.05, 0.9]);
  addMesh(group, new THREE.DodecahedronGeometry(0.25, 0), body, [0.56, 1.02, 0], [1.05, 0.85, 0.9]);
  addMesh(group, new THREE.BoxGeometry(0.35, 0.17, 0.25), dark, [0.79, 0.94, 0]);
  addMesh(group, new THREE.BoxGeometry(0.26, 0.06, 0.22), ember, [0.82, 0.85, 0]);
  addEyes(group, palette.accent, 0.7, 1.08, 0.13);
  for (const x of [-0.4, 0.3]) {
    for (const z of [-0.23, 0.23]) {
      addMesh(group, new THREE.CylinderGeometry(0.06, 0.09, 0.55, 5), dark, [x, 0.3, z], [1, 1, 1], [0, 0, x < 0 ? -0.12 : 0.12]);
      addMesh(group, new THREE.BoxGeometry(0.18, 0.08, 0.13), dark, [x + 0.06, 0.055, z]);
    }
  }
  for (const side of [-1, 1]) {
    addMesh(group, new THREE.ConeGeometry(0.075, 0.34, 5), dark, [0.48, 1.29, side * 0.15], [1, 1, 1], [side * 0.25, 0, -0.25]);
  }
  for (const x of [-0.38, -0.12, 0.14]) {
    addMesh(group, new THREE.ConeGeometry(0.07, 0.28, 5), ember, [x, 1.02, 0], [1, 1, 1], [0, 0, -0.15]);
  }
  addMesh(group, new THREE.ConeGeometry(0.09, 0.72, 6), body, [-0.72, 0.76, 0], [1, 1, 1], [0, 0, Math.PI / 2 - 0.35]);
  addMesh(group, new THREE.ConeGeometry(0.1, 0.3, 5), ember, [-1.03, 0.94, 0], [1, 1, 1], [0, 0, Math.PI / 2 - 0.35]);
}

function addIfrit(group: THREE.Group): void {
  const palette = PALETTES.ifrit!;
  const body = material(palette.body);
  const flame = material(palette.accent, { emissive: 0x8f360d, emissiveIntensity: 0.8 });
  const dark = material(palette.dark);
  addMesh(group, new THREE.ConeGeometry(0.34, 0.85, 7), flame, [0, 0.46, 0], [1, 1, 1], [0, 0, Math.PI]);
  addMesh(group, new THREE.ConeGeometry(0.19, 0.65, 6), body, [0.08, 0.43, 0.08], [1, 1, 1], [0.2, 0, Math.PI]);
  addMesh(group, new THREE.CylinderGeometry(0.27, 0.34, 0.68, 6), body, [0, 1.03, 0]);
  addMesh(group, new THREE.DodecahedronGeometry(0.36, 0), body, [0, 1.31, 0], [1.15, 0.65, 0.9]);
  addMesh(group, new THREE.DodecahedronGeometry(0.22, 0), body, [0.08, 1.67, 0]);
  addMesh(group, new THREE.ConeGeometry(0.23, 0.34, 6), flame, [0.02, 1.94, 0]);
  addEyes(group, palette.accent, 0.255, 1.7, 0.1);
  for (const side of [-1, 1]) {
    addMesh(group, new THREE.ConeGeometry(0.065, 0.42, 5), dark, [-0.01, 1.94, side * 0.14], [1, 1, 1], [side * 0.28, 0, -0.28]);
    addMesh(group, new THREE.CylinderGeometry(0.065, 0.09, 0.65, 6), body, [0.08, 1.15, side * 0.39], [1, 1, 1], [side * 0.65, 0, -0.25]);
  }
  addWing(group, palette.accent, 0.12, 0.85);
  addWing(group, palette.accent, -0.12, 0.85);
  addMesh(group, new THREE.CylinderGeometry(0.025, 0.035, 1.7, 6), dark, [0.18, 0.95, -0.57], [1, 1, 1], [0.1, 0, -0.08]);
  addMesh(group, new THREE.IcosahedronGeometry(0.14, 0), flame, [0.25, 1.84, -0.57]);
  addMesh(group, new THREE.IcosahedronGeometry(0.12, 0), flame, [0.23, 1.03, 0.64]);
}

function addPitFiend(group: THREE.Group): void {
  const palette = PALETTES.pitFiend!;
  const body = material(palette.body);
  const accent = material(palette.accent, { emissive: 0x5d1f10 });
  const dark = material(palette.dark);
  addMesh(group, new THREE.DodecahedronGeometry(0.54, 0), body, [0, 1.18, 0], [1, 1.25, 0.9]);
  addMesh(group, new THREE.CylinderGeometry(0.3, 0.4, 0.5, 6), dark, [-0.05, 0.69, 0]);
  addMesh(group, new THREE.OctahedronGeometry(0.16, 0), accent, [0.48, 1.29, 0], [0.5, 1, 1]);
  addMesh(group, new THREE.DodecahedronGeometry(0.31, 0), body, [0.13, 1.91, 0], [1.1, 0.9, 0.95]);
  addMesh(group, new THREE.BoxGeometry(0.25, 0.13, 0.31), dark, [0.37, 1.8, 0]);
  addEyes(group, palette.accent, 0.37, 1.99, 0.15, 0.045);
  for (const side of [-1, 1]) {
    addMesh(group, new THREE.ConeGeometry(0.12, 0.68, 6), dark, [0.02, 2.25, side * 0.24], [1, 1, 1], [side * 0.4, 0, -0.32]);
    addMesh(group, new THREE.CylinderGeometry(0.1, 0.15, 0.78, 6), body, [0.03, 1.19, side * 0.54], [1, 1, 1], [side * 0.65, 0, -0.15]);
    addMesh(group, new THREE.ConeGeometry(0.12, 0.35, 5), dark, [0.18, 0.85, side * 0.78], [1, 1, 1], [side * 0.4, 0, -0.7]);
    addMesh(group, new THREE.CylinderGeometry(0.11, 0.16, 0.65, 6), body, [-0.02, 0.37, side * 0.25], [1, 1, 1], [side * 0.12, 0, 0.08]);
    addMesh(group, new THREE.BoxGeometry(0.29, 0.12, 0.2), dark, [0.1, 0.07, side * 0.27]);
  }
  addWing(group, palette.dark, 0.24, 1.55);
  addWing(group, palette.dark, -0.24, 1.55);
  addMesh(group, new THREE.ConeGeometry(0.12, 1.05, 6), body, [-0.68, 0.72, 0], [1, 1, 1], [0, 0, Math.PI / 2 + 0.2]);
  addMesh(group, new THREE.OctahedronGeometry(0.13, 0), dark, [-1.17, 0.53, 0], [1.3, 0.8, 0.8]);
}

function addLizardman(group: THREE.Group): void {
  const palette = PALETTES.lizardman!;
  const body = material(palette.body);
  const accent = material(palette.accent);
  const dark = material(palette.dark);
  addMesh(group, new THREE.CylinderGeometry(0.22, 0.32, 0.7, 6), body, [0, 0.77, 0]);
  addMesh(group, new THREE.DodecahedronGeometry(0.22, 0), body, [0.07, 1.3, 0], [1.1, 0.9, 0.9]);
  addMesh(group, new THREE.BoxGeometry(0.32, 0.14, 0.23), body, [0.28, 1.25, 0]);
  addEyes(group, 0xe4d56b, 0.22, 1.37, 0.12);
  for (const side of [-1, 1]) {
    addMesh(group, new THREE.CylinderGeometry(0.06, 0.085, 0.55, 5), dark, [-0.03, 0.3, side * 0.16], [1, 1, 1], [side * 0.1, 0, 0.08]);
    addMesh(group, new THREE.CylinderGeometry(0.05, 0.075, 0.55, 5), body, [0.08, 0.82, side * 0.31], [1, 1, 1], [side * 0.35, 0, -0.3]);
    addMesh(group, new THREE.ConeGeometry(0.055, 0.24, 5), accent, [-0.08, 1.52, side * 0.1], [1, 1, 1], [side * 0.25, 0, -0.25]);
  }
  addMesh(group, new THREE.ConeGeometry(0.13, 0.95, 6), body, [-0.54, 0.58, 0], [1, 1, 1], [0, 0, Math.PI / 2 - 0.18]);
  addMesh(group, new THREE.CylinderGeometry(0.27, 0.27, 0.065, 10), dark, [0.13, 0.79, 0.39], [1, 1.2, 1], [Math.PI / 2, 0, 0]);
  addMesh(group, new THREE.CylinderGeometry(0.2, 0.2, 0.075, 10), accent, [0.13, 0.79, 0.43], [1, 1.2, 1], [Math.PI / 2, 0, 0]);
  addMesh(group, new THREE.CylinderGeometry(0.022, 0.028, 1.65, 5), dark, [0.15, 0.9, -0.43], [1, 1, 1], [0, 0, -0.16]);
  addMesh(group, new THREE.ConeGeometry(0.075, 0.28, 5), accent, [0.28, 1.72, -0.43], [1, 1, 1], [0, 0, -0.16]);
}

function addGorgon(group: THREE.Group): void {
  const palette = PALETTES.gorgon!;
  const body = material(palette.body);
  const armor = material(palette.accent, { metalness: 0.35, roughness: 0.6 });
  const dark = material(palette.dark);
  addMesh(group, new THREE.DodecahedronGeometry(0.52, 0), body, [-0.12, 0.72, 0], [1.35, 0.9, 1]);
  addMesh(group, new THREE.DodecahedronGeometry(0.34, 0), body, [0.54, 0.83, 0], [1.05, 0.85, 1.15]);
  addMesh(group, new THREE.BoxGeometry(0.32, 0.2, 0.43), dark, [0.79, 0.7, 0]);
  addEyes(group, 0xe6a44f, 0.73, 0.91, 0.2, 0.04);
  for (const x of [-0.42, 0.3]) {
    for (const z of [-0.31, 0.31]) {
      addMesh(group, new THREE.CylinderGeometry(0.085, 0.12, 0.55, 6), body, [x, 0.31, z]);
      addMesh(group, new THREE.BoxGeometry(0.2, 0.12, 0.19), dark, [x + 0.035, 0.07, z]);
    }
  }
  for (const x of [-0.42, -0.1, 0.22]) {
    addMesh(group, new THREE.BoxGeometry(0.28, 0.1, 0.65), armor, [x, 1.08, 0], [1, 1, 1], [0, 0, -0.08]);
  }
  for (const side of [-1, 1]) {
    addMesh(group, new THREE.ConeGeometry(0.1, 0.65, 6), armor, [0.51, 1.12, side * 0.37], [1, 1, 1], [side * 1.15, 0, -0.2]);
  }
  addMesh(group, new THREE.CylinderGeometry(0.035, 0.05, 0.65, 5), dark, [-0.75, 0.65, 0], [1, 1, 1], [0, 0, Math.PI / 2 - 0.25]);
  addMesh(group, new THREE.DodecahedronGeometry(0.1, 0), dark, [-1.04, 0.49, 0]);
}

function addWyvern(group: THREE.Group): void {
  const palette = PALETTES.wyvern!;
  const body = material(palette.body);
  const accent = material(palette.accent);
  const dark = material(palette.dark);
  addMesh(group, new THREE.IcosahedronGeometry(0.45, 0), body, [-0.16, 0.8, 0], [1.3, 0.85, 0.85]);
  addMesh(group, new THREE.CylinderGeometry(0.14, 0.24, 0.82, 6), body, [0.34, 1.19, 0], [1, 1, 1], [0, 0, -0.55]);
  addMesh(group, new THREE.DodecahedronGeometry(0.27, 0), body, [0.66, 1.58, 0], [1.2, 0.75, 0.85]);
  addMesh(group, new THREE.ConeGeometry(0.12, 0.42, 5), dark, [0.94, 1.52, 0], [1, 1, 1], [0, 0, -Math.PI / 2]);
  addEyes(group, palette.accent, 0.79, 1.65, 0.13);
  for (const side of [-1, 1]) {
    addMesh(group, new THREE.ConeGeometry(0.065, 0.4, 5), accent, [0.57, 1.91, side * 0.14], [1, 1, 1], [side * 0.25, 0, -0.3]);
    addMesh(group, new THREE.CylinderGeometry(0.08, 0.13, 0.66, 6), body, [-0.04, 0.38, side * 0.28], [1, 1, 1], [side * 0.15, 0, -0.15]);
    addMesh(group, new THREE.BoxGeometry(0.32, 0.09, 0.18), dark, [0.13, 0.07, side * 0.3]);
    addMesh(group, new THREE.ConeGeometry(0.045, 0.24, 5), accent, [0.29, 0.08, side * 0.3], [1, 1, 1], [0, 0, -Math.PI / 2]);
  }
  addWing(group, palette.dark, 0.2, 1.5);
  addWing(group, palette.dark, -0.2, 1.5);
  addMesh(group, new THREE.ConeGeometry(0.16, 1.55, 6), body, [-0.99, 0.66, 0], [1, 1, 1], [0, 0, Math.PI / 2 + 0.08]);
  for (const x of [-0.42, -0.18, 0.06]) {
    addMesh(group, new THREE.ConeGeometry(0.06, 0.25, 5), accent, [x, 1.16, 0]);
  }
}

function addBasilisk(group: THREE.Group): void {
  const palette = PALETTES.basilisk!;
  const body = material(palette.body);
  const accent = material(palette.accent);
  const dark = material(palette.dark);
  const segments = [
    [-0.72, 0.28, 0.08, 0.2],
    [-0.48, 0.35, -0.08, 0.27],
    [-0.18, 0.4, 0.04, 0.31],
    [0.12, 0.48, 0.02, 0.3],
  ] as const;
  for (const [x, y, z, radius] of segments) {
    addMesh(group, new THREE.DodecahedronGeometry(radius, 0), body, [x, y, z], [1.3, 0.8, 1]);
    addMesh(group, new THREE.ConeGeometry(0.055, 0.25, 5), accent, [x, y + radius * 0.85, z]);
  }
  addMesh(group, new THREE.ConeGeometry(0.15, 0.85, 6), body, [-1.03, 0.24, 0.1], [1, 1, 1], [0, 0, Math.PI / 2]);
  addMesh(group, new THREE.DodecahedronGeometry(0.34, 0), dark, [0.34, 0.77, 0], [0.75, 1.05, 1.3]);
  addMesh(group, new THREE.DodecahedronGeometry(0.24, 0), body, [0.48, 0.84, 0], [1.15, 0.8, 0.9]);
  addMesh(group, new THREE.BoxGeometry(0.3, 0.13, 0.24), body, [0.7, 0.78, 0]);
  addEyes(group, 0xf0d557, 0.64, 0.91, 0.13, 0.04);
  for (const side of [-1, 1]) {
    addMesh(group, new THREE.ConeGeometry(0.065, 0.38, 5), accent, [0.38, 1.16, side * 0.17], [1, 1, 1], [side * 0.3, 0, -0.2]);
    addMesh(group, new THREE.ConeGeometry(0.045, 0.2, 5), accent, [0.82, 0.69, side * 0.08], [1, 1, 1], [0, 0, Math.PI]);
  }
}

const EXPANSION_MODELS: Record<string, { faction: 'Ember' | 'Mire'; archetype: string; build: (group: THREE.Group) => void }> = {
  imp: { faction: 'Ember', archetype: 'hunched-fiend', build: addImp },
  hellhound: { faction: 'Ember', archetype: 'canine-quadruped', build: addHellhound },
  ifrit: { faction: 'Ember', archetype: 'winged-caster', build: addIfrit },
  pitFiend: { faction: 'Ember', archetype: 'large-demon', build: addPitFiend },
  lizardman: { faction: 'Mire', archetype: 'reptilian-humanoid', build: addLizardman },
  gorgon: { faction: 'Mire', archetype: 'armored-bull', build: addGorgon },
  wyvern: { faction: 'Mire', archetype: 'two-legged-wyvern', build: addWyvern },
  basilisk: { faction: 'Mire', archetype: 'serpentine', build: addBasilisk },
};

export function getCreatureVisualFaction(creatureId: string): string | undefined {
  const hotaFaction = HOTA_CREATURE_FACTIONS[creatureId];
  if (hotaFaction) return hotaFaction;
  const expansionFaction = EXPANSION_MODELS[creatureId]?.faction;
  if (expansionFaction) return expansionFaction;
  if (['sprite', 'ranger', 'unicorn', 'dragon'].includes(creatureId)) return 'Grove';
  if (['militia', 'archer', 'griffin', 'cavalier'].includes(creatureId)) return 'Haven';
  return undefined;
}

export function createCreatureModel(
  creatureId: string,
  side: BattleSideId,
  options: { factionRing?: boolean } = {},
): THREE.Group {
  const group = new THREE.Group();
  const expansion = EXPANSION_MODELS[creatureId];
  const hota = createHotaCreature(creatureId);
  if (hota) group.add(hota.group);
  else if (expansion) expansion.build(group);
  else if (creatureId === 'cavalier' || creatureId === 'unicorn') addHorse(group, creatureId);
  else if (creatureId === 'griffin') addGriffin(group);
  else if (creatureId === 'dragon') addDragon(group);
  else if (creatureId === 'sprite') addSprite(group);
  else addHumanoid(group, creatureId);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  const visualHeight = Number.isFinite(size.y) ? size.y : 1.6;
  if (options.factionRing !== false) {
    const ringRadius = hota ? THREE.MathUtils.clamp(Math.max(size.x, size.z) * 0.38, 0.48, 0.78) : 0.5;
    const factionRing = new THREE.Mesh(
      new THREE.TorusGeometry(ringRadius, 0.035, 5, 18),
      material(side === 'attacker' ? 0x65bfe3 : 0xe17868, { emissive: side === 'attacker' ? 0x163b4a : 0x491b17 }),
    );
    factionRing.rotation.x = Math.PI / 2;
    factionRing.position.y = 0.05;
    factionRing.name = 'faction-ring';
    group.add(factionRing);
  }
  group.rotation.y = side === 'attacker' ? 0 : Math.PI;
  group.name = `creature-${creatureId}`;
  group.userData.creatureId = creatureId;
  group.userData.faction = hota?.faction ?? getCreatureVisualFaction(creatureId) ?? 'Haven';
  group.userData.archetype = hota?.archetype ?? expansion?.archetype ?? creatureId;
  group.userData.animationPivot = 'ground';
  group.userData.side = side;
  group.userData.visualHeight = visualHeight;
  group.userData.labelHeight = Math.max(1.85, bounds.max.y + 0.45);
  const palette = PALETTES[creatureId] ?? PALETTES.militia!;
  group.userData.palette = hota?.palette ?? [palette.body, palette.accent, palette.dark];
  group.userData.factionColor = group.userData.palette[0];
  return group;
}
