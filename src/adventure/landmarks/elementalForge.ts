import * as THREE from 'three';

type VectorTuple = readonly [number, number, number];

function material(
  color: number,
  extra: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.82, ...extra });
  result.userData.baseColor = color;
  return result;
}

function glow(color: number): THREE.MeshStandardMaterial {
  return material(color, { emissive: color, emissiveIntensity: 0.8, roughness: 0.35 });
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

function box(
  parent: THREE.Object3D,
  size: VectorTuple,
  surface: THREE.Material,
  position: VectorTuple,
  name?: string,
): THREE.Mesh {
  return mesh(parent, new THREE.BoxGeometry(...size), surface, position, [1, 1, 1], [0, 0, 0], name);
}

function cylinder(
  parent: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  segments: number,
  surface: THREE.Material,
  position: VectorTuple,
  name?: string,
): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, position, [1, 1, 1], [0, 0, 0], name);
}

function component(parent: THREE.Group, name: string, position: VectorTuple): THREE.Group {
  const result = new THREE.Group();
  result.name = name;
  result.userData.part = name;
  result.position.set(...position);
  parent.add(result);
  return result;
}

function addFurnace(parent: THREE.Group, stone: THREE.Material, metal: THREE.Material, dark: THREE.Material): void {
  const furnace = component(parent, 'furnace', [-0.18, 0, -0.05]);
  box(furnace, [0.62, 0.65, 0.58], stone, [0, 0.445, 0], 'furnace-body');
  box(furnace, [0.72, 0.12, 0.68], metal, [0, 0.82, 0], 'furnace-rim');
  box(furnace, [0.36, 0.34, 0.04], dark, [0, 0.42, 0.31], 'furnace-mouth');
  box(furnace, [0.26, 0.22, 0.045], glow(0xff7b32), [0, 0.41, 0.335], 'furnace-fire');
  for (const x of [-0.09, 0, 0.09]) {
    box(furnace, [0.025, 0.24, 0.025], metal, [x, 0.41, 0.365]);
  }
  box(furnace, [0.4, 0.07, 0.12], metal, [0, 0.19, 0.35], 'furnace-hearth');
}

function addChimney(parent: THREE.Group, stone: THREE.Material, metal: THREE.Material, dark: THREE.Material): void {
  const chimney = component(parent, 'chimney', [-0.18, 0, -0.19]);
  cylinder(chimney, 0.12, 0.17, 0.82, 8, stone, [0, 1.23, 0], 'chimney-stack');
  cylinder(chimney, 0.18, 0.18, 0.12, 8, metal, [0, 1.66, 0], 'chimney-rim');
  cylinder(chimney, 0.12, 0.12, 0.015, 8, dark, [0, 1.728, 0], 'chimney-opening');
  mesh(
    chimney,
    new THREE.IcosahedronGeometry(0.09, 0),
    glow(0xe39a55),
    [0.025, 1.79, 0],
    [0.85, 1.25, 0.85],
    [0, 0, 0],
    'chimney-ember-glow',
  );
}

function addAnvil(parent: THREE.Group, metal: THREE.Material, dark: THREE.Material): void {
  const anvil = component(parent, 'anvil', [0.4, 0, 0.3]);
  box(anvil, [0.3, 0.12, 0.27], dark, [0, 0.18, 0], 'anvil-base');
  box(anvil, [0.15, 0.23, 0.17], metal, [-0.025, 0.345, 0], 'anvil-stem');
  box(anvil, [0.43, 0.12, 0.23], metal, [0, 0.52, 0], 'anvil-top');
  mesh(
    anvil,
    new THREE.ConeGeometry(0.105, 0.32, 6),
    metal,
    [0.34, 0.52, 0],
    [1, 1, 1],
    [0, 0, -Math.PI / 2],
    'anvil-horn',
  );
  box(anvil, [0.2, 0.025, 0.04], glow(0x78d9e8), [-0.05, 0.59, 0], 'anvil-elemental-strike');
}

function addElementalCrystals(parent: THREE.Group, stone: THREE.Material): void {
  const crystals = [
    ['fire', 0xff7938, [-0.53, 0.43, 0.3]],
    ['water', 0x68cde5, [0.02, 0.4, 0.57]],
    ['earth', 0x91c66d, [0.5, 0.44, -0.3]],
    ['air', 0xc4a2e8, [-0.5, 0.5, -0.4]],
  ] as const;
  for (const [element, color, position] of crystals) {
    cylinder(parent, 0.075, 0.11, 0.2, 6, stone, [position[0], 0.22, position[2]]);
    const crystal = mesh(
      parent,
      new THREE.OctahedronGeometry(0.1, 0),
      glow(color),
      position,
      [0.85, 1.55, 0.85],
      [0, 0, 0],
      `elemental-${element}`,
    );
    crystal.userData.element = element;
  }
}

export function createElementalForgeModel(): THREE.Group {
  const group = new THREE.Group();
  const stone = material(0x65616b);
  const metal = material(0x899398, { metalness: 0.65, roughness: 0.42 });
  const dark = material(0x29252e, { metalness: 0.25 });
  cylinder(group, 0.68, 0.73, 0.12, 10, dark, [0, 0.06, 0], 'forge-foundation');
  addFurnace(group, stone, metal, dark);
  addChimney(group, stone, metal, dark);
  addAnvil(group, metal, dark);
  addElementalCrystals(group, stone);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.name = 'elemental-forge';
  group.userData.landmarkId = 'elementalForge';
  group.userData.animationPivot = 'ground';
  group.userData.visualHeight = size.y;
  group.userData.labelHeight = bounds.max.y + 0.35;
  return group;
}
