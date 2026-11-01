import * as THREE from 'three';
import type { BattleSideId } from '../types';

type VectorTuple = [number, number, number];

interface InfernalSpec {
  archetype: string;
  palette: [number, number, number];
  build: (group: THREE.Group) => void;
}

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.82, ...extra });
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: VectorTuple,
  scale: VectorTuple = [1, 1, 1],
  rotation: VectorTuple = [0, 0, 0],
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

function box(parent: THREE.Object3D, size: VectorTuple, surface: THREE.Material, position: VectorTuple, name?: string): THREE.Mesh {
  return mesh(parent, new THREE.BoxGeometry(...size), surface, position, [1, 1, 1], [0, 0, 0], name);
}

function cylinder(
  parent: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  surface: THREE.Material,
  position: VectorTuple,
  segments = 6,
): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, position);
}

function cone(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  surface: THREE.Material,
  position: VectorTuple,
  segments = 6,
): THREE.Mesh {
  return mesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, position);
}

function addCerberusHead(
  parent: THREE.Group,
  name: string,
  position: VectorTuple,
  yaw: number,
  body: THREE.Material,
  dark: THREE.Material,
  ember: THREE.Material,
): void {
  const head = new THREE.Group();
  head.name = name;
  head.userData.anatomy = 'head';
  head.position.set(...position);
  head.rotation.y = yaw;
  parent.add(head);
  mesh(head, new THREE.DodecahedronGeometry(0.24, 0), body, [0, 0, 0], [1.1, 0.95, 0.9]);
  box(head, [0.34, 0.16, 0.25], dark, [0.25, -0.07, 0]);
  box(head, [0.28, 0.055, 0.21], ember, [0.27, -0.165, 0]);
  for (const side of [-1, 1]) {
    mesh(head, new THREE.SphereGeometry(0.035, 5, 4), ember, [0.16, 0.065, side * 0.125]);
    const ear = cone(head, 0.075, 0.3, dark, [-0.045, 0.25, side * 0.13], 5);
    ear.rotation.set(side * 0.15, 0, -0.25);
  }
  if (name === 'cerberus-head-center') {
    for (const side of [-1, 1]) {
      const fang = cone(head, 0.026, 0.13, material(0xe8dcc0), [0.34, -0.18, side * 0.075], 5);
      fang.rotation.z = Math.PI;
    }
  }
}

function addCerberus(group: THREE.Group): void {
  const body = material(0x45272a);
  const dark = material(0x1d181e);
  const ember = material(0xff7832, { emissive: 0xa62d10, emissiveIntensity: 0.85 });
  mesh(group, new THREE.DodecahedronGeometry(0.48, 0), body, [-0.18, 0.68, 0], [1.45, 0.82, 1]);
  mesh(group, new THREE.DodecahedronGeometry(0.36, 0), body, [0.3, 0.82, 0], [0.95, 1.05, 1.25]);
  for (const x of [-0.48, 0.25]) {
    for (const z of [-0.28, 0.28]) {
      const leg = cylinder(group, 0.075, 0.11, 0.55, dark, [x, 0.3, z], 5);
      leg.rotation.z = x < 0 ? -0.1 : 0.1;
      box(group, [0.25, 0.1, 0.18], dark, [x + 0.07, 0.05, z]);
    }
  }
  addCerberusHead(group, 'cerberus-head-left', [0.43, 1.03, -0.31], 0.24, body, dark, ember);
  addCerberusHead(group, 'cerberus-head-center', [0.54, 1.12, 0], 0, body, dark, ember);
  addCerberusHead(group, 'cerberus-head-right', [0.43, 1.03, 0.31], -0.24, body, dark, ember);
  const tail = cone(group, 0.11, 0.75, body, [-0.88, 0.78, 0]);
  tail.rotation.z = Math.PI / 2 - 0.35;
  mesh(group, new THREE.OctahedronGeometry(0.12, 0), ember, [-1.2, 0.94, 0], [1.25, 0.85, 0.85], [0, 0, 0], 'cerberus-tail-flame');
  for (const [index, x] of [-0.48, -0.18, 0.12].entries()) {
    const flame = cone(group, 0.085, 0.34, ember, [x, 1.13, 0], 5);
    flame.rotation.z = -0.15;
    flame.name = `cerberus-back-flame-${index}`;
  }
}

function addBalorWing(group: THREE.Group, side: number, surface: THREE.Material): void {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    -0.65, 0.8, side * 0.95,
    0.35, 0.25, side * 0.7,
    0, 0, 0,
    0.35, 0.25, side * 0.7,
    0.55, -0.5, side * 0.38,
  ], 3));
  geometry.computeVertexNormals();
  const wing = mesh(
    group,
    geometry,
    surface,
    [-0.18, 1.45, side * 0.28],
    [1, 1, 1],
    [0, 0, 0],
    `balor-wing-${side < 0 ? 'left' : 'right'}`,
  );
  wing.userData.anatomy = 'wing';
}

function addBalor(group: THREE.Group): void {
  const body = material(0x762b31);
  const dark = material(0x211820);
  const flame = material(0xff8a32, { emissive: 0xb83412, emissiveIntensity: 0.95 });
  const wing = material(0x3b202d, { side: THREE.DoubleSide });
  mesh(group, new THREE.DodecahedronGeometry(0.53, 0), body, [0, 1.35, 0], [1, 1.2, 0.9]);
  cylinder(group, 0.3, 0.42, 0.5, dark, [0, 0.78, 0]);
  mesh(group, new THREE.DodecahedronGeometry(0.32, 0), body, [0.1, 2.03, 0], [1.05, 0.95, 0.95]);
  box(group, [0.28, 0.16, 0.32], dark, [0.36, 1.96, 0]);
  mesh(group, new THREE.OctahedronGeometry(0.17, 0), flame, [0.47, 1.42, 0], [0.5, 1, 1], [0, 0, 0], 'balor-ember-core');
  for (const side of [-1, 1]) {
    mesh(group, new THREE.SphereGeometry(0.045, 5, 4), flame, [0.34, 2.1, side * 0.14]);
    const horn = cone(group, 0.12, 0.65, dark, [0.03, 2.45, side * 0.26]);
    horn.rotation.set(side * 0.38, 0, -0.28);
    horn.name = `balor-horn-${side < 0 ? 'left' : 'right'}`;
    const upperArm = cylinder(group, 0.11, 0.17, 0.85, body, [0.02, 1.37, side * 0.58]);
    upperArm.rotation.x = side * 0.55;
    const forearm = cylinder(group, 0.09, 0.13, 0.65, dark, [0.17, 0.94, side * 0.83]);
    forearm.rotation.set(side * 0.3, 0, -0.25);
    const leg = cylinder(group, 0.12, 0.18, 0.72, body, [-0.03, 0.43, side * 0.25]);
    leg.rotation.set(side * 0.1, 0, 0.08);
    box(group, [0.34, 0.16, 0.25], dark, [0.1, 0.08, side * 0.28]);
    addBalorWing(group, side, wing);
    const shoulderFlame = cone(group, 0.1, 0.45, flame, [-0.05, 1.85, side * 0.48], 5);
    shoulderFlame.rotation.z = -0.2;
  }
  const sword = new THREE.Group();
  sword.name = 'balor-flame-sword';
  sword.position.set(0.32, 0, 0.95);
  group.add(sword);
  cylinder(sword, 0.035, 0.045, 0.4, dark, [0, 0.82, 0]);
  box(sword, [0.32, 0.06, 0.08], dark, [0, 1.02, 0]);
  cone(sword, 0.14, 1.05, flame, [0, 1.5, 0], 5);
  const whipCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.25, 0.8, -0.9),
    new THREE.Vector3(0.72, 0.55, -1.18),
    new THREE.Vector3(1.02, 0.3, -0.88),
    new THREE.Vector3(0.83, 0.24, -0.55),
  ]);
  mesh(group, new THREE.TubeGeometry(whipCurve, 8, 0.025, 4, false), flame, [0, 0, 0], [1, 1, 1], [0, 0, 0], 'balor-fire-whip');
}

const INFERNAL_SPECS: Record<string, InfernalSpec> = {
  cerberus: { archetype: 'three-headed-hound', palette: [0x45272a, 0xff7832, 0x1d181e], build: addCerberus },
  balor: { archetype: 'winged-fire-demon', palette: [0x762b31, 0xff8a32, 0x211820], build: addBalor },
};

export function createInfernalMonsterModel(creatureId: string, side: BattleSideId): THREE.Group | null {
  const spec = Object.hasOwn(INFERNAL_SPECS, creatureId) ? INFERNAL_SPECS[creatureId] : undefined;
  if (!spec) return null;
  const group = new THREE.Group();
  spec.build(group);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.rotation.y = side === 'attacker' ? 0 : Math.PI;
  group.name = `creature-${creatureId}`;
  group.userData.creatureId = creatureId;
  group.userData.faction = 'Infernal';
  group.userData.archetype = spec.archetype;
  group.userData.animationPivot = 'ground';
  group.userData.side = side;
  group.userData.visualHeight = size.y;
  group.userData.labelHeight = Math.max(1.85, bounds.max.y + 0.45);
  group.userData.palette = [...spec.palette];
  group.userData.factionColor = spec.palette[0];
  return group;
}
