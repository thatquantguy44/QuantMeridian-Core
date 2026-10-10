import { Rng } from "@/lib/rng";

export const DATA_SOURCE = "SIM" as const;

/**
 * Credit spreads deep-dive — ICE BofA OAS by rating bucket, IG/HY aggregates,
 * quality & compression spreads, historical percentiles and stress episodes.
 * Each rating maps to its FRED OAS series id so it is drillable to 24m live data.
 */

export interface CreditRung {
  rating: string;
  fredId: string;
  grade: "IG" | "HY";
  oas: number; // bps
  prior: number;
  chg1d: number; // bps
  chg1m: number;
  yield: number; // %
  pctile: number; // 0-100 percentile vs 10y history (lower = tight)
  z: number; // z-score vs 1y
  dur: number; // spread duration (yrs)
}

// rating, fredId, grade, oas, yield, spreadDuration, 10y-percentile
const RUNGS: [string, string, "IG" | "HY", number, number, number, number][] = [
  ["AAA", "BAMLC0A1CAAA", "IG", 48, 4.78, 7.1, 22],
  ["AA", "BAMLC0A2CAA", "IG", 62, 4.92, 6.6, 26],
  ["A", "BAMLC0A3CA", "IG", 84, 5.1, 6.9, 31],
  ["BBB", "BAMLC0A4CBBB", "IG", 124, 5.46, 6.4, 34],
  ["BB", "BAMLH0A1HYBB", "HY", 215, 6.62, 4.2, 28],
  ["B", "BAMLH0A2HYB", "HY", 348, 7.84, 3.6, 33],
  ["CCC", "BAMLH0A3HYC", "HY", 742, 11.9, 2.8, 41],
];

export function getCreditCurve(): CreditRung[] {
  return RUNGS.map(([rating, fredId, grade, oas, yld, dur, pctile]) => {
    const rng = new Rng(`credit-${rating}`);
    const prior = oas - Math.round(rng.normal(0, oas * 0.02));
    return {
      rating, fredId, grade, oas, prior,
      chg1d: oas - prior,
      chg1m: Math.round(rng.normal(-2, oas * 0.05)),
      yield: yld,
      pctile,
      z: Number(rng.normal(-0.4, 0.7).toFixed(2)),
      dur,
    };
  });
}

/**
 * Recompute a rating rung from a live FRED OAS series (units=lin, already scaled
 * to bps). Derives current OAS, 1d and ~1m changes. Falls back to the simulation
 * `base` when the history is too short.
 */
export function liveRung(base: CreditRung, obs: { date: string; value: number }[]): CreditRung {
  const v = obs.map((o) => o.value);
  if (v.length < 2) return base;
  const oas = Math.round(v[v.length - 1]);
  const prior = Math.round(v[v.length - 2]);
  const monthAgo = v.length >= 22 ? v[v.length - 22] : v[0];
  return { ...base, oas, prior, chg1d: oas - prior, chg1m: Math.round(oas - monthAgo) };
}

export interface CreditSummary {
  igOas: number;
  hyOas: number;
  igHySpread: number; // HY - IG
  qualitySpread: number; // CCC - BB
  bbbAaa: number; // BBB - AAA (IG compression)
  igYield: number;
  hyYield: number;
  igChg1d: number;
  hyChg1d: number;
  igPctile: number;
  hyPctile: number;
  distressRatio: number; // % of HY trading >1000bps
  defaultRate: number; // trailing 12m HY default %
  regime: "TIGHT" | "NEUTRAL" | "WIDE" | "STRESS";
}

export function getCreditSummary(): CreditSummary {
  const c = getCreditCurve();
  const ig = 92, hy = 388; // master aggregates (bps)
  const get = (r: string) => c.find((x) => x.rating === r)!;
  const igChg = get("BBB").chg1d - 2;
  const hyChg = get("B").chg1d;
  const regime: CreditSummary["regime"] = hy > 800 ? "STRESS" : hy > 500 ? "WIDE" : hy < 350 ? "TIGHT" : "NEUTRAL";
  return {
    igOas: ig, hyOas: hy,
    igHySpread: hy - ig,
    qualitySpread: get("CCC").oas - get("BB").oas,
    bbbAaa: get("BBB").oas - get("AAA").oas,
    igYield: 5.18, hyYield: 7.62,
    igChg1d: igChg, hyChg1d: hyChg,
    igPctile: 18, hyPctile: 24,
    distressRatio: 5.4,
    defaultRate: 2.8,
    regime,
  };
}

/** Long history of IG & HY OAS (bps) with stress episodes shaded by name. */
export function getSpreadHistory(years = 18): { date: string; ig: number; hy: number; episode: string | null }[] {
  const knots: [number, number, number, string | null][] = [
    // year, ig, hy, episode
    [2008, 555, 1650, "GFC"],
    [2009, 480, 1400, "GFC"],
    [2010, 170, 600, null],
    [2011, 240, 720, "EU Debt"],
    [2012, 160, 580, null],
    [2014, 130, 480, null],
    [2016, 215, 840, "Oil/EM"],
    [2018, 160, 540, null],
    [2020, 270, 1100, "COVID"],
    [2021, 95, 320, null],
    [2022, 165, 520, "Hiking"],
    [2023, 130, 460, "SVB"],
    [2024, 100, 340, null],
    [2025, 95, 360, null],
    [2026.45, 92, 388, null],
  ];
  const rng = new Rng("credit-hist");
  const out: { date: string; ig: number; hy: number; episode: string | null }[] = [];
  const start = 2026.45 - years;
  for (let t = start; t <= 2026.45; t += 0.25) {
    let ig = knots[knots.length - 1][1], hy = knots[knots.length - 1][2], ep: string | null = null;
    for (let k = 0; k < knots.length - 1; k++) {
      if (t >= knots[k][0] && t <= knots[k + 1][0]) {
        const f = (t - knots[k][0]) / (knots[k + 1][0] - knots[k][0]);
        ig = knots[k][1] + f * (knots[k + 1][1] - knots[k][1]);
        hy = knots[k][2] + f * (knots[k + 1][2] - knots[k][2]);
        ep = f < 0.5 ? knots[k][3] : knots[k + 1][3];
        break;
      }
    }
    const year = Math.floor(t);
    const q = Math.floor((t - year) * 4) + 1;
    out.push({ date: `${year}Q${q}`, ig: Math.round(ig + rng.normal(0, 8)), hy: Math.round(hy + rng.normal(0, 25)), episode: ep });
  }
  return out;
}

export interface SectorSpread {
  sector: string;
  oas: number;
  chg1m: number;
  grade: "IG" | "HY";
}

export function getSectorSpreads(): SectorSpread[] {
  const rng = new Rng("credit-sector");
  const defs: [string, number, "IG" | "HY"][] = [
    ["Financials", 96, "IG"], ["Energy", 138, "IG"], ["Technology", 78, "IG"], ["Healthcare", 88, "IG"],
    ["Utilities", 92, "IG"], ["Industrials", 102, "IG"], ["Consumer", 110, "IG"], ["Real Estate", 152, "IG"],
    ["Telecom", 124, "IG"], ["HY Energy", 420, "HY"], ["HY Retail", 510, "HY"], ["HY Media", 385, "HY"],
  ];
  return defs.map(([sector, oas, grade]) => ({ sector, oas, chg1m: Math.round(rng.normal(-3, 14)), grade })).sort((a, b) => b.oas - a.oas);
}

export interface CreditStress {
  name: string;
  peakIg: number;
  peakHy: number;
  drawdownPct: number; // HY total return drawdown
  defaultPeak: number;
}

export function getStressEpisodes(): CreditStress[] {
  return [
    { name: "GFC (2008-09)", peakIg: 618, peakHy: 1971, drawdownPct: -33.2, defaultPeak: 14.7 },
    { name: "EU Sovereign (2011)", peakIg: 264, peakHy: 902, drawdownPct: -7.1, defaultPeak: 2.1 },
    { name: "Oil/EM (2015-16)", peakIg: 221, peakHy: 887, drawdownPct: -5.4, defaultPeak: 5.1 },
    { name: "COVID (2020)", peakIg: 401, peakHy: 1100, drawdownPct: -21.0, defaultPeak: 8.4 },
    { name: "Hiking/SVB (2022-23)", peakIg: 168, peakHy: 599, drawdownPct: -11.2, defaultPeak: 3.0 },
  ];
}

/** Securities-finance linkage of credit conditions. */
export function getCreditLinkages(): { driver: string; impact: string; effect: "up" | "down" }[] {
  return [
    { driver: "HY spreads widening", impact: "Short demand for HY ETFs/credit rises; borrow fees firm", effect: "up" },
    { driver: "CCC distress ratio up", impact: "Specials in stressed issuers; recall risk on lent names", effect: "up" },
    { driver: "IG compression (BBB-AAA tight)", impact: "Low dispersion → less relative-value short demand", effect: "down" },
    { driver: "Primary issuance surge", impact: "More lendable supply; settlement/financing demand rises", effect: "up" },
    { driver: "Credit ETF creation/redemption", impact: "Drives borrow on HYG/JNK; arb financing flows", effect: "up" },
  ];
}

// ── Spread Decomposition ────────────────────────────────────────────────────

export interface SpreadDecomp {
  pair: string;
  valueBps: number;
  pctile: number;
  zScore: number;
  hist20d: number[];
  signal: "Tight" | "Normal" | "Wide" | "Stress";
}

export function getSpreadDecomposition(): SpreadDecomp[] {
  const rng = new Rng("credit-decomp");
  const c = getCreditCurve();
  const get = (r: string) => c.find((x) => x.rating === r)?.oas ?? 0;

  const defs: { pair: string; val: number; stressLevel: number }[] = [
    { pair: "HY − IG", val: get("B") - get("A"), stressLevel: 350 },
    { pair: "CCC − BB", val: get("CCC") - get("BB"), stressLevel: 600 },
    { pair: "BBB − IG", val: get("BBB") - get("AAA"), stressLevel: 120 },
    { pair: "BB − BBB", val: get("BB") - get("BBB"), stressLevel: 150 },
    { pair: "B − BB", val: get("B") - get("BB"), stressLevel: 200 },
  ];

  return defs.map((d) => {
    const z = rng.normal(0, 0.7);
    const pctile = Math.max(1, Math.min(99, Math.round(50 + z * 20)));
    const hist = Array.from({ length: 20 }, () => d.val + rng.normal(0, d.val * 0.04));
    return {
      pair: d.pair,
      valueBps: Math.round(d.val),
      pctile,
      zScore: Math.round(z * 100) / 100,
      hist20d: hist,
      signal: d.val >= d.stressLevel ? "Stress" : pctile >= 70 ? "Wide" : pctile <= 30 ? "Tight" : "Normal",
    };
  });
}

// ── ETF Price vs OAS Divergence ─────────────────────────────────────────────

export interface EtfDivergence {
  etf: string;
  etfPrice: number;
  etfChg1d: number;
  oasBps: number;
  oasChg1d: number;
  divergenceScore: number;
  signal: "Converging" | "Neutral" | "Diverging" | "Extreme";
  detail: string;
}

export function getEtfDivergences(): EtfDivergence[] {
  const rng = new Rng("credit-etf-div");

  const defs: { etf: string; px: number; oas: number; type: string }[] = [
    { etf: "HYG", px: 77.8, oas: 388, type: "HY" },
    { etf: "JNK", px: 95.4, oas: 395, type: "HY" },
    { etf: "LQD", px: 108, oas: 92, type: "IG" },
    { etf: "BKLN", px: 21.4, oas: 310, type: "Loans" },
    { etf: "EMB", px: 88.2, oas: 340, type: "EM" },
  ];

  return defs.map((d) => {
    const etfChg = rng.normal(0, 0.3);
    const oasChg = rng.normal(0, 5);
    const pxImpliedOasChg = -etfChg * 15;
    const divergence = Math.abs(oasChg - pxImpliedOasChg);
    const divScore = Math.round(divergence * 10) / 10;

    return {
      etf: d.etf,
      etfPrice: d.px + etfChg,
      etfChg1d: Math.round(etfChg * 100) / 100,
      oasBps: Math.round(d.oas + oasChg),
      oasChg1d: Math.round(oasChg),
      divergenceScore: divScore,
      signal: divScore >= 8 ? "Extreme" : divScore >= 5 ? "Diverging" : divScore >= 2 ? "Neutral" : "Converging",
      detail:
        etfChg > 0 && oasChg > 0
          ? "ETF price rising but OAS widening — possible technical bid, not fundamental."
          : etfChg < 0 && oasChg < 0
          ? "Both tightening — fundamental improvement confirmed by price."
          : etfChg > 0 && oasChg < 0
          ? "Aligned — ETF rally + OAS tightening."
          : "ETF weak but OAS stable — check liquidity and redemption flows.",
    };
  });
}

// ── Credit Beta to Equity ───────────────────────────────────────────────────

export interface CreditBeta {
  pair: string;
  beta: number;
  r2: number;
  regime: "High" | "Normal" | "Low";
  detail: string;
}

export function getCreditBetas(): CreditBeta[] {
  const rng = new Rng("credit-beta");
  const rows: CreditBeta[] = [
    { pair: "HY OAS vs SPY", beta: -(rng.float(0.6, 1.1)), r2: rng.float(0.45, 0.72), regime: "Normal", detail: "HY behaves equity-like; drawdowns widen HY proportionally." },
    { pair: "HY OAS vs IWM", beta: -(rng.float(0.8, 1.4)), r2: rng.float(0.38, 0.62), regime: "Normal", detail: "Small-cap beta to credit higher — more cyclical exposure." },
    { pair: "IG OAS vs SPY", beta: -(rng.float(0.15, 0.35)), r2: rng.float(0.20, 0.45), regime: "Low", detail: "IG is rates-dominated; equity beta low outside stress." },
    { pair: "HYG px vs HY OAS", beta: -(rng.float(0.85, 1.15)), r2: rng.float(0.82, 0.95), regime: "High", detail: "NAV-linked — ETF tracks OAS tightly when liquid." },
    { pair: "CCC-BB vs VIX", beta: rng.float(8, 16), r2: rng.float(0.35, 0.55), regime: "Normal", detail: "Quality spread widens with vol; the pure distress signal." },
  ];
  return rows.map((r) => ({
    ...r,
    beta: Math.round(r.beta * 100) / 100,
    r2: Math.round(r.r2 * 100) / 100,
  }));
}

// ── Financing Haircut Pressure Proxy ────────────────────────────────────────

export interface HaircutPressure {
  assetClass: string;
  currentHaircut: number;
  stressHaircut: number;
  haircutDelta: number;
  marginImpact: number;
  signal: "Stable" | "Widening" | "Stress";
}

export function getHaircutPressure(): HaircutPressure[] {
  const sum = getCreditSummary();
  const stressMult = sum.regime === "STRESS" ? 1.5 : sum.regime === "WIDE" ? 1.2 : 1.0;

  return [
    { assetClass: "UST (on-the-run)", currentHaircut: 2, stressHaircut: 2, haircutDelta: 0, marginImpact: 0, signal: "Stable" },
    { assetClass: "Agency MBS", currentHaircut: 4, stressHaircut: Math.round(4 * stressMult), haircutDelta: Math.round(4 * (stressMult - 1)), marginImpact: -0.5, signal: stressMult > 1.1 ? "Widening" : "Stable" },
    { assetClass: "IG Corporate", currentHaircut: 6, stressHaircut: Math.round(6 * stressMult * 1.1), haircutDelta: Math.round(6 * (stressMult * 1.1 - 1)), marginImpact: -1.2, signal: stressMult > 1.1 ? "Widening" : "Stable" },
    { assetClass: "HY Corporate", currentHaircut: 12, stressHaircut: Math.round(12 * stressMult * 1.3), haircutDelta: Math.round(12 * (stressMult * 1.3 - 1)), marginImpact: -3.8, signal: stressMult > 1 ? "Widening" : "Stable" },
    { assetClass: "Leveraged Loans", currentHaircut: 15, stressHaircut: Math.round(15 * stressMult * 1.4), haircutDelta: Math.round(15 * (stressMult * 1.4 - 1)), marginImpact: -5.2, signal: stressMult > 1 ? "Widening" : "Stable" },
    { assetClass: "EM Sovereign", currentHaircut: 10, stressHaircut: Math.round(10 * stressMult * 1.2), haircutDelta: Math.round(10 * (stressMult * 1.2 - 1)), marginImpact: -2.8, signal: stressMult > 1 ? "Widening" : "Stable" },
  ] as HaircutPressure[];
}
