import * as THREE from 'three';

export type HotaFaction =
  | 'Tower'
  | 'Necropolis'
  | 'Dungeon'
  | 'Stronghold'
  | 'Conflux'
  | 'Cove'
  | 'Factory'
  | 'Bulwark'
  | 'Courtyard';

interface Palette {
  body: number;
  accent: number;
  dark: number;
}

interface HotaSpec {
  faction: HotaFaction;
  archetype: string;
  scale: number;
  palette: Palette;
  build: (group: THREE.Group, palette: Palette) => void;
}

export interface HotaCreatureVisual {
  group: THREE.Group;
  faction: HotaFaction;
  archetype: string;
  palette: [number, number, number];
}

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.82, ...extra });
}

function mesh(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(...position);
  result.scale.set(...scale);
  result.rotation.set(...rotation);
  result.castShadow = true;
  result.receiveShadow = true;
  group.add(result);
  return result;
}

function cylinder(group: THREE.Group, top: number, bottom: number, height: number, surface: THREE.Material,
  position: [number, number, number], segments = 6): THREE.Mesh {
  return mesh(group, new THREE.CylinderGeometry(top, bottom, height, segments), surface, position);
}

function cone(group: THREE.Group, radius: number, height: number, surface: THREE.Material,
  position: [number, number, number], segments = 6): THREE.Mesh {
  return mesh(group, new THREE.ConeGeometry(radius, height, segments), surface, position);
}

function box(group: THREE.Group, size: [number, number, number], surface: THREE.Material,
  position: [number, number, number]): THREE.Mesh {
  return mesh(group, new THREE.BoxGeometry(...size), surface, position);
}

function eyes(group: THREE.Group, color: number, x: number, y: number, z: number, radius = 0.032): void {
  const geometry = new THREE.SphereGeometry(radius, 5, 4);
  const surface = material(color, { emissive: color, emissiveIntensity: 0.8 });
  mesh(group, geometry, surface, [x, y, z]);
  mesh(group, geometry, surface, [x, y, -z]);
}

interface HumanoidOptions {
  bulk?: number;
  skin?: number;
  robe?: boolean;
  helmet?: boolean;
  armor?: boolean;
  armsForward?: boolean;
}

function humanoid(group: THREE.Group, palette: Palette, options: HumanoidOptions = {}): void {
  const body = material(palette.body);
  const accent = material(palette.accent, options.armor ? { metalness: 0.4, roughness: 0.55 } : {});
  const dark = material(palette.dark);
  const skin = material(options.skin ?? 0xd2aa82);
  const bulk = options.bulk ?? 1;
  cylinder(group, 0.2 * bulk, 0.3 * bulk, 0.65, body, [0, 0.79, 0]);
  mesh(group, new THREE.DodecahedronGeometry(0.19 * Math.min(bulk, 1.2), 0), skin, [0.04, 1.28, 0], [1, 1.05, 0.95]);
  for (const side of [-1, 1]) {
    if (!options.robe) cylinder(group, 0.065 * bulk, 0.08 * bulk, 0.48, dark, [-0.02, 0.29, side * 0.14 * bulk]);
    box(group, [0.2 * bulk, 0.1, 0.15 * bulk], dark, [0.06, 0.05, side * 0.15 * bulk]);
    const arm = cylinder(group, 0.055 * bulk, 0.075 * bulk, 0.55, body,
      [options.armsForward ? 0.25 : 0.02, 0.83, side * 0.32 * bulk]);
    if (options.armsForward) arm.rotation.z = -Math.PI / 2.7;
    else arm.rotation.x = side * 0.28;
    mesh(group, new THREE.OctahedronGeometry(0.12 * bulk, 0), accent,
      [0, 1.02, side * 0.29 * bulk], [1, 0.7, 1]);
  }
  if (options.robe) cone(group, 0.34 * bulk, 0.72, body, [0, 0.39, 0], 7).rotation.z = Math.PI;
  cylinder(group, 0.305 * bulk, 0.305 * bulk, 0.075, accent, [0, 0.61, 0], 8);
  if (options.helmet !== false) cone(group, 0.22 * Math.min(bulk, 1.2), 0.3, accent, [0.02, 1.51, 0], 6);
}

function quadruped(group: THREE.Group, palette: Palette, options: { bulk?: number; low?: boolean; skin?: number } = {}): void {
  const body = material(options.skin ?? palette.body);
  const accent = material(palette.accent);
  const dark = material(palette.dark);
  const bulk = options.bulk ?? 1;
  const y = options.low ? 0.48 : 0.65;
  mesh(group, new THREE.DodecahedronGeometry(0.43, 0), body, [-0.12, y, 0], [1.45 * bulk, 0.78 * bulk, 0.85 * bulk]);
  mesh(group, new THREE.DodecahedronGeometry(0.3, 0), body, [0.39, y + 0.12, 0], [1.05, 1.05, 0.95]);
  mesh(group, new THREE.DodecahedronGeometry(0.25, 0), body, [0.63, y + 0.22, 0], [1.05, 0.85, 0.9]);
  box(group, [0.32, 0.16, 0.28], dark, [0.83, y + 0.12, 0]);
  eyes(group, palette.accent, 0.75, y + 0.3, 0.13);
  for (const x of [-0.4, 0.29]) {
    for (const z of [-0.25 * bulk, 0.25 * bulk]) {
      cylinder(group, 0.055 * bulk, 0.085 * bulk, options.low ? 0.34 : 0.5, body,
        [x, options.low ? 0.22 : 0.3, z]);
      box(group, [0.2, 0.1, 0.14], dark, [x + 0.05, 0.05, z]);
    }
  }
  cone(group, 0.09 * bulk, 0.7, body, [-0.78, y - 0.02, 0]).rotation.z = Math.PI / 2 - 0.2;
  cone(group, 0.055, 0.2, accent, [0.98, y + 0.1, 0]).rotation.z = -Math.PI / 2;
}

function wing(
  group: THREE.Group,
  color: number,
  side: number,
  size = 1,
  y = 0.85,
  glow = false,
  name?: string,
): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    -0.58 * size, 0.72 * size, side * 0.85 * size,
    0.43 * size, 0.16 * size, side * 0.63 * size,
    0, 0, 0,
    0.43 * size, 0.16 * size, side * 0.63 * size,
    0.62 * size, -0.2 * size, side * 0.25 * size,
  ], 3));
  geometry.computeVertexNormals();
  const result = mesh(group, geometry, material(color, {
    side: THREE.DoubleSide,
    emissive: glow ? color : 0x000000,
    emissiveIntensity: glow ? 0.28 : 0,
  }), [-0.12, y, side * 0.15]);
  if (name) {
    result.name = name;
    result.userData.anatomy = 'wing';
  }
  return result;
}

function wings(group: THREE.Group, color: number, size = 1, y = 0.85, glow = false, name?: string): THREE.Mesh[] {
  return [-1, 1].map((side) => wing(group, color, side, size, y, glow,
    name ? `${name}-${side < 0 ? 'left' : 'right'}` : undefined));
}

function dragon(group: THREE.Group, palette: Palette, spectral = false): void {
  const extra = spectral ? { transparent: true, opacity: 0.76, emissive: palette.dark, emissiveIntensity: 0.65 } : {};
  const body = material(palette.body, extra);
  const accent = material(palette.accent, spectral ? { emissive: palette.accent, emissiveIntensity: 0.45 } : {});
  const dark = material(palette.dark, extra);
  mesh(group, new THREE.IcosahedronGeometry(0.48, 0), body, [-0.15, 0.77, 0], [1.4, 0.9, 0.9]);
  cylinder(group, 0.15, 0.27, 0.85, body, [0.4, 1.15, 0]).rotation.z = -0.62;
  mesh(group, new THREE.DodecahedronGeometry(0.29, 0), body, [0.75, 1.52, 0], [1.25, 0.78, 0.9]);
  box(group, [0.35, 0.15, 0.29], dark, [0.99, 1.44, 0]);
  eyes(group, palette.accent, 0.9, 1.6, 0.14, 0.04);
  wings(group, spectral ? palette.accent : palette.dark, 1.45, 0.92, spectral);
  cone(group, 0.16, 1.45, body, [-0.99, 0.65, 0]).rotation.z = Math.PI / 2 + 0.1;
  for (const side of [-1, 1]) {
    cone(group, 0.065, 0.43, accent, [0.65, 1.88, side * 0.15]).rotation.z = -0.3;
    for (const x of [-0.39, 0.24]) {
      cylinder(group, 0.075, 0.11, 0.5, body, [x, 0.31, side * 0.28]);
      box(group, [0.24, 0.09, 0.17], dark, [x + 0.08, 0.05, side * 0.28]);
    }
  }
  for (const x of [-0.45, -0.15, 0.15]) cone(group, 0.055, 0.26, accent, [x, 1.19, 0], 5);
}

function mechanical(group: THREE.Group, palette: Palette, bulky = false): void {
  const metal = material(palette.body, { metalness: 0.65, roughness: 0.48 });
  const brass = material(palette.accent, { metalness: 0.72, roughness: 0.4 });
  const dark = material(palette.dark, { metalness: 0.5 });
  const bulk = bulky ? 1.25 : 1;
  box(group, [0.48 * bulk, 0.66, 0.55 * bulk], metal, [0, 0.91, 0]);
  box(group, [0.34, 0.27, 0.38], dark, [0.03, 1.42, 0]);
  box(group, [0.3, 0.18, 0.4], brass, [0, 0.49, 0]);
  eyes(group, 0xffb64d, 0.215, 1.45, 0.1, 0.04);
  for (const side of [-1, 1]) {
    cylinder(group, 0.07 * bulk, 0.09 * bulk, 0.45, dark, [0, 0.27, side * 0.17 * bulk]);
    box(group, [0.28, 0.13, 0.22], metal, [0.08, 0.065, side * 0.18 * bulk]);
    cylinder(group, 0.065 * bulk, 0.085 * bulk, 0.55, metal, [0.02, 0.88, side * 0.4 * bulk]);
    box(group, [0.22, 0.2, 0.2], brass, [0.08, 0.59, side * 0.43 * bulk]);
    mesh(group, new THREE.OctahedronGeometry(0.16 * bulk, 0), brass, [0, 1.16, side * 0.36 * bulk]);
  }
}

function sword(group: THREE.Group, palette: Palette, z = 0.43, rapier = false): void {
  const blade = material(0xd9e2df, { metalness: 0.75, roughness: 0.35 });
  const grip = material(palette.dark);
  const weapon = cylinder(group, rapier ? 0.018 : 0.035, rapier ? 0.025 : 0.055, rapier ? 1.05 : 0.82,
    blade, [0.28, 0.85, z], rapier ? 5 : 4);
  weapon.rotation.z = -0.25;
  cylinder(group, 0.035, 0.035, 0.25, grip, [0.15, 0.38, z]).rotation.z = -0.25;
  box(group, [0.28, 0.045, 0.06], material(palette.accent, { metalness: 0.5 }), [0.18, 0.5, z]).rotation.z = -0.25;
}

function shield(group: THREE.Group, palette: Palette, z = -0.42): void {
  const surface = material(palette.accent, { metalness: 0.3 });
  mesh(group, new THREE.CylinderGeometry(0.28, 0.28, 0.065, 8), surface, [0.12, 0.77, z], [1, 1.2, 1], [Math.PI / 2, 0, 0]);
  mesh(group, new THREE.OctahedronGeometry(0.1, 0), material(palette.body), [0.12, 0.77, z + Math.sign(z) * 0.05]);
}

function staff(group: THREE.Group, palette: Palette, z = -0.45, orb = true): void {
  const wood = material(palette.dark);
  const glow = material(palette.accent, { emissive: palette.accent, emissiveIntensity: 0.55 });
  cylinder(group, 0.022, 0.032, 1.55, wood, [0.14, 0.82, z]).rotation.z = -0.12;
  if (orb) mesh(group, new THREE.IcosahedronGeometry(0.13, 0), glow, [0.23, 1.64, z]);
  else cone(group, 0.09, 0.3, glow, [0.23, 1.64, z]);
}

function club(group: THREE.Group, palette: Palette, z = 0.43): void {
  const wood = material(palette.dark);
  cylinder(group, 0.055, 0.09, 1.05, wood, [0.23, 0.87, z]).rotation.z = -0.35;
  mesh(group, new THREE.DodecahedronGeometry(0.19, 0), material(palette.accent), [0.43, 1.38, z], [0.85, 1.4, 0.85]);
}

function addGremlin(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { bulk: 0.85, skin: 0x8fa78a, helmet: false });
  const dark = material(palette.dark);
  const accent = material(palette.accent, { metalness: 0.5 });
  for (const side of [-1, 1]) {
    cone(group, 0.11, 0.38, material(0x8fa78a), [0.02, 1.3, side * 0.27]).rotation.x = side * Math.PI / 2;
    mesh(group, new THREE.TorusGeometry(0.075, 0.018, 4, 8), accent, [0.19, 1.33, side * 0.09], [1, 1, 1], [0, Math.PI / 2, 0]);
  }
  const wrench = cylinder(group, 0.025, 0.025, 0.85, dark, [0.22, 0.72, 0.42]);
  wrench.rotation.z = -0.3;
  mesh(group, new THREE.TorusGeometry(0.1, 0.028, 4, 7, Math.PI * 1.5), accent, [0.36, 1.15, 0.42]);
}

function addStoneGargoyle(group: THREE.Group, palette: Palette): void {
  quadruped(group, palette, { bulk: 0.85, low: true });
  wings(group, palette.dark, 0.95, 0.66);
  const stone = material(palette.accent);
  for (const side of [-1, 1]) {
    cone(group, 0.075, 0.36, stone, [0.55, 0.99, side * 0.14]).rotation.z = -0.35;
    cone(group, 0.06, 0.24, stone, [0.34, 0.09, side * 0.25]).rotation.z = -Math.PI / 2;
  }
  box(group, [0.34, 0.09, 0.65], material(palette.body), [-0.14, 0.84, 0]);
}

function addGenie(group: THREE.Group, palette: Palette): void {
  const body = material(palette.body);
  const gold = material(palette.accent, { metalness: 0.45 });
  const vapor = material(palette.dark, { emissive: palette.dark, emissiveIntensity: 0.35 });
  cone(group, 0.3, 0.85, vapor, [0, 0.45, 0], 7).rotation.z = Math.PI;
  cylinder(group, 0.24, 0.31, 0.65, body, [0, 1.02, 0]);
  mesh(group, new THREE.DodecahedronGeometry(0.2, 0), material(0xb98768), [0.04, 1.51, 0]);
  mesh(group, new THREE.TorusGeometry(0.21, 0.065, 5, 10), gold, [0.03, 1.63, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  cone(group, 0.15, 0.26, body, [0.01, 1.82, 0]);
  eyes(group, palette.accent, 0.21, 1.54, 0.09);
  for (const side of [-1, 1]) {
    cylinder(group, 0.055, 0.075, 0.62, body, [0.07, 1.06, side * 0.37]).rotation.x = side * 0.72;
    mesh(group, new THREE.TorusGeometry(0.09, 0.025, 4, 8), gold, [0.1, 0.87, side * 0.57], [1, 1, 1], [Math.PI / 2, 0, 0]);
  }
  cylinder(group, 0.31, 0.31, 0.07, gold, [0, 0.78, 0], 8);
}

function addTitan(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { bulk: 1.25, armor: true, skin: 0xc4b39c });
  const glow = material(palette.accent, { emissive: palette.accent, emissiveIntensity: 0.9 });
  for (const side of [-1, 1]) {
    box(group, [0.28, 0.16, 0.2], material(palette.dark, { metalness: 0.4 }), [0, 1.14, side * 0.42]);
  }
  const segments: Array<[number, number, number]> = [[0.22, 1.45, 0.5], [0.38, 1.12, 0.5], [0.22, 0.83, 0.5]];
  for (let index = 0; index < segments.length; index += 1) {
    const bolt = box(group, [0.08, 0.5, 0.07], glow, segments[index]!);
    bolt.rotation.z = index % 2 === 0 ? -0.55 : 0.55;
  }
}

function addSkeleton(group: THREE.Group, palette: Palette): void {
  const bone = material(palette.body);
  const dark = material(palette.dark);
  const rust = material(palette.accent, { metalness: 0.35 });
  cylinder(group, 0.035, 0.045, 0.65, bone, [0, 0.85, 0]);
  for (const y of [0.73, 0.87, 1.01]) {
    mesh(group, new THREE.TorusGeometry(0.2, 0.025, 4, 8, Math.PI * 1.6), bone, [0, y, 0], [1, 1, 1], [Math.PI / 2, 0, 0.6]);
  }
  mesh(group, new THREE.DodecahedronGeometry(0.2, 0), bone, [0.04, 1.34, 0], [0.9, 1.05, 0.9]);
  box(group, [0.17, 0.08, 0.22], bone, [0.13, 1.19, 0]);
  eyes(group, palette.accent, 0.19, 1.38, 0.085, 0.04);
  for (const side of [-1, 1]) {
    cylinder(group, 0.035, 0.045, 0.58, bone, [0, 0.33, side * 0.12]);
    cylinder(group, 0.03, 0.045, 0.58, bone, [0.04, 0.91, side * 0.27]).rotation.x = side * 0.3;
    box(group, [0.19, 0.07, 0.1], dark, [0.07, 0.04, side * 0.12]);
  }
  sword(group, { ...palette, body: rust.color.getHex() });
  shield(group, palette);
}

function addZombie(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { bulk: 1.2, skin: 0x829278, helmet: false, armsForward: true });
  const patch = material(palette.accent);
  box(group, [0.16, 0.25, 0.025], patch, [0.26, 0.82, 0.08]).rotation.z = 0.3;
  for (const y of [1.22, 1.3, 1.38]) box(group, [0.025, 0.015, 0.19], material(palette.dark), [0.19, y, 0]);
  cone(group, 0.07, 0.2, material(0x829278), [0.25, 1.27, 0]).rotation.z = -Math.PI / 2;
}

function addVampire(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { robe: true, helmet: false, skin: 0xd8d2c8, bulk: 0.9 });
  const cape = material(palette.dark, { side: THREE.DoubleSide });
  cone(group, 0.42, 1.05, cape, [-0.15, 0.73, 0], 5).rotation.z = Math.PI;
  for (const side of [-1, 1]) {
    cone(group, 0.11, 0.42, material(palette.accent), [0, 1.43, side * 0.2]).rotation.x = side * 0.45;
    cone(group, 0.025, 0.12, material(0xf1e7d5), [0.21, 1.19, side * 0.055]).rotation.z = Math.PI;
  }
  eyes(group, 0xe95b55, 0.21, 1.34, 0.085);
}

function addGhostDragon(group: THREE.Group, palette: Palette): void {
  dragon(group, palette, true);
  const bone = material(palette.accent, { emissive: palette.accent, emissiveIntensity: 0.35 });
  for (let index = 0; index < 4; index += 1) {
    mesh(group, new THREE.TorusGeometry(0.2 - index * 0.018, 0.022, 4, 7, Math.PI), bone,
      [-0.42 + index * 0.22, 0.8, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  }
}

function addTroglodyte(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { bulk: 1.05, skin: palette.body, helmet: false, armsForward: true });
  box(group, [0.34, 0.16, 0.31], material(palette.body), [0.23, 1.23, 0]);
  for (const side of [-1, 1]) cone(group, 0.05, 0.23, material(palette.accent), [-0.04, 1.49, side * 0.12]);
  club(group, palette);
}

function addHarpy(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { bulk: 0.82, skin: 0xc49a7d, helmet: false, robe: true });
  wings(group, palette.body, 1.15, 1.0);
  const feathers = material(palette.accent);
  for (const side of [-1, 1]) {
    cone(group, 0.07, 0.42, feathers, [0.01, 1.54, side * 0.1]).rotation.z = -0.25;
    cone(group, 0.055, 0.28, material(palette.dark), [0.12, 0.08, side * 0.15]).rotation.z = -Math.PI / 2;
  }
  cone(group, 0.08, 0.26, feathers, [0.25, 1.27, 0]).rotation.z = -Math.PI / 2;
}

function addMinotaur(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { bulk: 1.35, skin: palette.dark, helmet: false, armor: true });
  const fur = material(palette.dark);
  const horn = material(palette.accent);
  mesh(group, new THREE.DodecahedronGeometry(0.25, 0), fur, [0.05, 1.34, 0], [1.1, 1, 1]);
  box(group, [0.34, 0.19, 0.3], fur, [0.28, 1.24, 0]);
  for (const side of [-1, 1]) cone(group, 0.09, 0.58, horn, [0.01, 1.58, side * 0.25]).rotation.x = side * 1.05;
  eyes(group, 0xf2c06a, 0.25, 1.43, 0.14);
  const axe = cylinder(group, 0.035, 0.045, 1.5, material(0x594331), [0.22, 0.86, 0.52]);
  axe.rotation.z = -0.2;
  mesh(group, new THREE.ConeGeometry(0.24, 0.48, 4), material(0xbcc1b8, { metalness: 0.65 }), [0.39, 1.55, 0.52], [1, 1, 0.35], [0, 0, -Math.PI / 2]);
}

function addRedDragon(group: THREE.Group, palette: Palette): void {
  dragon(group, palette);
  const flame = material(palette.accent, { emissive: 0x8f2d13, emissiveIntensity: 0.65 });
  cone(group, 0.12, 0.48, flame, [1.27, 1.45, 0], 6).rotation.z = -Math.PI / 2;
  cone(group, 0.07, 0.32, flame, [1.45, 1.47, 0], 5).rotation.z = -Math.PI / 2;
}

function addGoblin(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { bulk: 0.82, skin: 0x789554, helmet: false });
  for (const side of [-1, 1]) cone(group, 0.1, 0.4, material(0x789554), [0.02, 1.31, side * 0.27]).rotation.x = side * Math.PI / 2;
  eyes(group, 0xf0c94f, 0.21, 1.34, 0.085);
  club(group, palette);
}

function addWolfRider(group: THREE.Group, palette: Palette): void {
  quadruped(group, palette, { bulk: 0.9 });
  for (const side of [-1, 1]) cone(group, 0.07, 0.32, material(palette.dark), [0.55, 1.14, side * 0.14]).rotation.z = -0.25;
  const rider = new THREE.Group();
  humanoid(rider, { body: 0x6f873f, accent: palette.accent, dark: palette.dark }, { bulk: 0.8, skin: 0x789554, helmet: false });
  rider.scale.setScalar(0.57);
  rider.position.set(-0.1, 0.83, 0);
  group.add(rider);
  spear(group, palette, -0.31);
}

function spear(group: THREE.Group, palette: Palette, z = -0.42): void {
  cylinder(group, 0.022, 0.028, 1.65, material(palette.dark), [0.22, 0.9, z]).rotation.z = -0.16;
  cone(group, 0.075, 0.3, material(palette.accent, { metalness: 0.5 }), [0.35, 1.73, z]).rotation.z = -0.16;
}

function addOgre(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { bulk: 1.55, skin: 0xa78a65, helmet: false });
  mesh(group, new THREE.DodecahedronGeometry(0.34, 0), material(0xa78a65), [0.13, 0.74, 0], [1.05, 1, 1.2]);
  for (const side of [-1, 1]) cone(group, 0.06, 0.25, material(palette.accent), [0.02, 1.53, side * 0.13]);
  club(group, palette, 0.56);
}

function addBehemoth(group: THREE.Group, palette: Palette): void {
  quadruped(group, palette, { bulk: 1.35 });
  const bone = material(palette.accent);
  for (const side of [-1, 1]) {
    cone(group, 0.09, 0.65, bone, [0.87, 0.66, side * 0.25]).rotation.z = -Math.PI / 2.4;
    cone(group, 0.1, 0.4, material(palette.dark), [0.46, 1.15, side * 0.2]).rotation.z = -0.3;
  }
  for (const x of [-0.5, -0.18, 0.14]) cone(group, 0.1, 0.43, bone, [x, 1.12, 0]);
}

function addPixie(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { bulk: 0.72, skin: 0xe1b7a4, helmet: false, robe: true });
  wings(group, palette.accent, 0.72, 0.93, true);
  staff(group, palette, 0.35);
  cone(group, 0.14, 0.32, material(palette.dark), [-0.03, 1.5, 0]).rotation.z = 0.25;
  eyes(group, palette.accent, 0.18, 1.32, 0.07, 0.025);
}

function addAirElemental(group: THREE.Group, palette: Palette): void {
  const air = material(palette.body, { transparent: true, opacity: 0.82, emissive: palette.dark, emissiveIntensity: 0.35 });
  const glow = material(palette.accent, { emissive: palette.accent, emissiveIntensity: 0.55 });
  cone(group, 0.37, 0.95, air, [0, 0.52, 0], 8).rotation.z = Math.PI;
  mesh(group, new THREE.IcosahedronGeometry(0.28, 1), air, [0, 1.19, 0], [0.85, 1.25, 0.85]);
  for (const [y, radius] of [[0.25, 0.27], [0.53, 0.38], [0.81, 0.29]] as const) {
    mesh(group, new THREE.TorusGeometry(radius, 0.028, 4, 12), glow, [0, y, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  }
  for (const side of [-1, 1]) {
    cone(group, 0.08, 0.65, air, [0.02, 1.06, side * 0.39]).rotation.x = side * 1.0;
    mesh(group, new THREE.OctahedronGeometry(0.09, 0), glow, [0.03, 0.91, side * 0.65]);
  }
  eyes(group, palette.accent, 0.22, 1.29, 0.1);
  mesh(group, new THREE.OctahedronGeometry(0.065, 0), glow, [-0.24, 1.5, 0.12]);
  mesh(group, new THREE.OctahedronGeometry(0.05, 0), glow, [0.13, 1.64, -0.08]);
}

function addStormElemental(group: THREE.Group, palette: Palette): void {
  const cloud = material(palette.body, { emissive: palette.dark, emissiveIntensity: 0.4 });
  const glow = material(palette.accent, { emissive: palette.accent, emissiveIntensity: 0.9 });
  cone(group, 0.34, 0.8, cloud, [0, 0.43, 0], 7).rotation.z = Math.PI;
  for (const [x, y, z, size] of [[0, 1.1, 0, 0.33], [-0.18, 1.0, 0.15, 0.23], [0.15, 1.02, -0.18, 0.25], [0.02, 1.4, 0, 0.22]] as const) {
    mesh(group, new THREE.IcosahedronGeometry(size, 0), cloud, [x, y, z]);
  }
  eyes(group, palette.accent, 0.2, 1.43, 0.09);
  for (const side of [-1, 1]) {
    cylinder(group, 0.05, 0.08, 0.62, cloud, [0.05, 1.0, side * 0.38]).rotation.x = side * 0.65;
    const bolt = box(group, [0.055, 0.65, 0.055], glow, [0.13, 0.65, side * 0.55]);
    bolt.rotation.z = side * 0.45;
  }
  mesh(group, new THREE.TorusGeometry(0.32, 0.025, 4, 10), glow, [0, 0.25, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
}

function addPhoenix(group: THREE.Group, palette: Palette): void {
  const body = material(palette.body, { emissive: 0x6d2414, emissiveIntensity: 0.45 });
  const flame = material(palette.accent, { emissive: palette.accent, emissiveIntensity: 0.7 });
  mesh(group, new THREE.IcosahedronGeometry(0.32, 0), body, [0, 0.88, 0], [1.25, 1, 0.85]);
  mesh(group, new THREE.DodecahedronGeometry(0.2, 0), body, [0.35, 1.25, 0]);
  cone(group, 0.1, 0.34, flame, [0.58, 1.22, 0]).rotation.z = -Math.PI / 2;
  eyes(group, 0xfff0a0, 0.46, 1.32, 0.1);
  wings(group, palette.accent, 1.3, 0.93, true);
  for (const z of [-0.18, 0, 0.18]) {
    cone(group, 0.1, 0.95, flame, [-0.66, 0.63, z]).rotation.z = Math.PI / 2 + z;
  }
  for (const side of [-1, 1]) {
    cone(group, 0.06, 0.38, flame, [0.26, 1.55, side * 0.09]).rotation.z = -0.3;
    cylinder(group, 0.035, 0.05, 0.5, body, [0.12, 0.32, side * 0.14]);
    cone(group, 0.045, 0.25, flame, [0.25, 0.07, side * 0.14]).rotation.z = -Math.PI / 2;
  }
}

function addNymph(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { robe: true, helmet: false, skin: 0xb9d8c2, bulk: 0.82 });
  const fin = material(palette.accent, { transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    cone(group, 0.11, 0.38, fin, [0, 1.3, side * 0.25]).rotation.x = side * Math.PI / 2;
    cone(group, 0.07, 0.42, fin, [-0.04, 1.55, side * 0.11]).rotation.z = -0.2;
  }
  mesh(group, new THREE.TorusGeometry(0.38, 0.035, 5, 14), material(palette.body, { emissive: palette.dark, emissiveIntensity: 0.3 }),
    [0, 0.09, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  staff(group, palette, -0.4);
}

function addCorsair(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { armor: false, skin: 0xc99a75, helmet: false });
  const dark = material(palette.dark);
  cylinder(group, 0.34, 0.34, 0.055, dark, [0.01, 1.46, 0], 10);
  cone(group, 0.24, 0.3, dark, [-0.02, 1.62, 0], 5).rotation.z = 0.2;
  box(group, [0.08, 0.5, 0.48], material(palette.accent), [-0.18, 0.81, 0]).rotation.z = -0.15;
  sword(group, palette, 0.44, true);
  mesh(group, new THREE.TorusGeometry(0.07, 0.018, 4, 8), material(0xd8bd69, { metalness: 0.6 }), [0.19, 1.25, -0.15], [1, 1, 1], [0, Math.PI / 2, 0]);
}

function addSeaWitch(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { robe: true, helmet: false, skin: 0x8ab7a9, bulk: 0.9 });
  const tentacle = material(palette.dark);
  for (const side of [-1, 1]) {
    cone(group, 0.09, 0.7, tentacle, [-0.12, 0.42, side * 0.26]).rotation.z = side * 0.35 + Math.PI;
    cone(group, 0.1, 0.45, material(palette.accent), [-0.04, 1.49, side * 0.16]).rotation.x = side * 0.45;
  }
  eyes(group, palette.accent, 0.21, 1.34, 0.09);
  staff(group, palette, 0.43);
}

function addSeaSerpent(group: THREE.Group, palette: Palette): void {
  const body = material(palette.body);
  const fin = material(palette.accent, { side: THREE.DoubleSide });
  const segments: Array<[number, number, number, number]> = [
    [-0.85, 0.25, 0.08, 0.18], [-0.58, 0.35, -0.08, 0.25], [-0.28, 0.47, 0.04, 0.31], [0.03, 0.68, 0, 0.3], [0.25, 0.98, 0, 0.25],
  ];
  for (const [x, y, z, radius] of segments) {
    mesh(group, new THREE.DodecahedronGeometry(radius, 0), body, [x, y, z], [1.25, 1, 0.9]);
    cone(group, 0.06, 0.32, fin, [x, y + radius * 0.9, z]).rotation.z = -0.15;
  }
  mesh(group, new THREE.DodecahedronGeometry(0.27, 0), body, [0.48, 1.25, 0], [1.2, 0.8, 0.9]);
  box(group, [0.4, 0.14, 0.3], material(palette.dark), [0.72, 1.17, 0]);
  eyes(group, palette.accent, 0.62, 1.33, 0.14);
  cone(group, 0.15, 0.7, body, [-1.12, 0.21, 0.08]).rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) cone(group, 0.12, 0.45, fin, [0.35, 1.15, side * 0.27]).rotation.x = side * 1.1;
}

function addHalfling(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { bulk: 0.9, skin: 0xd8ad83, helmet: false });
  cone(group, 0.24, 0.65, material(palette.dark), [-0.13, 0.83, 0], 5).rotation.z = Math.PI;
  mesh(group, new THREE.TorusGeometry(0.18, 0.025, 4, 10, Math.PI * 1.45), material(palette.accent),
    [0.23, 0.9, 0.4], [1, 1, 1], [0, Math.PI / 2, -0.7]);
  box(group, [0.19, 0.25, 0.16], material(0x76543a), [-0.24, 0.72, -0.18]);
  eyes(group, 0x5b402c, 0.2, 1.33, 0.08, 0.025);
}

function addAutomaton(group: THREE.Group, palette: Palette): void {
  mechanical(group, palette);
  const brass = material(palette.accent, { metalness: 0.7 });
  mesh(group, new THREE.TorusGeometry(0.18, 0.045, 5, 10), brass, [0.26, 0.93, 0], [1, 1, 1], [0, Math.PI / 2, 0]);
  cylinder(group, 0.035, 0.035, 0.45, brass, [0, 1.72, 0]);
  mesh(group, new THREE.OctahedronGeometry(0.08, 0), material(0xe6a44e, { emissive: 0xe6a44e, emissiveIntensity: 0.5 }), [0, 1.96, 0]);
}

function addDreadnought(group: THREE.Group, palette: Palette): void {
  const metal = material(palette.body, { metalness: 0.7, roughness: 0.45 });
  const brass = material(palette.accent, { metalness: 0.7 });
  const dark = material(palette.dark, { metalness: 0.55 });
  box(group, [1.05, 0.5, 0.72], metal, [-0.05, 0.64, 0]);
  box(group, [0.55, 0.38, 0.52], dark, [-0.17, 1.05, 0]);
  cylinder(group, 0.09, 0.12, 1.05, brass, [0.58, 1.12, 0]).rotation.z = -Math.PI / 2;
  cone(group, 0.13, 0.3, dark, [1.17, 1.12, 0]).rotation.z = -Math.PI / 2;
  for (const x of [-0.38, 0.3]) {
    for (const z of [-0.39, 0.39]) {
      cylinder(group, 0.16, 0.16, 0.12, dark, [x, 0.27, z], 10).rotation.x = Math.PI / 2;
      cylinder(group, 0.055, 0.075, 0.35, metal, [x, 0.43, z]);
    }
  }
  cylinder(group, 0.07, 0.09, 0.65, dark, [-0.35, 1.47, -0.15]);
  cylinder(group, 0.11, 0.07, 0.16, brass, [-0.35, 1.84, -0.15]);
  eyes(group, 0xffb347, 0.48, 0.78, 0.2, 0.045);
}

function addJuggernaut(group: THREE.Group, palette: Palette): void {
  mechanical(group, palette, true);
  const dark = material(palette.dark, { metalness: 0.6 });
  const glow = material(palette.accent, { emissive: 0x8a3818, emissiveIntensity: 0.55, metalness: 0.4 });
  cylinder(group, 0.3, 0.34, 0.75, glow, [-0.35, 0.95, 0], 8);
  for (const z of [-0.18, 0.18]) {
    cylinder(group, 0.07, 0.1, 0.72, dark, [-0.22, 1.63, z]);
    cone(group, 0.12, 0.25, glow, [-0.22, 2.08, z]);
  }
  for (const side of [-1, 1]) box(group, [0.38, 0.33, 0.32], dark, [0.18, 0.55, side * 0.57]);
}

function addBandit(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { helmet: false, skin: 0xb58b6d, bulk: 0.9 });
  cone(group, 0.25, 0.42, material(palette.dark), [0, 1.45, 0], 6);
  box(group, [0.09, 0.11, 0.31], material(palette.dark), [0.18, 1.27, 0]);
  sword(group, palette, 0.4, true);
  sword(group, palette, -0.4, true);
}

function addHornet(group: THREE.Group, palette: Palette): void {
  const body = material(palette.body);
  const stripe = material(palette.dark);
  const wingMaterial = material(palette.accent, { transparent: true, opacity: 0.65, side: THREE.DoubleSide });
  mesh(group, new THREE.IcosahedronGeometry(0.32, 1), body, [-0.27, 0.75, 0], [1.45, 0.85, 0.85]);
  mesh(group, new THREE.IcosahedronGeometry(0.24, 0), stripe, [0.25, 0.82, 0], [1.1, 0.9, 0.9]);
  mesh(group, new THREE.DodecahedronGeometry(0.2, 0), body, [0.53, 0.91, 0]);
  for (const x of [-0.48, -0.25, -0.02]) cylinder(group, 0.24, 0.24, 0.07, stripe, [x, 0.75, 0], 8).rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    mesh(group, new THREE.CircleGeometry(0.4, 5), wingMaterial, [-0.08, 1.02, side * 0.38], [1.4, 0.65, 1], [side * 0.55, 0, side * 0.3]);
    for (const x of [-0.3, 0, 0.27]) {
      cylinder(group, 0.018, 0.028, 0.55, stripe, [x, 0.48, side * 0.25]).rotation.x = side * 0.85;
    }
    cone(group, 0.025, 0.36, stripe, [0.57, 1.13, side * 0.09]).rotation.z = -0.45;
  }
  cone(group, 0.08, 0.55, stripe, [-0.85, 0.69, 0]).rotation.z = Math.PI / 2;
  eyes(group, palette.accent, 0.66, 0.98, 0.11, 0.045);
}

function addShaman(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { robe: true, helmet: false, skin: 0x77906b, bulk: 0.95 });
  box(group, [0.16, 0.31, 0.3], material(palette.accent), [0.18, 1.3, 0]);
  eyes(group, 0xf0d576, 0.27, 1.36, 0.09);
  for (const side of [-1, 1]) cone(group, 0.065, 0.5, material(side > 0 ? palette.body : palette.dark), [-0.02, 1.65, side * 0.12]).rotation.z = side * 0.25;
  staff(group, palette, -0.44, false);
  mesh(group, new THREE.TorusGeometry(0.19, 0.035, 4, 9), material(palette.accent), [0, 0.99, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
}

function addAlligator(group: THREE.Group, palette: Palette): void {
  quadruped(group, palette, { bulk: 1.15, low: true });
  const body = material(palette.body);
  const scute = material(palette.accent);
  box(group, [0.68, 0.17, 0.35], body, [0.95, 0.58, 0]);
  box(group, [0.63, 0.07, 0.32], material(palette.dark), [0.97, 0.48, 0]);
  cone(group, 0.17, 1.25, body, [-1.12, 0.37, 0]).rotation.z = Math.PI / 2;
  for (const x of [-0.55, -0.28, 0, 0.27, 0.52]) cone(group, 0.06, 0.25, scute, [x, 0.88, 0], 5);
  eyes(group, 0xe7cf62, 0.82, 0.77, 0.17, 0.04);
}

function addPage(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { armor: true, skin: 0xd8b18c, bulk: 0.88 });
  shield(group, palette);
  sword(group, palette, 0.4);
  cone(group, 0.065, 0.42, material(palette.body), [0, 1.78, 0]).rotation.z = -0.25;
  box(group, [0.05, 0.45, 0.38], material(palette.accent), [-0.24, 0.79, 0]);
}

function addDuelist(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { bulk: 0.82, skin: 0xd2a582, helmet: false });
  cone(group, 0.34, 0.9, material(palette.dark), [-0.18, 0.78, 0], 5).rotation.z = Math.PI;
  cylinder(group, 0.28, 0.28, 0.045, material(palette.dark), [0, 1.47, 0], 10);
  cone(group, 0.19, 0.25, material(palette.body), [0, 1.6, 0]);
  sword(group, palette, 0.42, true);
  cone(group, 0.045, 0.55, material(palette.accent), [-0.03, 1.78, 0]).rotation.z = -0.65;
}

function addCourtWizard(group: THREE.Group, palette: Palette): void {
  humanoid(group, palette, { robe: true, helmet: false, skin: 0xd5b598, bulk: 0.9 });
  const hat = material(palette.dark);
  cylinder(group, 0.34, 0.34, 0.05, hat, [0, 1.47, 0], 10);
  cone(group, 0.23, 0.7, hat, [-0.04, 1.82, 0]).rotation.z = 0.18;
  mesh(group, new THREE.TorusGeometry(0.21, 0.035, 4, 10), material(palette.accent), [0, 1.56, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  staff(group, palette, -0.43);
  box(group, [0.29, 0.08, 0.38], material(palette.accent), [0.24, 0.75, 0.39]).rotation.z = -0.25;
}

function addRoyalLion(group: THREE.Group, palette: Palette): void {
  quadruped(group, palette, { bulk: 1.05 });
  wings(group, palette.accent, 1.2, 0.82, false, 'royal-lion-wing');
  const mane = material(palette.dark);
  mesh(group, new THREE.TorusGeometry(0.35, 0.15, 5, 10), mane, [0.46, 0.91, 0], [1, 1, 1], [0, Math.PI / 2, 0]);
  const gold = material(palette.accent, { metalness: 0.45 });
  cylinder(group, 0.2, 0.24, 0.12, gold, [0.53, 1.29, 0], 8);
  for (const z of [-0.14, 0, 0.14]) cone(group, 0.06, 0.28, gold, [0.53, 1.48, z], 5);
  mesh(group, new THREE.OctahedronGeometry(0.13, 0), mane, [-1.13, 0.58, 0]);
}

export const HOTA_CREATURE_SPECS: Record<string, HotaSpec> = {
  gremlin: { faction: 'Tower', archetype: 'humanoid-artificer', scale: 0.74, palette: { body: 0x527f85, accent: 0xd3ad61, dark: 0x303b44 }, build: addGremlin },
  stoneGargoyle: { faction: 'Tower', archetype: 'winged-stone-beast', scale: 0.93, palette: { body: 0x8998a0, accent: 0xc4d2ce, dark: 0x4c5965 }, build: addStoneGargoyle },
  genie: { faction: 'Tower', archetype: 'floating-humanoid', scale: 1.02, palette: { body: 0x568ac0, accent: 0xe4c66d, dark: 0x374b83 }, build: addGenie },
  titan: { faction: 'Tower', archetype: 'giant-humanoid', scale: 1.3, palette: { body: 0x62758f, accent: 0xf2dc79, dark: 0x303849 }, build: addTitan },
  skeleton: { faction: 'Necropolis', archetype: 'skeletal-humanoid', scale: 0.91, palette: { body: 0xd2cfb4, accent: 0x8fb89b, dark: 0x484d4b }, build: addSkeleton },
  zombie: { faction: 'Necropolis', archetype: 'undead-humanoid', scale: 0.96, palette: { body: 0x586d62, accent: 0x9a765e, dark: 0x343b39 }, build: addZombie },
  vampire: { faction: 'Necropolis', archetype: 'caped-undead', scale: 1.02, palette: { body: 0x683e51, accent: 0xb89aa8, dark: 0x251f31 }, build: addVampire },
  ghostDragon: { faction: 'Necropolis', archetype: 'spectral-dragon', scale: 1.16, palette: { body: 0x729a96, accent: 0xa7e0c8, dark: 0x324c55 }, build: addGhostDragon },
  troglodyte: { faction: 'Dungeon', archetype: 'eyeless-humanoid', scale: 0.88, palette: { body: 0x8c806d, accent: 0xb5a58b, dark: 0x49434a }, build: addTroglodyte },
  harpy: { faction: 'Dungeon', archetype: 'winged-humanoid', scale: 0.94, palette: { body: 0x74566f, accent: 0xc18b9f, dark: 0x3b3047 }, build: addHarpy },
  minotaur: { faction: 'Dungeon', archetype: 'horned-humanoid', scale: 1.14, palette: { body: 0x765849, accent: 0xd1bd8d, dark: 0x3b2e31 }, build: addMinotaur },
  redDragon: { faction: 'Dungeon', archetype: 'fire-dragon', scale: 1.18, palette: { body: 0xa74739, accent: 0xf0a04b, dark: 0x4c2830 }, build: addRedDragon },
  goblin: { faction: 'Stronghold', archetype: 'small-humanoid', scale: 0.75, palette: { body: 0x6d7e45, accent: 0xb79b62, dark: 0x3e3c2e }, build: addGoblin },
  wolfRider: { faction: 'Stronghold', archetype: 'mounted-beast', scale: 0.96, palette: { body: 0x6a6256, accent: 0xc69c5a, dark: 0x353537 }, build: addWolfRider },
  ogre: { faction: 'Stronghold', archetype: 'heavy-humanoid', scale: 1.18, palette: { body: 0x8b5e45, accent: 0xc4a26d, dark: 0x48372f }, build: addOgre },
  behemoth: { faction: 'Stronghold', archetype: 'colossal-beast', scale: 1.17, palette: { body: 0x72513f, accent: 0xd6c69d, dark: 0x3b302e }, build: addBehemoth },
  pixie: { faction: 'Conflux', archetype: 'flying-fey', scale: 0.66, palette: { body: 0x68b8ad, accent: 0xe4b8ef, dark: 0x515485 }, build: addPixie },
  airElemental: { faction: 'Conflux', archetype: 'vortex-elemental', scale: 0.98, palette: { body: 0x8ed6d4, accent: 0xe2f4d7, dark: 0x477d8b }, build: addAirElemental },
  stormElemental: { faction: 'Conflux', archetype: 'storm-elemental', scale: 1.08, palette: { body: 0x657795, accent: 0xf0dc67, dark: 0x343c60 }, build: addStormElemental },
  phoenix: { faction: 'Conflux', archetype: 'fire-bird', scale: 1.03, palette: { body: 0xd75d36, accent: 0xffcf55, dark: 0x7a3040 }, build: addPhoenix },
  nymph: { faction: 'Cove', archetype: 'aquatic-fey', scale: 0.88, palette: { body: 0x58a9a0, accent: 0xb8e3ca, dark: 0x346b70 }, build: addNymph },
  corsair: { faction: 'Cove', archetype: 'humanoid-duelist', scale: 0.96, palette: { body: 0x426b78, accent: 0xc45f4d, dark: 0x2e3742 }, build: addCorsair },
  seaWitch: { faction: 'Cove', archetype: 'tentacled-caster', scale: 1.03, palette: { body: 0x426e70, accent: 0x9bd5b4, dark: 0x31394f }, build: addSeaWitch },
  seaSerpent: { faction: 'Cove', archetype: 'sea-serpent', scale: 1.08, palette: { body: 0x397e83, accent: 0x83c9b5, dark: 0x294653 }, build: addSeaSerpent },
  halfling: { faction: 'Factory', archetype: 'small-humanoid-scout', scale: 0.75, palette: { body: 0x98734e, accent: 0xd0b46e, dark: 0x504438 }, build: addHalfling },
  automaton: { faction: 'Factory', archetype: 'mechanical-humanoid', scale: 0.96, palette: { body: 0x7e8b8c, accent: 0xc79c55, dark: 0x3c474a }, build: addAutomaton },
  dreadnought: { faction: 'Factory', archetype: 'mechanical-walker', scale: 1.0, palette: { body: 0x68777a, accent: 0xd19a4d, dark: 0x353d43 }, build: addDreadnought },
  juggernaut: { faction: 'Factory', archetype: 'boiler-golem', scale: 1.15, palette: { body: 0x716c63, accent: 0xd58b45, dark: 0x3d3837 }, build: addJuggernaut },
  bandit: { faction: 'Bulwark', archetype: 'hooded-humanoid', scale: 0.91, palette: { body: 0x59654b, accent: 0xb59763, dark: 0x30362f }, build: addBandit },
  hornet: { faction: 'Bulwark', archetype: 'flying-insect', scale: 0.9, palette: { body: 0xd2a63f, accent: 0xd9e2c2, dark: 0x3c382d }, build: addHornet },
  shaman: { faction: 'Bulwark', archetype: 'masked-caster', scale: 0.98, palette: { body: 0x5c7458, accent: 0xc5915c, dark: 0x39443c }, build: addShaman },
  alligator: { faction: 'Bulwark', archetype: 'armored-reptile', scale: 1.05, palette: { body: 0x56704b, accent: 0x9caa69, dark: 0x35473a }, build: addAlligator },
  page: { faction: 'Courtyard', archetype: 'shielded-humanoid', scale: 0.82, palette: { body: 0x875b78, accent: 0xe0c176, dark: 0x49384d }, build: addPage },
  duelist: { faction: 'Courtyard', archetype: 'fencing-humanoid', scale: 0.96, palette: { body: 0x8c5262, accent: 0xe1c685, dark: 0x3e3145 }, build: addDuelist },
  courtWizard: { faction: 'Courtyard', archetype: 'robed-caster', scale: 1.0, palette: { body: 0x66568c, accent: 0xd7b968, dark: 0x382e51 }, build: addCourtWizard },
  royalLion: { faction: 'Courtyard', archetype: 'crowned-winged-beast', scale: 1.08, palette: { body: 0xc09252, accent: 0xe5c96e, dark: 0x704334 }, build: addRoyalLion },
};

export const HOTA_CREATURE_IDS: readonly string[] = Object.freeze(Object.keys(HOTA_CREATURE_SPECS));

export const HOTA_CREATURE_FACTIONS: Readonly<Record<string, HotaFaction>> = Object.freeze(
  Object.fromEntries(Object.entries(HOTA_CREATURE_SPECS).map(([id, spec]) => [id, spec.faction])),
);

export function createHotaCreature(creatureId: string): HotaCreatureVisual | null {
  const spec = HOTA_CREATURE_SPECS[creatureId];
  if (!spec) return null;
  const group = new THREE.Group();
  spec.build(group, spec.palette);
  group.scale.setScalar(spec.scale);
  group.name = `${creatureId}-body`;
  return {
    group,
    faction: spec.faction,
    archetype: spec.archetype,
    palette: [spec.palette.body, spec.palette.accent, spec.palette.dark],
  };
}
