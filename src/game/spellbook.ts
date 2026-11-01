import { SPELLS } from './content';
import { EXPANDED_SPELL_LIST, EXPANDED_SPELLS, isExpandedSpellId } from './spells';
import type { ExpandedSpellDefinition } from './spells';
import type { SpellDefinition } from './types';

export type CombatSpellDefinition = SpellDefinition | ExpandedSpellDefinition;

export const COMBAT_SPELL_LIST: readonly CombatSpellDefinition[] = [
  ...Object.values(SPELLS),
  ...EXPANDED_SPELL_LIST,
].sort((a, b) => a.level - b.level || a.id.localeCompare(b.id));

export function isCombatSpellId(id: string): boolean {
  return Object.hasOwn(SPELLS, id) || isExpandedSpellId(id);
}

export function getCombatSpell(id: string): CombatSpellDefinition {
  if (Object.hasOwn(SPELLS, id)) return SPELLS[id]!;
  if (isExpandedSpellId(id)) return EXPANDED_SPELLS[id];
  throw new Error(`Unknown spell: ${id}`);
}

export function createDefaultSpellbook(): string[] {
  return COMBAT_SPELL_LIST.map((spell) => spell.id);
}

export function sortSpellbook(spellIds: readonly string[]): string[] {
  const known = new Set(spellIds.filter(isCombatSpellId));
  return COMBAT_SPELL_LIST.filter((spell) => known.has(spell.id)).map((spell) => spell.id);
}
