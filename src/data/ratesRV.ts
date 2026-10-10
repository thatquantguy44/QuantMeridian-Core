/**
 * Rates Relative Value Analytics.
 *
 * Pure functions over the Treasury curve producing butterfly spreads,
 * z-scores, carry/roll proxies, real-yield decomposition, and
 * steepener/flattener classification. Consumed by the curve page.
 */
import { Rng } from "@/lib/rng";
import { type CurveSnapshot } from "./econCurve";

export const DATA_SOURCE = "SIM" as const;

// ── Butterfly Spreads ───────────────────────────────────────────────────────

export interface ButterflySpread {
  id: string;
  label: string;
  wings: string;
  belly: string;
  valueBps: number;
  zScore: number;
  percentile: number;
  signal: "Rich" | "Cheap" | "Fair";
  hist20d: number[];
}

function yieldAt(snap: CurveSnapshot, tenor: string): number {
  return snap.points.find((p) => p.tenor === tenor)?.yield ?? 0;
}

export function computeButterflies(snap: CurveSnapshot): ButterflySpread[] {
  const rng = new Rng("rates-fly");

  const defs: { id: string; label: string; wing1: string; belly: string; wing2: string }[] = [
    { id: "2s5s10s", label: "2s5s10s", wing1: "2Y", belly: "5Y", wing2: "10Y" },
    { id: "3m2y10y", label: "3m·2y·10y", wing1: "3M", belly: "2Y", wing2: "10Y" },
    { id: "5s10s30s", label: "5s10s30s", wing1: "5Y", belly: "10Y", wing2: "30Y" },
  ];

  return defs.map((d) => {
    const w1 = yieldAt(snap, d.wing1) * 100;
    const b = yieldAt(snap, d.belly) * 100;
    const w2 = yieldAt(snap, d.wing2) * 100;
    const fly = 2 * b - w1 - w2;
    const z = rng.normal(0, 0.8);
    const pctile = Math.round(50 + z * 18);
    const hist = Array.from({ length: 20 }, () => fly + rng.normal(0, 3));

    return {
      id: d.id,
      label: d.label,
      wings: `${d.wing1} / ${d.wing2}`,
      belly: d.belly,
      valueBps: Math.round(fly * 10) / 10,
      zScore: Math.round(z * 100) / 100,
      percentile: Math.max(1, Math.min(99, pctile)),
      signal: pctile >= 70 ? "Rich" : pctile <= 30 ? "Cheap" : "Fair",
      hist20d: hist,
    };
  });
}

export function computeButterfliesFromHistory(snap: CurveSnapshot, history: CurveSnapshot[]): ButterflySpread[] {
  if (history.length < 20) return computeButterflies(snap);

  const defs: { id: string; label: string; wing1: string; belly: string; wing2: string }[] = [
    { id: "2s5s10s", label: "2s5s10s", wing1: "2Y", belly: "5Y", wing2: "10Y" },
    { id: "3m2y10y", label: "3m·2y·10y", wing1: "3M", belly: "2Y", wing2: "10Y" },
    { id: "5s10s30s", label: "5s10s30s", wing1: "5Y", belly: "10Y", wing2: "30Y" },
  ];

  return defs.map((d) => {
    const flyVal = (s: CurveSnapshot) => 2 * yieldAt(s, d.belly) * 100 - yieldAt(s, d.wing1) * 100 - yieldAt(s, d.wing2) * 100;
    const current = flyVal(snap);
    const hist = history.map(flyVal);
    const mean = hist.reduce((a, v) => a + v, 0) / hist.length;
    const std = Math.sqrt(hist.reduce((a, v) => a + (v - mean) ** 2, 0) / hist.length) || 1;
    const z = (current - mean) / std;
    const pctile = Math.round((hist.filter((v) => v <= current).length / hist.length) * 100);
    const recent = hist.slice(-20);
    recent.push(current);

    return {
      id: d.id,
      label: d.label,
      wings: `${d.wing1} / ${d.wing2}`,
      belly: d.belly,
      valueBps: Math.round(current * 10) / 10,
      zScore: Math.round(z * 100) / 100,
      percentile: Math.max(1, Math.min(99, pctile)),
      signal: pctile >= 70 ? "Rich" : pctile <= 30 ? "Cheap" : "Fair",
      hist20d: recent,
    };
  });
}

export function computeSpreadZFromHistory(snap: CurveSnapshot, history: CurveSnapshot[]): SpreadZRow[] {
  if (history.length < 20) return computeSpreadZScores(snap);

  const pairs: { id: string; label: string; t1: string; t2: string }[] = [
    { id: "2s10s", label: "2s10s", t1: "2Y", t2: "10Y" },
    { id: "2s5s", label: "2s5s", t1: "2Y", t2: "5Y" },
    { id: "5s10s", label: "5s10s", t1: "5Y", t2: "10Y" },
    { id: "5s30s", label: "5s30s", t1: "5Y", t2: "30Y" },
    { id: "10s30s", label: "10s30s", t1: "10Y", t2: "30Y" },
    { id: "3m10y", label: "3m10y", t1: "3M", t2: "10Y" },
  ];

  return pairs.map((p) => {
    const spreadOf = (s: CurveSnapshot) => (yieldAt(s, p.t2) - yieldAt(s, p.t1)) * 100;
    const current = spreadOf(snap);
    const all = history.map(spreadOf);
    const last3m = all.slice(-63);

    const mean1y = all.reduce((a, v) => a + v, 0) / all.length;
    const std1y = Math.sqrt(all.reduce((a, v) => a + (v - mean1y) ** 2, 0) / all.length) || 1;
    const mean3m = last3m.reduce((a, v) => a + v, 0) / last3m.length;
    const std3m = Math.sqrt(last3m.reduce((a, v) => a + (v - mean3m) ** 2, 0) / last3m.length) || 1;

    const z1 = (current - mean1y) / std1y;
    const z3 = (current - mean3m) / std3m;
    const pctile = Math.round((all.filter((v) => v <= current).length / all.length) * 100);

    return {
      id: p.id,
      label: p.label,
      valueBps: Math.round(current * 10) / 10,
      zScore3m: Math.round(z3 * 100) / 100,
      zScore1y: Math.round(z1 * 100) / 100,
      percentile1y: Math.max(1, Math.min(99, pctile)),
      trend: z3 > 0.4 ? "Widening" : z3 < -0.4 ? "Tightening" : "Stable",
    };
  });
}

// ── Spread Z-Scores & Percentiles ───────────────────────────────────────────

export interface SpreadZRow {
  id: string;
  label: string;
  valueBps: number;
  zScore3m: number;
  zScore1y: number;
  percentile1y: number;
  trend: "Widening" | "Stable" | "Tightening";
}

export function computeSpreadZScores(snap: CurveSnapshot): SpreadZRow[] {
  const rng = new Rng("rates-zscore");

  const pairs: { id: string; label: string; t1: string; t2: string }[] = [
    { id: "2s10s", label: "2s10s", t1: "2Y", t2: "10Y" },
    { id: "2s5s", label: "2s5s", t1: "2Y", t2: "5Y" },
    { id: "5s10s", label: "5s10s", t1: "5Y", t2: "10Y" },
    { id: "5s30s", label: "5s30s", t1: "5Y", t2: "30Y" },
    { id: "10s30s", label: "10s30s", t1: "10Y", t2: "30Y" },
    { id: "3m10y", label: "3m10y", t1: "3M", t2: "10Y" },
  ];

  return pairs.map((p) => {
    const bps = (yieldAt(snap, p.t2) - yieldAt(snap, p.t1)) * 100;
    const z3 = rng.normal(0, 0.7);
    const z1 = rng.normal(0, 0.9);
    const pctile = Math.round(50 + z1 * 20);

    return {
      id: p.id,
      label: p.label,
      valueBps: Math.round(bps * 10) / 10,
      zScore3m: Math.round(z3 * 100) / 100,
      zScore1y: Math.round(z1 * 100) / 100,
      percentile1y: Math.max(1, Math.min(99, pctile)),
      trend: z3 > 0.4 ? "Widening" : z3 < -0.4 ? "Tightening" : "Stable",
    };
  });
}

// ── Carry & Roll Proxy ──────────────────────────────────────────────────────

export interface CarryRollRow {
  tenor: string;
  yield: number;
  carryBps3m: number;
  rollBps3m: number;
  totalBps3m: number;
  rank: number;
}

export function computeCarryRoll(snap: CurveSnapshot): CarryRollRow[] {
  const pts = snap.points.filter((p) => p.months >= 12);
  const rows = pts.map((p, i) => {
    const funding = yieldAt(snap, "3M");
    const carry = (p.yield - funding) * 100;
    const nextPt = pts.find((q) => q.months > p.months);
    const roll = nextPt ? (nextPt.yield - p.yield) * 100 * (3 / 12) : 0;
    return {
      tenor: p.tenor,
      yield: p.yield,
      carryBps3m: Math.round(carry * 25) / 100,
      rollBps3m: Math.round(roll * 100) / 100,
      totalBps3m: Math.round((carry * 25 + roll * 100) / 100),
      rank: 0,
    };
  });
  rows.sort((a, b) => b.totalBps3m - a.totalBps3m).forEach((r, i) => (r.rank = i + 1));
  return rows.sort((a, b) => {
    const aIdx = pts.findIndex((p) => p.tenor === a.tenor);
    const bIdx = pts.findIndex((p) => p.tenor === b.tenor);
    return aIdx - bIdx;
  });
}

// ── Real Yield vs Breakeven Decomposition ───────────────────────────────────

export interface RealBreakevenRow {
  tenor: string;
  nominal: number;
  realYield: number;
  breakeven: number;
  termPremium: number;
}

export function computeRealBreakeven(): RealBreakevenRow[] {
  const rng = new Rng("rates-real-be");
  return [
    { tenor: "5Y", nominal: 3.80, realYield: 1.72 + rng.normal(0, 0.05), breakeven: 2.08 + rng.normal(0, 0.04), termPremium: rng.float(0.15, 0.35) },
    { tenor: "7Y", nominal: 3.95, realYield: 1.80 + rng.normal(0, 0.05), breakeven: 2.15 + rng.normal(0, 0.04), termPremium: rng.float(0.20, 0.40) },
    { tenor: "10Y", nominal: 4.11, realYield: 1.92 + rng.normal(0, 0.06), breakeven: 2.19 + rng.normal(0, 0.05), termPremium: rng.float(0.30, 0.55) },
    { tenor: "20Y", nominal: 4.45, realYield: 2.10 + rng.normal(0, 0.06), breakeven: 2.35 + rng.normal(0, 0.05), termPremium: rng.float(0.40, 0.65) },
    { tenor: "30Y", nominal: 4.35, realYield: 2.05 + rng.normal(0, 0.07), breakeven: 2.30 + rng.normal(0, 0.05), termPremium: rng.float(0.45, 0.70) },
  ].map((r) => ({
    ...r,
    realYield: Math.round(r.realYield * 100) / 100,
    breakeven: Math.round(r.breakeven * 100) / 100,
    termPremium: Math.round(r.termPremium * 100) / 100,
  }));
}

// ── Steepener/Flattener Classifier ──────────────────────────────────────────

export type CurveMove = "Bull Steepener" | "Bear Steepener" | "Bull Flattener" | "Bear Flattener" | "Parallel Shift" | "Twist";

export interface CurveMoveResult {
  classification: CurveMove;
  frontChange: number;
  backChange: number;
  slopeChange: number;
  description: string;
}

export function classifyCurveMove(current: CurveSnapshot, prior: CurveSnapshot): CurveMoveResult {
  const cur2y = yieldAt(current, "2Y");
  const cur10y = yieldAt(current, "10Y");
  const pri2y = yieldAt(prior, "2Y");
  const pri10y = yieldAt(prior, "10Y");

  const frontChg = (cur2y - pri2y) * 100;
  const backChg = (cur10y - pri10y) * 100;
  const slopeChg = (cur10y - cur2y - (pri10y - pri2y)) * 100;

  let classification: CurveMove;
  let description: string;

  if (Math.abs(frontChg - backChg) < 3) {
    classification = "Parallel Shift";
    description = frontChg > 0 ? "Rates moving higher across the curve." : "Rates declining across the curve.";
  } else if (Math.abs(slopeChg) < 2 && Math.abs(frontChg) > 5 && Math.abs(backChg) > 5) {
    classification = "Twist";
    description = "Front and back moving in opposite directions — curve restructuring.";
  } else if (slopeChg > 0 && backChg <= 0) {
    classification = "Bull Steepener";
    description = "Front end rallying faster than the long end — classic easing signal. Positive for carry trades.";
  } else if (slopeChg > 0 && backChg > 0) {
    classification = "Bear Steepener";
    description = "Long end selling off more than the front — term premium expansion. Watch duration risk.";
  } else if (slopeChg < 0 && frontChg > 0) {
    classification = "Bear Flattener";
    description = "Front end rising — tightening expectations. Negative for financing carry.";
  } else {
    classification = "Bull Flattener";
    description = "Long end rallying more than front — flight to quality or duration demand.";
  }

  return {
    classification,
    frontChange: Math.round(frontChg * 10) / 10,
    backChange: Math.round(backChg * 10) / 10,
    slopeChange: Math.round(slopeChg * 10) / 10,
    description,
  };
}
