import { CREATURES, FACTIONS } from '../game/content';

export const ROSTER_COUNTS = {
  factions: Object.keys(FACTIONS).length,
  units: Object.keys(CREATURES).length,
  tiers: 4,
} as const;

type FactionName = (typeof FACTIONS)[keyof typeof FACTIONS]['name'];

export interface FactionVisual {
  name: FactionName;
  primary: string;
  accent: string;
  dark: string;
  sky: string;
  roof: string;
  architecture: number;
  crest: string;
}

export const FACTION_VISUALS: Record<FactionName, FactionVisual> = {
  Haven: {
    name: 'Haven', primary: '#d8bc72', accent: '#8eb9dc', dark: '#263c52', sky: '#41637b', roof: '#a96e4d', architecture: 0,
    crest: '<path d="M12 2 5 5v6c0 5 3 8 7 11 4-3 7-6 7-11V5l-7-3Z"/><path d="M8 16V9h2V7h2v2h2V7h2v2h2v7M7 18h10M11 18v-4h2v4"/>',
  },
  Grove: {
    name: 'Grove', primary: '#79ad82', accent: '#c2d99a', dark: '#203f35', sky: '#284d4b', roof: '#76977a', architecture: 1,
    crest: '<path d="M19 3C9 3 4 8 5 15c1 5 7 7 11 3 4-4 3-10 3-15Z"/><path d="M4 21c3-7 7-10 12-14M8 15l-1-5m4 2 5 1"/>',
  },
  Ember: {
    name: 'Ember', primary: '#d66b4e', accent: '#ffc066', dark: '#481f25', sky: '#663b3c', roof: '#7f3f35', architecture: 2,
    crest: '<path d="M13 2c1 5-4 6-2 10 1-3 4-3 5-6 4 4 5 8 3 12-2 5-11 5-14 0-3-6 3-10 8-16Z"/><path d="M12 14c3 3 2 7-1 7s-4-4 1-7Z"/>',
  },
  Mire: {
    name: 'Mire', primary: '#82966b', accent: '#c3bb70', dark: '#293e37', sky: '#46574b', roof: '#596347', architecture: 3,
    crest: '<path d="M5 5c7-4 15 1 13 7-1 4-6 4-8 2-3-2-1-5 2-5 2 0 3 2 2 3"/><path d="M5 5 3 2m2 3L2 6m15 11c0 4-4 5-7 4m-5-7-3 7m12-5 3 5"/>',
  },
  Tower: {
    name: 'Tower', primary: '#94a6dc', accent: '#d6c6f2', dark: '#2b3155', sky: '#424c78', roof: '#626aa0', architecture: 4,
    crest: '<path d="m12 2 5 6-2 13H9L7 8l5-6Z"/><path d="M7 8h10M9 14h6M5 21h14M12 2v19"/>',
  },
  Necropolis: {
    name: 'Necropolis', primary: '#a08eae', accent: '#b8d39a', dark: '#2d2438', sky: '#46394f', roof: '#55435f', architecture: 5,
    crest: '<path d="M5 11a7 7 0 1 1 14 0c0 3-1 4-3 5v5H8v-5c-2-1-3-2-3-5Z"/><circle cx="9" cy="11" r="1"/><circle cx="15" cy="11" r="1"/><path d="m12 14-1 2h2l-1-2Zm-2 5v2m4-2v2"/>',
  },
  Dungeon: {
    name: 'Dungeon', primary: '#ac7ca2', accent: '#e08b72', dark: '#35213f', sky: '#4c3155', roof: '#5c3c66', architecture: 6,
    crest: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="4"/><path d="M12 8v8M5 4 3 2m14 2 2-2M5 20l-2 2m14-2 2 2"/>',
  },
  Stronghold: {
    name: 'Stronghold', primary: '#c48758', accent: '#e5c06a', dark: '#4b2f28', sky: '#685044', roof: '#78513c', architecture: 7,
    crest: '<path d="m5 3 6 5-5 7-3-2 4-5-4-3 2-2Zm14 0-6 5 5 7 3-2-4-5 4-3-2-2ZM8 12l8 9m0-9-8 9"/>',
  },
  Conflux: {
    name: 'Conflux', primary: '#75c6c2', accent: '#e5b4e4', dark: '#21454b', sky: '#326771', roof: '#477c81', architecture: 8,
    crest: '<path d="m12 2 2 6 6-2-4 6 4 6-6-2-2 6-2-6-6 2 4-6-4-6 6 2 2-6Z"/><circle cx="12" cy="12" r="3"/>',
  },
  Cove: {
    name: 'Cove', primary: '#65afc4', accent: '#e2d29b', dark: '#193d4d', sky: '#315f78', roof: '#4d7782', architecture: 9,
    crest: '<path d="M12 3v13M8 6h8M5 12c0 5 3 8 7 8s7-3 7-8M2 16l3-4 3 4m8 0 3-4 3 4"/><circle cx="12" cy="3" r="2"/>',
  },
  Factory: {
    name: 'Factory', primary: '#b59a6c', accent: '#82b7b3', dark: '#3d3832', sky: '#5c5b55', roof: '#6f6250', architecture: 10,
    crest: '<path d="m9 3 6 0 1 3 3-1 3 5-2 2 2 3-3 5-3-1-1 3H9l-1-3-3 1-3-5 2-3-2-2 3-5 3 1 1-3Z"/><circle cx="12" cy="12" r="4"/>',
  },
  Bulwark: {
    name: 'Bulwark', primary: '#a4ad6c', accent: '#d4c990', dark: '#35432d', sky: '#536048', roof: '#65704d', architecture: 11,
    crest: '<path d="M4 21V5l3-3 3 3v16m2 0V3l3-2 3 2v18M2 10h18M2 16h18M20 21V7l2-2"/>',
  },
  Courtyard: {
    name: 'Courtyard', primary: '#d59aa5', accent: '#f0d59a', dark: '#4c2e42', sky: '#6d4a63', roof: '#875568', architecture: 12,
    crest: '<path d="M12 20c-5-3-9-6-9-11 0-5 6-7 9-2 3-5 9-3 9 2 0 5-4 8-9 11Z"/><path d="M12 7v13M8 12c3 0 5 2 4 5m4-9c-3 0-5 2-4 5"/>',
  },
};

const FALLBACK_VISUAL: FactionVisual = { ...FACTION_VISUALS.Haven, name: 'Haven' };

export function getFactionVisual(faction: string): FactionVisual {
  if (Object.hasOwn(FACTION_VISUALS, faction)) return FACTION_VISUALS[faction as FactionName];
  const definition = Object.values(FACTIONS).find((candidate) => candidate.id === faction.toLowerCase());
  return definition ? FACTION_VISUALS[definition.name] : FALLBACK_VISUAL;
}

export function factionCrest(faction: string, className = ''): string {
  const visual = getFactionVisual(faction);
  return `<g class="${className}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${visual.crest}</g>`;
}
