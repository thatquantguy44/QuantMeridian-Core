/**
 * Restore a missing VIXCLS Bronze receipt from an existing checksummed FRED
 * repair capture. Dry run by default; --apply inserts only the receipt.
 * No provider fetches or changes to Silver/Gold observations.
 * Usage: node scripts/restore-vixr-fred-receipt.mjs --batch-id <id> [--apply]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import pg from "pg";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const batchAt = args.indexOf("--batch-id");
const batchId = batchAt >= 0 ? args[batchAt + 1] : "";
if (!/^[a-f0-9]{32}$/.test(batchId ?? "") || args.some((arg, i) => arg !== "--apply" && arg !== "--batch-id" && i !== batchAt + 1)) {
  throw new Error("Usage: --batch-id <32-character repair batch ID> [--apply]");
}
const apply = args.includes("--apply");
const env = { ...loadEnv("development", root, ""), ...process.env };
const target = new URL(env.MACRO_DB_URL ?? "");
if (!["postgres:", "postgresql:"].includes(target.protocol) || !["localhost", "127.0.0.1"].includes(target.hostname) || target.port !== "55432" || target.pathname !== "/macro_medallion") {
  throw new Error("Receipt restoration is restricted to the local macro_medallion warehouse on port 55432.");
}
function requireThat(condition, message) { if (!condition) throw new Error(message); }
function readJson(file) {
  requireThat(fs.lstatSync(file).isFile(), "Capture must be a regular local file.");
  const bytes = fs.readFileSync(file);
  return { document: JSON.parse(bytes.toString("utf8")), sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
}
const client = new pg.Client({ connectionString: env.MACRO_DB_URL, connectionTimeoutMillis: 10_000, statement_timeout: 20_000 });
await client.connect();
try {
  await client.query("BEGIN");
  const { rows: batches } = await client.query(`SELECT b.*, r.manifest_path FROM audit.fred_repair_batch b JOIN audit.etl_run r ON r.run_id = b.batch_id WHERE b.batch_id=$1 AND b.series_id='VIXCLS' AND b.status='applied' FOR SHARE OF b`, [batchId]);
  requireThat(batches.length === 1, "An applied VIXCLS repair and its capture manifest must exist.");
  const batch = batches[0];
  const manifestFile = path.resolve(batch.manifest_path);
  const manifest = readJson(manifestFile).document;
  const entry = manifest.series?.VIXCLS;
  requireThat(manifest.source === "fred" && entry?.file === "VIXCLS.json", "Manifest must identify the original FRED VIXCLS capture.");
  const captureFile = path.join(path.dirname(manifestFile), entry.file);
  const capture = readJson(captureFile);
  requireThat(capture.sha256 === batch.stage_sha256 && capture.sha256 === entry.sha256, "Capture checksum must match both the repair ledger and staging manifest.");
  const doc = capture.document;
  requireThat(doc.series_id === "VIXCLS" && doc.start === batch.window_start && doc.end === batch.window_end && Number.isFinite(Date.parse(doc.captured_at)), "Capture series, window or timestamp mismatch.");
  requireThat(Array.isArray(doc.rows) && Array.isArray(doc.payload?.observations) && doc.rows.length === Number(batch.rows_inserted) && doc.rows.length === entry.rows, "Capture counts must match the applied repair.");
  const key = (row) => `${row.observation_date ?? row.date}:${row.realtime_start ?? ""}`;
  const staged = new Map(doc.rows.map((row) => [key(row), row]));
  const payload = new Map(doc.payload.observations.map((row) => [key(row), row]));
  requireThat(staged.size === doc.rows.length && payload.size === doc.payload.observations.length, "Duplicate capture observations are not allowed.");
  const { rows: silver } = await client.query("SELECT * FROM silver.fred_observation WHERE source='fred' AND series_id='VIXCLS' AND run_id=$1 ORDER BY observation_date,realtime_start FOR SHARE", [batchId]);
  requireThat(silver.length === staged.size, "Current Silver rows no longer match the staged repair count.");
  const columns = ["source", "series_id", "observation_date", "realtime_start", "realtime_end", "value", "raw_value", "row_hash", "ingested_at"];
  for (const row of silver) {
    const original = staged.get(key(row));
    const observation = payload.get(key(row));
    requireThat(original && observation, "A retained row is missing from the capture.");
    for (const column of columns) requireThat(row[column] === original[column], `Silver differs from the captured ${column}.`);
    requireThat(Number(row.is_missing) === Number(original.is_missing), "Missingness differs from capture.");
    requireThat(Number(row.revision_number) === Number(original.revision_number), "Revision differs from capture.");
    const raw = String(observation.value);
    const value = raw === "." ? null : Number(raw);
    requireThat(raw === row.raw_value && value === row.value && observation.realtime_end === row.realtime_end, "Captured FRED observation differs from the stored value or interval.");
  }
  const { rows: existing } = await client.query("SELECT response_payload FROM bronze.fred_api_response WHERE source='fred' AND series_id='VIXCLS' AND run_id=$1", [batchId]);
  requireThat(existing.length <= 1, "Ambiguous existing Bronze receipts.");
  if (existing.length) requireThat(JSON.stringify(JSON.parse(existing[0].response_payload)) === JSON.stringify(doc.payload), "Existing receipt differs from the original capture.");
  const summary = { mode: apply ? "apply" : "dry-run", batchId, series: "VIXCLS", matchedCapturedRows: silver.length, captureSha256: capture.sha256, captureTime: doc.captured_at, alreadyPresent: existing.length === 1, receiptInserted: false, observationsChanged: 0 };
  if (apply && !existing.length) {
    const responsePayload = JSON.stringify(doc.payload);
    const params = {
      series_id: "VIXCLS", observation_start: doc.start, observation_end: doc.end,
      _receipt_restoration: { source: "original-checksummed-repair-capture", capture_kind: "coalesced-fred-vintage-observations", stage_sha256: capture.sha256, restored_at: new Date().toISOString(), manifest_path: manifestFile },
    };
    await client.query("INSERT INTO bronze.fred_api_response(run_id,source,series_id,endpoint,request_params,response_payload,observation_count,payload_bytes,ingested_at) VALUES($1,'fred','VIXCLS','series/observations',$2,$3,$4,$5,$6)", [batchId, JSON.stringify(params), responsePayload, doc.payload.observations.length, Buffer.byteLength(responsePayload), doc.captured_at]);
    summary.receiptInserted = true;
  }
  await client.query(apply ? "COMMIT" : "ROLLBACK");
  console.log(JSON.stringify(summary));
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
