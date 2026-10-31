import * as THREE from 'three';

const GROVE_DWELLING_IDS = [
  'spriteGlade',
  'rangerLodge',
  'unicornGrove',
  'dragonCliffs',
] as const;

type GroveDwellingId = typeof GROVE_DWELLING_IDS[number];
type Point = readonly [number, number, number];

function material(color: number, roughness = 0.86, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}

function glow(color: number, intensity = 0.45): THREE.MeshStandardMaterial {
  const surface = material(color, 0.42);
  surface.emissive.setHex(color);
  surface.emissiveIntensity = intensity;
  return surface;
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
  segments: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, x, y, z);
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

function branch(
  parent: THREE.Object3D,
  start: Point,
  end: Point,
  radius: number,
  surface: THREE.Material,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const result = mesh(
    parent,
    new THREE.CylinderGeometry(radius * 0.68, radius, direction.length(), 7),
    surface,
  );
  result.position.copy(from).add(to).multiplyScalar(0.5);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function leaf(
  parent: THREE.Object3D,
  surface: THREE.Material,
  x: number,
  y: number,
  z: number,
  radius: number,
  verticalScale = 0.7,
): THREE.Mesh {
  const result = mesh(parent, new THREE.IcosahedronGeometry(radius, 0), surface, x, y, z);
  result.scale.y = verticalScale;
  result.rotation.y = (x + z) * 0.7;
  return result;
}

function addFoundation(parent: THREE.Group): void {
  const foundation = new THREE.Group();
  foundation.name = 'root-bound-foundation';
  parent.add(foundation);
  const earth = material(0x4f6745);
  const moss = material(0x71925f);
  const stone = material(0x82947a);
  const root = material(0x62523c);
  cylinder(foundation, 1.48, 1.56, 0.14, 12, earth, 0, 0.07, 0);
  cylinder(foundation, 1.43, 1.48, 0.06, 12, moss, 0, 0.15, 0);
  const rim = mesh(foundation, new THREE.TorusGeometry(1.34, 0.035, 5, 24), root, 0, 0.18, 0);
  rim.rotation.x = Math.PI / 2;
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    const rock = mesh(
      foundation,
      new THREE.DodecahedronGeometry(0.12, 0),
      stone,
      Math.cos(angle) * 1.32,
      0.22,
      Math.sin(angle) * 1.32,
    );
    rock.scale.set(1.15, 0.65, 0.9);
    rock.rotation.y = angle;
  }
}

function addConstructionFrame(parent: THREE.Group): void {
  const frame = new THREE.Group();
  frame.name = 'timber-scaffolding';
  parent.add(frame);
  const timber = material(0xa18a61);
  const rope = material(0xc2b78d);
  for (const [x, z] of [[-1.04, -0.84], [1.04, -0.84], [-1.04, 0.84], [1.04, 0.84]] as const) {
    cylinder(frame, 0.045, 0.065, 0.85, 6, timber, x, 0.605, z);
    const lashing = mesh(frame, new THREE.TorusGeometry(0.066, 0.015, 4, 8), rope, x, 0.94, z);
    lashing.rotation.x = Math.PI / 2;
  }
  for (const z of [-0.84, 0.84]) {
    branch(frame, [-1.04, 0.98, z], [1.04, 0.98, z], 0.04, timber);
  }
  branch(frame, [-1.04, 0.42, -0.84], [-1.04, 0.94, 0.84], 0.032, timber);
  branch(frame, [1.04, 0.42, 0.84], [1.04, 0.94, -0.84], 0.032, timber);
  box(frame, 0.72, 0.07, 0.24, timber, 0.45, 0.235, 1.03).rotation.y = -0.18;
}

function addMushroom(
  parent: THREE.Group,
  x: number,
  z: number,
  scale: number,
  stem: THREE.Material,
  cap: THREE.Material,
): void {
  cylinder(parent, 0.055 * scale, 0.075 * scale, 0.34 * scale, 7, stem, x, 0.18 + 0.17 * scale, z);
  const crown = mesh(
    parent,
    new THREE.SphereGeometry(0.22 * scale, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    cap,
    x,
    0.18 + 0.34 * scale,
    z,
  );
  crown.scale.y = 0.55;
}

function addSpriteGlade(parent: THREE.Group, built: boolean): void {
  const bark = material(0x62523c);
  const barkLight = material(0x806348);
  const leaves = material(0x3f7357);
  const leafLight = material(0x71925f);
  const cream = material(0xe4d7b0);
  const flower = glow(0xe7b6d2, 0.28);
  const lantern = glow(0x9fe0b4, 0.75);
  if (!built) {
    const sapling = new THREE.Group();
    sapling.name = 'glade-sapling-and-mushroom-ring';
    parent.add(sapling);
    cylinder(sapling, 0.07, 0.12, 1.1, 7, bark, 0, 0.73, 0);
    branch(sapling, [0, 0.88, 0], [-0.34, 1.23, 0.04], 0.045, bark);
    branch(sapling, [0, 0.98, 0], [0.32, 1.3, -0.04], 0.04, bark);
    leaf(sapling, leaves, -0.3, 1.28, 0.03, 0.3);
    leaf(sapling, leafLight, 0.28, 1.34, -0.03, 0.28);
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3;
      addMushroom(sapling, Math.cos(angle) * 0.76, Math.sin(angle) * 0.76, 0.55, cream, flower);
    }
    return;
  }

  const dwelling = new THREE.Group();
  dwelling.name = 'flowering-hollow-stump';
  parent.add(dwelling);
  cylinder(dwelling, 0.34, 0.48, 1.68, 9, bark, 0, 1.02, 0);
  for (const [x, z] of [[-0.36, 0.22], [0.36, 0.22], [-0.3, -0.28], [0.3, -0.28]] as const) {
    branch(dwelling, [x * 1.65, 0.18, z * 1.65], [x, 0.62, z], 0.11, bark);
  }
  box(dwelling, 0.28, 0.56, 0.055, material(0x334b39), 0, 0.48, 0.432);
  const doorway = mesh(dwelling, new THREE.TorusGeometry(0.17, 0.035, 6, 12, Math.PI), barkLight, 0, 0.76, 0.45);
  doorway.rotation.z = 0;
  for (const x of [-0.22, 0.22]) {
    const window = mesh(dwelling, new THREE.CircleGeometry(0.075, 8), lantern, x, 1.22, 0.326);
    window.rotation.y = x * 0.8;
  }
  branch(dwelling, [0, 1.42, 0], [-0.88, 2.08, 0.05], 0.13, bark);
  branch(dwelling, [0, 1.5, 0], [0.86, 2.12, -0.06], 0.12, bark);
  branch(dwelling, [0, 1.58, 0], [0, 2.76, 0], 0.14, bark);
  cone(dwelling, 1.28, 0.72, 9, leaves, 0, 2.54, 0);
  leaf(dwelling, leaves, -0.67, 2.42, 0.08, 0.62, 0.58);
  leaf(dwelling, leafLight, 0.66, 2.46, -0.06, 0.6, 0.58);
  leaf(dwelling, leaves, 0, 2.95, 0, 0.72, 0.68);
  for (const [x, y, z] of [[-0.8, 1.93, 0.08], [0.79, 1.98, -0.04], [0.38, 2.12, 0.63]] as const) {
    branch(dwelling, [x * 0.82, y + 0.25, z * 0.82], [x, y, z], 0.018, barkLight);
    mesh(dwelling, new THREE.OctahedronGeometry(0.11, 0), lantern, x, y - 0.08, z);
  }
  addMushroom(dwelling, -0.96, 0.3, 1.05, cream, flower);
  addMushroom(dwelling, 0.96, 0.22, 0.82, cream, flower);
  addMushroom(dwelling, 0.74, 0.83, 0.58, cream, flower);
  const bloom = mesh(dwelling, new THREE.OctahedronGeometry(0.18, 0), flower, 0, 3.52, 0);
  bloom.rotation.y = Math.PI / 4;
  for (let index = 0; index < 5; index += 1) {
    const angle = index * Math.PI * 2 / 5;
    const petal = leaf(dwelling, flower, Math.cos(angle) * 0.2, 3.44, Math.sin(angle) * 0.2, 0.13, 0.35);
    petal.rotation.z = Math.cos(angle) * 0.5;
  }
}

function addRangerLodge(parent: THREE.Group, built: boolean): void {
  const bark = material(0x62523c);
  const timber = material(0x806348);
  const darkWood = material(0x493e31);
  const leaves = material(0x2f6747);
  const leafLight = material(0x3f7357);
  const cord = material(0xd0bd8d);
  if (!built) {
    const frame = new THREE.Group();
    frame.name = 'unfinished-lodge-floor-and-roof';
    parent.add(frame);
    box(frame, 1.62, 0.12, 1.18, timber, 0, 0.36, 0);
    for (const x of [-0.68, 0.68]) {
      for (const z of [-0.44, 0.44]) cylinder(frame, 0.055, 0.075, 0.8, 6, darkWood, x, 0.76, z);
    }
    for (const z of [-0.44, 0.44]) {
      branch(frame, [-0.82, 1.14, z], [0, 1.72, z], 0.055, timber);
      branch(frame, [0, 1.72, z], [0.82, 1.14, z], 0.055, timber);
    }
    branch(frame, [0, 1.72, -0.52], [0, 1.72, 0.52], 0.05, timber);
    box(frame, 0.48, 0.06, 0.18, timber, -0.62, 0.24, 0.92).rotation.y = 0.25;
    return;
  }

  const lodge = new THREE.Group();
  lodge.name = 'living-tree-ranger-treehouse';
  parent.add(lodge);
  cylinder(lodge, 0.25, 0.46, 2.57, 9, bark, 0, 1.465, -0.35);
  for (const [x, z] of [[-0.74, 0.38], [0.74, 0.38], [-0.68, -0.48], [0.68, -0.48]] as const) {
    branch(lodge, [x * 0.7, 0.18, z * 0.7], [x, 0.72, z], 0.09, bark);
  }
  box(lodge, 1.86, 0.14, 1.48, darkWood, 0, 0.58, 0.04);
  box(lodge, 1.52, 1.08, 1.18, timber, 0, 1.16, 0.02);
  for (const x of [-0.62, -0.31, 0, 0.31, 0.62]) {
    box(lodge, 0.045, 1.02, 0.025, darkWood, x, 1.16, 0.625);
  }
  box(lodge, 0.3, 0.65, 0.055, material(0x304536), 0, 0.99, 0.64);
  const doorArch = mesh(lodge, new THREE.TorusGeometry(0.18, 0.035, 5, 12, Math.PI), darkWood, 0, 1.31, 0.66);
  doorArch.rotation.z = 0;
  for (const x of [-0.47, 0.47]) box(lodge, 0.19, 0.28, 0.035, glow(0x9fe0b4, 0.32), x, 1.29, 0.64);
  cone(lodge, 1.2, 0.75, 7, leaves, 0, 2.05, 0);
  leaf(lodge, leafLight, -0.66, 2.3, -0.3, 0.58, 0.62);
  leaf(lodge, leaves, 0.62, 2.4, -0.35, 0.62, 0.62);
  branch(lodge, [0, 2.12, -0.35], [-0.9, 2.68, -0.36], 0.1, bark);
  branch(lodge, [0, 2.18, -0.35], [0.86, 2.72, -0.32], 0.09, bark);
  leaf(lodge, leaves, 0, 2.67, -0.35, 0.68, 0.65);
  cone(lodge, 0.25, 0.42, 7, leafLight, 0, 3.09, -0.35);
  for (const x of [-0.82, -0.42, 0.42, 0.82]) {
    cylinder(lodge, 0.026, 0.032, 0.43, 6, darkWood, x, 0.865, 0.76);
  }
  branch(lodge, [-0.86, 1.06, 0.76], [0.86, 1.06, 0.76], 0.025, darkWood);
  const target = new THREE.Group();
  target.name = 'archery-target';
  target.position.set(0.96, 1.1, 0.36);
  target.rotation.y = -0.35;
  lodge.add(target);
  for (const [radius, tube, surface] of [[0.25, 0.035, cord], [0.16, 0.025, darkWood], [0.07, 0.022, cord]] as const) {
    mesh(target, new THREE.TorusGeometry(radius, tube, 5, 16), surface);
  }
  branch(lodge, [0.96, 0.18, 0.34], [0.96, 0.87, 0.34], 0.035, darkWood);
  const bow = mesh(lodge, new THREE.TorusGeometry(0.32, 0.022, 5, 16, Math.PI * 1.25), cord, -0.91, 1.12, 0.42);
  bow.rotation.z = -Math.PI * 0.62;
}

function addUnicornGrove(parent: THREE.Group, built: boolean): void {
  const bark = material(0x62523c);
  const leaves = material(0x3f7357);
  const leafLight = material(0x71925f);
  const moonstone = material(0xb7c8ae, 0.62);
  const paleStone = material(0xd7dfc4, 0.54);
  const moonlight = glow(0xb9f0d1, 0.62);
  if (!built) {
    const arch = new THREE.Group();
    arch.name = 'unfinished-moonstone-arch';
    parent.add(arch);
    cylinder(arch, 0.13, 0.19, 1.15, 7, moonstone, -0.55, 0.755, 0);
    cylinder(arch, 0.13, 0.19, 0.82, 7, moonstone, 0.55, 0.59, 0);
    const arc = mesh(arch, new THREE.TorusGeometry(0.55, 0.08, 6, 12, Math.PI * 0.55), moonstone, 0, 1.32, 0);
    arc.rotation.z = Math.PI * 0.225;
    box(arch, 0.34, 0.2, 0.3, paleStone, 0.72, 0.28, 0.34).rotation.y = 0.3;
    mesh(arch, new THREE.OctahedronGeometry(0.13, 0), moonlight, 0, 0.34, 0.22);
    return;
  }

  const grove = new THREE.Group();
  grove.name = 'moonwell-and-unicorn-arch';
  parent.add(grove);
  cylinder(grove, 1.04, 1.1, 0.09, 16, moonstone, 0, 0.225, 0.22);
  cylinder(grove, 0.94, 0.94, 0.035, 16, material(0x65a894, 0.24, 0.08), 0, 0.285, 0.22);
  const poolRim = mesh(grove, new THREE.TorusGeometry(1.01, 0.055, 6, 24), paleStone, 0, 0.31, 0.22);
  poolRim.rotation.x = Math.PI / 2;
  for (const x of [-0.68, 0.68]) {
    cylinder(grove, 0.12, 0.2, 1.52, 7, moonstone, x, 0.94, 0.24);
    cone(grove, 0.16, 0.38, 6, paleStone, x, 1.89, 0.24);
  }
  mesh(grove, new THREE.TorusGeometry(0.68, 0.11, 7, 20, Math.PI), moonstone, 0, 1.7, 0.24);
  const crescent = mesh(grove, new THREE.TorusGeometry(0.26, 0.045, 6, 18, Math.PI * 1.55), moonlight, 0, 2.14, 0.27);
  crescent.rotation.z = -Math.PI * 0.27;
  mesh(grove, new THREE.OctahedronGeometry(0.16, 0), moonlight, 0, 0.62, 0.22).scale.y = 1.55;
  cylinder(grove, 0.22, 0.4, 2.9, 9, bark, 0, 1.63, -0.6);
  for (const [x, z] of [[-1.02, -0.38], [1.02, -0.38]] as const) {
    cylinder(grove, 0.15, 0.28, 2.25, 8, bark, x, 1.305, z);
    branch(grove, [x, 1.78, z], [x * 1.25, 2.42, z + 0.08], 0.075, bark);
    leaf(grove, leaves, x, 2.65, z, 0.55, 0.8);
    leaf(grove, leafLight, x * 1.18, 2.46, z + 0.08, 0.4, 0.72);
  }
  branch(grove, [0, 2.45, -0.6], [-0.72, 3.22, -0.5], 0.1, bark);
  branch(grove, [0, 2.55, -0.6], [0.72, 3.28, -0.52], 0.1, bark);
  leaf(grove, leaves, -0.52, 3.39, -0.55, 0.62, 0.68);
  leaf(grove, leafLight, 0.52, 3.43, -0.55, 0.62, 0.68);
  leaf(grove, leaves, 0, 3.55, -0.58, 0.65, 0.65);
  mesh(grove, new THREE.OctahedronGeometry(0.18, 0), moonlight, 0, 4.12, -0.58);
  for (const [x, z] of [[-0.92, 0.78], [0.92, 0.78], [-1.15, 0.25], [1.15, 0.25]] as const) {
    cone(grove, 0.075, 0.28, 5, paleStone, x, 0.32, z);
    mesh(grove, new THREE.OctahedronGeometry(0.055, 0), moonlight, x, 0.51, z);
  }
}

function addDragonCliffs(parent: THREE.Group, built: boolean): void {
  const rock = material(0x687462);
  const darkRock = material(0x465248);
  const bark = material(0x62523c);
  const leaves = material(0x2f6747);
  const leafLight = material(0x3f7357);
  const nestMaterial = material(0x8a7350);
  const egg = glow(0x9fe0b4, 0.4);
  if (!built) {
    const roost = new THREE.Group();
    roost.name = 'unfinished-cliffside-roost';
    parent.add(roost);
    for (const [x, y, z, scale] of [[-0.5, 0.42, -0.2, 0.55], [0.35, 0.5, -0.3, 0.65], [0.72, 0.35, 0.28, 0.4]] as const) {
      const stone = mesh(roost, new THREE.DodecahedronGeometry(scale, 0), rock, x, y, z);
      stone.scale.y = 0.72;
      stone.rotation.y = x;
    }
    branch(roost, [-0.68, 0.38, -0.18], [-0.82, 1.82, -0.22], 0.11, bark);
    branch(roost, [0.5, 0.48, -0.28], [0.74, 1.58, -0.3], 0.1, bark);
    branch(roost, [-0.82, 1.72, -0.22], [0.74, 1.5, -0.3], 0.075, nestMaterial);
    const nest = mesh(roost, new THREE.TorusGeometry(0.48, 0.065, 5, 14), nestMaterial, 0, 0.64, 0.36);
    nest.rotation.x = Math.PI / 2;
    return;
  }

  const cliffs = new THREE.Group();
  cliffs.name = 'ancient-tree-dragon-roost';
  parent.add(cliffs);
  const crag = mesh(cliffs, new THREE.DodecahedronGeometry(1, 0), rock, 0, 1.02, -0.12);
  crag.scale.set(1.25, 0.85, 1);
  crag.rotation.y = 0.24;
  const lowerCrag = mesh(cliffs, new THREE.DodecahedronGeometry(0.72, 0), darkRock, -0.68, 0.63, 0.22);
  lowerCrag.scale.set(0.85, 0.8, 1.05);
  const cave = mesh(cliffs, new THREE.CircleGeometry(0.5, 12), material(0x263b31), 0, 0.75, 0.885);
  cave.scale.y = 1.1;
  mesh(cliffs, new THREE.TorusGeometry(0.55, 0.1, 7, 16, Math.PI), darkRock, 0, 0.75, 0.9);
  for (const [x, y, z, height] of [[-0.92, 0.68, 0.52, 0.65], [0.9, 0.82, 0.38, 0.82], [0.64, 1.33, -0.62, 0.55]] as const) {
    const crystal = mesh(cliffs, new THREE.OctahedronGeometry(0.12, 0), egg, x, y, z);
    crystal.scale.y = height / 0.24;
  }
  cylinder(cliffs, 0.28, 0.5, 2.3, 9, bark, 0, 2.6, -0.28);
  for (const [x, z] of [[-0.65, 0.18], [0.65, 0.18], [-0.5, -0.7], [0.5, -0.7]] as const) {
    branch(cliffs, [x, 1.42, z], [x * 0.38, 2.02, -0.28 + z * 0.2], 0.13, bark);
  }
  branch(cliffs, [0, 3.04, -0.28], [-1.18, 3.52, -0.12], 0.16, bark);
  branch(cliffs, [0, 3.12, -0.28], [1.18, 3.58, -0.1], 0.15, bark);
  branch(cliffs, [-1.05, 3.46, -0.12], [1.05, 3.5, -0.1], 0.12, nestMaterial);
  for (const [radius, y, tube] of [[0.79, 3.43, 0.12], [0.66, 3.52, 0.075], [0.52, 3.57, 0.055]] as const) {
    const nest = mesh(cliffs, new THREE.TorusGeometry(radius, tube, 6, 18), nestMaterial, 0, y, 0.02);
    nest.rotation.x = Math.PI / 2;
    nest.rotation.z = radius;
  }
  for (const [x, z, scale] of [[-0.24, 0.02, 1], [0.18, -0.12, 0.9], [0.08, 0.28, 0.78]] as const) {
    const dragonEgg = mesh(cliffs, new THREE.IcosahedronGeometry(0.14, 1), egg, x, 3.69, z);
    dragonEgg.scale.set(scale, scale * 1.35, scale);
  }
  leaf(cliffs, leaves, -0.72, 4.02, -0.28, 0.65, 0.58);
  leaf(cliffs, leafLight, 0.72, 4.08, -0.28, 0.65, 0.58);
  leaf(cliffs, leaves, 0, 4.28, -0.32, 0.65, 0.55);
  cone(cliffs, 0.2, 0.38, 7, leafLight, 0, 4.81, -0.32);
}

const BUILDERS: Record<GroveDwellingId, (parent: THREE.Group, built: boolean) => void> = {
  spriteGlade: addSpriteGlade,
  rangerLodge: addRangerLodge,
  unicornGrove: addUnicornGrove,
  dragonCliffs: addDragonCliffs,
};

function createBuildingModel(buildingId: string, built: boolean): THREE.Group | null {
  if (!Object.hasOwn(BUILDERS, buildingId)) return null;
  const id = buildingId as GroveDwellingId;
  const model = new THREE.Group();
  model.name = `Grove:${id}:${built ? 'built' : 'unbuilt'}`;
  model.userData = { faction: 'Grove', buildingId: id, built, modelPack: 'grove' };
  const contents = new THREE.Group();
  contents.name = built ? 'completed-dwelling' : 'construction-site';
  model.add(contents);
  addFoundation(contents);
  if (!built) addConstructionFrame(contents);
  BUILDERS[id](contents, built);
  return model;
}

export default {
  faction: 'Grove',
  createBuildingModel,
} as const;
