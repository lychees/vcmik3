import type { TownBuildingInteraction } from '../town/TownScene';

export type TownTab = 'overview' | 'construction' | 'recruitment' | 'army' | 'spellbook';

export interface TownBuildingDestination {
  tab: TownTab;
  buildingId?: string;
  creatureId?: string;
}

export function getTownBuildingDestination(
  interaction: Readonly<TownBuildingInteraction>,
): TownBuildingDestination {
  if (!interaction.built) return { tab: 'construction', buildingId: interaction.buildingId };
  if (interaction.creatureId) {
    return { tab: 'recruitment', buildingId: interaction.buildingId, creatureId: interaction.creatureId };
  }
  if (interaction.buildingId === 'fort') return { tab: 'army', buildingId: interaction.buildingId };
  if (interaction.buildingId === 'mageGuild') return { tab: 'spellbook', buildingId: interaction.buildingId };
  return { tab: 'overview', buildingId: interaction.buildingId };
}
