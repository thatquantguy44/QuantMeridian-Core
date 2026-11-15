import type { VixForwardResponse } from "@/app/api/market-volatility/vix-forward/route";
import { benchmarkAsOfDate } from "@/lib/benchmarkAsOf";

export type PoraSourceBasis = "spy_price" | "spy_total";
export interface PoraSourceInspection {
  basis: PoraSourceBasis;
  rows: [string, number][];
  count: number;
  firstDate: string;
  lastDate: string;
  previousDate: string | null;
  previousChangePct: number | null;
  totalChangePct: number | null;
  provider: string;
  kind: "observed close" | "derived total return";
  method: string;
  sourceSeries: string[];
  verifiedAt: string;
  lastIngestedAt: string;
  warnings: string[];
}

/** Inspect a reconciled current-vintage history. This is not PORA admission or a model input. */
export function inspectPoraSource(data: VixForwardResponse, basis: PoraSourceBasis): PoraSourceInspection {
  const fail = (): never => { throw new Error("The source response is incomplete, inconsistent or unverified. No history was displayed."); };
  const prov = data?.provenance?.price;
  const sources = basis === "spy_total" ? ["SPY:close", "SPY:divCash", "SPY:splitFactor"] : ["SPY:close"];
  const series = basis === "spy_total" ? "SPY:total_return_index" : "SPY:close";
  const kind = basis === "spy_total" ? "derived total return" : "observed close";
  const column = basis === "spy_total" ? "total_return_index" : "close";
  const verifiedAt = data?.provenance?.verifiedAt;
  const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
  if (data?.source !== "DB" || data.error || data.basis !== basis || data.provenance?.policy !== "observed-inputs-only" || !timestamp(verifiedAt) ||
    data.inputs?.priceSeriesId !== series || !prov || prov.provider !== "Tiingo End-of-Day" || prov.table !== "gold.equity_total_return_index" || prov.column !== column || prov.kind !== kind ||
    !Array.isArray(prov.sourceSeries) || prov.sourceSeries.join("|") !== sources.join("|") || !timestamp(prov.lastIngestedAt) || Date.parse(prov.lastIngestedAt) > Date.parse(verifiedAt) ||
    typeof prov.method !== "string" || !prov.method.trim() || prov.method.length > 2048 || !Array.isArray(data.price) || !data.price.length || prov.verifiedRows !== data.price.length) return fail();
  const asOf = benchmarkAsOfDate(new Date(verifiedAt));
  let prior = "";
  for (const row of data.price) {
    if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row[0]) ||
      !Number.isFinite(Date.parse(`${row[0]}T00:00:00Z`)) || new Date(`${row[0]}T00:00:00Z`).toISOString().slice(0, 10) !== row[0] ||
      row[0] <= prior || row[0] > asOf || typeof row[1] !== "number" || !Number.isFinite(row[1]) || row[1] <= 0) return fail();
    prior = row[0];
  }
  const first = data.price[0], last = data.price.at(-1)!, previous = data.price.at(-2);
  if (data.inputs.priceFirst !== first[0] || data.inputs.priceLast !== last[0]) return fail();
  const change = (start: number) => { const result = (last[1] / start - 1) * 100; return Number.isFinite(result) ? result : null; };
  return { basis, rows: data.price, count: data.price.length, firstDate: first[0], lastDate: last[0], previousDate: previous?.[0] ?? null,
    previousChangePct: previous ? change(previous[1]) : null, totalChangePct: previous ? change(first[1]) : null, provider: prov.provider, kind, method: prov.method,
    sourceSeries: sources, verifiedAt, lastIngestedAt: prov.lastIngestedAt,
    warnings: Array.isArray(data.warnings) ? data.warnings.filter((item): item is string => typeof item === "string").slice(0, 20) : [] };
}

/** Export only the inspected observations with their source and retrieval evidence. */
export function sourceCsv(snapshot: PoraSourceInspection): string {
  const cell = (value: string | number) => {
    const raw = String(value);
    const safe = typeof value === "string" && /^[\s\u0000-\u001f]*[=+@\-]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const rows = [["date", "value", "series", "basis", "provider", "method", "source_verified_at", "latest_warehouse_ingestion_at"], ...snapshot.rows.map(([date, value]) => [date, value, "SPY", snapshot.kind, snapshot.provider, snapshot.method, snapshot.verifiedAt, snapshot.lastIngestedAt])];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
