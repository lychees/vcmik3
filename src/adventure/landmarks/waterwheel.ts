import * as THREE from 'three';

type Vec3 = [number, number, number];

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.82, ...extra });
  result.userData.baseColor = result.color.getHex();
  return result;
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: Vec3,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(...position);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function box(
  parent: THREE.Object3D,
  size: Vec3,
  surface: THREE.Material,
  position: Vec3,
): THREE.Mesh {
  return mesh(parent, new THREE.BoxGeometry(...size), surface, position);
}

function cylinder(
  parent: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  surface: THREE.Material,
  position: Vec3,
  segments = 8,
): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, position);
}

function segment(
  parent: THREE.Object3D,
  start: Vec3,
  end: Vec3,
  radius: number,
  surface: THREE.Material,
  name?: string,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const direction = new THREE.Vector3(...end).sub(from);
  const midpoint = from.clone().addScaledVector(direction, 0.5);
  const result = mesh(parent, new THREE.CylinderGeometry(radius, radius, direction.length(), 6), surface, midpoint.toArray());
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  if (name) result.name = name;
  return result;
}

function addMill(root: THREE.Group): void {
  const mill = new THREE.Group();
  mill.name = 'waterwheel-mill';
  mill.position.x = -0.38;
  root.add(mill);

  const stone = material(0x9b9682);
  const plaster = material(0xc2b998);
  const timber = material(0x5c4030);
  const roof = material(0x426f72);
  const dark = material(0x302e2a);
  const window = material(0xe4c879, { emissive: 0x80652d, emissiveIntensity: 0.35 });

  box(mill, [0.84, 0.16, 0.8], stone, [0, 0.08, 0]).name = 'waterwheel-mill-foundation';
  box(mill, [0.7, 0.7, 0.66], plaster, [0, 0.47, 0]).name = 'waterwheel-mill-body';
  const roofMesh = mesh(mill, new THREE.ConeGeometry(0.57, 0.45, 4), roof, [0, 1.045, 0]);
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.name = 'waterwheel-mill-roof';
  box(mill, [0.13, 0.47, 0.14], stone, [-0.18, 1.16, -0.15]).name = 'waterwheel-mill-chimney';
  box(mill, [0.18, 0.36, 0.035], dark, [0, 0.3, 0.348]).name = 'waterwheel-mill-door';
  box(mill, [0.025, 0.26, 0.04], timber, [0.065, 0.3, 0.37]);
  for (const x of [-0.29, 0.29]) {
    box(mill, [0.055, 0.7, 0.055], timber, [x, 0.47, 0.33]);
    box(mill, [0.055, 0.7, 0.055], timber, [x, 0.47, -0.33]);
  }
  box(mill, [0.65, 0.055, 0.055], timber, [0, 0.72, 0.33]);
  box(mill, [0.65, 0.055, 0.055], timber, [0, 0.22, 0.33]);
  for (const x of [-0.22, 0.22]) {
    box(mill, [0.13, 0.17, 0.025], window, [x, 0.56, 0.344]).name = `waterwheel-mill-window-${x < 0 ? 'left' : 'right'}`;
    box(mill, [0.015, 0.17, 0.032], timber, [x, 0.56, 0.36]);
    box(mill, [0.13, 0.015, 0.032], timber, [x, 0.56, 0.36]);
  }
  const brace = box(mill, [0.045, 0.42, 0.045], timber, [-0.18, 0.46, 0.35]);
  brace.rotation.z = -0.55;
  const oppositeBrace = box(mill, [0.045, 0.42, 0.045], timber, [0.18, 0.46, 0.35]);
  oppositeBrace.rotation.z = 0.55;
}

function addWheel(root: THREE.Group): void {
  const timber = material(0x66452e);
  const paddleWood = material(0x89613c);
  const iron = material(0x39474a, { metalness: 0.55, roughness: 0.5 });
  const mount = new THREE.Group();
  mount.name = 'waterwheel-wheel-mount';
  mount.position.set(0.43, 0.56, 0);
  mount.rotation.y = Math.PI / 2;
  root.add(mount);
  const wheel = new THREE.Group();
  wheel.name = 'waterwheel-wheel';
  wheel.userData.animationAxis = 'z';
  mount.add(wheel);

  const rimGeometry = new THREE.TorusGeometry(0.47, 0.035, 6, 24);
  for (const z of [-0.1, 0.1]) {
    mesh(wheel, rimGeometry, timber, [0, 0, z]).name = `waterwheel-wheel-rim-${z < 0 ? 'back' : 'front'}`;
  }
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    segment(
      wheel,
      [0, 0, index % 2 === 0 ? -0.1 : 0.1],
      [Math.sin(angle) * 0.45, Math.cos(angle) * 0.45, index % 2 === 0 ? -0.1 : 0.1],
      0.026,
      timber,
      `waterwheel-spoke-${index}`,
    );
  }
  const paddleGeometry = new THREE.BoxGeometry(0.15, 0.25, 0.29);
  for (let index = 0; index < 12; index += 1) {
    const angle = index * Math.PI / 6;
    const paddle = mesh(wheel, paddleGeometry, paddleWood, [Math.sin(angle) * 0.41, Math.cos(angle) * 0.41, 0]);
    paddle.rotation.z = -angle;
    paddle.name = `waterwheel-paddle-${index}`;
    paddle.userData.anatomy = 'paddle';
  }
  const hub = cylinder(wheel, 0.09, 0.09, 0.34, iron, [0, 0, 0], 10);
  hub.rotation.x = Math.PI / 2;
  hub.name = 'waterwheel-wheel-hub';

  const axle = cylinder(root, 0.048, 0.048, 0.78, iron, [0.35, 0.56, 0], 10);
  axle.rotation.z = Math.PI / 2;
  axle.name = 'waterwheel-axle';
  box(root, [0.09, 0.5, 0.13], timber, [0.74, 0.32, 0]).name = 'waterwheel-axle-support';
  segment(root, [0.74, 0.08, -0.25], [0.74, 0.54, 0], 0.04, timber, 'waterwheel-support-brace-back');
  segment(root, [0.74, 0.08, 0.25], [0.74, 0.54, 0], 0.04, timber, 'waterwheel-support-brace-front');
}

function addWater(root: THREE.Group): void {
  const water = material(0x3b91a5, {
    transparent: true,
    opacity: 0.76,
    roughness: 0.28,
    metalness: 0.08,
    depthWrite: false,
  });
  const foam = material(0xb9e1d8, { emissive: 0x477d77, emissiveIntensity: 0.25 });
  const bank = material(0x747b6c);
  box(root, [0.46, 0.04, 1.8], water, [0.43, 0.02, 0.18]).name = 'waterwheel-water';
  for (const x of [0.15, 0.71]) {
    box(root, [0.09, 0.08, 1.85], bank, [x, 0.04, 0.18]).name = `waterwheel-bank-${x < 0.43 ? 'left' : 'right'}`;
  }
  for (let index = 0; index < 7; index += 1) {
    const froth = mesh(
      root,
      new THREE.IcosahedronGeometry(0.045 + (index % 2) * 0.012, 0),
      foam,
      [0.29 + (index % 3) * 0.13, 0.055, -0.18 + index * 0.095],
    );
    froth.scale.set(1.35, 0.3, 0.8);
    froth.name = `waterwheel-foam-${index}`;
  }
}

export function createWaterwheelModel(): THREE.Group {
  const group = new THREE.Group();
  addMill(group);
  addWheel(group);
  addWater(group);
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.name = 'waterwheel';
  group.userData.landmarkId = 'waterwheel';
  group.userData.animationPivot = 'ground';
  group.userData.visualHeight = size.y;
  group.userData.labelHeight = Math.max(1.85, bounds.max.y + 0.45);
  group.userData.palette = [0xc2b998, 0x426f72, 0x3b91a5];
  return group;
}
