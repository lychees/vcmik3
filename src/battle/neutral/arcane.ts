import * as THREE from 'three';
import type { BattleSideId } from '../types';

type VectorTuple = [number, number, number];

interface ArcaneSpec {
  archetype: string;
  palette: [number, number, number];
  build: (group: THREE.Group) => void;
}

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness: 0.78, flatShading: true, ...extra });
  result.userData.baseColor = result.color.getHex();
  return result;
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: VectorTuple,
  name: string,
  scale: VectorTuple = [1, 1, 1],
  rotation: VectorTuple = [0, 0, 0],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(...position);
  result.scale.set(...scale);
  result.rotation.set(...rotation);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function segment(
  parent: THREE.Object3D,
  start: VectorTuple,
  end: VectorTuple,
  radius: number,
  surface: THREE.Material,
  name: string,
  tipRadius = radius * 0.82,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const direction = new THREE.Vector3(...end).sub(from);
  const result = mesh(
    parent,
    new THREE.CylinderGeometry(tipRadius, radius, direction.length(), 7),
    surface,
    from.addScaledVector(direction, 0.5).toArray(),
    name,
  );
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function addGolem(group: THREE.Group): void {
  const stone = material(0x718087);
  const armor = material(0x9aabb0, { metalness: 0.28, roughness: 0.6 });
  const dark = material(0x303c46);
  const rune = material(0x79e6e1, { emissive: 0x2f9eaa, emissiveIntensity: 0.85 });
  const crystal = material(0xa98be8, { emissive: 0x493477, emissiveIntensity: 0.55 });

  for (const side of [-1, 1]) {
    mesh(group, new THREE.BoxGeometry(0.42, 0.16, 0.3), dark, [0.08, 0.08, side * 0.23], `golem-foot-${side}`);
    mesh(group, new THREE.CylinderGeometry(0.13, 0.17, 0.58, 6), stone, [-0.03, 0.43, side * 0.23], `golem-leg-${side}`);
    mesh(group, new THREE.OctahedronGeometry(0.16, 0), armor, [0.14, 0.56, side * 0.23], `golem-knee-${side}`, [0.65, 1, 1]);
  }
  mesh(group, new THREE.BoxGeometry(0.5, 0.24, 0.62), dark, [0, 0.8, 0], 'golem-hips');
  mesh(group, new THREE.DodecahedronGeometry(0.55, 0), stone, [0, 1.25, 0], 'golem-body', [0.85, 1.05, 1.05]);
  mesh(group, new THREE.BoxGeometry(0.12, 0.48, 0.68), armor, [0.4, 1.29, 0], 'golem-chest-plate');
  mesh(group, new THREE.OctahedronGeometry(0.16, 0), rune, [0.49, 1.28, 0], 'golem-core', [0.45, 1, 1]);
  for (const y of [1.09, 1.47]) {
    mesh(group, new THREE.BoxGeometry(0.025, 0.035, 0.32), rune, [0.47, y, 0], `golem-rune-${y}`);
  }
  mesh(group, new THREE.DodecahedronGeometry(0.3, 0), stone, [0.02, 1.85, 0], 'golem-head', [1, 0.85, 0.9]);
  mesh(group, new THREE.BoxGeometry(0.4, 0.15, 0.52), armor, [0, 2.04, 0], 'golem-crown');
  mesh(group, new THREE.ConeGeometry(0.12, 0.28, 5), crystal, [0, 2.25, 0], 'golem-crown-crystal');
  for (const side of [-1, 1]) {
    mesh(group, new THREE.SphereGeometry(0.04, 6, 4), rune, [0.275, 1.88, side * 0.1], `golem-eye-${side}`);
    mesh(group, new THREE.DodecahedronGeometry(0.27, 0), armor, [0, 1.5, side * 0.58], `golem-shoulder-${side}`, [1, 0.85, 1.1]);
    segment(group, [0, 1.42, side * 0.61], [0.06, 1.02, side * 0.67], 0.14, stone, `golem-upper-arm-${side}`);
    segment(group, [0.06, 1.02, side * 0.67], [0.18, 0.72, side * 0.69], 0.17, armor, `golem-forearm-${side}`);
    mesh(group, new THREE.DodecahedronGeometry(0.23, 0), dark, [0.22, 0.62, side * 0.7], `golem-fist-${side}`, [1.05, 0.9, 1]);
    mesh(group, new THREE.BoxGeometry(0.04, 0.18, 0.12), rune, [0.23, 0.96, side * 0.68], `golem-arm-rune-${side}`);
    mesh(group, new THREE.ConeGeometry(0.11, 0.35, 5), crystal, [-0.05, 1.83, side * 0.62], `golem-shoulder-crystal-${side}`);
  }
}

function addBeholder(group: THREE.Group): void {
  const hide = material(0x76538c);
  const hideLight = material(0x9b6aa4);
  const dark = material(0x34243f);
  const eyeWhite = material(0xe7dbb4, { roughness: 0.42 });
  const iris = material(0x77dbc8, { emissive: 0x286f70, emissiveIntensity: 0.7 });
  const pupil = material(0x10151c, { roughness: 0.3 });
  const teeth = material(0xe6d3a3);

  mesh(group, new THREE.IcosahedronGeometry(0.5, 1), hide, [-0.05, 1.14, 0], 'beholder-body', [1.05, 0.9, 1]);
  mesh(group, new THREE.SphereGeometry(0.21, 12, 8), eyeWhite, [0.42, 1.27, 0], 'beholder-eye', [0.38, 1, 1]);
  mesh(group, new THREE.SphereGeometry(0.115, 10, 7), iris, [0.497, 1.27, 0], 'beholder-iris', [0.25, 1, 1]);
  mesh(group, new THREE.SphereGeometry(0.058, 8, 6), pupil, [0.525, 1.27, 0], 'beholder-pupil', [0.2, 1, 1]);
  mesh(group, new THREE.SphereGeometry(0.16, 10, 6), dark, [0.42, 0.94, 0], 'beholder-maw', [0.15, 0.65, 1]);
  mesh(group, new THREE.TorusGeometry(0.16, 0.035, 6, 12), hideLight, [0.435, 0.94, 0], 'beholder-mouth', [1, 0.65, 1], [0, Math.PI / 2, 0]);
  for (const [y, z] of [[1.015, -0.07], [1.015, 0.07], [0.875, -0.07], [0.875, 0.07]] as const) {
    mesh(group, new THREE.ConeGeometry(0.025, 0.09, 5), teeth, [0.49, y, z], `beholder-tooth-${y}-${z}`, [1, 1, 1], [0, 0, -Math.PI / 2]);
  }

  const stalks: Array<[VectorTuple, VectorTuple]> = [
    [[-0.18, 1.48, -0.28], [-0.28, 2.02, -0.42]],
    [[0.02, 1.55, -0.2], [0.12, 2.14, -0.22]],
    [[0.17, 1.48, -0.12], [0.4, 1.95, -0.22]],
    [[-0.18, 1.48, 0.28], [-0.28, 2.02, 0.42]],
    [[0.02, 1.55, 0.2], [0.12, 2.14, 0.22]],
    [[0.17, 1.48, 0.12], [0.4, 1.95, 0.22]],
  ];
  stalks.forEach(([start, end], index) => {
    segment(group, start, end, 0.045, hideLight, `beholder-eyestalk-${index}`, 0.028);
    mesh(group, new THREE.SphereGeometry(0.085, 8, 6), eyeWhite, end, `beholder-stalk-eye-${index}`);
    mesh(group, new THREE.SphereGeometry(0.035, 7, 5), pupil, [end[0] + 0.072, end[1], end[2]], `beholder-stalk-pupil-${index}`, [0.45, 1, 1]);
  });

  for (const [x, z] of [[-0.22, -0.22], [-0.22, 0.22], [0.12, -0.22], [0.12, 0.22]] as const) {
    const middle: VectorTuple = [x - 0.05, 0.4, z * 1.35];
    segment(group, [x, 0.8, z], middle, 0.065, hide, `beholder-tendril-upper-${x}-${z}`);
    segment(group, middle, [x + 0.03, 0, z * 1.55], 0.06, hideLight, `beholder-tendril-tip-${x}-${z}`, 0.008);
  }
}

const ARCANE_MONSTERS: Record<string, ArcaneSpec> = {
  golem: { archetype: 'runic-stone-construct', palette: [0x718087, 0x79e6e1, 0x303c46], build: addGolem },
  beholder: { archetype: 'many-eyed-floating-tyrant', palette: [0x76538c, 0x77dbc8, 0x34243f], build: addBeholder },
};

export function createArcaneMonsterModel(creatureId: string, side: BattleSideId): THREE.Group | null {
  if (!Object.hasOwn(ARCANE_MONSTERS, creatureId)) return null;
  const spec = ARCANE_MONSTERS[creatureId]!;
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.name = `${creatureId}-form`;
  spec.build(body);
  group.add(body);
  const ungroundedBounds = new THREE.Box3().setFromObject(body);
  body.position.y -= ungroundedBounds.min.y;
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.rotation.y = side === 'attacker' ? 0 : Math.PI;
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
