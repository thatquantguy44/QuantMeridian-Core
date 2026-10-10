/**
 * In-house sentiment scorer — the always-on heuristic tier.
 *
 * A VADER-style, finance-tuned lexicon scorer with negation handling and
 * intensifiers. This is the fallback used wherever a richer source isn't
 * available (Finnhub/NewsAPI headlines, Reddit titles). It is intentionally
 * dependency-free and deterministic.
 *
 * Layering (best → fallback):
 *   1. Provider-native sentiment (Alpha Vantage, Marketaux)              → used as-is
 *   2. Python FinBERT stage via NEWS_NLP_URL (enrichWithNlp below)        → "NLP"
 *   3. This heuristic scorer (scoreText)                                  → "heuristic"/SIM
 */
import type { Headline, Sentiment, EventCluster, AssetClass } from "@/data/news";

const clamp = (s: number) => Math.max(-1, Math.min(1, s));

export function labelFrom(score: number): Sentiment {
  return score > 0.15 ? "BULLISH" : score < -0.15 ? "BEARISH" : "NEUTRAL";
}

// Finance + market-social lexicon, valence in roughly [-3, 3].
const LEXICON: Record<string, number> = {
  // bullish — price/flow
  surge: 2.2, surges: 2.2, surged: 2.0, jump: 1.8, jumps: 1.8, soar: 2.4, soars: 2.4, rally: 2.0, rallies: 2.0, rallied: 1.8,
  rise: 1.2, rises: 1.2, gain: 1.4, gains: 1.4, climb: 1.4, climbs: 1.4, rebound: 1.6, record: 1.6, tops: 1.6, beat: 1.8, beats: 1.8,
  upgrade: 1.8, upgraded: 1.8, outperform: 1.8, strong: 1.3, robust: 1.3, boost: 1.5, optimism: 1.6, optimistic: 1.6, bullish: 2.2, recovery: 1.4,
  resilient: 1.4, resilience: 1.4, expansion: 1.2, inflows: 1.5, upside: 1.4,
  // bearish — price/flow
  slump: -2.2, slumps: -2.2, slide: -1.8, slides: -1.8, plunge: -2.6, plunges: -2.6, tumble: -2.2, tumbles: -2.2, sink: -2.0, sinks: -2.0,
  fall: -1.4, falls: -1.4, drop: -1.6, drops: -1.6, miss: -1.8, misses: -1.8, missed: -1.8, cut: -1.2, cuts: -1.2, downgrade: -1.8, downgraded: -1.8,
  warn: -1.6, warns: -1.6, warning: -1.6, weak: -1.4, weakness: -1.4, fear: -1.8, fears: -1.8, jitters: -1.6, stress: -1.8, selloff: -2.0,
  bearish: -2.2, recession: -2.0, crash: -2.6, default: -2.0, bankruptcy: -2.6, bankrupt: -2.6, contraction: -1.6, contracts: -1.4, slowdown: -1.6, outflows: -1.5, downside: -1.4,
  // market-social slang (Reddit/StockTwits)
  moon: 2.4, rocket: 2.2, tendies: 2.0, squeeze: 1.8, long: 0.8, calls: 1.0, buy: 1.2, hold: 0.4, green: 1.2, rip: 1.6, pump: 1.2,
  puts: -1.0, short: -0.8, dump: -1.8, tank: -2.0, bagholder: -1.8, red: -1.2, fud: -1.4, sell: -1.2,
};

const INTENSIFIERS: Record<string, number> = {
  very: 1.4, sharply: 1.5, surging: 1.4, massively: 1.6, significantly: 1.4, extremely: 1.6, deeply: 1.4,
  slightly: 0.6, modestly: 0.6, marginally: 0.5, somewhat: 0.7,
};

// Negators flip + dampen the next few sentiment tokens (until punctuation).
const NEGATORS = new Set(["not", "no", "never", "without", "cant", "cannot", "fails", "failed", "fail", "lacks", "lack", "isnt", "wont", "dont", "less", "lower"]);
const NEG_FLIP = -0.74;
const NEG_WINDOW = 3;

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^a-z\s']/g, " ").split(/\s+/).filter(Boolean);
}

/** VADER-style normalization of a summed valence into [-1, 1]. */
function normalize(sum: number, alpha = 13): number {
  return clamp(sum / Math.sqrt(sum * sum + alpha));
}

export function scoreText(text: string): { score: number; label: Sentiment } {
  if (!text) return { score: 0, label: "NEUTRAL" };
  const toks = tokenize(text);
  let sum = 0;
  let negCountdown = 0;
  let intensifier = 1;
  for (const tok of toks) {
    if (NEGATORS.has(tok)) {
      negCountdown = NEG_WINDOW;
      continue;
    }
    if (tok in INTENSIFIERS) {
      intensifier = INTENSIFIERS[tok];
      continue;
    }
    const base = LEXICON[tok];
    if (base !== undefined) {
      let v = base * intensifier;
      if (negCountdown > 0) v *= NEG_FLIP; // negate + dampen
      sum += v;
      intensifier = 1;
    }
    if (negCountdown > 0) negCountdown -= 1;
  }
  const score = normalize(sum);
  return { score, label: labelFrom(score) };
}

const FETCH_TIMEOUT_MS = 8000;

/**
 * Tier 2 — enrich headlines with the Python FinBERT stage when NEWS_NLP_URL is
 * configured (POST {texts} → {scores:[{score,label}]}). Returns the headlines
 * unchanged (and nlp=false) if the service is absent or errors, so callers
 * degrade to provider/heuristic sentiment.
 */
export async function enrichWithNlp(headlines: Headline[]): Promise<{ headlines: Headline[]; nlp: boolean }> {
  const url = process.env.NEWS_NLP_URL;
  if (!url || !headlines.length) return { headlines, nlp: false };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/score`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: headlines.map((h) => h.headline) }),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const scores = j?.scores;
    if (!Array.isArray(scores) || scores.length !== headlines.length) return { headlines, nlp: false };
    const enriched = headlines.map((h, i) => {
      const sc = clamp(Number(scores[i]?.score ?? h.sentimentScore));
      return { ...h, sentimentScore: sc, sentiment: labelFrom(sc) };
    });
    return { headlines: enriched, nlp: true };
  } catch {
    return { headlines, nlp: false };
  } finally {
    clearTimeout(timer);
  }
}

interface NlpCluster {
  cluster_id: number;
  title: string;
  size: number;
  avg_sentiment: number;
  assetClass: AssetClass;
  members: string[];
}

/**
 * Tier 2 (NEWS-6) — transformer event clusters from the FinBERT stage when
 * NEWS_NLP_URL is set (POST {headlines} → {clusters}). Display fields
 * (first-seen, sources) are enriched from the local headlines by member id.
 * Returns null when the service is absent/errors → caller uses keyword clustering.
 */
export async function fetchNlpClusters(headlines: Headline[]): Promise<EventCluster[] | null> {
  const url = process.env.NEWS_NLP_URL;
  if (!url || !headlines.length) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/cluster`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ headlines: headlines.map((h) => ({ id: h.id, headline: h.headline, source: h.source, tickers: h.tickers })) }),
      cache: "no-store",
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const clusters: NlpCluster[] = Array.isArray(j?.clusters) ? j.clusters : [];
    const byId = new Map(headlines.map((h) => [h.id, h]));
    const mapped = clusters
      .filter((c) => c.size >= 2)
      .map((c): EventCluster => {
        const mem = c.members.map((id) => byId.get(id)).filter((h): h is Headline => !!h);
        const firstSeen = mem.length ? mem.reduce((min, h) => (h.time < min ? h.time : min), mem[0].time) : "";
        const sources = [...new Set(mem.map((h) => h.source))].slice(0, 4);
        const sentiment = Number(c.avg_sentiment.toFixed(2));
        return {
          id: `evt-nlp-${c.cluster_id}`,
          title: c.title,
          assetClass: c.assetClass,
          relatedCount: c.size,
          importance: Math.round(Math.min(99, 40 + c.size * 6 + Math.abs(sentiment) * 20)),
          sentiment,
          firstSeen,
          summary: `${c.size} related headlines (FinBERT cluster); net sentiment ${sentiment >= 0 ? "+" : ""}${sentiment}. Lead: “${mem[0]?.headline ?? c.title}”.`,
          sources,
        };
      })
      .sort((a, b) => b.importance - a.importance);
    return mapped.length ? mapped : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
