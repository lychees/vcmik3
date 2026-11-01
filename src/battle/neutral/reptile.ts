import * as THREE from 'three';
import type { BattleSideId } from '../types';

type Point = [number, number, number];
type ReptileCreatureId = 'hydra' | 'basiliskKing';

interface ReptileSpec {
  archetype: string;
  palette: [number, number, number];
  build: (group: THREE.Group) => void;
}

function material(
  color: number,
  extra: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.82, ...extra });
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: Point,
  scale: Point = [1, 1, 1],
  rotation: Point = [0, 0, 0],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(...position);
  result.scale.set(...scale);
  result.rotation.set(...rotation);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function cylinder(
  parent: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  surface: THREE.Material,
  position: Point,
  segments = 7,
): THREE.Mesh {
  return addMesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, position);
}

function cone(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  surface: THREE.Material,
  position: Point,
  segments = 6,
): THREE.Mesh {
  return addMesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, position);
}

function box(
  parent: THREE.Object3D,
  size: Point,
  surface: THREE.Material,
  position: Point,
): THREE.Mesh {
  return addMesh(parent, new THREE.BoxGeometry(...size), surface, position);
}

function beam(
  parent: THREE.Object3D,
  from: Point,
  to: Point,
  top: number,
  bottom: number,
  surface: THREE.Material,
): THREE.Mesh {
  const start = new THREE.Vector3(...from);
  const direction = new THREE.Vector3(...to).sub(start);
  const result = addMesh(
    parent,
    new THREE.CylinderGeometry(top, bottom, direction.length(), 7),
    surface,
    [0, 0, 0],
  );
  result.position.copy(start).addScaledVector(direction, 0.5);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function addEyes(
  parent: THREE.Object3D,
  color: number,
  x: number,
  y: number,
  z: number,
  radius = 0.04,
): void {
  const geometry = new THREE.SphereGeometry(radius, 6, 4);
  const surface = material(color, { emissive: color, emissiveIntensity: 0.85 });
  addMesh(parent, geometry, surface, [x, y, z]);
  addMesh(parent, geometry, surface, [x, y, -z]);
}

function addHydraHead(
  group: THREE.Group,
  name: string,
  position: Point,
  skin: THREE.Material,
  dark: THREE.Material,
  horn: THREE.Material,
): void {
  const [x, y, z] = position;
  const head = addMesh(
    group,
    new THREE.DodecahedronGeometry(0.25, 0),
    skin,
    position,
    [1.25, 0.86, 1],
  );
  head.name = `hydra-head-${name}`;
  head.userData.anatomy = 'head';
  box(group, [0.34, 0.14, 0.26], dark, [x + 0.24, y - 0.065, z]);
  const eyeGeometry = new THREE.SphereGeometry(0.037, 6, 4);
  const eyeMaterial = material(0xf2ce58, { emissive: 0xf2ce58, emissiveIntensity: 0.85 });
  addMesh(group, eyeGeometry, eyeMaterial, [x + 0.13, y + 0.075, z + 0.145]);
  addMesh(group, eyeGeometry, eyeMaterial, [x + 0.13, y + 0.075, z - 0.145]);
  for (const side of [-1, 1]) {
    cone(group, 0.047, 0.24, horn, [x - 0.045, y + 0.245, z + side * 0.125], 5)
      .rotation.z = -0.25;
    cone(group, 0.026, 0.13, horn, [x + 0.27, y - 0.17, z + side * 0.075], 5)
      .rotation.z = Math.PI;
  }
}

function addHydra(group: THREE.Group): void {
  const skin = material(0x416f5b);
  const belly = material(0x719369);
  const dark = material(0x263e38);
  const scutes = material(0xa2b964);
  const horn = material(0xd8d0a0);

  addMesh(group, new THREE.DodecahedronGeometry(0.52, 0), skin, [-0.16, 0.65, 0], [1.38, 0.8, 1.02]);
  addMesh(group, new THREE.DodecahedronGeometry(0.4, 0), belly, [0.2, 0.57, 0], [1.05, 0.72, 0.9]);
  cone(group, 0.17, 1.25, skin, [-1.05, 0.48, 0], 7).rotation.z = Math.PI / 2;

  for (const x of [-0.48, 0.27]) {
    for (const side of [-1, 1]) {
      cylinder(group, 0.075, 0.115, 0.48, skin, [x, 0.28, side * 0.32]);
      box(group, [0.3, 0.12, 0.2], dark, [x + 0.09, 0.06, side * 0.32]);
    }
  }

  const necks: Array<[string, Point, Point, Point]> = [
    ['center', [0.15, 0.8, 0], [0.48, 1.48, 0], [0.68, 1.66, 0]],
    ['left', [0.02, 0.78, 0.24], [0.32, 1.27, 0.49], [0.54, 1.46, 0.62]],
    ['right', [0.02, 0.78, -0.24], [0.32, 1.27, -0.49], [0.54, 1.46, -0.62]],
  ];
  for (const [name, from, to, head] of necks) {
    const neck = beam(group, from, to, 0.13, 0.21, skin);
    neck.name = `hydra-neck-${name}`;
    neck.userData.anatomy = 'neck';
    addHydraHead(group, name, head, skin, dark, horn);
  }

  for (const x of [-0.58, -0.33, -0.08, 0.17]) {
    cone(group, 0.065, 0.28, scutes, [x, 1.08, 0], 5).rotation.z = -0.12;
  }
}

function addBasiliskKing(group: THREE.Group): void {
  const skin = material(0x54754a);
  const belly = material(0x91a65c);
  const dark = material(0x2e4033, { side: THREE.DoubleSide });
  const scutes = material(0xb3bd58);
  const gold = material(0xd9b84f, { metalness: 0.42, roughness: 0.48 });
  const jewel = material(0x72d7b0, { emissive: 0x2d7963, emissiveIntensity: 0.65 });

  addMesh(group, new THREE.DodecahedronGeometry(0.48, 0), skin, [-0.2, 0.54, 0], [1.5, 0.74, 0.9]);
  addMesh(group, new THREE.DodecahedronGeometry(0.34, 0), belly, [0.27, 0.63, 0], [1.05, 0.85, 0.92]);
  const hood = addMesh(
    group,
    new THREE.CircleGeometry(0.46, 7),
    dark,
    [0.38, 0.91, 0],
    [1.2, 1.1, 1],
    [0, Math.PI / 2, 0],
  );
  hood.name = 'basilisk-king-hood';
  hood.userData.anatomy = 'hood';
  addMesh(group, new THREE.DodecahedronGeometry(0.3, 0), skin, [0.7, 1.0, 0], [1.2, 0.86, 1]);
  box(group, [0.38, 0.16, 0.3], skin, [0.98, 0.92, 0]);
  box(group, [0.28, 0.055, 0.25], belly, [1.0, 0.825, 0]);
  addEyes(group, 0xffd75e, 0.855, 1.075, 0.165, 0.047);

  for (const x of [-0.56, -0.17, 0.25]) {
    for (const side of [-1, 1]) {
      cylinder(group, 0.055, 0.09, 0.38, skin, [x, 0.24, side * 0.3]);
      box(group, [0.25, 0.1, 0.17], dark, [x + 0.07, 0.05, side * 0.3]);
      cone(group, 0.03, 0.16, gold, [x + 0.23, 0.065, side * 0.3], 5).rotation.z = -Math.PI / 2;
    }
  }

  const tail: Array<[Point, number]> = [
    [[-0.78, 0.43, 0.02], 0.28],
    [[-1.02, 0.34, 0.09], 0.22],
    [[-1.23, 0.27, 0.17], 0.16],
  ];
  for (const [position, radius] of tail) {
    addMesh(group, new THREE.DodecahedronGeometry(radius, 0), skin, position, [1.3, 0.8, 0.9]);
  }
  cone(group, 0.105, 0.58, skin, [-1.47, 0.22, 0.22], 6).rotation.z = Math.PI / 2;

  for (const x of [-0.62, -0.38, -0.14, 0.1]) {
    cone(group, 0.065, 0.3, scutes, [x, 0.94, 0], 5).rotation.z = -0.15;
  }

  const crown = new THREE.Group();
  crown.name = 'basilisk-king-crown';
  crown.userData.anatomy = 'crown';
  group.add(crown);
  cylinder(crown, 0.22, 0.22, 0.1, gold, [0.68, 1.275, 0], 10);
  for (let index = 0; index < 5; index += 1) {
    const angle = -Math.PI * 0.65 + index * (Math.PI * 1.3 / 4);
    const spike = cone(
      crown,
      0.052,
      0.25,
      gold,
      [0.68 + Math.cos(angle) * 0.15, 1.435, Math.sin(angle) * 0.15],
      5,
    );
    spike.name = `basilisk-king-crown-spike-${index}`;
  }
  addMesh(crown, new THREE.OctahedronGeometry(0.075, 0), jewel, [0.885, 1.285, 0]);
}

const HYDRA: ReptileSpec = {
  archetype: 'three-headed-swamp-hydra',
  palette: [0x416f5b, 0xa2b964, 0x263e38],
  build: addHydra,
};

const BASILISK_KING: ReptileSpec = {
  archetype: 'crowned-hooded-basilisk',
  palette: [0x54754a, 0xd9b84f, 0x2e4033],
  build: addBasiliskKing,
};

export function createReptileMonsterModel(
  creatureId: string,
  side: BattleSideId,
): THREE.Group | null {
  const id: ReptileCreatureId | null = creatureId === 'hydra' || creatureId === 'basiliskKing'
    ? creatureId
    : null;
  if (!id) return null;
  const spec = id === 'hydra' ? HYDRA : BASILISK_KING;
  const group = new THREE.Group();
  spec.build(group);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.rotation.y = side === 'attacker' ? 0 : Math.PI;
  group.name = `creature-${id}`;
  group.userData.creatureId = id;
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
