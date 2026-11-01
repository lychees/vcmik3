import * as THREE from 'three';

type ForestCreatureId = 'ent' | 'giantSpider';
type BattleSide = 'attacker' | 'defender';
type Vec3 = [number, number, number];

interface ForestSpec {
  archetype: string;
  palette: [number, number, number];
  build: (group: THREE.Group) => void;
}

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness: 0.86, flatShading: true, ...extra });
  result.userData.baseColor = color;
  return result;
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: Vec3,
  scale: Vec3 = [1, 1, 1],
  rotation: Vec3 = [0, 0, 0],
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

function addLimb(
  parent: THREE.Object3D,
  start: Vec3,
  end: Vec3,
  startRadius: number,
  endRadius: number,
  surface: THREE.Material,
  name?: string,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const result = addMesh(
    parent,
    new THREE.CylinderGeometry(endRadius, startRadius, direction.length(), 6),
    surface,
    from.clone().add(to).multiplyScalar(0.5).toArray(),
    [1, 1, 1],
    [0, 0, 0],
    name,
  );
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function addEnt(group: THREE.Group): void {
  const bark = material(0x69503a);
  const darkBark = material(0x3e3328);
  const cutWood = material(0xa08052);
  const leaves = material(0x496b3d);
  const newGrowth = material(0x7f9b4b);
  const moss = material(0x60764a);
  const eyes = material(0xe4bd63, { emissive: 0xb47b24, emissiveIntensity: 0.75 });

  addMesh(group, new THREE.CylinderGeometry(0.29, 0.39, 1.2, 7), bark, [0, 1.22, 0], [1, 1, 1], [0, 0, 0], 'ent-trunk');
  addMesh(group, new THREE.DodecahedronGeometry(0.43, 0), bark, [0.01, 1.4, 0], [0.9, 1.2, 0.92], [0, 0, 0], 'ent-chest');
  addMesh(group, new THREE.CylinderGeometry(0.31, 0.34, 0.12, 7), darkBark, [0, 0.78, 0]);
  addMesh(group, new THREE.BoxGeometry(0.045, 0.68, 0.055), cutWood, [0.335, 1.28, 0.02], [1, 1, 1], [0, 0, -0.08], 'ent-heartwood');

  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3;
    addLimb(
      group,
      [0, 0.24, 0],
      [Math.cos(angle) * 0.5, 0.14, Math.sin(angle) * 0.5],
      0.1,
      0.035,
      darkBark,
      `ent-root-${index}`,
    );
  }

  for (const side of [-1, 1]) {
    const z = side * 0.22;
    addLimb(group, [0, 0.94, side * 0.17], [-0.05, 0.53, z], 0.14, 0.12, bark);
    addLimb(group, [-0.05, 0.53, z], [0.02, 0.15, z], 0.12, 0.09, darkBark);
    addMesh(group, new THREE.BoxGeometry(0.4, 0.14, 0.25), darkBark, [0.12, 0.07, z], [1, 1, 1], [0, 0, 0], `ent-foot-${side}`);

    addLimb(group, [0, 1.67, side * 0.34], [0.03, 1.28, side * 0.63], 0.14, 0.105, bark, `ent-upper-arm-${side}`);
    addLimb(group, [0.03, 1.28, side * 0.63], [0.25, 1.08, side * 0.84], 0.105, 0.065, darkBark, `ent-forearm-${side}`);
    addMesh(group, new THREE.DodecahedronGeometry(0.12, 0), bark, [0.26, 1.07, side * 0.85]);
    for (let finger = 0; finger < 3; finger += 1) {
      addLimb(
        group,
        [0.28, 1.06, side * (0.79 + finger * 0.055)],
        [0.43 - finger * 0.035, 0.91 + finger * 0.055, side * (0.85 + finger * 0.07)],
        0.035,
        0.012,
        darkBark,
      );
    }

    addLimb(group, [0, 2.04, side * 0.12], [-0.04, 2.39, side * 0.27], 0.075, 0.045, bark, `ent-antler-base-${side}`);
    addLimb(group, [-0.04, 2.39, side * 0.27], [0.05, 2.65, side * 0.45], 0.045, 0.015, darkBark, `ent-antler-tip-${side}`);
    addLimb(group, [-0.03, 2.34, side * 0.25], [-0.19, 2.49, side * 0.43], 0.035, 0.01, darkBark);
    addMesh(group, new THREE.SphereGeometry(0.041, 6, 4), eyes, [0.277, 2.02, side * 0.108], [1, 1, 1], [0, 0, 0], `ent-eye-${side}`);
    addLimb(group, [0.19, 2.12, side * 0.18], [0.3, 2.15, side * 0.09], 0.035, 0.025, darkBark);
  }

  addMesh(group, new THREE.DodecahedronGeometry(0.3, 0), bark, [0.025, 1.96, 0], [0.92, 1.08, 0.94], [0, 0, 0], 'ent-head');
  addMesh(group, new THREE.ConeGeometry(0.055, 0.2, 5), cutWood, [0.33, 1.94, 0], [1, 1, 1], [0, 0, -Math.PI / 2], 'ent-nose');
  for (const z of [-0.11, 0, 0.11]) {
    addMesh(group, new THREE.ConeGeometry(0.085, 0.38 - Math.abs(z) * 0.5, 5), moss, [0.2, 1.69, z], [1, 1, 1], [0, 0, Math.PI]);
  }

  const crown = new THREE.Group();
  crown.name = 'ent-crown';
  crown.userData.anatomy = 'crown';
  group.add(crown);
  const clusters: Array<[Vec3, number, THREE.Material]> = [
    [[-0.11, 2.27, 0], 0.31, leaves],
    [[0.02, 2.57, -0.43], 0.24, newGrowth],
    [[0.02, 2.57, 0.43], 0.24, newGrowth],
    [[-0.2, 2.45, -0.39], 0.2, leaves],
    [[-0.2, 2.45, 0.39], 0.2, leaves],
    [[-0.27, 1.71, -0.39], 0.21, moss],
    [[-0.27, 1.71, 0.39], 0.21, moss],
  ];
  for (const [position, radius, surface] of clusters) {
    addMesh(crown, new THREE.IcosahedronGeometry(radius, 0), surface, position, [1.15, 0.72, 1]);
  }
}

function addGiantSpider(group: THREE.Group): void {
  const shell = material(0x344238, { roughness: 0.72 });
  const abdomen = material(0x586a42);
  const joints = material(0x252d29);
  const markings = material(0x9aa75c);
  const fangs = material(0xc8bd8d, { roughness: 0.5 });
  const eyes = material(0xe2a84e, { emissive: 0xd17a24, emissiveIntensity: 0.9 });

  addMesh(group, new THREE.DodecahedronGeometry(0.48, 0), abdomen, [-0.36, 0.64, 0], [1.25, 0.75, 0.95], [0, 0, 0], 'giant-spider-abdomen');
  addMesh(group, new THREE.DodecahedronGeometry(0.33, 0), shell, [0.23, 0.57, 0], [1.1, 0.75, 0.95], [0, 0, 0], 'giant-spider-thorax');
  addMesh(group, new THREE.DodecahedronGeometry(0.23, 0), shell, [0.53, 0.54, 0], [1.05, 0.78, 0.95], [0, 0, 0], 'giant-spider-head');

  const legPoses = [
    [0.37, 0.69, 1.02, 0.86],
    [0.15, 0.37, 0.47, 1.04],
    [-0.08, -0.27, -0.38, 1.06],
    [-0.3, -0.66, -1.0, 0.89],
  ] as const;
  for (const side of [-1, 1]) {
    for (let index = 0; index < legPoses.length; index += 1) {
      const [anchorX, kneeX, footX, spread] = legPoses[index]!;
      const leg = new THREE.Group();
      leg.name = `giant-spider-leg-${side < 0 ? 'left' : 'right'}-${index + 1}`;
      leg.userData.anatomy = 'leg';
      group.add(leg);
      addLimb(leg, [anchorX, 0.57, side * 0.22], [kneeX, 0.82 - index * 0.025, side * spread * 0.67], 0.065, 0.045, shell, 'upper-leg');
      addLimb(leg, [kneeX, 0.82 - index * 0.025, side * spread * 0.67], [footX, 0.04, side * spread], 0.045, 0.022, joints, 'lower-leg');
      addMesh(leg, new THREE.SphereGeometry(0.04, 5, 4), joints, [footX, 0.04, side * spread], [1.25, 1, 1], [0, 0, 0], 'grounded-foot');
    }
  }

  const eyePositions = [
    [0.65, -0.13, 0.033], [0.65, 0.13, 0.033],
    [0.59, -0.065, 0.041], [0.59, 0.065, 0.041],
    [0.48, -0.15, 0.027], [0.48, 0.15, 0.027],
    [0.48, -0.055, 0.03], [0.48, 0.055, 0.03],
  ] as const;
  for (let index = 0; index < eyePositions.length; index += 1) {
    const [y, z, radius] = eyePositions[index]!;
    addMesh(group, new THREE.SphereGeometry(radius, 6, 4), eyes, [0.714, y, z], [1, 1, 1], [0, 0, 0], `giant-spider-eye-${index + 1}`);
  }

  for (const side of [-1, 1]) {
    addMesh(group, new THREE.ConeGeometry(0.055, 0.25, 5), fangs, [0.72, 0.39, side * 0.1], [1, 1, 1], [0, 0, -2.2], `giant-spider-fang-${side}`);
    addMesh(group, new THREE.ConeGeometry(0.06, 0.22, 5), abdomen, [-0.98, 0.58, side * 0.1], [1, 1, 1], [0, 0, Math.PI / 2], `giant-spider-spinneret-${side}`);
  }
  for (const x of [-0.63, -0.37, -0.11]) {
    addMesh(group, new THREE.OctahedronGeometry(0.105, 0), markings, [x, 0.98, 0], [1.1, 0.24, 0.82], [0, 0, 0], 'giant-spider-abdomen-marking');
  }
}

const FOREST_SPECS: Record<ForestCreatureId, ForestSpec> = {
  ent: { archetype: 'ancient-tree-guardian', palette: [0x69503a, 0x496b3d, 0xe4bd63], build: addEnt },
  giantSpider: { archetype: 'giant-eight-legged-spider', palette: [0x344238, 0x9aa75c, 0xe2a84e], build: addGiantSpider },
};

export function createForestMonsterModel(creatureId: string, side: BattleSide): THREE.Group | null {
  let spec: ForestSpec;
  switch (creatureId) {
    case 'ent': spec = FOREST_SPECS.ent; break;
    case 'giantSpider': spec = FOREST_SPECS.giantSpider; break;
    default: return null;
  }

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
  group.userData.labelHeight = bounds.max.y + 0.45;
  group.userData.palette = [...spec.palette];
  group.userData.factionColor = spec.palette[0];
  return group;
}
