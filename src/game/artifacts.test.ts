import { describe, expect, it } from 'vitest';
import {
  ARTIFACT_IDS,
  ARTIFACT_LIST,
  ARTIFACT_RARITIES,
  ARTIFACT_SLOTS,
  ARTIFACT_STATS,
  ARTIFACTS,
  addArtifact,
  aggregateArtifactBonuses,
  createArtifactInventory,
  equipArtifact,
  getArtifact,
  getArtifactCount,
  getEquippedArtifact,
  isArtifactSlot,
  isValidArtifactInventory,
  removeArtifact,
  unequipArtifact,
} from './artifacts';
import type { ArtifactInventory, ArtifactRarity } from './artifacts';

const UNKNOWN_IDS = ['toString', 'constructor', '__proto__', 'missing', 'CopperSunblade'] as const;
const BONUS_BUDGETS: Record<ArtifactRarity, number> = {
  common: 1,
  rare: 2,
  epic: 4,
  legendary: 6,
};
const ZERO_BONUSES = { attack: 0, defense: 0, spellPower: 0, knowledge: 0 };

describe('artifact registry', () => {
  it('defines exactly 20 original artifacts with four per slot and five per rarity', () => {
    expect(ARTIFACT_LIST).toHaveLength(20);
    expect(ARTIFACT_IDS).toHaveLength(20);
    expect(Object.keys(ARTIFACTS)).toEqual(ARTIFACT_IDS);
    expect(new Set(ARTIFACT_IDS).size).toBe(20);
    expect(new Set(ARTIFACT_LIST.map((artifact) => artifact.name)).size).toBe(20);
    for (const slot of ARTIFACT_SLOTS) {
      expect(ARTIFACT_LIST.filter((artifact) => artifact.slot === slot)).toHaveLength(4);
    }
    for (const rarity of ARTIFACT_RARITIES) {
      expect(ARTIFACT_LIST.filter((artifact) => artifact.rarity === rarity)).toHaveLength(5);
    }
  });

  it('gives every artifact complete metadata and a balanced positive primary-stat budget', () => {
    for (const artifact of ARTIFACT_LIST) {
      expect(getArtifact(artifact.id)).toBe(artifact);
      expect(ARTIFACTS[artifact.id]).toBe(artifact);
      expect(artifact.name.length).toBeGreaterThan(0);
      expect(artifact.description.length).toBeGreaterThan(20);
      expect(isArtifactSlot(artifact.slot)).toBe(true);
      expect(ARTIFACT_RARITIES).toContain(artifact.rarity);
      const bonuses = Object.entries(artifact.bonuses);
      expect(bonuses.length).toBeGreaterThan(0);
      expect(bonuses.reduce((total, [, amount]) => total + amount, 0)).toBe(BONUS_BUDGETS[artifact.rarity]);
      for (const [stat, amount] of bonuses) {
        expect(ARTIFACT_STATS).toContain(stat);
        expect(Number.isInteger(amount)).toBe(true);
        expect(amount).toBeGreaterThan(0);
      }
      for (const stat of ARTIFACT_STATS) {
        expect(artifact.bonuses[stat] ?? 0).toBeGreaterThanOrEqual(0);
      }
    }
    expect(new Set(ARTIFACT_LIST.flatMap((artifact) => Object.keys(artifact.bonuses))))
      .toEqual(new Set(ARTIFACT_STATS));
  });

  it('uses own-property-safe lookups and strict slot guards', () => {
    for (const slot of ARTIFACT_SLOTS) expect(isArtifactSlot(slot)).toBe(true);
    for (const id of UNKNOWN_IDS) {
      expect(getArtifact(id), id).toBeUndefined();
      expect(isArtifactSlot(id), id).toBe(false);
    }
    for (const value of [null, undefined, 1, false, {}, []]) expect(isArtifactSlot(value)).toBe(false);
  });
});

describe('artifact stacking and equipment', () => {
  it.each(ARTIFACT_LIST)('$id stacks, remains owned while equipped, and aggregates its bonuses', (artifact) => {
    const empty = createArtifactInventory();
    const one = addArtifact(empty, artifact.id);
    const three = addArtifact(one, artifact.id, 2);
    expect(getArtifactCount(empty, artifact.id)).toBe(0);
    expect(getArtifactCount(one, artifact.id)).toBe(1);
    expect(getArtifactCount(three, artifact.id)).toBe(3);
    expect(empty.items).toEqual({});
    expect(one.items).toEqual({ [artifact.id]: 1 });
    expect(three.items).toEqual({ [artifact.id]: 3 });

    const equipped = equipArtifact(three, artifact.id);
    expect(getArtifactCount(equipped, artifact.id)).toBe(3);
    expect(getEquippedArtifact(equipped, artifact.slot)).toBe(artifact);
    expect(equipArtifact(equipped, artifact.id)).toBe(equipped);
    const expected = { ...ZERO_BONUSES };
    for (const stat of ARTIFACT_STATS) expected[stat] = artifact.bonuses[stat] ?? 0;
    expect(aggregateArtifactBonuses(equipped)).toEqual(expected);
    expect(isValidArtifactInventory(equipped)).toBe(true);
  });

  it('rejects unknown IDs and invalid quantities as reference-preserving no-ops', () => {
    const empty = createArtifactInventory();
    const stocked = addArtifact(empty, 'copperSunblade', 2);
    for (const id of UNKNOWN_IDS) {
      expect(getArtifactCount(stocked, id), id).toBe(0);
      expect(addArtifact(stocked, id), id).toBe(stocked);
      expect(removeArtifact(stocked, id), id).toBe(stocked);
      expect(equipArtifact(stocked, id), id).toBe(stocked);
      expect(unequipArtifact(stocked, id), id).toBe(stocked);
      expect(getEquippedArtifact(stocked, id), id).toBeUndefined();
    }
    for (const quantity of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(addArtifact(stocked, 'copperSunblade', quantity)).toBe(stocked);
      expect(removeArtifact(stocked, 'copperSunblade', quantity)).toBe(stocked);
    }
    expect(equipArtifact(stocked, 'starforgedBlade')).toBe(stocked);
    expect(removeArtifact(stocked, 'copperSunblade', 3)).toBe(stocked);
    expect(stocked.items).toEqual({ copperSunblade: 2 });
  });

  it('prevents stack overflow without changing a valid inventory', () => {
    const empty = createArtifactInventory();
    const maximum = addArtifact(empty, 'copperSunblade', Number.MAX_SAFE_INTEGER);
    expect(getArtifactCount(maximum, 'copperSunblade')).toBe(Number.MAX_SAFE_INTEGER);
    expect(addArtifact(maximum, 'copperSunblade')).toBe(maximum);
    expect(isValidArtifactInventory(maximum)).toBe(true);
  });

  it('decrements stacks and automatically unequips the last removed copy', () => {
    const stocked = addArtifact(createArtifactInventory(), 'copperSunblade', 3);
    const equipped = equipArtifact(stocked, 'copperSunblade');
    const two = removeArtifact(equipped, 'copperSunblade');
    expect(getArtifactCount(two, 'copperSunblade')).toBe(2);
    expect(two.equipped).toEqual({ weapon: 'copperSunblade' });
    expect(equipped.equipped).toEqual({ weapon: 'copperSunblade' });

    const empty = removeArtifact(two, 'copperSunblade', 2);
    expect(empty).toEqual({ items: {}, equipped: {} });
    expect(getEquippedArtifact(empty, 'weapon')).toBeUndefined();
    expect(isValidArtifactInventory(empty)).toBe(true);
  });

  it('replaces only the targeted slot and preserves replaced artifacts in the backpack', () => {
    let inventory = createArtifactInventory();
    inventory = addArtifact(inventory, 'copperSunblade');
    inventory = addArtifact(inventory, 'stormcallersEdge');
    inventory = addArtifact(inventory, 'sagesDiadem');
    inventory = equipArtifact(inventory, 'copperSunblade');
    inventory = equipArtifact(inventory, 'stormcallersEdge');
    expect(inventory.items).toEqual({ copperSunblade: 1, stormcallersEdge: 1, sagesDiadem: 1 });
    expect(inventory.equipped).toEqual({ weapon: 'stormcallersEdge' });
    expect(aggregateArtifactBonuses(inventory)).toEqual({ ...ZERO_BONUSES, attack: 2 });

    inventory = equipArtifact(inventory, 'sagesDiadem');
    expect(aggregateArtifactBonuses(inventory)).toEqual({
      attack: 2,
      defense: 0,
      spellPower: 1,
      knowledge: 1,
    });
    const withoutWeapon = unequipArtifact(inventory, 'weapon');
    expect(withoutWeapon.equipped).toEqual({ helmet: 'sagesDiadem' });
    expect(getArtifactCount(withoutWeapon, 'stormcallersEdge')).toBe(1);
    expect(unequipArtifact(withoutWeapon, 'weapon')).toBe(withoutWeapon);
    expect(aggregateArtifactBonuses(withoutWeapon)).toEqual({
      attack: 0,
      defense: 0,
      spellPower: 1,
      knowledge: 1,
    });
  });
});

describe('aggregate bonuses and inventory validation', () => {
  it('sums one copy of each equipped artifact across all five slots', () => {
    const ids = ['worldrenderMaul', 'bulwarkOfAges', 'mindfireCrown', 'bootsOfTheHorizon', 'astralHeart'];
    let inventory = createArtifactInventory();
    for (const id of ids) {
      inventory = addArtifact(inventory, id, 2);
      inventory = equipArtifact(inventory, id);
    }
    expect(aggregateArtifactBonuses(inventory)).toEqual({
      attack: 8,
      defense: 9,
      spellPower: 5,
      knowledge: 8,
    });
    expect(isValidArtifactInventory(inventory)).toBe(true);
  });

  it('ignores unequipped, unknown, inherited, mismatched, and unowned equipment', () => {
    let inventory = createArtifactInventory();
    for (const artifact of ARTIFACT_LIST) inventory = addArtifact(inventory, artifact.id);
    expect(aggregateArtifactBonuses(inventory)).toEqual(ZERO_BONUSES);

    const malformed = {
      items: JSON.parse('{"__proto__":4,"missing":3}'),
      equipped: {
        weapon: 'missing',
        armor: 'copperSunblade',
        helmet: 'toString',
        boots: 'starforgedBlade',
      },
    } as unknown as ArtifactInventory;
    expect(aggregateArtifactBonuses(malformed)).toEqual(ZERO_BONUSES);
    for (const slot of UNKNOWN_IDS) expect(getEquippedArtifact(malformed, slot)).toBeUndefined();
  });

  it('accepts empty, stacked, equipped, and null-prototype inventories', () => {
    expect(isValidArtifactInventory(createArtifactInventory())).toBe(true);
    const equipped = equipArtifact(
      addArtifact(createArtifactInventory(), 'copperSunblade', 3),
      'copperSunblade',
    );
    expect(isValidArtifactInventory(equipped)).toBe(true);
    const nullPrototype = {
      items: Object.assign(Object.create(null), { copperSunblade: 1 }),
      equipped: Object.assign(Object.create(null), { weapon: 'copperSunblade' }),
    };
    expect(isValidArtifactInventory(nullPrototype)).toBe(true);
  });

  it('rejects malformed structures and invalid item quantities', () => {
    const invalid: unknown[] = [
      null,
      undefined,
      [],
      {},
      { items: {} },
      { equipped: {} },
      { items: [], equipped: {} },
      { items: {}, equipped: [] },
      { items: null, equipped: {} },
      { items: {}, equipped: null },
      { items: { missing: 1 }, equipped: {} },
      { items: { copperSunblade: 0 }, equipped: {} },
      { items: { copperSunblade: -1 }, equipped: {} },
      { items: { copperSunblade: 1.5 }, equipped: {} },
      { items: { copperSunblade: Number.NaN }, equipped: {} },
      { items: { copperSunblade: Number.POSITIVE_INFINITY }, equipped: {} },
      { items: { copperSunblade: Number.MAX_SAFE_INTEGER + 1 }, equipped: {} },
      { items: { copperSunblade: '1' }, equipped: {} },
    ];
    for (const id of ['toString', 'constructor', '__proto__']) {
      invalid.push({ items: JSON.parse(`{"${id}":1}`), equipped: {} });
    }
    const inherited = Object.create({ items: {}, equipped: {} });
    invalid.push(inherited);
    for (const value of invalid) expect(isValidArtifactInventory(value)).toBe(false);
  });

  it('rejects unknown, inherited, mismatched, or unowned equipped IDs and slots', () => {
    const invalid: unknown[] = [
      { items: { copperSunblade: 1 }, equipped: { weapon: 'missing' } },
      { items: { copperSunblade: 1 }, equipped: { weapon: 'toString' } },
      { items: { copperSunblade: 1 }, equipped: { armor: 'copperSunblade' } },
      { items: {}, equipped: { weapon: 'copperSunblade' } },
      { items: { copperSunblade: 0 }, equipped: { weapon: 'copperSunblade' } },
      { items: { copperSunblade: 1 }, equipped: { weapon: null } },
      { items: { copperSunblade: 1 }, equipped: { weapon: 1 } },
      { items: { copperSunblade: 1 }, equipped: { ring: 'copperSunblade' } },
    ];
    for (const slot of ['toString', 'constructor', '__proto__']) {
      invalid.push({
        items: { copperSunblade: 1 },
        equipped: JSON.parse(`{"${slot}":"copperSunblade"}`),
      });
    }
    for (const value of invalid) expect(isValidArtifactInventory(value)).toBe(false);
  });
});
