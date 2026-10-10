import { Rng } from "@/lib/rng";
import { seriesById, ECON_TODAY } from "./econSeries";

/**
 * Macro series analyzed in the Statistical Analysis module (id -> short label).
 * Curated to span every catalog category (growth, inflation, labor, rates/curve,
 * credit, housing, consumer, money, activity, FX). Every id MUST exist in
 * `econSeries.ts` FRED_CATALOG.
 */
export const STAT_SERIES: [string, string][] = [
  // Growth / activity
  ["GDPC1", "RealGDP"],
  ["INDPRO", "IndProd"],
  ["TCU", "CapUtil"],
  // Inflation
  ["CPIAUCSL", "CPI"],
  ["CPILFESL", "CoreCPI"],
  ["PCEPILFE", "CorePCE"],
  ["PCEPI", "PCE"],
  ["PPIACO", "PPI"],
  ["T5YIE", "5yB/E"],
  // Labor
  ["UNRATE", "U-3"],
  ["PAYEMS", "NFP"],
  ["ICSA", "Claims"],
  ["CES0500000003", "AHE"],
  ["JTSJOL", "JOLTS"],
  // Rates & curve
  ["DGS2", "2Y"],
  ["DGS10", "10Y"],
  ["DGS3MO", "3M"],
  ["FEDFUNDS", "EFFR"],
  ["T10Y2Y", "2s10s"],
  ["T10Y3M", "3m10y"],
  ["DFII10", "10YReal"],
  // Credit
  ["BAMLH0A0HYM2", "HY OAS"],
  ["BAMLC0A0CM", "IG OAS"],
  // Housing
  ["HOUST", "Starts"],
  ["PERMIT", "Permits"],
  ["MORTGAGE30US", "30YMtg"],
  // Consumer
  ["RSAFS", "Retail"],
  ["UMCSENT", "Sentmt"],
  // Money & conditions
  ["M2SL", "M2"],
  ["NFCI", "NFCI"],
  ["VIXCLS", "VIX"],
  // FX
  ["DTWEXBGS", "USD"],
];

export const STAT_LABELS = STAT_SERIES.map(([, l]) => l);

/**
 * Representative default selection for the correlation matrix / pairwise tools.
 * Keeps the matrix readable (~10 series) out of the full STAT_SERIES list; the UI
 * lets the user toggle any of the remaining series back on.
 */
export const STAT_DEFAULT_LABELS: string[] = [
  "10Y", "2Y", "2s10s", "EFFR", "CPI", "CorePCE", "U-3", "HY OAS", "VIX", "USD",
];

export function monthlyDate(monthsAgo: number): string {
  const d = new Date(Date.UTC(ECON_TODAY.getUTCFullYear(), ECON_TODAY.getUTCMonth() - monthsAgo, 1));
  return d.toISOString().slice(0, 10);
}

export interface StatPoint {
  date: string;
  value: number;
}
export interface StatSeries {
  id: string;
  label: string;
  points: StatPoint[];
}

/**
 * Deterministic long monthly history (default ~25y) for every stat series, used
 * as the simulation source. A mean-reverting walk anchored to each series' level
 * keeps server and client output identical.
 */
export function simStatFull(months = 300): StatSeries[] {
  return STAT_SERIES.map(([id, label]) => {
    const s = seriesById(id);
    const level = s?.level ?? 1;
    const vol = (s?.vol ?? 0.05) * 1.4;
    const rng = new Rng(`statfull-${id}`);
    // build backwards from level so the latest point matches level
    const raw: number[] = [];
    let x = level;
    for (let i = 0; i < months; i++) {
      x = x - rng.normal(0, vol);
      raw.push(x);
    }
    raw.reverse();
    const shift = level - raw[raw.length - 1];
    const dp = s?.decimals ?? 2;
    const points = raw.map((v, i) => ({ date: monthlyDate(months - 1 - i), value: Number((v + shift).toFixed(dp)) }));
    return { id, label, points };
  });
}
