import { hashSeed } from './random';
import type { HeroState, PrimarySkills } from './types';

const SKILL_ORDER: Array<keyof PrimarySkills> = ['attack', 'defense', 'spellPower', 'knowledge'];

export function experienceForLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new Error('Hero level must be a positive integer');
  return 1000 * (level - 1) * level / 2;
}

export function gainExperience(hero: HeroState, amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Experience must be non-negative');
  hero.experience += Math.floor(amount);
  let levelsGained = 0;
  while (hero.experience >= experienceForLevel(hero.level + 1)) {
    hero.level += 1;
    levelsGained += 1;
    const skill = SKILL_ORDER[(hero.level + hashSeed(hero.definitionId)) % SKILL_ORDER.length] ?? 'attack';
    hero.primarySkills[skill] += 1;
    if (skill === 'knowledge') {
      hero.maxMana += 10;
      hero.mana += 10;
    }
    hero.maxMovementPoints += 25;
  }
  return levelsGained;
}
