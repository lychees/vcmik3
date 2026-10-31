import { describe, expect, it } from 'vitest';
import { BUILDINGS, CREATURES } from '../game/content';
import { FACTIONS } from '../game/factions';
import {
  BUILDING_MODEL_REGISTRY,
  COMMON_BUILDING_IDS,
  getBuildingModelSpec,
  getTownBuildingSpecs,
  resolveFactionId,
} from './registry';

describe('town building model registry', () => {
  it('has exact parity with every current BUILDINGS ID', () => {
    expect(Object.keys(BUILDINGS)).toHaveLength(57);
    expect(Object.keys(BUILDING_MODEL_REGISTRY).sort()).toEqual(Object.keys(BUILDINGS).sort());
    for (const [id, definition] of Object.entries(BUILDINGS)) {
      const spec = getBuildingModelSpec(id);
      expect(spec.id).toBe(definition.id);
      expect(spec.footprint).toHaveLength(2);
      expect(spec.footprint.every((value) => Number.isFinite(value) && value > 0)).toBe(true);
      expect(spec.height).toBeGreaterThan(0);
    }
  });

  it('covers five common structures and exactly four correct-tier dwellings per faction', () => {
    expect(COMMON_BUILDING_IDS).toEqual(['townHall', 'capitol', 'market', 'fort', 'mageGuild']);
    expect(Object.keys(FACTIONS)).toHaveLength(13);
    const coveredDwellings = new Set<string>();
    for (const faction of Object.values(FACTIONS)) {
      expect(resolveFactionId(faction.name)).toBe(faction.id);
      const specs = getTownBuildingSpecs(faction.id);
      expect(specs).toHaveLength(9);
      expect(specs.map((spec) => spec.id)).toEqual([...COMMON_BUILDING_IDS, ...faction.buildingIds]);
      expect(new Set(specs.map((spec) => spec.id)).size).toBe(9);
      for (const id of COMMON_BUILDING_IDS) {
        const spec = getBuildingModelSpec(id);
        expect(spec.category).toBe('common');
        expect(spec.faction).toBeNull();
        expect(spec.tier).toBe(0);
      }
      faction.buildingIds.forEach((id, index) => {
        const spec = getBuildingModelSpec(id);
        const definition = BUILDINGS[id]!;
        expect(spec.category).toBe('dwelling');
        expect(spec.faction).toBe(faction.id);
        expect(spec.tier).toBe(index + 1);
        expect(definition.creatureId).toBe(faction.creatureIds[index]);
        expect(CREATURES[definition.creatureId!]?.faction).toBe(faction.name);
        coveredDwellings.add(id);
      });
    }
    expect(coveredDwellings.size).toBe(52);
  });

  it('rejects unknown content instead of substituting an unrelated model', () => {
    expect(() => getBuildingModelSpec('unknownCivicPalace')).toThrow('No town model specification');
    expect(() => resolveFactionId('UnknownFaction')).toThrow('No town model architecture');
  });
});
