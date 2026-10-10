import { Rng } from "@/lib/rng";
import { getSeriesHistory } from "./econSeries";

/** Statistical analysis, ML applications, and Securities-Finance macro linkage. */

/* ───────────────────────── Statistical analysis ───────────────────────── */

const STAT_SERIES = ["DGS10", "DGS2", "FEDFUNDS", "CPIAUCSL", "UNRATE", "T10Y2Y", "BAMLH0A0HYM2", "SOFR"];
const STAT_LABELS: Record<string, string> = {
  DGS10: "10Y", DGS2: "2Y", FEDFUNDS: "EFFR", CPIAUCSL: "CPI", UNRATE: "U-3", T10Y2Y: "2s10s", BAMLH0A0HYM2: "HY OAS", SOFR: "SOFR",
};

function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  const ma = a.slice(0, n).reduce((x, y) => x + y, 0) / n;
  const mb = b.slice(0, n).reduce((x, y) => x + y, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  return num / (Math.sqrt(da * db) || 1);
}

export function getCorrelationMatrix(): { labels: string[]; values: number[][] } {
  const series = STAT_SERIES.map((id) => getSeriesHistory(id, 60).map((o) => o.value));
  const labels = STAT_SERIES.map((id) => STAT_LABELS[id]);
  const values = series.map((a) => series.map((b) => Number(pearson(a, b).toFixed(2))));
  return { labels, values };
}

export interface RegressionResult {
  xLabel: string;
  yLabel: string;
  points: { x: number; y: number }[];
  slope: number;
  intercept: number;
  r2: number;
  beta: number;
  tStat: number;
}

/** OLS of one indicator on another (e.g. HY OAS on 2s10s). */
export function getRegression(xId = "T10Y2Y", yId = "BAMLH0A0HYM2"): RegressionResult {
  const xs = getSeriesHistory(xId, 60).map((o) => o.value);
  const ys = getSeriesHistory(yId, 60).map((o) => o.value);
  const n = Math.min(xs.length, ys.length);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const slope = sxy / (sxx || 1);
  const intercept = my - slope * mx;
  const r2 = (sxy * sxy) / ((sxx * syy) || 1);
  const se = Math.sqrt((1 - r2) * syy / (n - 2)) / Math.sqrt(sxx || 1);
  return {
    xLabel: STAT_LABELS[xId] ?? xId,
    yLabel: STAT_LABELS[yId] ?? yId,
    points: xs.slice(0, n).map((x, i) => ({ x, y: ys[i] })),
    slope: Number(slope.toFixed(3)),
    intercept: Number(intercept.toFixed(2)),
    r2: Number(r2.toFixed(3)),
    beta: Number(slope.toFixed(3)),
    tStat: Number((slope / (se || 1)).toFixed(2)),
  };
}

export interface DistributionBin {
  bin: string;
  count: number;
  center: number;
}

/** Histogram + z-score summary for a series' period-over-period changes. */
export function getDistribution(id = "DGS10"): { bins: DistributionBin[]; mean: number; sd: number; skew: number; latestZ: number } {
  const v = getSeriesHistory(id, 120).map((o) => o.value);
  const diffs = v.slice(1).map((x, i) => x - v[i]);
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const sd = Math.sqrt(diffs.reduce((a, b) => a + (b - mean) ** 2, 0) / diffs.length) || 1;
  const skew = diffs.reduce((a, b) => a + ((b - mean) / sd) ** 3, 0) / diffs.length;
  const nb = 13;
  const min = Math.min(...diffs), max = Math.max(...diffs);
  const w = (max - min) / nb || 1;
  const bins: DistributionBin[] = Array.from({ length: nb }, (_, i) => ({ bin: (min + w * (i + 0.5)).toFixed(2), center: min + w * (i + 0.5), count: 0 }));
  for (const d of diffs) {
    const idx = Math.min(nb - 1, Math.max(0, Math.floor((d - min) / w)));
    bins[idx].count++;
  }
  return { bins, mean: Number(mean.toFixed(3)), sd: Number(sd.toFixed(3)), skew: Number(skew.toFixed(2)), latestZ: Number(((diffs[diffs.length - 1] - mean) / sd).toFixed(2)) };
}

/* ───────────────────────────── ML applications ───────────────────────────── */

export interface MLModel {
  id: string;
  name: string;
  task: "Classification" | "Regression" | "Nowcast" | "Time-Series";
  algo: string;
  target: string;
  output: number; // headline prediction
  outputUnit: string;
  confidence: number; // %
  auc: number;
  status: "LIVE" | "TRAINING" | "STAGING";
  features: { name: string; importance: number }[];
  history: number[]; // predicted target over time
  updated: string;
}

/**
 * Normalize a raw importance list to sum to 1.0 (descending), rounding to 3dp.
 * Keeps feature weights plausible regardless of how many features a model lists.
 */
function normImportances<T extends { name: string; importance: number }>(feats: T[]): T[] {
  const total = feats.reduce((a, f) => a + f.importance, 0) || 1;
  return feats
    .map((f) => ({ ...f, importance: Number((f.importance / total).toFixed(3)) }))
    .sort((a, b) => b.importance - a.importance);
}

export function getMLModels(): MLModel[] {
  const recessionProbHist = getSeriesHistory("T10Y2Y", 48).map((o) => {
    const bps = o.value * 100;
    const z = -bps / 60;
    return Number((1 / (1 + Math.exp(-(z * 2 - 1.2))) * 100).toFixed(1));
  });
  // Financial-conditions index history from the Chicago Fed NFCI (looser < 0).
  const fciHist = getSeriesHistory("NFCI", 48).map((o) => Number(o.value.toFixed(2)));
  // Labor-momentum z-score history driven by initial claims (inverted → tighter labor).
  const claims = getSeriesHistory("ICSA", 48).map((o) => o.value);
  const claimMean = claims.reduce((a, b) => a + b, 0) / claims.length;
  const claimSd = Math.sqrt(claims.reduce((a, b) => a + (b - claimMean) ** 2, 0) / claims.length) || 1;
  const laborHist = claims.map((c) => Number(((c - claimMean) / claimSd).toFixed(2)));

  return [
    {
      id: "rec-prob", name: "Recession Probability (12M)", task: "Classification", algo: "Logistic Regression + Probit (yield-curve)", target: "NBER recession within 12 months",
      output: recessionProbHist[recessionProbHist.length - 1], outputUnit: "%", confidence: 81, auc: 0.89, status: "LIVE",
      features: normImportances([
        { name: "10Y-2Y spread", importance: 0.30 }, { name: "10Y-3M spread", importance: 0.24 }, { name: "HY OAS (BofA)", importance: 0.13 },
        { name: "10Y real yield (TIPS)", importance: 0.10 }, { name: "Initial jobless claims", importance: 0.09 }, { name: "Nonfarm payrolls", importance: 0.07 },
        { name: "ISM Manufacturing PMI", importance: 0.06 }, { name: "Building permits", importance: 0.05 }, { name: "Industrial production", importance: 0.04 },
        { name: "BBB corp OAS", importance: 0.04 }, { name: "Chicago Fed NFCI", importance: 0.03 }, { name: "Avg weekly hours", importance: 0.03 },
      ]),
      history: recessionProbHist, updated: "2026-06-17",
    },
    {
      id: "infl-now", name: "Inflation Nowcast (Core PCE)", task: "Nowcast", algo: "Gradient Boosting (XGBoost) + ridge ensemble", target: "Next Core PCE m/m",
      output: 0.21, outputUnit: "% m/m", confidence: 73, auc: 0.0, status: "LIVE",
      features: normImportances([
        { name: "Sticky CPI (Atlanta Fed)", importance: 0.20 }, { name: "Core CPI", importance: 0.17 }, { name: "Avg hourly earnings", importance: 0.14 },
        { name: "PCE price index", importance: 0.11 }, { name: "PPI all commodities", importance: 0.09 }, { name: "5y breakeven inflation", importance: 0.07 },
        { name: "Case-Shiller home prices", importance: 0.06 }, { name: "Trade-weighted USD", importance: 0.05 }, { name: "Capacity utilization", importance: 0.04 },
        { name: "M2 money supply YoY", importance: 0.04 }, { name: "Unemployment rate", importance: 0.03 },
      ]),
      history: getSeriesHistory("PCEPILFE", 36).map((o) => Number((o.value / 12).toFixed(2))), updated: "2026-06-17",
    },
    {
      id: "rate-path", name: "Policy-Rate Path Forecast", task: "Time-Series", algo: "Bayesian VAR + LSTM", target: "Effective fed funds, 12M",
      output: 3.35, outputUnit: "%", confidence: 68, auc: 0.0, status: "LIVE",
      features: normImportances([
        { name: "Core PCE", importance: 0.18 }, { name: "Unemployment rate", importance: 0.15 }, { name: "Real GDP (SAAR)", importance: 0.12 },
        { name: "2-Year Treasury", importance: 0.11 }, { name: "SOFR", importance: 0.09 }, { name: "Core CPI", importance: 0.08 },
        { name: "Chicago Fed NFCI", importance: 0.07 }, { name: "Nonfarm payrolls", importance: 0.06 }, { name: "Job openings (JOLTS)", importance: 0.05 },
        { name: "10Y-2Y spread", importance: 0.05 }, { name: "Retail sales", importance: 0.04 },
      ]),
      history: [4.08, 4.05, 3.95, 3.86, 3.74, 3.63, 3.55, 3.48, 3.42, 3.39, 3.36, 3.35], updated: "2026-06-17",
    },
    {
      id: "regime", name: "Macro Regime Classifier", task: "Classification", algo: "Hidden Markov Model (4-state)", target: "Growth/Inflation regime",
      output: 2, outputUnit: "state", confidence: 64, auc: 0.78, status: "STAGING",
      features: normImportances([
        { name: "ISM Manufacturing PMI", importance: 0.15 }, { name: "Industrial production", importance: 0.13 }, { name: "Core PCE", importance: 0.12 },
        { name: "10Y-2Y spread", importance: 0.11 }, { name: "HY OAS (BofA)", importance: 0.10 }, { name: "Unemployment rate", importance: 0.09 },
        { name: "Real GDP (SAAR)", importance: 0.08 }, { name: "CBOE VIX", importance: 0.07 }, { name: "Capacity utilization", importance: 0.06 },
        { name: "Chicago Fed NFCI", importance: 0.05 }, { name: "Consumer sentiment", importance: 0.04 },
      ]),
      history: getSeriesHistory("ISM-MFG", 36).map((o) => Math.max(0, Math.min(3, Math.round((o.value - 47) / 2)))), updated: "2026-06-16",
    },
    {
      id: "fci", name: "Financial Conditions Index", task: "Regression", algo: "PCA factor model (rates · credit · vol · USD)", target: "Composite conditions (z-score)",
      output: fciHist[fciHist.length - 1], outputUnit: "σ", confidence: 76, auc: 0.0, status: "LIVE",
      features: normImportances([
        { name: "Chicago Fed NFCI", importance: 0.16 }, { name: "HY OAS (BofA)", importance: 0.14 }, { name: "IG corp OAS", importance: 0.12 },
        { name: "CBOE VIX", importance: 0.11 }, { name: "10Y-2Y spread", importance: 0.10 }, { name: "Trade-weighted USD", importance: 0.09 },
        { name: "30Y mortgage rate", importance: 0.07 }, { name: "10Y real yield (TIPS)", importance: 0.07 }, { name: "BBB corp OAS", importance: 0.06 },
        { name: "Effective fed funds", importance: 0.05 }, { name: "2-Year Treasury", importance: 0.03 },
      ]),
      history: fciHist, updated: "2026-06-17",
    },
    {
      id: "labor-mom", name: "Labor Market Momentum", task: "Nowcast", algo: "Dynamic factor model (Kalman filter)", target: "Labor momentum (z-score)",
      output: laborHist[laborHist.length - 1], outputUnit: "σ", confidence: 70, auc: 0.0, status: "STAGING",
      features: normImportances([
        { name: "Initial jobless claims", importance: 0.18 }, { name: "Nonfarm payrolls", importance: 0.17 }, { name: "Unemployment rate", importance: 0.14 },
        { name: "Job openings (JOLTS)", importance: 0.11 }, { name: "Avg hourly earnings", importance: 0.09 }, { name: "U-6 underemployment", importance: 0.08 },
        { name: "Labor force participation", importance: 0.07 }, { name: "Avg weekly hours", importance: 0.06 }, { name: "Employment-population ratio", importance: 0.05 },
        { name: "Consumer sentiment", importance: 0.03 }, { name: "ISM Services PMI", importance: 0.02 },
      ]),
      history: laborHist, updated: "2026-06-16",
    },
  ];
}

export const REGIME_STATES = ["Goldilocks", "Reflation", "Slowdown", "Stagflation"];

/* ─────────────────── Securities-Finance macro linkage ─────────────────── */

export interface RepoRow {
  rate: string;
  level: number;
  vsSofr: number; // bps
  spark: number[];
  fredId?: string; // set where a real FRED series exists (live-wireable)
}

export function getRepoRates(): RepoRow[] {
  // rate label, level, FRED id (undefined => simulation/desk construct)
  const defs: [string, number, string | undefined][] = [
    ["SOFR", 4.31, "SOFR"],
    ["EFFR", 4.08, "EFFR"],
    ["Tri-Party GC Repo", 4.33, undefined],
    ["Bilateral GC", 4.35, undefined],
    ["Specials (avg)", 3.85, undefined],
    ["IORB", 4.15, "IORB"],
    ["O/N RRP Rate", 4.0, "RRPONTSYAWARD"],
    ["Term Repo 1M", 4.38, undefined],
  ];
  return defs.map(([rate, level, fredId]) => ({
    rate, level, fredId,
    vsSofr: Number(((level - 4.31) * 100).toFixed(0)),
    spark: new Rng(`repo-${rate}`).walk(40, level, 0.004, 0).map((x) => Number(x.toFixed(3))),
  }));
}

/** Recompute a repo row from a live FRED rate series (units lin, %). */
export function liveRepoRow(base: RepoRow, obs: { date: string; value: number }[], sofr: number): RepoRow {
  if (!obs.length) return base;
  const level = Number(obs[obs.length - 1].value.toFixed(3));
  return { ...base, level, vsSofr: Number(((level - sofr) * 100).toFixed(0)), spark: obs.map((o) => o.value) };
}

export interface RateSensitivity {
  metric: string;
  unit: string;
  base: number;
  per25bpCut: number; // change per 25bp cut
  shock100: number; // change under -100bp
  direction: "up" | "down";
}

/** How a Fed easing path flows through the securities-finance book. */
export function getRateSensitivities(): RateSensitivity[] {
  return [
    { metric: "Cash collateral reinvestment yield", unit: "bps", base: 433, per25bpCut: -24, shock100: -96, direction: "down" },
    { metric: "Securities-lending net spread", unit: "bps", base: 47, per25bpCut: 3, shock100: 11, direction: "up" },
    { metric: "Prime financing NIM", unit: "bps", base: 62, per25bpCut: -2, shock100: -7, direction: "down" },
    { metric: "GC vs specials spread", unit: "bps", base: 48, per25bpCut: 5, shock100: 19, direction: "up" },
    { metric: "Funding cost of book", unit: "bps", base: 455, per25bpCut: -25, shock100: -100, direction: "down" },
    { metric: "Balance-sheet cost (HQLA)", unit: "bps", base: 18, per25bpCut: -1, shock100: -4, direction: "down" },
  ];
}

export interface ReinvestmentTier {
  instrument: string;
  yield: number;
  wam: number; // weighted avg maturity days
  allocation: number; // %
  liquidity: "T+0" | "T+1" | "T+7";
  creditTone: "up" | "amber" | "down";
}

/** Cash-collateral reinvestment ladder (the cash desk's response to rate moves). */
export function getReinvestmentLadder(): ReinvestmentTier[] {
  return [
    { instrument: "O/N Reverse Repo (UST)", yield: 4.32, wam: 1, allocation: 28, liquidity: "T+0", creditTone: "up" },
    { instrument: "Tri-Party Repo (GC)", yield: 4.34, wam: 3, allocation: 22, liquidity: "T+0", creditTone: "up" },
    { instrument: "T-Bills (1-3M)", yield: 4.22, wam: 45, allocation: 18, liquidity: "T+1", creditTone: "up" },
    { instrument: "Agency Discount Notes", yield: 4.29, wam: 30, allocation: 12, liquidity: "T+1", creditTone: "up" },
    { instrument: "Commercial Paper (A1/P1)", yield: 4.47, wam: 38, allocation: 11, liquidity: "T+7", creditTone: "amber" },
    { instrument: "Time Deposits", yield: 4.4, wam: 21, allocation: 9, liquidity: "T+7", creditTone: "amber" },
  ];
}

export interface MacroLink {
  driver: string;
  impact: string;
  effect: "up" | "down";
  magnitude: "HIGH" | "MED" | "LOW";
}

export function getMacroLinkages(): MacroLink[] {
  return [
    { driver: "Fed cuts (easing path)", impact: "Lower cash reinvestment yield; compresses cash-collateral margins", effect: "down", magnitude: "HIGH" },
    { driver: "Curve re-steepening", impact: "Improves carry on term lending vs O/N funding", effect: "up", magnitude: "MED" },
    { driver: "Rising HY credit spreads", impact: "Higher demand to borrow / short credit; specials activity up", effect: "up", magnitude: "MED" },
    { driver: "Equity-vol spike (VIX)", impact: "Short demand & borrow fees rise; HTB inventory tightens", effect: "up", magnitude: "HIGH" },
    { driver: "QT / falling reserves", impact: "Repo rates firm vs IORB; funding cost pressure", effect: "down", magnitude: "MED" },
    { driver: "Recession-prob rising", impact: "Risk-off lowers gross financing balances; balance-sheet conservatism", effect: "down", magnitude: "HIGH" },
  ];
}
