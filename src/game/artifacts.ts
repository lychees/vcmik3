import type { HeroState, PrimarySkills } from './types';

export const ARTIFACT_SLOTS = ['weapon', 'armor', 'helmet', 'boots', 'trinket'] as const;
export const ARTIFACT_RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
export const ARTIFACT_STATS = ['attack', 'defense', 'spellPower', 'knowledge'] as const;

export type ArtifactSlot = typeof ARTIFACT_SLOTS[number];
export type ArtifactRarity = typeof ARTIFACT_RARITIES[number];
export type ArtifactStat = typeof ARTIFACT_STATS[number];
export type ArtifactStatBonuses = Partial<Record<ArtifactStat, number>>;
export type AggregateArtifactBonuses = Record<ArtifactStat, number>;

export interface ArtifactDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly slot: ArtifactSlot;
  readonly rarity: ArtifactRarity;
  readonly bonuses: Readonly<ArtifactStatBonuses>;
}

let customArtifacts: Record<string, ArtifactDefinition> = Object.create(null) as Record<string, ArtifactDefinition>;

export const ARTIFACTS: Readonly<Record<string, ArtifactDefinition>> = {
  copperSunblade: {
    id: 'copperSunblade',
    name: 'Copper Sunblade',
    description: 'A dawn-warmed blade that lends its bearer a surer strike.',
    slot: 'weapon',
    rarity: 'common',
    bonuses: { attack: 1 },
  },
  stormcallersEdge: {
    id: 'stormcallersEdge',
    name: "Stormcaller's Edge",
    description: 'A hooked blade whose edge hums with captive thunder.',
    slot: 'weapon',
    rarity: 'rare',
    bonuses: { attack: 2 },
  },
  starforgedBlade: {
    id: 'starforgedBlade',
    name: 'Starforged Blade',
    description: 'Meteoric steel sharpens both the wielder\'s arm and guard.',
    slot: 'weapon',
    rarity: 'epic',
    bonuses: { attack: 3, defense: 1 },
  },
  worldrenderMaul: {
    id: 'worldrenderMaul',
    name: 'Worldrender Maul',
    description: 'An immense hammer whose measured swings reveal every opening.',
    slot: 'weapon',
    rarity: 'legendary',
    bonuses: { attack: 5, defense: 1 },
  },
  mosswovenCuirass: {
    id: 'mosswovenCuirass',
    name: 'Mosswoven Cuirass',
    description: 'Living moss cushions blows against this bark-backed mail.',
    slot: 'armor',
    rarity: 'common',
    bonuses: { defense: 1 },
  },
  mirrorScale: {
    id: 'mirrorScale',
    name: 'Mirror Scale',
    description: 'Interlocking silver scales turn aside a foe\'s careful aim.',
    slot: 'armor',
    rarity: 'rare',
    bonuses: { defense: 2 },
  },
  aegisOfEmbers: {
    id: 'aegisOfEmbers',
    name: 'Aegis of Embers',
    description: 'Banked fire within this breastplate answers every attack.',
    slot: 'armor',
    rarity: 'epic',
    bonuses: { attack: 1, defense: 3 },
  },
  bulwarkOfAges: {
    id: 'bulwarkOfAges',
    name: 'Bulwark of Ages',
    description: 'Ancient plates remember the tactics of every defender.',
    slot: 'armor',
    rarity: 'legendary',
    bonuses: { defense: 5, knowledge: 1 },
  },
  wayfarersCirclet: {
    id: 'wayfarersCirclet',
    name: "Wayfarer's Circlet",
    description: 'A travel-stained circlet that keeps old lessons close.',
    slot: 'helmet',
    rarity: 'common',
    bonuses: { knowledge: 1 },
  },
  sagesDiadem: {
    id: 'sagesDiadem',
    name: "Sage's Diadem",
    description: 'Twin moonstones join memory to the shaping of spells.',
    slot: 'helmet',
    rarity: 'rare',
    bonuses: { spellPower: 1, knowledge: 1 },
  },
  crownOfStarlight: {
    id: 'crownOfStarlight',
    name: 'Crown of Starlight',
    description: 'Cold points of starlight illuminate the deeper currents of magic.',
    slot: 'helmet',
    rarity: 'epic',
    bonuses: { spellPower: 2, knowledge: 2 },
  },
  mindfireCrown: {
    id: 'mindfireCrown',
    name: 'Mindfire Crown',
    description: 'A controlled flame burns away distraction and kindles arcane insight.',
    slot: 'helmet',
    rarity: 'legendary',
    bonuses: { spellPower: 3, knowledge: 3 },
  },
  surefootGreaves: {
    id: 'surefootGreaves',
    name: 'Surefoot Greaves',
    description: 'Balanced greaves keep a warrior steady beneath heavy blows.',
    slot: 'boots',
    rarity: 'common',
    bonuses: { defense: 1 },
  },
  windrunnerBoots: {
    id: 'windrunnerBoots',
    name: 'Windrunner Boots',
    description: 'A following wind speeds both advance and timely retreat.',
    slot: 'boots',
    rarity: 'rare',
    bonuses: { attack: 1, defense: 1 },
  },
  thunderstrideSabatons: {
    id: 'thunderstrideSabatons',
    name: 'Thunderstride Sabatons',
    description: 'Each ringing step carries the force and fury of a storm.',
    slot: 'boots',
    rarity: 'epic',
    bonuses: { attack: 2, spellPower: 2 },
  },
  bootsOfTheHorizon: {
    id: 'bootsOfTheHorizon',
    name: 'Boots of the Horizon',
    description: 'Far-seeing enchantments reveal paths for attack, defense, and study.',
    slot: 'boots',
    rarity: 'legendary',
    bonuses: { attack: 2, defense: 2, knowledge: 2 },
  },
  dawnstoneCharm: {
    id: 'dawnstoneCharm',
    name: 'Dawnstone Charm',
    description: 'The first light of morning lingers in this small focus.',
    slot: 'trinket',
    rarity: 'common',
    bonuses: { spellPower: 1 },
  },
  whisperingLocket: {
    id: 'whisperingLocket',
    name: 'Whispering Locket',
    description: 'A quiet voice within recites forgotten names and places.',
    slot: 'trinket',
    rarity: 'rare',
    bonuses: { knowledge: 2 },
  },
  phoenixHourglass: {
    id: 'phoenixHourglass',
    name: 'Phoenix Hourglass',
    description: 'Embers turning in glass grant a measured spark to every discipline.',
    slot: 'trinket',
    rarity: 'epic',
    bonuses: { attack: 1, defense: 1, spellPower: 1, knowledge: 1 },
  },
  astralHeart: {
    id: 'astralHeart',
    name: 'Astral Heart',
    description: 'A fragment of the night sky beats in time with its bearer.',
    slot: 'trinket',
    rarity: 'legendary',
    bonuses: { attack: 1, defense: 1, spellPower: 2, knowledge: 2 },
  },
};

export const ARTIFACT_LIST: readonly ArtifactDefinition[] = Object.values(ARTIFACTS);
export const ARTIFACT_IDS: readonly string[] = Object.keys(ARTIFACTS);

export interface ArtifactInventory {
  readonly items: Readonly<Record<string, number>>;
  readonly equipped: Readonly<Partial<Record<ArtifactSlot, string>>>;
}

export function isArtifactSlot(value: unknown): value is ArtifactSlot {
  return typeof value === 'string' && (ARTIFACT_SLOTS as readonly string[]).includes(value);
}

export function registerCustomArtifacts(definitions: readonly ArtifactDefinition[]): void {
  const next: Record<string, ArtifactDefinition> = Object.create(null) as Record<string, ArtifactDefinition>;
  for (const definition of definitions) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(definition.id) || Object.hasOwn(ARTIFACTS, definition.id) ||
      Object.hasOwn(next, definition.id)) throw new Error(`Invalid or duplicate custom artifact: ${definition.id}`);
    next[definition.id] = { ...definition, bonuses: { ...definition.bonuses } };
  }
  customArtifacts = next;
}

export function getArtifact(id: string): ArtifactDefinition | undefined {
  if (Object.hasOwn(ARTIFACTS, id)) return ARTIFACTS[id];
  return Object.hasOwn(customArtifacts, id) ? customArtifacts[id] : undefined;
}

export function createArtifactInventory(): ArtifactInventory {
  return { items: {}, equipped: {} };
}

export function getArtifactCount(inventory: ArtifactInventory, id: string): number {
  if (!getArtifact(id) || !Object.hasOwn(inventory.items, id)) return 0;
  const count = inventory.items[id] ?? 0;
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

export function addArtifact(
  inventory: ArtifactInventory,
  id: string,
  quantity = 1,
): ArtifactInventory {
  if (!getArtifact(id) || !Number.isSafeInteger(quantity) || quantity <= 0) return inventory;
  const count = getArtifactCount(inventory, id);
  if (!Number.isSafeInteger(count + quantity)) return inventory;
  return {
    items: { ...inventory.items, [id]: count + quantity },
    equipped: inventory.equipped,
  };
}

export function removeArtifact(
  inventory: ArtifactInventory,
  id: string,
  quantity = 1,
): ArtifactInventory {
  if (!getArtifact(id) || !Number.isSafeInteger(quantity) || quantity <= 0) return inventory;
  const count = getArtifactCount(inventory, id);
  if (count < quantity) return inventory;
  const items = { ...inventory.items };
  let equipped = inventory.equipped;
  if (count === quantity) {
    delete items[id];
    const artifact = getArtifact(id);
    if (artifact && Object.hasOwn(equipped, artifact.slot) && equipped[artifact.slot] === id) {
      equipped = { ...equipped };
      delete equipped[artifact.slot];
    }
  } else {
    items[id] = count - quantity;
  }
  return { items, equipped };
}

export function equipArtifact(inventory: ArtifactInventory, id: string): ArtifactInventory {
  const artifact = getArtifact(id);
  if (!artifact || getArtifactCount(inventory, id) === 0) return inventory;
  if (Object.hasOwn(inventory.equipped, artifact.slot) && inventory.equipped[artifact.slot] === id) {
    return inventory;
  }
  return {
    items: inventory.items,
    equipped: { ...inventory.equipped, [artifact.slot]: id },
  };
}

export function unequipArtifact(inventory: ArtifactInventory, slot: string): ArtifactInventory {
  if (!isArtifactSlot(slot) || !Object.hasOwn(inventory.equipped, slot)) return inventory;
  const equipped = { ...inventory.equipped };
  delete equipped[slot];
  return { items: inventory.items, equipped };
}

export function getEquippedArtifact(
  inventory: ArtifactInventory,
  slot: string,
): ArtifactDefinition | undefined {
  if (!isArtifactSlot(slot) || !Object.hasOwn(inventory.equipped, slot)) return undefined;
  const id = inventory.equipped[slot];
  if (typeof id !== 'string') return undefined;
  const artifact = getArtifact(id);
  if (!artifact || artifact.slot !== slot || getArtifactCount(inventory, id) === 0) return undefined;
  return artifact;
}

export function aggregateArtifactBonuses(inventory: ArtifactInventory): AggregateArtifactBonuses {
  const totals: AggregateArtifactBonuses = {
    attack: 0,
    defense: 0,
    spellPower: 0,
    knowledge: 0,
  };
  for (const slot of ARTIFACT_SLOTS) {
    const artifact = getEquippedArtifact(inventory, slot);
    if (!artifact) continue;
    for (const stat of ARTIFACT_STATS) totals[stat] += artifact.bonuses[stat] ?? 0;
  }
  return totals;
}

export function getEffectivePrimarySkills(
  hero: Pick<HeroState, 'primarySkills' | 'artifacts'>,
): PrimarySkills {
  const bonuses = aggregateArtifactBonuses(hero.artifacts);
  return {
    attack: hero.primarySkills.attack + bonuses.attack,
    defense: hero.primarySkills.defense + bonuses.defense,
    spellPower: hero.primarySkills.spellPower + bonuses.spellPower,
    knowledge: hero.primarySkills.knowledge + bonuses.knowledge,
  };
}

export function getHeroMaxMana(hero: Pick<HeroState, 'primarySkills' | 'artifacts'>): number {
  return getEffectivePrimarySkills(hero).knowledge * 10;
}

export function synchronizeHeroMana(hero: HeroState): void {
  hero.maxMana = getHeroMaxMana(hero);
  hero.mana = Math.max(0, Math.min(hero.maxMana, hero.mana));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isValidArtifactInventory(value: unknown): value is ArtifactInventory {
  if (!isRecord(value) || !Object.hasOwn(value, 'items') || !Object.hasOwn(value, 'equipped')) {
    return false;
  }
  const items = value.items;
  const equipped = value.equipped;
  if (!isRecord(items) || !isRecord(equipped)) return false;

  for (const [id, count] of Object.entries(items)) {
    if (!getArtifact(id) || typeof count !== 'number' || !Number.isSafeInteger(count) || count <= 0) return false;
  }
  for (const [slot, id] of Object.entries(equipped)) {
    if (!isArtifactSlot(slot) || typeof id !== 'string') return false;
    const artifact = getArtifact(id);
    if (!artifact || artifact.slot !== slot || !Object.hasOwn(items, id)) return false;
    const count = items[id];
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count <= 0) return false;
  }
  return true;
}
