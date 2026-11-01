import * as THREE from 'three';
import type { BattleSideId } from '../battle/types';
import type { CreatureDefinition } from '../game/types';

const FACTION_COLORS: Readonly<Record<string, readonly [number, number]>> = {
  Haven: [0x668ca8, 0xd8bc72],
  Grove: [0x4f7c59, 0xc2d99a],
  Ember: [0x9b493e, 0xffc066],
  Mire: [0x647b54, 0xc3bb70],
  Tower: [0x626aa0, 0xd6c6f2],
  Necropolis: [0x55435f, 0xb8d39a],
  Dungeon: [0x5c3c66, 0xe08b72],
  Stronghold: [0x78513c, 0xe5c06a],
  Conflux: [0x477c81, 0xe5b4e4],
  Cove: [0x4d7782, 0xe2d29b],
  Factory: [0x6f6250, 0x82b7b3],
  Bulwark: [0x65704d, 0xd4c990],
  Courtyard: [0x875568, 0xf0d59a],
  Neutral: [0x707a78, 0xd0c69b],
};

function colorsForFaction(faction: string): readonly [number, number] {
  if (Object.hasOwn(FACTION_COLORS, faction)) return FACTION_COLORS[faction]!;
  let hash = 0;
  for (const character of faction) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return [new THREE.Color().setHSL((hash % 360) / 360, 0.32, 0.42).getHex(), 0xd8c58a];
}

function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  surface: THREE.Material,
  position: readonly [number, number, number],
  scale: readonly [number, number, number] = [1, 1, 1],
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addWeapon(parent: THREE.Group, material: THREE.Material, x: number, length: number): void {
  const weapon = new THREE.Group();
  addMesh(weapon, new THREE.CylinderGeometry(0.025, 0.025, length, 5), material, [0, length / 2, 0]);
  addMesh(weapon, new THREE.ConeGeometry(0.09, 0.24, 4), material, [0, length + 0.1, 0]);
  weapon.position.set(x, 0.55, 0.05);
  weapon.rotation.z = x > 0 ? -0.28 : 0.28;
  parent.add(weapon);
}

function addWing(parent: THREE.Group, material: THREE.Material, side: number): void {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.95, -0.12,
    side * 0.9, 1.65, -0.28,
    side * 0.65, 0.55, -0.25,
    0, 0.95, -0.12,
    side * 0.65, 0.55, -0.25,
    side * 0.25, 0.4, -0.16,
  ], 3));
  geometry.computeVertexNormals();
  addMesh(parent, geometry, material, [0, 0, 0]);
}

export function createCustomCreatureModel(
  definition: CreatureDefinition,
  side: BattleSideId = 'attacker',
): THREE.Group {
  const group = new THREE.Group();
  const [bodyColor, accentColor] = colorsForFaction(definition.faction);
  const body = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.82, flatShading: true });
  const accent = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.55, metalness: 0.18, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x252c31, roughness: 0.9, flatShading: true });
  const glow = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.45,
    roughness: 0.35,
    flatShading: true,
  });

  const healthScale = THREE.MathUtils.clamp(0.9 + Math.log10(definition.health + 1) * 0.08, 0.95, 1.2);
  addMesh(group, new THREE.CylinderGeometry(0.23, 0.34, 0.72, 6), body, [0, 0.79, 0], [healthScale, 1, healthScale]);
  addMesh(group, new THREE.DodecahedronGeometry(0.2, 0), accent, [0, 1.32, 0]);
  addMesh(group, new THREE.ConeGeometry(0.25, 0.3 + definition.tier * 0.035, 5), body, [0, 1.55, 0]);
  for (const direction of [-1, 1]) {
    addMesh(group, new THREE.CylinderGeometry(0.065, 0.08, 0.52, 5), dark, [direction * 0.15, 0.28, 0]);
    addMesh(group, new THREE.CylinderGeometry(0.055, 0.065, 0.55, 5), body, [direction * 0.34, 0.82, 0]);
  }

  const weaponLength = THREE.MathUtils.clamp(0.8 + definition.attack * 0.018, 0.85, 1.45);
  addWeapon(group, accent, 0.42, weaponLength);
  if (definition.abilities.includes('doubleStrike')) addWeapon(group, accent, -0.42, weaponLength * 0.88);
  if (definition.abilities.includes('flying')) {
    addWing(group, accent, -1);
    addWing(group, accent, 1);
  }
  if (definition.abilities.includes('ranged')) {
    const bow = addMesh(group, new THREE.TorusGeometry(0.34, 0.025, 4, 12, Math.PI * 1.45), accent, [-0.4, 0.9, 0.18]);
    bow.rotation.z = -Math.PI * 0.72;
  }
  if (definition.abilities.includes('retaliation')) {
    const shield = addMesh(group, new THREE.CylinderGeometry(0.3, 0.3, 0.07, 8), accent, [-0.38, 0.8, 0.24], [1, 1.25, 1]);
    shield.rotation.x = Math.PI / 2;
  }
  if (definition.abilities.includes('regeneration')) {
    const orb = addMesh(group, new THREE.IcosahedronGeometry(0.12, 0), glow, [0, 1.92, 0]);
    orb.userData.previewAnimation = 'pulse';
  }
  if (definition.abilities.includes('spellResistance')) {
    const ring = addMesh(group, new THREE.TorusGeometry(0.53, 0.025, 5, 20), glow, [0, 0.78, 0]);
    ring.rotation.x = Math.PI / 2;
    ring.userData.previewAnimation = 'spin';
  }

  const tierScale = 0.88 + definition.tier * 0.07;
  group.scale.setScalar(tierScale);
  group.rotation.y = side === 'attacker' ? 0.35 : Math.PI + 0.35;
  group.name = `custom-creature-${definition.id}`;
  group.userData.creatureId = definition.id;
  group.userData.customContent = true;
  group.userData.faction = definition.faction;
  group.userData.archetype = 'custom-humanoid';
  group.userData.side = side;
  group.userData.tier = definition.tier;
  group.userData.animationPivot = 'ground';
  group.userData.visualHeight = 1.9 * tierScale;
  group.userData.labelHeight = 2.25 * tierScale;
  group.userData.definition = {
    ...definition,
    damage: [...definition.damage],
    cost: { ...definition.cost },
    abilities: [...definition.abilities],
  };
  return group;
}

export function disposeCustomContentModel(model: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Line) && !(child instanceof THREE.Points)) return;
    geometries.add(child.geometry);
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of childMaterials) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}
