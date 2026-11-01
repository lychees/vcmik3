import * as THREE from 'three';

type VectorTuple = [number, number, number];

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true, ...extra });
  result.userData.baseColor = result.color.getHex();
  return result;
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: VectorTuple,
  name: string,
  rotation: VectorTuple = [0, 0, 0],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(...position);
  result.rotation.set(...rotation);
  result.name = name;
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
  position: VectorTuple,
  name: string,
): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, position, name);
}

function segment(
  parent: THREE.Object3D,
  start: VectorTuple,
  end: VectorTuple,
  radius: number,
  surface: THREE.Material,
  name: string,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const direction = new THREE.Vector3(...end).sub(from);
  const result = mesh(
    parent,
    new THREE.CylinderGeometry(radius, radius * 1.12, direction.length(), 10),
    surface,
    from.addScaledVector(direction, 0.5).toArray(),
    name,
  );
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function starGeometry(radius: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  for (let index = 0; index < 10; index += 1) {
    const angle = Math.PI / 2 + index * Math.PI / 5;
    const length = index % 2 === 0 ? radius : radius * 0.44;
    const x = Math.cos(angle) * length;
    const y = Math.sin(angle) * length;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.012, bevelEnabled: false });
}

function addTelescope(group: THREE.Group, brass: THREE.Material, dark: THREE.Material, glass: THREE.Material): void {
  const start: VectorTuple = [0.04, 1.1, 0];
  const end: VectorTuple = [0.69, 1.68, 0];
  const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start)).normalize();
  segment(group, start, end, 0.078, brass, 'observatory-telescope');
  const sleeveStart = new THREE.Vector3(...end).addScaledVector(direction, -0.28).toArray();
  segment(group, sleeveStart, end, 0.098, dark, 'observatory-telescope-sleeve');
  const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
  const rim = mesh(group, new THREE.TorusGeometry(0.103, 0.015, 6, 14), brass, end, 'observatory-telescope-rim');
  rim.quaternion.copy(orientation);
  const lensPosition = new THREE.Vector3(...end).addScaledVector(direction, 0.012).toArray();
  const lens = mesh(group, new THREE.CircleGeometry(0.088, 14), glass, lensPosition, 'observatory-telescope-lens');
  lens.quaternion.copy(orientation);
}

function addOrrery(group: THREE.Group, brass: THREE.Material, glow: THREE.Material): void {
  const center: VectorTuple = [-0.53, 1.01, 0.12];
  cylinder(group, 0.12, 0.15, 0.18, 8, brass, [-0.53, 0.23, 0.12], 'observatory-orrery-pedestal');
  cylinder(group, 0.022, 0.032, 0.55, 7, brass, [-0.53, 0.585, 0.12], 'observatory-orrery-stem');
  const rotations: VectorTuple[] = [[Math.PI / 2, 0, 0], [0.45, 0.7, 0.2], [-0.55, 0.25, 0.8]];
  rotations.forEach((rotation, index) => {
    mesh(group, new THREE.TorusGeometry(0.17, 0.012, 5, 20), brass, center, `observatory-orrery-ring-${index}`, rotation);
  });
  mesh(group, new THREE.IcosahedronGeometry(0.058, 1), glow, center, 'observatory-orrery-sun');
  mesh(group, new THREE.SphereGeometry(0.035, 8, 6), glow, [-0.36, 1.07, 0.12], 'observatory-orrery-moon');
}

export function createAncientObservatoryModel(): THREE.Group {
  const group = new THREE.Group();
  const stone = material(0x87959f);
  const trim = material(0xb5c0c2);
  const dark = material(0x293542);
  const roof = material(0x465d82, { metalness: 0.22, roughness: 0.58, side: THREE.DoubleSide });
  const brass = material(0xd4b66a, { metalness: 0.55, roughness: 0.4 });
  const glow = material(0x9edfe8, { emissive: 0x397c91, emissiveIntensity: 0.65 });
  const glass = material(0x8ce8e2, {
    emissive: 0x2b7f86,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  });

  cylinder(group, 0.7, 0.74, 0.14, 12, dark, [0, 0.07, 0], 'ancient-observatory-base');
  cylinder(group, 0.58, 0.64, 0.1, 12, trim, [0, 0.17, 0], 'observatory-foundation');
  cylinder(group, 0.38, 0.43, 0.76, 12, stone, [0, 0.56, 0], 'observatory-tower');
  cylinder(group, 0.45, 0.45, 0.09, 16, brass, [0, 0.94, 0], 'observatory-dome-ring');
  mesh(
    group,
    new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    roof,
    [0, 0.96, 0],
    'observatory-dome',
  );

  for (const [x, z] of [[0.32, 0.32], [-0.32, 0.32], [0.32, -0.32], [-0.32, -0.32]] as const) {
    cylinder(group, 0.04, 0.06, 0.68, 7, trim, [x, 0.51, z], `observatory-buttress-${x}-${z}`);
  }
  mesh(group, new THREE.BoxGeometry(0.2, 0.34, 0.045), dark, [0, 0.37, 0.414], 'observatory-door');
  mesh(group, new THREE.TorusGeometry(0.1, 0.025, 5, 12, Math.PI), brass, [0, 0.54, 0.42], 'observatory-door-arch');
  for (const x of [-0.22, 0.22]) {
    mesh(group, new THREE.BoxGeometry(0.085, 0.18, 0.025), glow, [x, 0.69, 0.365], `observatory-window-${x}`);
  }
  mesh(group, new THREE.BoxGeometry(0.38, 0.08, 0.22), stone, [0, 0.04, 0.67], 'observatory-step-lower');
  mesh(group, new THREE.BoxGeometry(0.3, 0.08, 0.18), trim, [0, 0.12, 0.56], 'observatory-step-upper');

  mesh(group, new THREE.BoxGeometry(0.025, 0.42, 0.12), dark, [0.365, 1.19, 0], 'observatory-dome-slit', [0, 0, -0.48]);
  for (const z of [-0.085, 0.085]) {
    mesh(group, new THREE.BoxGeometry(0.025, 0.44, 0.018), brass, [0.37, 1.19, z], `observatory-slit-rail-${z}`, [0, 0, -0.48]);
  }
  addTelescope(group, brass, dark, glass);
  addOrrery(group, brass, glow);

  [-0.18, 0, 0.18].forEach((x, index) => {
    mesh(group, starGeometry(index === 1 ? 0.075 : 0.055), brass, [x, 0.79, 0.397], `observatory-star-${index}`);
  });
  mesh(group, new THREE.TorusGeometry(0.1, 0.018, 5, 18, Math.PI * 1.45), glow, [-0.11, 1.45, -0.16], 'observatory-crescent', [0, 0.3, 0.45]);

  group.name = 'ancientObservatory';
  const bounds = new THREE.Box3().setFromObject(group);
  group.userData.landmarkId = 'ancientObservatory';
  group.userData.kind = 'landmark';
  group.userData.objectKind = 'landmark';
  group.userData.animationPivot = 'ground';
  group.userData.visualHeight = bounds.getSize(new THREE.Vector3()).y;
  group.userData.labelHeight = bounds.max.y + 0.45;
  group.userData.palette = [0x87959f, 0xd4b66a, 0x9edfe8];
  return group;
}
