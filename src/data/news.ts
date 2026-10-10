/**
 * NEWS — Market News & Signal Intelligence (deterministic engine).
 *
 * The terminal ships with no live news feed, so this module synthesizes a
 * realistic, *stable* intelligence layer from a fixed seed (SSR/hydration-safe),
 * mirroring the medallion/gold tables the plan describes
 * (docs/features/completed/Feature Addition - NEWS Terminal Module …). When live keys are
 * configured (Alpha Vantage / Marketaux / Reddit) the same shapes can be served
 * from the pipeline; until then everything is clearly badged SIM.
 *
 * Covers the seven core views: Headline Tape, Narrative Monitor, Social
 * Intelligence, Market Impact, Attention Heatmap, Event Intelligence, Signal Engine.
 */
import { Rng } from "@/lib/rng";

export type AssetClass = "EQUITY" | "RATES" | "CREDIT" | "COMMODITY" | "FX" | "CRYPTO" | "MACRO" | "SEC-FIN";
export type Region = "US" | "EU" | "UK" | "JP" | "CN" | "EM" | "GLOBAL";
export type Sentiment = "BULLISH" | "BEARISH" | "NEUTRAL";
export type Direction = "RISK-ON" | "RISK-OFF" | "NEUTRAL";

export const ASSET_CLASSES: AssetClass[] = ["EQUITY", "RATES", "CREDIT", "COMMODITY", "FX", "CRYPTO", "MACRO", "SEC-FIN"];

const SOURCES = ["Bloomberg", "Reuters", "WSJ", "FT", "Alpha Vantage", "Marketaux", "SEC EDGAR", "Fed Wire", "CNBC", "MarketWatch"] as const;
const TICKERS = ["NVDA", "AAPL", "MSFT", "TSLA", "JPM", "BAC", "XLF", "SPY", "QQQ", "TLT", "HYG", "LQD", "GLD", "USO", "BTC", "DXY", "GME", "AMC", "SMCI", "META"] as const;
const SECTORS = ["Technology", "Financials", "Energy", "Health Care", "Industrials", "Consumer Disc.", "Utilities", "Materials", "Communications", "Real Estate"] as const;
const COUNTRIES = ["United States", "China", "Eurozone", "Japan", "United Kingdom", "Germany", "India", "Brazil"] as const;
const COMMODITIES = ["Crude Oil", "Gold", "Nat Gas", "Copper", "Silver", "Wheat", "Corn", "Uranium"] as const;

/** Headline templates keyed loosely by asset class, with {T} ticker / {N} number slots. */
const HEADLINES: Record<AssetClass, string[]> = {
  EQUITY: [
    "{T} surges as AI demand guidance tops estimates",
    "{T} slides {N}% after cutting full-year outlook",
    "Megacap tech leads rebound; {T} hits record high",
    "{T} options volume spikes ahead of earnings",
    "Analysts lift {T} target on margin expansion",
  ],
  RATES: [
    "Treasury yields jump as {N}-year auction tails sharply",
    "Fed officials signal patience on rate cuts",
    "2s10s steepens to widest since regime shift",
    "Money markets price {N}bps of cuts by year-end",
    "Term premium rebuilds as supply concerns mount",
  ],
  CREDIT: [
    "IG spreads widen {N}bps on regional-bank jitters",
    "High-yield issuance reopens after volatility lull",
    "Credit stress indicators tick higher into quarter-end",
    "CLO demand firms as spreads grind tighter",
    "Default-rate forecasts trimmed by ratings agency",
  ],
  COMMODITY: [
    "Crude jumps {N}% on supply-disruption headlines",
    "Gold extends record run as real yields ease",
    "Copper rallies on China stimulus optimism",
    "Nat gas tumbles {N}% on mild-weather forecasts",
    "OPEC+ signals extension of voluntary cuts",
  ],
  FX: [
    "Dollar firms as data dampens cut expectations",
    "Yen slides past intervention watch level",
    "Euro climbs on hawkish ECB commentary",
    "EM currencies steady as risk appetite returns",
    "Sterling gains after upside inflation surprise",
  ],
  CRYPTO: [
    "Bitcoin reclaims key level on ETF inflows",
    "Crypto majors rally {N}% as risk sentiment improves",
    "Stablecoin supply hits fresh cycle high",
    "Regulatory clarity boosts digital-asset sentiment",
    "On-chain activity accelerates into month-end",
  ],
  MACRO: [
    "US inflation surprises to the {SIDE}; markets reprice",
    "Payrolls beat lifts soft-landing narrative",
    "ISM services unexpectedly contracts",
    "Retail sales cool, easing overheating fears",
    "Jobless claims tick higher for a third week",
  ],
  "SEC-FIN": [
    "Securities-lending revenue rises on specials demand",
    "Repo rates firm into quarter-end funding squeeze",
    "Prime brokerage balances climb as leverage builds",
    "Collateral scarcity pushes GC rates lower",
    "Short interest in {T} jumps to multi-month high",
  ],
};

/** The recurring market narratives the monitor tracks. */
const NARRATIVES = [
  "AI Capex Boom", "Soft Landing", "Inflation Reacceleration", "Fed Cuts", "Regional Bank Stress",
  "Treasury Supply Glut", "Energy Shock", "China Stimulus", "Recession Risk", "Credit Stress",
  "Dollar Strength", "Earnings Resilience",
] as const;

/** Event types for the impact dashboard + event clusters. */
const EVENT_TYPES = [
  "US Inflation Surprise", "Fed Surprise Cut", "Regional Bank Stress", "Oil Supply Shock",
  "Megacap Earnings Beat", "Treasury Auction Tail", "China Stimulus Package", "Jobs Report Beat",
] as const;

const IMPACT_ASSETS = ["SPY", "QQQ", "TLT", "HYG", "LQD", "GLD", "DXY", "VIX"] as const;

function sentimentFrom(score: number): Sentiment {
  return score > 0.15 ? "BULLISH" : score < -0.15 ? "BEARISH" : "NEUTRAL";
}

function fill(rng: Rng, tpl: string): string {
  return tpl
    .replace("{T}", rng.pick(TICKERS))
    .replace("{N}", String(rng.int(2, 9)))
    .replace("{SIDE}", rng.pick(["upside", "downside"] as const));
}

// ── NEWS-1 · Headline Tape ────────────────────────────────────────────────────

export interface Headline {
  id: string;
  minutesAgo: number;
  time: string; // HH:MM
  importance: number; // 0-100
  impact: number; // 0-100 expected market impact
  assetClass: AssetClass;
  region: Region;
  source: string;
  headline: string;
  sentiment: Sentiment;
  sentimentScore: number; // -1..1
  tickers: string[];
}

const REGIONS: Region[] = ["US", "EU", "UK", "JP", "CN", "EM", "GLOBAL"];

export function getHeadlines(n = 60): Headline[] {
  const rng = new Rng("news-tape-v1");
  const out: Headline[] = [];
  let minutes = 0;
  for (let i = 0; i < n; i++) {
    minutes += rng.int(1, 14);
    const assetClass = rng.pick(ASSET_CLASSES);
    const score = Number(rng.normal(0.05, 0.45).toFixed(2));
    const clamped = Math.max(-1, Math.min(1, score));
    const importance = Math.round(Math.max(8, Math.min(99, rng.normal(55, 22))));
    const h = i % 7 === 0 ? minutes : minutes; // keep monotonic ordering
    const hh = 16 - Math.floor(h / 60);
    const mm = 59 - (h % 60);
    out.push({
      id: `hl-${i}`,
      minutesAgo: minutes,
      time: `${String(Math.max(0, hh)).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      importance,
      impact: Math.round(Math.max(5, Math.min(99, importance * 0.6 + Math.abs(clamped) * 40 + rng.float(-8, 8)))),
      assetClass,
      region: rng.pick(REGIONS),
      source: rng.pick(SOURCES),
      headline: fill(rng, rng.pick(HEADLINES[assetClass])),
      sentiment: sentimentFrom(clamped),
      sentimentScore: clamped,
      tickers: Array.from({ length: rng.int(0, 3) }, () => rng.pick(TICKERS)),
    });
  }
  return out;
}

// ── NEWS-2 · Narrative Monitor ──────────────────────────────────────────────

export interface NarrativeRow {
  name: string;
  mentions: number;
  chg7d: number; // %
  chg30d: number; // %
  sentiment: number; // -1..1
  velocity: number; // 0-100 (rate of acceleration)
  breadth: number; // # asset classes touched
}

export function getNarratives(): NarrativeRow[] {
  const rng = new Rng("news-narratives-v1");
  return NARRATIVES.map((name) => {
    const mentions = rng.int(120, 4200);
    return {
      name,
      mentions,
      chg7d: Number(rng.normal(8, 35).toFixed(1)),
      chg30d: Number(rng.normal(15, 60).toFixed(1)),
      sentiment: Number(rng.normal(0, 0.5).toFixed(2)),
      velocity: Math.round(Math.max(2, Math.min(99, rng.normal(50, 25)))),
      breadth: rng.int(1, ASSET_CLASSES.length),
    };
  }).sort((a, b) => b.velocity - a.velocity);
}

// Keyword matchers so narratives can be tallied from real headline text.
const NARRATIVE_KW: Record<string, RegExp> = {
  "AI Capex Boom": /\bAI\b|capex|megacap|chip|semi|data ?cent/i,
  "Soft Landing": /soft.?landing|payrolls beat|retail sales cool|easing|resilien/i,
  "Inflation Reacceleration": /inflation|reaccelerat|overheat|\bCPI\b|prices?/i,
  "Fed Cuts": /\bfed\b|rate cut|cuts|dovish|patience|fomc/i,
  "Regional Bank Stress": /regional.?bank|bank jitters|deposit|\bbank\b/i,
  "Treasury Supply Glut": /auction tail|term premium|supply concern|treasury yields|issuance/i,
  "Energy Shock": /crude|\boil\b|opec|nat gas|energy|supply.?disruption/i,
  "China Stimulus": /china|stimulus|copper/i,
  "Recession Risk": /recession|contracts?|jobless claims|slowdown|cooling/i,
  "Credit Stress": /credit|spreads? widen|default|high.?yield|stress|jitters/i,
  "Dollar Strength": /dollar|\bdxy\b|\byen\b|euro|sterling|currenc/i,
  "Earnings Resilience": /earnings|guidance|margin|record high|target|beat/i,
};

/** Recompute the narrative monitor from a (possibly live) headline set. */
export function narrativesFromHeadlines(heads: Headline[]): NarrativeRow[] {
  const base = new Map(getNarratives().map((r) => [r.name, r]));
  const total = Math.max(1, heads.length);
  return NARRATIVES.map((name) => {
    const kw = NARRATIVE_KW[name];
    const matched = kw ? heads.filter((h) => kw.test(h.headline)) : [];
    const b = base.get(name)!;
    if (!matched.length) return b;
    const sent = matched.reduce((a, h) => a + h.sentimentScore, 0) / matched.length;
    return {
      name,
      mentions: matched.length,
      chg7d: b.chg7d, // momentum needs history → engine estimate
      chg30d: b.chg30d,
      sentiment: Number(sent.toFixed(2)),
      velocity: Math.round(Math.min(99, (matched.length / total) * 300)),
      breadth: new Set(matched.map((h) => h.assetClass)).size,
    };
  }).sort((a, b) => b.mentions - a.mentions || b.velocity - a.velocity);
}

// ── NEWS-3 · Social Intelligence ────────────────────────────────────────────

export interface SocialRow {
  label: string;
  mentions: number;
  velocity: number; // %, change in mention rate
  sentiment: number; // -1..1
}
export interface SocialIntel {
  tickers: SocialRow[];
  sectors: SocialRow[];
  themes: SocialRow[];
  totalPosts: number;
  platforms: { name: string; posts: number; sentiment: number }[];
}

function socialRows(seed: string, labels: readonly string[]): SocialRow[] {
  const rng = new Rng(seed);
  return labels
    .map((label) => ({
      label,
      mentions: rng.int(80, 9800),
      velocity: Number(rng.normal(20, 70).toFixed(0)),
      sentiment: Number(rng.normal(0.05, 0.5).toFixed(2)),
    }))
    .sort((a, b) => b.mentions - a.mentions);
}

export function getSocialIntel(): SocialIntel {
  const rng = new Rng("news-social-v1");
  return {
    tickers: socialRows("social-tickers", TICKERS).slice(0, 12),
    sectors: socialRows("social-sectors", SECTORS).slice(0, 8),
    themes: socialRows("social-themes", NARRATIVES).slice(0, 8),
    totalPosts: rng.int(180_000, 420_000),
    platforms: [
      { name: "X (Twitter)", posts: rng.int(90_000, 220_000), sentiment: Number(rng.normal(0.05, 0.3).toFixed(2)) },
      { name: "Reddit", posts: rng.int(40_000, 120_000), sentiment: Number(rng.normal(-0.02, 0.35).toFixed(2)) },
      { name: "StockTwits", posts: rng.int(20_000, 80_000), sentiment: Number(rng.normal(0.1, 0.3).toFixed(2)) },
    ],
  };
}

// ── NEWS-4 · Market Impact Dashboard ────────────────────────────────────────

export interface ImpactRow {
  asset: string;
  d1: number;
  w1: number;
  m1: number;
  hitRate: number;
  observations: number;
}
export interface EventImpact {
  event: string;
  occurrences: number;
  rows: ImpactRow[];
  datasets: string[];
  access: string;
  magnitude: string;
  model: "HISTORICAL_EVENT_STUDY";
  status: "STARTER_STACK" | "NEEDS_CONSENSUS" | "CURATED";
}

const EVENT_STUDY_SOURCES: Record<(typeof EVENT_TYPES)[number], Omit<EventImpact, "event" | "rows" | "model">> = {
  "Treasury Auction Tail": {
    occurrences: 28,
    magnitude: "Auction tail = high yield − when-issued yield; high-yield, WI, bid-to-cover",
    datasets: ["TreasuryDirect auction results", "market warehouse forward returns"],
    access: "Free official starter stack",
    status: "STARTER_STACK",
  },
  "US Inflation Surprise": {
    occurrences: 42,
    magnitude: "CPI actual − consensus estimate, joined on release date",
    datasets: ["FRED CPIAUCSL / release calendar", "Trading Economics, FMP, or Econoday consensus"],
    access: "FRED free; consensus paid/cheap",
    status: "NEEDS_CONSENSUS",
  },
  "Jobs Report Beat": {
    occurrences: 39,
    magnitude: "PAYEMS actual − consensus estimate, joined on release date",
    datasets: ["FRED PAYEMS / release calendar", "Trading Economics, FMP, or Econoday consensus"],
    access: "FRED free; consensus paid/cheap",
    status: "NEEDS_CONSENSUS",
  },
  "Fed Surprise Cut": {
    occurrences: 17,
    magnitude: "Policy surprise from CME Fed Funds futures or academic high-frequency shocks",
    datasets: ["FOMC dates", "CME Fed Funds futures from macro_data_etl", "Nakamura-Steinsson / Jarociński-Karadi / Bu-Rogers-Wu shocks"],
    access: "Free",
    status: "STARTER_STACK",
  },
  "Megacap Earnings Beat": {
    occurrences: 31,
    magnitude: "EPS actual − estimate for megacap reporters",
    datasets: ["Financial Modeling Prep, Finnhub, or Alpha Vantage EARNINGS", "market warehouse forward returns"],
    access: "Free/cheap tiers",
    status: "STARTER_STACK",
  },
  "Oil Supply Shock": {
    occurrences: 24,
    magnitude: "EIA supply/inventory surprise plus WTI move",
    datasets: ["EIA API", "FRED DCOILWTICO", "Kilian / Baumeister-Hamilton oil shocks", "OPEC dates"],
    access: "Free",
    status: "STARTER_STACK",
  },
  "Regional Bank Stress": {
    occurrences: 22,
    magnitude: "Stress-index jump and KRE drawdown around bank-stress windows",
    datasets: ["FRED STLFSI4 / NFCI / ANFCI", "KRE ETF drawdowns", "FDIC failed-bank list"],
    access: "Free",
    status: "STARTER_STACK",
  },
  "China Stimulus Package": {
    occurrences: 14,
    magnitude: "PBOC RRR/rate-cut dates and FXI/MCHI event-window move",
    datasets: ["PBOC RRR/rate cut dates", "FXI/MCHI market warehouse returns"],
    access: "Free/curated",
    status: "CURATED",
  },
};

export function getMarketImpact(): EventImpact[] {
  return EVENT_TYPES.map((event) => {
    const rng = new Rng(`news-impact-${event}`);
    // Direction bias per event type so the historical pattern reads coherently while
    // the actual event dates/magnitudes are still sourced by the external gold table.
    const riskOff = /Stress|Shock|Tail|Inflation Surprise/.test(event);
    const bias = riskOff ? -1 : 1;
    const rows: ImpactRow[] = IMPACT_ASSETS.map((asset) => {
      const defensive = asset === "TLT" || asset === "GLD" || asset === "VIX" || asset === "DXY";
      const dir = defensive ? -bias : bias;
      const scale = asset === "VIX" ? 9 : asset === "TLT" || asset === "GLD" ? 2.2 : asset === "DXY" ? 1.1 : 2.6;
      const base = dir * scale;
      const d1 = Number((rng.normal(base * 0.4, scale * 0.5)).toFixed(1));
      const w1 = Number((rng.normal(base * 0.8, scale * 0.8)).toFixed(1));
      const m1 = Number((rng.normal(base * 1.4, scale * 1.3)).toFixed(1));
      const directionalStrength = Math.min(0.22, Math.abs((d1 + w1 + m1) / Math.max(1, scale * 18)));
      return {
        asset,
        d1,
        w1,
        m1,
        hitRate: Math.round(Math.max(38, Math.min(82, 52 + directionalStrength * 100 + rng.float(-9, 9)))),
        observations: Math.max(8, EVENT_STUDY_SOURCES[event].occurrences - rng.int(0, 5)),
      };
    });
    return { ...EVENT_STUDY_SOURCES[event], event, rows, model: "HISTORICAL_EVENT_STUDY" };
  });
}

// ── NEWS-5 · Market Attention Heatmap ───────────────────────────────────────

export interface AttentionRow {
  label: string;
  score: number; // 0-100
  chg: number; // pt change vs prior day
  sentiment: number; // -1..1
}
export interface AttentionHeatmap {
  tickers: AttentionRow[];
  sectors: AttentionRow[];
  countries: AttentionRow[];
  commodities: AttentionRow[];
}

function attentionRows(seed: string, labels: readonly string[]): AttentionRow[] {
  const rng = new Rng(seed);
  return labels
    .map((label) => ({
      label,
      score: Math.round(Math.max(3, Math.min(100, rng.normal(55, 26)))),
      chg: Number(rng.normal(0, 14).toFixed(0)),
      sentiment: Number(rng.normal(0.03, 0.45).toFixed(2)),
    }))
    .sort((a, b) => b.score - a.score);
}

export function getAttentionHeatmap(): AttentionHeatmap {
  return {
    tickers: attentionRows("attn-tickers", TICKERS),
    sectors: attentionRows("attn-sectors", SECTORS),
    countries: attentionRows("attn-countries", COUNTRIES),
    commodities: attentionRows("attn-commodities", COMMODITIES),
  };
}

// Ticker → equity sector for the tracked universe (index/rates/credit/fx/crypto omitted).
const SECTOR_BY_TICKER: Record<string, string> = {
  NVDA: "Technology", AAPL: "Technology", MSFT: "Technology", SMCI: "Technology",
  META: "Communications", AMC: "Communications", TSLA: "Consumer Disc.", GME: "Consumer Disc.",
  JPM: "Financials", BAC: "Financials", XLF: "Financials", GLD: "Materials", USO: "Energy",
};
// Keyword matchers for the country & commodity dimensions.
const COUNTRY_KW: Record<string, RegExp> = {
  "United States": /\b(u\.?s\.?|united states|fed|fomc)\b/i,
  China: /china|pboc|yuan|renminbi/i,
  Eurozone: /euro\b|eurozone|\becb\b/i,
  Japan: /japan|\bboj\b|yen/i,
  "United Kingdom": /\buk\b|britain|sterling|\bboe\b|gilt/i,
  Germany: /german|bund/i,
  India: /india|\brbi\b/i,
  Brazil: /brazil|real\b/i,
};
const COMMODITY_KW: Record<string, RegExp> = {
  "Crude Oil": /crude|\boil\b|opec|wti/i,
  Gold: /gold|bullion/i,
  "Nat Gas": /nat gas|natural gas/i,
  Copper: /copper/i,
  Silver: /silver/i,
  Wheat: /wheat/i,
  Corn: /corn/i,
  Uranium: /uranium/i,
};

function rowsFromCounts(counts: Map<string, { n: number; s: number }>): AttentionRow[] {
  const maxN = Math.max(1, ...[...counts.values()].map((e) => e.n));
  return [...counts.entries()]
    .map(([label, e]) => ({ label, score: Math.round(Math.min(100, (e.n / maxN) * 100)), chg: 0, sentiment: Number((e.s / e.n).toFixed(2)) }))
    .sort((a, b) => b.score - a.score);
}

/** Recompute the full attention heatmap (tickers, sectors, countries, commodities) from the live tape. */
export function attentionFromHeadlines(heads: Headline[]): AttentionHeatmap {
  const tickers = new Map<string, { n: number; s: number }>();
  const sectors = new Map<string, { n: number; s: number }>();
  const countries = new Map<string, { n: number; s: number }>();
  const commodities = new Map<string, { n: number; s: number }>();
  const bump = (m: Map<string, { n: number; s: number }>, k: string, s: number) => {
    const e = m.get(k) ?? { n: 0, s: 0 };
    e.n += 1;
    e.s += s;
    m.set(k, e);
  };
  for (const h of heads) {
    for (const t of h.tickers) {
      bump(tickers, t, h.sentimentScore);
      const sec = SECTOR_BY_TICKER[t];
      if (sec) bump(sectors, sec, h.sentimentScore);
    }
    for (const [c, kw] of Object.entries(COUNTRY_KW)) if (kw.test(h.headline)) bump(countries, c, h.sentimentScore);
    for (const [c, kw] of Object.entries(COMMODITY_KW)) if (kw.test(h.headline)) bump(commodities, c, h.sentimentScore);
  }
  const seeded = getAttentionHeatmap();
  const pick = (live: AttentionRow[], fallback: AttentionRow[]) => (live.length >= 3 ? live : fallback);
  return {
    tickers: pick(rowsFromCounts(tickers), seeded.tickers),
    sectors: pick(rowsFromCounts(sectors), seeded.sectors),
    countries: pick(rowsFromCounts(countries), seeded.countries),
    commodities: pick(rowsFromCounts(commodities), seeded.commodities),
  };
}

/** Cluster the live tape into events by narrative keyword match (NEWS-6). */
export function eventsFromHeadlines(heads: Headline[]): EventCluster[] {
  const clusters: EventCluster[] = [];
  let id = 0;
  for (const name of NARRATIVES) {
    const kw = NARRATIVE_KW[name];
    if (!kw) continue;
    const matched = heads.filter((h) => kw.test(h.headline));
    if (matched.length < 2) continue;
    // modal asset class
    const acCount = new Map<AssetClass, number>();
    for (const h of matched) acCount.set(h.assetClass, (acCount.get(h.assetClass) ?? 0) + 1);
    const assetClass = [...acCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const sentiment = Number((matched.reduce((a, h) => a + h.sentimentScore, 0) / matched.length).toFixed(2));
    const sources = [...new Set(matched.map((h) => h.source))].slice(0, 4);
    const firstSeen = matched.reduce((min, h) => (h.time < min ? h.time : min), matched[0].time);
    const importance = Math.round(Math.min(99, 40 + matched.length * 6 + Math.abs(sentiment) * 20));
    clusters.push({
      id: `evt-live-${id++}`,
      title: name,
      assetClass,
      relatedCount: matched.length,
      importance,
      sentiment,
      firstSeen,
      summary: `${matched.length} related headlines across ${acCount.size} asset class${acCount.size > 1 ? "es" : ""}; net sentiment ${sentiment >= 0 ? "+" : ""}${sentiment}. Lead: “${matched[0].headline}”.`,
      sources,
    });
  }
  return clusters.length ? clusters.sort((a, b) => b.importance - a.importance) : getEventClusters();
}

/** Derive market signals from the live narratives, attention and social (NEWS-7). */
export function signalsFromHeadlines(narratives: NarrativeRow[], attention: AttentionHeatmap, social: SocialIntel, heads: Headline[]): NewsSignal[] {
  const out: NewsSignal[] = [];
  const recencyMin = (kw: RegExp) => heads.filter((h) => kw.test(h.headline)).reduce((min, h) => Math.min(min, h.minutesAgo), 600);
  const episodeFor = (seed: number) => Array.from({ length: 2 }, (_, k) => EPISODES[(seed + k * 3) % EPISODES.length]);
  let id = 0;

  for (const n of narratives.slice(0, 5)) {
    if (n.velocity < 45 && n.mentions < 3) continue;
    const dir: Direction = n.sentiment > 0.1 ? "RISK-ON" : n.sentiment < -0.1 ? "RISK-OFF" : "NEUTRAL";
    const confidence = Math.round(Math.min(96, 45 + n.velocity * 0.4 + Math.min(n.mentions, 20)));
    out.push({
      id: `sig-live-${id++}`,
      text: `${n.name} narrative ${n.velocity >= 60 ? "accelerating" : "building"} across the tape`,
      direction: dir,
      confidence,
      trigger: "Narrative acceleration",
      evidence: [
        `${n.mentions} headlines · velocity ${n.velocity}`,
        `${n.breadth} asset class${n.breadth > 1 ? "es" : ""} touched`,
        `sentiment ${n.sentiment >= 0 ? "+" : ""}${n.sentiment.toFixed(2)} and ${dir === "RISK-OFF" ? "falling" : "rising"}`,
      ],
      similarEpisodes: episodeFor(id).map((label) => ({ label, spyFwd: Number((dir === "RISK-OFF" ? -2.4 : 2.6).toFixed(1)) })),
      firedAgo: recencyMin(NARRATIVE_KW[n.name] ?? /$^/),
    });
  }

  const topSocial = social.tickers[0];
  if (topSocial && topSocial.velocity > 40) {
    out.push({
      id: `sig-live-${id++}`,
      text: `Unusual social activity in ${topSocial.label}`,
      direction: topSocial.sentiment >= 0 ? "RISK-ON" : "RISK-OFF",
      confidence: Math.round(Math.min(90, 50 + topSocial.velocity * 0.35)),
      trigger: "Unusual social activity",
      evidence: [`${topSocial.mentions.toLocaleString()} mentions · velocity +${topSocial.velocity}%`, `net social sentiment ${topSocial.sentiment >= 0 ? "+" : ""}${topSocial.sentiment}`, `across ${social.platforms.length} platforms`],
      similarEpisodes: episodeFor(id).map((label) => ({ label, spyFwd: Number((topSocial.sentiment >= 0 ? 1.8 : -1.9).toFixed(1)) })),
      firedAgo: 8,
    });
  }

  const topAttn = attention.tickers[0];
  if (topAttn && topAttn.score >= 70) {
    out.push({
      id: `sig-live-${id++}`,
      text: `Abnormal attention concentrating in ${topAttn.label}`,
      direction: topAttn.sentiment >= 0 ? "RISK-ON" : "RISK-OFF",
      confidence: Math.round(Math.min(88, 45 + topAttn.score * 0.4)),
      trigger: "Abnormal attention score",
      evidence: [`attention score ${topAttn.score}/100`, `sentiment ${topAttn.sentiment >= 0 ? "+" : ""}${topAttn.sentiment}`, "headline-flow concentration"],
      similarEpisodes: episodeFor(id).map((label) => ({ label, spyFwd: Number((topAttn.sentiment >= 0 ? 2.1 : -2.0).toFixed(1)) })),
      firedAgo: 15,
    });
  }

  return out.length ? out.sort((a, b) => b.confidence - a.confidence) : getSignals();
}

// ── NEWS-6 · Event Intelligence (clusters) ──────────────────────────────────

export interface EventCluster {
  id: string;
  title: string;
  assetClass: AssetClass;
  relatedCount: number;
  importance: number; // 0-100
  sentiment: number; // -1..1
  firstSeen: string; // HH:MM
  summary: string;
  sources: string[];
}

const CLUSTER_SUMMARIES: Record<string, string> = {
  "US Inflation Surprise": "Hotter-than-expected CPI print reignited reacceleration fears; rates repriced higher and rate-sensitive equities sold off intraday.",
  "Fed Surprise Cut": "An off-consensus dovish pivot drove a sharp risk-on rotation — equities and credit rallied while the dollar and front-end yields fell.",
  "Regional Bank Stress": "Renewed deposit-flight and CRE-exposure headlines pressured regional names; credit-stress mentions and HY spreads widened.",
  "Oil Supply Shock": "Supply-disruption reports lifted crude sharply, feeding inflation-reacceleration and energy-sector outperformance narratives.",
  "Megacap Earnings Beat": "Blowout AI-demand guidance from a megacap lifted the broad tape; AI-capex narrative breadth expanded across semis and infrastructure.",
  "Treasury Auction Tail": "A weak long-end auction tailed sharply, rebuilding term premium and steepening the curve amid supply-glut concerns.",
  "China Stimulus Package": "Larger-than-expected stimulus measures buoyed commodities and EM risk; copper and materials led the move.",
  "Jobs Report Beat": "A strong payrolls print reinforced the soft-landing narrative but trimmed near-term cut expectations, firming the dollar.",
};

export function getEventClusters(): EventCluster[] {
  const rng = new Rng("news-events-v1");
  return EVENT_TYPES.map((title, i) => {
    const riskOff = /Stress|Shock|Tail|Inflation Surprise/.test(title);
    const ac: AssetClass = title.includes("Inflation") || title.includes("Jobs") ? "MACRO"
      : title.includes("Bank") ? "CREDIT"
      : title.includes("Oil") ? "COMMODITY"
      : title.includes("Treasury") ? "RATES"
      : title.includes("China") ? "MACRO"
      : "EQUITY";
    return {
      id: `evt-${i}`,
      title,
      assetClass: ac,
      relatedCount: rng.int(6, 48),
      importance: Math.round(Math.max(40, Math.min(99, rng.normal(72, 16)))),
      sentiment: Number((riskOff ? rng.normal(-0.35, 0.25) : rng.normal(0.3, 0.25)).toFixed(2)),
      firstSeen: `${String(rng.int(8, 15)).padStart(2, "0")}:${String(rng.int(0, 59)).padStart(2, "0")}`,
      summary: CLUSTER_SUMMARIES[title] ?? "Auto-generated summary of the clustered headlines.",
      sources: Array.from(new Set(Array.from({ length: rng.int(2, 4) }, () => rng.pick(SOURCES)))),
    };
  }).sort((a, b) => b.importance - a.importance);
}

// ── NEWS-7 · Market Signal Engine ───────────────────────────────────────────

export interface NewsSignal {
  id: string;
  text: string;
  direction: Direction;
  confidence: number; // 0-100
  trigger: string; // which threshold fired
  evidence: string[];
  similarEpisodes: { label: string; spyFwd: number }[];
  firedAgo: number; // minutes
}

const SIGNAL_TEMPLATES: { text: string; direction: Direction; trigger: string }[] = [
  { text: "Credit-stress mentions rising rapidly across desks", direction: "RISK-OFF", trigger: "Mention velocity spike" },
  { text: "Fed-cut narrative accelerating into the meeting", direction: "RISK-ON", trigger: "Narrative acceleration" },
  { text: "AI-capex discussion strongest since 2023", direction: "RISK-ON", trigger: "Abnormal attention score" },
  { text: "Regional-bank stress discussion increasing", direction: "RISK-OFF", trigger: "Unusual social activity" },
  { text: "Inflation-reacceleration sentiment turning negative for duration", direction: "RISK-OFF", trigger: "Sentiment regime shift" },
  { text: "Soft-landing narrative spreading across asset classes", direction: "RISK-ON", trigger: "Cross-asset narrative spread" },
  { text: "Energy-shock chatter spiking with crude headlines", direction: "RISK-OFF", trigger: "Mention velocity spike" },
  { text: "Dollar-strength narrative gaining breadth", direction: "NEUTRAL", trigger: "Narrative acceleration" },
];

const EPISODES = ["Mar 2023 SVB", "Aug 2024 unwind", "Oct 2023 yields", "Nov 2023 pivot", "Apr 2025 tariffs", "Jul 2024 rotation"] as const;

export function getSignals(): NewsSignal[] {
  const rng = new Rng("news-signals-v1");
  return SIGNAL_TEMPLATES.map((s, i) => {
    const riskOff = s.direction === "RISK-OFF";
    return {
      id: `sig-${i}`,
      text: s.text,
      direction: s.direction,
      confidence: Math.round(Math.max(45, Math.min(96, rng.normal(74, 14)))),
      trigger: s.trigger,
      evidence: [
        `${rng.int(60, 480)} mentions in last 24h (${rng.int(20, 180)}% vs 7d avg)`,
        `${rng.int(3, 9)} sources · ${rng.int(2, 6)} asset classes`,
        `sentiment ${riskOff ? "−" : "+"}${rng.float(0.2, 0.7).toFixed(2)} and ${riskOff ? "falling" : "rising"}`,
      ],
      similarEpisodes: Array.from({ length: 2 }, () => ({
        label: rng.pick(EPISODES),
        spyFwd: Number((riskOff ? rng.normal(-2.4, 2) : rng.normal(2.6, 2)).toFixed(1)),
      })),
      firedAgo: rng.int(2, 240),
    };
  }).sort((a, b) => b.confidence - a.confidence);
}

// ── Top-line summary (header KPIs) ───────────────────────────────────────────

export interface NewsSummary {
  headlines24h: number;
  avgSentiment: number; // -1..1
  topNarrative: string;
  activeSignals: number;
  riskTone: Direction;
  attentionLeader: string;
}

/** Recompute the header summary from a (possibly live) headline set. */
export function summarizeHeadlines(heads: Headline[], narrOverride?: NarrativeRow[], attnOverride?: AttentionHeatmap): NewsSummary {
  const narr = narrOverride ?? getNarratives();
  const sigs = getSignals();
  const attn = attnOverride ?? getAttentionHeatmap();
  const avg = heads.length ? heads.reduce((a, h) => a + h.sentimentScore, 0) / heads.length : 0;
  const riskOff = sigs.filter((s) => s.direction === "RISK-OFF").length;
  const riskOn = sigs.filter((s) => s.direction === "RISK-ON").length;
  return {
    headlines24h: heads.length,
    avgSentiment: Number(avg.toFixed(2)),
    topNarrative: narr[0]?.name ?? "—",
    activeSignals: sigs.length,
    riskTone: riskOff > riskOn ? "RISK-OFF" : riskOn > riskOff ? "RISK-ON" : "NEUTRAL",
    attentionLeader: attn.tickers[0]?.label ?? "—",
  };
}

export function getNewsSummary(): NewsSummary {
  const heads = getHeadlines(120);
  const narr = getNarratives();
  const sigs = getSignals();
  const attn = getAttentionHeatmap();
  const avg = heads.reduce((a, h) => a + h.sentimentScore, 0) / heads.length;
  const riskOff = sigs.filter((s) => s.direction === "RISK-OFF").length;
  const riskOn = sigs.filter((s) => s.direction === "RISK-ON").length;
  return {
    headlines24h: heads.length,
    avgSentiment: Number(avg.toFixed(2)),
    topNarrative: narr[0]?.name ?? "—",
    activeSignals: sigs.length,
    riskTone: riskOff > riskOn ? "RISK-OFF" : riskOn > riskOff ? "RISK-ON" : "NEUTRAL",
    attentionLeader: attn.tickers[0]?.label ?? "—",
  };
}
