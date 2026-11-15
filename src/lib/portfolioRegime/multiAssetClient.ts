import { benchmarkAsOfDate } from "@/lib/benchmarkAsOf";
import { PORA_ASSETS, type MultiAssetPreview, type PoraAsset } from "./multiAssetContracts";

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const stamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
}
function timestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

/** Reject malformed or non-observed results; no cache, substitute source or partial result. */
export async function fetchMultiAssetPreview(ids: PoraAsset[], signal?: AbortSignal): Promise<MultiAssetPreview> {
  if (ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length || ids.some((id) => !PORA_ASSETS.includes(id))) throw new Error("Select two to four distinct supported assets.");
  const response = await fetch(`/api/portfolio-regime/source-check?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store", signal });
  const body: unknown = await response.json();
  if (!response.ok) {
    const error = body && typeof body === "object" ? (body as { error?: unknown }).error : null;
    throw new Error(typeof error === "string" && error.length <= 300 ? error : "Multi-asset source history is unavailable.");
  }
  return validateMultiAssetPreview(body, ids);
}

/** Validate the same comparison contract for a source check or a fresh snapshot capture. */
export function validateMultiAssetPreview(body: unknown, ids: PoraAsset[]): MultiAssetPreview {
  if (ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length || ids.some((id) => !PORA_ASSETS.includes(id))) throw new Error("Select two to four distinct supported assets.");
  const invalid = (): never => { throw new Error("The multi-asset source response is unavailable or invalid; no comparison is displayed."); };
  if (!body || typeof body !== "object") return invalid();
  const result = body as MultiAssetPreview & { error?: unknown };
  if (result.source !== "DB" || result.error || !timestamp(result.checkedAt) || !validDate(result.asOfDate) || benchmarkAsOfDate(new Date(result.checkedAt)) !== result.asOfDate ||
    !validDate(result.firstDate) || !validDate(result.lastDate) || result.firstDate >= result.lastDate || result.lastDate > result.asOfDate || result.sessionCount !== 253 || result.returnCount !== 252 || !Array.isArray(result.assets) || result.assets.length !== ids.length) return invalid();
  let commonDates: string[] | null = null;
  for (let i = 0; i < result.assets.length; i++) {
    const asset = result.assets[i];
    if (!asset || asset.id !== ids[i] || !validDate(asset.latestDate) || asset.latestDate < result.lastDate || asset.latestDate > result.asOfDate ||
      !Number.isSafeInteger(asset.futureCount) || asset.futureCount < 0 || !timestamp(asset.lastIngestedAt) || Date.parse(asset.lastIngestedAt) > Date.parse(result.checkedAt) ||
      !Number.isFinite(asset.totalChange) || !Array.isArray(asset.returns) || asset.returns.length !== result.returnCount) return invalid();
    let previous = result.firstDate, compounded = 1;
    const dates: string[] = [];
    for (const row of asset.returns) {
      if (!row || !validDate(row.date) || row.date <= previous || row.date > result.lastDate || typeof row.value !== "number" || !Number.isFinite(row.value) || row.value <= -1) return invalid();
      compounded *= 1 + row.value; previous = row.date; dates.push(row.date);
    }
    if (previous !== result.lastDate || !Number.isFinite(compounded) || Math.abs((compounded - 1) - asset.totalChange) > 1e-8 * Math.max(1, Math.abs(asset.totalChange)) || (commonDates && dates.some((date, j) => date !== commonDates![j]))) return invalid();
    commonDates = dates;
  }
  return result;
}

/** Full-precision aligned returns with source and capture metadata; no model output. */
export function multiAssetCsv(data: MultiAssetPreview): string {
  const cell = (value: string | number) => {
    const raw = String(value); const safe = typeof value === "string" && /^[\s\u0000-\u001f]*[=+@\-]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = [["date", "asset", "total_return_fraction", "provider", "method", "window_start", "window_end", "source_as_of_date", "source_checked_at", "latest_warehouse_ingestion_at"],
    ...data.assets.flatMap((asset) => asset.returns.map((row) => [row.date, asset.id, row.value, "Tiingo End-of-Day", "derived from close, dividends and splits", data.firstDate, data.lastDate, data.asOfDate, data.checkedAt, asset.lastIngestedAt]))];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
