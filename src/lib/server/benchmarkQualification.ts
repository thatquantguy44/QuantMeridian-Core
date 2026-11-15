import { benchmarkAsOfDate } from "@/lib/benchmarkAsOf";
import type { BenchmarkDef } from "@/data/benchmarkRates";
import type { BenchmarkEvidenceMethod, QualifiedBenchmarkSeries } from "@/lib/benchmarkQualified";

export interface BenchmarkEvidenceRow {
  date: string;
  value: unknown;
  gold_missing: unknown;
  realtime_start: string | null;
  realtime_end?: string | null;
  source: string | null;
  source_value: unknown;
  raw_value: unknown;
  source_missing: unknown;
  row_hash: string | null;
  run_id: string | null;
  ingested_at: string | null;
  receipt_endpoint: string | null;
}
export interface BenchmarkMetadata { source: string | null; frequency: string | null; units: string | null }
export interface BenchmarkBoard {
  latest_date: string | null; latest_value: unknown;
  as_of_date?: unknown; source?: unknown; latest_revision_start?: unknown;
  latest_ingested_at?: unknown; history_unknown_vintage_count?: unknown;
}

/** Key identifies exactly one observation in a separately verified repair capture. */
export function benchmarkEvidenceKey(series: string, run: string, date: string, realtimeStart: string | null): string {
  return [series, run, date, realtimeStart ?? ""].join("\u0000");
}
function number(value: unknown): number | null {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}
function validDate(date: unknown): date is string {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const stamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === date;
}
function conversion(def: BenchmarkDef, unit: string): number | null {
  const native = unit.trim().toLowerCase();
  if (def.unit === "bps") return /^percent(?: per annum)?$/.test(native) ? 100 : /^(basis points|bps)$/.test(native) ? 1 : null;
  if (def.unit === "%") return /^percent(?: per annum)?$/.test(native) ? 1 : null;
  if (def.unit === "$/bbl") return /^(u\.s\. )?dollars per barrel$/.test(native) ? 1 : null;
  if (def.unit === "$/oz") return /^(u\.s\. )?dollars per (troy )?ounce$/.test(native) ? 1 : null;
  return /^(index|index points)$/.test(native) ? 1 : null;
}

/** Board fields are claims from a materialized view, not provider evidence. */
function boardMetadata(board: BenchmarkBoard | null, now: Date): QualifiedBenchmarkSeries["boardMetadata"] {
  const empty: QualifiedBenchmarkSeries["boardMetadata"] = { status: "unavailable", asOfDate: null, source: null, latestRevisionStart: null, latestIngestedAt: null, unknownVintageCount: null };
  if (!board) return empty;
  const fields = ["as_of_date", "source", "latest_revision_start", "latest_ingested_at", "history_unknown_vintage_count"] as const;
  let invalid = false;
  const date = (value: unknown) => { if (value == null || value === "") return null; if (validDate(value)) return value; invalid = true; return null; };
  const asOfDate = date(board.as_of_date);
  if (asOfDate && validDate(board.latest_date) && board.latest_date > asOfDate) invalid = true;
  let latestRevisionStart = date(board.latest_revision_start);
  if (latestRevisionStart && asOfDate && latestRevisionStart > asOfDate) { invalid = true; latestRevisionStart = null; }
  let source: string | null = null;
  if (board.source != null && board.source !== "") { if (board.source === "fred") source = board.source; else invalid = true; }
  let latestIngestedAt: string | null = null;
  if (board.latest_ingested_at != null && board.latest_ingested_at !== "") {
    const value = board.latest_ingested_at;
    if (typeof value === "string" && validDate(value.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now.getTime()) latestIngestedAt = value;
    else invalid = true;
  }
  let unknownVintageCount: number | null = null;
  if (board.history_unknown_vintage_count != null && board.history_unknown_vintage_count !== "") {
    const value = board.history_unknown_vintage_count;
    if ((typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) && Number.isSafeInteger(Number(value)) && Number(value) >= 0) unknownVintageCount = Number(value);
    else invalid = true;
  }
  const present = fields.filter((field) => Object.prototype.hasOwnProperty.call(board, field)).length;
  return { status: invalid ? "invalid" : !present ? "unavailable" : present < fields.length || [asOfDate, source, latestRevisionStart, latestIngestedAt, unknownVintageCount].some((x) => x === null) ? "partial" : "available", asOfDate, source, latestRevisionStart, latestIngestedAt, unknownVintageCount };
}

/** Qualify all selected rows as one series. An unverified row never becomes an observation. */
export function qualifyBenchmarkSeries(input: {
  definition: BenchmarkDef;
  metadata: BenchmarkMetadata | null;
  rows: BenchmarkEvidenceRow[];
  firstRetainedDate: string | null;
  board: BenchmarkBoard | null;
  repairEvidence: Set<string>;
  now: Date;
}): QualifiedBenchmarkSeries {
  const { definition: def, metadata, rows, firstRetainedDate, board, repairEvidence, now } = input;
  const latest = rows.at(-1);
  const base: QualifiedBenchmarkSeries = {
    id: def.id, label: def.label, short: def.short, category: def.category, displayUnit: def.unit,
    nativeUnit: metadata?.units ?? null, provider: metadata?.source === "fred" ? "FRED" : null,
    sourceUrl: `https://fred.stlouisfed.org/series/${encodeURIComponent(def.id)}`,
    frequency: metadata?.frequency ?? null, status: "unavailable", reason: null, freshness: "unknown",
    firstRetainedDate: validDate(firstRetainedDate) ? firstRetainedDate : null,
    latestRetainedDate: validDate(latest?.date) ? latest.date : null, futureGoldCount: 0, firstFutureGoldDate: null, futureSourceCount: 0, firstFutureSourceDate: null,
    latestWarehouseSourceDate: null, latestWarehouseSourceValue: null, latestWarehouseSourceIngestedAt: null, latestWarehouseSourceEvidence: [], evidenceMethods: [], latestWarehouseSourceStatus: "unavailable",
    observationDate: null, publishedAt: null, ingestedAt: null, providerCheckedAt: null,
    latestProviderDate: null, discontinued: "unknown", boardStatus: "unavailable", boardMetadata: boardMetadata(board, now), observations: [],
  };
  const unavailable = (reason: string) => ({ ...base, reason });
  if (!rows.length) return unavailable("No retained observations.");
  if (!metadata || metadata.source !== "fred" || !metadata.units || !metadata.frequency) return unavailable("Provider, frequency or native unit metadata unavailable.");
  const factor = conversion(def, metadata.units);
  if (factor === null) return unavailable(`Unsupported conversion from ${metadata.units} to ${def.unit}.`);
  let previous = "";
  const today = benchmarkAsOfDate(now);
  const observations: { date: string; value: number }[] = [];
  const methods = new Set<BenchmarkEvidenceMethod>();
  for (const row of rows) {
    const value = number(row.value), source = number(row.source_value), raw = number(row.raw_value);
    if (row.realtime_start && (!validDate(row.realtime_start) || row.realtime_start > today)) return unavailable("Invalid or future provider revision date.");
    if (!validDate(row.date) || row.date <= previous || row.date > today || value === null || source === null || raw === null ||
      row.gold_missing == null || Number(row.gold_missing) !== 0 || row.source_missing == null || Number(row.source_missing) !== 0 ||
      row.source !== "fred" || !row.row_hash || !row.run_id || !row.ingested_at || !Number.isFinite(Date.parse(row.ingested_at)) ||
      !close(value, source) || !close(source, raw)) return unavailable("Invalid, duplicate or unreconciled provider observation.");
    const repaired = repairEvidence.has(benchmarkEvidenceKey(def.id, row.run_id, row.date, row.realtime_start));
    if (row.receipt_endpoint !== "series/observations" && !repaired) return unavailable("Provider response receipt or verified repair capture unavailable.");
    methods.add(row.receipt_endpoint === "series/observations" ? "provider-receipt" : "audited-repair-capture");
    observations.push({ date: row.date, value: value * factor });
    previous = row.date;
  }
  let boardStatus: QualifiedBenchmarkSeries["boardStatus"] = "unavailable";
  if (board && ((validDate(board.latest_date) && board.latest_date > today) || (base.boardMetadata.asOfDate !== null && base.boardMetadata.asOfDate > today))) boardStatus = "future";
  else if (board && validDate(board.latest_date) && number(board.latest_value) !== null) {
    if (base.boardMetadata.status !== "invalid" && base.boardMetadata.asOfDate !== null && board.latest_date <= base.boardMetadata.asOfDate) {
      if (board.latest_date > latest!.date || (board.latest_date === latest!.date && !close(number(board.latest_value)!, number(latest!.value)!))) return unavailable("Benchmark board conflicts with retained history.");
      boardStatus = board.latest_date === latest!.date ? "matched" : "older";
    }
  }
  const thresholds: Record<string, number> = { d: 5, w: 10, m: 45, q: 110, a: 400 };
  const cadence = metadata.frequency.toLowerCase().slice(0, 1);
  const age = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${latest!.date}T00:00:00Z`)) / 86400000);
  const freshness = thresholds[cadence] === undefined ? "unknown" : age <= thresholds[cadence] ? "fresh" : "stale";
  return { ...base, status: "available", reason: null, freshness, boardStatus, observationDate: latest!.date, ingestedAt: latest!.ingested_at, evidenceMethods: [...methods], observations };
}
