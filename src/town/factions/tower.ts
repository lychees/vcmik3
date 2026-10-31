import * as THREE from 'three';

interface TowerPalette {
  stone: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
}

interface DwellingBuilder {
  build(group: THREE.Group, palette: TowerPalette): void;
  ghostHeight: number;
  ghostRadius: number;
}

function surface(color: number, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}

function createPalette(): TowerPalette {
  const glow = surface(0x8ed5df, 0.35, 0.1);
  glow.emissive.setHex(0x5b9fb8);
  glow.emissiveIntensity = 0.55;
  glow.side = THREE.DoubleSide;
  return {
    stone: surface(0xb8c4c5),
    trim: surface(0x82979e),
    roof: surface(0x4e6f99, 0.65, 0.12),
    gold: surface(0xe4cc79, 0.38, 0.5),
    glow,
    dark: surface(0x354b59),
    wood: surface(0x806c50),
  };
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function box(
  parent: THREE.Object3D,
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return mesh(parent, new THREE.BoxGeometry(width, height, depth), material, x, y, z);
}

function cylinder(
  parent: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  segments: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), material, x, y, z);
}

function cone(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  segments: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return mesh(parent, new THREE.ConeGeometry(radius, height, segments), material, x, y, z);
}

function torus(
  parent: THREE.Object3D,
  radius: number,
  tube: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return mesh(parent, new THREE.TorusGeometry(radius, tube, 6, 24), material, x, y, z);
}

function beam(
  parent: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  thickness: number,
  material: THREE.Material,
): THREE.Mesh {
  const direction = end.clone().sub(start);
  const result = box(parent, thickness, direction.length(), thickness, material);
  result.position.copy(start).add(end).multiplyScalar(0.5);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function addFoundation(group: THREE.Group, palette: TowerPalette): void {
  cylinder(group, 1.65, 1.65, 0.16, 8, palette.trim, 0, 0.08, 0);
  cylinder(group, 1.5, 1.58, 0.12, 8, palette.stone, 0, 0.22, 0);
}

function addFrontSteps(group: THREE.Group, palette: TowerPalette): void {
  box(group, 1.15, 0.12, 0.5, palette.trim, 0, 0.06, 1.42);
  box(group, 0.95, 0.16, 0.38, palette.stone, 0, 0.2, 1.3);
}

function addGear(
  parent: THREE.Object3D,
  palette: TowerPalette,
  x: number,
  y: number,
  z: number,
): void {
  const gear = new THREE.Group();
  gear.name = 'artificer-gear';
  gear.position.set(x, y, z);
  parent.add(gear);
  torus(gear, 0.24, 0.055, palette.gold);
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    const tooth = box(
      gear,
      0.1,
      0.15,
      0.09,
      palette.gold,
      Math.cos(angle) * 0.3,
      Math.sin(angle) * 0.3,
      0,
    );
    tooth.rotation.z = angle - Math.PI / 2;
  }
  cylinder(gear, 0.085, 0.085, 0.13, 10, palette.dark).rotation.x = Math.PI / 2;
}

function buildGremlinWorkshop(group: THREE.Group, palette: TowerPalette): void {
  addFrontSteps(group, palette);
  cylinder(group, 1.12, 1.25, 1.45, 8, palette.stone, 0, 1.005, 0);
  cylinder(group, 1.28, 1.28, 0.14, 8, palette.trim, 0, 0.35, 0);
  cone(group, 1.48, 1.05, 8, palette.roof, 0, 2.255, 0);
  torus(group, 1.12, 0.06, palette.gold, 0, 1.76, 0).rotation.x = Math.PI / 2;

  box(group, 0.55, 0.85, 0.08, palette.dark, 0, 0.705, 1.2);
  torus(group, 0.275, 0.055, palette.gold, 0, 1.13, 1.25).scale.y = 0.8;
  for (const x of [-0.72, 0.72]) {
    box(group, 0.28, 0.42, 0.06, palette.glow, x, 1.3, 1.01);
    box(group, 0.04, 0.42, 0.075, palette.gold, x, 1.3, 1.045);
  }
  addGear(group, palette, -0.76, 0.88, 1.03);

  box(group, 0.42, 1.4, 0.42, palette.dark, -0.75, 1.75, -0.35);
  box(group, 0.56, 0.18, 0.56, palette.gold, -0.75, 2.54, -0.35);
  cylinder(group, 0.035, 0.05, 0.36, 8, palette.gold, 0, 2.96, 0);
  mesh(group, new THREE.OctahedronGeometry(0.13, 0), palette.glow, 0, 3.27, 0);
}

function addGargoyleWing(
  parent: THREE.Object3D,
  side: -1 | 1,
  material: THREE.Material,
): void {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(side * 0.82, 0.48);
  shape.lineTo(side * 0.62, -0.08);
  shape.lineTo(side * 0.42, 0.04);
  shape.lineTo(side * 0.26, -0.24);
  shape.closePath();
  mesh(parent, new THREE.ShapeGeometry(shape), material, 0, 2.76, 1.03);
}

function buildGargoyleParapet(group: THREE.Group, palette: TowerPalette): void {
  addFrontSteps(group, palette);
  box(group, 2.15, 1.8, 1.75, palette.stone, 0, 1.18, 0);
  for (const x of [-1.15, 1.15]) {
    cylinder(group, 0.43, 0.48, 2.15, 8, palette.trim, x, 1.355, -0.25);
  }
  box(group, 3.15, 0.18, 2.15, palette.trim, 0, 2.17, 0);
  for (const z of [-0.92, 0.92]) {
    for (const x of [-1.3, -0.65, 0, 0.65, 1.3]) {
      box(group, 0.38, 0.38, 0.32, palette.stone, x, 2.45, z);
    }
  }
  for (const x of [-1.4, 1.4]) {
    for (const z of [-0.32, 0.32]) {
      box(group, 0.32, 0.38, 0.38, palette.stone, x, 2.45, z);
    }
  }

  cylinder(group, 0.62, 0.72, 0.85, 8, palette.stone, 0, 2.685, -0.18);
  cone(group, 0.82, 0.62, 8, palette.roof, 0, 3.42, -0.18);
  mesh(group, new THREE.OctahedronGeometry(0.12, 0), palette.gold, 0, 3.88, -0.18);

  box(group, 0.62, 1.12, 0.07, palette.dark, 0, 0.84, 0.91);
  torus(group, 0.31, 0.065, palette.gold, 0, 1.4, 0.96).scale.y = 0.85;
  for (const x of [-0.72, 0.72]) {
    box(group, 0.24, 0.5, 0.06, palette.glow, x, 1.42, 0.91);
  }

  const wingMaterial = surface(0x71878e);
  wingMaterial.side = THREE.DoubleSide;
  addGargoyleWing(group, -1, wingMaterial);
  addGargoyleWing(group, 1, wingMaterial);
  for (const x of [-0.15, 0.15]) {
    box(group, 0.13, 0.32, 0.16, palette.dark, x, 2.42, 1.04);
  }
  mesh(group, new THREE.DodecahedronGeometry(0.27, 0), palette.dark, 0, 2.72, 1.04).scale.y = 1.2;
  mesh(group, new THREE.DodecahedronGeometry(0.19, 0), palette.trim, 0, 3.04, 1.05);
  for (const side of [-1, 1]) {
    cone(group, 0.065, 0.22, 5, palette.dark, side * 0.13, 3.25, 1.04).rotation.z = side * -0.35;
    mesh(group, new THREE.OctahedronGeometry(0.035, 0), palette.glow, side * 0.07, 3.07, 1.22);
  }
}

function buildGeniePavilion(group: THREE.Group, palette: TowerPalette): void {
  addFrontSteps(group, palette);
  cylinder(group, 1.35, 1.42, 0.18, 12, palette.trim, 0, 0.37, 0);
  cylinder(group, 0.65, 0.75, 0.18, 12, palette.roof, 0, 0.55, 0);
  torus(group, 0.54, 0.035, palette.glow, 0, 0.66, 0).rotation.x = Math.PI / 2;

  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3;
    const x = Math.cos(angle) * 1.12;
    const z = Math.sin(angle) * 1.12;
    cylinder(group, 0.09, 0.12, 1.75, 8, palette.stone, x, 1.335, z);
    cylinder(group, 0.16, 0.16, 0.12, 8, palette.gold, x, 0.52, z);
    cylinder(group, 0.16, 0.13, 0.12, 8, palette.gold, x, 2.15, z);
  }
  cylinder(group, 1.38, 1.38, 0.18, 12, palette.trim, 0, 2.3, 0);
  torus(group, 1.3, 0.045, palette.gold, 0, 2.39, 0).rotation.x = Math.PI / 2;
  const dome = mesh(
    group,
    new THREE.SphereGeometry(1.32, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    palette.roof,
    0,
    2.39,
    0,
  );
  dome.scale.y = 0.85;
  cylinder(group, 0.18, 0.25, 0.18, 10, palette.gold, 0, 3.602, 0);
  cone(group, 0.3, 0.62, 8, palette.roof, 0, 4.002, 0);
  cylinder(group, 0.025, 0.04, 0.17, 8, palette.gold, 0, 4.397, 0);
  mesh(group, new THREE.OctahedronGeometry(0.08, 0), palette.glow, 0, 4.52, 0);

  const crystal = mesh(group, new THREE.OctahedronGeometry(0.34, 0), palette.glow, 0, 1.42, 0);
  crystal.scale.y = 1.5;
  torus(group, 0.53, 0.035, palette.gold, 0, 1.4, 0).rotation.x = Math.PI / 2;
  const orbit = torus(group, 0.48, 0.025, palette.glow, 0, 1.42, 0);
  orbit.rotation.set(0.65, 0.25, 0.2);
  for (const x of [-0.48, 0.48]) {
    cone(group, 0.1, 0.5, 6, palette.gold, x, 0.91, 0.35).rotation.z = x * 0.5;
  }
}

function addLightningBolt(group: THREE.Group, palette: TowerPalette): void {
  const shape = new THREE.Shape();
  shape.moveTo(-0.08, 0.58);
  shape.lineTo(0.32, 0.58);
  shape.lineTo(0.05, 0.1);
  shape.lineTo(0.3, 0.1);
  shape.lineTo(-0.28, -0.58);
  shape.lineTo(-0.06, -0.06);
  shape.lineTo(-0.3, -0.06);
  shape.closePath();
  mesh(group, new THREE.ShapeGeometry(shape), palette.glow, 0, 2, 0.8);
}

function buildTitanCloudTemple(group: THREE.Group, palette: TowerPalette): void {
  addFrontSteps(group, palette);
  box(group, 2.85, 0.32, 2.45, palette.trim, 0, 0.44, 0);
  box(group, 2.5, 0.18, 2.1, palette.stone, 0, 0.69, 0);
  box(group, 1.8, 2.2, 1.55, palette.stone, 0, 1.88, 0);
  for (const x of [-1.12, 1.12]) {
    for (const z of [-0.78, 0.78]) {
      cylinder(group, 0.12, 0.16, 2.2, 8, palette.trim, x, 1.88, z);
      cylinder(group, 0.2, 0.2, 0.14, 8, palette.gold, x, 2.91, z);
    }
  }
  box(group, 2.75, 0.22, 2.15, palette.trim, 0, 3.09, 0);
  box(group, 2.45, 0.09, 1.95, palette.gold, 0, 3.245, 0);

  cylinder(group, 0.52, 0.72, 1.25, 8, palette.stone, 0, 3.825, 0);
  for (const y of [3.45, 3.95]) {
    box(group, 0.22, 0.34, 0.045, palette.glow, 0, y, 0.66);
  }
  cone(group, 0.86, 0.85, 8, palette.roof, 0, 4.875, 0);
  torus(group, 0.64, 0.055, palette.gold, 0, 4.46, 0).rotation.x = Math.PI / 2;
  const crown = mesh(group, new THREE.OctahedronGeometry(0.19, 0), palette.glow, 0, 5.49, 0);
  crown.scale.y = 1.4;
  cylinder(group, 0.025, 0.035, 0.244, 8, palette.gold, 0, 5.878, 0);

  const cloud = surface(0xd7e4e3, 0.95);
  for (const [x, y, z, scale] of [
    [-1.0, 3.72, 0.05, 1.0],
    [1.0, 3.82, 0.08, 1.1],
    [-0.72, 4.05, -0.42, 0.78],
    [0.72, 4.15, -0.38, 0.82],
  ] as const) {
    const puff = mesh(group, new THREE.SphereGeometry(0.42, 10, 6), cloud, x, y, z);
    puff.scale.set(1.25 * scale, 0.55 * scale, 0.8 * scale);
  }
  for (const side of [-1, 1]) {
    cylinder(group, 0.18, 0.25, 0.7, 8, palette.stone, side * 1.05, 3.64, 0);
    cone(group, 0.34, 0.55, 8, palette.roof, side * 1.05, 4.265, 0);
  }

  box(group, 0.64, 1.22, 0.07, palette.dark, 0, 1.39, 0.81);
  torus(group, 0.32, 0.06, palette.gold, 0, 2, 0.86).scale.y = 0.85;
  addLightningBolt(group, palette);
}

function addConstruction(
  group: THREE.Group,
  palette: TowerPalette,
  ghostHeight: number,
  ghostRadius: number,
): void {
  const construction = new THREE.Group();
  construction.name = 'construction';
  group.add(construction);

  const scaffoldHeight = ghostHeight * 0.74;
  for (const x of [-1.32, 1.32]) {
    for (const z of [-1.08, 1.08]) {
      const poleHeight = scaffoldHeight - 0.28;
      cylinder(construction, 0.045, 0.055, poleHeight, 6, palette.wood, x, 0.28 + poleHeight / 2, z);
    }
  }
  for (const z of [-1.08, 1.08]) {
    box(construction, 2.72, 0.08, 0.08, palette.wood, 0, scaffoldHeight - 0.04, z);
    beam(
      construction,
      new THREE.Vector3(-1.3, 0.4, z),
      new THREE.Vector3(1.3, scaffoldHeight - 0.12, z),
      0.055,
      palette.wood,
    );
  }
  for (const x of [-1.32, 1.32]) {
    box(construction, 0.08, 0.08, 2.16, palette.wood, x, scaffoldHeight - 0.04, 0);
  }
  box(construction, 2.75, 0.07, 0.42, palette.wood, 0, scaffoldHeight * 0.55, 1.08);

  const ghost = new THREE.MeshStandardMaterial({
    color: 0x8ed5df,
    emissive: 0x416c83,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    roughness: 0.5,
    flatShading: true,
  });
  const bodyHeight = ghostHeight * 0.42;
  const roofHeight = ghostHeight - 0.28 - bodyHeight;
  cylinder(construction, ghostRadius * 0.82, ghostRadius, bodyHeight, 8, ghost, 0, 0.28 + bodyHeight / 2, 0);
  cone(construction, ghostRadius * 1.15, roofHeight, 8, ghost, 0, 0.28 + bodyHeight + roofHeight / 2, 0);
  torus(construction, ghostRadius, 0.025, ghost, 0, 0.3, 0).rotation.x = Math.PI / 2;

  for (let index = 0; index < 3; index += 1) {
    box(construction, 0.42, 0.18, 0.32, palette.trim, -0.9 + index * 0.38, 0.37 + (index === 1 ? 0.18 : 0), 1.36);
  }
  for (const y of [0.36, 0.47]) {
    cylinder(construction, 0.055, 0.055, 0.85, 6, palette.wood, 0.78, y, 1.34).rotation.z = Math.PI / 2;
  }
}

const DWELLINGS = new Map<string, DwellingBuilder>([
  ['gremlinWorkshop', { build: buildGremlinWorkshop, ghostHeight: 2.25, ghostRadius: 0.95 }],
  ['gargoyleParapet', { build: buildGargoyleParapet, ghostHeight: 2.65, ghostRadius: 1.0 }],
  ['geniePavilion', { build: buildGeniePavilion, ghostHeight: 2.9, ghostRadius: 1.05 }],
  ['titanCloudTemple', { build: buildTitanCloudTemple, ghostHeight: 3.65, ghostRadius: 0.9 }],
]);

export function createBuildingModel(buildingId: string, built: boolean): THREE.Group | null {
  const dwelling = DWELLINGS.get(buildingId);
  if (!dwelling) return null;

  const group = new THREE.Group();
  group.name = buildingId;
  group.userData = { buildingId, built, faction: 'Tower' };
  const palette = createPalette();
  addFoundation(group, palette);
  if (built) {
    const completed = new THREE.Group();
    completed.name = 'completed';
    group.add(completed);
    dwelling.build(completed, palette);
  } else {
    addConstruction(group, palette, dwelling.ghostHeight, dwelling.ghostRadius);
  }
  return group;
}

export default {
  faction: 'Tower',
  createBuildingModel,
};
