import * as THREE from 'three';

interface EmberPalette {
  basalt: THREE.MeshStandardMaterial;
  basaltLight: THREE.MeshStandardMaterial;
  obsidian: THREE.MeshStandardMaterial;
  iron: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  charred: THREE.MeshStandardMaterial;
  coal: THREE.MeshStandardMaterial;
  ash: THREE.MeshStandardMaterial;
  bone: THREE.MeshStandardMaterial;
  lava: THREE.MeshStandardMaterial;
  flame: THREE.MeshStandardMaterial;
}

type EmberDwellingId = 'impWarrens' | 'hellhoundKennels' | 'ifritSpire' | 'pitFiendAbyss';
type Point = readonly [number, number, number];
type DwellingBuilder = (group: THREE.Group, palette: EmberPalette, built: boolean) => void;

function material(
  color: THREE.ColorRepresentation,
  roughness = 0.84,
  metalness = 0,
): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  result.userData.baseColor = result.color.getHex();
  return result;
}

function glow(color: number, intensity = 0.65): THREE.MeshStandardMaterial {
  const result = material(color, 0.34, 0.08);
  result.emissive.setHex(color);
  result.emissiveIntensity = intensity;
  return result;
}

function createPalette(): EmberPalette {
  return {
    basalt: material(0x514247),
    basaltLight: material(0x6b5657),
    obsidian: material(0x29252d, 0.5, 0.22),
    iron: material(0x39343a, 0.48, 0.62),
    copper: material(0xa85f3d, 0.42, 0.58),
    charred: material(0x493a35),
    coal: material(0x211f24),
    ash: material(0x82716a),
    bone: material(0xc4ab8b, 0.7),
    lava: glow(0xf06b32, 0.78),
    flame: glow(0xffc65c, 0.9),
  };
}

function addMesh(
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
  return addMesh(parent, new THREE.BoxGeometry(width, height, depth), surface, x, y, z);
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
  return addMesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, x, y, z);
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
  return addMesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, x, y, z);
}

function beam(
  parent: THREE.Object3D,
  start: Point,
  end: Point,
  radius: number,
  surface: THREE.Material,
): THREE.Mesh {
  const origin = new THREE.Vector3(...start);
  const direction = new THREE.Vector3(...end).sub(origin);
  const result = addMesh(
    parent,
    new THREE.CylinderGeometry(radius, radius, direction.length(), 6),
    surface,
  );
  result.position.copy(origin).addScaledVector(direction, 0.5);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function addFoundation(group: THREE.Group, palette: EmberPalette): void {
  const foundation = new THREE.Group();
  foundation.name = 'basalt-foundation';
  group.add(foundation);
  box(foundation, 3.15, 0.16, 2.85, palette.obsidian, 0, 0.08, 0);
  box(foundation, 2.98, 0.06, 2.68, palette.basaltLight, 0, 0.19, 0);
  for (const [x, z, rotation] of [
    [-0.92, 0.82, 0.38],
    [0.7, 1.02, -0.45],
    [1.12, -0.65, 0.25],
  ] as const) {
    const seam = box(foundation, 0.5, 0.018, 0.055, palette.lava, x, 0.229, z);
    seam.rotation.y = rotation;
  }
  for (const x of [-1.42, 1.42]) {
    for (const z of [-1.25, 1.25]) {
      box(foundation, 0.22, 0.12, 0.22, palette.basalt, x, 0.22, z).rotation.y = Math.PI / 4;
    }
  }
}

function addDoor(
  parent: THREE.Object3D,
  palette: EmberPalette,
  x: number,
  base: number,
  z: number,
  width: number,
  height: number,
): THREE.Group {
  const door = new THREE.Group();
  door.name = 'front-entrance';
  parent.add(door);
  box(door, width, height, 0.065, palette.coal, x, base + height / 2, z);
  for (const side of [-1, 1]) {
    box(door, 0.09, height + 0.08, 0.1, palette.basaltLight,
      x + side * (width / 2 + 0.035), base + height / 2, z + 0.005);
  }
  box(door, width + 0.16, 0.1, 0.1, palette.copper, x, base + height + 0.035, z + 0.005);
  addMesh(door, new THREE.OctahedronGeometry(0.045, 0), palette.flame,
    x + width * 0.27, base + height * 0.48, z + 0.065);
  return door;
}

function addFlame(
  parent: THREE.Object3D,
  palette: EmberPalette,
  x: number,
  base: number,
  z: number,
  size = 1,
): THREE.Group {
  const flame = new THREE.Group();
  flame.position.set(x, base, z);
  parent.add(flame);
  cone(flame, 0.22 * size, 0.85 * size, 7, palette.lava, 0, 0.425 * size, 0);
  const inner = cone(flame, 0.115 * size, 0.57 * size, 6, palette.flame,
    0.045 * size, 0.285 * size, 0.035 * size);
  inner.rotation.z = -0.16;
  return flame;
}

function addGableRoof(
  parent: THREE.Object3D,
  width: number,
  depth: number,
  height: number,
  surface: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const w = width / 2;
  const d = depth / 2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -w, 0, -d, w, 0, -d, 0, height, -d,
    -w, 0, d, w, 0, d, 0, height, d,
  ], 3));
  geometry.setIndex([
    0, 2, 1, 3, 4, 5,
    0, 3, 5, 0, 5, 2,
    1, 2, 5, 1, 5, 4,
    0, 1, 4, 0, 4, 3,
  ]);
  geometry.computeVertexNormals();
  return addMesh(parent, geometry, surface, x, y, z);
}

function addScaffolding(group: THREE.Group, palette: EmberPalette, height: number): void {
  const scaffold = new THREE.Group();
  scaffold.name = 'forge-scaffolding';
  group.add(scaffold);
  for (const x of [-1.37, 1.37]) {
    for (const z of [-1.12, 1.12]) {
      cylinder(scaffold, 0.035, 0.055, height, 6, palette.charred, x, 0.22 + height / 2, z);
      cylinder(scaffold, 0.065, 0.065, 0.07, 8, palette.copper, x, 0.29, z);
    }
  }
  for (const z of [-1.12, 1.12]) {
    beam(scaffold, [-1.37, 0.32, z], [1.37, height + 0.16, z], 0.028, palette.charred);
    beam(scaffold, [1.37, 0.32, z], [-1.37, height + 0.16, z], 0.028, palette.charred);
    box(scaffold, 2.85, 0.075, 0.075, palette.iron, 0, height + 0.22, z);
  }
  for (let index = 0; index < 3; index += 1) {
    const plank = box(scaffold, 0.68, 0.07, 0.15, palette.charred,
      -0.72 + index * 0.1, 0.27 + index * 0.075, 1.02 - index * 0.035);
    plank.rotation.y = -0.22 + index * 0.16;
  }
  for (const [x, z] of [[0.78, 0.92], [1.02, 0.8], [0.88, 0.65]] as const) {
    box(scaffold, 0.25, 0.18, 0.22, palette.basalt, x, 0.31, z).rotation.y = x;
  }
}

function buildImpWarrens(group: THREE.Group, palette: EmberPalette, built: boolean): void {
  if (!built) {
    const outline = new THREE.Group();
    outline.name = 'imp-warrens-cave-outline';
    group.add(outline);
    box(outline, 2.35, 0.52, 0.28, palette.basalt, 0, 0.48, -0.82);
    box(outline, 0.32, 0.76, 1.45, palette.basalt, -1.02, 0.6, -0.12);
    box(outline, 0.32, 0.42, 1.45, palette.basaltLight, 1.02, 0.43, -0.12);
    for (const x of [-0.52, 0, 0.52]) {
      box(outline, 0.38, 0.28, 0.34, palette.obsidian, x, 0.36, 0.42).rotation.y = x;
    }
    beam(outline, [-0.72, 0.28, 0.82], [0, 1.22, 0.82], 0.075, palette.basaltLight);
    beam(outline, [0, 1.22, 0.82], [0.72, 0.28, 0.82], 0.075, palette.basaltLight);
    return;
  }

  const warrens = new THREE.Group();
  warrens.name = 'imp-warrens-lava-cut-burrows';
  group.add(warrens);
  box(warrens, 2.48, 0.92, 1.72, palette.basalt, 0, 0.68, -0.18);
  const crown = addMesh(warrens, new THREE.DodecahedronGeometry(0.88, 0), palette.basalt,
    0, 1.27, -0.35);
  crown.scale.set(1.35, 0.78, 0.92);
  for (const side of [-1, 1]) {
    const crag = addMesh(warrens, new THREE.DodecahedronGeometry(0.54, 0), palette.basaltLight,
      side * 1.02, 0.74, -0.1);
    crag.scale.set(0.88, 1.05, 0.95);
    addDoor(warrens, palette, side * 0.83, 0.22, 0.72, 0.34, 0.53);
    const slit = box(warrens, 0.055, 0.55, 0.05, palette.lava, side * 1.18, 1.13, 0.39);
    slit.rotation.z = side * 0.26;
  }
  addDoor(warrens, palette, 0, 0.22, 0.715, 0.54, 0.72);
  const arch = addMesh(warrens, new THREE.TorusGeometry(0.35, 0.075, 6, 16, Math.PI),
    palette.obsidian, 0, 0.95, 0.77);
  arch.name = 'imp-warrens-horn-arch';
  for (const side of [-1, 1]) {
    const horn = cone(warrens, 0.11, 0.72, 6, palette.bone, side * 0.35, 1.55, 0.74);
    horn.rotation.z = side * 0.68;
  }
  for (const [x, y, rotation] of [[-0.52, 1.48, -0.3], [0.42, 1.63, 0.4], [0.04, 1.87, -0.15]] as const) {
    const seam = box(warrens, 0.055, 0.52, 0.045, palette.lava, x, y, 0.28);
    seam.rotation.z = rotation;
  }
  cylinder(warrens, 0.18, 0.27, 1.95, 7, palette.obsidian, 0.88, 1.195, -0.7);
  cylinder(warrens, 0.29, 0.23, 0.16, 7, palette.copper, 0.88, 2.25, -0.7);
  addFlame(warrens, palette, 0.88, 2.33, -0.7, 0.55);
  const trough = box(warrens, 0.62, 0.22, 0.4, palette.iron, -0.92, 0.34, 0.96);
  trough.name = 'imp-warrens-lava-trough';
  box(warrens, 0.5, 0.035, 0.29, palette.lava, -0.92, 0.468, 0.96);
}

function addPenRails(group: THREE.Group, palette: EmberPalette): void {
  for (const x of [-1.34, 1.34]) {
    for (const z of [-0.9, -0.25, 0.4, 1.05]) {
      cylinder(group, 0.045, 0.07, 0.82, 6, palette.iron, x, 0.63, z);
      cone(group, 0.085, 0.2, 5, palette.copper, x, 1.14, z);
    }
    for (const y of [0.52, 0.84]) box(group, 0.065, 0.065, 2.12, palette.iron, x, y, 0.05);
  }
  for (const x of [-0.95, 0.95]) {
    for (const y of [0.52, 0.84]) box(group, 0.72, 0.065, 0.065, palette.iron, x, y, 1.05);
  }
  beam(group, [-0.6, 0.85, 1.05], [0.6, 0.85, 1.05], 0.035, palette.copper);
}

function addHoundCrest(group: THREE.Group, palette: EmberPalette): void {
  const crest = new THREE.Group();
  crest.name = 'hellhound-kennels-twin-hound-crest';
  group.add(crest);
  for (const side of [-1, 1]) {
    const x = side * 0.55;
    const head = addMesh(crest, new THREE.DodecahedronGeometry(0.29, 0), palette.obsidian,
      x, 2.02, -0.02);
    head.scale.set(1, 0.9, 0.86);
    box(crest, 0.3, 0.17, 0.28, palette.basaltLight, x, 1.9, 0.19);
    for (const earSide of [-1, 1]) {
      const ear = cone(crest, 0.105, 0.42, 5, palette.iron,
        x + earSide * 0.19, 2.34, -0.04);
      ear.rotation.z = earSide * 0.28;
    }
    for (const eyeSide of [-1, 1]) {
      box(crest, 0.065, 0.055, 0.035, palette.flame,
        x + eyeSide * 0.1, 2.06, 0.225);
    }
    box(crest, 0.09, 0.065, 0.04, palette.coal, x, 1.92, 0.345);
  }
}

function buildHellhoundKennels(group: THREE.Group, palette: EmberPalette, built: boolean): void {
  addPenRails(group, palette);
  if (!built) {
    const frame = new THREE.Group();
    frame.name = 'hellhound-kennels-unfinished-pen';
    group.add(frame);
    for (const x of [-0.64, 0.64]) {
      box(frame, 1.08, 0.14, 1.2, palette.basalt, x, 0.29, -0.48);
      for (const postX of [x - 0.45, x + 0.45]) {
        for (const z of [-0.98, 0.02]) {
          box(frame, 0.1, 1.05, 0.1, palette.charred, postX, 0.835, z);
        }
      }
      beam(frame, [x - 0.54, 1.38, 0.02], [x, 1.82, 0.02], 0.055, palette.charred);
      beam(frame, [x, 1.82, 0.02], [x + 0.54, 1.38, 0.02], 0.055, palette.charred);
    }
    box(frame, 0.64, 0.28, 0.42, palette.iron, 0.88, 0.36, 0.58);
    return;
  }

  const kennels = new THREE.Group();
  kennels.name = 'hellhound-kennels-forge-bays';
  group.add(kennels);
  for (const side of [-1, 1]) {
    const x = side * 0.64;
    box(kennels, 1.1, 1.12, 1.22, palette.basalt, x, 0.78, -0.48);
    box(kennels, 1.16, 0.12, 1.28, palette.iron, x, 1.28, -0.48);
    addGableRoof(kennels, 1.3, 1.42, 0.52, palette.obsidian, x, 1.34, -0.48);
    addDoor(kennels, palette, x, 0.22, 0.155, 0.44, 0.7);
    box(kennels, 0.62, 0.07, 0.06, palette.lava, x, 1.24, 0.17);
    const bayMark = addMesh(kennels, new THREE.OctahedronGeometry(0.1, 0), palette.copper,
      x, 1.58, 0.25);
    bayMark.scale.y = 1.35;
  }
  addHoundCrest(kennels, palette);
  cylinder(kennels, 0.18, 0.27, 2.2, 8, palette.obsidian, 0, 1.32, -1.03);
  cylinder(kennels, 0.29, 0.22, 0.16, 8, palette.copper, 0, 2.5, -1.03);
  addFlame(kennels, palette, 0, 2.58, -1.03, 0.65);
  const trough = box(kennels, 0.72, 0.3, 0.42, palette.iron, 0.78, 0.37, 0.62);
  trough.name = 'hellhound-kennels-quenching-trough';
  box(kennels, 0.6, 0.035, 0.3, palette.lava, 0.78, 0.538, 0.62);
  const bone = box(kennels, 0.6, 0.11, 0.13, palette.bone, -0.68, 0.32, 0.7);
  bone.rotation.y = -0.28;
  for (const side of [-1, 1]) {
    addMesh(kennels, new THREE.DodecahedronGeometry(0.11, 0), palette.bone,
      -0.68 + side * 0.29, 0.32, 0.7 + side * 0.08);
  }
}

function buildIfritSpire(group: THREE.Group, palette: EmberPalette, built: boolean): void {
  if (!built) {
    const drum = new THREE.Group();
    drum.name = 'ifrit-spire-lower-drum';
    group.add(drum);
    cylinder(drum, 1.03, 1.16, 0.28, 10, palette.obsidian, 0, 0.36, -0.08);
    cylinder(drum, 0.84, 1.02, 0.92, 10, palette.basalt, 0, 0.94, -0.08);
    for (let index = 0; index < 5; index += 1) {
      const angle = index * Math.PI * 2 / 10;
      box(drum, 0.28, 0.34, 0.25, palette.basaltLight,
        Math.sin(angle) * 0.84, 1.53, Math.cos(angle) * 0.84 - 0.08).rotation.y = angle;
    }
    addDoor(drum, palette, 0, 0.22, 0.91, 0.46, 0.68);
    cylinder(drum, 0.5, 0.5, 0.06, 10, palette.coal, 0, 1.43, -0.08);
    return;
  }

  const spire = new THREE.Group();
  spire.name = 'ifrit-spire-basalt-forge-tower';
  group.add(spire);
  cylinder(spire, 1.12, 1.26, 0.25, 10, palette.obsidian, 0, 0.345, -0.08);
  cylinder(spire, 0.83, 1.04, 1.45, 10, palette.basalt, 0, 1.17, -0.08);
  cylinder(spire, 0.64, 0.83, 1.25, 10, palette.basaltLight, 0, 2.52, -0.08);
  cylinder(spire, 0.46, 0.64, 0.75, 10, palette.obsidian, 0, 3.61, -0.08);
  for (const [radius, y] of [[0.96, 1.91], [0.82, 3.17], [0.63, 4.01]] as const) {
    cylinder(spire, radius, radius, 0.14, 10, palette.iron, 0, y, -0.08);
    const ring = addMesh(spire, new THREE.TorusGeometry(radius, 0.045, 5, 20), palette.copper,
      0, y + 0.09, -0.08);
    ring.rotation.x = Math.PI / 2;
  }
  addDoor(spire, palette, 0, 0.47, 0.94, 0.48, 0.82);
  for (const [y, z, width] of [[1.42, 0.84, 0.18], [2.48, 0.69, 0.16], [3.56, 0.49, 0.14]] as const) {
    box(spire, width + 0.1, 0.48, 0.06, palette.iron, 0, y, z);
    box(spire, width, 0.36, 0.07, palette.lava, 0, y, z + 0.025);
    box(spire, 0.035, 0.38, 0.085, palette.copper, 0, y, z + 0.04);
  }
  for (const side of [-1, 1]) {
    const buttress = cone(spire, 0.23, 2.15, 5, palette.obsidian, side * 0.94, 1.52, -0.18);
    buttress.rotation.z = side * -0.13;
    cylinder(spire, 0.2, 0.26, 0.22, 7, palette.copper, side * 1.02, 2.56, -0.18);
    addFlame(spire, palette, side * 1.02, 2.67, -0.18, 0.55);
  }
  const crown = new THREE.Group();
  crown.name = 'ifrit-spire-flame-crown';
  spire.add(crown);
  const halo = addMesh(crown, new THREE.TorusGeometry(0.68, 0.065, 6, 20), palette.copper,
    0, 4.17, -0.08);
  halo.rotation.x = Math.PI / 2;
  for (let index = 0; index < 5; index += 1) {
    const angle = index * Math.PI * 2 / 5;
    addFlame(crown, palette, Math.sin(angle) * 0.52, 4.08, Math.cos(angle) * 0.52 - 0.08, 0.55);
  }
  addFlame(crown, palette, 0, 4.06, -0.08, 1.05);
  const heart = addMesh(crown, new THREE.OctahedronGeometry(0.3, 0), palette.flame, 0, 4.83, -0.08);
  heart.name = 'ifrit-spire-ember-heart';
  heart.scale.y = 1.3;
}

function buildPitFiendAbyss(group: THREE.Group, palette: EmberPalette, built: boolean): void {
  const rim = new THREE.Group();
  rim.name = built ? 'pit-fiend-abyss-sealed-rim' : 'pit-fiend-abyss-open-rim';
  group.add(rim);
  cylinder(rim, 1.36, 1.5, 0.24, 12, palette.obsidian, 0, 0.34, 0.05).scale.z = 0.86;
  const ring = addMesh(rim, new THREE.TorusGeometry(1.08, 0.16, 7, 24), palette.basaltLight,
    0, 0.51, 0.05);
  ring.rotation.x = Math.PI / 2;
  ring.scale.y = 0.86;
  cylinder(rim, 0.94, 0.94, 0.055, 12, palette.coal, 0, 0.48, 0.05).scale.z = 0.86;
  const entrance = new THREE.Group();
  entrance.name = 'front-entrance';
  rim.add(entrance);
  for (let index = 0; index < 3; index += 1) {
    box(entrance, 0.96 - index * 0.12, 0.1, 0.3, palette.basalt,
      0, 0.27 + index * 0.09, 1.25 - index * 0.25);
  }

  if (!built) {
    for (const [x, z, height] of [[-1.15, -0.58, 0.82], [1.15, -0.58, 1.14], [-1.18, 0.5, 0.55]] as const) {
      cylinder(rim, 0.13, 0.21, height, 6, palette.basalt, x, 0.22 + height / 2, z);
      cylinder(rim, 0.22, 0.22, 0.09, 6, palette.copper, x, 0.27 + height, z);
    }
    beam(rim, [-1.15, 1.04, -0.58], [0, 1.55, -0.72], 0.09, palette.obsidian);
    for (const [x, z] of [[0.4, 0.3], [-0.3, -0.15], [0.1, -0.45]] as const) {
      addMesh(rim, new THREE.DodecahedronGeometry(0.18, 0), palette.ash, x, 0.59, z);
    }
    return;
  }

  cylinder(rim, 0.86, 0.86, 0.045, 12, palette.lava, 0, 0.52, 0.05).scale.z = 0.86;
  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3;
    const x = Math.sin(angle) * 1.28;
    const z = Math.cos(angle) * 1.05;
    if (z > 0.8 && Math.abs(x) < 0.8) continue;
    cylinder(rim, 0.09, 0.16, 0.72, 6, palette.obsidian, x, 0.82, z);
    addFlame(rim, palette, x, 1.18, z, 0.42);
  }

  const portal = new THREE.Group();
  portal.name = 'pit-fiend-abyss-horned-portal';
  group.add(portal);
  for (const side of [-1, 1]) {
    cylinder(portal, 0.23, 0.34, 2.45, 7, palette.basalt, side * 1.03, 1.445, -0.68);
    cylinder(portal, 0.35, 0.35, 0.15, 7, palette.copper, side * 1.03, 2.69, -0.68);
    cone(portal, 0.27, 0.44, 6, palette.obsidian, side * 1.03, 2.985, -0.68);
  }
  const portalRing = addMesh(portal, new THREE.TorusGeometry(0.93, 0.14, 7, 24), palette.obsidian,
    0, 2.45, -0.68);
  portalRing.name = 'pit-fiend-abyss-portal-ring';
  const innerRing = addMesh(portal, new THREE.TorusGeometry(0.76, 0.035, 5, 24), palette.lava,
    0, 2.45, -0.53);
  innerRing.scale.y = 1.08;
  const darkness = addMesh(portal, new THREE.CircleGeometry(0.74, 16), palette.coal,
    0, 2.45, -0.56);
  darkness.scale.y = 1.08;
  const skull = addMesh(portal, new THREE.DodecahedronGeometry(0.32, 0), palette.basaltLight,
    0, 3.28, -0.5);
  skull.scale.set(1.1, 0.82, 0.8);
  box(portal, 0.4, 0.2, 0.28, palette.obsidian, 0, 3.08, -0.36);
  for (const side of [-1, 1]) {
    box(portal, 0.09, 0.065, 0.04, palette.flame, side * 0.12, 3.31, -0.245);
    const horn = cone(portal, 0.16, 1.15, 7, palette.bone, side * 0.47, 3.84, -0.53);
    horn.rotation.z = side * 0.5;
  }
  addFlame(portal, palette, 0, 0.55, 0.05, 0.9);
}

const DWELLINGS: Readonly<Record<EmberDwellingId, {
  creatureId: 'imp' | 'hellhound' | 'ifrit' | 'pitFiend';
  tier: 1 | 2 | 3 | 4;
  form: 'cavern' | 'pen' | 'tower' | 'ritual';
  scaffoldHeight: number;
  build: DwellingBuilder;
}>> = {
  impWarrens: { creatureId: 'imp', tier: 1, form: 'cavern', scaffoldHeight: 1.25, build: buildImpWarrens },
  hellhoundKennels: { creatureId: 'hellhound', tier: 2, form: 'pen', scaffoldHeight: 1.35, build: buildHellhoundKennels },
  ifritSpire: { creatureId: 'ifrit', tier: 3, form: 'tower', scaffoldHeight: 2.15, build: buildIfritSpire },
  pitFiendAbyss: { creatureId: 'pitFiend', tier: 4, form: 'ritual', scaffoldHeight: 1.55, build: buildPitFiendAbyss },
};

function createBuildingModel(buildingId: string, built: boolean): THREE.Group | null {
  if (!Object.hasOwn(DWELLINGS, buildingId)) return null;
  const id = buildingId as EmberDwellingId;
  const details = DWELLINGS[id];
  const palette = createPalette();
  const model = new THREE.Group();
  model.name = id;
  model.userData = {
    faction: 'ember',
    buildingId: id,
    creatureId: details.creatureId,
    tier: details.tier,
    form: details.form,
    built,
    constructionState: built ? 'complete' : 'underConstruction',
    modelPack: 'ember',
  };
  const structure = new THREE.Group();
  structure.name = built ? 'completed-dwelling' : 'construction-site';
  model.add(structure);
  addFoundation(structure, palette);
  details.build(structure, palette, built);
  if (!built) addScaffolding(structure, palette, details.scaffoldHeight);
  return model;
}

export default {
  faction: 'ember',
  createBuildingModel,
} as const;
