import { beforeEach, expect, it, vi } from "vitest";
import { generateQualifiedBenchmarkPdf } from "./benchmarkPdf";
import { qualifyBenchmarkSeries } from "./server/benchmarkQualification";
import { defOf } from "@/data/benchmarkRates";

const calls = vi.hoisted(() => ({ headers: [] as string[], rows: [] as string[][], tables: [] as { headers: string[]; rows: string[][]; options?: { avoidRowBreak?: boolean } }[], text: "", saved: "" }));
vi.mock("./pdfReport", () => ({ PdfReport: class {
  sectionTitle() {} textBlock(text: string) { calls.text = text; }
  table(headers: string[], rows: string[][], options?: { avoidRowBreak?: boolean }) { calls.headers = headers; calls.rows = rows; calls.tables.push({ headers, rows, options }); }
  save(name: string) { calls.saved = name; }
} }));
const rate = qualifyBenchmarkSeries({ definition: defOf("SOFR")!, metadata: { source: "fred", frequency: "d", units: "Percent" },
  rows: [{ date: "2026-10-23", value: -0.25, gold_missing: 0, realtime_start: "", source: "fred", source_value: -0.25,
    raw_value: "-0.25", source_missing: 0, row_hash: "fixture", run_id: "run", ingested_at: "2026-10-24T12:00:00Z", receipt_endpoint: "series/observations" }],
  firstRetainedDate: "2018-04-03", board: null, repairEvidence: new Set(), now: new Date("2026-11-10T12:00:00Z") });
const series = { ...rate, latestWarehouseSourceDate: "2026-10-26", latestWarehouseSourceValue: -0.5, latestWarehouseSourceIngestedAt: "2026-10-27T12:00:00Z", latestWarehouseSourceEvidence: ["provider-receipt" as const], latestWarehouseSourceStatus: "verified" as const };
beforeEach(() => { calls.headers = []; calls.rows = []; calls.tables = []; calls.text = ""; calls.saved = ""; });
it("exports observed values with their dates, source, loading window and explicit missing states", async () => {
  await generateQualifiedBenchmarkPdf({ series: [series], checkedAt: "2026-11-10T12:00:00Z", category: "ALL" });
  expect(calls.tables[0].headers).toContain("1M change / date");
  expect(calls.tables[0].rows[0]).toContain("Unavailable");
  expect(calls.tables.at(-1)?.options?.avoidRowBreak).toBe(true);
  expect(calls.headers).toContain("Observed"); expect(calls.headers).toContain("Latest warehouse source");
  const sofr = calls.rows.find((r) => r[0] === "SOFR")!;
  expect(sofr).toContain("-0.25%"); expect(sofr).toContain("2026-10-23"); expect(sofr.join(" ")).toContain("2026-10-26"); expect(sofr.join(" ")).toContain("-0.50%");
  expect(sofr.join(" ")).toContain("loaded: 2026-10-23 to 2026-10-23 (1)");
  expect(sofr.join(" ")).toContain("https://fred.stlouisfed.org/series/SOFR");
  const missing = calls.rows.find((r) => r[0] === "DGS10")!;
  expect(missing).toContain("UNAVAILABLE"); expect(missing).toContain("No qualified data");
  expect(calls.text).toMatch(/does not include the separate FRED provider-latest check/);
  expect(calls.saved).toBe("BMRK_qualified_2026-11-10.pdf");
});
it("refuses to generate an export without qualified observations", async () => {
  await expect(generateQualifiedBenchmarkPdf({ series: [], checkedAt: "2026-11-10T12:00:00Z", category: "ALL" })).rejects.toThrow(/No qualified/);
  expect(calls.saved).toBe("");
});
it("does not export an empty category just because another category has data", async () => {
  await expect(generateQualifiedBenchmarkPdf({ series: [series], checkedAt: "2026-11-10T12:00:00Z", category: "Treasury" })).rejects.toThrow(/No qualified/);
  expect(calls.saved).toBe("");
});

it("exports dated calendar changes with rate differences in basis points", async () => {
  const history = { ...series, observationDate: "2026-02-02", latestRetainedDate: "2026-02-02", observations: [{ date: "2026-01-02", value: 1 }, { date: "2026-02-02", value: 1.5 }] };
  await generateQualifiedBenchmarkPdf({ series: [history], checkedAt: "2026-11-10T12:00:00Z", category: "Overnight" });
  expect(calls.tables[0].rows[0]).toContain("50.0 bps / 2026-01-02");
});

it("discloses future Gold, source and board records without treating them as current", async () => {
  const future = { ...series, futureGoldCount: 1, firstFutureGoldDate: "2026-11-11", futureSourceCount: 1, firstFutureSourceDate: "2026-11-11", boardStatus: "future" as const };
  await generateQualifiedBenchmarkPdf({ series: [future], checkedAt: "2026-11-10T12:00:00Z", category: "Overnight" });
  const row = calls.rows.find((entry) => entry[0] === "SOFR")!.join(" ");
  expect(row).toContain("future Gold excluded: 2026-11-11");
  expect(row).toContain("future source excluded: 2026-11-11");
  expect(row).toContain("future board excluded");
});
