import * as THREE from 'three';

interface DungeonPalette {
  basalt: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  edge: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  amethyst: THREE.MeshStandardMaterial;
  crystal: THREE.MeshStandardMaterial;
  ember: THREE.MeshStandardMaterial;
  eye: THREE.MeshStandardMaterial;
  timber: THREE.MeshStandardMaterial;
  ghost: THREE.MeshStandardMaterial;
}

interface DwellingDefinition {
  radius: number;
  guideHeight: number;
  accent: number;
  build: (model: THREE.Group, palette: DungeonPalette) => void;
}

function createPalette(): DungeonPalette {
  return {
    basalt: new THREE.MeshStandardMaterial({ color: 0x24232d, roughness: 0.94, metalness: 0.08 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x484252, roughness: 0.9, metalness: 0.06 }),
    edge: new THREE.MeshStandardMaterial({ color: 0x71627e, roughness: 0.72, metalness: 0.16 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x07080d, roughness: 1 }),
    amethyst: new THREE.MeshStandardMaterial({
      color: 0x9b63d2,
      emissive: 0x32164f,
      emissiveIntensity: 0.75,
      roughness: 0.28,
      metalness: 0.22,
    }),
    crystal: new THREE.MeshStandardMaterial({
      color: 0x55b8b0,
      emissive: 0x123f43,
      emissiveIntensity: 0.7,
      roughness: 0.3,
      metalness: 0.18,
    }),
    ember: new THREE.MeshStandardMaterial({
      color: 0xa83645,
      emissive: 0x5d101b,
      emissiveIntensity: 0.9,
      roughness: 0.42,
    }),
    eye: new THREE.MeshStandardMaterial({
      color: 0xffb44a,
      emissive: 0xff4b16,
      emissiveIntensity: 1.6,
      roughness: 0.25,
    }),
    timber: new THREE.MeshStandardMaterial({ color: 0x5f463d, roughness: 0.96 }),
    ghost: new THREE.MeshStandardMaterial({
      color: 0x8a67ad,
      emissive: 0x251538,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.28,
      wireframe: true,
      depthWrite: false,
    }),
  };
}

function addMesh(
  parent: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name: string,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addFoundation(parent: THREE.Group, palette: DungeonPalette, radius: number): void {
  addMesh(
    parent,
    new THREE.CylinderGeometry(radius, radius + 0.12, 0.18, 10),
    palette.basalt,
    'basalt-foundation',
    0,
    0.09,
  );
  addMesh(
    parent,
    new THREE.CylinderGeometry(radius * 0.93, radius * 0.96, 0.08, 10),
    palette.edge,
    'foundation-inlay',
    0,
    0.2,
  );
}

function addCrystal(
  parent: THREE.Group,
  material: THREE.Material,
  x: number,
  baseY: number,
  z: number,
  height: number,
  radius: number,
  tilt = 0,
): THREE.Mesh {
  const crystal = addMesh(
    parent,
    new THREE.ConeGeometry(radius, height, 5),
    material,
    'cavern-crystal',
    x,
    baseY + height / 2,
    z,
  );
  crystal.rotation.z = tilt;
  crystal.rotation.y = x * 0.7 + z * 0.4;
  return crystal;
}

function addCaveMouth(
  parent: THREE.Group,
  palette: DungeonPalette,
  radius: number,
  baseY: number,
  z: number,
  name: string,
): void {
  const darkness = addMesh(
    parent,
    new THREE.CircleGeometry(radius, 20),
    palette.dark,
    name,
    0,
    baseY + radius,
    z,
  );
  darkness.scale.y = 1.12;
  addMesh(
    parent,
    new THREE.TorusGeometry(radius, radius * 0.18, 7, 20, Math.PI),
    palette.edge,
    `${name}-arch`,
    0,
    baseY + radius,
    z + 0.025,
  );
  for (const side of [-1, 1]) {
    addMesh(
      parent,
      new THREE.BoxGeometry(radius * 0.3, radius * 1.08, radius * 0.28),
      palette.stone,
      `${name}-jamb`,
      side * radius,
      baseY + radius * 0.52,
      z + 0.015,
    );
  }
}

function buildWarrens(model: THREE.Group, palette: DungeonPalette): void {
  addFoundation(model, palette, 1.58);
  const mound = addMesh(
    model,
    new THREE.SphereGeometry(1.24, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    palette.stone,
    'warrens-mound',
    0,
    0.22,
  );
  mound.scale.set(1.15, 0.82, 1);
  addCaveMouth(model, palette, 0.56, 0.24, 1.25, 'warrens-tunnel');

  for (const side of [-1, 1]) {
    const sideTunnel = addMesh(
      model,
      new THREE.CircleGeometry(0.27, 14),
      palette.dark,
      'warrens-side-tunnel',
      side * 0.9,
      0.51,
      0.88,
    );
    sideTunnel.rotation.y = side * 0.55;
    addCrystal(model, palette.amethyst, side * 1.18, 0.23, 0.15, 0.95, 0.2, side * -0.18);
    addCrystal(model, palette.crystal, side * 1.3, 0.22, 0.62, 0.58, 0.14, side * -0.25);
    addMesh(
      model,
      new THREE.CylinderGeometry(0.2, 0.24, 0.09, 7),
      palette.edge,
      'warrens-step',
      side * 0.32,
      0.285,
      1.42,
    );
  }
  addCrystal(model, palette.crystal, -0.48, 0.84, -0.32, 0.72, 0.17, -0.12);
  addCrystal(model, palette.amethyst, 0.35, 0.91, -0.4, 0.62, 0.15, 0.14);
}

function buildHarpyRoost(model: THREE.Group, palette: DungeonPalette): void {
  addFoundation(model, palette, 1.5);
  addMesh(
    model,
    new THREE.CylinderGeometry(0.4, 0.88, 2.3, 7),
    palette.stone,
    'harpy-stalagmite',
    0,
    1.37,
  );
  addMesh(
    model,
    new THREE.CylinderGeometry(1.02, 0.88, 0.16, 9),
    palette.edge,
    'harpy-roost-platform',
    0,
    2.48,
  );
  const nest = addMesh(
    model,
    new THREE.TorusGeometry(0.66, 0.13, 7, 18),
    palette.timber,
    'harpy-nest',
    0,
    2.61,
  );
  nest.rotation.x = Math.PI / 2;
  addCrystal(model, palette.amethyst, 0, 2.53, -0.12, 1.18, 0.34).name = 'harpy-crown';

  for (const side of [-1, 1]) {
    const perch = addMesh(
      model,
      new THREE.CylinderGeometry(0.09, 0.15, 1.42, 6),
      palette.edge,
      'harpy-wing-perch',
      side * 0.67,
      2.27,
      0.03,
    );
    perch.rotation.z = Math.PI / 2;
    addCrystal(model, palette.amethyst, side * 0.67, 2.57, 0.05, 0.7, 0.15, side * -0.45);
    addCrystal(model, palette.crystal, side * 0.85, 0.23, 0.25, 1.25, 0.23, side * -0.2);
    addCrystal(model, palette.amethyst, side * 1.17, 0.22, -0.45, 0.72, 0.17, side * -0.25);
  }
  addMesh(
    model,
    new THREE.CylinderGeometry(0.36, 0.46, 0.09, 8),
    palette.dark,
    'harpy-roost-hollow',
    0,
    0.285,
    0.82,
  );
}

function buildMinotaurLabyrinth(model: THREE.Group, palette: DungeonPalette): void {
  addFoundation(model, palette, 1.63);
  addMesh(model, new THREE.BoxGeometry(3.04, 0.12, 3.04), palette.dark, 'labyrinth-floor', 0, 0.28);
  const maze = new THREE.Group();
  maze.name = 'labyrinth-maze';
  model.add(maze);
  const wall = (x: number, z: number, width: number, depth: number): void => {
    addMesh(maze, new THREE.BoxGeometry(width, 0.72, depth), palette.stone, 'labyrinth-wall', x, 0.65, z);
    addMesh(maze, new THREE.BoxGeometry(width + 0.04, 0.08, depth + 0.04), palette.edge, 'labyrinth-coping', x, 1.04, z);
  };

  wall(-0.98, 1.4, 1.08, 0.16);
  wall(0.98, 1.4, 1.08, 0.16);
  wall(0, -1.4, 3.04, 0.16);
  wall(-1.44, 0, 0.16, 2.8);
  wall(1.44, 0, 0.16, 2.8);
  wall(-0.72, 0.55, 1.28, 0.14);
  wall(0.8, 0.62, 0.14, 1.42);
  wall(0.25, -0.25, 1.4, 0.14);
  wall(-0.72, -0.78, 0.14, 1.1);

  addMesh(
    model,
    new THREE.CylinderGeometry(0.48, 0.62, 1.38, 6),
    palette.basalt,
    'minotaur-sanctum',
    0,
    1.02,
    0.38,
  );
  addMesh(model, new THREE.BoxGeometry(0.48, 0.7, 0.08), palette.dark, 'minotaur-gate', 0, 0.76, 0.92);
  for (const side of [-1, 1]) {
    addCrystal(model, palette.edge, side * 0.43, 1.68, 0.35, 0.83, 0.16, side * -0.58).name =
      'minotaur-horn';
    addCrystal(model, palette.amethyst, side * 1.15, 0.24, -1.05, 0.68, 0.15, side * -0.12);
  }
  addCrystal(model, palette.ember, 0, 1.7, 0.38, 0.55, 0.18).name = 'minotaur-heart';
}

function buildRedDragonCavern(model: THREE.Group, palette: DungeonPalette): void {
  addFoundation(model, palette, 1.63);
  const mound = addMesh(
    model,
    new THREE.SphereGeometry(1.43, 16, 9, 0, Math.PI * 2, 0, Math.PI / 2),
    palette.basalt,
    'dragon-cavern-mound',
    0,
    0.22,
    -0.06,
  );
  mound.scale.set(1.12, 1.04, 1);
  addCaveMouth(model, palette, 0.79, 0.24, 1.43, 'red-dragon-maw');
  const glow = addMesh(
    model,
    new THREE.CircleGeometry(0.49, 18),
    palette.ember,
    'dragon-maw-glow',
    0,
    0.77,
    1.465,
  );
  glow.scale.y = 0.7;

  for (const side of [-1, 1]) {
    addMesh(model, new THREE.SphereGeometry(0.095, 10, 7), palette.eye, 'dragon-eye', side * 0.32, 1.28, 1.46);
    addCrystal(model, palette.ember, side * 0.98, 0.68, -0.05, 1.75, 0.31, side * -0.34).name =
      'dragon-wing-spire';
    addCrystal(model, palette.amethyst, side * 1.45, 0.23, 0.65, 0.96, 0.21, side * -0.22);
    addCrystal(model, palette.ember, side * 0.53, 1.24, -0.62, 1.28, 0.25, side * -0.18);
  }
  addCrystal(model, palette.ember, 0, 1.36, -0.52, 1.72, 0.34).name = 'dragon-crown';
  addMesh(
    model,
    new THREE.CylinderGeometry(0.66, 0.75, 0.07, 9),
    palette.ember,
    'dragon-ember-pool',
    0,
    0.275,
    0.92,
  );
  for (const x of [-0.42, 0, 0.42]) {
    addCrystal(model, palette.amethyst, x, 0.72, -1.12, 0.86 + Math.abs(x) * 0.4, 0.18, x * 0.25);
  }
}

const DWELLINGS: Record<string, DwellingDefinition> = {
  troglodyteWarrens: { radius: 1.58, guideHeight: 1.05, accent: 0x55b8b0, build: buildWarrens },
  harpyRoost: { radius: 1.5, guideHeight: 2.65, accent: 0x9b63d2, build: buildHarpyRoost },
  minotaurLabyrinth: { radius: 1.63, guideHeight: 1.45, accent: 0xb58ac8, build: buildMinotaurLabyrinth },
  redDragonCavern: { radius: 1.63, guideHeight: 2.1, accent: 0xa83645, build: buildRedDragonCavern },
};

function addConstructionSite(
  model: THREE.Group,
  palette: DungeonPalette,
  buildingId: string,
  definition: DwellingDefinition,
): void {
  const site = new THREE.Group();
  site.name = 'construction-site';
  model.add(site);
  addFoundation(site, palette, definition.radius);

  const guideMaterial = palette.ghost.clone();
  guideMaterial.color.setHex(definition.accent);
  const guide = addMesh(
    site,
    new THREE.CylinderGeometry(
      definition.radius * 0.38,
      definition.radius * 0.64,
      definition.guideHeight,
      7,
    ),
    guideMaterial,
    `${buildingId}-blueprint`,
    0,
    0.24 + definition.guideHeight / 2,
  );
  guide.rotation.y = Math.PI / 7;

  const offset = definition.radius * 0.68;
  for (const x of [-offset, offset]) {
    for (const z of [-offset, offset]) {
      addMesh(site, new THREE.BoxGeometry(0.09, 1.12, 0.09), palette.timber, 'scaffold-post', x, 0.78, z);
    }
  }
  for (const z of [-offset, offset]) {
    addMesh(
      site,
      new THREE.BoxGeometry(offset * 2 + 0.12, 0.09, 0.09),
      palette.timber,
      'scaffold-beam',
      0,
      1.28,
      z,
    );
  }
  for (const [index, x] of [-0.65, 0, 0.65].entries()) {
    const block = addMesh(
      site,
      new THREE.DodecahedronGeometry(0.22 + index * 0.025, 0),
      index === 1 ? palette.amethyst : palette.stone,
      'construction-stone',
      x,
      0.42,
      definition.radius * 0.72,
    );
    block.rotation.set(index * 0.3, index * 0.55, index * 0.2);
  }
}

export function createBuildingModel(buildingId: string, built: boolean): THREE.Group | null {
  if (!Object.hasOwn(DWELLINGS, buildingId)) return null;
  const definition = DWELLINGS[buildingId];
  if (!definition) return null;

  const model = new THREE.Group();
  model.name = `Dungeon:${buildingId}:${built ? 'built' : 'unbuilt'}`;
  model.userData = { faction: 'Dungeon', buildingId, built };
  const palette = createPalette();

  if (built) {
    const complete = new THREE.Group();
    complete.name = `${buildingId}-complete`;
    model.add(complete);
    definition.build(complete, palette);
  } else {
    addConstructionSite(model, palette, buildingId, definition);
  }
  return model;
}

export default { faction: 'Dungeon', createBuildingModel } as const;
