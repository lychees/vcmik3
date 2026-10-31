import * as THREE from 'three';

type CourtyardBuildingId = 'pageBarracks' | 'duelistSalon' | 'courtWizardLibrary' | 'royalLionGarden';

type Palette = Record<
  'stone' | 'trim' | 'roof' | 'gold' | 'dark' | 'glass' | 'timber' | 'leaf' | 'rose' | 'canvas',
  THREE.MeshStandardMaterial
>;

const BUILDING_TIERS: Readonly<Record<CourtyardBuildingId, number>> = {
  pageBarracks: 1,
  duelistSalon: 2,
  courtWizardLibrary: 3,
  royalLionGarden: 4,
};

function material(color: number, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  result.userData.baseColor = color;
  return result;
}

function createPalette(): Palette {
  const glass = material(0xf0d59a, 0.35);
  glass.emissive.setHex(0xb88a4b);
  glass.emissiveIntensity = 0.28;
  return {
    stone: material(0xd0bdab),
    trim: material(0xa69283),
    roof: material(0x78546f),
    gold: material(0xe2c776, 0.38, 0.35),
    dark: material(0x4c2e42),
    glass,
    timber: material(0x765443),
    leaf: material(0x536b4d),
    rose: material(0xb85f78),
    canvas: material(0xc6ae8e),
  };
}

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, surface: THREE.Material,
  x = 0, y = 0, z = 0, name = ''): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(x, y, z);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function box(parent: THREE.Object3D, width: number, height: number, depth: number,
  surface: THREE.Material, x = 0, y = 0, z = 0, name = ''): THREE.Mesh {
  return mesh(parent, new THREE.BoxGeometry(width, height, depth), surface, x, y, z, name);
}

function cylinder(parent: THREE.Object3D, top: number, bottom: number, height: number, segments: number,
  surface: THREE.Material, x = 0, y = 0, z = 0, name = ''): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, x, y, z, name);
}

function cone(parent: THREE.Object3D, radius: number, height: number, segments: number,
  surface: THREE.Material, x = 0, y = 0, z = 0, name = ''): THREE.Mesh {
  return mesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, x, y, z, name);
}

function addFoundation(group: THREE.Group, palette: Palette): void {
  box(group, 2.2, 0.12, 1.8, palette.trim, 0, 0.06, 0, 'foundation');
  box(group, 2.06, 0.06, 1.66, palette.stone, 0, 0.15);
  for (const x of [-0.91, 0.91]) {
    for (const z of [-0.66, 0.66]) {
      box(group, 0.16, 0.09, 0.16, palette.trim, x, 0.225, z);
    }
  }
}

function addHipRoof(parent: THREE.Object3D, palette: Palette, radius: number, height: number,
  x: number, y: number, z: number, scaleZ = 1): THREE.Mesh {
  const width = Math.SQRT2 * radius;
  const depth = width * scaleZ;
  const positions = [
    [-width / 2, -height / 2, -depth / 2],
    [width / 2, -height / 2, -depth / 2],
    [width / 2, -height / 2, depth / 2],
    [-width / 2, -height / 2, depth / 2],
    [0, height / 2, 0],
  ];
  const vertices = [3, 2, 4, 2, 1, 4, 1, 0, 4, 0, 3, 4, 0, 1, 2, 0, 2, 3]
    .flatMap((index) => positions[index]!);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return mesh(parent, geometry, palette.roof, x, y, z);
}

function addArchedWindow(parent: THREE.Object3D, palette: Palette,
  x: number, y: number, z: number, width = 0.16, height = 0.34): void {
  box(parent, width, height * 0.72, 0.025, palette.glass, x, y - height * 0.1, z);
  const arch = mesh(parent, new THREE.TorusGeometry(width / 2, 0.025, 5, 12, Math.PI),
    palette.gold, x, y + height * 0.26, z + 0.006);
  arch.scale.y = 0.8;
  box(parent, 0.022, height * 0.72, 0.035, palette.gold, x, y - height * 0.1, z + 0.012);
}

function addBanner(parent: THREE.Object3D, palette: Palette,
  x: number, baseY: number, z: number, height: number): void {
  cylinder(parent, 0.018, 0.025, height, 6, palette.gold, x, baseY + height / 2, z);
  const flag = mesh(parent, new THREE.CircleGeometry(0.19, 3), palette.rose,
    x + 0.13, baseY + height - 0.18, z + 0.015);
  flag.scale.set(0.8, 1.25, 1);
  flag.rotation.z = -Math.PI / 2;
}

function addPageBarracks(group: THREE.Group, palette: Palette): void {
  box(group, 1.45, 0.68, 0.95, palette.stone, 0, 0.52, 0);
  addHipRoof(group, palette, 1.09, 0.52, 0, 1.12, 0, 0.78);
  for (const x of [-0.61, 0.61]) {
    box(group, 0.075, 0.68, 0.055, palette.timber, x, 0.52, 0.49);
  }
  box(group, 1.35, 0.065, 0.055, palette.timber, 0, 0.79, 0.49);
  box(group, 0.25, 0.43, 0.045, palette.dark, 0, 0.395, 0.493);
  for (const x of [-0.42, 0.42]) addArchedWindow(group, palette, x, 0.57, 0.49, 0.15, 0.28);

  cylinder(group, 0.18, 0.21, 1.05, 8, palette.stone, -0.55, 0.705, -0.2);
  cone(group, 0.28, 0.45, 8, palette.roof, -0.55, 1.455, -0.2);
  mesh(group, new THREE.OctahedronGeometry(0.055), palette.gold, -0.55, 1.71, -0.2);
  addArchedWindow(group, palette, -0.55, 1.02, -0.002, 0.11, 0.24);

  const dummy = new THREE.Group();
  dummy.name = 'practice-dummy';
  dummy.position.set(0.69, 0.18, 0.57);
  group.add(dummy);
  cylinder(dummy, 0.025, 0.035, 0.55, 6, palette.timber, 0, 0.275, 0);
  box(dummy, 0.43, 0.055, 0.055, palette.timber, 0, 0.43, 0);
  const target = cylinder(dummy, 0.15, 0.15, 0.065, 12, palette.canvas, 0, 0.57, 0);
  target.rotation.x = Math.PI / 2;
  const targetCenter = cylinder(dummy, 0.065, 0.065, 0.072, 10, palette.rose, 0, 0.57, 0.005);
  targetCenter.rotation.x = Math.PI / 2;
  box(dummy, 0.38, 0.045, 0.16, palette.timber, 0, 0.025, 0);
  addBanner(group, palette, 0.49, 0.86, -0.13, 0.82);
}

function addCrossedRapiers(parent: THREE.Object3D, palette: Palette): void {
  const emblem = new THREE.Group();
  emblem.name = 'crossed-rapiers';
  emblem.position.set(0, 0.88, 0.605);
  parent.add(emblem);
  for (const side of [-1, 1]) {
    const blade = box(emblem, 0.025, 0.39, 0.025, palette.gold);
    blade.rotation.z = side * 0.72;
    const guard = box(emblem, 0.12, 0.025, 0.035, palette.gold, side * 0.105, -0.135, 0.005);
    guard.rotation.z = side * 0.72;
  }
  mesh(emblem, new THREE.DodecahedronGeometry(0.065, 0), palette.rose, 0, 0.015, 0.025);
}

function addDuelistSalon(group: THREE.Group, palette: Palette): void {
  box(group, 1.55, 0.75, 1.05, palette.stone, 0, 0.555, 0);
  box(group, 1.66, 0.09, 1.16, palette.trim, 0, 0.91, 0);
  cylinder(group, 0.69, 0.84, 0.18, 8, palette.roof, 0, 1.045, 0);
  cone(group, 0.84, 0.55, 8, palette.roof, 0, 1.41, 0);

  for (const x of [-0.64, -0.3, 0.3, 0.64]) {
    cylinder(group, 0.045, 0.06, 0.61, 8, palette.trim, x, 0.485, 0.59);
    cylinder(group, 0.075, 0.075, 0.055, 8, palette.gold, x, 0.79, 0.59);
  }
  box(group, 1.46, 0.075, 0.28, palette.trim, 0, 0.825, 0.58);
  box(group, 1.38, 0.035, 0.035, palette.gold, 0, 0.72, 0.735);
  for (const x of [-0.6, -0.4, -0.2, 0.2, 0.4, 0.6]) {
    box(group, 0.025, 0.17, 0.025, palette.gold, x, 0.65, 0.735);
  }
  box(group, 0.25, 0.46, 0.045, palette.dark, 0, 0.41, 0.548);
  for (const x of [-0.47, 0.47]) addArchedWindow(group, palette, x, 0.54, 0.54, 0.17, 0.34);
  addCrossedRapiers(group, palette);

  cylinder(group, 0.16, 0.18, 0.28, 8, palette.stone, 0, 1.73, 0);
  cone(group, 0.25, 0.35, 8, palette.roof, 0, 2.045, 0);
  mesh(group, new THREE.OctahedronGeometry(0.065), palette.gold, 0, 2.25, 0);
  for (const x of [-0.72, 0.72]) addBanner(group, palette, x, 0.89, 0.04, 0.7);
}

function addCourtWizardLibrary(group: THREE.Group, palette: Palette): void {
  box(group, 0.98, 1.65, 0.9, palette.stone, -0.15, 1.005, -0.05);
  for (const x of [-0.67, 0.37]) {
    for (const z of [-0.51, 0.41]) {
      box(group, 0.14, 1.25, 0.14, palette.trim, x, 0.805, z);
      cone(group, 0.12, 0.28, 4, palette.roof, x, 1.57, z);
    }
  }
  for (const y of [0.67, 1.14, 1.6]) {
    addArchedWindow(group, palette, -0.15, y, 0.415, 0.18, 0.34);
  }
  box(group, 0.24, 0.45, 0.045, palette.dark, -0.15, 0.405, 0.425);
  box(group, 1.08, 0.1, 1, palette.gold, -0.15, 1.82, -0.05);
  cone(group, 0.79, 0.83, 8, palette.roof, -0.15, 2.285, -0.05);

  box(group, 0.7, 0.75, 0.75, palette.stone, 0.57, 0.555, 0.13);
  addHipRoof(group, palette, 0.61, 0.45, 0.57, 1.155, 0.13);
  box(group, 0.43, 0.43, 0.035, palette.dark, 0.57, 0.54, 0.521);
  for (const [x, color] of [[0.43, palette.roof], [0.54, palette.gold], [0.65, palette.rose]] as const) {
    box(group, 0.075, 0.31, 0.045, color, x, 0.52, 0.55);
  }

  const astrolabe = new THREE.Group();
  astrolabe.name = 'astrolabe';
  astrolabe.position.set(-0.15, 2.63, -0.05);
  group.add(astrolabe);
  const outer = mesh(astrolabe, new THREE.TorusGeometry(0.34, 0.025, 6, 24), palette.gold);
  outer.rotation.x = 0.52;
  outer.rotation.y = 0.25;
  const inner = mesh(astrolabe, new THREE.TorusGeometry(0.23, 0.018, 5, 20), palette.gold);
  inner.rotation.y = Math.PI / 2;
  mesh(astrolabe, new THREE.OctahedronGeometry(0.105), palette.glass).scale.y = 1.5;
  cylinder(group, 0.025, 0.04, 0.39, 6, palette.gold, -0.15, 2.94, -0.05);
  mesh(group, new THREE.OctahedronGeometry(0.075), palette.gold, -0.15, 3.17, -0.05);
}

function addWingedLion(parent: THREE.Object3D, palette: Palette): void {
  const lion = new THREE.Group();
  lion.name = 'winged-lion';
  lion.position.set(0, 0.38, 0.02);
  parent.add(lion);
  const body = mesh(lion, new THREE.SphereGeometry(0.5, 10, 7), palette.gold, 0, 0.42, -0.05);
  body.scale.set(0.48, 0.42, 0.72);
  for (const x of [-0.15, 0.15]) {
    for (const z of [-0.23, 0.18]) {
      cylinder(lion, 0.045, 0.06, 0.31, 7, palette.gold, x, 0.18, z);
      mesh(lion, new THREE.SphereGeometry(0.075, 7, 5), palette.gold, x, 0.045, z + 0.035).scale.z = 1.35;
    }
  }
  mesh(lion, new THREE.SphereGeometry(0.18, 9, 6), palette.gold, 0, 0.65, 0.28);
  const mane = mesh(lion, new THREE.TorusGeometry(0.18, 0.055, 6, 12), palette.trim, 0, 0.65, 0.245);
  mane.scale.y = 1.08;
  for (const side of [-1, 1]) {
    const wing = cone(lion, 0.2, 0.57, 3, palette.stone, side * 0.3, 0.61, -0.12);
    wing.rotation.z = side * 0.93;
    wing.rotation.x = -0.2;
    mesh(lion, new THREE.SphereGeometry(0.025, 6, 4), palette.dark, side * 0.06, 0.68, 0.445);
  }
  cylinder(lion, 0.12, 0.14, 0.08, 8, palette.roof, 0, 0.85, 0.28);
  cone(lion, 0.13, 0.17, 5, palette.gold, 0, 0.975, 0.28);
  const tail = mesh(lion, new THREE.TorusGeometry(0.16, 0.025, 5, 12, Math.PI * 1.4), palette.gold, 0.18, 0.44, -0.36);
  tail.rotation.y = Math.PI / 2;
}

function addRoyalLionGarden(group: THREE.Group, palette: Palette): void {
  for (const x of [-0.82, 0.82]) {
    box(group, 0.28, 0.34, 1.28, palette.leaf, x, 0.35, -0.02);
    for (const z of [-0.5, 0, 0.5]) {
      mesh(group, new THREE.DodecahedronGeometry(0.2, 0), palette.leaf, x, 0.57, z).scale.set(0.85, 0.75, 1);
    }
  }
  cylinder(group, 0.65, 0.72, 0.12, 12, palette.trim, 0, 0.24, 0);
  cylinder(group, 0.4, 0.48, 0.22, 10, palette.stone, 0, 0.41, 0);
  addWingedLion(group, palette);

  for (const x of [-0.47, 0.47]) {
    for (const z of [-0.39, 0.39]) {
      cylinder(group, 0.045, 0.065, 1.25, 8, palette.stone, x, 0.805, z);
      cylinder(group, 0.085, 0.085, 0.065, 8, palette.gold, x, 1.43, z);
    }
  }
  cylinder(group, 0.72, 0.78, 0.12, 8, palette.trim, 0, 1.49, 0);
  cone(group, 0.82, 0.5, 8, palette.roof, 0, 1.8, 0);
  cylinder(group, 0.1, 0.13, 0.15, 8, palette.gold, 0, 2.08, 0);
  cone(group, 0.12, 0.25, 6, palette.gold, 0, 2.275, 0);

  for (const x of [-0.68, 0.68]) {
    for (const z of [0.57, 0.7]) {
      cylinder(group, 0.015, 0.02, 0.2, 5, palette.leaf, x, 0.28, z);
      mesh(group, new THREE.DodecahedronGeometry(0.07, 0), palette.rose, x, 0.41, z);
    }
  }
}

const BUILDERS: Readonly<Record<CourtyardBuildingId, (group: THREE.Group, palette: Palette) => void>> = {
  pageBarracks: addPageBarracks,
  duelistSalon: addDuelistSalon,
  courtWizardLibrary: addCourtWizardLibrary,
  royalLionGarden: addRoyalLionGarden,
};

function addScaffold(group: THREE.Group, palette: Palette,
  width: number, depth: number, height: number): void {
  for (const x of [-width / 2, width / 2]) {
    for (const z of [-depth / 2, depth / 2]) {
      box(group, 0.045, height, 0.045, palette.timber, x, 0.18 + height / 2, z);
    }
  }
  for (const y of [0.18 + height * 0.52, 0.18 + height]) {
    for (const z of [-depth / 2, depth / 2]) {
      box(group, width + 0.08, 0.04, 0.04, palette.timber, 0, y, z);
    }
    for (const x of [-width / 2, width / 2]) {
      box(group, 0.04, 0.04, depth, palette.timber, x, y, 0);
    }
  }
  for (const side of [-1, 1]) {
    const brace = box(group, 0.035, Math.hypot(width, height * 0.52), 0.035,
      palette.timber, 0, 0.18 + height * 0.74, depth / 2 + 0.025);
    brace.rotation.z = side * Math.atan2(width, height * 0.52);
  }
}

function addConstructionMarker(group: THREE.Group, palette: Palette): void {
  for (const x of [-0.16, 0.16]) box(group, 0.035, 0.42, 0.035, palette.timber, x, 0.39, 0.78);
  box(group, 0.43, 0.24, 0.045, palette.canvas, 0, 0.54, 0.78, 'construction-marker');
  mesh(group, new THREE.DodecahedronGeometry(0.06, 0), palette.rose, 0, 0.55, 0.81);
}

function addConstructionSite(group: THREE.Group, palette: Palette, buildingId: CourtyardBuildingId): void {
  if (buildingId === 'pageBarracks') {
    addScaffold(group, palette, 1.5, 1, 0.82);
    box(group, 1.3, 0.32, 0.12, palette.stone, 0, 0.34, 0.4);
    box(group, 0.12, 0.45, 0.72, palette.stone, -0.59, 0.405, 0.02);
    for (const y of [0.24, 0.31, 0.38]) box(group, 0.65, 0.06, 0.1, palette.timber, 0.51, y, -0.54);
  } else if (buildingId === 'duelistSalon') {
    addScaffold(group, palette, 1.58, 1.12, 1.12);
    cylinder(group, 0.72, 0.78, 0.16, 8, palette.stone, 0, 0.26, 0);
    for (const x of [-0.51, 0.51]) {
      for (const z of [-0.35, 0.35]) cylinder(group, 0.065, 0.085, 0.44, 8, palette.trim, x, 0.4, z);
    }
    box(group, 1.25, 0.07, 0.22, palette.timber, 0, 0.62, -0.47);
  } else if (buildingId === 'courtWizardLibrary') {
    addScaffold(group, palette, 1.18, 1.02, 1.82);
    box(group, 0.84, 1.08, 0.74, palette.stone, -0.13, 0.72, -0.04);
    box(group, 0.94, 0.08, 0.84, palette.timber, -0.13, 1.3, -0.04);
    for (const [x, y] of [[0.57, 0.28], [0.7, 0.43], [0.46, 0.43]] as const) {
      box(group, 0.28, 0.28, 0.32, palette.trim, x, y, 0.28);
    }
  } else {
    addScaffold(group, palette, 1.43, 1.18, 0.98);
    box(group, 1.42, 0.05, 0.96, palette.dark, 0, 0.205, 0);
    cylinder(group, 0.48, 0.57, 0.28, 10, palette.stone, 0, 0.36, 0);
    for (const x of [-0.46, 0.46]) {
      for (const z of [-0.37, 0.37]) cylinder(group, 0.065, 0.085, 0.34, 8, palette.trim, x, 0.35, z);
    }
    box(group, 0.6, 0.3, 0.42, palette.canvas, 0.55, 0.36, -0.39);
  }
  addConstructionMarker(group, palette);
}

function createBuildingModel(buildingId: string, built: boolean): THREE.Group | null {
  if (!Object.hasOwn(BUILDERS, buildingId)) return null;
  const id = buildingId as CourtyardBuildingId;
  const group = new THREE.Group();
  group.name = `Courtyard:${id}:${built ? 'built' : 'unbuilt'}`;
  group.userData.buildingId = id;
  group.userData.faction = 'Courtyard';
  group.userData.built = built;
  group.userData.tier = BUILDING_TIERS[id];

  const palette = createPalette();
  addFoundation(group, palette);
  const structure = new THREE.Group();
  structure.name = built ? 'completed-dwelling' : 'construction-site';
  group.add(structure);
  if (built) BUILDERS[id](structure, palette);
  else addConstructionSite(structure, palette, id);

  const bounds = new THREE.Box3().setFromObject(group);
  group.userData.labelHeight = bounds.max.y + 0.35;
  return group;
}

export default {
  faction: 'Courtyard',
  createBuildingModel,
};
