/**
 * Server-only Polymarket API client (CLOB + Gamma).
 *
 * Both APIs are public — no auth key required. Activated unconditionally
 * (unlike FRED which gates on FRED_API_KEY). The route handlers try live
 * first and fall back to SIM on network failure, so this is safe to call
 * in any environment.
 *
 * In-memory TTL cache prevents hammering the API on rapid page navigations.
 */

import { fetchWithProxyFallback } from "@/lib/server/fetchProxy";
import type { PolyMarket, PolyEvent, PolyPricePoint, PolyCategory } from "@/data/polymarket";

const GAMMA_BASE = "https://gamma-api.polymarket.com";
const CLOB_BASE = "https://clob.polymarket.com";
const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 120_000; // 2 minutes

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();

function cached<T>(key: string): T | undefined {
  const e = cache.get(key);
  if (e && Date.now() - e.at < CACHE_TTL_MS) return e.data as T;
  return undefined;
}

function store(key: string, data: unknown) {
  cache.set(key, { at: Date.now(), data });
}

function parseCategory(raw: string | undefined): PolyCategory {
  const map: Record<string, PolyCategory> = {
    politics: "Politics", crypto: "Crypto", economics: "Economics",
    sports: "Sports", science: "Science", culture: "Culture",
    "pop culture": "Culture", tech: "Tech", technology: "Tech",
    climate: "Climate", "climate & weather": "Climate",
  };
  return map[(raw ?? "").toLowerCase()] ?? "Culture";
}

function gammaToMarket(item: any): PolyMarket | null {
  try {
    let prices = item.outcomePrices ?? "[]";
    if (typeof prices === "string") prices = JSON.parse(prices);
    const yesPrice = Number(prices[0] ?? 0.5);
    const noPrice = Number(prices[1] ?? 1 - yesPrice);
    const spread = Math.abs(1 - yesPrice - noPrice);

    let clobIds = item.clobTokenIds ?? "[]";
    if (typeof clobIds === "string") clobIds = JSON.parse(clobIds);

    return {
      id: item.conditionId ?? item.id ?? "",
      question: item.question ?? "",
      category: parseCategory(item.groupItemTitle ?? item.category),
      yesPrice: Number(yesPrice.toFixed(2)),
      noPrice: Number(noPrice.toFixed(2)),
      spread: Number(spread.toFixed(3)),
      volume24h: Number(item.volume24hr ?? 0),
      totalVolume: Number(item.volume ?? 0),
      liquidity: Number(item.liquidity ?? 0),
      chg24h: 0,
      endDate: (item.endDate ?? "").slice(0, 10),
      spark: [],
      active: Boolean(item.active),
    };
  } catch {
    return null;
  }
}

export async function fetchLiveMarkets(opts: {
  limit?: number;
  category?: string;
}): Promise<PolyMarket[]> {
  const limit = opts.limit ?? 100;
  const cacheKey = `poly-markets-${limit}`;
  const hit = cached<PolyMarket[]>(cacheKey);
  if (hit) {
    return opts.category ? hit.filter((m) => m.category === opts.category) : hit;
  }

  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    limit: String(limit),
    order: "volume24hr",
    ascending: "false",
  });
  const res = await fetchWithProxyFallback(
    `${GAMMA_BASE}/markets?${params}`,
    { signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (!res.ok) throw new Error(`Gamma API ${res.status}`);
  const raw: any[] = await res.json();
  const markets = raw.map(gammaToMarket).filter((m): m is PolyMarket => m !== null);
  store(cacheKey, markets);
  return opts.category ? markets.filter((m) => m.category === opts.category) : markets;
}

export async function fetchLiveEvents(limit = 20): Promise<PolyEvent[]> {
  const cacheKey = `poly-events-${limit}`;
  const hit = cached<PolyEvent[]>(cacheKey);
  if (hit) return hit;

  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    limit: String(limit),
  });
  const res = await fetchWithProxyFallback(
    `${GAMMA_BASE}/events?${params}`,
    { signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (!res.ok) throw new Error(`Gamma events API ${res.status}`);
  const raw: any[] = await res.json();

  const events: PolyEvent[] = raw
    .filter((e) => Array.isArray(e.markets) && e.markets.length > 0)
    .map((e) => {
      const eventMarkets = e.markets.map(gammaToMarket).filter((m: PolyMarket | null): m is PolyMarket => m !== null);
      return {
        id: e.id ?? "",
        title: e.title ?? "",
        category: parseCategory(e.category),
        markets: eventMarkets,
        totalVolume: eventMarkets.reduce((s: number, m: PolyMarket) => s + m.totalVolume, 0),
      };
    })
    .filter((e) => e.markets.length > 0);

  store(cacheKey, events);
  return events;
}

export async function fetchLivePriceHistory(
  tokenId: string,
  days = 90
): Promise<PolyPricePoint[]> {
  const cacheKey = `poly-hist-${tokenId}-${days}`;
  const hit = cached<PolyPricePoint[]>(cacheKey);
  if (hit) return hit;

  const params = new URLSearchParams({
    market: tokenId,
    interval: "1d",
    fidelity: "60",
  });
  const res = await fetchWithProxyFallback(
    `${CLOB_BASE}/prices-history?${params}`,
    { signal: AbortSignal.timeout(TIMEOUT_MS) }
  );
  if (!res.ok) throw new Error(`CLOB price-history ${res.status}`);
  const json = await res.json();
  const history: { t: number; p: number }[] = json.history ?? [];

  const points: PolyPricePoint[] = history.map((h) => ({
    date: new Date(h.t * 1000).toISOString().slice(0, 10),
    price: Number(h.p.toFixed(3)),
  }));

  store(cacheKey, points);
  return points;
}
