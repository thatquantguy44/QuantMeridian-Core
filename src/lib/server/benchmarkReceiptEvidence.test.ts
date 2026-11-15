import { expect, it } from "vitest";
import { verifyBenchmarkReceipts } from "./benchmarkReceiptEvidence";
import { benchmarkEvidenceKey, type BenchmarkEvidenceRow } from "./benchmarkQualification";

const row: BenchmarkEvidenceRow & { series_id: string } = { series_id: "SOFR", date: "2026-11-09", value: 4.3,
  gold_missing: 0, realtime_start: "", realtime_end: "", source: "fred", source_value: 4.3,
  raw_value: "4.3", source_missing: 0, row_hash: "fixture", run_id: "run-1", ingested_at: "2026-11-10T12:00:00Z", receipt_endpoint: null };
const receipt = { series_id: "SOFR", run_id: "run-1", endpoint: "series/observations", response_payload: JSON.stringify({ observations: [
  { date: "2026-11-09", value: "4.3", realtime_start: "2026-11-10", realtime_end: "9999-12-31" },
] }) };
it("accepts a captured FRED observation for a current-only series", () => {
  expect(verifyBenchmarkReceipts([receipt], [row]).has(benchmarkEvidenceKey("SOFR", "run-1", row.date, ""))).toBe(true);
});
it("rejects matching run labels when the recorded FRED value differs", () => {
  const altered = { ...row, value: 9, source_value: 9, raw_value: "9" };
  expect(verifyBenchmarkReceipts([receipt], [altered]).size).toBe(0);
});
it("requires matching real-time intervals for a vintage-aware observation", () => {
  const vintage = { ...row, realtime_start: "2026-11-10", realtime_end: "9999-12-31" };
  expect(verifyBenchmarkReceipts([receipt], [vintage]).size).toBe(1);
  expect(verifyBenchmarkReceipts([receipt], [{ ...vintage, realtime_end: "2026-11-11" }]).size).toBe(0);
});
it("rejects a different series, endpoint, missing record, or malformed payload", () => {
  for (const invalid of [{ ...receipt, series_id: "DGS10" }, { ...receipt, endpoint: "synthetic" },
    { ...receipt, response_payload: "not-json" }, { ...receipt, response_payload: '{"observations":[]}' }]) {
    expect(verifyBenchmarkReceipts([invalid], [row]).size).toBe(0);
  }
});
