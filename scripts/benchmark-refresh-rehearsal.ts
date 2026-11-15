/**
 * Read-only source snapshot -> isolated, non-promotable BMRK rehearsal.
 * Run: npx vite-node scripts/benchmark-refresh-rehearsal.ts
 * The source is never mutated. Outputs are created in a fresh private temporary directory.
 */
import { createRequire } from "node:module";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnv } from "vite";
import { GET } from "../src/app/api/econ/benchmark/qualified/route";
import type { QualifiedBenchmarkResponse, QualifiedBenchmarkSeries } from "../src/lib/benchmarkQualified";
import { BENCHMARK_AS_OF_TIME_ZONE, benchmarkAsOfDate } from "../src/lib/benchmarkAsOf";
import { classifyRehearsalBoard, parseRehearsalArgs, rehearseBenchmarkRefresh, type RehearsalBoard, type RefreshCandidate, type RefreshEvidenceRow } from "../src/lib/server/benchmarkRefreshRehearsal";
import type { BenchmarkReceipt } from "../src/lib/server/benchmarkReceiptEvidence";
import type { BenchmarkRepairBatch } from "../src/lib/server/benchmarkRepairEvidence";

const require = createRequire(import.meta.url);
interface ReadOnlyPgClient {
  connect(): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
}
const pg = require("pg") as { Client: new (options: { connectionString: string }) => ReadOnlyPgClient };
const Database = require("better-sqlite3");
const MAX_PER_SERIES = 1000;
const MAX_RUN_IDS = 2000;
const conversion = (series: QualifiedBenchmarkSeries) => series.displayUnit === "bps" && /^percent(?: per annum)?$/i.test(series.nativeUnit?.trim() ?? "") ? 100 : 1;
const close = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

type GoldRow = { series_id: string; date: string; value: string | number; gold_missing: string | number | null; realtime_start: string | null;
  silver_value: string | number | null; silver_start: string | null; silver_end: string | null; silver_source: string | null;
  silver_missing: string | number | null; silver_dupes: string | number | null; silver_raw: string | null; silver_hash: string | null;
  silver_run_id: string | null; silver_ingested_at: string | null };
type CandidateRow = RefreshCandidate & { series_total: string | number };
type Board = RehearsalBoard & { series_id: string };

async function main() {
  const env = loadEnv("development", process.cwd(), "");
  for (const [key, value] of Object.entries(env)) if (process.env[key] === undefined) process.env[key] = value;
  const connectionString = process.env.MACRO_DB_URL ?? "";
  if (!/^postgres(?:ql)?:\/\//i.test(connectionString)) throw new Error("This rehearsal requires the configured PostgreSQL warehouse.");
  const { requestedIds, historicalDate } = parseRehearsalArgs(process.argv.slice(2), new Date());
  const before = historicalDate ? new Date(Date.parse(`${historicalDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10) : null;
  const responses = before ? await Promise.all(requestedIds.map((id) => GET(new Request(`http://local.invalid/api/econ/benchmark/qualified?n=520&ids=${encodeURIComponent(id)}&before=${before}`))))
    : [await GET(new Request(`http://local.invalid/api/econ/benchmark/qualified?n=520&ids=${requestedIds.map(encodeURIComponent).join(",")}`))];
  const bodies = await Promise.all(responses.map(async (response) => ({ ok: response.ok, body: await response.json() as QualifiedBenchmarkResponse })));
  if (bodies.some(({ ok }) => !ok)) throw new Error("Qualified baseline lookup failed.");
  const initial: QualifiedBenchmarkResponse = { source: bodies.some(({ body }) => body.source === "DB") ? "DB" : "ERR", checkedAt: bodies.map(({ body }) => body.checkedAt).sort().at(-1)!, asOfDate: bodies[0].body.asOfDate, asOfTimeZone: BENCHMARK_AS_OF_TIME_ZONE, series: bodies.flatMap(({ body }) => body.series) };
  if (initial.source !== "DB") throw new Error("No independently qualified baseline is available.");
  if (bodies.some(({ body }) => body.asOfDate !== initial.asOfDate || body.asOfTimeZone !== BENCHMARK_AS_OF_TIME_ZONE)) throw new Error("Baseline responses crossed an as-of date boundary.");
  const available = initial.series.filter((row) => row.status === "available" && row.observationDate);
  if (!available.length) throw new Error("No benchmark series qualified.");
  const ids = available.map((row) => row.id);
  const goldDates = available.map((row) => row.observationDate!);
  const client = new pg.Client({ connectionString });
  await client.connect();
  let gold: GoldRow[] = [], candidates: CandidateRow[] = [], receipts: BenchmarkReceipt[] = [], repairs: BenchmarkRepairBatch[] = [], board: Board[] = [];
  let database = "", snapshotAt = "";
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '90s'");
    const identity = await client.query<{ database: string; snapshot_at: string | Date }>("SELECT current_database() AS database, transaction_timestamp() AS snapshot_at");
    database = String(identity.rows[0].database); snapshotAt = new Date(identity.rows[0].snapshot_at).toISOString();
    if (initial.asOfDate !== benchmarkAsOfDate(new Date(snapshotAt))) throw new Error("The baseline and source snapshot have different as-of dates.");
    gold = (await client.query<GoldRow>(`WITH ranked AS (
      SELECT series_id, observation_date, value, is_missing, realtime_start,
        ROW_NUMBER() OVER (PARTITION BY series_id ORDER BY observation_date DESC) AS rn
      FROM gold.fred_latest_observation WHERE series_id=ANY($1::text[]) AND value IS NOT NULL AND observation_date <= $2
    ) SELECT g.series_id, g.observation_date AS date, g.value, g.is_missing AS gold_missing, g.realtime_start,
      s.value AS silver_value, s.realtime_start AS silver_start, s.realtime_end AS silver_end, s.source AS silver_source,
      s.is_missing AS silver_missing, s.raw_value AS silver_raw, s.row_hash AS silver_hash, s.run_id AS silver_run_id,
      s.ingested_at AS silver_ingested_at, s.duplicate_count AS silver_dupes
    FROM ranked g LEFT JOIN LATERAL (
      SELECT value, realtime_start, realtime_end, source, is_missing, raw_value, row_hash, run_id, ingested_at,
        COUNT(*) OVER (PARTITION BY COALESCE(realtime_start, '')) AS duplicate_count
      FROM silver.fred_observation WHERE source='fred' AND series_id=g.series_id AND observation_date=g.observation_date
      ORDER BY COALESCE(realtime_start, '') DESC, ingested_at DESC NULLS LAST, row_hash DESC NULLS LAST LIMIT 1
    ) s ON true WHERE g.rn <= 520 ORDER BY g.series_id, g.observation_date`, [ids, historicalDate ?? benchmarkAsOfDate(new Date(snapshotAt))])).rows;
    candidates = (await client.query<CandidateRow>(`WITH versions AS (
      SELECT s.series_id, s.observation_date AS date, s.value, s.is_missing AS gold_missing, s.realtime_start, s.realtime_end,
        s.source, s.value AS source_value, s.raw_value, s.is_missing AS source_missing, s.row_hash, s.run_id, s.ingested_at,
        COUNT(*) OVER (PARTITION BY s.series_id, s.observation_date, COALESCE(s.realtime_start,'')) AS duplicate_count,
        ROW_NUMBER() OVER (PARTITION BY s.series_id, s.observation_date ORDER BY COALESCE(s.realtime_start,'') DESC, s.ingested_at DESC NULLS LAST, s.row_hash DESC NULLS LAST) AS revision_rank
      FROM silver.fred_observation s JOIN UNNEST($1::text[], $2::text[]) AS b(series_id, after_date) ON b.series_id=s.series_id
      WHERE s.source='fred' AND s.observation_date > b.after_date
    ), latest AS (SELECT *, COUNT(*) OVER (PARTITION BY series_id) AS series_total,
        ROW_NUMBER() OVER (PARTITION BY series_id ORDER BY date) AS item_rank FROM versions WHERE revision_rank=1)
    SELECT * FROM latest WHERE item_rank <= $3 ORDER BY series_id, date`, [ids, goldDates, MAX_PER_SERIES])).rows;
    board = (await client.query<Board>("SELECT b.series_id, b.latest_date, b.latest_value, to_jsonb(b)->>'as_of_date' AS as_of_date FROM gold.benchmark_rate_board b WHERE b.series_id=ANY($1::text[])", [ids])).rows;
    const runIds = [...new Set([...candidates.map((row) => row.run_id), ...gold.map((row) => row.silver_run_id)].filter((id): id is string => !!id))];
    if (runIds.length > MAX_RUN_IDS) throw new Error("Candidate evidence exceeds the bounded run limit.");
    if (runIds.length) {
      const tables = await client.query("SELECT to_regclass('bronze.fred_api_response') AS bronze, to_regclass('audit.fred_repair_batch') AS batches, to_regclass('audit.etl_run') AS runs");
      if (tables.rows[0].bronze) receipts = (await client.query<BenchmarkReceipt>(`WITH bounded AS (
        SELECT series_id, run_id, endpoint, response_payload,
          SUM(OCTET_LENGTH(response_payload)) OVER (ORDER BY series_id, run_id ROWS UNBOUNDED PRECEDING) AS total_bytes
        FROM bronze.fred_api_response WHERE source='fred' AND series_id=ANY($1::text[]) AND run_id=ANY($2::text[])
          AND OCTET_LENGTH(response_payload) <= 26214400
      ) SELECT series_id, run_id, endpoint, response_payload FROM bounded WHERE total_bytes <= 67108864`, [ids, runIds])).rows;
      if (tables.rows[0].batches && tables.rows[0].runs) repairs = (await client.query<BenchmarkRepairBatch>(`SELECT b.batch_id, b.series_id, b.stage_sha256, b.window_start, b.window_end, b.status, r.manifest_path
        FROM audit.fred_repair_batch b JOIN audit.etl_run r ON r.run_id=b.batch_id WHERE b.series_id=ANY($1::text[])
        AND b.batch_id=ANY($2::text[]) AND b.status='applied' AND r.status='succeeded'`, [ids, runIds])).rows;
    }
    await client.query("ROLLBACK");
  } finally { await client.end(); }

  const goldById = new Map<string, GoldRow[]>();
  for (const row of gold) { const group = goldById.get(row.series_id) ?? []; group.push(row); goldById.set(row.series_id, group); }
  const matched = new Set<string>(), revised = new Set<string>(), overflow = new Set<string>();
  for (const base of available) {
    const rows = goldById.get(base.id) ?? [];
    const factor = conversion(base);
    if (rows.length === base.observations.length && rows.every((row, i) => row.date === base.observations[i].date && close(Number(row.value) * factor, base.observations[i].value))) matched.add(base.id);
    if (rows.some((row) => row.silver_value == null || Number(row.silver_missing) !== 0 || Number(row.silver_dupes) !== 1 ||
      (row.realtime_start ?? "") !== (row.silver_start ?? "") || !close(Number(row.value), Number(row.silver_value)))) revised.add(base.id);
  }
  for (const row of candidates) if (Number(row.series_total) > MAX_PER_SERIES) overflow.add(row.series_id);
  const missingCounts = new Map<string, number>();
  const usable = candidates.filter((row) => {
    if (Number(row.source_missing) === 1 && row.source_value == null && row.raw_value === ".") { missingCounts.set(row.series_id, (missingCounts.get(row.series_id) ?? 0) + 1); return false; }
    return true;
  });
  const baselineRows: RefreshEvidenceRow[] = gold.map((row) => ({ series_id: row.series_id, date: row.date, value: row.value,
    gold_missing: row.gold_missing, realtime_start: row.realtime_start, realtime_end: row.silver_end, source: row.silver_source,
    source_value: row.silver_value, raw_value: row.silver_raw, source_missing: row.silver_missing, row_hash: row.silver_hash,
    run_id: row.silver_run_id, ingested_at: row.silver_ingested_at, receipt_endpoint: null }));
  const now = new Date(snapshotAt);
  const result = await rehearseBenchmarkRefresh({ baseline: initial.series, baselineRows, matchedBaselineIds: matched, revisedIds: revised, overflowIds: overflow,
    candidates: usable, receipts, repairs, now });
  const boardById = new Map(board.map((row) => [row.series_id, row]));
  const directory = await mkdtemp(join(tmpdir(), "bmrk-gold-rehearsal-"));
  const databasePath = join(directory, "rehearsal.sqlite");
  const db = new Database(databasePath);
  try {
    db.exec(`CREATE TABLE staged_observation (series_id TEXT NOT NULL, observation_date TEXT NOT NULL, display_value REAL NOT NULL, display_unit TEXT NOT NULL, native_unit TEXT NOT NULL, origin TEXT NOT NULL, PRIMARY KEY(series_id,observation_date));
      CREATE TABLE board_projection (series_id TEXT PRIMARY KEY, previous_gold_date TEXT NOT NULL, projected_date TEXT NOT NULL, projected_value REAL NOT NULL, display_unit TEXT NOT NULL);
      CREATE TABLE staged_evidence (series_id TEXT NOT NULL, observation_date TEXT NOT NULL, method TEXT NOT NULL, source_run_id TEXT NOT NULL, ingested_at TEXT NOT NULL,
        realtime_start TEXT, realtime_end TEXT, raw_value TEXT NOT NULL, row_hash TEXT NOT NULL, PRIMARY KEY(series_id,observation_date));`);
    const insertObs = db.prepare("INSERT INTO staged_observation VALUES (?, ?, ?, ?, ?, ?)");
    const insertBoard = db.prepare("INSERT INTO board_projection VALUES (?, ?, ?, ?, ?)");
    const insertEvidence = db.prepare("INSERT INTO staged_evidence VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    const byId = new Map(initial.series.map((row) => [row.id, row]));
    db.transaction(() => {
      for (const staged of result.series) {
        if (staged.status !== "staged") continue;
        const unit = byId.get(staged.id)!.displayUnit;
        const baseCount = staged.observations.length - staged.addedCount;
        staged.observations.forEach((row, i) => insertObs.run(staged.id, row.date, row.value, unit, byId.get(staged.id)!.nativeUnit, i < baseCount ? "qualified_gold_snapshot" : "verified_source_append"));
        const last = staged.observations.at(-1)!;
        insertBoard.run(staged.id, staged.priorGoldDate, last.date, last.value, unit);
        for (const entry of staged.evidence) insertEvidence.run(staged.id, entry.date, entry.method, entry.runId, entry.ingestedAt, entry.realtimeStart, entry.realtimeEnd, entry.rawValue, entry.rowHash);
      }
    })();
    const mismatches = db.prepare(`SELECT count(*) AS count FROM board_projection b LEFT JOIN staged_observation o
      ON o.series_id=b.series_id AND o.observation_date=b.projected_date WHERE o.series_id IS NULL OR o.display_value != b.projected_value
      OR b.projected_date != (SELECT MAX(observation_date) FROM staged_observation WHERE series_id=b.series_id)`).get().count;
    if (mismatches !== 0) throw new Error("Staged observation / board projection reconciliation failed.");
    const missingEvidence = db.prepare(`SELECT COUNT(*) AS count FROM staged_observation o LEFT JOIN staged_evidence e
      ON e.series_id=o.series_id AND e.observation_date=o.observation_date WHERE e.series_id IS NULL`).get().count;
    if (missingEvidence !== 0) throw new Error("Staged observations are missing snapshot source evidence.");
  } finally { db.close(); }
  const summary = {
    schemaVersion: "benchmark-refresh-rehearsal/1", sourceDatabase: database, snapshotAt, baselineCheckedAt: initial.checkedAt,
    asOfDate: result.asOfDate, asOfTimeZone: BENCHMARK_AS_OF_TIME_ZONE, sourceTransaction: "repeatable read, read only", promotable: false,
    baselineMode: historicalDate ? "latest-revised history truncated for a rehearsal; not point-in-time" : "current qualified snapshot", baselineThrough: historicalDate ?? null,
    scope: "Latest 520 qualified Gold observations per available series plus independently evidenced new observations; display units; board projection contains only latest date and value.",
    limitations: ["No production writes or promotion path.", "No full-history, full-board or cross-module rebuild/parity.", "Provider latest was not checked by this rehearsal.", "A historical Silver revision in the loaded window blocks the affected series."],
    series: result.series.map((entry) => {
      const base = initial.series.find((row) => row.id === entry.id)!;
      const oldBoard = boardById.get(entry.id);
      const boardStatus = classifyRehearsalBoard(oldBoard ?? null, base.observations.at(-1), conversion(base), result.asOfDate);
      return { id: entry.id, status: entry.status, reason: entry.reason, priorGoldDate: entry.priorGoldDate, projectedDate: entry.latestDate,
        projectedValue: entry.observations.at(-1)?.value ?? null, displayUnit: base.displayUnit, nativeUnit: base.nativeUnit, baselineCount: base.observations.length,
        stagedCount: entry.observations.length, addedCount: entry.addedCount, futureExcluded: entry.futureExcluded,
        missingExcluded: missingCounts.get(entry.id) ?? 0, initialBoard: boardStatus, initialBoardAsOfDate: oldBoard?.as_of_date ?? null, evidence: entry.evidence.filter((item) => item.date > (entry.priorGoldDate ?? "")) };
    }),
  };
  await writeFile(join(directory, "report.json"), JSON.stringify(summary, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify({ directory, databasePath, reportPath: join(directory, "report.json"), asOfDate: result.asOfDate, asOfTimeZone: BENCHMARK_AS_OF_TIME_ZONE,
    available: result.series.filter((row) => row.status === "staged").length, blocked: result.series.filter((row) => row.status === "blocked").length,
    appended: result.series.reduce((sum, row) => sum + row.addedCount, 0), futureExcluded: result.series.reduce((sum, row) => sum + row.futureExcluded, 0), promotable: false }));
}
main().catch((error) => { console.error(`Rehearsal failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; });
