export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x6d2b79f5;
}

export function nextRandom(state: number): { state: number; value: number } {
  let value = (state + 0x6d2b79f5) >>> 0;
  let mixed = value;
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
  value = (mixed ^ (mixed >>> 14)) >>> 0;
  return { state: (state + 0x6d2b79f5) >>> 0, value: value / 4294967296 };
}

export class SeededRandom {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === 'string' ? hashSeed(seed) : seed >>> 0;
  }

  next(): number {
    const result = nextRandom(this.state);
    this.state = result.state;
    return result.value;
  }

  integer(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(items: readonly T[]): T {
    const item = items[this.integer(0, items.length - 1)];
    if (item === undefined) throw new Error('Cannot pick from an empty collection');
    return item;
  }

  getState(): number {
    return this.state;
  }
}
