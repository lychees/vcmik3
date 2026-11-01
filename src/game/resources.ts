export const CORE_RESOURCE_TYPES = [
  'gold',
  'wood',
  'ore',
  'crystal',
  'gems',
  'mercury',
  'sulfur',
] as const;

export const NEW_RESOURCE_TYPES = ['mithril', 'obsidian', 'essence'] as const;

export const EXTENDED_RESOURCE_TYPES = [
  ...CORE_RESOURCE_TYPES,
  ...NEW_RESOURCE_TYPES,
] as const;

export type CoreResourceType = typeof CORE_RESOURCE_TYPES[number];
export type NewResourceType = typeof NEW_RESOURCE_TYPES[number];
export type ExtendedResourceType = typeof EXTENDED_RESOURCE_TYPES[number];
export type ExtendedResourceAmounts = Partial<Record<ExtendedResourceType, number>>;
export type ExtendedResourceBundle = Record<ExtendedResourceType, number>;

export interface NewResourceDefinition {
  readonly id: NewResourceType;
  readonly name: string;
  readonly description: string;
  readonly color: number;
  readonly goldValue: number;
  readonly mineDailyOutput: number;
  readonly pickupRange: readonly [number, number];
}

export const NEW_RESOURCES: Readonly<Record<NewResourceType, NewResourceDefinition>> = {
  mithril: {
    id: 'mithril',
    name: 'Mithril',
    description: 'A light, silver-blue metal used to forge resilient weapons and armor.',
    color: 0x9fc7d8,
    goldValue: 600,
    mineDailyOutput: 1,
    pickupRange: [2, 4],
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Volcanic glass prized for keen edges and protective enchantments.',
    color: 0x493d5e,
    goldValue: 750,
    mineDailyOutput: 1,
    pickupRange: [2, 3],
  },
  essence: {
    id: 'essence',
    name: 'Essence',
    description: 'Condensed magical energy used to empower spell-focused equipment.',
    color: 0x73e0c1,
    goldValue: 900,
    mineDailyOutput: 1,
    pickupRange: [1, 3],
  },
};

export function isExtendedResourceType(value: unknown): value is ExtendedResourceType {
  return typeof value === 'string' &&
    (EXTENDED_RESOURCE_TYPES as readonly string[]).includes(value);
}

export function getNewResource(id: string): NewResourceDefinition | undefined {
  return Object.hasOwn(NEW_RESOURCES, id)
    ? NEW_RESOURCES[id as NewResourceType]
    : undefined;
}

export function isValidExtendedResourceAmounts(value: unknown): value is ExtendedResourceAmounts {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.entries(value).every(([resource, amount]) =>
    isExtendedResourceType(resource) && Number.isSafeInteger(amount) && amount >= 0);
}

function ownAmount(amounts: Readonly<ExtendedResourceAmounts>, resource: ExtendedResourceType): number {
  return Object.hasOwn(amounts, resource) ? amounts[resource] ?? 0 : 0;
}

export function createExtendedResourceBundle(
  initial: Readonly<ExtendedResourceAmounts> = {},
): ExtendedResourceBundle {
  const bundle: ExtendedResourceBundle = {
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
  };
  for (const resource of EXTENDED_RESOURCE_TYPES) {
    bundle[resource] = ownAmount(initial, resource);
  }
  return bundle;
}

export function addExtendedResources(
  resources: Readonly<ExtendedResourceAmounts>,
  gain: Readonly<ExtendedResourceAmounts>,
): ExtendedResourceBundle | null {
  if (!isValidExtendedResourceAmounts(resources) || !isValidExtendedResourceAmounts(gain)) {
    return null;
  }
  const result = createExtendedResourceBundle(resources);
  for (const resource of EXTENDED_RESOURCE_TYPES) {
    const total = result[resource] + ownAmount(gain, resource);
    if (!Number.isSafeInteger(total)) return null;
    result[resource] = total;
  }
  return result;
}

export function canAffordExtendedResources(
  resources: Readonly<ExtendedResourceAmounts>,
  cost: Readonly<ExtendedResourceAmounts>,
): boolean {
  if (!isValidExtendedResourceAmounts(resources) || !isValidExtendedResourceAmounts(cost)) {
    return false;
  }
  return EXTENDED_RESOURCE_TYPES.every((resource) =>
    ownAmount(resources, resource) >= ownAmount(cost, resource));
}

export function spendExtendedResources(
  resources: Readonly<ExtendedResourceAmounts>,
  cost: Readonly<ExtendedResourceAmounts>,
): ExtendedResourceBundle | null {
  if (!canAffordExtendedResources(resources, cost)) return null;
  const result = createExtendedResourceBundle(resources);
  for (const resource of EXTENDED_RESOURCE_TYPES) {
    result[resource] -= ownAmount(cost, resource);
  }
  return result;
}

export function getMissingExtendedResources(
  resources: Readonly<ExtendedResourceAmounts>,
  cost: Readonly<ExtendedResourceAmounts>,
): ExtendedResourceAmounts {
  const missing: ExtendedResourceAmounts = {};
  for (const resource of EXTENDED_RESOURCE_TYPES) {
    const amount = Math.max(0, ownAmount(cost, resource) - ownAmount(resources, resource));
    if (amount > 0) missing[resource] = amount;
  }
  return missing;
}
