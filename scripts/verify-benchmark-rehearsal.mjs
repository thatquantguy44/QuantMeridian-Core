/** Independently recheck an isolated benchmark rehearsal; no source or artifact writes. */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import pg from "pg";
import { loadEnv } from "vite";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
function readBounded(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.size > MAX_FILE_BYTES) throw new Error("Invalid or oversized capture");
  return fs.readFileSync(file);
}
function key(...items) { return items.map((item) => item ?? "").join("\u0000"); }
function dateInNewYork(instant) {
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function close(a, b) { return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)); }

async function main() {
  const directory = process.argv[2];
  if (!directory || process.argv.length !== 3) throw new Error("Usage: node scripts/verify-benchmark-rehearsal.mjs REHEARSAL_DIRECTORY");
  const report = JSON.parse(readBounded(path.join(directory, "report.json")));
  if (report.schemaVersion !== "benchmark-refresh-rehearsal/1" || report.promotable !== false || report.asOfTimeZone !== "America/New_York" || report.asOfDate !== dateInNewYork(report.snapshotAt)) throw new Error("Invalid rehearsal metadata");
  const db = new Database(path.join(directory, "rehearsal.sqlite"), { readonly: true, fileMustExist: true });
  let rows, counts, boards;
  try {
    rows = db.prepare(`SELECT o.series_id,o.observation_date,o.display_value,o.display_unit,o.native_unit,o.origin,
      e.method,e.source_run_id,e.ingested_at,e.realtime_start,e.realtime_end,e.raw_value,e.row_hash
      FROM staged_observation o LEFT JOIN staged_evidence e USING(series_id,observation_date) ORDER BY o.series_id,o.observation_date`).all();
    boards = db.prepare("SELECT series_id, previous_gold_date, projected_date, projected_value, display_unit FROM board_projection ORDER BY series_id").all();
    counts = db.prepare(`SELECT (SELECT COUNT(*) FROM staged_observation) AS observations, (SELECT COUNT(*) FROM staged_evidence) AS evidence,
      (SELECT COUNT(*) FROM staged_observation WHERE observation_date > ?) AS future_rows,
      (SELECT COUNT(*) FROM board_projection b LEFT JOIN staged_observation o ON o.series_id=b.series_id AND o.observation_date=b.projected_date
        WHERE o.series_id IS NULL OR o.display_value != b.projected_value OR b.projected_date != (SELECT MAX(observation_date) FROM staged_observation WHERE series_id=b.series_id)) AS board_mismatches`).get(report.asOfDate);
  } finally { db.close(); }
  const env = loadEnv("development", process.cwd(), "");
  const connectionString = process.env.MACRO_DB_URL || env.MACRO_DB_URL;
  if (!connectionString || !/^postgres(?:ql)?:\/\//i.test(connectionString)) throw new Error("A configured PostgreSQL warehouse is required");
  const client = new pg.Client({ connectionString });
  await client.connect();
  let source, receipts, batches;
  try {
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const ids = [...new Set(rows.map((row) => row.series_id))], runs = [...new Set(rows.map((row) => row.source_run_id).filter(Boolean))];
    if (runs.length > 2000) throw new Error("Evidence run limit exceeded");
    source = (await client.query(`WITH wanted AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(series_id text,observation_date text,source_run_id text,realtime_start text))
      SELECT w.series_id,w.observation_date,w.source_run_id,w.realtime_start,s.value,s.raw_value,s.row_hash,s.realtime_end,s.ingested_at,s.is_missing
      FROM wanted w LEFT JOIN silver.fred_observation s ON s.source='fred' AND s.series_id=w.series_id AND s.observation_date=w.observation_date
        AND s.run_id=w.source_run_id AND COALESCE(s.realtime_start,'')=COALESCE(w.realtime_start,'')`, [JSON.stringify(rows)])).rows;
    receipts = runs.length ? (await client.query(`WITH bounded AS (SELECT series_id,run_id,endpoint,response_payload,
      SUM(OCTET_LENGTH(response_payload)) OVER (ORDER BY series_id,run_id ROWS UNBOUNDED PRECEDING) AS total_bytes
      FROM bronze.fred_api_response WHERE source='fred' AND series_id=ANY($1::text[]) AND run_id=ANY($2::text[]) AND OCTET_LENGTH(response_payload) <= 26214400)
      SELECT series_id,run_id,endpoint,response_payload FROM bounded WHERE total_bytes <= 67108864`, [ids, runs])).rows : [];
    batches = runs.length ? (await client.query(`SELECT b.series_id,b.batch_id,b.stage_sha256,b.window_start,b.window_end,b.status,r.manifest_path,r.status AS run_status
      FROM audit.fred_repair_batch b JOIN audit.etl_run r ON r.run_id=b.batch_id WHERE b.series_id=ANY($1::text[]) AND b.batch_id=ANY($2::text[])`, [ids, runs])).rows : [];
    await client.query("ROLLBACK");
  } finally { await client.end(); }
  const indexed = new Map();
  for (const row of source) { const k = key(row.series_id,row.observation_date,row.source_run_id,row.realtime_start); const group = indexed.get(k) ?? []; group.push(row); indexed.set(k, group); }
  const provider = new Map();
  for (const row of receipts) {
    if (row.endpoint !== "series/observations") continue;
    try { const payload = JSON.parse(row.response_payload); if (!Array.isArray(payload.observations)) continue;
      for (const observation of payload.observations) { const k = key(row.series_id,row.run_id,observation.date); const list = provider.get(k) ?? []; list.push(observation); provider.set(k,list); }
    } catch { /* malformed receipts do not qualify */ }
  }
  const captures = new Map();
  for (const batch of batches) {
    try {
      if (batch.status !== "applied" || batch.run_status !== "succeeded" || !path.isAbsolute(batch.manifest_path) || path.basename(batch.manifest_path) !== "manifest.json" || !/^[A-Za-z0-9_]+$/.test(batch.series_id)) continue;
      const manifest = JSON.parse(readBounded(batch.manifest_path)); const entry = manifest.series?.[batch.series_id];
      if (manifest.source !== "fred" || entry?.file !== `${batch.series_id}.json` || entry.sha256 !== batch.stage_sha256) continue;
      const bytes = readBounded(path.join(path.dirname(batch.manifest_path),entry.file));
      if (crypto.createHash("sha256").update(bytes).digest("hex") !== batch.stage_sha256) continue;
      const capture = JSON.parse(bytes);
      if (capture.series_id !== batch.series_id || capture.start !== batch.window_start || capture.end !== batch.window_end || !Array.isArray(capture.rows) || !Array.isArray(capture.payload?.observations)) continue;
      const staged = new Map(); for (const row of capture.rows) { const k=key(row.observation_date,row.realtime_start); if (staged.has(k)) throw new Error("duplicate staged key"); staged.set(k,row); }
      const observations = new Map(); for (const item of capture.payload.observations) { const list=observations.get(item.date)??[];list.push(item);observations.set(item.date,list); }
      captures.set(key(batch.series_id,batch.batch_id),{staged,observations});
    } catch { /* missing or altered captures do not qualify */ }
  }
  let matchedSilver = 0, matchedBronze = 0, matchedRepair = 0;
  for (const row of rows) {
    const matches = indexed.get(key(row.series_id,row.observation_date,row.source_run_id,row.realtime_start)) ?? [];
    const factor = row.display_unit === "bps" && /^percent(?: per annum)?$/i.test(row.native_unit?.trim() ?? "") ? 100 : 1;
    if (matches.length === 1 && close(Number(matches[0].value) * factor,row.display_value) && Number(matches[0].is_missing) === 0 &&
      matches[0].raw_value === row.raw_value && matches[0].row_hash === row.row_hash && matches[0].ingested_at === row.ingested_at && (matches[0].realtime_end ?? "") === (row.realtime_end ?? "")) matchedSilver++;
    const matchesPayload = (observation) => String(observation.value) === row.raw_value && (!row.realtime_start || (observation.realtime_start === row.realtime_start && observation.realtime_end === row.realtime_end));
    if (row.method === "provider-receipt" && (provider.get(key(row.series_id,row.source_run_id,row.observation_date)) ?? []).some(matchesPayload)) matchedBronze++;
    if (row.method === "audited-repair-capture") {
      const capture = captures.get(key(row.series_id,row.source_run_id)); const item = capture?.staged.get(key(row.observation_date,row.realtime_start));
      if (item?.source === "fred" && item.series_id === row.series_id && item.raw_value === row.raw_value && item.row_hash === row.row_hash && item.ingested_at === row.ingested_at &&
        (item.realtime_end ?? "") === (row.realtime_end ?? "") && close(Number(item.value) * factor,row.display_value) && Number(item.is_missing) === 0 && (capture.observations.get(row.observation_date) ?? []).some(matchesPayload)) matchedRepair++;
    }
  }
  const expectedSeries = report.series.filter((item) => item.status === "staged");
  const reportMatches = expectedSeries.length === boards.length && expectedSeries.every((item) => {
    const board = boards.find((row) => row.series_id === item.id);
    const selected = rows.filter((row) => row.series_id === item.id);
    return board && board.previous_gold_date === item.priorGoldDate && board.projected_date === item.projectedDate &&
      close(board.projected_value, item.projectedValue) && board.display_unit === item.displayUnit &&
      selected.length === item.stagedCount && selected.filter((row) => row.origin === "verified_source_append").length === item.addedCount &&
      selected.every((row) => row.native_unit === item.nativeUnit && row.display_unit === item.displayUnit);
  });
  const ok = rows.length > 0 && reportMatches && counts.observations === counts.evidence && counts.observations === rows.length && counts.future_rows === 0 && counts.board_mismatches === 0 && matchedSilver === rows.length && matchedBronze + matchedRepair === rows.length;
  console.log(JSON.stringify({ ok, checkedAt: new Date().toISOString(), asOfDate: report.asOfDate, asOfTimeZone: report.asOfTimeZone,
    observations: rows.length, appended: rows.filter((row) => row.origin === "verified_source_append").length, matchedSilver, matchedBronze, matchedRepair, futureRows: counts.future_rows, boardMismatches: counts.board_mismatches, reportMatches, promotable: false }));
  if (!ok) process.exitCode = 1;
}
main().catch((error) => { console.error(`Rehearsal verification failed: ${error instanceof Error ? error.message : "unknown error"}`); process.exitCode = 1; });
