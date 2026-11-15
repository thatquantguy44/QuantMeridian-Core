import { BENCHMARK_AS_OF_TIME_ZONE, benchmarkAsOfDate } from "@/lib/benchmarkAsOf";
import { PROVIDER_CHECK_IDS, type ProviderCheckSeries, type ProviderCheckStatus } from "@/lib/benchmarkProviderLatest";
import { acquireProviderPermit } from "@/lib/server/benchmarkProviderLimiter";
import { checkFredLatest } from "@/lib/server/benchmarkProviderLatest";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";
/** Independent, on-demand metadata check. Never returns provider values or modifies the warehouse. */
export async function GET(_req: Request) {
  const started = new Date();
  const asOfDate = benchmarkAsOfDate(started);
  const key = (process.env.FRED_API_KEY ?? "").trim();
  const empty = (status: ProviderCheckStatus, retryAfterSeconds: number | null = null): ProviderCheckSeries[] => PROVIDER_CHECK_IDS.map((id) => ({ id, status, checkedAt: null, observationDate: null, futureObservationCount: 0, retryAfterSeconds }));
  let series: ProviderCheckSeries[];
  if (!key) series = empty("not_configured");
  else {
    const permit = await acquireProviderPermit(process.env.BENCHMARK_PROVIDER_LIMIT_DB_URL ?? "").catch(() => "unavailable" as const);
    if (permit === "unavailable") series = empty("limiter_unavailable");
    else if (permit === "limited") series = empty("rate_limited", 30);
    else series = await Promise.all(PROVIDER_CHECK_IDS.map((id) => checkFredLatest(id, key, asOfDate).catch(() => ({ id, status: "unavailable" as const, checkedAt: new Date().toISOString(), observationDate: null, futureObservationCount: 0, retryAfterSeconds: null }))));
  }
  return json({ source: "FRED", startedAt: started.toISOString(), asOfDate, asOfTimeZone: BENCHMARK_AS_OF_TIME_ZONE, series }, { headers: { "Cache-Control": "no-store" } });
}
