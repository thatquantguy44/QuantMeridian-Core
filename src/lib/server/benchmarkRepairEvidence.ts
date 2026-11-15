import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { benchmarkEvidenceKey, type BenchmarkEvidenceRow } from "./benchmarkQualification";

export interface BenchmarkRepairBatch {
  batch_id: string;
  series_id: string;
  stage_sha256: string;
  window_start: string;
  window_end: string;
  status: string;
  manifest_path: string;
}
type RepairRow = BenchmarkEvidenceRow & { series_id: string };
const MAX_CAPTURE_BYTES = 25 * 1024 * 1024;

async function readBounded(path: string): Promise<Buffer> {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.size > MAX_CAPTURE_BYTES) throw new Error("Capture is not a bounded regular file");
  return readFile(path);
}

/** Verify original staged FRED data against the applied repair ledger and retained rows. */
export async function verifyBenchmarkRepairEvidence(batches: BenchmarkRepairBatch[], rows: RepairRow[]): Promise<Set<string>> {
  const result = new Set<string>();
  const groups = new Map<string, RepairRow[]>();
  for (const row of rows) {
    if (!row.run_id || row.receipt_endpoint === "series/observations") continue;
    const key = `${row.series_id}\u0000${row.run_id}`;
    const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
  }
  await Promise.all(batches.map(async (batch) => {
    const group = groups.get(`${batch.series_id}\u0000${batch.batch_id}`);
    if (!group?.length || batch.status !== "applied" || !/^[A-Za-z0-9_]+$/.test(batch.series_id) ||
      !/^[a-f0-9]{64}$/i.test(batch.stage_sha256) || !isAbsolute(batch.manifest_path) || basename(batch.manifest_path) !== "manifest.json") return;
    try {
      const manifest = JSON.parse((await readBounded(batch.manifest_path)).toString("utf8"));
      const entry = manifest.series?.[batch.series_id];
      if (manifest.source !== "fred" || entry?.file !== `${batch.series_id}.json` || entry.sha256 !== batch.stage_sha256) return;
      const bytes = await readBounded(join(dirname(batch.manifest_path), entry.file));
      if (createHash("sha256").update(bytes).digest("hex") !== batch.stage_sha256) return;
      const capture = JSON.parse(bytes.toString("utf8"));
      if (capture.series_id !== batch.series_id || capture.start !== batch.window_start || capture.end !== batch.window_end ||
        !Array.isArray(capture.rows) || !Array.isArray(capture.payload?.observations)) return;
      const key = (date: string, start: string | null) => `${date}\u0000${start ?? ""}`;
      const staged = new Map<string, any>();
      for (const item of capture.rows) {
        const id = key(item.observation_date, item.realtime_start);
        if (staged.has(id)) return;
        staged.set(id, item);
      }
      const observations = new Map<string, any[]>();
      for (const item of capture.payload.observations) {
        const list = observations.get(item.date) ?? []; list.push(item); observations.set(item.date, list);
      }
      for (const row of group) {
        const item = staged.get(key(row.date, row.realtime_start));
        if (!item || item.source !== "fred" || item.series_id !== row.series_id || item.realtime_end !== row.realtime_end ||
          item.value !== row.source_value || item.raw_value !== row.raw_value || Number(item.is_missing) !== Number(row.source_missing) ||
          item.row_hash !== row.row_hash || item.ingested_at !== row.ingested_at) continue;
        const matched = (observations.get(row.date) ?? []).some((observation) =>
          String(observation.value) === String(row.raw_value) &&
          (!row.realtime_start || observation.realtime_start === row.realtime_start) &&
          (!row.realtime_end || !row.realtime_start || observation.realtime_end === row.realtime_end));
        if (matched) result.add(benchmarkEvidenceKey(row.series_id, batch.batch_id, row.date, row.realtime_start));
      }
    } catch {
      // Missing, inaccessible or invalid archives are provenance gaps, never substitute data.
    }
  }));
  return result;
}
