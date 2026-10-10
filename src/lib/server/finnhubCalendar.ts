/**
 * Finnhub Economic Calendar client (free tier).
 *
 * Endpoint: GET https://finnhub.io/api/v1/calendar/economic
 * Provides upcoming and recent economic events with consensus estimates,
 * prior values, and actuals — the forward-looking data that FRED lacks.
 *
 * Free tier: 60 calls/min. We cache aggressively (15 min TTL) since the
 * calendar changes at most a few times per day.
 *
 * Docs: https://finnhub.io/docs/api/economic-calendar
 */
import { fetchWithProxyFallback } from "@/lib/server/fetchProxy";

const BASE = "https://finnhub.io/api/v1";
const CACHE_TTL_MS = 900_000; // 15 minutes

export interface FinnhubEconEvent {
  country: string;
  time: string;        // "YYYY-MM-DD HH:MM:SS" (UTC)
  event: string;
  impact: "low" | "medium" | "high";
  actual: number | null;
  estimate: number | null;
  prev: number | null;
  unit: string;
}

interface CacheEntry {
  at: number;
  data: FinnhubEconEvent[];
}

let cache: CacheEntry | null = null;

export function finnhubEnabled(): boolean {
  return Boolean(process.env.FINNHUB_API_KEY);
}

export async function finnhubEconCalendar(
  from: string,
  to: string,
): Promise<FinnhubEconEvent[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY not configured");

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.data;
  }

  const url = `${BASE}/calendar/economic?from=${from}&to=${to}&token=${encodeURIComponent(key)}`;
  const res = await fetchWithProxyFallback(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Finnhub calendar HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json() as {
    economicCalendar?: FinnhubEconEvent[];
    result?: FinnhubEconEvent[];
  };
  const events = json.economicCalendar ?? json.result ?? [];

  cache = { at: Date.now(), data: events };
  return events;
}
