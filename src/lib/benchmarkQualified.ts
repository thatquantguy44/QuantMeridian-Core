import { BENCHMARK_AS_OF_TIME_ZONE, benchmarkAsOfDate } from "./benchmarkAsOf";
import { BENCHMARK_FRED_IDS, defOf, type BenchmarkCategory, type BenchmarkDef, type BenchmarkUnit, type Obs } from "@/data/benchmarkRates";

export type BenchmarkEvidenceMethod = "provider-receipt" | "audited-repair-capture";

export interface BenchmarkBoardMetadata {
  status: "available" | "partial" | "unavailable" | "invalid";
  asOfDate: string | null;
  source: string | null;
  latestRevisionStart: string | null;
  latestIngestedAt: string | null;
  unknownVintageCount: number | null;
}

/** Each row remains tied to one validated provider history; dates are not timestamps. */
export interface QualifiedBenchmarkSeries {
  id: string;
  label: string;
  short: string;
  category: BenchmarkCategory;
  displayUnit: BenchmarkUnit;
  nativeUnit: string | null;
  provider: string | null;
  sourceUrl: string;
  frequency: string | null;
  status: "available" | "unavailable";
  reason: string | null;
  freshness: "fresh" | "stale" | "unknown";
  firstRetainedDate: string | null;
  latestRetainedDate: string | null;
  futureGoldCount: number;
  firstFutureGoldDate: string | null;
  futureSourceCount: number;
  firstFutureSourceDate: string | null;
  latestWarehouseSourceDate: string | null;
  latestWarehouseSourceValue: number | null;
  latestWarehouseSourceIngestedAt: string | null;
  latestWarehouseSourceEvidence: BenchmarkEvidenceMethod[];
  evidenceMethods: BenchmarkEvidenceMethod[];
  latestWarehouseSourceStatus: "verified" | "unverified" | "unavailable";
  observationDate: string | null;
  publishedAt: null;
  ingestedAt: string | null;
  providerCheckedAt: null;
  latestProviderDate: null;
  discontinued: "unknown";
  boardStatus: "matched" | "older" | "future" | "unavailable";
  boardMetadata: BenchmarkBoardMetadata;
  observations: Obs[];
}
export interface QualifiedBenchmarkResponse {
  source: "DB" | "ERR";
  checkedAt: string;
  asOfDate: string;
  asOfTimeZone: typeof BENCHMARK_AS_OF_TIME_ZONE;
  series: QualifiedBenchmarkSeries[];
  error?: string;
  /** Exclusive upper date for a historical page; omitted for the current snapshot. */
  historyBefore?: string;
}

export function benchmarkValue(def: BenchmarkDef, value: number | null | undefined): string {
  if (value == null) return "—";
  if (def.unit === "bps") return `${value.toFixed(def.decimals)} bps`;
  if (def.unit === "%") return `${value.toFixed(def.decimals)}%`;
  return `${value.toFixed(def.decimals)} ${def.unit}`;
}

/** Changes in percent-denominated rate levels are expressed in basis points. */
export function benchmarkChange(def: BenchmarkDef, value: number | null | undefined): string {
  if (value == null) return "Unavailable";
  if (def.unit === "%") return `${(value * 100).toFixed(1)} bps`;
  if (def.unit === "bps") return `${value.toFixed(1)} bps`;
  return `${value.toFixed(def.decimals)} ${def.unit}`;
}

export function availableBenchmarkMap(series: QualifiedBenchmarkSeries[]): Record<string, Obs[]> {
  return Object.fromEntries(series.filter((item) => item.status === "available" && defOf(item.id)).map((item) => [item.id, item.observations]));
}

/** Reject unfamiliar sources and malformed data; do not reuse cached responses. */
export async function fetchQualifiedBenchmarks(signal?: AbortSignal, page?: { id: string; before: string; limit?: number }): Promise<QualifiedBenchmarkResponse> {
  const query = page ? `?ids=${encodeURIComponent(page.id)}&before=${encodeURIComponent(page.before)}&n=${page.limit ?? 1000}` : "?n=520";
  const response = await fetch(`/api/econ/benchmark/qualified${query}`, { cache: "no-store", signal });
  const body = await response.json() as QualifiedBenchmarkResponse;
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "Benchmark history unavailable.");
  const invalid = () => { throw new Error("Benchmark response has unverified or malformed data."); };
  const validDate = (value: unknown): value is string => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const stamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
  };
  if (!body || !["DB", "ERR"].includes(body.source) || !Array.isArray(body.series) || typeof body.checkedAt !== "string" || !Number.isFinite(Date.parse(body.checkedAt))) return invalid();
  const asOfDate = benchmarkAsOfDate(new Date(body.checkedAt));
  if (body.asOfDate !== asOfDate || body.asOfTimeZone !== BENCHMARK_AS_OF_TIME_ZONE) return invalid();
  if (page && (body.historyBefore !== page.before || body.series.length !== 1 || body.series[0]?.id !== page.id)) return invalid();
  if (!page && body.historyBefore !== undefined) return invalid();
  const seen = new Set<string>();
  for (const series of body.series) {
    const def = defOf(series?.id);
    if (!def || !BENCHMARK_FRED_IDS.includes(series.id) || seen.has(series.id) || series.displayUnit !== def.unit ||
      series.label !== def.label || series.short !== def.short || series.category !== def.category ||
      series.sourceUrl !== `https://fred.stlouisfed.org/series/${encodeURIComponent(series.id)}` ||
      !["available", "unavailable"].includes(series.status) || !["fresh", "stale", "unknown"].includes(series.freshness) ||
      !Array.isArray(series.observations) || !Array.isArray(series.evidenceMethods) || !Array.isArray(series.latestWarehouseSourceEvidence) ||
      [...series.evidenceMethods, ...series.latestWarehouseSourceEvidence].some((method) => !["provider-receipt", "audited-repair-capture"].includes(method)) ||
      !Number.isSafeInteger(series.futureGoldCount) || series.futureGoldCount < 0 ||
      (series.futureGoldCount === 0 ? series.firstFutureGoldDate !== null : (!validDate(series.firstFutureGoldDate) || series.firstFutureGoldDate <= asOfDate)) ||
      !Number.isSafeInteger(series.futureSourceCount) || series.futureSourceCount < 0 ||
      (series.futureSourceCount === 0 ? series.firstFutureSourceDate !== null : (!validDate(series.firstFutureSourceDate) || series.firstFutureSourceDate <= asOfDate)) ||
      !["matched", "older", "future", "unavailable"].includes(series.boardStatus) ||
      !["verified", "unverified", "unavailable"].includes(series.latestWarehouseSourceStatus) ||
      (series.latestWarehouseSourceStatus !== "verified" && (series.latestWarehouseSourceDate !== null || series.latestWarehouseSourceValue !== null || series.latestWarehouseSourceIngestedAt !== null || series.latestWarehouseSourceEvidence.length !== 0)) ||
      (series.latestWarehouseSourceStatus === "verified" && (!validDate(series.latestWarehouseSourceDate) || series.latestWarehouseSourceDate > asOfDate || typeof series.latestWarehouseSourceValue !== "number" || !Number.isFinite(series.latestWarehouseSourceValue) || !series.latestWarehouseSourceIngestedAt || !Number.isFinite(Date.parse(series.latestWarehouseSourceIngestedAt)) || !series.latestWarehouseSourceEvidence.length))) return invalid();
    const board = series.boardMetadata;
    const timestamp = (value: unknown) => typeof value === "string" && validDate(value.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.parse(body.checkedAt);
    if (!board || !["available", "partial", "unavailable", "invalid"].includes(board.status) ||
      (board.asOfDate !== null && !validDate(board.asOfDate)) || (board.source !== null && board.source !== "fred") ||
      (board.latestRevisionStart !== null && (!validDate(board.latestRevisionStart) || (board.asOfDate !== null && board.latestRevisionStart > board.asOfDate))) ||
      (board.latestIngestedAt !== null && !timestamp(board.latestIngestedAt)) ||
      (board.unknownVintageCount !== null && (!Number.isSafeInteger(board.unknownVintageCount) || board.unknownVintageCount < 0)) ||
      (board.status === "available" && Object.values(board).some((value) => value === null)) ||
      (board.status === "unavailable" && Object.entries(board).some(([key, value]) => key !== "status" && value !== null)) ||
      ((series.boardStatus === "matched" || series.boardStatus === "older") && (!board.asOfDate || board.asOfDate > asOfDate)) ||
      (board.asOfDate !== null && board.asOfDate > asOfDate && series.status === "available" && series.boardStatus !== "future")) return invalid();
    seen.add(series.id);
    if (series.status === "unavailable") {
      if (series.observations.length || series.evidenceMethods.length || series.observationDate !== null || typeof series.reason !== "string") return invalid();
      continue;
    }
    if (!series.evidenceMethods.length || series.provider !== "FRED" || !series.nativeUnit || !series.frequency || !series.ingestedAt || !Number.isFinite(Date.parse(series.ingestedAt)) ||
      series.publishedAt !== null || series.providerCheckedAt !== null || series.latestProviderDate !== null || series.reason !== null || !series.observations.length) return invalid();
    let previous = "";
    for (const observation of series.observations) {
      const date = observation?.date;
      if (!validDate(date) || date > asOfDate || date <= previous || typeof observation.value !== "number" || !Number.isFinite(observation.value)) return invalid();
      previous = date;
    }
    if (series.observationDate !== previous || (page ? (!validDate(series.latestRetainedDate) || series.latestRetainedDate < previous || previous >= page.before) : series.latestRetainedDate !== previous)) return invalid();
  }
  if ((body.source === "DB") !== body.series.some((s) => s.status === "available")) return invalid();
  return body;
}
