import { benchmarkAsOfDate } from "./benchmarkAsOf";

/** A live FRED check is informational and never qualifies or supplies rate history. */
export const PROVIDER_CHECK_IDS = ["SOFR", "DGS10"] as const;
export type ProviderCheckId = typeof PROVIDER_CHECK_IDS[number];
export type ProviderCheckStatus = "checked" | "not_configured" | "unavailable" | "invalid_response" | "no_observation" | "rate_limited" | "limiter_unavailable" | "credential_rejected" | "provider_rate_limited" | "provider_locked";
export interface ProviderCheckSeries {
  id: ProviderCheckId;
  status: ProviderCheckStatus;
  checkedAt: string | null;
  observationDate: string | null;
  futureObservationCount: number;
  retryAfterSeconds: number | null;
}
export interface ProviderCheckResponse {
  source: "FRED";
  startedAt: string;
  asOfDate: string;
  asOfTimeZone: "America/New_York";
  series: ProviderCheckSeries[];
}

/** Validate a separate provider response; never feed it to qualified-history analytics. */
export async function fetchProviderLatest(signal?: AbortSignal): Promise<ProviderCheckResponse> {
  const response = await fetch("/api/benchmark-provider-latest", { cache: "no-store", signal });
  if (!response.ok) throw new Error("FRED check unavailable.");
  const body: unknown = await response.json();
  const invalid = (): never => { throw new Error("FRED check response is malformed."); };
  const date = (value: unknown): value is string => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const n = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value;
  };
  const instant = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  if (!body || typeof body !== "object") return invalid();
  const data = body as ProviderCheckResponse;
  if (data.source !== "FRED" || !instant(data.startedAt) || !date(data.asOfDate) || data.asOfTimeZone !== "America/New_York" || !Array.isArray(data.series) || data.series.length !== PROVIDER_CHECK_IDS.length) return invalid();
  if (benchmarkAsOfDate(new Date(data.startedAt)) !== data.asOfDate) return invalid();
  const ids = new Set<string>();
  for (const row of data.series) {
    if (!row || typeof row !== "object" || Object.keys(row).sort().join(",") !== "checkedAt,futureObservationCount,id,observationDate,retryAfterSeconds,status" ||
      !PROVIDER_CHECK_IDS.includes(row.id) || ids.has(row.id) || !["checked", "not_configured", "unavailable", "invalid_response", "no_observation", "rate_limited", "limiter_unavailable", "credential_rejected", "provider_rate_limited", "provider_locked"].includes(row.status) ||
      !Number.isSafeInteger(row.futureObservationCount) || row.futureObservationCount < 0 || row.futureObservationCount > 100 ||
      (row.status === "checked" ? (!date(row.observationDate) || row.observationDate > data.asOfDate) : row.observationDate !== null) ||
      (["not_configured", "rate_limited", "limiter_unavailable"].includes(row.status) ? row.checkedAt !== null : (!instant(row.checkedAt) || row.checkedAt < data.startedAt)) ||
      (row.status === "rate_limited" ? (!Number.isInteger(row.retryAfterSeconds) || row.retryAfterSeconds! < 1 || row.retryAfterSeconds! > 30) : row.retryAfterSeconds !== null) ||
      (!["checked", "no_observation"].includes(row.status) && row.futureObservationCount !== 0)) return invalid();
    ids.add(row.id);
  }
  return data;
}
