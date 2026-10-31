import * as THREE from 'three';

export interface HotaFactionPalette {
  wall: number;
  roof: number;
  accent: number;
  ground: number;
}

export const HOTA_TOWN_IDS: Readonly<Record<string, string>> = Object.freeze({
  Tower: 'tower',
  Necropolis: 'necropolis',
  Dungeon: 'dungeon',
  Stronghold: 'stronghold',
  Conflux: 'conflux',
  Cove: 'cove',
  Factory: 'factory',
  Bulwark: 'bulwark',
  Courtyard: 'courtyard',
});

export const HOTA_FACTION_PALETTES: Readonly<Record<string, HotaFactionPalette>> = Object.freeze({
  Tower: { wall: 0xb8c4c5, roof: 0x4e6f99, accent: 0xe4cc79, ground: 0x80b8d0 },
  Necropolis: { wall: 0x666b68, roof: 0x353a42, accent: 0x8fc4a1, ground: 0x7ba58c },
  Dungeon: { wall: 0x554c5d, roof: 0x332f42, accent: 0xb37cc2, ground: 0xa477bb },
  Stronghold: { wall: 0x806348, roof: 0x514237, accent: 0xc9a467, ground: 0xc3905d },
  Conflux: { wall: 0x789b9e, roof: 0x57678f, accent: 0xb9e6da, ground: 0x88d7cc },
  Cove: { wall: 0x8d8067, roof: 0x386b78, accent: 0xd8c589, ground: 0x65b7c1 },
  Factory: { wall: 0x8a6d55, roof: 0x4e595b, accent: 0xd39a50, ground: 0xc28c50 },
  Bulwark: { wall: 0x6d704f, roof: 0x47543e, accent: 0xc2a766, ground: 0x9dac68 },
  Courtyard: { wall: 0xd0bdab, roof: 0x78546f, accent: 0xe2c776, ground: 0xd2a6c1 },
});

function material(color: number, roughness = 0.82, metalness = 0): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  result.userData.baseColor = result.color.getHex();
  return result;
}

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, surface: THREE.Material,
  x = 0, y = 0, z = 0): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(x, y, z);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function cylinder(parent: THREE.Object3D, top: number, bottom: number, height: number, segments: number,
  surface: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, x, y, z);
}

function box(parent: THREE.Object3D, width: number, height: number, depth: number, surface: THREE.Material,
  x = 0, y = 0, z = 0): THREE.Mesh {
  return mesh(parent, new THREE.BoxGeometry(width, height, depth), surface, x, y, z);
}

function cone(parent: THREE.Object3D, radius: number, height: number, segments: number, surface: THREE.Material,
  x = 0, y = 0, z = 0): THREE.Mesh {
  return mesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, x, y, z);
}

function glow(color: number): THREE.MeshStandardMaterial {
  const result = material(color, 0.38);
  result.emissive.setHex(color);
  result.emissiveIntensity = 0.4;
  return result;
}

function addTower(group: THREE.Group): void {
  const stone = material(0xb8c4c5);
  const trim = material(0x82979e);
  const roof = material(0x4e6f99);
  const gold = material(0xe4cc79, 0.4, 0.35);
  cylinder(group, 0.58, 0.63, 0.14, 10, trim, 0, 0.07, 0);
  cylinder(group, 0.27, 0.34, 0.92, 10, stone, 0, 0.59, 0);
  cone(group, 0.39, 0.53, 10, roof, 0, 1.31, 0);
  for (const [x, z, height] of [[-0.37, -0.24, 0.63], [0.37, -0.24, 0.78], [0, 0.38, 0.54]] as const) {
    cylinder(group, 0.11, 0.15, height, 8, stone, x, height / 2 + 0.13, z);
    cone(group, 0.2, 0.38, 8, roof, x, height + 0.3, z);
    mesh(group, new THREE.OctahedronGeometry(0.055, 0), gold, x, height + 0.53, z);
  }
  box(group, 0.14, 0.3, 0.035, material(0x37434b), 0, 0.28, 0.32);
  for (const y of [0.63, 0.9]) box(group, 0.08, 0.13, 0.025, glow(0x8ed5df), 0, y, 0.286);
  mesh(group, new THREE.TorusGeometry(0.2, 0.025, 4, 12), gold, 0, 1.07, 0).rotation.x = Math.PI / 2;
}

function addNecropolis(group: THREE.Group): void {
  const stone = material(0x666b68);
  const dark = material(0x353a42);
  const bone = material(0xa7aa98);
  const ecto = glow(0x8fc4a1);
  cylinder(group, 0.6, 0.64, 0.13, 8, dark, 0, 0.065, 0);
  box(group, 0.67, 0.48, 0.54, stone, 0, 0.34, 0);
  const roof = cone(group, 0.51, 0.44, 4, dark, 0, 0.8, 0);
  roof.rotation.y = Math.PI / 4;
  box(group, 0.23, 0.39, 0.04, dark, 0, 0.28, 0.291);
  mesh(group, new THREE.TorusGeometry(0.115, 0.035, 5, 10, Math.PI), bone, 0, 0.47, 0.3);
  for (const [x, z, height] of [[-0.4, -0.25, 0.83], [0.4, -0.25, 0.67], [-0.4, 0.27, 0.48], [0.4, 0.27, 0.54]] as const) {
    cylinder(group, 0.025, 0.14, height, 4, dark, x, height / 2 + 0.12, z);
    mesh(group, new THREE.OctahedronGeometry(0.06, 0), ecto, x, height + 0.17, z);
  }
  for (const x of [-0.2, 0.2]) box(group, 0.06, 0.18, 0.025, ecto, x, 0.48, 0.282);
  box(group, 0.055, 0.34, 0.055, bone, 0, 1.11, 0);
  box(group, 0.22, 0.05, 0.055, bone, 0, 1.16, 0);
}

function addDungeon(group: THREE.Group): void {
  const rock = material(0x554c5d);
  const dark = material(0x332f42);
  const crystal = glow(0xb37cc2);
  cylinder(group, 0.59, 0.64, 0.12, 9, dark, 0, 0.06, 0);
  mesh(group, new THREE.DodecahedronGeometry(0.51, 0), rock, 0, 0.42, -0.04).scale.set(1.05, 0.85, 0.9);
  box(group, 0.3, 0.37, 0.08, dark, 0, 0.25, 0.4);
  for (const [x, z, height, radius] of [[-0.34, -0.2, 0.98, 0.15], [0.32, -0.19, 1.23, 0.17], [-0.42, 0.22, 0.54, 0.12], [0.4, 0.25, 0.68, 0.12], [0.02, -0.3, 0.76, 0.13]] as const) {
    cone(group, radius, height, 6, rock, x, height / 2 + 0.12, z).rotation.z = x * 0.18;
  }
  for (const [x, z, height] of [[-0.24, 0.35, 0.43], [0.25, 0.32, 0.57], [0.4, 0.08, 0.35]] as const) {
    const shard = mesh(group, new THREE.OctahedronGeometry(0.1, 0), crystal, x, height / 2 + 0.12, z);
    shard.scale.y = height / 0.2;
  }
  mesh(group, new THREE.TorusGeometry(0.2, 0.035, 5, 12, Math.PI), crystal, 0, 0.43, 0.43);
}

function addStronghold(group: THREE.Group): void {
  const timber = material(0x806348);
  const dark = material(0x514237);
  const hide = material(0xa7835a);
  const bone = material(0xc9a467);
  cylinder(group, 0.6, 0.64, 0.12, 8, material(0x6a5c48), 0, 0.06, 0);
  box(group, 0.7, 0.49, 0.54, timber, 0, 0.35, 0);
  const roof = cone(group, 0.54, 0.43, 4, hide, 0, 0.8, 0);
  roof.rotation.y = Math.PI / 4;
  box(group, 0.19, 0.33, 0.04, dark, 0, 0.25, 0.29);
  for (const [x, z] of [[-0.48, -0.32], [0.48, -0.32], [-0.48, 0.3], [0.48, 0.3]] as const) {
    cylinder(group, 0.07, 0.09, 0.66, 6, dark, x, 0.39, z);
    cone(group, 0.1, 0.28, 6, bone, x, 0.85, z);
  }
  for (const side of [-1, 1]) {
    const horn = cone(group, 0.1, 0.58, 6, bone, side * 0.25, 1.09, 0);
    horn.rotation.z = side * 0.8;
    box(group, 0.08, 0.52, 0.08, dark, side * 0.34, 0.33, 0.35).rotation.z = side * 0.2;
  }
  box(group, 0.36, 0.08, 0.08, bone, 0, 0.73, 0.32);
}

function addConflux(group: THREE.Group): void {
  const stone = material(0x789b9e);
  const dark = material(0x57678f);
  const core = glow(0xb9e6da);
  cylinder(group, 0.59, 0.64, 0.13, 10, dark, 0, 0.065, 0);
  cylinder(group, 0.33, 0.43, 0.24, 8, stone, 0, 0.23, 0);
  mesh(group, new THREE.OctahedronGeometry(0.29, 0), core, 0, 0.87, 0).scale.y = 1.8;
  for (const [x, z, color] of [[-0.4, -0.25, 0x85cfe0], [0.4, -0.25, 0xe5a268], [-0.4, 0.28, 0xb89bdd], [0.4, 0.28, 0x9bd088]] as const) {
    cylinder(group, 0.06, 0.16, 0.66, 6, stone, x, 0.43, z);
    mesh(group, new THREE.OctahedronGeometry(0.1, 0), glow(color), x, 0.88, z).scale.y = 1.55;
  }
  const orbit = mesh(group, new THREE.TorusGeometry(0.43, 0.025, 4, 18), core, 0, 0.86, 0);
  orbit.rotation.x = 0.7;
  orbit.rotation.y = 0.35;
  for (const x of [-0.18, 0.18]) cone(group, 0.07, 0.43, 6, dark, x, 0.51, 0.36).rotation.z = x * 1.2;
}

function addCove(group: THREE.Group): void {
  const stone = material(0xb0a58a);
  const timber = material(0x8d8067);
  const teal = material(0x386b78);
  const sail = material(0xd8c589);
  cylinder(group, 0.61, 0.64, 0.12, 10, material(0x526f70), 0, 0.06, 0);
  cylinder(group, 0.23, 0.31, 0.93, 10, stone, -0.1, 0.58, -0.06);
  cone(group, 0.34, 0.38, 10, teal, -0.1, 1.23, -0.06);
  cylinder(group, 0.25, 0.25, 0.11, 10, teal, -0.1, 1.0, -0.06);
  box(group, 0.08, 0.15, 0.025, glow(0xf1d98c), -0.1, 1.06, 0.183);
  box(group, 0.54, 0.28, 0.39, timber, 0.18, 0.28, 0.24);
  const roof = cone(group, 0.4, 0.35, 4, teal, 0.18, 0.57, 0.24);
  roof.rotation.y = Math.PI / 4;
  cylinder(group, 0.018, 0.025, 1.28, 6, timber, 0.38, 0.71, -0.28);
  const sailMesh = mesh(group, new THREE.CircleGeometry(0.38, 3), new THREE.MeshStandardMaterial({
    color: sail.color, roughness: 0.9, flatShading: true, side: THREE.DoubleSide,
  }), 0.37, 0.86, -0.26);
  sailMesh.scale.set(0.7, 1.25, 1);
  for (const z of [-0.4, 0.4]) box(group, 0.85, 0.06, 0.12, timber, 0, 0.12, z);
}

function addFactory(group: THREE.Group): void {
  const brick = material(0x8a6d55);
  const metal = material(0x4e595b, 0.5, 0.55);
  const brass = material(0xd39a50, 0.4, 0.65);
  const dark = material(0x353d3e);
  cylinder(group, 0.6, 0.64, 0.13, 10, dark, 0, 0.065, 0);
  box(group, 0.72, 0.54, 0.57, brick, 0, 0.37, 0);
  const roof = cylinder(group, 0.37, 0.37, 0.64, 10, metal, 0, 0.75, 0);
  roof.rotation.z = Math.PI / 2;
  roof.scale.z = 0.82;
  box(group, 0.19, 0.34, 0.04, dark, 0, 0.26, 0.305);
  for (const [x, z, height] of [[-0.28, -0.2, 1.15], [0.28, -0.2, 0.91]] as const) {
    cylinder(group, 0.07, 0.1, height, 8, dark, x, height / 2 + 0.22, z);
    cylinder(group, 0.12, 0.08, 0.15, 8, brass, x, height + 0.28, z);
  }
  mesh(group, new THREE.TorusGeometry(0.2, 0.05, 5, 12), brass, 0.26, 0.52, 0.31);
  for (const x of [-0.2, 0.03]) box(group, 0.09, 0.13, 0.025, glow(0xe2ad61), x, 0.51, 0.303);
  cylinder(group, 0.035, 0.035, 0.72, 8, brass, -0.43, 0.42, 0).rotation.z = Math.PI / 2;
}

function addBulwark(group: THREE.Group): void {
  const timber = material(0x6d704f);
  const dark = material(0x47543e);
  const amber = material(0xc2a766);
  cylinder(group, 0.6, 0.64, 0.12, 9, material(0x59634a), 0, 0.06, 0);
  for (const [x, z] of [[-0.26, -0.21], [0.26, -0.21], [-0.26, 0.21], [0.26, 0.21]] as const) {
    cylinder(group, 0.055, 0.075, 0.42, 6, dark, x, 0.25, z);
  }
  box(group, 0.68, 0.47, 0.53, timber, 0, 0.59, 0);
  const roof = cone(group, 0.53, 0.46, 6, dark, 0, 1.04, 0);
  roof.rotation.y = 0.2;
  box(group, 0.17, 0.3, 0.04, dark, 0, 0.48, 0.285);
  for (const [x, z] of [[-0.47, -0.3], [0.47, -0.3], [-0.47, 0.28], [0.47, 0.28]] as const) {
    cone(group, 0.09, 0.77, 5, timber, x, 0.45, z);
    mesh(group, new THREE.CylinderGeometry(0.13, 0.13, 0.045, 8), amber, x, 0.47, z).rotation.x = Math.PI / 2;
  }
  box(group, 0.07, 0.19, 0.025, glow(0xd5ba70), -0.19, 0.67, 0.283);
  box(group, 0.07, 0.19, 0.025, glow(0xd5ba70), 0.19, 0.67, 0.283);
  cone(group, 0.07, 0.46, 6, amber, 0, 1.46, 0);
}

function addCourtyard(group: THREE.Group): void {
  const stone = material(0xd0bdab);
  const trim = material(0xa69283);
  const roof = material(0x78546f);
  const gold = material(0xe2c776, 0.4, 0.3);
  cylinder(group, 0.6, 0.64, 0.13, 10, trim, 0, 0.065, 0);
  box(group, 0.72, 0.57, 0.54, stone, 0, 0.41, 0);
  const centerRoof = cone(group, 0.5, 0.48, 4, roof, 0, 0.94, 0);
  centerRoof.rotation.y = Math.PI / 4;
  for (const [x, z] of [[-0.39, -0.28], [0.39, -0.28], [-0.39, 0.28], [0.39, 0.28]] as const) {
    cylinder(group, 0.1, 0.13, 0.63, 8, stone, x, 0.41, z);
    cone(group, 0.18, 0.35, 8, roof, x, 0.9, z);
    mesh(group, new THREE.OctahedronGeometry(0.045, 0), gold, x, 1.1, z);
  }
  box(group, 0.17, 0.34, 0.035, material(0x50404a), 0, 0.27, 0.288);
  for (const x of [-0.24, 0.24]) {
    cylinder(group, 0.035, 0.045, 0.43, 8, trim, x, 0.3, 0.31);
    box(group, 0.08, 0.17, 0.025, glow(0xe3c789), x, 0.57, 0.283);
  }
  cone(group, 0.07, 0.35, 6, gold, 0, 1.34, 0);
}

const BUILDERS: Record<string, (group: THREE.Group) => void> = {
  Tower: addTower,
  Necropolis: addNecropolis,
  Dungeon: addDungeon,
  Stronghold: addStronghold,
  Conflux: addConflux,
  Cove: addCove,
  Factory: addFactory,
  Bulwark: addBulwark,
  Courtyard: addCourtyard,
};

export function addHotaArchitecture(group: THREE.Group, faction: string): string | null {
  const builder = BUILDERS[faction];
  const id = HOTA_TOWN_IDS[faction];
  if (!builder || !id) return null;
  builder(group);
  return id;
}

export function addHotaDwellingDetails(group: THREE.Group, faction: string, depleted: boolean): void {
  const palette = HOTA_FACTION_PALETTES[faction];
  if (!palette) return;
  const accent = depleted ? material(0x77776c) : glow(palette.accent);
  const dark = material(depleted ? 0x66665f : palette.roof);
  if (faction === 'Tower') {
    cylinder(group, 0.07, 0.1, 0.43, 7, dark, -0.31, 0.91, 0);
    cone(group, 0.12, 0.28, 7, accent, -0.31, 1.25, 0);
  } else if (faction === 'Necropolis') {
    for (const x of [-0.36, 0.36]) cone(group, 0.07, 0.55, 4, dark, x, 0.43, -0.12);
    box(group, 0.2, 0.04, 0.04, accent, 0, 0.8, 0.29);
  } else if (faction === 'Dungeon') {
    for (const x of [-0.34, 0.34]) mesh(group, new THREE.OctahedronGeometry(0.09, 0), accent, x, 0.73, 0).scale.y = 2;
    cone(group, 0.12, 0.52, 6, dark, 0.3, 1.03, -0.1);
  } else if (faction === 'Stronghold') {
    for (const x of [-0.3, 0.3]) cone(group, 0.07, 0.5, 5, accent, x, 0.98, 0).rotation.z = x * 1.4;
  } else if (faction === 'Conflux') {
    const ring = mesh(group, new THREE.TorusGeometry(0.25, 0.025, 4, 12), accent, 0, 0.97, 0);
    ring.rotation.x = 0.65;
  } else if (faction === 'Cove') {
    cylinder(group, 0.018, 0.025, 0.83, 6, dark, -0.3, 0.9, 0);
    const sail = mesh(group, new THREE.CircleGeometry(0.23, 3), new THREE.MeshStandardMaterial({
      color: palette.accent, side: THREE.DoubleSide, roughness: 0.9, flatShading: true,
    }), -0.28, 1.02, 0);
    sail.scale.set(0.65, 1.2, 1);
  } else if (faction === 'Factory') {
    mesh(group, new THREE.TorusGeometry(0.14, 0.035, 5, 10), accent, 0.28, 0.82, 0.28);
    cylinder(group, 0.04, 0.06, 0.57, 7, dark, -0.28, 1.03, -0.1);
  } else if (faction === 'Bulwark') {
    for (const x of [-0.35, 0.35]) cone(group, 0.06, 0.57, 5, dark, x, 0.71, 0);
    box(group, 0.28, 0.06, 0.05, accent, 0, 0.87, 0.28);
  } else if (faction === 'Courtyard') {
    for (const x of [-0.31, 0.31]) {
      cone(group, 0.12, 0.38, 6, dark, x, 0.99, 0);
      mesh(group, new THREE.OctahedronGeometry(0.045, 0), accent, x, 1.21, 0);
    }
  }
}
