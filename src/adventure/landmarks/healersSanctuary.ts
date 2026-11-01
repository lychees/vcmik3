import * as THREE from 'three';

type Point = [number, number, number];

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
  result.userData.baseColor = result.color.getHex();
  return result;
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
  segments = 12,
): THREE.Mesh {
  return addMesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, position);
}

function box(
  parent: THREE.Object3D,
  size: Point,
  surface: THREE.Material,
  position: Point,
): THREE.Mesh {
  return addMesh(parent, new THREE.BoxGeometry(...size), surface, position);
}

function addColumn(
  group: THREE.Group,
  name: string,
  x: number,
  z: number,
  stone: THREE.Material,
  trim: THREE.Material,
): void {
  const column = new THREE.Group();
  column.name = name;
  column.userData.anatomy = 'column';
  group.add(column);
  cylinder(column, 0.17, 0.19, 0.12, trim, [x, 0.24, z], 10);
  cylinder(column, 0.105, 0.135, 1.0, stone, [x, 0.81, z], 10);
  cylinder(column, 0.18, 0.14, 0.12, trim, [x, 1.37, z], 10);
  box(column, [0.37, 0.07, 0.37], stone, [x, 1.465, z]);
}

function addHerbBed(
  group: THREE.Group,
  name: string,
  x: number,
  z: number,
  stone: THREE.Material,
  soil: THREE.Material,
  leaves: THREE.Material,
  blossoms: THREE.Material,
): void {
  const bed = new THREE.Group();
  bed.name = name;
  bed.userData.anatomy = 'herbBed';
  bed.position.set(x, 0, z);
  group.add(bed);
  box(bed, [0.43, 0.17, 0.34], stone, [0, 0.265, 0]);
  box(bed, [0.36, 0.035, 0.27], soil, [0, 0.365, 0]);
  for (let index = 0; index < 3; index += 1) {
    const herbX = (index - 1) * 0.12;
    const height = 0.2 + index % 2 * 0.07;
    cylinder(bed, 0.012, 0.018, height, leaves, [herbX, 0.38 + height / 2, 0], 5);
    addMesh(
      bed,
      new THREE.DodecahedronGeometry(0.075, 0),
      leaves,
      [herbX - 0.035, 0.45 + height * 0.45, 0],
      [1.35, 0.5, 0.75],
      [0, 0, 0.35],
    );
    addMesh(
      bed,
      new THREE.OctahedronGeometry(0.045, 0),
      blossoms,
      [herbX, 0.4 + height, 0],
    );
  }
}

export function createHealersSanctuaryModel(): THREE.Group {
  const group = new THREE.Group();
  const foundation = material(0x8f9b8c);
  const stone = material(0xd2d0b8);
  const trim = material(0xaeb7a2);
  const soil = material(0x4d4938);
  const leaves = material(0x5e8b5e);
  const blossoms = material(0xd8b9d8, { emissive: 0x533b59, emissiveIntensity: 0.25 });
  const gold = material(0xe2cb78, {
    emissive: 0x79652d,
    emissiveIntensity: 0.5,
    metalness: 0.25,
    roughness: 0.5,
  });
  const water = material(0x68c9bd, {
    emissive: 0x245f5b,
    emissiveIntensity: 0.45,
    transparent: true,
    opacity: 0.82,
    depthWrite: false,
    roughness: 0.24,
  });
  const restorativeGlow = material(0xb8f0d2, {
    emissive: 0x69c69b,
    emissiveIntensity: 0.85,
    roughness: 0.35,
  });

  cylinder(group, 1.18, 1.24, 0.12, foundation, [0, 0.06, 0], 16).name = 'sanctuary-foundation';
  cylinder(group, 1.12, 1.12, 0.07, stone, [0, 0.145, 0], 16).name = 'sanctuary-paving';
  box(group, [0.86, 0.06, 0.34], foundation, [0, 0.03, 1.25]).name = 'sanctuary-step-lower';
  box(group, [0.72, 0.06, 0.27], stone, [0, 0.09, 1.01]).name = 'sanctuary-step-upper';

  const pool = cylinder(group, 0.69, 0.74, 0.09, trim, [0, 0.215, 0.18], 20);
  pool.name = 'healing-pool';
  pool.userData.anatomy = 'pool';
  const waterSurface = cylinder(group, 0.615, 0.615, 0.018, water, [0, 0.267, 0.18], 24);
  waterSurface.name = 'healing-water';
  waterSurface.castShadow = false;
  const rim = addMesh(
    group,
    new THREE.TorusGeometry(0.685, 0.055, 6, 24),
    stone,
    [0, 0.27, 0.18],
    [1, 1, 1],
    [Math.PI / 2, 0, 0],
  );
  rim.name = 'healing-pool-rim';

  const columns: Array<[number, number]> = [
    [-0.88, -0.67],
    [0.88, -0.67],
    [-0.88, 0.67],
    [0.88, 0.67],
  ];
  for (let index = 0; index < columns.length; index += 1) {
    const [x, z] = columns[index]!;
    addColumn(group, `sanctuary-column-${index}`, x, z, stone, trim);
  }
  for (const z of [-0.67, 0.67]) {
    box(group, [2.0, 0.14, 0.22], stone, [0, 1.54, z]).name = 'sanctuary-entablature';
  }
  for (const x of [-0.88, 0.88]) {
    box(group, [0.22, 0.14, 1.52], stone, [x, 1.54, 0]).name = 'sanctuary-entablature';
  }

  const pedimentGeometry = new THREE.BufferGeometry();
  pedimentGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -1.04, 1.61, 0,
    1.04, 1.61, 0,
    0, 2.02, 0,
  ], 3));
  pedimentGeometry.computeVertexNormals();
  const pediment = addMesh(
    group,
    pedimentGeometry,
    material(0xc5c7ad, { side: THREE.DoubleSide }),
    [0, 0, -0.67],
  );
  pediment.name = 'sanctuary-pediment';

  const cross = new THREE.Group();
  cross.name = 'restorative-cross';
  cross.userData.anatomy = 'restorativeSymbol';
  group.add(cross);
  box(cross, [0.095, 0.36, 0.065], gold, [0, 1.79, -0.625]);
  box(cross, [0.31, 0.095, 0.065], gold, [0, 1.82, -0.62]);

  addHerbBed(group, 'herb-bed-left', -0.83, 0.93, trim, soil, leaves, blossoms);
  addHerbBed(group, 'herb-bed-right', 0.83, 0.93, trim, soil, leaves, blossoms);

  const petalGeometry = new THREE.SphereGeometry(0.075, 6, 4);
  for (let index = 0; index < 5; index += 1) {
    const angle = index * Math.PI * 2 / 5;
    const petal = addMesh(
      group,
      petalGeometry,
      blossoms,
      [Math.sin(angle) * 0.09, 0.315, 0.18 + Math.cos(angle) * 0.09],
      [0.75, 0.25, 1.35],
      [0, angle, 0],
    );
    petal.name = `healing-lotus-petal-${index}`;
    petal.castShadow = false;
  }
  const lotusHeart = addMesh(group, new THREE.OctahedronGeometry(0.05, 0), gold, [0, 0.34, 0.18]);
  lotusHeart.castShadow = false;

  const motes: Array<[number, number, number]> = [
    [-0.27, 0.58, 0.15],
    [0.25, 0.7, 0.22],
    [0, 0.87, 0.18],
  ];
  for (let index = 0; index < motes.length; index += 1) {
    const mote = addMesh(
      group,
      new THREE.OctahedronGeometry(0.04, 0),
      restorativeGlow,
      motes[index]!,
    );
    mote.name = `restorative-mote-${index}`;
    mote.castShadow = false;
  }

  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.name = 'healersSanctuary';
  group.userData.landmarkId = 'healersSanctuary';
  group.userData.faction = 'Neutral';
  group.userData.animationPivot = 'ground';
  group.userData.visualHeight = size.y;
  group.userData.labelHeight = bounds.max.y + 0.45;
  return group;
}
