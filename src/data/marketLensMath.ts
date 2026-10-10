/**
 * Pure statistical helpers for the Market Lens engine.
 *
 * Extracted from `marketLens.ts` to keep the engine's analytics primitives in one
 * dependency-free place. Everything here operates on plain `number[]` — no series
 * generation, no I/O — so it's trivially testable and reusable.
 */

/** Trading-day spans for the forward-return windows the views report on. */
export const WINDOW_DAYS: Record<string, number> = {
  "1W": 5, "1M": 21, "3M": 63, "6M": 126, "1Y": 252, "2Y": 504, "3Y": 756, "5Y": 1260,
};

export interface Stat {
  mean: number | null;
  median: number | null;
  pct_positive: number | null;
  count: number;
}

export function summarize(xs: number[]): Stat {
  const v = xs.filter((x) => Number.isFinite(x));
  if (!v.length) return { mean: null, median: null, pct_positive: null, count: 0 };
  const sorted = [...v].sort((a, b) => a - b);
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const pct_positive = v.filter((x) => x > 0).length / v.length;
  return { mean, median, pct_positive, count: v.length };
}

export function fwd(values: number[], i: number, h: number): number | null {
  const j = i + h;
  if (j >= values.length || values[i] === 0) return null;
  return values[j] / values[i] - 1;
}

/** Forward-return statistics over windows for a set of event indices. */
export function fwdStatsAtEvents(values: number[], idx: number[], windows: string[]): Record<string, Stat> {
  const out: Record<string, Stat> = {};
  for (const w of windows) {
    const h = WINDOW_DAYS[w] ?? 21;
    const rs = idx.map((i) => fwd(values, i, h)).filter((r): r is number => r !== null);
    out[w] = summarize(rs);
  }
  return out;
}

/** Unconditional baseline forward-return statistics over all observations. */
export function baselineStats(values: number[], windows: string[]): Record<string, Stat> {
  const out: Record<string, Stat> = {};
  for (const w of windows) {
    const h = WINDOW_DAYS[w] ?? 21;
    const rs: number[] = [];
    for (let i = 0; i < values.length - h; i += 5) {
      const r = fwd(values, i, h);
      if (r !== null) rs.push(r);
    }
    out[w] = summarize(rs);
  }
  return out;
}

export function drawdownPct(values: number[]): number[] {
  let peak = values[0];
  return values.map((v) => {
    peak = Math.max(peak, v);
    return peak > 0 ? (v / peak - 1) * 100 : 0;
  });
}

export function rollingReturns(values: number[], h: number): number[] {
  const out: number[] = [];
  for (let i = h; i < values.length; i++) {
    if (values[i - h] !== 0) out.push((values[i] / values[i - h] - 1) * 100);
  }
  return out;
}

export function movingAvg(values: number[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const am = a.slice(-n), bm = b.slice(-n);
  const ma = am.reduce((s, x) => s + x, 0) / n;
  const mb = bm.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = am[i] - ma, y = bm[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

export function dailyReturns(values: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < values.length; i++) out.push(values[i - 1] ? values[i] / values[i - 1] - 1 : 0);
  return out;
}

export function pct(x: number | null): number | null {
  return x === null ? null : Number((x * 100).toFixed(2));
}

/** Current value's percentile within its own history (0..1). */
export function percentileOf(values: number[], x: number): number {
  const below = values.filter((v) => v <= x).length;
  return below / values.length;
}
