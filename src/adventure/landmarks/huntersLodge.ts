import * as THREE from 'three';

function material(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.86, ...extra });
  result.userData.baseColor = result.color.getHex();
  return result;
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(...position);
  result.rotation.set(...rotation);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function box(
  parent: THREE.Object3D,
  size: [number, number, number],
  surface: THREE.Material,
  position: [number, number, number],
): THREE.Mesh {
  return mesh(parent, new THREE.BoxGeometry(...size), surface, position);
}

function cylinder(
  parent: THREE.Object3D,
  top: number,
  bottom: number,
  height: number,
  surface: THREE.Material,
  position: [number, number, number],
  segments = 7,
): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, position);
}

function cone(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  surface: THREE.Material,
  position: [number, number, number],
  segments = 7,
): THREE.Mesh {
  return mesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, position);
}

function branch(
  parent: THREE.Object3D,
  start: [number, number, number],
  end: [number, number, number],
  radius: number,
  surface: THREE.Material,
  name: string,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const result = mesh(parent, new THREE.CylinderGeometry(radius * 0.75, radius, direction.length(), 5), surface, [0, 0, 0]);
  result.position.copy(from.add(to).multiplyScalar(0.5));
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  result.name = name;
  return result;
}

function addPelt(parent: THREE.Object3D, x: number, surface: THREE.Material, name: string): void {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.2);
  shape.lineTo(-0.12, 0.17);
  shape.lineTo(-0.2, 0.08);
  shape.lineTo(-0.13, 0);
  shape.lineTo(-0.18, -0.16);
  shape.lineTo(-0.06, -0.12);
  shape.lineTo(0, -0.22);
  shape.lineTo(0.06, -0.12);
  shape.lineTo(0.18, -0.16);
  shape.lineTo(0.13, 0);
  shape.lineTo(0.2, 0.08);
  shape.lineTo(0.12, 0.17);
  shape.closePath();
  const pelt = mesh(parent, new THREE.ShapeGeometry(shape), surface, [x, 0.33, 0.452]);
  pelt.scale.setScalar(0.62);
  pelt.name = name;
  pelt.userData.detail = 'pelt';
}

export function createHuntersLodgeModel(): THREE.Group {
  const group = new THREE.Group();
  const stone = material(0x777367);
  const timber = material(0x765034);
  const darkTimber = material(0x3f3025);
  const cutWood = material(0xb78a55);
  const roof = material(0x3e5941);
  const door = material(0x2e2923);
  const antler = material(0xd4c39d);
  const hide = material(0x9b673f, { side: THREE.DoubleSide });
  const hideLight = material(0xc09968, { side: THREE.DoubleSide });
  const pine = material(0x35543a);
  const pineLight = material(0x4b6c45);
  const windowGlow = material(0xe1b86a, { emissive: 0x8a541f, emissiveIntensity: 0.55 });

  box(group, [1.32, 0.12, 1.1], stone, [0, 0.06, 0]).name = 'lodge-foundation';
  box(group, [1.12, 0.68, 0.82], timber, [0, 0.46, 0]).name = 'lodge-timber-walls';

  const leftRoof = box(group, [0.82, 0.09, 1.14], roof, [-0.32, 1.0, 0]);
  leftRoof.rotation.z = 0.58;
  leftRoof.name = 'lodge-roof-left';
  const rightRoof = box(group, [0.82, 0.09, 1.14], roof, [0.32, 1.0, 0]);
  rightRoof.rotation.z = -0.58;
  rightRoof.name = 'lodge-roof-right';
  box(group, [0.18, 0.52, 0.18], stone, [-0.34, 1.18, -0.2]).name = 'lodge-chimney';
  box(group, [0.24, 0.08, 0.24], darkTimber, [-0.34, 1.46, -0.2]).name = 'lodge-chimney-cap';

  for (const x of [-0.54, 0.54]) {
    for (const z of [-0.4, 0.4]) {
      cylinder(group, 0.05, 0.06, 0.7, darkTimber, [x, 0.47, z], 6).name = 'lodge-timber-post';
    }
  }
  for (const z of [-0.43, 0.43]) {
    for (const y of [0.18, 0.77]) {
      const beam = cylinder(group, 0.045, 0.045, 1.13, darkTimber, [0, y, z], 6);
      beam.rotation.z = Math.PI / 2;
      beam.name = 'lodge-timber-beam';
    }
  }

  box(group, [0.26, 0.48, 0.05], door, [0, 0.36, 0.435]).name = 'lodge-door';
  mesh(group, new THREE.SphereGeometry(0.025, 6, 4), cutWood, [0.085, 0.36, 0.47]).name = 'lodge-door-latch';
  for (const x of [-0.34, 0.34]) {
    box(group, [0.18, 0.19, 0.025], windowGlow, [x, 0.59, 0.43]).name = 'lodge-window';
    box(group, [0.025, 0.2, 0.035], darkTimber, [x, 0.59, 0.45]).name = 'lodge-window-frame';
    box(group, [0.19, 0.025, 0.035], darkTimber, [x, 0.59, 0.45]).name = 'lodge-window-frame';
  }

  for (let index = 0; index < 4; index += 1) {
    box(group, [0.5, 0.045, 0.09], cutWood, [0, 0.145, 0.5 + index * 0.1]).name = 'lodge-porch-plank';
  }
  box(group, [0.42, 0.12, 0.18], darkTimber, [0, 0.06, 0.82]).name = 'lodge-porch-step';

  const plaque = cylinder(group, 0.14, 0.14, 0.04, darkTimber, [0, 0.79, 0.59], 10);
  plaque.rotation.x = Math.PI / 2;
  plaque.name = 'lodge-trophy-plaque';
  mesh(group, new THREE.DodecahedronGeometry(0.085, 0), antler, [0, 0.79, 0.63])
    .name = 'lodge-trophy-skull';
  for (const side of [-1, 1]) {
    branch(group, [side * 0.04, 0.83, 0.63], [side * 0.16, 1.0, 0.63], 0.018, antler, 'lodge-trophy-antler');
    branch(group, [side * 0.12, 0.94, 0.63], [side * 0.23, 1.02, 0.63], 0.014, antler, 'lodge-trophy-antler-tine');
    branch(group, [side * 0.15, 0.98, 0.63], [side * 0.15, 1.1, 0.63], 0.012, antler, 'lodge-trophy-antler-tine');
  }

  addPelt(group, -0.34, hide, 'lodge-pelt-left');
  addPelt(group, 0.34, hideLight, 'lodge-pelt-right');

  for (const [x, y, z] of [[-0.85, 0.075, -0.05], [-0.7, 0.075, -0.05], [-0.775, 0.205, -0.05]] as const) {
    const log = cylinder(group, 0.07, 0.07, 0.42, darkTimber, [x, y, z], 8);
    log.rotation.x = Math.PI / 2;
    log.name = 'lodge-firewood-log';
    const cutEnd = cylinder(group, 0.058, 0.058, 0.012, cutWood, [x, y, z + 0.216], 8);
    cutEnd.rotation.x = Math.PI / 2;
    cutEnd.name = 'lodge-firewood-cut-end';
  }

  cylinder(group, 0.045, 0.065, 0.5, darkTimber, [0.82, 0.25, -0.35], 6).name = 'lodge-pine-trunk';
  cone(group, 0.28, 0.55, pine, [0.82, 0.48, -0.35], 7).name = 'lodge-pine-foliage-lower';
  cone(group, 0.22, 0.55, pineLight, [0.82, 0.75, -0.35], 7).name = 'lodge-pine-foliage-middle';
  cone(group, 0.15, 0.45, pine, [0.82, 1.0, -0.35], 7).name = 'lodge-pine-foliage-top';

  group.name = 'huntersLodge';
  group.userData.landmarkId = 'huntersLodge';
  group.userData.kind = 'landmark';
  group.userData.animationPivot = 'ground';
  return group;
}
