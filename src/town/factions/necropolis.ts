import * as THREE from 'three';

type Point = readonly [number, number, number];
type DwellingId = 'skeletonCrypt' | 'zombieGraveyard' | 'vampireEstate' | 'ghostDragonSepulcher';

interface NecropolisMaterials {
  stone: THREE.MeshStandardMaterial;
  darkStone: THREE.MeshStandardMaterial;
  bone: THREE.MeshStandardMaterial;
  roof: THREE.MeshStandardMaterial;
  iron: THREE.MeshStandardMaterial;
  timber: THREE.MeshStandardMaterial;
  earth: THREE.MeshStandardMaterial;
  undead: THREE.MeshStandardMaterial;
  ecto: THREE.MeshStandardMaterial;
  blood: THREE.MeshStandardMaterial;
  spectral: THREE.MeshStandardMaterial;
}

const FLOOR = 0.26;

function material(color: number, roughness = 0.86, metalness = 0): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  result.userData.baseColor = color;
  return result;
}

function glow(color: number, intensity = 0.55): THREE.MeshStandardMaterial {
  const result = material(color, 0.42);
  result.emissive.setHex(color);
  result.emissiveIntensity = intensity;
  return result;
}

function createMaterials(): NecropolisMaterials {
  const spectral = glow(0x8fc4a1, 0.35);
  spectral.transparent = true;
  spectral.opacity = 0.3;
  spectral.depthWrite = false;
  spectral.side = THREE.DoubleSide;
  return {
    stone: material(0x666b68),
    darkStone: material(0x353a42),
    bone: material(0xc2c0a7, 0.78),
    roof: material(0x292d36),
    iron: material(0x252a2d, 0.55, 0.5),
    timber: material(0x4b4037),
    earth: material(0x383c32),
    undead: material(0x78836b),
    ecto: glow(0x8fc4a1),
    blood: glow(0x8f3448, 0.32),
    spectral,
  };
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

function rock(
  parent: THREE.Object3D,
  radius: number,
  surface: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  return mesh(parent, new THREE.DodecahedronGeometry(radius, 0), surface, x, y, z);
}

function beam(
  parent: THREE.Object3D,
  start: Point,
  end: Point,
  radius: number,
  surface: THREE.Material,
  segments = 6,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const result = cylinder(parent, radius * 0.78, radius, direction.length(), segments, surface);
  result.position.copy(from).add(to).multiplyScalar(0.5);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function triangle(parent: THREE.Object3D, a: Point, b: Point, c: Point, surface: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  return mesh(parent, geometry, surface);
}

function addFoundation(group: THREE.Group, materials: NecropolisMaterials): void {
  box(group, 3.3, 0.16, 3.1, materials.darkStone, 0, 0.08);
  box(group, 3.12, 0.1, 2.92, materials.stone, 0, 0.21);
}

function addSteps(group: THREE.Group, materials: NecropolisMaterials, front: number): void {
  box(group, 1.02, 0.18, 0.36, materials.stone, 0, FLOOR + 0.09, front + 0.12);
  box(group, 1.24, 0.12, 0.32, materials.stone, 0, FLOOR + 0.06, front + 0.37);
  box(group, 1.46, 0.08, 0.22, materials.darkStone, 0, FLOOR + 0.04, front + 0.57);
}

function addSkull(
  parent: THREE.Object3D,
  materials: NecropolisMaterials,
  x: number,
  y: number,
  z: number,
  scale = 1,
): THREE.Group {
  const skull = new THREE.Group();
  skull.position.set(x, y, z);
  skull.scale.setScalar(scale);
  parent.add(skull);
  rock(skull, 0.22, materials.bone).scale.set(1, 1.05, 0.76);
  for (const eyeX of [-0.08, 0.08]) {
    mesh(skull, new THREE.SphereGeometry(0.055, 6, 4), materials.darkStone, eyeX, 0.035, 0.145);
  }
  rock(skull, 0.035, materials.darkStone, 0, -0.055, 0.17).scale.set(0.7, 1, 0.5);
  box(skull, 0.24, 0.09, 0.15, materials.bone, 0, -0.18, 0.02);
  for (const toothX of [-0.07, 0, 0.07]) {
    box(skull, 0.035, 0.07, 0.025, materials.bone, toothX, -0.135, 0.105);
  }
  return skull;
}

function addArch(
  parent: THREE.Object3D,
  materials: NecropolisMaterials,
  radius: number,
  tube: number,
  y: number,
  z: number,
  surface = materials.bone,
): THREE.Mesh {
  return mesh(parent, new THREE.TorusGeometry(radius, tube, 6, 16, Math.PI), surface, 0, y, z);
}

function addGravestone(
  parent: THREE.Object3D,
  materials: NecropolisMaterials,
  x: number,
  z: number,
  height: number,
  rotation: number,
): void {
  const stone = new THREE.Group();
  stone.position.set(x, 0.34, z);
  stone.rotation.y = rotation;
  parent.add(stone);
  box(stone, 0.5, 0.1, 0.26, materials.darkStone, 0, 0.05);
  box(stone, 0.38, height - 0.28, 0.14, materials.stone, 0, 0.1 + (height - 0.28) / 2);
  const cap = mesh(stone, new THREE.SphereGeometry(0.19, 8, 5), materials.stone, 0, height - 0.18);
  cap.scale.z = 0.4;
  box(stone, 0.045, height * 0.34, 0.025, materials.bone, 0, height * 0.56, 0.083);
  box(stone, 0.19, 0.04, 0.025, materials.bone, 0, height * 0.61, 0.083);
}

function addBatCrest(group: THREE.Group, materials: NecropolisMaterials): void {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.12);
  shape.lineTo(-0.16, 0.28);
  shape.lineTo(-0.34, 0.18);
  shape.lineTo(-0.58, 0.34);
  shape.lineTo(-0.48, 0.02);
  shape.lineTo(-0.29, -0.12);
  shape.lineTo(-0.13, 0.01);
  shape.lineTo(0, -0.18);
  shape.lineTo(0.13, 0.01);
  shape.lineTo(0.29, -0.12);
  shape.lineTo(0.48, 0.02);
  shape.lineTo(0.58, 0.34);
  shape.lineTo(0.34, 0.18);
  shape.lineTo(0.16, 0.28);
  shape.closePath();
  mesh(group, new THREE.ShapeGeometry(shape), materials.roof, 0, 2.5, 0.96);
  addSkull(group, materials, 0, 2.53, 0.99, 0.42);
}

function buildSkeletonCrypt(group: THREE.Group, materials: NecropolisMaterials): void {
  addFoundation(group, materials);
  box(group, 2.25, 1.45, 1.85, materials.stone, 0, FLOOR + 0.725, -0.12);
  box(group, 2.38, 0.14, 1.98, materials.darkStone, 0, 1.69, -0.12);
  const roof = cone(group, 1.28, 0.8, 4, materials.roof, 0, 2.11, -0.12);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.9;

  box(group, 0.68, 1.05, 0.06, materials.roof, 0, FLOOR + 0.525, 0.835);
  box(group, 0.45, 0.88, 0.025, materials.ecto, 0, FLOOR + 0.48, 0.872);
  addArch(group, materials, 0.34, 0.075, 1.31, 0.89);
  for (const side of [-1, 1]) {
    box(group, 0.13, 1.08, 0.14, materials.bone, side * 0.405, 0.8, 0.88);
    box(group, 0.19, 0.45, 0.035, materials.ecto, side * 0.7, 1.06, 0.818);
    addArch(group, materials, 0.095, 0.035, 1.285, 0.85).position.x = side * 0.7;
    box(group, 0.3, 1.65, 0.35, materials.darkStone, side * 1.17, FLOOR + 0.825, 0.55);
    const cap = cone(group, 0.28, 0.5, 4, materials.roof, side * 1.17, 2.16, 0.55);
    cap.rotation.y = Math.PI / 4;
    rock(group, 0.09, materials.ecto, side * 1.17, 2.46, 0.55);
  }
  addSteps(group, materials, 0.84);
  addSkull(group, materials, 0, 1.87, 0.94, 1.08);

  cylinder(group, 0.045, 0.06, 0.52, 6, materials.bone, 0, 2.75, -0.12);
  box(group, 0.46, 0.065, 0.065, materials.bone, 0, 2.79, -0.12);
  for (const x of [-0.23, 0.23]) rock(group, 0.06, materials.bone, x, 2.79, -0.12);
  rock(group, 0.075, materials.ecto, 0, 3.04, -0.12);
}

function buildZombieGraveyard(group: THREE.Group, materials: NecropolisMaterials): void {
  addFoundation(group, materials);
  box(group, 3, 0.08, 2.76, materials.earth, 0, 0.3);

  for (const [x, z] of [[-0.7, 0.35], [-0.15, -0.65], [0.45, 0.45]] as const) {
    box(group, 0.62, 0.035, 1, materials.roof, x, 0.357, z);
    for (const side of [-1, 1]) {
      const mound = rock(group, 0.32, materials.earth, x + side * 0.39, 0.37, z);
      mound.scale.set(0.55, 0.24, 1.5);
    }
  }

  addGravestone(group, materials, -1.12, -0.65, 0.78, -0.18);
  addGravestone(group, materials, 0.18, -1.03, 0.65, 0.14);
  addGravestone(group, materials, 1.1, 0.63, 0.72, -0.25);
  addGravestone(group, materials, -1.12, 1.03, 0.55, 0.2);

  beam(group, [-0.7, 0.34, 0.35], [-0.66, 0.91, 0.34], 0.07, materials.undead);
  box(group, 0.18, 0.2, 0.09, materials.undead, -0.66, 0.98, 0.34).rotation.z = -0.12;
  for (let finger = 0; finger < 4; finger += 1) {
    const x = -0.735 + finger * 0.05;
    beam(group, [x, 1.04, 0.34], [x - 0.025, 1.22 - Math.abs(1.5 - finger) * 0.035, 0.35], 0.018, materials.undead, 5);
  }
  beam(group, [-0.75, 0.96, 0.34], [-0.87, 1.08, 0.36], 0.025, materials.undead, 5);

  beam(group, [0.95, 0.34, -0.7], [0.82, 1.85, -0.72], 0.15, materials.timber, 7);
  beam(group, [0.82, 1.7, -0.72], [0.68, 2.76, -0.72], 0.09, materials.timber, 7);
  beam(group, [0.8, 1.65, -0.72], [1.47, 2.47, -0.7], 0.075, materials.timber);
  beam(group, [1.18, 2.12, -0.71], [1.48, 2.18, -0.73], 0.04, materials.timber);
  beam(group, [0.78, 1.82, -0.72], [0.2, 2.35, -0.66], 0.065, materials.timber);
  beam(group, [0.43, 2.12, -0.69], [0.18, 2.63, -0.66], 0.035, materials.timber);
  beam(group, [0.7, 2.35, -0.72], [0.95, 2.84, -0.75], 0.04, materials.timber);
  rock(group, 0.105, materials.ecto, 1.36, 1.97, -0.69);

  for (const x of [-1.4, -0.7, 0, 0.7, 1.4]) {
    cylinder(group, 0.025, 0.035, 0.62, 5, materials.iron, x, 0.65, -1.38);
    cone(group, 0.06, 0.14, 4, materials.iron, x, 1.03, -1.38);
  }
  for (const y of [0.54, 0.79]) box(group, 2.86, 0.035, 0.035, materials.iron, 0, y, -1.38);
}

function buildVampireEstate(group: THREE.Group, materials: NecropolisMaterials): void {
  addFoundation(group, materials);
  box(group, 2.25, 2, 1.8, materials.darkStone, 0, FLOOR + 1, -0.05);
  box(group, 2.34, 0.12, 1.9, materials.bone, 0, 0.53, -0.05);
  box(group, 2.36, 0.12, 1.92, materials.roof, 0, 2.23, -0.05);
  const roof = cone(group, 1.28, 1, 4, materials.roof, 0, 2.76, -0.05);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.9;

  for (const side of [-1, 1]) {
    cylinder(group, 0.43, 0.48, 2.55, 8, materials.stone, side * 1.08, FLOOR + 1.275, -0.15);
    cylinder(group, 0.51, 0.51, 0.13, 8, materials.bone, side * 1.08, 2.76, -0.15);
    cone(group, 0.6, 1, 8, materials.roof, side * 1.08, 3.31, -0.15);
    cylinder(group, 0.025, 0.05, 0.48, 6, materials.iron, side * 1.08, 4.05, -0.15);
    rock(group, 0.065, materials.blood, side * 1.08, 4.32, -0.15);
    for (const y of [1.25, 2.15]) {
      box(group, 0.2, 0.54, 0.035, materials.blood, side * 1.08, y, 0.296);
      const arch = addArch(group, materials, 0.1, 0.03, y + 0.27, 0.32);
      arch.position.x = side * 1.08;
    }
    box(group, 0.22, 0.72, 0.035, materials.blood, side * 0.65, 1.45, 0.872);
    const windowArch = addArch(group, materials, 0.11, 0.035, 1.81, 0.9);
    windowArch.position.x = side * 0.65;
  }

  cone(group, 0.3, 1.05, 8, materials.roof, 0, 3.785, -0.05);
  cylinder(group, 0.02, 0.045, 0.34, 6, materials.bone, 0, 4.48, -0.05);
  rock(group, 0.075, materials.blood, 0, 4.68, -0.05);

  box(group, 0.7, 1.25, 0.07, materials.roof, 0, FLOOR + 0.625, 0.9);
  box(group, 0.43, 1.05, 0.025, materials.blood, 0, FLOOR + 0.57, 0.945);
  addArch(group, materials, 0.35, 0.07, 1.51, 0.96);
  for (const side of [-1, 1]) box(group, 0.12, 1.25, 0.13, materials.bone, side * 0.41, 0.885, 0.95);
  addSteps(group, materials, 0.91);

  box(group, 1.28, 0.12, 0.38, materials.stone, 0, 1.98, 1.02);
  for (const x of [-0.54, -0.27, 0, 0.27, 0.54]) {
    cylinder(group, 0.018, 0.018, 0.34, 5, materials.iron, x, 2.19, 1.17);
  }
  box(group, 1.18, 0.035, 0.035, materials.iron, 0, 2.36, 1.17);
  addBatCrest(group, materials);
}

function buildGhostDragonSepulcher(group: THREE.Group, materials: NecropolisMaterials): void {
  addFoundation(group, materials);
  cylinder(group, 1.28, 1.38, 0.28, 8, materials.darkStone, 0, FLOOR + 0.14);
  cylinder(group, 1.12, 1.2, 1.75, 8, materials.stone, 0, 1.415);
  cylinder(group, 1.28, 1.28, 0.14, 8, materials.bone, 0, 2.25);
  cone(group, 1.38, 1.25, 8, materials.roof, 0, 2.915);

  box(group, 0.7, 1.25, 0.08, materials.roof, 0, 1.165, 1.13);
  box(group, 0.44, 1.02, 0.025, materials.ecto, 0, 1.15, 1.183);
  addArch(group, materials, 0.35, 0.08, 1.79, 1.19);
  for (const side of [-1, 1]) {
    box(group, 0.14, 1.28, 0.15, materials.bone, side * 0.43, 1.18, 1.18);
    for (const z of [-0.9, 0.9]) {
      box(group, 0.3, 1.9, 0.3, materials.darkStone, side * 1.28, FLOOR + 0.95, z);
      const spire = cone(group, 0.25, 0.65, 4, materials.roof, side * 1.28, 2.485, z);
      spire.rotation.y = Math.PI / 4;
      rock(group, 0.085, materials.ecto, side * 1.28, 2.86, z);
    }
  }
  addSteps(group, materials, 1.01);

  const spine: Point[] = [
    [0, 3.9, -1.18],
    [0, 4.08, -0.72],
    [0, 4.22, -0.28],
    [0, 4.28, 0.18],
    [0, 4.4, 0.53],
  ];
  for (let index = 0; index < spine.length - 1; index += 1) {
    const start = spine[index];
    const end = spine[index + 1];
    if (start && end) beam(group, start, end, 0.055, materials.bone);
  }
  for (const [x, y, z] of spine) rock(group, 0.09, materials.bone, x, y, z);
  for (const z of [-0.38, -0.12, 0.14]) {
    const ribs = mesh(group, new THREE.TorusGeometry(0.28, 0.035, 5, 12, Math.PI), materials.bone, 0, 4.12, z);
    ribs.rotation.x = -0.12;
  }

  for (const side of [-1, 1]) {
    const shoulder: Point = [side * 0.22, 4.3, 0.04];
    const tip: Point = [side * 1.52, 4.92, -0.18];
    const trailing: Point = [side * 1.16, 4.02, -0.6];
    const finger: Point = [side * 1.27, 4.35, -0.66];
    beam(group, shoulder, tip, 0.05, materials.bone);
    beam(group, tip, trailing, 0.035, materials.bone);
    beam(group, shoulder, finger, 0.035, materials.bone);
    beam(group, finger, trailing, 0.025, materials.bone);
    triangle(group, shoulder, tip, finger, materials.spectral);
    triangle(group, shoulder, finger, trailing, materials.spectral);
    beam(group, [side * 0.18, 4.24, -0.28], [side * 0.42, 3.78, -0.05], 0.04, materials.bone);
    beam(group, [side * 0.42, 3.78, -0.05], [side * 0.55, 3.64, 0.16], 0.025, materials.bone);
  }

  addSkull(group, materials, 0, 4.52, 0.73, 1.42);
  for (const side of [-1, 1]) {
    cone(group, 0.075, 0.65, 6, materials.bone, side * 0.19, 4.95, 0.49);
  }
  beam(group, [0, 3.9, -1.18], [0.2, 3.7, -1.43], 0.035, materials.bone);
}

function addScaffolding(group: THREE.Group, materials: NecropolisMaterials, height: number): void {
  for (const x of [-1.35, 1.35]) {
    for (const z of [-1.2, 1.2]) {
      cylinder(group, 0.035, 0.05, height, 5, materials.timber, x, FLOOR + height / 2, z);
      cone(group, 0.065, 0.14, 4, materials.bone, x, FLOOR + height + 0.07, z);
    }
  }
  for (const z of [-1.2, 1.2]) {
    box(group, 2.76, 0.07, 0.08, materials.timber, 0, FLOOR + height * 0.78, z);
    beam(group, [-1.32, FLOOR + 0.08, z], [1.32, FLOOR + height * 0.72, z], 0.025, materials.bone, 5);
  }
  for (const x of [-1.35, 1.35]) box(group, 0.08, 0.07, 2.46, materials.timber, x, FLOOR + height * 0.78);
}

function buildUnbuilt(group: THREE.Group, materials: NecropolisMaterials, buildingId: DwellingId): void {
  addFoundation(group, materials);
  box(group, 2.94, 0.07, 2.7, materials.earth, 0, FLOOR + 0.035);
  const tier = ['skeletonCrypt', 'zombieGraveyard', 'vampireEstate', 'ghostDragonSepulcher'].indexOf(buildingId) + 1;
  addScaffolding(group, materials, 0.78 + tier * 0.12);

  if (buildingId === 'skeletonCrypt') {
    for (const side of [-1, 1]) box(group, 0.38, 0.72, 1.45, materials.stone, side * 0.7, FLOOR + 0.36, -0.2);
    box(group, 0.72, 0.3, 1.15, materials.darkStone, 0, FLOOR + 0.15, 0.15);
    addSkull(group, materials, 0, 0.82, 0.65, 0.65);
  } else if (buildingId === 'zombieGraveyard') {
    addGravestone(group, materials, -0.65, -0.35, 0.52, -0.15);
    addGravestone(group, materials, 0.45, 0.35, 0.45, 0.2);
    const mound = rock(group, 0.48, materials.earth, -0.45, 0.4, 0.65);
    mound.scale.set(1.2, 0.25, 1.35);
  } else if (buildingId === 'vampireEstate') {
    for (const x of [-0.82, 0.82]) {
      for (const z of [-0.62, 0.62]) {
        cylinder(group, 0.15, 0.2, 1.22, 8, materials.stone, x, FLOOR + 0.61, z);
        cylinder(group, 0.23, 0.23, 0.1, 8, materials.bone, x, FLOOR + 1.22, z);
      }
    }
    box(group, 1.85, 0.12, 0.14, materials.roof, 0, 1.54, -0.62);
  } else {
    cylinder(group, 1.16, 1.28, 0.28, 8, materials.darkStone, 0, FLOOR + 0.14);
    const ring = mesh(group, new THREE.TorusGeometry(0.82, 0.045, 5, 20), materials.ecto, 0, FLOOR + 0.3);
    ring.rotation.x = Math.PI / 2;
    for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]] as const) {
      cone(group, 0.13, 0.8, 4, materials.stone, x, FLOOR + 0.4, z);
    }
  }

  for (const [x, z, radius] of [[-0.95, 0.85, 0.18], [-0.7, 0.95, 0.13], [0.85, -0.9, 0.16]] as const) {
    rock(group, radius, materials.stone, x, FLOOR + radius * 0.65, z).scale.y = 0.65;
  }
}

const BUILDERS: Readonly<Record<DwellingId, (group: THREE.Group, materials: NecropolisMaterials) => void>> = {
  skeletonCrypt: buildSkeletonCrypt,
  zombieGraveyard: buildZombieGraveyard,
  vampireEstate: buildVampireEstate,
  ghostDragonSepulcher: buildGhostDragonSepulcher,
};

function createModel(buildingId: string, built: boolean): THREE.Group | null {
  if (!Object.hasOwn(BUILDERS, buildingId)) return null;
  const dwellingId = buildingId as DwellingId;
  const group = new THREE.Group();
  group.name = buildingId;
  group.userData = {
    buildingId,
    faction: 'Necropolis',
    built,
    state: built ? 'built' : 'unbuilt',
  };
  const materials = createMaterials();
  if (built) BUILDERS[dwellingId](group, materials);
  else buildUnbuilt(group, materials, dwellingId);
  return group;
}

export default {
  faction: 'Necropolis',
  createBuildingModel(buildingId: string, built: boolean): THREE.Group | null {
    return createModel(buildingId, built);
  },
};
