/**
 * Charting studies — derived series and pair/percentile analytics that produce
 * oscillator sub-panes, plus monthly seasonality. Pure functions over the
 * aligned (number|null)[] values the resolver already produces.
 *
 * Pair studies (spread, ratio, rolling corr/beta) use the first two chart
 * series as S1 and S2; single studies (percentile) use S1.
 */
import type { OscPane } from "./canvasTypes";

export type StudyType = "spread" | "ratio" | "roll_corr" | "roll_beta" | "percentile";

export interface StudySpec {
  id: string;
  type: StudyType;
  window?: number;
}

export const STUDY_PRESETS: { label: string; spec: Omit<StudySpec, "id">; needsPair: boolean }[] = [
  { label: "Spread (S1 − S2)", spec: { type: "spread" }, needsPair: true },
  { label: "Ratio (S1 ÷ S2)", spec: { type: "ratio" }, needsPair: true },
  { label: "Roll Corr 63 (S1, S2)", spec: { type: "roll_corr", window: 63 }, needsPair: true },
  { label: "Roll Beta 63 (S1 vs S2)", spec: { type: "roll_beta", window: 63 }, needsPair: true },
  { label: "Percentile 252 (S1)", spec: { type: "percentile", window: 252 }, needsPair: false },
];

function returns(v: (number | null)[]): (number | null)[] {
  return v.map((x, i) => (i && x != null && v[i - 1] != null && v[i - 1] !== 0 ? x / (v[i - 1] as number) - 1 : null));
}

function corr(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; num += a * b; dx += a * a; dy += b * b; }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

/** Beta of A on benchmark B = cov(A,B) / var(B). */
function betaOf(aRet: number[], bRet: number[]): number {
  const n = aRet.length;
  if (n < 2) return 0;
  const ma = aRet.reduce((s, x) => s + x, 0) / n;
  const mb = bRet.reduce((s, x) => s + x, 0) / n;
  let cov = 0, varb = 0;
  for (let i = 0; i < n; i++) { cov += (aRet[i] - ma) * (bRet[i] - mb); varb += (bRet[i] - mb) ** 2; }
  return varb ? cov / varb : 0;
}

/** Rolling pairwise statistic over return series, aligned by index. */
function rollPair(a: (number | null)[], b: (number | null)[], w: number, fn: (xs: number[], ys: number[]) => number): (number | null)[] {
  const ra = returns(a), rb = returns(b);
  const out: (number | null)[] = new Array(a.length).fill(null);
  for (let i = w; i < a.length; i++) {
    const xs: number[] = [], ys: number[] = [];
    for (let j = i - w + 1; j <= i; j++) {
      if (ra[j] != null && rb[j] != null) { xs.push(ra[j] as number); ys.push(rb[j] as number); }
    }
    if (xs.length >= 3) out[i] = fn(xs, ys);
  }
  return out;
}

function percentileRank(v: (number | null)[], w: number): (number | null)[] {
  const out: (number | null)[] = new Array(v.length).fill(null);
  for (let i = 0; i < v.length; i++) {
    const cur = v[i];
    if (cur == null) continue;
    const window: number[] = [];
    for (let j = Math.max(0, i - w + 1); j <= i; j++) if (v[j] != null) window.push(v[j] as number);
    if (window.length >= 10) out[i] = (window.filter((x) => x <= cur).length / window.length) * 100;
  }
  return out;
}

/**
 * Compute a study as an oscillator pane. `vals`/`labels` are the aligned values
 * and labels of the chart's series (S1 = index 0, S2 = index 1).
 */
export function computeStudy(spec: StudySpec, vals: (number | null)[][], labels: string[]): OscPane | null {
  const a = vals[0], la = labels[0] ?? "S1";
  const b = vals[1], lb = labels[1] ?? "S2";
  const needsPair = spec.type !== "percentile";
  if (needsPair && (!a || !b)) return null;
  if (!a) return null;

  switch (spec.type) {
    case "spread": {
      const line = a.map((x, i) => (x != null && b[i] != null ? x - (b[i] as number) : null));
      return { id: spec.id, label: `${la} − ${lb}`, lines: [{ label: "spread", color: "#F5C518", values: line }], refLines: [{ v: 0 }], fmt: (v) => v.toFixed(2) };
    }
    case "ratio": {
      const line = a.map((x, i) => (x != null && b[i] != null && b[i] !== 0 ? x / (b[i] as number) : null));
      return { id: spec.id, label: `${la} ÷ ${lb}`, lines: [{ label: "ratio", color: "#22D3EE", values: line }], fmt: (v) => v.toFixed(3) };
    }
    case "roll_corr": {
      const w = spec.window ?? 63;
      const line = rollPair(a, b, w, corr);
      return { id: spec.id, label: `Corr ${w} (${la}, ${lb})`, lines: [{ label: "corr", color: "#A78BFA", values: line }], refLines: [{ v: 0 }], domain: [-1, 1], fmt: (v) => v.toFixed(2) };
    }
    case "roll_beta": {
      const w = spec.window ?? 63;
      const line = rollPair(a, b, w, betaOf);
      return { id: spec.id, label: `Beta ${w} (${la} vs ${lb})`, lines: [{ label: "beta", color: "#EC4899", values: line }], refLines: [{ v: 1 }, { v: 0 }], fmt: (v) => v.toFixed(2) };
    }
    case "percentile": {
      const w = spec.window ?? 252;
      const line = percentileRank(a, w);
      return { id: spec.id, label: `Percentile ${w} (${la})`, lines: [{ label: "%ile", color: "#2ECC71", values: line }], refLines: [{ v: 75, label: "75" }, { v: 25, label: "25" }], domain: [0, 100], fmt: (v) => v.toFixed(0) };
    }
  }
}

export interface MonthStat { month: string; mean: number | null; count: number }

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Average % return by calendar month for a series aligned to `axis`. */
export function monthlySeasonality(axis: string[], values: (number | null)[]): MonthStat[] {
  // last value per calendar month
  const monthEnd = new Map<string, number>();
  axis.forEach((d, i) => { if (values[i] != null) monthEnd.set(d.slice(0, 7), values[i] as number); });
  const keys = [...monthEnd.keys()].sort();
  const byMonth: number[][] = Array.from({ length: 12 }, () => []);
  for (let i = 1; i < keys.length; i++) {
    const prev = monthEnd.get(keys[i - 1])!;
    const cur = monthEnd.get(keys[i])!;
    if (prev) {
      const mi = Number(keys[i].slice(5, 7)) - 1;
      byMonth[mi].push((cur / prev - 1) * 100);
    }
  }
  return MONTHS.map((month, i) => {
    const arr = byMonth[i];
    return { month, mean: arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null, count: arr.length };
  });
}
