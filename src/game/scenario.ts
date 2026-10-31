import { getCreature, getFaction, getHeroDefinition, startingResources } from './content';
import { updateAllFog } from './fog';
import { createAdventureMap } from './map';
import { hashSeed } from './random';
import type { GameState, HeroDefinition, HeroState, Point, TownState } from './types';

export const HUMAN_PLAYER_ID = 'red';
export const AI_PLAYER_ID = 'blue';

export function createHeroState(
  definitionId: string,
  id: string,
  ownerId: string,
  position: Point,
): HeroState {
  const definition: HeroDefinition = getHeroDefinition(definitionId);
  return {
    id,
    definitionId,
    name: definition.name,
    ownerId,
    position: { ...position },
    level: 1,
    experience: 0,
    primarySkills: { ...definition.primarySkills },
    mana: definition.primarySkills.knowledge * 10,
    maxMana: definition.primarySkills.knowledge * 10,
    movementPoints: 1500,
    maxMovementPoints: 1500,
    army: definition.startingArmy.map((stack) => ({ ...stack })),
    spells: [...definition.spells],
    alive: true,
  };
}

export function createInitialGameState(seed = 'h3core-default'): GameState {
  const map = createAdventureMap(seed);
  const roadY = Math.floor(map.height / 2);
  const northTownY = 4;
  const southTownY = map.height - 5;
  const originalGarrisonCounts: Record<string, number> = {
    haven: 12,
    grove: 16,
    ember: 14,
    mire: 14,
  };
  const towns: Record<string, TownState> = {};
  for (const object of Object.values(map.objects)) {
    if (object.kind !== 'town') continue;
    const faction = getFaction(object.townId);
    const creature = getCreature(faction.creatureIds[0]);
    towns[faction.id] = {
      id: faction.id,
      name: faction.townName,
      ownerId: faction.id === 'haven' || faction.id === 'ember' ? HUMAN_PLAYER_ID : AI_PLAYER_ID,
      faction: faction.name,
      position: { ...object.position },
      buildings: ['townHall', 'fort', faction.buildingIds[0]],
      garrison: [{ creatureId: creature.id, count: originalGarrisonCounts[faction.id] ?? creature.growth }],
      dwellingPools: { [creature.id]: creature.growth },
      builtToday: false,
    };
  }
  const state: GameState = {
    version: 1,
    seed,
    rngState: hashSeed(`${seed}:simulation`),
    revision: 0,
    map,
    players: {
      [HUMAN_PLAYER_ID]: {
        id: HUMAN_PLAYER_ID, name: 'Azure League', color: '#4aa8e0', isAI: false,
        resources: startingResources(),
      },
      [AI_PLAYER_ID]: {
        id: AI_PLAYER_ID, name: 'Lunar Covenant', color: '#d66554', isAI: true,
        resources: startingResources(),
      },
    },
    playerOrder: [HUMAN_PLAYER_ID, AI_PLAYER_ID],
    activePlayerId: HUMAN_PLAYER_ID,
    selectedHeroId: 'hero-aveline',
    heroes: {
      'hero-aveline': createHeroState('aveline', 'hero-aveline', HUMAN_PLAYER_ID, { x: 3, y: roadY - 2 }),
      'hero-rowan': createHeroState('rowan', 'hero-rowan', AI_PLAYER_ID, { x: map.width - 4, y: roadY + 2 }),
      'hero-seraphine': createHeroState('seraphine', 'hero-seraphine', HUMAN_PLAYER_ID, { x: 5, y: northTownY }),
      'hero-morven': createHeroState('morven', 'hero-morven', AI_PLAYER_ID, { x: map.width - 6, y: southTownY }),
    },
    towns,
    fog: {
      [HUMAN_PLAYER_ID]: { visible: [], explored: [] },
      [AI_PLAYER_ID]: { visible: [], explored: [] },
    },
    calendar: { day: 1, week: 1, month: 1, dayOfWeek: 1 },
    pendingBattle: null,
    phase: 'playing',
    winnerId: null,
    log: [{ day: 1, kind: 'scenario', message: 'The race for Aster Vale begins.' }],
  };
  updateAllFog(state);
  return state;
}
