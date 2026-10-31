import { getCreature, getHeroDefinition } from '../game/content';
import { escapeHtml } from './format';
import { factionCrest, getFactionVisual } from './presentation';

export type IconName =
  | 'army' | 'book' | 'castle' | 'check' | 'close' | 'coins' | 'compass'
  | 'construction' | 'crystal' | 'endTurn' | 'gems' | 'gold' | 'help'
  | 'hero' | 'info' | 'left' | 'lock' | 'mana' | 'map' | 'mercury'
  | 'movement' | 'ore' | 'recruit' | 'right' | 'save' | 'shield'
  | 'skull' | 'spark' | 'star' | 'sulfur' | 'sword' | 'wood';

const paths: Record<IconName, string> = {
  army: '<path d="M5 19v-7l3-3 3 3v7M12 19V5l3-3 3 3v14M3 21h18M7 15h2M16 9h2"/>',
  book: '<path d="M4 5c4-1 6 0 8 2v14c-2-2-4-3-8-2V5Zm16 0c-4-1-6 0-8 2v14c2-2 4-3 8-2V5Z"/><path d="M7 9h2m-2 3h2m6-3h2m-2 3h2"/>',
  castle: '<path d="M3 21V8h4V4h3v4h4V4h3v4h4v13H3Z"/><path d="M9 21v-6a3 3 0 0 1 6 0v6M3 11h18"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  coins: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v5c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 11v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  construction: '<path d="m14 6 4-4 4 4-4 4M3 21l9-9m-8 9 4-1-3-3-1 4ZM13 3l8 8"/>',
  crystal: '<path d="m12 2 7 6-7 14L5 8l7-6Zm0 0v20M5 8h14"/>',
  endTurn: '<path d="M6 2h12M6 22h12M7 2c0 5 2 7 5 10-3 3-5 5-5 10m10-20c0 5-2 7-5 10 3 3 5 5 5 10"/><path d="m9 19 3-3 3 3"/>',
  gems: '<path d="m12 2 8 6-3 11H7L4 8l8-6Zm0 0v17M4 8h16M7 19l5-11 5 11"/>',
  gold: '<circle cx="12" cy="12" r="9"/><path d="M15 8.5c-.7-.6-1.7-1-3-1-1.7 0-3 .8-3 2s1.1 1.8 3 2.5 3 1.3 3 2.5-1.3 2-3 2c-1.3 0-2.4-.4-3.2-1.2M12 5v14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.3 2c-1 .7-1.8 1.3-1.8 3M12 17.5v.1"/>',
  hero: '<circle cx="12" cy="8" r="4"/><path d="M4 21c.6-5 3.2-8 8-8s7.4 3 8 8M8 4l4-2 4 2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  mana: '<path d="M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/><path d="M9 16c.4 1.5 1.4 2 3 2"/>',
  map: '<path d="m3 5 6-3 6 3 6-3v17l-6 3-6-3-6 3V5Zm6-3v17m6-14v17"/>',
  mercury: '<path d="M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/><path d="M8 15c1 2 5 2 8-1"/>',
  movement: '<path d="M13 3c2 5 2 8 0 11l-3 4 3 3H6c-2 0-3-2-2-4l3-5c1-2 1-4 1-7l5-2Z"/><path d="m15 8 4 2m-5 2 5 2"/>',
  ore: '<path d="m4 18-2-7 5-7 9-2 6 7-3 10-9 3-6-4Z"/><path d="m7 4 4 7 5-9M2 11h9l8 8M11 11l-1 11"/>',
  recruit: '<circle cx="9" cy="8" r="4"/><path d="M2 21c.5-5 2.8-8 7-8 2.5 0 4.2 1.2 5.3 3M18 12v8m-4-4h8"/>',
  right: '<path d="m9 5 7 7-7 7"/>',
  save: '<path d="M4 3h13l3 3v15H4V3Zm4 0v6h8V3M8 21v-8h8v8"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3 9 8 11 5-2 8-6 8-11V5l-8-3Z"/><path d="m8 12 3 3 5-6"/>',
  skull: '<path d="M5 11a7 7 0 1 1 14 0c0 3-1 4-3 5v5H8v-5c-2-1-3-2-3-5Z"/><circle cx="9" cy="11" r="1"/><circle cx="15" cy="11" r="1"/><path d="m12 14-1 2h2l-1-2Zm-2 5v2m4-2v2"/>',
  spark: '<path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z"/>',
  star: '<path d="m12 2 3 6 7 .9-5 4.8 1.3 6.8L12 17l-6.3 3.5L7 13.7 2 8.9 9 8l3-6Z"/>',
  sulfur: '<path d="M13 2c1 5-4 6-2 10 1-3 4-3 5-6 4 4 5 8 3 12-2 5-11 5-14 0-3-6 3-10 8-16Z"/><path d="M12 14c3 3 2 7-1 7s-4-4 1-7Z"/>',
  sword: '<path d="m14 4 6-2-2 6L8 18l-4 1 1-4L14 4Zm-8 9 5 5M4 17l3 3m-5 1 5-5"/>',
  wood: '<path d="m5 7 12-4 4 5-12 4-4-5Zm0 0v9l4 5v-9m-4 0 12-4m-8 4v9M7 15l12-4v-3"/>',
};

export function icon(name: IconName, className = ''): string {
  return `<svg class="h3-icon ${escapeHtml(className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

export function factionIcon(faction: string, className = ''): string {
  const visual = getFactionVisual(faction);
  return `<svg class="h3-icon h3-faction-icon ${escapeHtml(className)}" viewBox="0 0 24 24" role="img" aria-label="${escapeHtml(visual.name)} faction" data-faction="${escapeHtml(visual.name)}"><title>${escapeHtml(visual.name)}</title>${factionCrest(visual.name)}</svg>`;
}

export function resourceIcon(resource: keyof typeof RESOURCE_ICON_NAMES): string {
  return icon(RESOURCE_ICON_NAMES[resource], `h3-resource-icon h3-resource-${resource}`);
}

const RESOURCE_ICON_NAMES = {
  gold: 'gold',
  wood: 'wood',
  ore: 'ore',
  crystal: 'crystal',
  gems: 'gems',
  mercury: 'mercury',
  sulfur: 'sulfur',
} as const satisfies Record<string, IconName>;

function svgId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

export function heroPortrait(definitionId: string, name: string): string {
  const definition = getHeroDefinition(definitionId);
  const visual = getFactionVisual(definition.faction);
  const variant = [...definitionId].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 4;
  const hair = ['#d6c09a', '#493b32', '#2b2530', '#b9b4aa'][variant] ?? '#493b32';
  const hairPath = variant % 2 === 0
    ? 'M33 57C25 22 46 14 61 15c24 0 35 20 26 48l-8-25c-14 8-27 5-39 1l-7 18Z'
    : 'M32 61C24 28 39 12 61 14c25 1 34 24 26 51l-10-29c-12 4-25 3-37-3l-8 28Z';
  return `<svg class="h3-hero-portrait" viewBox="0 0 120 140" role="img" aria-label="Original portrait of ${escapeHtml(name)}, ${escapeHtml(definition.faction)}" data-faction="${escapeHtml(definition.faction)}">
    <defs><linearGradient id="portrait-${svgId(definitionId)}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${visual.primary}"/><stop offset="1" stop-color="${visual.dark}"/></linearGradient></defs>
    <path d="M8 132V66C8 27 31 7 60 7s52 20 52 59v66Z" fill="url(#portrait-${svgId(definitionId)})" stroke="${visual.accent}" stroke-width="2"/>
    <path d="M21 132c3-35 17-50 39-50s36 15 39 50" fill="${visual.dark}"/>
    <path d="m39 89 21 22 21-22 12 43H27Z" fill="${visual.primary}"/>
    <path d="M45 72v17c6 8 24 8 30 0V72" fill="#c89672"/>
    <ellipse cx="60" cy="54" rx="27" ry="32" fill="#d8aa83"/>
    <path d="${hairPath}" fill="${hair}"/>
    <path d="M47 55h7m12 0h7" stroke="#3c302b" stroke-width="2"/><path d="M54 70c4 2 8 2 12 0" stroke="#925f52" fill="none"/>
    <g transform="translate(53 94) scale(.58)" color="${visual.accent}">${factionCrest(definition.faction)}</g>
    <path d="M17 127h86" stroke="${visual.accent}" stroke-width="3"/>
  </svg>`;
}

function creatureMonogram(name: string): string {
  const words = name.split(/\s+/).filter((word) => !['of', 'the'].includes(word.toLowerCase()));
  return words.map((word) => word[0] ?? '').join('').slice(0, 2).toUpperCase();
}

export function creaturePortrait(creatureId: string): string {
  const creature = getCreature(creatureId);
  const visual = getFactionVisual(creature.faction);
  const variant = [...creatureId].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 3;
  const wings = creature.abilities.includes('flying')
    ? `<path d="M45 53C24 22 7 27 9 46c2 14 17 24 35 25m31-18C96 22 113 27 111 46c-2 14-17 24-35 25" fill="${visual.accent}" fill-opacity=".35" stroke="${visual.accent}" stroke-width="2"/>`
    : '';
  const ranged = creature.abilities.includes('ranged')
    ? '<path d="M87 36c19 17 19 43 0 60M87 36v60m0-30h17" fill="none" stroke="#f0d38a" stroke-width="3"/>'
    : '';
  const body = creature.tier === 1
    ? '<path d="M43 91c1-21 6-32 17-32s16 11 17 32Z"/><circle cx="60" cy="43" r="14"/>'
    : creature.tier === 2
      ? '<path d="M34 83c2-24 13-33 30-30 15 3 23 14 22 31l-12-9-5 17H42Z"/><path d="m69 49 12-13 4 19"/>'
      : creature.tier === 3
        ? '<path d="M38 94c0-28 8-42 22-42s22 14 22 42l-12-8-10 11-10-11Z"/><circle cx="60" cy="40" r="16"/>'
        : '<path d="M31 96c4-29 13-43 29-43s25 14 29 43l-16-6-13 13-13-13Z"/><path d="M43 49 34 27l20 14m23 8 9-22-20 14"/>';
  const horns = variant === 0
    ? '<path d="m48 38-10-15m34 15 10-15" fill="none" stroke="currentColor" stroke-width="4"/>'
    : variant === 1
      ? '<path d="m48 37-4-18 12 15m16 3 4-18-12 15" fill="none" stroke="currentColor" stroke-width="3"/>'
      : '<path d="M45 39c4-15 26-15 30 0" fill="none" stroke="currentColor" stroke-width="4"/>';
  return `<svg class="h3-creature-portrait" viewBox="0 0 120 120" role="img" aria-label="${escapeHtml(creature.name)}, ${escapeHtml(creature.faction)} tier ${creature.tier}" data-creature-id="${escapeHtml(creature.id)}" data-faction="${escapeHtml(creature.faction)}" data-tier="${creature.tier}">
    <title>${escapeHtml(creature.name)} · ${escapeHtml(creature.faction)} · Tier ${creature.tier}</title>
    <path d="M60 4 108 31v58l-48 27L12 89V31Z" fill="${visual.dark}" stroke="${visual.primary}" stroke-width="3"/>
    <circle cx="60" cy="57" r="40" fill="#101d1c" fill-opacity=".72"/>${wings}
    <g fill="${visual.primary}" color="${visual.primary}">${body}${horns}</g>
    <path d="M53 43h3m8 0h3" stroke="${visual.accent}" stroke-width="3"/>${ranged}
    <g transform="translate(47 59) scale(1.08)" color="${visual.accent}" opacity=".72">${factionCrest(creature.faction)}</g>
    <path d="M27 99h66" stroke="${visual.primary}" stroke-width="2"/>
    <text x="60" y="108" fill="${visual.accent}" font-family="ui-monospace, monospace" font-size="10" font-weight="800" text-anchor="middle">${escapeHtml(creatureMonogram(creature.name))} · ${creature.tier}</text>
  </svg>`;
}

export function townBanner(faction: string): string {
  const visual = getFactionVisual(faction);
  const id = svgId(visual.name);
  const towerHeight = 63 - (visual.architecture % 4) * 8;
  const roofPath = visual.architecture % 3 === 0
    ? 'm-48 0 48-49 48 49Z'
    : visual.architecture % 3 === 1
      ? 'm-48 0 20-38h56l20 38Z'
      : 'm-48 0 12-45 36 22 36-22 12 45Z';
  return `<svg class="h3-town-banner-art" viewBox="0 0 900 220" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Original ${escapeHtml(visual.name)} town skyline" data-faction="${escapeHtml(visual.name)}">
    <title>${escapeHtml(visual.name)} town</title>
    <defs><linearGradient id="town-sky-${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${visual.sky}"/><stop offset="1" stop-color="${visual.accent}"/></linearGradient></defs>
    <path fill="url(#town-sky-${id})" d="M0 0h900v220H0z"/>
    <circle cx="720" cy="54" r="30" fill="${visual.accent}" opacity=".65"/>
    <path d="M0 157 110 91l83 50 101-69 100 79 105-56 96 56 112-70 93 57 100-45v127H0Z" fill="${visual.dark}" opacity=".58"/>
    <path d="M0 192c136-42 221-18 342-27 151-12 234-53 353-20 75 21 136 12 205-2v77H0Z" fill="${visual.dark}"/>
    <g transform="translate(690 38) scale(4.5)" color="${visual.accent}" opacity=".2">${factionCrest(visual.name)}</g>
    <g fill="${visual.roof}" stroke="${visual.accent}" stroke-width="2">
      <path d="M343 190V91h47v99m-54-99h61l-30-39Z"/>
      <path d="M400 190V${towerHeight}h79v${190 - towerHeight}"/>
      <g transform="translate(439 ${towerHeight})"><path d="${roofPath}"/></g>
      <path d="M490 190V105h52v85m-59-85h66l-33-38Z"/>
      <path d="M300 190v-57h290v57" fill="${visual.dark}"/>
    </g>
    <path d="M429 190v-48a17 17 0 0 1 34 0v48" fill="${visual.dark}"/>
    <g fill="${visual.accent}"><path d="M416 88h12v18h-12zM451 88h12v18h-12zM357 116h11v16h-11zM507 125h11v16h-11z"/></g>
    <path d="M439 ${towerHeight - 49}v-14m0 2 34 10-34 9" stroke="${visual.accent}" fill="${visual.primary}" stroke-width="2"/>
    <g fill="${visual.dark}"><path d="m170 192 24-79 24 79Zm45 0 19-62 19 62Zm480 0 25-83 25 83Zm-54 0 18-59 18 59Z"/></g>
  </svg>`;
}
