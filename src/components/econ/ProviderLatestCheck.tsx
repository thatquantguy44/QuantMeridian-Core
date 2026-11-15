import { useEffect, useRef, useState } from "react";
import { fetchProviderLatest, type ProviderCheckResponse, type ProviderCheckSeries } from "@/lib/benchmarkProviderLatest";
import type { QualifiedBenchmarkSeries } from "@/lib/benchmarkQualified";

function comparison(provider: string, warehouse: string | null, label: string): string {
  if (!warehouse) return `${label}: unavailable`;
  if (provider === warehouse) return `${label}: same date (${warehouse})`;
  return `${label}: ${warehouse} (${provider > warehouse ? "FRED is later" : "warehouse is later"})`;
}
function statusText(row: ProviderCheckSeries, startedAt: string): string {
  switch (row.status) {
    case "not_configured": return "FRED API key not configured.";
    case "limiter_unavailable": return "FRED check paused: shared rate limit unavailable.";
    case "credential_rejected": return "FRED rejected the configured API key.";
    case "provider_rate_limited": return "FRED rate limited this request.";
    case "provider_locked": return "FRED access is locked.";
    case "unavailable": return "FRED check unavailable.";
    case "invalid_response": return "FRED response rejected as malformed.";
    case "no_observation": return "No usable observation in the latest 100 returned records.";
    case "rate_limited": return `Rate limited; try again after ${new Date(Date.parse(startedAt) + row.retryAfterSeconds! * 1000).toISOString()}.`;
    case "checked": return `FRED latest as of cutoff: ${row.observationDate}`;
  }
}

/** Separate date-only provider check; it never updates qualified observations. */
export function ProviderLatestCheck({ series }: { series: QualifiedBenchmarkSeries[] }) {
  const [result, setResult] = useState<ProviderCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); }, []);
  const check = async () => {
    if (active.current) return;
    const controller = new AbortController(); active.current = controller;
    setResult(null); setError(null); setLoading(true);
    try {
      const response = await fetchProviderLatest(controller.signal);
      if (!controller.signal.aborted) setResult(response);
    } catch {
      if (!controller.signal.aborted) setError("FRED check unavailable or response rejected.");
    } finally {
      if (active.current === controller) active.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  return <div className="space-y-1 border border-term-border p-2 text-2xs" aria-label="FRED provider check">
    <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={check} disabled={loading} className="rounded border border-term-border px-2 py-1 text-term-text-dim disabled:opacity-50">{loading ? "Checking FRED…" : "Check FRED latest"}</button><span className="text-term-text-mute">SOFR and DGS10 · date check only · not a publication timestamp</span></div>
    <div aria-live="polite">
      {loading ? "Checking FRED." : error ? <span role="alert">{error}</span> : !result ? "Provider latest: not checked." : <>
        <div className="text-term-text-mute">FRED as-of cutoff {result.asOfDate} ({result.asOfTimeZone}); latest usable date among up to 100 returned records. Dates do not compare values or prove publication time.</div>
        <div className="grid gap-2 sm:grid-cols-2">{result.series.map((row) => {
          const warehouse = series.find((item) => item.id === row.id);
          return <div key={row.id} data-testid={`provider-latest-${row.id}`} className="break-words">
            <div className="font-semibold text-term-text">{row.id} · {statusText(row, result.startedAt)}</div>
            {row.checkedAt && <div>{row.status === "checked" || row.status === "no_observation" ? "Checked" : "Attempted"} {row.checkedAt}</div>}
            {row.futureObservationCount > 0 && <div className="text-term-amber">Future-dated FRED records excluded: {row.futureObservationCount}.</div>}
            {row.status === "checked" && row.observationDate && <><div>{comparison(row.observationDate, warehouse?.status === "available" ? warehouse.observationDate : null, "Qualified Gold")}</div><div>{comparison(row.observationDate, warehouse?.latestWarehouseSourceStatus === "verified" ? warehouse.latestWarehouseSourceDate : null, "Verified warehouse source")}</div></>}
          </div>;
        })}</div>
      </>}
    </div>
  </div>;
}
