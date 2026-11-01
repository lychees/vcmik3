import * as THREE from 'three';
import type { BattleSideId } from '../types';

type Point = readonly [number, number, number];
type UndeadId = 'lich' | 'wraith';

interface UndeadSpec {
  archetype: string;
  palette: readonly [number, number, number];
  build: (group: THREE.Group) => void;
}

function material(
  color: number,
  extra: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({
    color,
    flatShading: true,
    roughness: 0.82,
    ...extra,
  });
  result.userData.baseColor = color;
  return result;
}

function glow(color: number, intensity = 0.65): THREE.MeshStandardMaterial {
  return material(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.42 });
}

function mesh(
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
  result.castShadow = !surface.transparent;
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
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, position);
}

function cone(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  surface: THREE.Material,
  position: Point,
  segments = 7,
): THREE.Mesh {
  return mesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, position);
}

function box(
  parent: THREE.Object3D,
  size: Point,
  surface: THREE.Material,
  position: Point,
): THREE.Mesh {
  return mesh(parent, new THREE.BoxGeometry(...size), surface, position);
}

function beam(
  parent: THREE.Object3D,
  start: Point,
  end: Point,
  radius: number,
  surface: THREE.Material,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const direction = new THREE.Vector3(...end).sub(from);
  const result = cylinder(parent, radius * 0.8, radius, direction.length(), surface, [0, 0, 0], 6);
  result.position.copy(from).addScaledVector(direction, 0.5);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function eyes(
  parent: THREE.Object3D,
  color: number,
  x: number,
  y: number,
  z: number,
): void {
  const surface = glow(color, 1.1);
  for (const side of [-1, 1]) {
    const eye = mesh(parent, new THREE.SphereGeometry(0.035, 6, 4), surface, [x, y, side * z]);
    eye.name = 'glowing-eye';
  }
}

function addLich(group: THREE.Group): void {
  const robe = material(0x403653);
  const trim = material(0x88719b, { metalness: 0.18 });
  const dark = material(0x211d2d);
  const bone = material(0xc5c0a5);
  const crown = material(0xa78c4d, { metalness: 0.62, roughness: 0.42 });
  const magic = glow(0x82dfb0, 0.85);

  const skirt = cylinder(group, 0.18, 0.37, 0.86, robe, [0, 0.43, 0], 8);
  skirt.name = 'lich-robe';
  skirt.userData.anatomy = 'robe';
  cylinder(group, 0.23, 0.18, 0.55, robe, [0, 1.04, 0], 8);
  cylinder(group, 0.235, 0.235, 0.075, trim, [0, 0.82, 0], 8);
  const cape = mesh(group, new THREE.ConeGeometry(0.39, 1.28, 7, 1, true), material(0x292237, {
    side: THREE.DoubleSide,
  }), [-0.15, 0.69, 0.03], [0.72, 1, 1]);
  cape.name = 'lich-cape';

  for (const side of [-1, 1]) {
    const shoulder = mesh(group, new THREE.OctahedronGeometry(0.13, 0), trim, [0, 1.24, side * 0.28]);
    shoulder.scale.set(1, 0.72, 1);
    beam(group, [0.02, 1.17, side * 0.3], [0.13, 0.84, side * 0.46], 0.06, robe);
    mesh(group, new THREE.DodecahedronGeometry(0.075, 0), bone, [0.14, 0.8, side * 0.47]);
    const hem = cone(group, 0.075, 0.25, dark, [0.04, 0.125, side * 0.24], 5);
    hem.rotation.z = Math.PI;
  }

  const skull = mesh(group, new THREE.DodecahedronGeometry(0.2, 0), bone, [0.06, 1.51, 0], [0.9, 1.08, 0.9]);
  skull.name = 'lich-skull';
  skull.userData.anatomy = 'skull';
  box(group, [0.17, 0.085, 0.2], bone, [0.15, 1.34, 0]);
  box(group, [0.025, 0.055, 0.045], dark, [0.232, 1.45, 0]);
  eyes(group, 0x82efb5, 0.225, 1.55, 0.075);

  const crownBand = mesh(group, new THREE.TorusGeometry(0.18, 0.027, 5, 10), crown, [0.05, 1.69, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  crownBand.name = 'lich-crown';
  for (const z of [-0.13, 0, 0.13]) {
    const point = cone(group, 0.045, z === 0 ? 0.27 : 0.22, crown, [0.05, z === 0 ? 1.825 : 1.8, z], 5);
    point.name = 'lich-crown-point';
  }

  const staff = cylinder(group, 0.026, 0.038, 1.8, dark, [0.16, 0.9, -0.56], 7);
  staff.name = 'lich-staff';
  staff.userData.anatomy = 'staff';
  const orb = mesh(group, new THREE.IcosahedronGeometry(0.14, 1), magic, [0.16, 1.92, -0.56]);
  orb.name = 'lich-staff-orb';
  const orbit = mesh(group, new THREE.TorusGeometry(0.19, 0.018, 5, 14), magic, [0.16, 1.92, -0.56], [1, 1, 1], [0.35, Math.PI / 2, 0]);
  orbit.name = 'lich-staff-halo';
  for (const y of [0.96, 1.08, 1.2]) {
    const rib = mesh(group, new THREE.TorusGeometry(0.13, 0.018, 4, 8, Math.PI * 1.25), bone, [0.13, y, 0], [1, 1, 1], [0, Math.PI / 2, -0.65]);
    rib.name = 'lich-rib';
  }
}

function addWraith(group: THREE.Group): void {
  const spectral = material(0x668fa0, {
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    side: THREE.DoubleSide,
    emissive: 0x243e51,
    emissiveIntensity: 0.65,
  });
  const shroud = material(0x35475b, {
    transparent: true,
    opacity: 0.84,
    side: THREE.DoubleSide,
    emissive: 0x172b3c,
    emissiveIntensity: 0.5,
  });
  const darkness = material(0x17232f);
  const glowSurface = glow(0x9be8df, 0.9);

  const body = mesh(group, new THREE.CylinderGeometry(0.16, 0.37, 1.08, 7, 1, true), shroud, [0, 0.59, 0]);
  body.name = 'wraith-shroud';
  body.userData.anatomy = 'shroud';
  const core = mesh(group, new THREE.IcosahedronGeometry(0.27, 1), spectral, [-0.01, 1.11, 0], [0.82, 1.18, 0.85]);
  core.name = 'wraith-spectral-core';

  for (const [x, z, height] of [[0.08, -0.23, 0.4], [-0.1, 0, 0.48], [0.08, 0.23, 0.4]] as const) {
    const wisp = cone(group, 0.085, height, spectral, [x, height / 2, z], 5);
    wisp.rotation.z = Math.PI;
    wisp.name = 'wraith-ground-wisp';
  }

  const face = mesh(group, new THREE.DodecahedronGeometry(0.18, 0), darkness, [0.055, 1.49, 0], [0.88, 1.06, 0.9]);
  face.name = 'wraith-face-shadow';
  const hood = mesh(group, new THREE.TorusGeometry(0.215, 0.06, 5, 9), shroud, [0.055, 1.49, 0], [1, 1.14, 1], [0, Math.PI / 2, 0]);
  hood.name = 'wraith-hood';
  hood.userData.anatomy = 'hood';
  const peak = cone(group, 0.24, 0.42, shroud, [-0.055, 1.68, 0], 7);
  peak.rotation.z = -0.2;
  peak.name = 'wraith-hood-peak';
  eyes(group, 0x9bf5e7, 0.205, 1.52, 0.072);

  for (const side of [-1, 1]) {
    beam(group, [0, 1.19, side * 0.22], [0.28, 0.89, side * 0.5], 0.065, spectral);
    const claw = mesh(group, new THREE.OctahedronGeometry(0.09, 0), spectral, [0.3, 0.86, side * 0.53]);
    claw.name = side < 0 ? 'wraith-claw-left' : 'wraith-claw-right';
    claw.userData.anatomy = 'claw';
    for (const offset of [-0.055, 0, 0.055]) {
      beam(group, [0.32, 0.84, side * 0.53 + offset], [0.49, 0.69, side * 0.55 + offset], 0.018, glowSurface);
    }
    const tatter = mesh(group, new THREE.ConeGeometry(0.1, 0.58, 5, 1, true), shroud, [-0.12, 0.68, side * 0.28], [1, 1, 1], [0, 0, side * 0.24 + Math.PI]);
    tatter.name = 'wraith-tatter';
  }

  for (const [x, y, z] of [[-0.2, 1.13, -0.28], [-0.18, 0.86, 0.3], [0.04, 1.87, 0]] as const) {
    const mote = mesh(group, new THREE.OctahedronGeometry(0.045, 0), glowSurface, [x, y, z]);
    mote.name = 'wraith-soul-mote';
  }
}

const UNDEAD_SPECS: Record<string, UndeadSpec> = {
  lich: {
    archetype: 'crowned-undead-caster',
    palette: [0x403653, 0x82dfb0, 0xc5c0a5],
    build: addLich,
  },
  wraith: {
    archetype: 'hooded-spectral-revenant',
    palette: [0x35475b, 0x9be8df, 0x17232f],
    build: addWraith,
  },
};

export function createUndeadMonsterModel(
  creatureId: string,
  side: BattleSideId,
): THREE.Group | null {
  const spec = Object.hasOwn(UNDEAD_SPECS, creatureId) ? UNDEAD_SPECS[creatureId] : undefined;
  if (!spec) return null;
  const group = new THREE.Group();
  spec.build(group);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.rotation.y = side === 'attacker' ? 0 : Math.PI;
  group.name = `creature-${creatureId}`;
  group.userData.creatureId = creatureId as UndeadId;
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
