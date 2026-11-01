import * as THREE from 'three';

type Point = readonly [number, number, number];

function material(
  color: number,
  roughness = 0.82,
  metalness = 0,
): THREE.MeshStandardMaterial {
  const result = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
  result.userData.baseColor = color;
  return result;
}

function glow(color: number, intensity = 0.65): THREE.MeshStandardMaterial {
  const result = material(color, 0.38, 0.12);
  result.emissive.setHex(color);
  result.emissiveIntensity = intensity;
  return result;
}

function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: Point,
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(...position);
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
  position: Point,
): THREE.Mesh {
  return mesh(parent, new THREE.CylinderGeometry(top, bottom, height, segments), surface, position);
}

function box(
  parent: THREE.Object3D,
  size: Point,
  surface: THREE.Material,
  position: Point,
): THREE.Mesh {
  return mesh(parent, new THREE.BoxGeometry(...size), surface, position);
}

function cone(
  parent: THREE.Object3D,
  radius: number,
  height: number,
  segments: number,
  surface: THREE.Material,
  position: Point,
): THREE.Mesh {
  return mesh(parent, new THREE.ConeGeometry(radius, height, segments), surface, position);
}

function beam(
  parent: THREE.Object3D,
  start: Point,
  end: Point,
  radius: number,
  surface: THREE.Material,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const direction = new THREE.Vector3(...end).sub(from);
  const result = cylinder(parent, radius, radius, direction.length(), 6, surface, [0, 0, 0]);
  result.position.copy(from).addScaledVector(direction, 0.5);
  result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return result;
}

function addFoundation(group: THREE.Group, stone: THREE.Material, trim: THREE.Material): void {
  cylinder(group, 0.82, 0.9, 0.16, 10, trim, [0, 0.08, 0]);
  cylinder(group, 0.68, 0.75, 0.12, 10, stone, [0, 0.22, 0]);
  cylinder(group, 0.59, 0.64, 0.1, 10, stone, [0, 0.33, 0]);
  box(group, [0.92, 0.08, 0.3], trim, [0, 0.04, 0.79]);
  box(group, [0.78, 0.12, 0.28], stone, [0, 0.1, 0.61]);
  box(group, [0.64, 0.12, 0.24], stone, [0, 0.2, 0.46]);
}

function addStatue(group: THREE.Group, stone: THREE.Material, trim: THREE.Material): void {
  const statue = new THREE.Group();
  statue.name = 'shrine-statue';
  statue.userData.detail = 'heroic-statue';
  statue.position.z = -0.18;
  group.add(statue);

  box(statue, [0.48, 0.28, 0.44], trim, [0, 0.52, 0]);
  box(statue, [0.56, 0.08, 0.5], stone, [0, 0.7, 0]);
  for (const side of [-1, 1]) {
    box(statue, [0.13, 0.12, 0.22], trim, [side * 0.11, 0.8, 0.025]);
    cylinder(statue, 0.055, 0.07, 0.43, 6, stone, [side * 0.11, 1.01, 0]);
  }
  cylinder(statue, 0.18, 0.25, 0.5, 7, stone, [0, 1.39, 0]);
  box(statue, [0.4, 0.08, 0.28], trim, [0, 1.19, 0]);
  const head = mesh(statue, new THREE.DodecahedronGeometry(0.15, 0), stone, [0, 1.78, 0.015]);
  head.name = 'shrine-statue-head';
  cone(statue, 0.18, 0.25, 7, trim, [0, 1.99, 0]);
  box(statue, [0.045, 0.2, 0.25], trim, [0, 2.04, -0.015]);
  beam(statue, [-0.18, 1.54, 0], [-0.31, 1.19, 0.06], 0.065, stone);
  beam(statue, [0.18, 1.54, 0], [0.32, 1.18, 0.04], 0.065, stone);

  const shield = cylinder(statue, 0.22, 0.22, 0.055, 10, trim, [-0.31, 1.28, 0.105]);
  shield.rotation.x = Math.PI / 2;
  shield.scale.y = 1.12;
  shield.name = 'shrine-statue-shield';
  const shieldBoss = mesh(statue, new THREE.OctahedronGeometry(0.075, 0), stone, [-0.31, 1.28, 0.15]);
  shieldBoss.name = 'shrine-statue-shield-boss';

  box(statue, [0.055, 0.66, 0.04], trim, [0.34, 1.36, 0.055]);
  cone(statue, 0.045, 0.15, 4, trim, [0.34, 1.765, 0.055]);
  box(statue, [0.25, 0.045, 0.065], stone, [0.34, 1.01, 0.055]);
  cylinder(statue, 0.026, 0.026, 0.2, 6, trim, [0.34, 0.9, 0.055]);
}

function addAltar(group: THREE.Group, stone: THREE.Material, trim: THREE.Material, radiance: THREE.Material): void {
  const altar = new THREE.Group();
  altar.name = 'shrine-altar';
  altar.userData.detail = 'offering-altar';
  altar.position.z = 0.42;
  group.add(altar);
  box(altar, [0.48, 0.26, 0.34], trim, [0, 0.51, 0]);
  box(altar, [0.62, 0.1, 0.45], stone, [0, 0.69, 0]);
  box(altar, [0.36, 0.025, 0.24], radiance, [0, 0.753, 0]);
  const offering = mesh(altar, new THREE.IcosahedronGeometry(0.12, 1), radiance, [0, 0.91, 0]);
  offering.name = 'shrine-altar-offering';
  const orbit = mesh(altar, new THREE.TorusGeometry(0.17, 0.018, 5, 16), radiance, [0, 0.91, 0]);
  orbit.rotation.x = Math.PI / 2;
  orbit.name = 'shrine-altar-orbit';
}

function addRadiance(group: THREE.Group, radiance: THREE.Material): void {
  const details = new THREE.Group();
  details.name = 'shrine-radiance';
  details.userData.detail = 'radiant-halo';
  group.add(details);
  const halo = mesh(details, new THREE.TorusGeometry(0.42, 0.035, 6, 24), radiance, [0, 1.73, -0.41]);
  halo.name = 'shrine-halo';
  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4;
    const start: Point = [Math.cos(angle) * 0.49, 1.73 + Math.sin(angle) * 0.49, -0.41];
    const end: Point = [Math.cos(angle) * 0.62, 1.73 + Math.sin(angle) * 0.62, -0.41];
    const ray = beam(details, start, end, 0.018, radiance);
    ray.name = `shrine-halo-ray-${index}`;
  }
  for (let index = 0; index < 6; index += 1) {
    const angle = index * Math.PI / 3;
    const rune = box(details, [0.1, 0.018, 0.16], radiance, [Math.cos(angle) * 0.49, 0.39, Math.sin(angle) * 0.49]);
    rune.rotation.y = -angle;
    rune.name = `shrine-rune-${index}`;
  }
}

function addBraziers(group: THREE.Group, trim: THREE.Material, flame: THREE.Material): void {
  for (const side of [-1, 1]) {
    cylinder(group, 0.055, 0.085, 0.46, 7, trim, [side * 0.52, 0.61, 0.18]);
    cylinder(group, 0.12, 0.07, 0.09, 8, trim, [side * 0.52, 0.885, 0.18]);
    const fire = cone(group, 0.07, 0.22, 6, flame, [side * 0.52, 1.04, 0.18]);
    fire.name = side < 0 ? 'shrine-flame-left' : 'shrine-flame-right';
  }
}

export function createHeroesShrineModel(): THREE.Group {
  const group = new THREE.Group();
  const stone = material(0xc9c3ac);
  const trim = material(0x8e927f, 0.72, 0.08);
  const gold = material(0xc3a65a, 0.42, 0.5);
  const radiance = glow(0xffdf82, 0.85);
  const flame = glow(0x9ee8dc, 0.9);

  addFoundation(group, stone, trim);
  addStatue(group, stone, gold);
  addAltar(group, stone, gold, radiance);
  addRadiance(group, radiance);
  addBraziers(group, gold, flame);

  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3());
  group.name = 'heroesShrine';
  group.userData.landmarkId = 'heroesShrine';
  group.userData.animationPivot = 'ground';
  group.userData.visualHeight = size.y;
  group.userData.labelHeight = bounds.max.y + 0.45;
  group.userData.palette = [0xc9c3ac, 0xc3a65a, 0xffdf82];
  return group;
}
