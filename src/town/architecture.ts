import type { FactionId } from './registry';

export interface FactionArchitecture {
  wall: number;
  trim: number;
  roof: number;
  accent: number;
  ground: number;
  terrain: number;
  sky: number;
  foliage: number;
  roofSides: number;
  construction: 'masonry' | 'timber' | 'basalt' | 'brick' | 'living';
}

export const FACTION_ARCHITECTURE: Readonly<Record<FactionId, FactionArchitecture>> = Object.freeze({
  haven: { wall: 0xd6c9a8, trim: 0x8f8978, roof: 0x8e4d3f, accent: 0xf0cf72, ground: 0x91a66c, terrain: 0x698353, sky: 0xa9ced1, foliage: 0x47734d, roofSides: 4, construction: 'masonry' },
  grove: { wall: 0x9caa82, trim: 0x62523c, roof: 0x3f7357, accent: 0x9fe0b4, ground: 0x71925f, terrain: 0x3f694d, sky: 0x9bc8b7, foliage: 0x2f6747, roofSides: 6, construction: 'living' },
  ember: { wall: 0x514247, trim: 0x2c2930, roof: 0x3d3038, accent: 0xf08343, ground: 0x655147, terrain: 0x3d3435, sky: 0xb78b78, foliage: 0x605343, roofSides: 5, construction: 'basalt' },
  mire: { wall: 0x7c8266, trim: 0x3e4c40, roof: 0x4c6d5b, accent: 0xa5d99b, ground: 0x66785b, terrain: 0x405b4e, sky: 0x9bb5a4, foliage: 0x456c52, roofSides: 5, construction: 'timber' },
  tower: { wall: 0xb8c4c5, trim: 0x82979e, roof: 0x4e6f99, accent: 0xe4cc79, ground: 0x829a96, terrain: 0x607979, sky: 0xa9c8dc, foliage: 0x557c71, roofSides: 8, construction: 'masonry' },
  necropolis: { wall: 0x666b68, trim: 0x353a42, roof: 0x353a42, accent: 0x8fc4a1, ground: 0x626c5c, terrain: 0x3d4b43, sky: 0x829a91, foliage: 0x48594b, roofSides: 4, construction: 'masonry' },
  dungeon: { wall: 0x554c5d, trim: 0x332f42, roof: 0x332f42, accent: 0xb37cc2, ground: 0x615668, terrain: 0x393441, sky: 0x8e819e, foliage: 0x4d4a5d, roofSides: 6, construction: 'basalt' },
  stronghold: { wall: 0x806348, trim: 0x514237, roof: 0x72573f, accent: 0xc9a467, ground: 0x998059, terrain: 0x6c5b42, sky: 0xc2ae8e, foliage: 0x65704b, roofSides: 4, construction: 'timber' },
  conflux: { wall: 0x789b9e, trim: 0x57678f, roof: 0x57678f, accent: 0xb9e6da, ground: 0x75a098, terrain: 0x4b7777, sky: 0xa7d5d3, foliage: 0x4d8376, roofSides: 8, construction: 'masonry' },
  cove: { wall: 0x9b8d71, trim: 0x5b5042, roof: 0x386b78, accent: 0xd8c589, ground: 0x8e9a78, terrain: 0x577d78, sky: 0xa6d0d4, foliage: 0x4d7b63, roofSides: 4, construction: 'timber' },
  factory: { wall: 0x8a6d55, trim: 0x4e595b, roof: 0x4e595b, accent: 0xd39a50, ground: 0x8f7d5e, terrain: 0x625c4e, sky: 0xb7b6a4, foliage: 0x647052, roofSides: 6, construction: 'brick' },
  bulwark: { wall: 0x6d704f, trim: 0x47543e, roof: 0x47543e, accent: 0xc2a766, ground: 0x7c8657, terrain: 0x526446, sky: 0xaeb99a, foliage: 0x3e633e, roofSides: 6, construction: 'timber' },
  courtyard: { wall: 0xd0bdab, trim: 0xa69283, roof: 0x78546f, accent: 0xe2c776, ground: 0x93a171, terrain: 0x6b7c58, sky: 0xd1bdc8, foliage: 0x58774f, roofSides: 4, construction: 'masonry' },
});
