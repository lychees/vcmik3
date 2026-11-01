import * as THREE from 'three';

interface ArenaPalette {
  darkStone: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  sand: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  iron: THREE.MeshStandardMaterial;
  gold: THREE.MeshStandardMaterial;
  crimsonCloth: THREE.MeshStandardMaterial;
  goldCloth: THREE.MeshStandardMaterial;
}

function material(
  color: number,
  extra: THREE.MeshStandardMaterialParameters = {},
): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness: 0.86, flatShading: true, ...extra });
  result.userData.baseColor = result.color.getHex();
  return result;
}

function createPalette(): ArenaPalette {
  return {
    darkStone: material(0x75634f),
    stone: material(0xb09a76),
    sand: material(0xd6b96f),
    wood: material(0x67432d),
    iron: material(0x9ba3a0, { roughness: 0.45, metalness: 0.55 }),
    gold: material(0xd2a34d, { roughness: 0.5, metalness: 0.35 }),
    crimsonCloth: material(0x8e3f32, { roughness: 0.95, side: THREE.DoubleSide }),
    goldCloth: material(0xc59a45, { roughness: 0.95, side: THREE.DoubleSide }),
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
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
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

function addSeating(parent: THREE.Group, palette: ArenaPalette): void {
  const tiers = [
    { radius: 1.13, height: 0.2, width: 0.43 },
    { radius: 1.35, height: 0.32, width: 0.5 },
    { radius: 1.57, height: 0.44, width: 0.57 },
  ] as const;
  for (const [tierIndex, tier] of tiers.entries()) {
    for (let index = 0; index < 16; index += 1) {
      if (index >= 3 && index <= 5) continue;
      const angle = index / 16 * Math.PI * 2;
      const seat = box(parent, tier.width, tier.height, 0.22,
        tierIndex === 1 ? palette.darkStone : palette.stone,
        Math.cos(angle) * tier.radius, 0.25 + tier.height / 2, Math.sin(angle) * tier.radius);
      seat.rotation.y = Math.PI / 2 - angle;
      seat.name = `arena-seat-${tierIndex}-${index}`;
      seat.userData.feature = 'seating';
      seat.userData.tier = tierIndex + 1;
    }
  }
}

function addGate(parent: THREE.Group, palette: ArenaPalette): void {
  const gate = new THREE.Group();
  gate.name = 'arena-gate';
  gate.position.z = 1.52;
  parent.add(gate);
  for (const side of [-1, 1]) {
    const column = box(gate, 0.19, 0.92, 0.26, palette.darkStone, side * 0.49, 0.68, 0);
    column.name = side < 0 ? 'arena-gate-column-right' : 'arena-gate-column-left';
    box(gate, 0.26, 0.1, 0.32, palette.stone, side * 0.49, 1.17, 0);
    const door = box(gate, 0.31, 0.65, 0.065, palette.wood, side * 0.34, 0.55, -0.035);
    door.rotation.y = side * 0.55;
    door.name = side < 0 ? 'arena-gate-door-right' : 'arena-gate-door-left';
  }
  box(gate, 1.2, 0.18, 0.3, palette.stone, 0, 1.27, 0);
  box(gate, 0.82, 0.07, 0.32, palette.darkStone, 0, 1.39, 0);
  const crest = addMesh(gate, new THREE.OctahedronGeometry(0.14, 0), palette.gold, 0, 1.52, 0);
  crest.scale.set(1, 1.25, 0.55);
  crest.name = 'arena-gate-crest';
}

function addBanner(
  parent: THREE.Group,
  palette: ArenaPalette,
  x: number,
  z: number,
  index: number,
): void {
  const banner = new THREE.Group();
  banner.name = `arena-banner-${index}`;
  banner.position.set(x, 0.18, z);
  banner.rotation.y = -Math.atan2(z, x);
  parent.add(banner);

  cylinder(banner, 0.025, 0.04, 1.55, 7, palette.wood, 0, 0.775, 0);
  cone(banner, 0.07, 0.16, 6, palette.gold, 0, 1.63, 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 1.45, 0,
    0.42, 1.36, 0.025,
    0.42, 0.91, 0.025,
    0.22, 1.03, 0.055,
    0, 0.93, 0,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4]);
  geometry.computeVertexNormals();
  const cloth = addMesh(banner, geometry, index % 2 === 0 ? palette.crimsonCloth : palette.goldCloth);
  cloth.name = `arena-banner-cloth-${index}`;
  cloth.userData.feature = 'banner';
  const emblem = addMesh(banner, new THREE.OctahedronGeometry(0.065, 0),
    index % 2 === 0 ? palette.gold : palette.crimsonCloth, 0.22, 1.2, 0.065);
  emblem.scale.set(1, 1.35, 0.25);
  emblem.name = `arena-banner-emblem-${index}`;
  emblem.userData.feature = 'banner';
}

function addSword(parent: THREE.Group, palette: ArenaPalette, rotation: number, name: string): void {
  const sword = new THREE.Group();
  sword.name = name;
  sword.position.y = 0.345;
  sword.rotation.y = rotation;
  sword.userData.feature = 'combatWeapons';
  parent.add(sword);
  box(sword, 0.055, 0.025, 0.56, palette.iron, 0, 0, -0.06);
  const tip = cone(sword, 0.045, 0.12, 4, palette.iron, 0, 0, -0.4);
  tip.rotation.x = -Math.PI / 2;
  box(sword, 0.23, 0.035, 0.045, palette.gold, 0, 0.005, 0.23);
  box(sword, 0.05, 0.04, 0.18, palette.wood, 0, 0.005, 0.34);
}

function addCombatRing(parent: THREE.Group, palette: ArenaPalette): void {
  const ring = addMesh(parent, new THREE.TorusGeometry(0.78, 0.025, 6, 32), palette.gold, 0, 0.335, 0);
  ring.rotation.x = Math.PI / 2;
  ring.name = 'combat-ring';
  ring.userData.feature = 'combatRing';
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI / 2;
    const marker = cylinder(parent, 0.045, 0.045, 0.025, 6, palette.darkStone,
      Math.cos(angle) * 0.78, 0.34, Math.sin(angle) * 0.78);
    marker.name = `combat-ring-marker-${index}`;
    marker.userData.feature = 'combatRing';
  }
  const swords = new THREE.Group();
  swords.name = 'crossed-swords';
  parent.add(swords);
  addSword(swords, palette, Math.PI / 4, 'arena-sword-left');
  addSword(swords, palette, -Math.PI / 4, 'arena-sword-right');
}

export function createWarriorsArenaModel(): THREE.Group {
  const group = new THREE.Group();
  const palette = createPalette();
  const foundation = cylinder(group, 1.68, 1.76, 0.16, 32, palette.darkStone, 0, 0.08, 0);
  foundation.name = 'arena-foundation';
  cylinder(group, 1.61, 1.66, 0.12, 32, palette.stone, 0, 0.19, 0);
  const sands = cylinder(group, 0.98, 1.02, 0.08, 32, palette.sand, 0, 0.27, 0);
  sands.name = 'arena-sands';
  sands.userData.feature = 'sands';

  addSeating(group, palette);
  addGate(group, palette);
  const bannerPositions = [
    [-1.38, -0.9], [1.38, -0.9], [-1.38, 0.82], [1.38, 0.82],
  ] as const;
  for (const [index, [x, z]] of bannerPositions.entries()) addBanner(group, palette, x, z, index);
  addCombatRing(group, palette);

  group.name = 'warriorsArena';
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.userData.landmarkId = 'warriorsArena';
  group.userData.faction = 'Neutral';
  group.userData.animationPivot = 'ground';
  group.userData.visualHeight = size.y;
  group.userData.labelHeight = bounds.max.y + 0.45;
  group.userData.palette = [0xb09a76, 0xd6b96f, 0x8e3f32];
  return group;
}
