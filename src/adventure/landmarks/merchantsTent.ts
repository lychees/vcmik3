import * as THREE from 'three';

function material(
  color: number,
  extra: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.82, ...extra });
  result.userData.baseColor = result.color.getHex();
  return result;
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: [number, number, number],
  scale: [number, number, number] = [1, 1, 1],
  rotation: [number, number, number] = [0, 0, 0],
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

function addSegment(
  parent: THREE.Object3D,
  start: [number, number, number],
  end: [number, number, number],
  radius: number,
  surface: THREE.Material,
  name?: string,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const result = addMesh(
    parent,
    new THREE.CylinderGeometry(radius, radius, direction.length(), 6),
    surface,
    from.add(to).multiplyScalar(0.5).toArray(),
    [1, 1, 1],
    [0, 0, 0],
    name,
  );
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function addPart(parent: THREE.Group, name: string): THREE.Group {
  const part = new THREE.Group();
  part.name = name;
  parent.add(part);
  return part;
}

function addCanopyPanel(
  parent: THREE.Group,
  side: number,
  z0: number,
  z1: number,
  surface: THREE.Material,
): void {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 1.52, z0,
    side * 0.9, 1.02, z0,
    side * 0.9, 1.02, z1,
    0, 1.52, z0,
    side * 0.9, 1.02, z1,
    0, 1.52, z1,
  ], 3));
  geometry.computeVertexNormals();
  addMesh(parent, geometry, surface, [0, 0, 0], [1, 1, 1], [0, 0, 0], 'canopy-roof-panel');
}

function addCanopy(group: THREE.Group, cloth: THREE.Material, stripe: THREE.Material): void {
  const canopy = addPart(group, 'merchant-canopy');
  const depth = 1.28;
  const panels = 8;
  for (const side of [-1, 1]) {
    for (let index = 0; index < panels; index += 1) {
      const z0 = -depth / 2 + index * depth / panels;
      const z1 = -depth / 2 + (index + 1) * depth / panels;
      addCanopyPanel(canopy, side, z0, z1, index % 2 === 0 ? cloth : stripe);
      addMesh(canopy, new THREE.BoxGeometry(0.045, 0.15, depth / panels), index % 2 === 0 ? cloth : stripe,
        [side * 0.9, 0.955, (z0 + z1) / 2], [1, 1, 1], [0, 0, 0], 'canopy-valance');
    }
  }
  for (const z of [-0.64, 0.64]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 1.52, z,
      -0.9, 1.02, z,
      0.9, 1.02, z,
    ], 3));
    geometry.computeVertexNormals();
    addMesh(canopy, geometry, cloth, [0, 0, 0], [1, 1, 1], [0, 0, 0], 'canopy-gable');
  }
  for (let index = 0; index < panels; index += 1) {
    addMesh(canopy, new THREE.BoxGeometry(1.8 / panels, 0.13, 0.035), index % 2 === 0 ? stripe : cloth,
      [-0.9 + (index + 0.5) * 1.8 / panels, 0.96, 0.655], [1, 1, 1], [0, 0, 0], 'canopy-valance');
  }
}

function addCrate(parent: THREE.Group, position: [number, number, number], timber: THREE.Material, slat: THREE.Material): void {
  const crate = new THREE.Group();
  crate.position.set(...position);
  crate.name = 'merchant-crate';
  parent.add(crate);
  addMesh(crate, new THREE.BoxGeometry(0.42, 0.36, 0.38), timber, [0, 0.18, 0]);
  for (const y of [0.055, 0.305]) {
    addMesh(crate, new THREE.BoxGeometry(0.45, 0.045, 0.405), slat, [0, y, 0]);
  }
  for (const x of [-0.17, 0.17]) {
    addMesh(crate, new THREE.BoxGeometry(0.04, 0.34, 0.405), slat, [x, 0.18, 0]);
  }
  addMesh(crate, new THREE.BoxGeometry(0.04, 0.36, 0.025), slat, [0, 0.2, 0.205], [1, 1, 1], [0, 0, 0.67]);
  addMesh(crate, new THREE.BoxGeometry(0.04, 0.36, 0.025), slat, [0, 0.2, 0.205], [1, 1, 1], [0, 0, -0.67]);
}

function addScales(group: THREE.Group, brass: THREE.Material): void {
  const scales = addPart(group, 'merchant-scales');
  const z = 0.32;
  addMesh(scales, new THREE.CylinderGeometry(0.11, 0.13, 0.035, 10), brass, [0.34, 0.679, z], [1, 1, 1], [0, 0, 0], 'scales-base');
  addMesh(scales, new THREE.CylinderGeometry(0.018, 0.026, 0.36, 8), brass, [0.34, 0.86, z], [1, 1, 1], [0, 0, 0], 'scales-column');
  addSegment(scales, [0.14, 1.03, z], [0.54, 1.03, z], 0.014, brass, 'scales-beam');
  addMesh(scales, new THREE.OctahedronGeometry(0.04, 0), brass, [0.34, 1.075, z], [1, 1, 1], [0, 0, 0], 'scales-finial');
  for (const x of [0.17, 0.51]) {
    for (const side of [-1, 1]) {
      addSegment(scales, [x, 1.02, z], [x, 0.805, z + side * 0.075], 0.006, brass, 'scales-chain');
    }
    addMesh(scales, new THREE.CylinderGeometry(0.105, 0.075, 0.028, 12), brass, [x, 0.792, z], [1, 1, 1], [0, 0, 0], 'scales-pan');
  }
}

function addTradeGoods(group: THREE.Group): void {
  const goods = addPart(group, 'merchant-trade-goods');
  const gold = material(0xe2bb55, { metalness: 0.65, roughness: 0.38 });
  const gem = material(0x65b8ad, { metalness: 0.12, roughness: 0.35 });
  const jar = material(0x9b653f);
  const cork = material(0x57422f);
  const cloth = material(0x657e9e);
  const produce = material(0xb95d45);

  for (let stack = 0; stack < 3; stack += 1) {
    for (let index = 0; index < 3 - stack; index += 1) {
      addMesh(goods, new THREE.CylinderGeometry(0.05, 0.05, 0.017, 10), gold,
        [-0.35 + stack * 0.12, 0.67 + index * 0.018, 0.32], [1, 1, 1], [0, 0, 0], 'trade-coins');
    }
  }
  for (const [x, z, scale] of [[-0.12, 0.31, 1], [-0.03, 0.37, 0.75], [-0.02, 0.25, 0.65]] as const) {
    addMesh(goods, new THREE.OctahedronGeometry(0.065, 0), gem, [x, 0.72, z], [scale, scale * 1.35, scale], [0, 0.3, 0], 'trade-gems');
  }
  addMesh(goods, new THREE.CylinderGeometry(0.065, 0.085, 0.17, 8), jar, [0.06, 0.746, 0.47], [1, 1, 1], [0, 0, 0], 'trade-jar');
  addMesh(goods, new THREE.CylinderGeometry(0.04, 0.045, 0.045, 8), cork, [0.06, 0.853, 0.47]);
  addMesh(goods, new THREE.CylinderGeometry(0.08, 0.08, 0.36, 8), cloth, [0.79, 0.43, -0.08], [1, 1, 1], [0, 0, Math.PI / 2], 'trade-cloth');
  for (let index = 0; index < 5; index += 1) {
    addMesh(goods, new THREE.DodecahedronGeometry(0.065, 0), produce,
      [-1.04 + (index % 3) * 0.09, 0.405 + Math.floor(index / 3) * 0.07, 0.24 + (index % 2) * 0.07],
      [1, 0.9, 1], [0, index * 0.4, 0], 'trade-produce');
  }
}

export function createMerchantsTentModel(): THREE.Group {
  const group = new THREE.Group();
  const timber = material(0x65462f);
  const slat = material(0x987047);
  const crateWood = material(0x795536);
  const cloth = material(0xb85b4d, { side: THREE.DoubleSide, roughness: 0.92 });
  const stripe = material(0xe1cf9f, { side: THREE.DoubleSide, roughness: 0.92 });
  const rope = material(0x9a855d);
  const brass = material(0xc9a64f, { metalness: 0.65, roughness: 0.4 });
  const rug = material(0x586d64);

  addMesh(group, new THREE.BoxGeometry(1.82, 0.04, 1.36), rug, [0, 0.02, 0], [1, 1, 1], [0, 0, 0], 'merchant-rug');
  for (const x of [-0.82, 0.82]) {
    for (const z of [-0.55, 0.55]) {
      addMesh(group, new THREE.CylinderGeometry(0.032, 0.045, 1.12, 7), timber, [x, 0.56, z], [1, 1, 1], [0, 0, 0], 'tent-pole');
      addMesh(group, new THREE.ConeGeometry(0.055, 0.14, 6), brass, [x, 1.17, z], [1, 1, 1], [0, 0, 0], 'tent-finial');
    }
  }
  addMesh(group, new THREE.CylinderGeometry(0.025, 0.04, 1.52, 7), timber, [0, 0.76, -0.57], [1, 1, 1], [0, 0, 0], 'tent-ridge-pole');
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      addSegment(group, [x * 0.87, 1.01, z * 0.54], [x * 1.13, 0.06, z * 0.77], 0.008, rope, 'tent-guy-rope');
      addMesh(group, new THREE.CylinderGeometry(0.015, 0.022, 0.2, 6), timber,
        [x * 1.13, 0.08, z * 0.77], [1, 1, 1], [0, 0, x * 0.2], 'tent-stake');
    }
  }

  addCanopy(group, cloth, stripe);
  addMesh(group, new THREE.BoxGeometry(0.98, 0.08, 0.36), slat, [0, 0.62, 0.34], [1, 1, 1], [0, 0, 0], 'merchant-counter');
  for (const x of [-0.4, 0.4]) {
    for (const z of [0.22, 0.45]) {
      addMesh(group, new THREE.BoxGeometry(0.065, 0.58, 0.065), timber, [x, 0.31, z], [1, 1, 1], [0, 0, 0], 'counter-leg');
    }
  }

  const crates = addPart(group, 'merchant-crates');
  addCrate(crates, [-0.94, 0, 0.25], crateWood, slat);
  addCrate(crates, [0.88, 0, -0.12], crateWood, slat);
  addScales(group, brass);
  addTradeGoods(group);

  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.name = 'merchantsTent';
  group.userData.landmarkId = 'merchantsTent';
  group.userData.animationPivot = 'ground';
  group.userData.visualHeight = size.y;
  group.userData.labelHeight = bounds.max.y + 0.45;
  return group;
}
