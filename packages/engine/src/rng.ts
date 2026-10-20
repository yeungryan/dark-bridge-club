// Seeded, serializable randomness. The server creates seeds with crypto randomness;
// everything after that is deterministic so any deal or session can be replayed (S09).

/** 128-bit seed as 32 lowercase hex characters. */
export type Seed = string;

/** sfc32 generator state: four unsigned 32-bit words. */
export type RngState = [number, number, number, number];

export function seedFromWords(words: readonly number[]): Seed {
  if (words.length !== 4) throw new Error('A seed needs exactly 4 words');
  return words.map((w) => (w >>> 0).toString(16).padStart(8, '0')).join('');
}

/** A fresh, unpredictable seed. Server-side only. */
export function randomSeed(): Seed {
  const words = new Uint32Array(4);
  globalThis.crypto.getRandomValues(words);
  return seedFromWords(Array.from(words));
}

export function rngStateFromSeed(seed: Seed): RngState {
  if (!/^[0-9a-f]{32}$/.test(seed)) throw new Error(`Invalid seed: ${seed}`);
  const state: RngState = [0, 1, 2, 3].map((i) => parseInt(seed.slice(i * 8, i * 8 + 8), 16)) as RngState;
  const rng = new Rng(state);
  // Discard early outputs so similar seeds diverge.
  for (let i = 0; i < 16; i++) rng.nextUint32();
  return rng.state();
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: RngState) {
    [this.a, this.b, this.c, this.d] = state;
  }

  static fromSeed(seed: Seed): Rng {
    return new Rng(rngStateFromSeed(seed));
  }

  state(): RngState {
    return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0];
  }

  nextUint32(): number {
    this.a |= 0;
    this.b |= 0;
    this.c |= 0;
    this.d |= 0;
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform integer in [0, n), without modulo bias. */
  int(n: number): number {
    if (!Number.isInteger(n) || n <= 0 || n > 2 ** 32) throw new Error(`Bad range: ${n}`);
    const limit = Math.floor(2 ** 32 / n) * n;
    let x = this.nextUint32();
    while (x >= limit) x = this.nextUint32();
    return x % n;
  }

  /** In-place Fisher–Yates shuffle. */
  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = items[i]!;
      items[i] = items[j]!;
      items[j] = tmp;
    }
    return items;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Cannot pick from an empty list');
    return items[this.int(items.length)]!;
  }

  /** A new seed derived from this stream (e.g. one per deal within a session). */
  deriveSeed(): Seed {
    return seedFromWords([this.nextUint32(), this.nextUint32(), this.nextUint32(), this.nextUint32()]);
  }
}
