/**
 * FCOST — Funding Cost Analytics Engine.
 *
 * Translates raw benchmark rates into blended cost of funds by
 * counterparty credit tier. Computes desk-level funding attribution,
 * term funding ladders, and inter-tier spread analysis.
 *
 * All analytics are pure functions over SeriesMap — no side effects.
 */
import type { SeriesMap, Obs } from "@/data/benchmarkRates";
import { defOf, computeTrend, type TrendMetrics } from "@/data/benchmarkRates";

// ── Types ────────────────────────────────────────────────────────────

export type CreditTier = "Sovereign" | "Secured" | "AA" | "A" | "BBB" | "HY";

export interface TierDefinition {
  id: CreditTier;
  label: string;
  baseRate: string;
  spreadSeries: string | null;
  spreadMultiplier: number;
  fixedSpreadBps: number;
  color: string;
}

export interface TierCost {
  tier: TierDefinition;
  baseRate: number | null;
  spreadBps: number | null;
  allInRate: number | null;
  allInBps: number | null;
  chg1d: number | null;
  chg20d: number | null;
  percentile: number | null;
  zScore: number | null;
  history: number[];
  dates: string[];
  trend: TrendMetrics;
}

export type DeskId = "SLAB" | "COLL" | "CASH" | "REINV" | "PB" | "REPO";

export interface DeskTierWeight {
  tier: CreditTier;
  weight: number;
  costBps: number | null;
}

export interface DeskFundingProfile {
  desk: DeskId;
  label: string;
  primaryTier: CreditTier;
  weightedCostBps: number | null;
  tierBreakdown: DeskTierWeight[];
  vsYesterday: number | null;
  vs20dAgo: number | null;
  signal: "cheap" | "normal" | "expensive";
}

export type FundingRegime = "Tight" | "Normal" | "Wide" | "Stress";

export interface FundingCostSummary {
  sovrRate: number | null;
  aaAllIn: number | null;
  bbbAllIn: number | null;
  hyAllIn: number | null;
  securedRate: number | null;
  spreadCompression: number | null;
  regime: FundingRegime;
  regimeScore: number;
}

export interface TermFundingLadder {
  tenor: string;
  years: number;
  secured: number | null;
  aa: number | null;
  bbb: number | null;
  hy: number | null;
}

export interface TierSpreadResult {
  label: string;
  tierA: CreditTier;
  tierB: CreditTier;
  current: number | null;
  history: number[];
  dates: string[];
  mean: number | null;
  zScore: number | null;
  percentile: number | null;
  trend: TrendMetrics;
}

// ── Tier Definitions ────────────────────────────────────────────────

export const DEFAULT_TIERS: TierDefinition[] = [
  { id: "Sovereign", label: "Sovereign / Agency", baseRate: "SOFR", spreadSeries: null, spreadMultiplier: 0, fixedSpreadBps: 0, color: "#3B9DFF" },
  { id: "Secured", label: "Secured (Repo/GC)", baseRate: "BGCR", spreadSeries: null, spreadMultiplier: 0, fixedSpreadBps: -2, color: "#22D3EE" },
  { id: "AA", label: "AA-Rated Unsecured", baseRate: "SOFR", spreadSeries: "BAMLC0A1CAAA", spreadMultiplier: 1, fixedSpreadBps: 5, color: "#2ECC71" },
  { id: "A", label: "A-Rated Unsecured", baseRate: "SOFR", spreadSeries: "BAMLC0A0CM", spreadMultiplier: 1, fixedSpreadBps: 0, color: "#A78BFA" },
  { id: "BBB", label: "BBB-Rated Unsecured", baseRate: "SOFR", spreadSeries: "BAMLC0A4CBBB", spreadMultiplier: 1, fixedSpreadBps: 0, color: "#FFB400" },
  { id: "HY", label: "High Yield / Sub-IG", baseRate: "SOFR", spreadSeries: "BAMLH0A0HYM2", spreadMultiplier: 1, fixedSpreadBps: 0, color: "#FF3B3B" },
];

// ── Desk Funding Profiles ───────────────────────────────────────────

const DESK_PROFILES: { desk: DeskId; label: string; primaryTier: CreditTier; weights: { tier: CreditTier; weight: number }[] }[] = [
  { desk: "SLAB", label: "Securities Lending", primaryTier: "Secured", weights: [
    { tier: "Secured", weight: 0.55 }, { tier: "Sovereign", weight: 0.25 }, { tier: "AA", weight: 0.20 },
  ]},
  { desk: "COLL", label: "Collateral Mgmt", primaryTier: "Secured", weights: [
    { tier: "Secured", weight: 0.70 }, { tier: "Sovereign", weight: 0.20 }, { tier: "AA", weight: 0.10 },
  ]},
  { desk: "CASH", label: "Cash / Treasury", primaryTier: "AA", weights: [
    { tier: "Sovereign", weight: 0.30 }, { tier: "AA", weight: 0.40 }, { tier: "A", weight: 0.20 }, { tier: "BBB", weight: 0.10 },
  ]},
  { desk: "REINV", label: "Reinvestment", primaryTier: "AA", weights: [
    { tier: "Sovereign", weight: 0.20 }, { tier: "AA", weight: 0.35 }, { tier: "A", weight: 0.30 }, { tier: "BBB", weight: 0.15 },
  ]},
  { desk: "PB", label: "Prime Brokerage", primaryTier: "A", weights: [
    { tier: "AA", weight: 0.15 }, { tier: "A", weight: 0.40 }, { tier: "BBB", weight: 0.30 }, { tier: "HY", weight: 0.15 },
  ]},
  { desk: "REPO", label: "Repo / Funding", primaryTier: "Secured", weights: [
    { tier: "Secured", weight: 0.80 }, { tier: "Sovereign", weight: 0.15 }, { tier: "AA", weight: 0.05 },
  ]},
];

// ── Term Ladder Tenors ──────────────────────────────────────────────

const TERM_TENORS: { tenor: string; years: number; securedId: string }[] = [
  { tenor: "O/N", years: 0, securedId: "SOFR" },
  { tenor: "1M", years: 1 / 12, securedId: "DGS1MO" },
  { tenor: "3M", years: 3 / 12, securedId: "DGS3MO" },
  { tenor: "1Y", years: 1, securedId: "DGS1" },
  { tenor: "2Y", years: 2, securedId: "DGS2" },
  { tenor: "5Y", years: 5, securedId: "DGS5" },
];

// ── Core Functions ──────────────────────────────────────────────────

function latest(obs: Obs[] | undefined): number | null {
  return obs && obs.length > 0 ? obs[obs.length - 1].value : null;
}

function prior(obs: Obs[] | undefined, offset = 1): number | null {
  return obs && obs.length > offset ? obs[obs.length - 1 - offset].value : null;
}

function computeTierAllIn(map: SeriesMap, tier: TierDefinition, dayIndex: number): number | null {
  const baseObs = map[tier.baseRate];
  if (!baseObs || dayIndex < 0 || dayIndex >= baseObs.length) return null;

  const baseVal = baseObs[dayIndex].value;
  let spreadBps = tier.fixedSpreadBps;

  if (tier.spreadSeries) {
    const spreadObs = map[tier.spreadSeries];
    if (spreadObs && dayIndex < spreadObs.length) {
      const spreadDef = defOf(tier.spreadSeries);
      const rawSpread = spreadObs[dayIndex].value;
      const inBps = spreadDef?.unit === "bps" ? rawSpread : rawSpread * 100;
      spreadBps += inBps * tier.spreadMultiplier;
    }
  }

  return baseVal + spreadBps / 100;
}

export function computeTierCosts(map: SeriesMap, tiers: TierDefinition[] = DEFAULT_TIERS): TierCost[] {
  return tiers.map((tier) => {
    const baseObs = map[tier.baseRate] ?? [];
    const n = baseObs.length;

    const history: number[] = [];
    const dates: string[] = [];

    for (let i = 0; i < n; i++) {
      const allIn = computeTierAllIn(map, tier, i);
      if (allIn != null) {
        history.push(Number(allIn.toFixed(4)));
        dates.push(baseObs[i].date);
      }
    }

    const current = history.length > 0 ? history[history.length - 1] : null;
    const prev = history.length > 1 ? history[history.length - 2] : null;
    const p20 = history.length > 20 ? history[history.length - 21] : null;

    const obs: Obs[] = dates.map((d, i) => ({ date: d, value: history[i] }));
    const trend = computeTrend(obs);

    let zScore: number | null = null;
    let percentile: number | null = null;
    if (history.length >= 20 && current != null) {
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const std = Math.sqrt(history.reduce((a, v) => a + (v - mean) ** 2, 0) / history.length);
      zScore = std > 0 ? Number(((current - mean) / std).toFixed(2)) : 0;
      const sorted = [...history].sort((a, b) => a - b);
      percentile = Math.round((sorted.filter((v) => v <= current).length / sorted.length) * 100);
    }

    const baseRate = latest(baseObs);
    let spreadBps: number | null = tier.fixedSpreadBps;
    if (tier.spreadSeries) {
      const spreadVal = latest(map[tier.spreadSeries]);
      if (spreadVal != null) {
        const spreadDef = defOf(tier.spreadSeries);
        const inBps = spreadDef?.unit === "bps" ? spreadVal : spreadVal * 100;
        spreadBps = tier.fixedSpreadBps + inBps * tier.spreadMultiplier;
      }
    }

    return {
      tier,
      baseRate,
      spreadBps: spreadBps != null ? Number(spreadBps.toFixed(1)) : null,
      allInRate: current,
      allInBps: current != null ? Number((current * 100).toFixed(1)) : null,
      chg1d: current != null && prev != null ? Number(((current - prev) * 100).toFixed(1)) : null,
      chg20d: current != null && p20 != null ? Number(((current - p20) * 100).toFixed(1)) : null,
      percentile,
      zScore,
      history,
      dates,
      trend,
    };
  });
}

// ── Desk Funding ────────────────────────────────────────────────────

export function computeDeskFunding(map: SeriesMap, tiers?: TierDefinition[]): DeskFundingProfile[] {
  const costs = computeTierCosts(map, tiers);
  const costMap = new Map(costs.map((c) => [c.tier.id, c]));

  return DESK_PROFILES.map((dp) => {
    const breakdown: DeskTierWeight[] = dp.weights.map((w) => {
      const tc = costMap.get(w.tier);
      return { tier: w.tier, weight: w.weight, costBps: tc?.allInBps ?? null };
    });

    let weightedCost: number | null = null;
    const validWeights = breakdown.filter((b) => b.costBps != null);
    if (validWeights.length > 0) {
      weightedCost = Number(validWeights.reduce((s, b) => s + b.weight * b.costBps!, 0).toFixed(1));
    }

    // Historical weighted cost for change comparison
    let vsYesterday: number | null = null;
    let vs20dAgo: number | null = null;

    const costHistories = dp.weights.map((w) => {
      const tc = costMap.get(w.tier);
      return { weight: w.weight, history: tc?.history ?? [] };
    });

    const minLen = Math.min(...costHistories.map((h) => h.history.length));
    if (minLen > 1 && weightedCost != null) {
      const yesterdayCost = costHistories.reduce((s, h) => s + h.weight * (h.history[h.history.length - 2] ?? 0) * 100, 0);
      vsYesterday = Number((weightedCost - yesterdayCost).toFixed(1));
    }
    if (minLen > 20 && weightedCost != null) {
      const ago20Cost = costHistories.reduce((s, h) => s + h.weight * (h.history[h.history.length - 21] ?? 0) * 100, 0);
      vs20dAgo = Number((weightedCost - ago20Cost).toFixed(1));
    }

    const signal: DeskFundingProfile["signal"] =
      vs20dAgo != null && vs20dAgo > 15 ? "expensive" :
      vs20dAgo != null && vs20dAgo < -15 ? "cheap" : "normal";

    return {
      desk: dp.desk,
      label: dp.label,
      primaryTier: dp.primaryTier,
      weightedCostBps: weightedCost,
      tierBreakdown: breakdown,
      vsYesterday,
      vs20dAgo,
      signal,
    };
  });
}

// ── Term Funding Ladder ─────────────────────────────────────────────

export function computeTermLadder(map: SeriesMap): TermFundingLadder[] {
  const aaOas = latest(map["BAMLC0A1CAAA"]);
  const bbbOas = latest(map["BAMLC0A4CBBB"]);
  const hyOas = latest(map["BAMLH0A0HYM2"]);

  const aaDef = defOf("BAMLC0A1CAAA");
  const bbbDef = defOf("BAMLC0A4CBBB");
  const hyDef = defOf("BAMLH0A0HYM2");

  const aaSpreadPct = aaOas != null ? (aaDef?.unit === "bps" ? aaOas / 100 : aaOas) : null;
  const bbbSpreadPct = bbbOas != null ? (bbbDef?.unit === "bps" ? bbbOas / 100 : bbbOas) : null;
  const hySpreadPct = hyOas != null ? (hyDef?.unit === "bps" ? hyOas / 100 : hyOas) : null;

  return TERM_TENORS.map((t) => {
    const secured = latest(map[t.securedId]);
    return {
      tenor: t.tenor,
      years: t.years,
      secured,
      aa: secured != null && aaSpreadPct != null ? Number((secured + aaSpreadPct + 0.05).toFixed(3)) : null,
      bbb: secured != null && bbbSpreadPct != null ? Number((secured + bbbSpreadPct).toFixed(3)) : null,
      hy: secured != null && hySpreadPct != null ? Number((secured + hySpreadPct).toFixed(3)) : null,
    };
  });
}

// ── Tier Spreads ────────────────────────────────────────────────────

const TIER_SPREAD_DEFS: { label: string; tierA: CreditTier; tierB: CreditTier }[] = [
  { label: "HY − IG", tierA: "HY", tierB: "A" },
  { label: "BBB − AA", tierA: "BBB", tierB: "AA" },
  { label: "Unsecured − Secured", tierA: "AA", tierB: "Secured" },
  { label: "HY − AA", tierA: "HY", tierB: "AA" },
  { label: "A − Sovereign", tierA: "A", tierB: "Sovereign" },
];

export function computeTierSpreads(costs: TierCost[]): TierSpreadResult[] {
  const costMap = new Map(costs.map((c) => [c.tier.id, c]));

  return TIER_SPREAD_DEFS.map((def) => {
    const a = costMap.get(def.tierA);
    const b = costMap.get(def.tierB);

    if (!a || !b) {
      return {
        label: def.label, tierA: def.tierA, tierB: def.tierB,
        current: null, history: [], dates: [], mean: null, zScore: null, percentile: null,
        trend: computeTrend([]),
      };
    }

    const minLen = Math.min(a.history.length, b.history.length);
    const history: number[] = [];
    const dates: string[] = [];

    for (let i = 0; i < minLen; i++) {
      const aIdx = a.history.length - minLen + i;
      const bIdx = b.history.length - minLen + i;
      const spread = (a.history[aIdx] - b.history[bIdx]) * 100;
      history.push(Number(spread.toFixed(1)));
      dates.push(a.dates[aIdx]);
    }

    const current = history.length > 0 ? history[history.length - 1] : null;
    const obs: Obs[] = dates.map((d, i) => ({ date: d, value: history[i] }));
    const trend = computeTrend(obs);

    let mean: number | null = null;
    let zScore: number | null = null;
    let percentile: number | null = null;

    if (history.length >= 20 && current != null) {
      mean = Number((history.reduce((s, v) => s + v, 0) / history.length).toFixed(1));
      const std = Math.sqrt(history.reduce((s, v) => s + (v - mean!) ** 2, 0) / history.length);
      zScore = std > 0 ? Number(((current - mean) / std).toFixed(2)) : 0;
      const sorted = [...history].sort((a, b) => a - b);
      percentile = Math.round((sorted.filter((v) => v <= current).length / sorted.length) * 100);
    }

    return { label: def.label, tierA: def.tierA, tierB: def.tierB, current, history, dates, mean, zScore, percentile, trend };
  });
}

// ── Funding Regime ──────────────────────────────────────────────────

export function classifyFundingRegime(costs: TierCost[]): { regime: FundingRegime; score: number } {
  const hyTier = costs.find((c) => c.tier.id === "HY");
  const aaTier = costs.find((c) => c.tier.id === "AA");
  const bbbTier = costs.find((c) => c.tier.id === "BBB");

  let score = 50;

  if (hyTier?.allInRate != null) {
    if (hyTier.allInRate > 9) score += 15;
    else if (hyTier.allInRate > 7) score += 5;
    else if (hyTier.allInRate < 5) score -= 10;
  }

  if (hyTier?.zScore != null) {
    score += Math.round(hyTier.zScore * 5);
  }

  if (bbbTier?.zScore != null && aaTier?.zScore != null) {
    const spreadZ = bbbTier.zScore - aaTier.zScore;
    if (spreadZ > 1) score += 10;
    else if (spreadZ < -1) score -= 10;
  }

  if (hyTier?.chg20d != null) {
    if (hyTier.chg20d > 30) score += 10;
    else if (hyTier.chg20d < -30) score -= 10;
  }

  score = Math.max(0, Math.min(100, score));

  const regime: FundingRegime =
    score >= 75 ? "Stress" :
    score >= 60 ? "Wide" :
    score >= 40 ? "Normal" : "Tight";

  return { regime, score };
}

// ── Summary ─────────────────────────────────────────────────────────

export function computeFundingCostSummary(map: SeriesMap, tiers?: TierDefinition[]): FundingCostSummary {
  const costs = computeTierCosts(map, tiers);
  const costMap = new Map(costs.map((c) => [c.tier.id, c]));
  const { regime, score } = classifyFundingRegime(costs);

  const hy = costMap.get("HY");
  const aa = costMap.get("AA");
  const bbb = costMap.get("BBB");

  let spreadCompression: number | null = null;
  if (hy?.chg20d != null && aa?.chg20d != null) {
    spreadCompression = Number((hy.chg20d - aa.chg20d).toFixed(1));
  }

  return {
    sovrRate: costMap.get("Sovereign")?.allInRate ?? null,
    aaAllIn: aa?.allInRate ?? null,
    bbbAllIn: bbb?.allInRate ?? null,
    hyAllIn: hy?.allInRate ?? null,
    securedRate: costMap.get("Secured")?.allInRate ?? null,
    spreadCompression,
    regime,
    regimeScore: score,
  };
}

export const DATA_SOURCE = "SIM" as const;
