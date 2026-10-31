import * as THREE from 'three';

type DwellingId = 'pixieGarden' | 'airElementalAltar' | 'stormElementalSpire' | 'phoenixPyre';
type DwellingBuilder = (group: THREE.Group) => void;

function material(color: number, roughness = 0.78, metalness = 0): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  result.userData.baseColor = color;
  return result;
}

function glow(color: number, intensity = 0.55): THREE.MeshStandardMaterial {
  const result = material(color, 0.35, 0.08);
  result.emissive.setHex(color);
  result.emissiveIntensity = intensity;
  return result;
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(x, y, z);
  result.castShadow = !surface.transparent;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function box(
  parent: THREE.Object3D,
  width: number,
  height: number,
  depth: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return mesh(parent, new THREE.BoxGeometry(width, height, depth), surface, x, y, z);
}

function cylinder(
  parent: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  segments: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, x, y, z);
}

function cone(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  segments: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return mesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, x, y, z);
}

function sphere(
  parent: THREE.Object3D,
  radius: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return mesh(parent, new THREE.SphereGeometry(radius, 10, 7), surface, x, y, z);
}

function octahedron(
  parent: THREE.Object3D,
  radius: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return mesh(parent, new THREE.OctahedronGeometry(radius), surface, x, y, z);
}

function torus(
  parent: THREE.Object3D,
  radius: number,
  tube: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return mesh(parent, new THREE.TorusGeometry(radius, tube, 6, 32), surface, x, y, z);
}

function addFoundation(group: THREE.Group, stone: THREE.Material, dark: THREE.Material): void {
  cylinder(group, 1.48, 1.58, 0.18, 12, dark, 0, 0.09, 0);
  cylinder(group, 1.38, 1.48, 0.16, 12, stone, 0, 0.26, 0);
}

function addPixieGarden(group: THREE.Group): void {
  const stone = material(0x789b9e);
  const dark = material(0x4c587b);
  const leaf = material(0x4d9a7d);
  const petal = material(0xd99bd6, 0.58);
  const pollen = glow(0xffe7a0, 0.65);
  const magic = glow(0xb9f3df, 0.75);
  addFoundation(group, stone, dark);

  cylinder(group, 0.9, 1.02, 0.18, 10, stone, 0, 0.43, 0);
  const pavilionRing = torus(group, 0.89, 0.045, magic, 0, 1.66, 0);
  pavilionRing.rotation.x = Math.PI / 2;
  for (const [x, z] of [[-0.57, -0.57], [0.57, -0.57], [-0.57, 0.57], [0.57, 0.57]] as const) {
    cylinder(group, 0.055, 0.075, 1.25, 6, dark, x, 1.035, z);
    octahedron(group, 0.105, magic, x, 1.7, z);
  }

  const roof = cone(group, 1.12, 0.72, 6, leaf, 0, 2.0, 0);
  roof.rotation.y = Math.PI / 6;
  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3;
    const petalMesh = sphere(
      group,
      0.25,
      petal,
      Math.cos(angle) * 0.69,
      2.24,
      Math.sin(angle) * 0.69,
    );
    petalMesh.scale.set(1.55, 0.34, 0.8);
    petalMesh.rotation.y = -angle;
  }
  const heart = octahedron(group, 0.22, pollen, 0, 2.66, 0);
  heart.scale.y = 1.45;

  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4 + Math.PI / 8;
    const x = Math.cos(angle) * 1.16;
    const z = Math.sin(angle) * 1.16;
    const height = 0.38 + (index % 3) * 0.08;
    cylinder(group, 0.025, 0.04, height, 5, leaf, x, 0.34 + height / 2, z);
    const blossom = octahedron(group, 0.13, index % 2 === 0 ? petal : pollen, x, 0.39 + height, z);
    blossom.scale.y = 0.65;
  }

  for (const [x, y, z] of [[-0.85, 1.25, 0.22], [0.78, 1.4, 0.35], [0.2, 1.25, -0.88]] as const) {
    const mote = sphere(group, 0.085, magic, x, y, z);
    mote.scale.set(0.7, 1.25, 0.7);
    const leftWing = octahedron(group, 0.09, petal, x - 0.1, y + 0.02, z);
    leftWing.scale.set(1.25, 0.65, 0.25);
    leftWing.rotation.z = 0.45;
    const rightWing = octahedron(group, 0.09, petal, x + 0.1, y + 0.02, z);
    rightWing.scale.set(1.25, 0.65, 0.25);
    rightWing.rotation.z = -0.45;
  }
}

function addAirElementalAltar(group: THREE.Group): void {
  const stone = material(0x86afb1);
  const dark = material(0x526789);
  const trim = material(0xb8d8cd, 0.5, 0.15);
  const magic = glow(0xa8f1e4, 0.7);
  const air = glow(0xd8fff3, 0.4);
  air.transparent = true;
  air.opacity = 0.68;
  air.depthWrite = false;
  addFoundation(group, stone, dark);

  cylinder(group, 1.16, 1.28, 0.18, 12, dark, 0, 0.43, 0);
  cylinder(group, 0.92, 1.08, 0.18, 12, stone, 0, 0.61, 0);
  cylinder(group, 0.48, 0.66, 0.62, 8, trim, 0, 1.01, 0);
  const altarRing = torus(group, 0.52, 0.055, magic, 0, 1.34, 0);
  altarRing.rotation.x = Math.PI / 2;

  for (const [x, z] of [[-1.08, 0], [1.08, 0], [0, -1.08], [0, 1.08]] as const) {
    cylinder(group, 0.09, 0.17, 1.65, 6, stone, x, 1.165, z);
    cylinder(group, 0.17, 0.12, 0.13, 6, dark, x, 2.055, z);
    const crystal = octahedron(group, 0.14, magic, x, 2.35, z);
    crystal.scale.y = 1.55;
  }

  const crystal = octahedron(group, 0.43, magic, 0, 2.64, 0);
  crystal.scale.y = 1.65;
  const lowerRing = torus(group, 0.72, 0.035, air, 0, 2.35, 0);
  lowerRing.rotation.set(Math.PI / 2.7, 0.25, 0.15);
  const upperRing = torus(group, 0.63, 0.03, air, 0, 2.85, 0);
  upperRing.rotation.set(Math.PI / 1.8, -0.35, -0.2);
  const verticalRing = torus(group, 0.82, 0.025, air, 0, 2.62, 0);
  verticalRing.rotation.y = Math.PI / 2;
  verticalRing.rotation.x = 0.35;
}

function addLightning(group: THREE.Group, surface: THREE.Material, x: number, y: number, z: number): void {
  const shape = new THREE.Shape();
  shape.moveTo(-0.08, 0.46);
  shape.lineTo(0.13, 0.46);
  shape.lineTo(0.03, 0.1);
  shape.lineTo(0.2, 0.1);
  shape.lineTo(-0.13, -0.46);
  shape.lineTo(-0.04, -0.06);
  shape.lineTo(-0.2, -0.06);
  shape.closePath();
  mesh(group, new THREE.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: false }), surface, x, y, z);
}

function addStormElementalSpire(group: THREE.Group): void {
  const stone = material(0x6f8f9d);
  const dark = material(0x343c60, 0.65, 0.12);
  const roof = material(0x57678f, 0.5, 0.2);
  const conductor = material(0xd5bc68, 0.32, 0.7);
  const lightning = glow(0xffe875, 0.85);
  addFoundation(group, stone, dark);

  cylinder(group, 0.95, 1.15, 0.5, 8, dark, 0, 0.59, 0);
  cylinder(group, 0.62, 0.88, 2.15, 8, stone, 0, 1.915, 0);
  for (const [x, z, rotation] of [[-1.02, 0, 0], [1.02, 0, 0], [0, -1.02, Math.PI / 2], [0, 1.02, Math.PI / 2]] as const) {
    const buttress = box(group, 0.25, 1.55, 0.34, dark, x, 1.115, z);
    buttress.rotation.y = rotation;
    const cap = cone(group, 0.2, 0.45, 4, conductor, x, 2.1, z);
    cap.rotation.y = Math.PI / 4;
  }

  const belt = torus(group, 0.73, 0.065, conductor, 0, 2.98, 0);
  belt.rotation.x = Math.PI / 2;
  const roofMesh = cone(group, 0.92, 1.25, 8, roof, 0, 3.615, 0);
  roofMesh.rotation.y = Math.PI / 8;
  cylinder(group, 0.22, 0.35, 0.3, 8, conductor, 0, 4.39, 0);
  const crown = octahedron(group, 0.28, lightning, 0, 4.85, 0);
  crown.scale.y = 1.5;
  cone(group, 0.065, 0.45, 6, conductor, 0, 5.25, 0);

  addLightning(group, lightning, 0, 2.0, 0.72);
  const boltGroup = new THREE.Group();
  boltGroup.position.set(0.72, 2.0, 0);
  boltGroup.rotation.y = Math.PI / 2;
  group.add(boltGroup);
  addLightning(boltGroup, lightning, 0, 0, 0);
  for (const y of [1.15, 2.55]) {
    box(group, 0.12, 0.3, 0.035, lightning, 0, y, 0.79);
  }
}

function addPhoenixPyre(group: THREE.Group): void {
  const stone = material(0x6f7685);
  const dark = material(0x3c3855);
  const brass = material(0xb88454, 0.4, 0.5);
  const flame = glow(0xf27b45, 0.75);
  const heart = glow(0xffd768, 0.95);
  addFoundation(group, stone, dark);

  cylinder(group, 0.74, 0.96, 0.65, 8, dark, 0, 0.665, 0);
  cylinder(group, 0.86, 0.55, 0.38, 10, brass, 0, 1.18, 0);
  const nest = torus(group, 0.7, 0.12, dark, 0, 1.4, 0);
  nest.rotation.x = Math.PI / 2;

  cone(group, 0.36, 1.8, 7, flame, 0, 2.3, 0);
  cone(group, 0.23, 1.35, 6, heart, -0.28, 2.075, 0.08).rotation.z = -0.2;
  cone(group, 0.22, 1.25, 6, heart, 0.3, 2.025, -0.04).rotation.z = 0.24;
  cone(group, 0.18, 1.05, 6, flame, 0.05, 1.925, 0.32).rotation.x = -0.18;

  for (const [x, z] of [[-1.16, -0.45], [1.16, -0.45], [-1.16, 0.45], [1.16, 0.45]] as const) {
    cylinder(group, 0.09, 0.17, 0.85, 6, dark, x, 0.765, z);
    cylinder(group, 0.19, 0.12, 0.16, 6, brass, x, 1.27, z);
    cone(group, 0.13, 0.48, 6, flame, x, 1.59, z);
  }

  const body = octahedron(group, 0.26, flame, 0, 3.48, 0);
  body.scale.y = 1.65;
  sphere(group, 0.18, heart, 0, 3.98, 0.02);
  cone(group, 0.075, 0.25, 5, brass, 0, 3.98, 0.22).rotation.x = Math.PI / 2;
  for (const side of [-1, 1]) {
    for (let index = 0; index < 3; index += 1) {
      const feather = cone(
        group,
        0.2 - index * 0.025,
        1.25 - index * 0.1,
        5,
        index === 1 ? heart : flame,
        side * (0.38 + index * 0.2),
        3.5 - index * 0.12,
        -index * 0.04,
      );
      feather.scale.z = 0.42;
      feather.rotation.z = -side * (0.78 + index * 0.14);
    }
    const tail = cone(group, 0.13, 1.0, 5, heart, side * 0.16, 2.95, -0.08);
    tail.rotation.z = side * 0.18 + Math.PI;
  }
}

function ghostMaterial(color: number): THREE.MeshStandardMaterial {
  const result = glow(color, 0.45);
  result.transparent = true;
  result.opacity = 0.26;
  result.depthWrite = false;
  return result;
}

function addConstruction(group: THREE.Group, buildingId: DwellingId, accent: number): void {
  const stone = material(0x72868a);
  const dark = material(0x4b5367);
  const timber = material(0x8f7658);
  const ghost = ghostMaterial(accent);
  addFoundation(group, stone, dark);

  for (const [x, z] of [[-1.23, -1.23], [1.23, -1.23], [-1.23, 1.23], [1.23, 1.23]] as const) {
    box(group, 0.11, 1.25, 0.11, timber, x, 0.8, z);
  }
  for (const z of [-1.23, 1.23]) box(group, 2.57, 0.1, 0.1, timber, 0, 1.37, z);
  for (const x of [-1.23, 1.23]) box(group, 0.1, 0.1, 2.57, timber, x, 1.37, 0);

  if (buildingId === 'pixieGarden') {
    cone(group, 0.82, 0.55, 6, ghost, 0, 1.72, 0);
    sphere(group, 0.14, ghost, 0, 2.14, 0);
  } else if (buildingId === 'airElementalAltar') {
    const crystal = octahedron(group, 0.32, ghost, 0, 1.95, 0);
    crystal.scale.y = 1.5;
    const ring = torus(group, 0.56, 0.035, ghost, 0, 1.95, 0);
    ring.rotation.x = Math.PI / 2.5;
  } else if (buildingId === 'stormElementalSpire') {
    cylinder(group, 0.3, 0.55, 1.3, 8, ghost, 0, 2.08, 0);
    cone(group, 0.45, 0.8, 8, ghost, 0, 3.13, 0);
  } else {
    cone(group, 0.3, 1.15, 6, ghost, 0, 2.0, 0);
    cone(group, 0.2, 0.9, 6, ghost, -0.3, 1.85, 0).rotation.z = -0.25;
    cone(group, 0.2, 0.9, 6, ghost, 0.3, 1.85, 0).rotation.z = 0.25;
  }
}

const DWELLINGS: Readonly<Record<DwellingId, {
  tier: 1 | 2 | 3 | 4;
  accent: number;
  build: DwellingBuilder;
}>> = {
  pixieGarden: { tier: 1, accent: 0xb9f3df, build: addPixieGarden },
  airElementalAltar: { tier: 2, accent: 0xa8f1e4, build: addAirElementalAltar },
  stormElementalSpire: { tier: 3, accent: 0xffe875, build: addStormElementalSpire },
  phoenixPyre: { tier: 4, accent: 0xffa052, build: addPhoenixPyre },
};

export function createBuildingModel(buildingId: string, built: boolean): THREE.Group | null {
  if (!Object.hasOwn(DWELLINGS, buildingId)) return null;
  const dwelling = DWELLINGS[buildingId as DwellingId];
  const group = new THREE.Group();
  group.name = `conflux-${buildingId}-${built ? 'built' : 'unbuilt'}`;
  group.userData = {
    faction: 'Conflux',
    buildingId,
    built,
    tier: dwelling.tier,
  };
  if (built) dwelling.build(group);
  else addConstruction(group, buildingId as DwellingId, dwelling.accent);
  group.updateMatrixWorld(true);
  return group;
}

export default {
  faction: 'Conflux',
  createBuildingModel,
};
