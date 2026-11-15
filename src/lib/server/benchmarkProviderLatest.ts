import type { ProviderCheckId, ProviderCheckSeries } from "@/lib/benchmarkProviderLatest";

const LIMIT = 100;
const MAX_BYTES = 128 * 1024;
const TIMEOUT_MS = 8000;
const numeric = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
}
async function boundedJson(response: Response): Promise<unknown> {
  const size = response.headers.get("content-length");
  if (size && (!/^\d+$/.test(size) || Number(size) > MAX_BYTES)) throw new Error("oversized");
  if (!response.body) throw new Error("empty");
  const reader = response.body.getReader();
  const parts: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_BYTES) { void reader.cancel().catch(() => {}); throw new Error("oversized"); }
      parts.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

/** Only returns an observation date; a direct response never enters Gold or analytics. */
export async function checkFredLatest(id: ProviderCheckId, apiKey: string, asOfDate: string, fetcher: typeof fetch = fetch): Promise<ProviderCheckSeries> {
  const empty = (status: ProviderCheckSeries["status"], checkedAt: string | null): ProviderCheckSeries => ({ id, status, checkedAt, observationDate: null, futureObservationCount: 0, retryAfterSeconds: null });
  if (!apiKey.trim()) return empty("not_configured", null);
  const params = new URLSearchParams({ series_id: id, api_key: apiKey, file_type: "json", sort_order: "desc", limit: String(LIMIT), realtime_start: asOfDate, realtime_end: asOfDate });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetcher(`https://api.stlouisfed.org/fred/series/observations?${params}`, { signal: controller.signal, redirect: "error", cache: "no-store" });
    if (!response.ok) {
      let status: ProviderCheckSeries["status"] = "unavailable";
      if (response.status === 429) status = "provider_rate_limited";
      else if (response.status === 423) status = "provider_locked";
      else if (response.status === 400) {
        // Inspect only bounded structured errors; never expose or log provider text.
        try {
          const body = await boundedJson(response);
          if (body && typeof body === "object") {
            const error = body as Record<string, unknown>;
            if (error.error_code === 400 && typeof error.error_message === "string" && /api_key/i.test(error.error_message) && /not registered|not valid|invalid|expired|not been set/i.test(error.error_message)) status = "credential_rejected";
          }
        } catch { /* Unknown errors stay unavailable. */ }
      }
      return empty(status, new Date().toISOString());
    }
    let body: unknown;
    try { body = await boundedJson(response); } catch { return empty(controller.signal.aborted ? "unavailable" : "invalid_response", new Date().toISOString()); }
    if (!body || typeof body !== "object") return empty("invalid_response", new Date().toISOString());
    const data = body as Record<string, unknown>;
    if (data.realtime_start !== asOfDate || data.realtime_end !== asOfDate || data.sort_order !== "desc" || data.offset !== 0 || data.limit !== LIMIT ||
      !Number.isSafeInteger(data.count) || (data.count as number) < 0 || !Array.isArray(data.observations) || data.observations.length !== Math.min(data.count as number, LIMIT)) return empty("invalid_response", new Date().toISOString());
    let previous = "9999-99-99", latest: string | null = null, future = 0;
    for (const item of data.observations) {
      if (!item || typeof item !== "object") return empty("invalid_response", new Date().toISOString());
      const row = item as Record<string, unknown>;
      if (!validDate(row.date) || row.date >= previous || typeof row.value !== "string" || (row.value !== "." && (!numeric.test(row.value) || !Number.isFinite(Number(row.value)))) ||
        (row.realtime_start !== undefined && (!validDate(row.realtime_start) || row.realtime_start > asOfDate)) || (row.realtime_end !== undefined && !validDate(row.realtime_end))) return empty("invalid_response", new Date().toISOString());
      previous = row.date;
      if (row.date > asOfDate) { future++; continue; }
      if (row.value !== "." && latest === null) latest = row.date;
    }
    return { id, status: latest ? "checked" : "no_observation", checkedAt: new Date().toISOString(), observationDate: latest, futureObservationCount: future, retryAfterSeconds: null };
  } catch {
    return empty("unavailable", new Date().toISOString());
  } finally { clearTimeout(timer); controller.abort(); }
}
