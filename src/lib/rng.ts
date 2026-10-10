/**
 * Deterministic, seedable pseudo-random utilities.
 *
 * The terminal ships with no live market feed, so every dataset is generated
 * from a fixed seed. This keeps server and client render output identical
 * (no hydration drift) while still producing realistic, varied book/market data.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap deterministic hash of a string into a 32-bit seed. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  private next: () => number;
  constructor(seed: number | string) {
    this.next = mulberry32(typeof seed === "string" ? hashSeed(seed) : seed);
  }
  float(min = 0, max = 1): number {
    return min + (max - min) * this.next();
  }
  int(min: number, max: number): number {
    return Math.floor(this.float(min, max + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  bool(p = 0.5): boolean {
    return this.next() < p;
  }
  /** Box–Muller normal sample. */
  normal(mean = 0, sd = 1): number {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** A mean-reverting random walk, useful for intraday price/series mocks. */
  walk(n: number, start: number, vol: number, drift = 0): number[] {
    const out: number[] = [];
    let x = start;
    for (let i = 0; i < n; i++) {
      x = x * (1 + this.normal(drift, vol));
      out.push(x);
    }
    return out;
  }
}
