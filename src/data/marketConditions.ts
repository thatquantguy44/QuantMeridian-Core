export const DATA_SOURCE = "SIM" as const;

/**
 * Shared cross-asset market conditions snapshot.
 *
 * Deterministic engine producing equity drawdowns, credit levels, vol,
 * volume z-scores, and regime signals. Consumed by:
 *   - Prime finance (margin pressure score, financing risk overlay)
 *   - Electronic trading (execution risk, desk stance)
 *   - Funding read-throughs (liquidity stance)
 *
 * All values are pure-function derived from a seeded Rng so the module is
 * SSR-safe. When a live Yahoo/market pipeline is wired, the same types flow
 * through unchanged.
 */
import { Rng } from "@/lib/rng";

export interface SymbolCondition {
  symbol: string;
  name: string;
  assetClass: "Equity" | "Credit" | "Rates" | "Commodity" | "FX";
  price: number;
  chg1d: number;
  chg5d: number;
  drawdownPct: number;
  realizedVol20d: number;
  realizedVol60d: number;
  volumeZscore: number;
  rangePctile: number;
  gapRisk: number;
  trendScore: number;
  executionRisk: "Normal" | "Cautious" | "Wide" | "Stress";
  sparkline: number[];
}

export interface MarketConditions {
  spyDrawdown: number;
  qqqDrawdown: number;
  iwmDrawdown: number;
  vix: number;
  moveIndex: number;
  hyOas: number;
  hyOasChg1m: number;
  igOas: number;
  sofrEffrBps: number;
  fraOisBps: number;
  reservesT: number;
  fundingStress: number;
  dxy: number;
  oilChg1m: number;
  equityVolRegime: "Low" | "Normal" | "Elevated" | "High";
  creditRegime: "Tight" | "Normal" | "Wide" | "Stress";
  liquidityRegime: "Ample" | "Adequate" | "Tightening" | "Scarce";
  symbols: SymbolCondition[];
}

const SYMBOL_DEFS: { symbol: string; name: string; ac: SymbolCondition["assetClass"]; px: number; vol: number }[] = [
  { symbol: "SPY", name: "S&P 500 ETF", ac: "Equity", px: 548, vol: 0.012 },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", ac: "Equity", px: 478, vol: 0.015 },
  { symbol: "IWM", name: "Russell 2000 ETF", ac: "Equity", px: 218, vol: 0.016 },
  { symbol: "RSP", name: "Equal Wt S&P 500", ac: "Equity", px: 172, vol: 0.011 },
  { symbol: "XLF", name: "Financials ETF", ac: "Equity", px: 44.8, vol: 0.013 },
  { symbol: "KRE", name: "Regional Banks ETF", ac: "Equity", px: 56.2, vol: 0.022 },
  { symbol: "SMH", name: "Semiconductor ETF", ac: "Equity", px: 242, vol: 0.02 },
  { symbol: "XBI", name: "Biotech ETF", ac: "Equity", px: 92, vol: 0.019 },
  { symbol: "HYG", name: "HY Corporate Bond", ac: "Credit", px: 77.8, vol: 0.004 },
  { symbol: "JNK", name: "HY Bond ETF", ac: "Credit", px: 95.4, vol: 0.005 },
  { symbol: "LQD", name: "IG Corporate Bond", ac: "Credit", px: 108, vol: 0.005 },
  { symbol: "BKLN", name: "Senior Loan ETF", ac: "Credit", px: 21.4, vol: 0.002 },
  { symbol: "EMB", name: "EM Bond ETF", ac: "Credit", px: 88.2, vol: 0.006 },
  { symbol: "TLT", name: "20+ Yr Treasury", ac: "Rates", px: 92.1, vol: 0.009 },
  { symbol: "IEF", name: "7-10 Yr Treasury", ac: "Rates", px: 96.8, vol: 0.005 },
  { symbol: "SHY", name: "1-3 Yr Treasury", ac: "Rates", px: 81.6, vol: 0.001 },
  { symbol: "UUP", name: "US Dollar Index ETF", ac: "FX", px: 27.4, vol: 0.005 },
  { symbol: "GLD", name: "Gold ETF", ac: "Commodity", px: 228, vol: 0.008 },
  { symbol: "USO", name: "Crude Oil ETF", ac: "Commodity", px: 72.1, vol: 0.018 },
  { symbol: "EEM", name: "EM Equity ETF", ac: "Equity", px: 43.2, vol: 0.013 },
];

function clamp(v: number, lo = 0, hi = 100): number {
  return Math.max(lo, Math.min(hi, v));
}

function execRisk(dd: number, vol: number, volZ: number, rangeP: number): SymbolCondition["executionRisk"] {
  const score = Math.abs(dd) * 2 + vol * 200 + Math.max(0, volZ - 1) * 15 + Math.max(0, rangeP - 70) * 0.5;
  if (score >= 60) return "Stress";
  if (score >= 35) return "Wide";
  if (score >= 18) return "Cautious";
  return "Normal";
}

export function getMarketConditions(): MarketConditions {
  const rng = new Rng("mkt-cond-2026");

  const symbols: SymbolCondition[] = SYMBOL_DEFS.map((d) => {
    const r = new Rng(`mkt-${d.symbol}`);
    const chg1d = r.normal(0.001, d.vol);
    const chg5d = r.normal(0.003, d.vol * 2.2);
    const dd = -Math.abs(r.normal(0, d.vol * 5));
    const rv20 = d.vol * (1 + r.normal(0, 0.2));
    const rv60 = d.vol * (1 + r.normal(-0.05, 0.15));
    const volZ = (rv20 - rv60) / (rv60 * 0.3 || 0.001);
    const rangeP = r.float(15, 95);
    const gap = Math.abs(r.normal(0, d.vol * 1.5));
    const trend = r.normal(0, 0.4);
    const spark = new Rng(`spark-${d.symbol}`).walk(40, d.px * 0.97, d.vol * 0.6, 0.001);
    return {
      symbol: d.symbol,
      name: d.name,
      assetClass: d.ac,
      price: d.px * (1 + chg1d),
      chg1d: chg1d * 100,
      chg5d: chg5d * 100,
      drawdownPct: dd * 100,
      realizedVol20d: rv20 * Math.sqrt(252) * 100,
      realizedVol60d: rv60 * Math.sqrt(252) * 100,
      volumeZscore: r.normal(0.1, 0.8),
      rangePctile: rangeP,
      gapRisk: gap * 100,
      trendScore: trend,
      executionRisk: execRisk(dd * 100, rv20 * Math.sqrt(252), volZ, rangeP),
      sparkline: spark,
    };
  });

  const spy = symbols.find((s) => s.symbol === "SPY")!;
  const qqq = symbols.find((s) => s.symbol === "QQQ")!;
  const iwm = symbols.find((s) => s.symbol === "IWM")!;

  const vix = 16 + rng.normal(0, 4);
  const moveIdx = 95 + rng.normal(0, 12);
  const hyOas = 340 + rng.normal(0, 40);
  const igOas = 95 + rng.normal(0, 12);

  const volRegime: MarketConditions["equityVolRegime"] =
    vix >= 30 ? "High" : vix >= 22 ? "Elevated" : vix >= 16 ? "Normal" : "Low";
  const creditRegime: MarketConditions["creditRegime"] =
    hyOas >= 600 ? "Stress" : hyOas >= 450 ? "Wide" : hyOas >= 300 ? "Normal" : "Tight";
  const liqRegime: MarketConditions["liquidityRegime"] =
    vix >= 28 && hyOas >= 500 ? "Scarce" : vix >= 22 || hyOas >= 400 ? "Tightening" : vix <= 14 ? "Ample" : "Adequate";

  return {
    spyDrawdown: spy.drawdownPct,
    qqqDrawdown: qqq.drawdownPct,
    iwmDrawdown: iwm.drawdownPct,
    vix,
    moveIndex: moveIdx,
    hyOas,
    hyOasChg1m: rng.normal(0, 15),
    igOas,
    sofrEffrBps: rng.normal(-1, 3),
    fraOisBps: 17 + rng.normal(0, 5),
    reservesT: 3.25 + rng.normal(0, 0.08),
    fundingStress: clamp(rng.normal(28, 12)),
    dxy: 104.2 + rng.normal(0, 1.5),
    oilChg1m: rng.normal(0, 6),
    equityVolRegime: volRegime,
    creditRegime,
    liquidityRegime: liqRegime,
    symbols,
  };
}
