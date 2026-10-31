import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createCreatureModel } from './creatures';
import { HOTA_CREATURE_FACTIONS, HOTA_CREATURE_IDS } from './hotaCreatures';
import { disposeBattleResources } from './resources';

const ORIGINAL_FACTIONS: Record<string, string> = {
  militia: 'Haven', archer: 'Haven', griffin: 'Haven', cavalier: 'Haven',
  sprite: 'Grove', ranger: 'Grove', unicorn: 'Grove', dragon: 'Grove',
  imp: 'Ember', hellhound: 'Ember', ifrit: 'Ember', pitFiend: 'Ember',
  lizardman: 'Mire', gorgon: 'Mire', wyvern: 'Mire', basilisk: 'Mire',
};

const EXPECTED_NEW_FACTIONS: Record<string, string[]> = {
  Tower: ['gremlin', 'stoneGargoyle', 'genie', 'titan'],
  Necropolis: ['skeleton', 'zombie', 'vampire', 'ghostDragon'],
  Dungeon: ['troglodyte', 'harpy', 'minotaur', 'redDragon'],
  Stronghold: ['goblin', 'wolfRider', 'ogre', 'behemoth'],
  Conflux: ['pixie', 'airElemental', 'stormElemental', 'phoenix'],
  Cove: ['nymph', 'corsair', 'seaWitch', 'seaSerpent'],
  Factory: ['halfling', 'automaton', 'dreadnought', 'juggernaut'],
  Bulwark: ['bandit', 'hornet', 'shaman', 'alligator'],
  Courtyard: ['page', 'duelist', 'courtWizard', 'royalLion'],
};

const ALL_IDS = [...Object.keys(ORIGINAL_FACTIONS), ...HOTA_CREATURE_IDS];

function meshes(model: THREE.Group): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  model.traverse((child) => {
    if (child instanceof THREE.Mesh) result.push(child);
  });
  return result;
}

function bodyBounds(model: THREE.Group): THREE.Box3 {
  const bounds = new THREE.Box3();
  for (const mesh of meshes(model)) {
    if (mesh.name !== 'faction-ring') bounds.expandByObject(mesh);
  }
  return bounds;
}

function silhouette(model: THREE.Group): string {
  return meshes(model)
    .filter((mesh) => mesh.name !== 'faction-ring')
    .map((mesh) => [
      mesh.geometry.type,
      ...mesh.position.toArray(),
      ...mesh.scale.toArray(),
      ...mesh.rotation.toArray().slice(0, 3),
    ].map((value) => typeof value === 'number' ? value.toFixed(3) : value).join(','))
    .join('|');
}

describe('complete 52-unit visual roster', () => {
  it('registers exactly the frozen 36 new IDs in nine factions', () => {
    expect(HOTA_CREATURE_IDS).toHaveLength(36);
    expect(new Set(HOTA_CREATURE_IDS).size).toBe(36);
    expect(ALL_IDS).toHaveLength(52);
    for (const [faction, ids] of Object.entries(EXPECTED_NEW_FACTIONS)) {
      for (const id of ids) expect(HOTA_CREATURE_FACTIONS[id]).toBe(faction);
    }
  });

  it.each(ALL_IDS)('builds %s with bounded scale, ground pivot, label clearance, and faction feedback', (id) => {
    const model = createCreatureModel(id, 'attacker');
    const bounds = bodyBounds(model);
    const faction = ORIGINAL_FACTIONS[id] ?? HOTA_CREATURE_FACTIONS[id];
    expect(model.name).toBe(`creature-${id}`);
    expect(model.userData.creatureId).toBe(id);
    expect(model.userData.faction).toBe(faction);
    expect(model.userData.animationPivot).toBe('ground');
    expect(model.userData.side).toBe('attacker');
    expect(model.position.toArray()).toEqual([0, 0, 0]);
    expect(bounds.isEmpty()).toBe(false);
    expect(bounds.min.y).toBeGreaterThanOrEqual(-0.03);
    expect(bounds.max.y).toBeGreaterThan(0.85);
    expect(bounds.max.y).toBeLessThan(3);
    expect(model.userData.visualHeight).toBeCloseTo(bounds.max.y - bounds.min.y, 6);
    expect(model.userData.labelHeight).toBeGreaterThanOrEqual(bounds.max.y + 0.44);
    expect(model.userData.palette).toHaveLength(3);
    expect(model.userData.factionColor).toBe(model.userData.palette[0]);
    const ring = model.getObjectByName('faction-ring') as THREE.Mesh;
    expect(ring).toBeDefined();
    expect((ring.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0x65bfe3);
    if (HOTA_CREATURE_FACTIONS[id]) {
      expect(meshes(model).length).toBeGreaterThan(12);
      expect(meshes(model).length).toBeLessThan(48);
      expect(model.userData.archetype).not.toBe(id);
    }
  });

  it('gives every new creature a distinct silhouette and palette', () => {
    const models = HOTA_CREATURE_IDS.map((id) => createCreatureModel(id, 'attacker'));
    expect(new Set(models.map(silhouette)).size).toBe(36);
    expect(new Set(models.map((model) => (model.userData.palette as number[]).join(','))).size).toBe(36);
  });

  it('gives the Royal Winged Lion two explicit wing meshes in battle and overworld forms', () => {
    for (const factionRing of [true, false]) {
      const model = createCreatureModel('royalLion', 'attacker', { factionRing });
      const left = model.getObjectByName('royal-lion-wing-left') as THREE.Mesh;
      const right = model.getObjectByName('royal-lion-wing-right') as THREE.Mesh;
      expect(left).toBeInstanceOf(THREE.Mesh);
      expect(right).toBeInstanceOf(THREE.Mesh);
      expect(left.geometry.getAttribute('position').count).toBeGreaterThan(0);
      expect(right.geometry.getAttribute('position').count).toBeGreaterThan(0);
      expect(left.position.z).toBeLessThan(0);
      expect(right.position.z).toBeGreaterThan(0);
      expect(meshes(model).filter((mesh) => mesh.userData.anatomy === 'wing')).toHaveLength(2);
      expect(model.userData.archetype).toBe('crowned-winged-beast');
    }
  });

  it('preserves defender facing, side color, and compact ring-free overworld models', () => {
    for (const id of HOTA_CREATURE_IDS) {
      const defender = createCreatureModel(id, 'defender');
      expect(defender.rotation.y).toBe(Math.PI);
      expect(defender.userData.side).toBe('defender');
      const ring = defender.getObjectByName('faction-ring') as THREE.Mesh;
      expect((ring.material as THREE.MeshStandardMaterial).color.getHex()).toBe(0xe17868);
      const overworld = createCreatureModel(id, 'attacker', { factionRing: false });
      expect(overworld.getObjectByName('faction-ring')).toBeUndefined();
    }
  });

  it.each(ALL_IDS)('disposes every geometry, material, and tactical label texture for %s exactly once', (id) => {
    const model = createCreatureModel(id, 'attacker');
    const texture = new THREE.Texture();
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
    model.add(label);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        geometries.add(child.geometry);
        const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of childMaterials) materials.add(material);
      } else if (child instanceof THREE.Sprite) materials.add(child.material);
    });
    const geometrySpies = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialSpies = [...materials].map((material) => vi.spyOn(material, 'dispose'));
    const textureSpy = vi.spyOn(texture, 'dispose');
    disposeBattleResources(model);
    for (const spy of [...geometrySpies, ...materialSpies, textureSpy]) expect(spy).toHaveBeenCalledTimes(1);
  });
});
