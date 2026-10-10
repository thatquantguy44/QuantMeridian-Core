/**
 * Charting transforms — pure functions for the charting engine.
 *
 * Two families:
 *   • point transforms (pct_change / yoy / mom / log) — computed on each series'
 *     own dense history, so the first visible point still has a valid value.
 *   • window transforms (index100 / zscore) — computed on the aligned, range-
 *     filtered values, so they are relative to what's on screen.
 */

export type Transform = "none" | "index100" | "pct_change" | "yoy" | "mom" | "zscore" | "log";

export const TRANSFORMS: Transform[] = ["none", "index100", "pct_change", "yoy", "mom", "zscore", "log"];

export const TRANSFORM_LABELS: Record<Transform, string> = {
  none: "Level",
  index100: "Index = 100",
  pct_change: "% change",
  yoy: "YoY %",
  mom: "MoM %",
  zscore: "Z-score",
  log: "Log",
};

export const POINT_TRANSFORMS: Transform[] = ["pct_change", "yoy", "mom", "log"];
export const WINDOW_TRANSFORMS: Transform[] = ["index100", "zscore"];

const DAY_MS = 86_400_000;

function lastIdxLE(t: number[], target: number, hi: number): number {
  let lo = 0, h = hi, ans = -1;
  while (lo <= h) {
    const m = (lo + h) >> 1;
    if (t[m] <= target) { ans = m; lo = m + 1; } else h = m - 1;
  }
  return ans;
}

/** Percent change vs the prior observation. */
export function pctChange(values: number[]): (number | null)[] {
  return values.map((v, i) => (i && values[i - 1] ? (v / values[i - 1] - 1) * 100 : null));
}

/** Natural log. */
export function logTransform(values: number[]): (number | null)[] {
  return values.map((v) => (v > 0 ? Math.log(v) : null));
}

/** Percent change vs the observation ~`lagDays` earlier (calendar-accurate). */
export function vsLag(dates: string[], values: number[], lagDays: number): (number | null)[] {
  const t = dates.map((d) => Date.parse(`${d}T00:00:00Z`));
  return values.map((v, i) => {
    const k = lastIdxLE(t, t[i] - lagDays * DAY_MS, i - 1);
    if (k < 0 || !values[k]) return null;
    return (v / values[k] - 1) * 100;
  });
}

/** Apply a point transform to a dense (date,value) series. */
export function applyPointTransform(transform: Transform, dates: string[], values: number[]): (number | null)[] {
  switch (transform) {
    case "pct_change": return pctChange(values);
    case "yoy": return vsLag(dates, values, 365);
    case "mom": return vsLag(dates, values, 30);
    case "log": return logTransform(values);
    default: return values;
  }
}

/** Rebase the first non-null value to 100. */
export function index100(values: (number | null)[]): (number | null)[] {
  const base = values.find((v) => v != null && v !== 0) as number | undefined;
  if (!base) return values;
  return values.map((v) => (v == null ? null : (v / base) * 100));
}

/** Standardize over the visible window (z = (x − μ) / σ). */
export function zscore(values: (number | null)[]): (number | null)[] {
  const xs = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (xs.length < 2) return values.map(() => null);
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1;
  return values.map((v) => (v == null ? null : (v - m) / sd));
}

/** Apply a window transform to aligned, range-filtered values. */
export function applyWindowTransform(transform: Transform, values: (number | null)[]): (number | null)[] {
  if (transform === "index100") return index100(values);
  if (transform === "zscore") return zscore(values);
  return values;
}

/** Axis/tooltip formatter appropriate to a transform. */
export function transformFmt(transform: Transform): (v: number) => string {
  switch (transform) {
    case "pct_change":
    case "yoy":
    case "mom": return (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
    case "zscore": return (v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}σ`;
    case "index100": return (v) => v.toFixed(0);
    case "log": return (v) => v.toFixed(2);
    default: return (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2));
  }
}
