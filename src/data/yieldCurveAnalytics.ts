/**
 * YCURV — Yield Curve Analytics Engine.
 *
 * Builds daily yield curves from Treasury series in the BMRK SeriesMap,
 * computes shape metrics (slope, curvature, butterfly), tracks regime
 * transitions, and detects inversion segments.
 *
 * All analytics are pure functions over SeriesMap — no side effects.
 */
import type { SeriesMap, Obs, TrendMetrics } from "@/data/benchmarkRates";
import { computeTrend, computeCorrelation, type CorrelationResult } from "@/data/benchmarkRates";

// ── Tenor Definitions ────────────────────────────────────────────────

export interface TenorDef {
  id: string;
  label: string;
  years: number;
}

export const CURVE_TENORS: TenorDef[] = [
  { id: "DGS1MO", label: "1M", years: 1 / 12 },
  { id: "DGS3MO", label: "3M", years: 3 / 12 },
  { id: "DGS6MO", label: "6M", years: 6 / 12 },
  { id: "DGS1", label: "1Y", years: 1 },
  { id: "DGS2", label: "2Y", years: 2 },
  { id: "DGS5", label: "5Y", years: 5 },
  { id: "DGS10", label: "10Y", years: 10 },
  { id: "DGS20", label: "20Y", years: 20 },
  { id: "DGS30", label: "30Y", years: 30 },
];

export const CURVE_IDS = CURVE_TENORS.map((t) => t.id);

// ── Types ────────────────────────────────────────────────────────────

export interface CurvePoint {
  tenor: string;
  label: string;
  years: number;
  yield: number | null;
}

export interface DailyCurve {
  date: string;
  points: CurvePoint[];
  slope2s10s: number | null;
  slope3m10y: number | null;
  curvature: number | null;
  longEnd: number | null;
}

export type CurveRegime =
  | "Bull Steepening"
  | "Bear Steepening"
  | "Bull Flattening"
  | "Bear Flattening"
  | "Inversion Deepening"
  | "Inversion Unwinding"
  | "Stable";

export interface InversionSegment {
  pair: string;
  pairLabel: string;
  startDate: string;
  endDate: string | null;
  durationDays: number;
  maxDepthBps: number;
  currentBps: number | null;
}

export interface ButterflyTrade {
  label: string;
  wings: [string, string];
  body: string;
  valueBps: number | null;
  zScore: number | null;
  percentile: number | null;
  signal: "rich" | "cheap" | "fair";
}

export interface CurveShapeMetrics {
  current: DailyCurve;
  history: DailyCurve[];
  slope2s10s: TrendMetrics;
  slope3m10y: TrendMetrics;
  curvature: TrendMetrics;
  longEnd: TrendMetrics;
  regime: CurveRegime;
  inversions: InversionSegment[];
  butterflies: ButterflyTrade[];
}

export interface CurveDiff {
  tenor: string;
  label: string;
  years: number;
  diffBps: number;
}

export interface CurveSummary {
  slope2s10s: number | null;
  slope3m10y: number | null;
  curvature: number | null;
  longEnd: number | null;
  regime: CurveRegime;
  inversions: number;
  steepest: string;
  flattest: string;
}

// ── Core Functions ───────────────────────────────────────────────────

function yieldAt(map: SeriesMap, id: string, dayIndex: number): number | null {
  const obs = map[id];
  if (!obs || obs.length === 0) return null;
  if (dayIndex < 0 || dayIndex >= obs.length) return null;
  return obs[dayIndex].value;
}

export function buildCurveHistory(map: SeriesMap): DailyCurve[] {
  const refSeries = map[CURVE_IDS[0]];
  if (!refSeries || refSeries.length === 0) return [];

  const n = Math.min(...CURVE_IDS.map((id) => map[id]?.length ?? 0));
  const curves: DailyCurve[] = [];

  for (let i = 0; i < n; i++) {
    const date = refSeries[refSeries.length - n + i].date;
    const points: CurvePoint[] = CURVE_TENORS.map((t) => ({
      tenor: t.id,
      label: t.label,
      years: t.years,
      yield: yieldAt(map, t.id, map[t.id]!.length - n + i),
    }));

    const y2 = points.find((p) => p.tenor === "DGS2")?.yield;
    const y5 = points.find((p) => p.tenor === "DGS5")?.yield;
    const y10 = points.find((p) => p.tenor === "DGS10")?.yield;
    const y30 = points.find((p) => p.tenor === "DGS30")?.yield;
    const y3m = points.find((p) => p.tenor === "DGS3MO")?.yield;

    curves.push({
      date,
      points,
      slope2s10s: y2 != null && y10 != null ? (y10 - y2) * 100 : null,
      slope3m10y: y3m != null && y10 != null ? (y10 - y3m) * 100 : null,
      curvature: y2 != null && y5 != null && y10 != null ? (2 * y5 - y2 - y10) * 100 : null,
      longEnd: y10 != null && y30 != null ? (y30 - y10) * 100 : null,
    });
  }

  return curves;
}

export function computeCurveShape(map: SeriesMap): CurveShapeMetrics {
  const history = buildCurveHistory(map);
  const current = history.length > 0 ? history[history.length - 1] : {
    date: "", points: [], slope2s10s: null, slope3m10y: null, curvature: null, longEnd: null,
  };

  const slopeObs = (key: keyof DailyCurve): Obs[] =>
    history.filter((c) => c[key] != null).map((c) => ({ date: c.date, value: c[key] as number }));

  return {
    current,
    history,
    slope2s10s: computeTrend(slopeObs("slope2s10s")),
    slope3m10y: computeTrend(slopeObs("slope3m10y")),
    curvature: computeTrend(slopeObs("curvature")),
    longEnd: computeTrend(slopeObs("longEnd")),
    regime: classifyCurveRegime(history),
    inversions: findInversions(history),
    butterflies: computeButterflies(map, history),
  };
}

export function classifyCurveRegime(history: DailyCurve[], lookback = 20): CurveRegime {
  if (history.length < lookback + 1) return "Stable";

  const recent = history.slice(-lookback);
  const prev = history.slice(-(lookback + 1), -1);

  const slopeNow = recent[recent.length - 1].slope2s10s;
  const slopeThen = prev[0].slope2s10s;
  const y2Now = recent[recent.length - 1].points.find((p) => p.tenor === "DGS2")?.yield;
  const y2Then = prev[0].points.find((p) => p.tenor === "DGS2")?.yield;

  if (slopeNow == null || slopeThen == null || y2Now == null || y2Then == null) return "Stable";

  const slopeChg = slopeNow - slopeThen;
  const rateChg = (y2Now - y2Then) * 100;

  if (slopeNow < -10) {
    return slopeChg < -2 ? "Inversion Deepening" : "Inversion Unwinding";
  }

  if (Math.abs(slopeChg) < 3) return "Stable";

  if (slopeChg > 0) {
    return rateChg < 0 ? "Bull Steepening" : "Bear Steepening";
  } else {
    return rateChg < 0 ? "Bull Flattening" : "Bear Flattening";
  }
}

const INVERSION_PAIRS = [
  { a: "DGS2", b: "DGS10", label: "2s10s" },
  { a: "DGS3MO", b: "DGS10", label: "3m10y" },
  { a: "DGS1", b: "DGS10", label: "1s10s" },
  { a: "DGS2", b: "DGS5", label: "2s5s" },
  { a: "DGS5", b: "DGS30", label: "5s30s" },
];

export function findInversions(history: DailyCurve[]): InversionSegment[] {
  const segments: InversionSegment[] = [];

  for (const pair of INVERSION_PAIRS) {
    let segStart: string | null = null;
    let maxDepth = 0;

    for (const curve of history) {
      const yA = curve.points.find((p) => p.tenor === pair.a)?.yield;
      const yB = curve.points.find((p) => p.tenor === pair.b)?.yield;
      if (yA == null || yB == null) continue;

      const spreadBps = (yB - yA) * 100;

      if (spreadBps < 0) {
        if (!segStart) segStart = curve.date;
        maxDepth = Math.min(maxDepth, spreadBps);
      } else if (segStart) {
        segments.push({
          pair: `${pair.a}-${pair.b}`,
          pairLabel: pair.label,
          startDate: segStart,
          endDate: curve.date,
          durationDays: Math.round((new Date(curve.date).getTime() - new Date(segStart).getTime()) / 86400000),
          maxDepthBps: Math.abs(maxDepth),
          currentBps: null,
        });
        segStart = null;
        maxDepth = 0;
      }
    }

    if (segStart && history.length > 0) {
      const last = history[history.length - 1];
      const yA = last.points.find((p) => p.tenor === pair.a)?.yield;
      const yB = last.points.find((p) => p.tenor === pair.b)?.yield;
      segments.push({
        pair: `${pair.a}-${pair.b}`,
        pairLabel: pair.label,
        startDate: segStart,
        endDate: null,
        durationDays: Math.round((new Date(last.date).getTime() - new Date(segStart).getTime()) / 86400000),
        maxDepthBps: Math.abs(maxDepth),
        currentBps: yA != null && yB != null ? Number(((yB - yA) * 100).toFixed(1)) : null,
      });
    }
  }

  return segments.sort((a, b) => b.durationDays - a.durationDays);
}

const BUTTERFLY_DEFS = [
  { label: "2-5-10 Butterfly", wings: ["DGS2", "DGS10"] as [string, string], body: "DGS5" },
  { label: "1-5-10 Butterfly", wings: ["DGS1", "DGS10"] as [string, string], body: "DGS5" },
  { label: "2-5-30 Butterfly", wings: ["DGS2", "DGS30"] as [string, string], body: "DGS5" },
  { label: "5-10-30 Butterfly", wings: ["DGS5", "DGS30"] as [string, string], body: "DGS10" },
  { label: "3M-2Y-10Y Butterfly", wings: ["DGS3MO", "DGS10"] as [string, string], body: "DGS2" },
];

function computeButterflies(map: SeriesMap, history: DailyCurve[]): ButterflyTrade[] {
  return BUTTERFLY_DEFS.map((def) => {
    const values = history.map((c) => {
      const w1 = c.points.find((p) => p.tenor === def.wings[0])?.yield;
      const w2 = c.points.find((p) => p.tenor === def.wings[1])?.yield;
      const body = c.points.find((p) => p.tenor === def.body)?.yield;
      if (w1 == null || w2 == null || body == null) return null;
      return (2 * body - w1 - w2) * 100;
    }).filter((v): v is number => v != null);

    const current = values.length > 0 ? values[values.length - 1] : null;
    let zScore: number | null = null;
    let percentile: number | null = null;

    if (values.length >= 20 && current != null) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const std = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length);
      zScore = std > 0 ? Number(((current - mean) / std).toFixed(2)) : 0;
      const sorted = [...values].sort((a, b) => a - b);
      percentile = Math.round((sorted.filter((v) => v <= current).length / sorted.length) * 100);
    }

    const signal: "rich" | "cheap" | "fair" =
      zScore != null && zScore > 1.5 ? "rich" :
      zScore != null && zScore < -1.5 ? "cheap" : "fair";

    return {
      label: def.label,
      wings: def.wings,
      body: def.body,
      valueBps: current != null ? Number(current.toFixed(1)) : null,
      zScore,
      percentile,
      signal,
    };
  });
}

export function curveDiff(a: DailyCurve, b: DailyCurve): CurveDiff[] {
  return CURVE_TENORS.map((t) => {
    const yA = a.points.find((p) => p.tenor === t.id)?.yield;
    const yB = b.points.find((p) => p.tenor === t.id)?.yield;
    return {
      tenor: t.id,
      label: t.label,
      years: t.years,
      diffBps: yA != null && yB != null ? Number(((yA - yB) * 100).toFixed(1)) : 0,
    };
  });
}

export function curveCorrelation(map: SeriesMap, window = 60): CorrelationResult {
  return computeCorrelation(map, CURVE_IDS, window);
}

export function computeCurveSummary(shape: CurveShapeMetrics): CurveSummary {
  const cur = shape.current;
  const diffs = cur.points
    .filter((p) => p.yield != null)
    .map((p, i, arr) => i > 0 && arr[i - 1].yield != null ? { label: `${arr[i - 1].label}/${p.label}`, spread: (p.yield! - arr[i - 1].yield!) * 100 } : null)
    .filter((d): d is { label: string; spread: number } => d != null);

  const steepest = diffs.reduce((a, b) => b.spread > a.spread ? b : a, diffs[0]);
  const flattest = diffs.reduce((a, b) => b.spread < a.spread ? b : a, diffs[0]);

  return {
    slope2s10s: cur.slope2s10s,
    slope3m10y: cur.slope3m10y,
    curvature: cur.curvature,
    longEnd: cur.longEnd,
    regime: shape.regime,
    inversions: shape.inversions.filter((s) => s.endDate == null).length,
    steepest: steepest?.label ?? "—",
    flattest: flattest?.label ?? "—",
  };
}

export const DATA_SOURCE = "SIM" as const;
