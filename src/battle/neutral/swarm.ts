import * as THREE from 'three';
import type { BattleSideId } from '../types';

type Palette = [number, number, number];

interface SwarmSpec {
  archetype: string;
  palette: Palette;
  build: (group: THREE.Group, palette: Palette) => void;
}

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.84, ...extra });
  result.userData.baseColor = result.color.getHex();
  return result;
}

function addMesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0],
  name?: string,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(...position);
  result.scale.set(...scale);
  result.rotation.set(...rotation);
  result.castShadow = true;
  result.receiveShadow = true;
  if (name) result.name = name;
  group.add(result);
  return result;
}

function addSegment(
  group: THREE.Group,
  start: [number, number, number],
  end: [number, number, number],
  startRadius: number,
  endRadius: number,
  surface: THREE.Material,
  name?: string,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const result = addMesh(
    group,
    new THREE.CylinderGeometry(endRadius, startRadius, direction.length(), 6),
    surface,
    from.add(to).multiplyScalar(0.5).toArray(),
    [1, 1, 1],
    [0, 0, 0],
    name,
  );
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function addEye(group: THREE.Group, surface: THREE.Material, position: [number, number, number], radius: number): void {
  addMesh(group, new THREE.SphereGeometry(radius, 6, 4), surface, position);
}

function addRatling(group: THREE.Group, palette: Palette): void {
  const fur = material(palette[0]);
  const skin = material(0xb9897d);
  const dark = material(palette[2]);
  const eye = material(palette[1], { emissive: 0x4a350e, emissiveIntensity: 0.45 });
  const tooth = material(0xe4d9b9);
  const blade = material(0x9da8a3, { metalness: 0.55, roughness: 0.5 });

  addMesh(group, new THREE.DodecahedronGeometry(0.29, 0), fur, [-0.09, 0.68, 0], [0.9, 1.25, 0.86], [0, 0, -0.18], 'ratling-body');
  addMesh(group, new THREE.DodecahedronGeometry(0.22, 0), fur, [0.12, 1.08, 0], [1.08, 0.92, 0.92], [0, 0, -0.1], 'ratling-head');
  addMesh(group, new THREE.ConeGeometry(0.12, 0.34, 6), skin, [0.36, 1.01, 0], [1, 1, 0.86], [0, 0, -Math.PI / 2], 'ratling-snout');
  addMesh(group, new THREE.DodecahedronGeometry(0.055, 0), dark, [0.535, 1.01, 0], [1, 0.85, 0.85]);
  addEye(group, eye, [0.255, 1.135, 0.135], 0.038);
  addEye(group, eye, [0.255, 1.135, -0.135], 0.038);

  for (const side of [-1, 1]) {
    addMesh(group, new THREE.ConeGeometry(0.12, 0.3, 6), fur, [0.025, 1.34, side * 0.15], [1, 1, 0.72], [side * 0.2, 0, -0.18], 'ratling-ear');
    addMesh(group, new THREE.ConeGeometry(0.062, 0.19, 6), skin, [0.055, 1.345, side * 0.155], [1, 1, 0.7], [side * 0.2, 0, -0.18]);
    addMesh(group, new THREE.ConeGeometry(0.025, 0.14, 5), tooth, [0.43, 0.91, side * 0.038], [1, 1, 1], [0, 0, Math.PI], 'ratling-incisor');

    addSegment(group, [-0.07, 0.48, side * 0.13], [-0.09, 0.24, side * 0.16], 0.075, 0.058, dark, 'ratling-leg');
    addMesh(group, new THREE.BoxGeometry(0.3, 0.1, 0.16), dark, [0.045, 0.05, side * 0.17], [1, 1, 1], [0, 0, 0], 'ratling-foot');
    for (const offset of [-0.045, 0.045]) {
      addMesh(group, new THREE.ConeGeometry(0.018, 0.12, 5), tooth, [0.23, 0.055, side * 0.17 + offset], [1, 1, 1], [0, 0, -Math.PI / 2], 'ratling-claw');
    }

    addSegment(group, [0.02, 0.86, side * 0.24], [0.16, 0.65, side * 0.32], 0.065, 0.048, fur, 'ratling-arm');
    addSegment(group, [0.16, 0.65, side * 0.32], [0.31, 0.55, side * 0.35], 0.048, 0.035, skin);
    addMesh(group, new THREE.DodecahedronGeometry(0.06, 0), skin, [0.32, 0.54, side * 0.35]);
  }

  const tailPoints: Array<[number, number, number]> = [
    [-0.28, 0.48, 0],
    [-0.55, 0.32, 0.025],
    [-0.82, 0.2, 0.09],
    [-1.06, 0.13, 0.18],
  ];
  for (let index = 0; index < tailPoints.length - 1; index += 1) {
    addSegment(group, tailPoints[index]!, tailPoints[index + 1]!, 0.06 - index * 0.014, 0.046 - index * 0.014, skin, 'ratling-tail');
  }

  addSegment(group, [0.3, 0.5, -0.37], [0.42, 0.72, -0.38], 0.028, 0.028, dark, 'ratling-dagger-grip');
  addMesh(group, new THREE.BoxGeometry(0.2, 0.035, 0.045), blade, [0.39, 0.65, -0.38], [1, 1, 1], [0, 0, -0.5]);
  addMesh(group, new THREE.ConeGeometry(0.055, 0.42, 4), blade, [0.51, 0.91, -0.38], [1, 1, 0.45], [0, 0, -0.5], 'ratling-dagger');
}

function addBroodMother(group: THREE.Group, palette: Palette): void {
  const fur = material(palette[0]);
  const skin = material(0xa9757c);
  const dark = material(palette[2]);
  const bone = material(0xd2c39f);
  const sac = material(palette[1], { roughness: 0.62 });
  const eye = material(0xf0b84d, { emissive: 0x6b340c, emissiveIntensity: 0.65 });

  addMesh(group, new THREE.DodecahedronGeometry(0.56, 0), fur, [-0.3, 0.8, 0], [1.4, 1.05, 1.14], [0, 0, 0.06], 'broodMother-abdomen');
  addMesh(group, new THREE.DodecahedronGeometry(0.4, 0), fur, [0.34, 1.04, 0], [1.1, 1.1, 1], [0, 0, -0.2], 'broodMother-shoulders');
  addMesh(group, new THREE.DodecahedronGeometry(0.3, 0), fur, [0.68, 1.36, 0], [1.15, 0.9, 0.96], [0, 0, -0.12], 'broodMother-head');
  addMesh(group, new THREE.ConeGeometry(0.17, 0.46, 6), skin, [0.99, 1.25, 0], [1, 1, 0.9], [0, 0, -Math.PI / 2], 'broodMother-snout');
  addMesh(group, new THREE.DodecahedronGeometry(0.075, 0), dark, [1.225, 1.25, 0], [1, 0.85, 0.9]);

  for (const side of [-1, 1]) {
    addEye(group, eye, [0.82, 1.43, side * 0.18], 0.047);
    addEye(group, eye, [0.69, 1.51, side * 0.155], 0.032);
    addMesh(group, new THREE.ConeGeometry(0.16, 0.38, 6), fur, [0.55, 1.66, side * 0.22], [1, 1, 0.72], [side * 0.3, 0, -0.25], 'broodMother-ear');
    addMesh(group, new THREE.ConeGeometry(0.04, 0.25, 5), bone, [1.08, 1.09, side * 0.065], [1, 1, 1], [0, 0, Math.PI], 'broodMother-incisor');

    for (let index = 0; index < 3; index += 1) {
      const x = -0.59 + index * 0.4;
      const hip: [number, number, number] = [x, 0.78 + index * 0.06, side * 0.4];
      const knee: [number, number, number] = [x - 0.1 + index * 0.07, 0.4, side * (0.64 + index * 0.055)];
      const ankle: [number, number, number] = [x + 0.08, 0.1, side * (0.78 + index * 0.055)];
      addSegment(group, hip, knee, 0.105, 0.078, fur, `broodMother-leg-${side}-${index}`);
      addSegment(group, knee, ankle, 0.078, 0.045, skin, `broodMother-leg-${side}-${index}`);
      addMesh(group, new THREE.BoxGeometry(0.25, 0.1, 0.17), dark, [ankle[0] + 0.07, 0.05, ankle[2]], [1, 1, 1], [0, 0, 0], 'broodMother-foot');
      addMesh(group, new THREE.ConeGeometry(0.028, 0.18, 5), bone, [ankle[0] + 0.25, 0.06, ankle[2]], [1, 1, 1], [0, 0, -Math.PI / 2], 'broodMother-claw');
    }

    for (let index = 0; index < 3; index += 1) {
      addMesh(
        group,
        new THREE.DodecahedronGeometry(0.18 - index * 0.012, 1),
        sac,
        [-0.63 + index * 0.29, 0.79 + index * 0.11, side * (0.47 + index * 0.015)],
        [1, 1.2, 0.82],
        [0, 0, -0.15],
        'broodMother-brood-sac',
      );
    }
  }

  const tailPoints: Array<[number, number, number]> = [
    [-0.91, 0.57, 0],
    [-1.13, 0.38, -0.04],
    [-1.35, 0.23, -0.13],
    [-1.52, 0.14, -0.27],
  ];
  for (let index = 0; index < tailPoints.length - 1; index += 1) {
    addSegment(group, tailPoints[index]!, tailPoints[index + 1]!, 0.1 - index * 0.024, 0.076 - index * 0.024, skin, 'broodMother-tail');
  }

  for (const x of [-0.68, -0.39, -0.1]) {
    addMesh(group, new THREE.ConeGeometry(0.085, 0.37, 5), bone, [x, 1.39, 0], [1, 1, 1], [0, 0, -0.16], 'broodMother-spine');
  }
  for (const z of [-0.2, 0, 0.2]) {
    addMesh(group, new THREE.ConeGeometry(0.07, 0.4, 5), bone, [0.57, 1.79, z], [1, 1, 1], [0, 0, -0.25], 'broodMother-crown');
  }
}

const SWARM_SPECS: Record<string, SwarmSpec> = {
  ratling: { archetype: 'rodent-scavenger', palette: [0x716359, 0xe2b34f, 0x2d2929], build: addRatling },
  broodMother: { archetype: 'brood-queen', palette: [0x55434c, 0x8e9b61, 0x282129], build: addBroodMother },
};

export function createSwarmMonsterModel(creatureId: string, side: BattleSideId): THREE.Group | null {
  const spec = Object.hasOwn(SWARM_SPECS, creatureId) ? SWARM_SPECS[creatureId] : undefined;
  if (!spec) return null;
  const group = new THREE.Group();
  spec.build(group, spec.palette);
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
  group.userData.labelHeight = bounds.max.y + 0.45;
  group.userData.palette = [...spec.palette];
  group.userData.factionColor = spec.palette[0];
  return group;
}
