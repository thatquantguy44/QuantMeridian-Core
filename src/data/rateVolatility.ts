/**
 * RVOL — Rate Volatility Analytics Engine.
 *
 * Computes realized volatility across all benchmark rates, builds a
 * term structure of vol, detects vol regime shifts, and constructs
 * vol cones for percentile analysis.
 *
 * All analytics are pure functions over SeriesMap — no side effects.
 */
import type { SeriesMap, Obs, BenchmarkDef } from "@/data/benchmarkRates";
import { BENCHMARK_SERIES, defOf, computeCorrelation, type CorrelationResult } from "@/data/benchmarkRates";

// ── Types ────────────────────────────────────────────────────────────

export type VolWindow = 5 | 10 | 20 | 60 | 120;
export const VOL_WINDOWS: VolWindow[] = [5, 10, 20, 60, 120];
export const VOL_WINDOW_LABELS: Record<VolWindow, string> = {
  5: "5D", 10: "10D", 20: "20D", 60: "60D", 120: "120D",
};

export interface VolMetrics {
  window: VolWindow;
  annualized: number | null;
  raw: number | null;
  history: number[];
  dates: string[];
  zScore: number | null;
  percentile: number | null;
}

export interface RealizedVol {
  seriesId: string;
  def: BenchmarkDef;
  windows: Record<VolWindow, VolMetrics>;
  volOfVol20d: number | null;
  currentVsHistoric: "low" | "normal" | "elevated" | "extreme";
  percentile: number | null;
  volTrend: "rising" | "falling" | "stable";
}

export interface VolSurface {
  seriesIds: string[];
  windows: VolWindow[];
  grid: (number | null)[][];
  labels: string[];
}

export type VolRegime = "Low Vol" | "Normal" | "Elevated" | "Vol Storm";

export interface VolRegimeResult {
  regime: VolRegime;
  score: number;
  drivers: string[];
  transition: "stable" | "rising" | "falling";
  daysInRegime: number;
}

export interface VolConePoint {
  window: VolWindow;
  current: number | null;
  min: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  max: number | null;
}

export interface VolCone {
  seriesId: string;
  points: VolConePoint[];
}

export interface CrossAssetVol {
  seriesId: string;
  label: string;
  category: string;
  vol5d: number | null;
  vol20d: number | null;
  vol60d: number | null;
  volRatio: number | null;
  percentile: number | null;
  regime: "low" | "normal" | "elevated" | "extreme";
}

export interface VolSummary {
  regime: VolRegime;
  regimeScore: number;
  avg20dVol: number | null;
  volTrend: "rising" | "falling" | "stable";
  elevatedCount: number;
  extremeCount: number;
  avgVolOfVol: number | null;
  topMover: string;
  topMoverChg: number | null;
}

// ── Core Computation ────────────────────────────────────────────────

function dailyChanges(obs: Obs[], def: BenchmarkDef): number[] {
  const changes: number[] = [];
  for (let i = 1; i < obs.length; i++) {
    const prev = obs[i - 1].value;
    const cur = obs[i].value;
    if (def.unit === "$/bbl" || def.unit === "$/oz") {
      changes.push(prev !== 0 ? Math.log(cur / prev) * 100 : 0);
    } else if (def.unit === "bps") {
      changes.push(cur - prev);
    } else {
      changes.push((cur - prev) * 100);
    }
  }
  return changes;
}

function rollingStdev(values: number[], window: number): { vals: number[]; dates?: string[] } {
  const out: number[] = [];
  for (let i = window - 1; i < values.length; i++) {
    const slice = values.slice(i - window + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, v) => a + (v - mean) ** 2, 0) / slice.length;
    out.push(Math.sqrt(variance));
  }
  return { vals: out };
}

function annualize(rawVol: number): number {
  return rawVol * Math.sqrt(252);
}

function percentileOf(arr: number[], v: number): number {
  if (arr.length === 0) return 50;
  const below = arr.filter((x) => x <= v).length;
  return Math.round((below / arr.length) * 100);
}

function quantile(sorted: number[], q: number): number {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ── Per-Series Volatility ───────────────────────────────────────────

function computeVolMetrics(changes: number[], dates: string[], window: VolWindow): VolMetrics {
  if (changes.length < window) {
    return { window, annualized: null, raw: null, history: [], dates: [], zScore: null, percentile: null };
  }

  const rolling = rollingStdev(changes, window);
  const histAnn = rolling.vals.map((v) => Number(annualize(v).toFixed(2)));
  const histDates = dates.slice(window);

  const current = histAnn.length > 0 ? histAnn[histAnn.length - 1] : null;
  const rawCurrent = rolling.vals.length > 0 ? rolling.vals[rolling.vals.length - 1] : null;

  let zScore: number | null = null;
  let pct: number | null = null;

  if (histAnn.length >= 20 && current != null) {
    const mean = histAnn.reduce((a, b) => a + b, 0) / histAnn.length;
    const std = Math.sqrt(histAnn.reduce((a, v) => a + (v - mean) ** 2, 0) / histAnn.length);
    zScore = std > 0 ? Number(((current - mean) / std).toFixed(2)) : 0;
    pct = percentileOf(histAnn, current);
  }

  return {
    window,
    annualized: current,
    raw: rawCurrent != null ? Number(rawCurrent.toFixed(4)) : null,
    history: histAnn,
    dates: histDates.slice(0, histAnn.length),
    zScore,
    percentile: pct,
  };
}

export function computeRealizedVol(obs: Obs[], def: BenchmarkDef): RealizedVol {
  const changes = dailyChanges(obs, def);
  const dates = obs.map((o) => o.date);

  const windows = {} as Record<VolWindow, VolMetrics>;
  for (const w of VOL_WINDOWS) {
    windows[w] = computeVolMetrics(changes, dates, w);
  }

  const vol20 = windows[20];
  const vol60 = windows[60];

  const volOfVol20d = computeVolOfVol(obs, def, 20, 20);

  const pct = vol20.percentile;
  const currentVsHistoric: RealizedVol["currentVsHistoric"] =
    pct == null ? "normal" :
    pct >= 90 ? "extreme" :
    pct >= 75 ? "elevated" :
    pct <= 25 ? "low" : "normal";

  let volTrend: RealizedVol["volTrend"] = "stable";
  if (vol20.annualized != null && vol60.annualized != null) {
    const ratio = vol20.annualized / vol60.annualized;
    volTrend = ratio > 1.2 ? "rising" : ratio < 0.8 ? "falling" : "stable";
  }

  return {
    seriesId: def.id,
    def,
    windows,
    volOfVol20d,
    currentVsHistoric,
    percentile: pct,
    volTrend,
  };
}

export function computeAllVols(map: SeriesMap): RealizedVol[] {
  return BENCHMARK_SERIES.map((def) => {
    const obs = map[def.id] ?? [];
    return computeRealizedVol(obs, def);
  });
}

// ── Vol Surface ─────────────────────────────────────────────────────

export function buildVolSurface(
  map: SeriesMap,
  ids: string[],
  windows: VolWindow[] = VOL_WINDOWS,
): VolSurface {
  const labels = ids.map((id) => defOf(id)?.short ?? id);
  const grid: (number | null)[][] = [];

  for (const w of windows) {
    const row: (number | null)[] = [];
    for (const id of ids) {
      const obs = map[id] ?? [];
      const def = defOf(id);
      if (!def || obs.length < w + 1) {
        row.push(null);
        continue;
      }
      const changes = dailyChanges(obs, def);
      const metrics = computeVolMetrics(changes, obs.map((o) => o.date), w);
      row.push(metrics.annualized);
    }
    grid.push(row);
  }

  return { seriesIds: ids, windows, grid, labels };
}

// ── Vol Cone ────────────────────────────────────────────────────────

export function computeVolCone(obs: Obs[], def: BenchmarkDef): VolCone {
  const changes = dailyChanges(obs, def);
  const points: VolConePoint[] = [];

  for (const w of VOL_WINDOWS) {
    if (changes.length < w) {
      points.push({ window: w, current: null, min: null, p25: null, median: null, p75: null, max: null });
      continue;
    }

    const rolling = rollingStdev(changes, w);
    const ann = rolling.vals.map((v) => annualize(v));
    const current = ann.length > 0 ? Number(ann[ann.length - 1].toFixed(2)) : null;
    const sorted = [...ann].sort((a, b) => a - b);

    points.push({
      window: w,
      current,
      min: sorted.length > 0 ? Number(sorted[0].toFixed(2)) : null,
      p25: sorted.length >= 4 ? Number(quantile(sorted, 0.25).toFixed(2)) : null,
      median: sorted.length >= 2 ? Number(quantile(sorted, 0.5).toFixed(2)) : null,
      p75: sorted.length >= 4 ? Number(quantile(sorted, 0.75).toFixed(2)) : null,
      max: sorted.length > 0 ? Number(sorted[sorted.length - 1].toFixed(2)) : null,
    });
  }

  return { seriesId: def.id, points };
}

// ── Vol Regime ──────────────────────────────────────────────────────

export function classifyVolRegime(vols: RealizedVol[]): VolRegimeResult {
  const valid = vols.filter((v) => v.windows[20].annualized != null && v.percentile != null);
  if (valid.length === 0) return { regime: "Normal", score: 50, drivers: [], transition: "stable", daysInRegime: 0 };

  const elevated = valid.filter((v) => v.percentile! >= 75).length;
  const extreme = valid.filter((v) => v.percentile! >= 90).length;
  const avgZScore = valid.reduce((s, v) => s + (v.windows[20].zScore ?? 0), 0) / valid.length;
  const avgVolOfVol = valid.filter((v) => v.volOfVol20d != null).reduce((s, v) => s + v.volOfVol20d!, 0) /
    Math.max(1, valid.filter((v) => v.volOfVol20d != null).length);
  const risingCount = valid.filter((v) => v.volTrend === "rising").length;

  let score = 0;
  const drivers: string[] = [];

  // % of rates with vol > 75th percentile (weight 30)
  const elevatedPct = (elevated / valid.length) * 100;
  score += (elevatedPct / 100) * 30;
  if (elevatedPct > 40) drivers.push(`${elevated}/${valid.length} rates with elevated vol`);

  // Average z-score (weight 25)
  const zComponent = Math.max(0, Math.min(1, (avgZScore + 1) / 3)) * 25;
  score += zComponent;
  if (avgZScore > 1) drivers.push(`Avg vol z-score ${avgZScore.toFixed(1)}`);

  // Vol-of-vol (weight 20)
  const vovComponent = Math.max(0, Math.min(1, avgVolOfVol / 50)) * 20;
  score += vovComponent;
  if (avgVolOfVol > 30) drivers.push(`Vol-of-vol elevated at ${avgVolOfVol.toFixed(0)}bps`);

  // Rising vol count (weight 15)
  const risingPct = (risingCount / valid.length) * 100;
  score += (risingPct / 100) * 15;
  if (risingPct > 50) drivers.push(`${risingCount} rates with rising vol`);

  // Extreme count (weight 10)
  score += Math.min(1, extreme / 3) * 10;
  if (extreme > 0) drivers.push(`${extreme} rates at extreme vol levels`);

  score = Math.round(Math.max(0, Math.min(100, score)));

  const regime: VolRegime =
    score >= 75 ? "Vol Storm" :
    score >= 50 ? "Elevated" :
    score >= 25 ? "Normal" : "Low Vol";

  const transition: VolRegimeResult["transition"] =
    risingCount > valid.length * 0.6 ? "rising" :
    valid.filter((v) => v.volTrend === "falling").length > valid.length * 0.6 ? "falling" : "stable";

  return { regime, score, drivers, transition, daysInRegime: 0 };
}

// ── Cross-Asset Vol ─────────────────────────────────────────────────

export function computeCrossAssetVol(map: SeriesMap): CrossAssetVol[] {
  return BENCHMARK_SERIES.map((def) => {
    const obs = map[def.id] ?? [];
    const rv = computeRealizedVol(obs, def);
    return {
      seriesId: def.id,
      label: def.short,
      category: def.category,
      vol5d: rv.windows[5].annualized,
      vol20d: rv.windows[20].annualized,
      vol60d: rv.windows[60].annualized,
      volRatio: rv.windows[20].annualized != null && rv.windows[60].annualized != null && rv.windows[60].annualized > 0
        ? Number((rv.windows[20].annualized / rv.windows[60].annualized).toFixed(2))
        : null,
      percentile: rv.percentile,
      regime: rv.currentVsHistoric,
    };
  });
}

// ── Vol-of-Vol ──────────────────────────────────────────────────────

export function computeVolOfVol(
  obs: Obs[],
  def: BenchmarkDef,
  innerWindow: VolWindow = 20,
  outerWindow = 20,
): number | null {
  const changes = dailyChanges(obs, def);
  if (changes.length < innerWindow + outerWindow) return null;

  const rolling = rollingStdev(changes, innerWindow);
  const annVols = rolling.vals.map((v) => annualize(v));

  if (annVols.length < outerWindow) return null;

  const recent = annVols.slice(-outerWindow);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const variance = recent.reduce((a, v) => a + (v - mean) ** 2, 0) / recent.length;
  return Number(Math.sqrt(variance).toFixed(2));
}

// ── Vol Correlation ─────────────────────────────────────────────────

export function volCorrelation(map: SeriesMap, ids: string[], window = 60): CorrelationResult {
  return computeCorrelation(map, ids, window);
}

// ── Summary ─────────────────────────────────────────────────────────

export function computeVolSummary(vols: RealizedVol[], regime: VolRegimeResult): VolSummary {
  const valid = vols.filter((v) => v.windows[20].annualized != null);
  const avg20d = valid.length > 0
    ? Number((valid.reduce((s, v) => s + v.windows[20].annualized!, 0) / valid.length).toFixed(1))
    : null;

  const avgVov = valid.filter((v) => v.volOfVol20d != null);
  const avgVolOfVol = avgVov.length > 0
    ? Number((avgVov.reduce((s, v) => s + v.volOfVol20d!, 0) / avgVov.length).toFixed(1))
    : null;

  const risingCount = valid.filter((v) => v.volTrend === "rising").length;
  const fallingCount = valid.filter((v) => v.volTrend === "falling").length;
  const volTrend: VolSummary["volTrend"] =
    risingCount > valid.length * 0.5 ? "rising" :
    fallingCount > valid.length * 0.5 ? "falling" : "stable";

  let topMover = "—";
  let topMoverChg: number | null = null;
  for (const v of valid) {
    const vol20 = v.windows[20].annualized;
    const vol60 = v.windows[60].annualized;
    if (vol20 != null && vol60 != null) {
      const chg = vol20 - vol60;
      if (topMoverChg == null || Math.abs(chg) > Math.abs(topMoverChg)) {
        topMover = v.def.short;
        topMoverChg = Number(chg.toFixed(1));
      }
    }
  }

  return {
    regime: regime.regime,
    regimeScore: regime.score,
    avg20dVol: avg20d,
    volTrend,
    elevatedCount: valid.filter((v) => v.currentVsHistoric === "elevated").length,
    extremeCount: valid.filter((v) => v.currentVsHistoric === "extreme").length,
    avgVolOfVol,
    topMover,
    topMoverChg,
  };
}

export const DATA_SOURCE = "SIM" as const;
