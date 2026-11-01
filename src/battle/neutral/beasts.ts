import * as THREE from 'three';
import type { BattleSideId } from '../types';

interface BeastSpec {
  archetype: string;
  palette: [number, number, number];
  build: (group: THREE.Group) => void;
}

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.86, ...extra });
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

function cylinder(
  group: THREE.Group,
  top: number,
  bottom: number,
  height: number,
  surface: THREE.Material,
  position: [number, number, number],
  segments = 6,
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
  creatureId: string,
  color: number,
  x: number,
  y: number,
  z: number,
): void {
  const geometry = new THREE.SphereGeometry(0.035, 6, 4);
  const surface = material(color, { emissive: color, emissiveIntensity: 0.55 });
  for (const side of [-1, 1]) {
    const eye = mesh(group, geometry, surface, [x, y, side * z]);
    eye.name = `${creatureId}-eye-${side < 0 ? 'left' : 'right'}`;
  }
}

function addDireBear(group: THREE.Group): void {
  const fur = material(0x6f4a32);
  const darkFur = material(0x453126);
  const muzzle = material(0xa27b57);
  const black = material(0x211c19);
  const ivory = material(0xd9c29a);

  mesh(group, new THREE.DodecahedronGeometry(0.48, 0), fur, [-0.14, 0.7, 0], [1.38, 0.86, 0.94])
    .name = 'direBear-body';
  mesh(group, new THREE.DodecahedronGeometry(0.36, 0), darkFur, [-0.23, 1.0, 0], [1.15, 0.82, 1.02])
    .name = 'direBear-shoulder-hump';
  mesh(group, new THREE.DodecahedronGeometry(0.32, 0), fur, [0.48, 0.91, 0], [1.04, 1, 0.96])
    .name = 'direBear-head';
  mesh(group, new THREE.BoxGeometry(0.35, 0.2, 0.32), muzzle, [0.75, 0.82, 0])
    .name = 'direBear-muzzle';
  mesh(group, new THREE.DodecahedronGeometry(0.1, 0), black, [0.95, 0.87, 0], [0.75, 0.72, 1])
    .name = 'direBear-nose';
  eyes(group, 'direBear', 0xe6b85c, 0.69, 1.0, 0.15);

  for (const side of [-1, 1]) {
    mesh(group, new THREE.SphereGeometry(0.11, 6, 4), darkFur, [0.4, 1.17, side * 0.22], [0.9, 1, 0.75])
      .name = `direBear-ear-${side < 0 ? 'left' : 'right'}`;
    cone(group, 0.035, 0.17, ivory, [0.79, 0.7, side * 0.095], 5).rotation.z = Math.PI;
  }

  for (const [x, label] of [[-0.48, 'hind'], [0.3, 'front']] as const) {
    for (const side of [-1, 1]) {
      const z = side * 0.3;
      cylinder(group, 0.1, 0.14, 0.52, darkFur, [x, 0.32, z], 6)
        .name = `direBear-${label}-leg-${side < 0 ? 'left' : 'right'}`;
      mesh(group, new THREE.BoxGeometry(0.3, 0.12, 0.23), darkFur, [x + 0.07, 0.06, z])
        .name = `direBear-${label}-paw-${side < 0 ? 'left' : 'right'}`;
      if (label === 'front') {
        for (const offset of [-0.07, 0, 0.07]) {
          const claw = cone(group, 0.025, 0.17, ivory, [0.53, 0.07, z + offset], 5);
          claw.rotation.z = -Math.PI / 2;
          claw.name = 'direBear-claw';
        }
      }
    }
  }

  mesh(group, new THREE.DodecahedronGeometry(0.13, 0), darkFur, [-0.79, 0.68, 0], [1.1, 0.9, 0.9])
    .name = 'direBear-tail';
}

function addManticoreWing(group: THREE.Group, side: number, surface: THREE.Material): void {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    -0.5, 0.78, side * 0.95,
    0.2, 0.45, side * 0.72,
    0, 0, 0,
    0.2, 0.45, side * 0.72,
    0.57, -0.1, side * 0.3,
  ], 3));
  geometry.computeVertexNormals();
  const wing = mesh(group, geometry, surface, [-0.16, 0.86, side * 0.2]);
  wing.name = `manticore-wing-${side < 0 ? 'left' : 'right'}`;
  wing.userData.anatomy = 'wing';
}

function addManticore(group: THREE.Group): void {
  const fur = material(0xb87a45);
  const mane = material(0x713c2f);
  const dark = material(0x3a2730);
  const membrane = material(0x8f3f32, { side: THREE.DoubleSide, roughness: 0.78 });
  const ivory = material(0xe0cfaa);

  mesh(group, new THREE.DodecahedronGeometry(0.44, 0), fur, [-0.16, 0.67, 0], [1.38, 0.8, 0.88])
    .name = 'manticore-lion-body';
  mesh(group, new THREE.TorusGeometry(0.3, 0.11, 6, 10), mane, [0.4, 0.93, 0], [1, 1, 1], [0, Math.PI / 2, 0])
    .name = 'manticore-mane';
  mesh(group, new THREE.DodecahedronGeometry(0.25, 0), fur, [0.52, 0.95, 0], [0.98, 1.08, 0.9])
    .name = 'manticore-face';
  mesh(group, new THREE.BoxGeometry(0.28, 0.15, 0.25), fur, [0.73, 0.86, 0])
    .name = 'manticore-muzzle';
  mesh(group, new THREE.DodecahedronGeometry(0.07, 0), dark, [0.89, 0.9, 0], [0.8, 0.7, 1])
    .name = 'manticore-nose';
  eyes(group, 'manticore', 0xf1c65b, 0.71, 1.02, 0.13);

  for (const side of [-1, 1]) {
    cone(group, 0.075, 0.2, mane, [0.45, 1.2, side * 0.17], 5)
      .name = `manticore-ear-${side < 0 ? 'left' : 'right'}`;
    cone(group, 0.03, 0.17, ivory, [0.78, 0.75, side * 0.075], 5).rotation.z = Math.PI;
    addManticoreWing(group, side, membrane);
  }

  for (const x of [-0.45, 0.28]) {
    for (const side of [-1, 1]) {
      const z = side * 0.27;
      cylinder(group, 0.07, 0.1, 0.48, fur, [x, 0.3, z], 6)
        .name = 'manticore-leg';
      mesh(group, new THREE.BoxGeometry(0.26, 0.12, 0.2), dark, [x + 0.06, 0.06, z])
        .name = 'manticore-paw';
      const claw = cone(group, 0.028, 0.15, ivory, [x + 0.23, 0.07, z], 5);
      claw.rotation.z = -Math.PI / 2;
      claw.name = 'manticore-claw';
    }
  }

  const tailSegments: Array<[number, number, number]> = [
    [-0.65, 0.72, 0.14],
    [-0.86, 0.88, 0.125],
    [-0.98, 1.09, 0.11],
    [-0.91, 1.3, 0.095],
    [-0.74, 1.44, 0.085],
  ];
  tailSegments.forEach(([x, y, radius], index) => {
    mesh(group, new THREE.DodecahedronGeometry(radius, 0), index % 2 === 0 ? mane : dark, [x, y, 0])
      .name = `manticore-tail-segment-${index}`;
  });
  const stinger = cone(group, 0.085, 0.36, dark, [-0.56, 1.46, 0], 6);
  stinger.rotation.z = -Math.PI / 2;
  stinger.name = 'manticore-scorpion-stinger';
}

const BEAST_SPECS: Record<string, BeastSpec> = {
  direBear: { archetype: 'dire-bear', palette: [0x6f4a32, 0xd9c29a, 0x2e241f], build: addDireBear },
  manticore: { archetype: 'winged-manticore', palette: [0xb87a45, 0x8f3f32, 0x3a2730], build: addManticore },
};

export function createBeastsMonsterModel(creatureId: string, side: BattleSideId): THREE.Group | null {
  if (!Object.hasOwn(BEAST_SPECS, creatureId)) return null;
  const spec = BEAST_SPECS[creatureId]!;
  const group = new THREE.Group();
  spec.build(group);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.rotation.y = side === 'defender' ? Math.PI : 0;
  group.name = `creature-${creatureId}`;
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
