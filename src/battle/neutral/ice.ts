import * as THREE from 'three';
import type { BattleSideId } from '../types';

interface IceMonsterSpec {
  archetype: string;
  palette: readonly [number, number, number];
  build: (group: THREE.Group) => void;
}

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.72, ...extra });
}

function mesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(...position);
  result.scale.set(...scale);
  result.rotation.set(...rotation);
  result.castShadow = true;
  result.receiveShadow = true;
  group.add(result);
  return result;
}

function box(
  group: THREE.Group,
  size: [number, number, number],
  surface: THREE.Material,
  position: [number, number, number],
): THREE.Mesh {
  return mesh(group, new THREE.BoxGeometry(...size), surface, position);
}

function cylinder(
  group: THREE.Group,
  top: number,
  bottom: number,
  height: number,
  surface: THREE.Material,
  position: [number, number, number],
  segments = 7,
): THREE.Mesh {
  return mesh(group, new THREE.CylinderGeometry(top, bottom, height, segments), surface, position);
}

function cone(
  group: THREE.Group,
  radius: number,
  height: number,
  surface: THREE.Material,
  position: [number, number, number],
  segments = 6,
): THREE.Mesh {
  return mesh(group, new THREE.ConeGeometry(radius, height, segments), surface, position);
}

function eyes(
  group: THREE.Group,
  color: number,
  x: number,
  y: number,
  z: number,
  radius: number,
): void {
  const geometry = new THREE.SphereGeometry(radius, 6, 4);
  const surface = material(color, { emissive: color, emissiveIntensity: 1.1, roughness: 0.3 });
  mesh(group, geometry, surface, [x, y, z]);
  mesh(group, geometry, surface, [x, y, -z]);
}

function buildFrostGiant(group: THREE.Group): void {
  const armor = material(0x6f94ad, { metalness: 0.28, roughness: 0.58 });
  const ice = material(0xc8edf2, { metalness: 0.08, roughness: 0.32 });
  const dark = material(0x34465c, { metalness: 0.22 });
  const skin = material(0x9db9c5);
  const glow = material(0x8fe8f2, { emissive: 0x3b9aaa, emissiveIntensity: 0.65, roughness: 0.3 });

  const torso = mesh(group, new THREE.DodecahedronGeometry(0.52, 0), armor, [0, 1.23, 0], [0.88, 1.18, 1.02]);
  torso.name = 'frost-giant-body';
  cylinder(group, 0.39, 0.42, 0.14, dark, [0, 0.82, 0], 8);
  box(group, [0.13, 0.58, 0.65], ice, [0.39, 1.28, 0]);
  mesh(group, new THREE.OctahedronGeometry(0.13, 0), glow, [0.49, 1.34, 0], [0.7, 1.25, 1]);

  for (const side of [-1, 1]) {
    cylinder(group, 0.12, 0.16, 0.62, dark, [0, 0.4, side * 0.2]);
    box(group, [0.36, 0.18, 0.27], dark, [0.09, 0.09, side * 0.2]);
    mesh(group, new THREE.OctahedronGeometry(0.25, 0), ice, [0, 1.57, side * 0.49], [1.15, 0.72, 1.1]);
    const arm = cylinder(group, 0.11, 0.15, 0.62, armor, [0.02, 1.23, side * 0.56]);
    arm.rotation.x = side * 0.18;
    arm.rotation.z = -0.08;
    mesh(group, new THREE.DodecahedronGeometry(0.15, 0), skin, [0.12, 0.88, side * 0.62], [1, 1.1, 1]);
    cone(group, 0.075, 0.3, ice, [-0.04, 1.78, side * 0.46]);
    cone(group, 0.085, 0.38, ice, [0.02, 2.3, side * 0.31]).rotation.x = side * Math.PI / 2;
  }

  const head = mesh(group, new THREE.DodecahedronGeometry(0.29, 0), skin, [0.08, 2.02, 0], [0.9, 1.05, 0.95]);
  head.name = 'frost-giant-head';
  cylinder(group, 0.28, 0.31, 0.2, armor, [0.05, 2.2, 0], 8);
  cone(group, 0.25, 0.26, ice, [0.02, 2.4, 0], 7);
  cone(group, 0.2, 0.52, ice, [0.23, 1.72, 0], 7).rotation.z = Math.PI;
  cone(group, 0.045, 0.14, skin, [0.37, 1.99, 0], 5).rotation.z = -Math.PI / 2;
  eyes(group, 0xbdf8ff, 0.325, 2.06, 0.105, 0.035);

  cylinder(group, 0.045, 0.06, 1.35, dark, [0.1, 0.93, -0.73]).rotation.z = -0.08;
  const maul = mesh(group, new THREE.DodecahedronGeometry(0.24, 0), ice, [0.15, 1.61, -0.73], [1.35, 0.82, 0.9]);
  maul.name = 'frost-giant-maul';
  for (const x of [-0.12, 0.4]) {
    cone(group, 0.07, 0.25, glow, [x, 1.61, -0.73]).rotation.z = x < 0 ? Math.PI / 2 : -Math.PI / 2;
  }
}

function buildIceWyrm(group: THREE.Group): void {
  const scales = material(0x79aabd, { roughness: 0.58 });
  const belly = material(0xc6e2e5, { roughness: 0.66 });
  const ice = material(0xb9f0f4, { metalness: 0.12, roughness: 0.3 });
  const dark = material(0x345168);
  const glow = material(0x8ee9f5, { emissive: 0x3b9eae, emissiveIntensity: 0.7, roughness: 0.28 });

  cone(group, 0.18, 1.05, scales, [-1.13, 0.39, 0], 7).rotation.z = Math.PI / 2;
  const segments: Array<[number, number, number, number]> = [
    [-0.72, 0.43, 0.02, 0.27],
    [-0.42, 0.58, -0.02, 0.34],
    [-0.08, 0.72, 0, 0.36],
    [0.22, 0.88, 0, 0.3],
  ];
  for (let index = 0; index < segments.length; index += 1) {
    const [x, y, z, radius] = segments[index]!;
    const body = mesh(group, new THREE.DodecahedronGeometry(radius, 0), scales, [x, y, z], [1.25, 0.85, 0.95]);
    if (index === 2) body.name = 'ice-wyrm-body';
    const spine = cone(group, 0.065, 0.3, ice, [x, y + radius * 0.85 + 0.1, z]);
    spine.name = `ice-wyrm-spine-${index}`;
    box(group, [radius * 1.25, 0.08, radius * 1.1], belly, [x + 0.04, y - radius * 0.63, z]);
  }

  const neck = cylinder(group, 0.17, 0.25, 0.62, scales, [0.4, 1.08, 0], 7);
  neck.rotation.z = -0.48;
  const head = mesh(group, new THREE.DodecahedronGeometry(0.28, 0), scales, [0.66, 1.4, 0], [1.25, 0.82, 0.95]);
  head.name = 'ice-wyrm-head';
  box(group, [0.42, 0.17, 0.32], belly, [0.91, 1.32, 0]);
  box(group, [0.36, 0.07, 0.28], dark, [0.9, 1.2, 0]);
  eyes(group, 0xc8fbff, 0.82, 1.46, 0.14, 0.04);

  for (const side of [-1, 1]) {
    cone(group, 0.065, 0.36, ice, [0.53, 1.66, side * 0.15]).rotation.z = -0.35;
    cone(group, 0.08, 0.34, ice, [0.52, 1.39, side * 0.25]).rotation.x = side * Math.PI / 2;
    for (const x of [-0.42, 0.18]) {
      const leg = cylinder(group, 0.065, 0.1, 0.46, scales, [x, 0.29, side * 0.27]);
      leg.rotation.x = side * 0.2;
      box(group, [0.27, 0.12, 0.17], dark, [x + 0.07, 0.06, side * 0.29]);
    }
    for (const x of [0.94, 1.06]) {
      cone(group, 0.025, 0.12, ice, [x, 1.18, side * 0.1], 5).rotation.z = Math.PI;
    }
  }

  for (const x of [-1.35, -1.08, -0.82]) {
    cone(group, 0.045, 0.22, glow, [x, 0.57, 0]).rotation.z = -0.18;
  }
}

const ICE_MONSTERS = {
  frostGiant: {
    archetype: 'armored-frost-giant',
    palette: [0x6f94ad, 0xc8edf2, 0x34465c],
    build: buildFrostGiant,
  },
  iceWyrm: {
    archetype: 'wingless-ice-wyrm',
    palette: [0x79aabd, 0xb9f0f4, 0x345168],
    build: buildIceWyrm,
  },
} satisfies Record<string, IceMonsterSpec>;

export function createIceMonsterModel(creatureId: string, side: BattleSideId): THREE.Group | null {
  if (!Object.hasOwn(ICE_MONSTERS, creatureId)) return null;
  const spec = ICE_MONSTERS[creatureId as keyof typeof ICE_MONSTERS];
  const group = new THREE.Group();
  spec.build(group);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.name = `creature-${creatureId}`;
  group.rotation.y = side === 'attacker' ? 0 : Math.PI;
  group.userData.creatureId = creatureId;
  group.userData.faction = 'Neutral';
  group.userData.archetype = spec.archetype;
  group.userData.animationPivot = 'ground';
  group.userData.side = side;
  group.userData.visualHeight = size.y;
  group.userData.labelHeight = Math.max(1.85, bounds.max.y + 0.45);
  group.userData.palette = [...spec.palette];
  group.userData.factionColor = spec.palette[0];
  return group;
}
