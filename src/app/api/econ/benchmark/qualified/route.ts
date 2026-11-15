import { BENCHMARK_AS_OF_TIME_ZONE, benchmarkAsOfDate } from "@/lib/benchmarkAsOf";
import { BENCHMARK_FRED_IDS, defOf } from "@/data/benchmarkRates";
import type { QualifiedBenchmarkResponse } from "@/lib/benchmarkQualified";
import { goldEnabled, goldParam, goldStore, goldTable, silverTable, bronzeTable } from "@/lib/server/goldStore";
import { qualifyBenchmarkSeries, type BenchmarkBoard, type BenchmarkEvidenceRow, type BenchmarkMetadata } from "@/lib/server/benchmarkQualification";
import { verifyBenchmarkRepairEvidence, type BenchmarkRepairBatch } from "@/lib/server/benchmarkRepairEvidence";
import { verifyBenchmarkReceipts, type BenchmarkReceipt } from "@/lib/server/benchmarkReceiptEvidence";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";
type EvidenceRow = BenchmarkEvidenceRow & { series_id: string };
type MetadataRow = BenchmarkMetadata & { series_id: string };
type BoardRow = BenchmarkBoard & { series_id: string };
const layerTable = (layer: "meta" | "audit", table: string) => goldTable(table).replace(/(^|\.)gold([_.])/, `$1${layer}$2`);
// Older deployments may lack individual provenance columns. Retry only for a
// confirmed missing column; connection and permission failures remain errors.
async function readBoard(store: ReturnType<typeof goldStore>, placeholders: string, ids: string[]): Promise<BoardRow[]> {
  const optional = ["as_of_date", "source", "latest_revision_start", "latest_ingested_at", "history_unknown_vintage_count"];
  while (true) {
    try {
      return await store.raw<BoardRow>(`SELECT series_id, latest_date, latest_value${optional.length ? `, ${optional.join(", ")}` : ""} FROM ${goldTable("benchmark_rate_board")} WHERE series_id IN (${placeholders})`, ids);
    } catch (error) {
      const e = error as { code?: string; message?: string };
      const message = typeof e?.message === "string" ? e.message : "";
      const missing = optional.find((name) => (e.code === "42703" && new RegExp(`column ["']?${name}["']? does not exist`, "i").test(message)) || (e.code === "SQLITE_ERROR" && new RegExp(`no such column: (?:\\w+\\.)?${name}(?:$|\\s)`, "i").test(message)));
      if (missing) { optional.splice(optional.indexOf(missing), 1); continue; }
      if (e.code === "42P01" || (e.code === "SQLITE_ERROR" && /no such table:/.test(message))) return [];
      throw error;
    }
  }
}
const send = (body: QualifiedBenchmarkResponse, status = 200) => json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Only Gold observations reconciled to FRED records and ingestion evidence may be returned. */
export async function GET(req: Request) {
  const now = new Date();
  const asOfDate = benchmarkAsOfDate(now);
  const url = new URL(req.url);
  const requested = url.searchParams.has("ids") ? (url.searchParams.get("ids") ?? "").split(",").map((x) => x.trim()) : BENCHMARK_FRED_IDS;
  const ids = [...new Set(requested)];
  const n = Number(url.searchParams.get("n") ?? 520);
  const before = url.searchParams.get("before");
  const validBefore = before === null || (/^\d{4}-\d{2}-\d{2}$/.test(before) && Number.isFinite(Date.parse(`${before}T00:00:00Z`)) && new Date(`${before}T00:00:00Z`).toISOString().slice(0, 10) === before);
  const fail = (error: string, status: number) => send({ source: "ERR", checkedAt: now.toISOString(), asOfDate, asOfTimeZone: BENCHMARK_AS_OF_TIME_ZONE, series: [], error }, status);
  if (!ids.length || ids.some((id) => !BENCHMARK_FRED_IDS.includes(id)) || !Number.isInteger(n) || n < 1 || n > 2000 || !validBefore || (before !== null && ids.length !== 1)) return fail("Unsupported benchmark series or history limit.", 400);
  if (!goldEnabled()) return fail("Benchmark database is not configured.", 503);
  try {
    const store = goldStore();
    const placeholders = ids.map((_, i) => goldParam(i + 1)).join(", ");
    const historyParams = before === null ? [...ids, asOfDate, n] : [...ids, asOfDate, before, n];
    const dateFilter = before === null ? "" : ` AND observation_date < ${goldParam(ids.length + 2)}`;
    const historyLimit = goldParam(ids.length + (before === null ? 2 : 3));
    const [rows, sourceLatest, dimensions, ranges, board, catalog, futureGold, futureSource] = await Promise.all([
      store.raw<EvidenceRow>(`WITH ranked AS (
        SELECT series_id, observation_date, value, is_missing, realtime_start,
          ROW_NUMBER() OVER (PARTITION BY series_id ORDER BY observation_date DESC) AS rn
        FROM ${goldTable("fred_latest_observation")}
        WHERE series_id IN (${placeholders}) AND value IS NOT NULL AND observation_date <= ${goldParam(ids.length + 1)}${dateFilter}
      )
      SELECT g.series_id, g.observation_date AS date, g.value, g.is_missing AS gold_missing, g.realtime_start,
        s.realtime_end, s.source, s.value AS source_value, s.raw_value, s.is_missing AS source_missing,
        s.row_hash, s.run_id, s.ingested_at
      FROM ranked g LEFT JOIN ${silverTable("fred_observation")} s
        ON s.series_id=g.series_id AND s.observation_date=g.observation_date AND s.source='fred'
        AND COALESCE(s.realtime_start, '')=COALESCE(g.realtime_start, '')
      WHERE g.rn <= ${historyLimit} ORDER BY g.series_id, g.observation_date ASC`, historyParams),
      store.raw<EvidenceRow>(`WITH latest_source AS (
        SELECT series_id, observation_date, value, is_missing, realtime_start, realtime_end, source, raw_value, row_hash, run_id, ingested_at,
          ROW_NUMBER() OVER (PARTITION BY series_id ORDER BY observation_date DESC, realtime_start DESC) AS rn
        FROM ${silverTable("fred_observation")} WHERE source='fred' AND series_id IN (${placeholders}) AND value IS NOT NULL AND observation_date <= ${goldParam(ids.length + 1)}
      )
      SELECT series_id, observation_date AS date, value, is_missing AS gold_missing, realtime_start, realtime_end, source,
        value AS source_value, raw_value, is_missing AS source_missing, row_hash, run_id, ingested_at
      FROM latest_source WHERE rn=1`, [...ids, asOfDate]),
      store.raw<MetadataRow>(`SELECT series_id, source, frequency, units FROM ${goldTable("dim_series")} WHERE series_id IN (${placeholders})`, ids),
      store.raw<{ series_id: string; first_date: string; last_date: string }>(`SELECT series_id, MIN(observation_date) AS first_date, MAX(observation_date) AS last_date FROM ${goldTable("fred_latest_observation")} WHERE series_id IN (${placeholders}) AND value IS NOT NULL AND observation_date <= ${goldParam(ids.length + 1)} GROUP BY series_id`, [...ids, asOfDate]),
      readBoard(store, placeholders, ids),
      store.raw<{ series_id: string; frequency: string; units: string }>(`SELECT series_id, frequency, units FROM ${layerTable("meta", "fred_series")} WHERE series_id IN (${placeholders})`, ids).catch(() => []),
      store.raw<{ series_id: string; future_count: string | number; first_future_date: string }>(`SELECT series_id, COUNT(*) AS future_count, MIN(observation_date) AS first_future_date FROM ${goldTable("fred_latest_observation")} WHERE series_id IN (${placeholders}) AND value IS NOT NULL AND observation_date > ${goldParam(ids.length + 1)} /* future_gold */ GROUP BY series_id`, [...ids, asOfDate]),
      store.raw<{ series_id: string; future_count: string | number; first_future_date: string }>(`SELECT series_id, COUNT(DISTINCT observation_date) AS future_count, MIN(observation_date) AS first_future_date FROM ${silverTable("fred_observation")} WHERE source='fred' AND series_id IN (${placeholders}) AND value IS NOT NULL AND observation_date > ${goldParam(ids.length + 1)} /* future_source */ GROUP BY series_id`, [...ids, asOfDate]),
    ]);
    const runIds = [...new Set([...rows, ...sourceLatest].map((row) => row.run_id).filter((run): run is string => !!run))];
    if (runIds.length > 2000) return fail("Evidence history exceeds the supported query limit; request a smaller history.", 503);
    const runPlaceholders = runIds.map((_, i) => goldParam(ids.length + i + 1)).join(", ");
    const [receipts, repairs] = runIds.length ? await Promise.all([
      store.raw<BenchmarkReceipt>(`WITH bounded_receipts AS (
        SELECT series_id, run_id, endpoint, response_payload,
          SUM(LENGTH(response_payload)) OVER (ORDER BY series_id, run_id ROWS UNBOUNDED PRECEDING) AS total_chars
        FROM ${bronzeTable("fred_api_response")}
        WHERE source='fred' AND series_id IN (${placeholders}) AND run_id IN (${runPlaceholders}) AND LENGTH(response_payload) <= 26214400
      ) SELECT series_id, run_id, endpoint, response_payload FROM bounded_receipts WHERE total_chars <= 67108864`, [...ids, ...runIds]).catch(() => []),
      store.raw<BenchmarkRepairBatch>(`SELECT b.batch_id, b.series_id, b.stage_sha256, b.window_start, b.window_end, b.status, r.manifest_path
        FROM ${layerTable("audit", "fred_repair_batch")} b JOIN ${layerTable("audit", "etl_run")} r ON r.run_id=b.batch_id
        WHERE b.series_id IN (${placeholders}) AND b.batch_id IN (${runPlaceholders}) AND b.status='applied' AND r.status='succeeded'`, [...ids, ...runIds]).catch(() => []),
    ]) : [[], []];
    const allRows = [...rows, ...sourceLatest];
    const receiptEvidence = verifyBenchmarkReceipts(receipts, allRows);
    for (const row of allRows) row.receipt_endpoint = row.run_id && receiptEvidence.has([row.series_id, row.run_id, row.date, row.realtime_start ?? ""].join("\u0000")) ? "series/observations" : null;
    const repairEvidence = await verifyBenchmarkRepairEvidence(repairs, allRows);
    const dimensionsById = new Map(dimensions.map((r) => [r.series_id, r]));
    const catalogById = new Map(catalog.map((r) => [r.series_id, r]));
    const firstById = new Map(ranges.map((r) => [r.series_id, r.first_date]));
    const lastById = new Map(ranges.map((r) => [r.series_id, r.last_date]));
    const boardById = new Map(board.map((r) => [r.series_id, r]));
    const sourceLatestById = new Map(sourceLatest.map((r) => [r.series_id, r]));
    const futureById = new Map(futureGold.map((r) => [r.series_id, r]));
    const futureSourceById = new Map(futureSource.map((r) => [r.series_id, r]));
    const rowsById = new Map<string, EvidenceRow[]>();
    for (const row of rows) { const values = rowsById.get(row.series_id) ?? []; values.push(row); rowsById.set(row.series_id, values); }
    const series = ids.map((id) => {
      const fromCatalog = catalogById.get(id);
      const metadata = dimensionsById.get(id) ?? (fromCatalog ? { source: "fred", frequency: fromCatalog.frequency, units: fromCatalog.units } : null);
      const definition = defOf(id)!;
      const qualified = qualifyBenchmarkSeries({ definition, metadata, rows: rowsById.get(id) ?? [], firstRetainedDate: firstById.get(id) ?? null,
        board: before === null ? boardById.get(id) ?? null : null, repairEvidence, now });
      const future = futureById.get(id);
      const futureCount = future ? Number(future.future_count) : 0;
      if (!Number.isSafeInteger(futureCount) || futureCount < 0 || (futureCount > 0 && (!future?.first_future_date || future.first_future_date <= asOfDate))) throw new Error("Invalid future Gold coverage.");
      const laterSource = futureSourceById.get(id);
      const futureSourceCount = laterSource ? Number(laterSource.future_count) : 0;
      if (!Number.isSafeInteger(futureSourceCount) || futureSourceCount < 0 || (futureSourceCount > 0 && (!laterSource?.first_future_date || laterSource.first_future_date <= asOfDate))) throw new Error("Invalid future source coverage.");
      const pageResult = { ...qualified, ...(before !== null ? { latestRetainedDate: lastById.get(id) ?? null } : {}),
        futureGoldCount: futureCount, firstFutureGoldDate: futureCount ? future!.first_future_date : null,
        futureSourceCount, firstFutureSourceDate: futureSourceCount ? laterSource!.first_future_date : null };
      const latestSourceRow = sourceLatestById.get(id);
      if (!latestSourceRow) return pageResult;
      const sourceCheck = qualifyBenchmarkSeries({ definition, metadata, rows: [latestSourceRow], firstRetainedDate: null, board: null, repairEvidence, now });
      return { ...pageResult, latestWarehouseSourceDate: sourceCheck.observationDate, latestWarehouseSourceValue: sourceCheck.observations[0]?.value ?? null,
        latestWarehouseSourceIngestedAt: sourceCheck.ingestedAt, latestWarehouseSourceEvidence: sourceCheck.evidenceMethods,
        latestWarehouseSourceStatus: sourceCheck.status === "available" ? "verified" as const : "unverified" as const };
    });
    return send({ source: series.some((s) => s.status === "available") ? "DB" : "ERR", checkedAt: now.toISOString(), asOfDate, asOfTimeZone: BENCHMARK_AS_OF_TIME_ZONE, series, ...(before !== null ? { historyBefore: before } : {}) });
  } catch (error) {
    console.warn("[benchmark/qualified] Read failed:", error instanceof Error ? error.name : "Unknown failure");
    return fail("Benchmark history or provider evidence is unavailable.", 503);
  }
}
