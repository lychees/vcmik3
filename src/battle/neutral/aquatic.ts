import * as THREE from 'three';
import type { BattleSideId } from '../types';

type Vec3 = [number, number, number];

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.82, ...extra });
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: Vec3,
  scale: Vec3 = [1, 1, 1],
  rotation: Vec3 = [0, 0, 0],
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
  position: Vec3,
  segments = 7,
): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, position);
}

function cone(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  surface: THREE.Material,
  position: Vec3,
  segments = 7,
): THREE.Mesh {
  return mesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, position);
}

function segment(
  parent: THREE.Object3D,
  start: Vec3,
  end: Vec3,
  startRadius: number,
  endRadius: number,
  surface: THREE.Material,
  name?: string,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const direction = new THREE.Vector3(...end).sub(from);
  const midpoint = from.clone().addScaledVector(direction, 0.5);
  const result = mesh(
    parent,
    new THREE.CylinderGeometry(endRadius, startRadius, direction.length(), 6),
    surface,
    midpoint.toArray(),
  );
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  if (name) result.name = name;
  return result;
}

function addKraken(body: THREE.Group): void {
  const skin = material(0x355f70);
  const mantle = material(0x477f88);
  const underside = material(0x78a99d);
  const dark = material(0x172d3a);
  const eye = material(0xe7c85c, { emissive: 0x6d5318, emissiveIntensity: 0.5 });
  const fin = material(0x5d9b91, { side: THREE.DoubleSide });

  mesh(body, new THREE.DodecahedronGeometry(0.4, 0), underside, [0, 0.79, 0], [1.05, 0.95, 1]).name = 'kraken-body';
  mesh(body, new THREE.IcosahedronGeometry(0.45, 1), mantle, [-0.08, 1.24, 0], [0.9, 1.3, 0.88]).name = 'kraken-mantle';
  mesh(body, new THREE.ConeGeometry(0.19, 0.38, 6), mantle, [-0.15, 1.78, 0], [0.85, 1, 0.85]).name = 'kraken-crown';

  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'left' : 'right';
    mesh(body, new THREE.SphereGeometry(0.09, 8, 6), eye, [0.265, 1.34, side * 0.235], [0.72, 1, 1]).name = `kraken-eye-${suffix}`;
    mesh(body, new THREE.SphereGeometry(0.038, 6, 5), dark, [0.326, 1.34, side * 0.235], [0.65, 1, 1]).name = `kraken-pupil-${suffix}`;
    mesh(
      body,
      new THREE.ConeGeometry(0.22, 0.5, 3),
      fin,
      [-0.22, 1.28, side * 0.4],
      [0.8, 1, 0.5],
      [side * 1.12, 0, -0.18],
    ).name = `kraken-fin-${suffix}`;
  }
  cone(body, 0.13, 0.3, dark, [0.37, 1.04, 0], 5).rotation.z = -Math.PI / 2;
  const beak = body.children[body.children.length - 1];
  if (beak) beak.name = 'kraken-beak';

  const suckerGeometry = new THREE.TorusGeometry(0.036, 0.012, 4, 7);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    const radial = new THREE.Vector2(Math.cos(angle), Math.sin(angle));
    const tangent = new THREE.Vector2(-Math.sin(angle), Math.cos(angle));
    const curl = index % 2 === 0 ? 0.12 : -0.12;
    const points: Vec3[] = [
      [radial.x * 0.21, 0.76, radial.y * 0.21],
      [radial.x * 0.48, 0.36, radial.y * 0.48],
      [radial.x * 0.78, 0.13, radial.y * 0.78],
      [radial.x * 0.9 + tangent.x * curl, 0.075, radial.y * 0.9 + tangent.y * curl],
    ];
    const tentacle = new THREE.Group();
    tentacle.name = `kraken-tentacle-${index}`;
    tentacle.userData.anatomy = 'tentacle';
    body.add(tentacle);
    const radii = [0.115, 0.088, 0.052, 0.018];
    for (let part = 0; part < 3; part += 1) {
      segment(tentacle, points[part]!, points[part + 1]!, radii[part]!, radii[part + 1]!, skin, `kraken-arm-${index}-segment-${part}`);
    }
    const cupPosition = new THREE.Vector3(...points[1]!).lerp(new THREE.Vector3(...points[2]!), 0.64);
    cupPosition.y -= 0.048;
    mesh(body, suckerGeometry, underside, cupPosition.toArray(), [1, 1, 1], [Math.PI / 2, 0, angle]).name = `kraken-sucker-${index}`;
  }
}

function addSeaHag(body: THREE.Group): void {
  const robe = material(0x354d5b);
  const robeEdge = material(0x52746f);
  const skin = material(0x7da28c);
  const hair = material(0x345c4d);
  const dark = material(0x202d35);
  const wood = material(0x554238);
  const eye = material(0xb9e37b, { emissive: 0x6c9b45, emissiveIntensity: 0.8 });
  const pearl = material(0x9ee4d5, { emissive: 0x4f9e94, emissiveIntensity: 0.75, roughness: 0.35 });

  cone(body, 0.38, 0.84, robe, [0, 0.44, 0], 8).name = 'sea-hag-robe';
  for (let index = 0; index < 7; index += 1) {
    const angle = index * Math.PI * 2 / 7;
    const tatter = cone(
      body,
      0.065,
      0.2 + (index % 2) * 0.05,
      robeEdge,
      [Math.cos(angle) * 0.27, 0.105, Math.sin(angle) * 0.27],
      4,
    );
    tatter.rotation.z = Math.PI;
    tatter.name = `sea-hag-tatter-${index}`;
  }
  cylinder(body, 0.18, 0.27, 0.57, robe, [0.045, 0.99, 0], 7).rotation.z = -0.13;
  const shawl = mesh(body, new THREE.TorusGeometry(0.255, 0.055, 5, 9), robeEdge, [0.075, 1.19, 0], [1, 1, 0.9], [Math.PI / 2, 0, 0]);
  shawl.name = 'sea-hag-shawl';
  mesh(body, new THREE.DodecahedronGeometry(0.2, 0), skin, [0.17, 1.43, 0], [0.9, 1.12, 0.9]).name = 'sea-hag-head';
  mesh(body, new THREE.DodecahedronGeometry(0.215, 0), hair, [0.055, 1.54, 0], [0.95, 0.82, 1.05]).name = 'sea-hag-hair-cap';
  cone(body, 0.055, 0.26, skin, [0.375, 1.42, 0], 5).rotation.z = -Math.PI / 2;
  const nose = body.children[body.children.length - 1];
  if (nose) nose.name = 'sea-hag-nose';

  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'left' : 'right';
    mesh(body, new THREE.SphereGeometry(0.037, 6, 5), eye, [0.314, 1.5, side * 0.087]).name = `sea-hag-eye-${suffix}`;
    cone(body, 0.07, 0.25, robeEdge, [0.11, 1.43, side * 0.215], 5).rotation.x = side * Math.PI / 2;
    const ear = body.children[body.children.length - 1];
    if (ear) ear.name = `sea-hag-ear-${suffix}`;
    segment(body, [0.07, 1.13, side * 0.23], [0.245, 0.85, side * 0.36], 0.07, 0.043, robe, `sea-hag-arm-${suffix}`);
    mesh(body, new THREE.DodecahedronGeometry(0.06, 0), skin, [0.25, 0.83, side * 0.37], [1.25, 0.75, 0.85]).name = `sea-hag-claw-${suffix}`;
    for (let claw = 0; claw < 2; claw += 1) {
      const nail = cone(body, 0.014, 0.11, dark, [0.31, 0.81, side * 0.37 + (claw - 0.5) * 0.035], 4);
      nail.rotation.z = -Math.PI / 2;
    }
  }

  for (let index = 0; index < 6; index += 1) {
    const z = (index - 2.5) * 0.078;
    segment(
      body,
      [0.035, 1.52 - Math.abs(z) * 0.3, z],
      [-0.045 + (index % 2) * 0.04, 0.96 + (index % 3) * 0.06, z * 1.35],
      0.047,
      0.014,
      hair,
      `sea-hag-hair-${index}`,
    );
  }
  mesh(body, new THREE.SphereGeometry(0.022, 5, 4), dark, [0.323, 1.38, 0.068]).name = 'sea-hag-wart';

  segment(body, [0.25, 0.035, -0.44], [0.42, 1.57, -0.44], 0.029, 0.021, wood, 'sea-hag-staff');
  segment(body, [0.42, 1.48, -0.44], [0.3, 1.68, -0.44], 0.023, 0.016, wood, 'sea-hag-staff-crook');
  mesh(body, new THREE.TorusGeometry(0.115, 0.022, 5, 10), robeEdge, [0.3, 1.69, -0.44], [1, 1, 1], [0, Math.PI / 2, 0]).name = 'sea-hag-shell';
  mesh(body, new THREE.IcosahedronGeometry(0.082, 1), pearl, [0.3, 1.71, -0.44]).name = 'sea-hag-pearl';
  segment(body, [0.245, 1.04, 0], [0.27, 0.91, 0], 0.012, 0.012, pearl, 'sea-hag-pendant-cord');
  mesh(body, new THREE.OctahedronGeometry(0.055, 0), pearl, [0.27, 0.89, 0], [0.55, 1.25, 0.8]).name = 'sea-hag-pendant';
}

function finishModel(
  creatureId: 'kraken' | 'seaHag',
  side: BattleSideId,
  body: THREE.Group,
  palette: [number, number, number],
): THREE.Group {
  const group = new THREE.Group();
  body.name = `${creatureId}-body`;
  group.add(body);
  const ungrounded = new THREE.Box3().setFromObject(body);
  body.position.y = -ungrounded.min.y;
  group.rotation.y = side === 'defender' ? Math.PI : 0;
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.name = `creature-${creatureId}`;
  group.userData.creatureId = creatureId;
  group.userData.faction = 'Neutral';
  group.userData.archetype = creatureId === 'kraken' ? 'eight-armed-sea-monster' : 'tide-witch';
  group.userData.animationPivot = 'ground';
  group.userData.side = side;
  group.userData.visualHeight = size.y;
  group.userData.labelHeight = Math.max(1.85, bounds.max.y + 0.45);
  group.userData.palette = palette;
  group.userData.factionColor = palette[0];
  group.userData.modelPack = 'aquatic';
  return group;
}

export function createAquaticMonsterModel(creatureId: string, side: BattleSideId): THREE.Group | null {
  if (creatureId !== 'kraken' && creatureId !== 'seaHag') return null;
  const body = new THREE.Group();
  if (creatureId === 'kraken') {
    addKraken(body);
    return finishModel(creatureId, side, body, [0x477f88, 0x78a99d, 0x172d3a]);
  }
  addSeaHag(body);
  return finishModel(creatureId, side, body, [0x354d5b, 0x9ee4d5, 0x202d35]);
}
