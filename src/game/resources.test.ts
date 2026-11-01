import { describe, expect, it } from 'vitest';
import {
  CORE_RESOURCE_TYPES,
  EXTENDED_RESOURCE_TYPES,
  NEW_RESOURCE_TYPES,
  NEW_RESOURCES,
  addExtendedResources,
  canAffordExtendedResources,
  createExtendedResourceBundle,
  getMissingExtendedResources,
  getNewResource,
  isExtendedResourceType,
  isValidExtendedResourceAmounts,
  spendExtendedResources,
} from './resources';
import type { ExtendedResourceAmounts } from './resources';

const UNKNOWN_IDS = ['toString', 'constructor', '__proto__', 'missing', 'Mithril'] as const;

const LEGACY_STOCK = {
  gold: 1000,
  wood: 10,
  ore: 8,
  crystal: 4,
  gems: 3,
  mercury: 2,
  sulfur: 5,
};

describe('extended resource registry', () => {
  it('defines the seven existing and exactly three new resource types in stable order', () => {
    expect(CORE_RESOURCE_TYPES).toEqual(['gold', 'wood', 'ore', 'crystal', 'gems', 'mercury', 'sulfur']);
    expect(NEW_RESOURCE_TYPES).toEqual(['mithril', 'obsidian', 'essence']);
    expect(EXTENDED_RESOURCE_TYPES).toEqual([...CORE_RESOURCE_TYPES, ...NEW_RESOURCE_TYPES]);
    expect(new Set(EXTENDED_RESOURCE_TYPES).size).toBe(10);
    expect(Object.keys(NEW_RESOURCES)).toEqual(NEW_RESOURCE_TYPES);
  });

  it('provides complete, distinct metadata and balanced pickup values', () => {
    expect(new Set(Object.values(NEW_RESOURCES).map((resource) => resource.name)).size).toBe(3);
    expect(new Set(Object.values(NEW_RESOURCES).map((resource) => resource.color)).size).toBe(3);
    const averagePickupValues: number[] = [];
    for (const id of NEW_RESOURCE_TYPES) {
      const resource = NEW_RESOURCES[id];
      expect(resource.id).toBe(id);
      expect(resource.name.length).toBeGreaterThan(0);
      expect(resource.description.length).toBeGreaterThan(20);
      expect(Number.isInteger(resource.color)).toBe(true);
      expect(resource.color).toBeGreaterThanOrEqual(0);
      expect(resource.color).toBeLessThanOrEqual(0xffffff);
      expect(resource.goldValue).toBeGreaterThan(0);
      expect(resource.mineDailyOutput).toBe(1);
      expect(Number.isInteger(resource.pickupRange[0])).toBe(true);
      expect(Number.isInteger(resource.pickupRange[1])).toBe(true);
      expect(resource.pickupRange[0]).toBeGreaterThan(0);
      expect(resource.pickupRange[1]).toBeGreaterThanOrEqual(resource.pickupRange[0]);
      averagePickupValues.push(
        (resource.pickupRange[0] + resource.pickupRange[1]) * resource.goldValue / 2,
      );
    }
    expect(Math.max(...averagePickupValues) - Math.min(...averagePickupValues)).toBeLessThanOrEqual(75);
  });

  it('uses own-property-safe lookups and strict runtime type guards', () => {
    for (const id of EXTENDED_RESOURCE_TYPES) expect(isExtendedResourceType(id)).toBe(true);
    for (const id of NEW_RESOURCE_TYPES) expect(getNewResource(id)).toBe(NEW_RESOURCES[id]);
    for (const id of UNKNOWN_IDS) {
      expect(isExtendedResourceType(id), id).toBe(false);
      expect(getNewResource(id), id).toBeUndefined();
    }
    expect(getNewResource('gold')).toBeUndefined();
    for (const value of [null, undefined, 1, false, {}, []]) {
      expect(isExtendedResourceType(value)).toBe(false);
    }
  });
});

describe('extended resource amounts', () => {
  it('validates known nonnegative safe-integer amounts, including null-prototype records', () => {
    const nullPrototype = Object.assign(Object.create(null), { mithril: 2, wood: 4 });
    expect(isValidExtendedResourceAmounts({})).toBe(true);
    expect(isValidExtendedResourceAmounts(LEGACY_STOCK)).toBe(true);
    expect(isValidExtendedResourceAmounts(createExtendedResourceBundle())).toBe(true);
    expect(isValidExtendedResourceAmounts(nullPrototype)).toBe(true);
  });

  it('rejects malformed records, unknown and inherited IDs, and invalid quantities', () => {
    const invalid: unknown[] = [
      null,
      undefined,
      [],
      'mithril',
      1,
      { unknown: 1 },
      { Mithril: 1 },
      { mithril: -1 },
      { mithril: 1.5 },
      { mithril: Number.NaN },
      { mithril: Number.POSITIVE_INFINITY },
      { mithril: Number.MAX_SAFE_INTEGER + 1 },
      { mithril: '2' },
    ];
    for (const id of ['toString', 'constructor', '__proto__']) {
      invalid.push(JSON.parse(`{"${id}":1}`));
    }
    for (const value of invalid) expect(isValidExtendedResourceAmounts(value)).toBe(false);
  });

  it('creates complete bundles from partial or legacy stock without retaining unknown keys', () => {
    expect(createExtendedResourceBundle()).toEqual({
      gold: 0,
      wood: 0,
      ore: 0,
      crystal: 0,
      gems: 0,
      mercury: 0,
      sulfur: 0,
      mithril: 0,
      obsidian: 0,
      essence: 0,
    });
    const initial = { ...LEGACY_STOCK, mithril: 4 };
    const bundle = createExtendedResourceBundle(initial);
    expect(bundle).toEqual({ ...initial, obsidian: 0, essence: 0 });
    expect(Object.keys(bundle)).toEqual(EXTENDED_RESOURCE_TYPES);
    expect(initial).toEqual({ ...LEGACY_STOCK, mithril: 4 });

    const unsafe = JSON.parse('{"gold":25,"mithril":2,"__proto__":900,"unknown":4}') as ExtendedResourceAmounts;
    const sanitized = createExtendedResourceBundle(unsafe);
    expect(sanitized.gold).toBe(25);
    expect(sanitized.mithril).toBe(2);
    expect(Object.hasOwn(sanitized, '__proto__')).toBe(false);
    expect(Object.hasOwn(sanitized, 'unknown')).toBe(false);
  });
});

describe('pure extended resource helpers', () => {
  it('calculates missing costs for both legacy and new resources', () => {
    const stock = { ...LEGACY_STOCK, mithril: 2 };
    expect(getMissingExtendedResources(stock, {
      gold: 1001,
      wood: 10,
      ore: 4,
      mithril: 5,
      obsidian: 1,
      essence: 0,
    })).toEqual({ gold: 1, mithril: 3, obsidian: 1 });
    expect(getMissingExtendedResources(stock, {})).toEqual({});
  });

  it('checks affordability at exact boundaries and rejects malformed inputs', () => {
    const stock = { ...LEGACY_STOCK, mithril: 4, obsidian: 2 };
    expect(canAffordExtendedResources(stock, { gold: 1000, wood: 10, mithril: 4, obsidian: 2 })).toBe(true);
    expect(canAffordExtendedResources(stock, { gold: 1001 })).toBe(false);
    expect(canAffordExtendedResources(stock, { essence: 1 })).toBe(false);
    expect(canAffordExtendedResources(stock, {})).toBe(true);
    expect(canAffordExtendedResources(stock, { mithril: -1 })).toBe(false);
    expect(canAffordExtendedResources(stock, { mithril: 1.5 })).toBe(false);
    expect(canAffordExtendedResources({ ...stock, gold: Number.NaN }, {})).toBe(false);
    expect(canAffordExtendedResources(stock, JSON.parse('{"__proto__":1}'))).toBe(false);
  });

  it('adds resources without mutating either input and includes all ten resource keys', () => {
    const stock = createExtendedResourceBundle({ ...LEGACY_STOCK, mithril: 2 });
    const gain = { gold: 250, wood: 3, mithril: 2, obsidian: 1, essence: 4 };
    const result = addExtendedResources(stock, gain);
    expect(result).not.toBeNull();
    if (!result) throw new Error('Expected valid resource addition');
    expect(result).toMatchObject({
      ...LEGACY_STOCK,
      gold: 1250,
      wood: 13,
      mithril: 4,
      obsidian: 1,
      essence: 4,
    });
    expect(Object.keys(result)).toEqual(EXTENDED_RESOURCE_TYPES);
    expect(stock.mithril).toBe(2);
    expect(stock.obsidian).toBe(0);
    expect(gain).toEqual({ gold: 250, wood: 3, mithril: 2, obsidian: 1, essence: 4 });
  });

  it('allows addition exactly up to MAX_SAFE_INTEGER', () => {
    const result = addExtendedResources(
      { gold: Number.MAX_SAFE_INTEGER - 1, mithril: Number.MAX_SAFE_INTEGER },
      { gold: 1, wood: 2 },
    );
    expect(result).not.toBeNull();
    if (!result) throw new Error('Expected safe boundary addition');
    expect(result.gold).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.mithril).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.wood).toBe(2);
    expect(isValidExtendedResourceAmounts(result)).toBe(true);
  });

  it('returns null atomically when any resource addition would overflow', () => {
    const stock = createExtendedResourceBundle({ gold: Number.MAX_SAFE_INTEGER, wood: 7 });
    const gain = { gold: 1, mithril: 4 };
    const stockBefore = JSON.stringify(stock);
    const gainBefore = JSON.stringify(gain);
    expect(addExtendedResources(stock, gain)).toBeNull();
    expect(JSON.stringify(stock)).toBe(stockBefore);
    expect(JSON.stringify(gain)).toBe(gainBefore);
    expect(addExtendedResources({ mithril: Number.MAX_SAFE_INTEGER }, { mithril: 1 })).toBeNull();
    expect(addExtendedResources(
      { essence: Number.MAX_SAFE_INTEGER },
      { essence: Number.MAX_SAFE_INTEGER },
    )).toBeNull();
  });

  it('rejects invalid runtime addition operands without changing the valid operand', () => {
    const valid = { gold: 1, mithril: 2 };
    const invalid: unknown[] = [
      null,
      undefined,
      [],
      { gold: -1 },
      { gold: 1.5 },
      { gold: Number.NaN },
      { gold: Number.POSITIVE_INFINITY },
      { gold: Number.MAX_SAFE_INTEGER + 1 },
      { gold: '1' },
      { unknown: 1 },
      JSON.parse('{"__proto__":1}'),
    ];
    for (const value of invalid) {
      const operand = value as ExtendedResourceAmounts;
      expect(addExtendedResources(valid, operand)).toBeNull();
      expect(addExtendedResources(operand, valid)).toBeNull();
    }
    expect(valid).toEqual({ gold: 1, mithril: 2 });
  });

  it('spends exact costs immutably and returns null without changes when unaffordable', () => {
    const stock = createExtendedResourceBundle({ ...LEGACY_STOCK, mithril: 4, obsidian: 2 });
    const cost = { gold: 1000, wood: 10, mithril: 4, essence: 0 };
    const spent = spendExtendedResources(stock, cost);
    expect(spent).toMatchObject({ gold: 0, wood: 0, mithril: 0, obsidian: 2, essence: 0 });
    expect(stock).toMatchObject({ gold: 1000, wood: 10, mithril: 4 });
    expect(cost).toEqual({ gold: 1000, wood: 10, mithril: 4, essence: 0 });

    const before = JSON.stringify(stock);
    expect(spendExtendedResources(stock, { obsidian: 3 })).toBeNull();
    expect(spendExtendedResources(stock, { essence: 1 })).toBeNull();
    expect(spendExtendedResources(stock, { mithril: -1 })).toBeNull();
    expect(JSON.stringify(stock)).toBe(before);
  });
});
