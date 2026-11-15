import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { verifyBenchmarkRepairEvidence } from "./benchmarkRepairEvidence";
import { benchmarkEvidenceKey, type BenchmarkEvidenceRow } from "./benchmarkQualification";

const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "bmrk-repair-")); dirs.push(dir);
  const row: BenchmarkEvidenceRow & { series_id: string; realtime_end: string } = {
    series_id: "SOFR", date: "2026-11-09", value: 4.2, gold_missing: 0, realtime_start: "2026-11-10", realtime_end: "9999-12-31",
    source: "fred", source_value: 4.2, raw_value: "4.2", source_missing: 0, row_hash: "test-hash", run_id: "repair-1",
    ingested_at: "2026-11-10T12:00:00Z", receipt_endpoint: null,
  };
  const staged = { source: "fred", series_id: row.series_id, observation_date: row.date, realtime_start: row.realtime_start,
    realtime_end: row.realtime_end, value: row.value, raw_value: row.raw_value, is_missing: 0, row_hash: row.row_hash, ingested_at: row.ingested_at };
  const doc = { series_id: row.series_id, start: "2026-01-01", end: "2026-11-10", rows: [staged], payload: { observations: [
    { date: row.date, realtime_start: row.realtime_start, realtime_end: row.realtime_end, value: row.raw_value },
  ] } };
  const capture = JSON.stringify(doc); const hash = createHash("sha256").update(capture).digest("hex");
  writeFileSync(join(dir, "SOFR.json"), capture);
  const manifest = join(dir, "manifest.json"); writeFileSync(manifest, JSON.stringify({ source: "fred", series: { SOFR: { file: "SOFR.json", sha256: hash } } }));
  const batch = { batch_id: "repair-1", series_id: "SOFR", stage_sha256: hash, window_start: doc.start, window_end: doc.end, status: "applied", manifest_path: manifest };
  return { row, batch, dir };
}
it("accepts an applied repair only when the archived capture, ledger and observation agree", async () => {
  const { row, batch } = fixture();
  const proof = await verifyBenchmarkRepairEvidence([batch], [row]);
  expect(proof.has(benchmarkEvidenceKey("SOFR", "repair-1", row.date, row.realtime_start))).toBe(true);
});
it("withholds evidence when the archive was changed or the captured value differs", async () => {
  const { row, batch, dir } = fixture();
  expect((await verifyBenchmarkRepairEvidence([batch], [{ ...row, source_value: 99 }])).size).toBe(0);
  writeFileSync(join(dir, "SOFR.json"), "{}");
  expect((await verifyBenchmarkRepairEvidence([batch], [row])).size).toBe(0);
});
it("does not accept restored, missing or path-substituted captures", async () => {
  const { row, batch } = fixture();
  for (const bad of [{ ...batch, status: "restored" }, { ...batch, manifest_path: "/missing/manifest.json" }, { ...batch, series_id: "../SOFR" }]) {
    expect((await verifyBenchmarkRepairEvidence([bad], [row])).size).toBe(0);
  }
});
