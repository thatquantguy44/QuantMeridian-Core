import { describe, expect, it } from "vitest";
import { qualifyBenchmarkSeries, type BenchmarkEvidenceRow } from "./benchmarkQualification";
import { defOf } from "@/data/benchmarkRates";

const now = new Date("2026-11-10T12:00:00Z");
const meta = { source: "fred", frequency: "d", units: "Percent" };
function row(date: string, value: number, overrides: Partial<BenchmarkEvidenceRow> = {}): BenchmarkEvidenceRow {
  return { date, value, gold_missing: 0, realtime_start: "", source: "fred", source_value: value,
    raw_value: String(value), source_missing: 0, row_hash: "fixture-hash", run_id: "fixture-run",
    ingested_at: "2026-11-10T10:00:00Z", receipt_endpoint: "series/observations", ...overrides };
}
function qualify(id: string, rows: BenchmarkEvidenceRow[], overrides: Record<string, unknown> = {}) {
  return qualifyBenchmarkSeries({ definition: defOf(id)!, metadata: meta, rows, firstRetainedDate: rows[0]?.date ?? null,
    board: null, repairEvidence: new Set<string>(), now, ...overrides });
}
describe("qualified benchmark observations", () => {
  it("retains genuine negative and zero values and exposes distinct dates", () => {
    const result = qualify("SOFR", [row("2026-11-06", -0.25), row("2026-11-09", 0)]);
    expect(result.status).toBe("available");
    expect(result.evidenceMethods).toEqual(["provider-receipt"]);
    expect(result.observations).toEqual([{ date: "2026-11-06", value: -0.25 }, { date: "2026-11-09", value: 0 }]);
    expect(result).toMatchObject({ observationDate: "2026-11-09", firstRetainedDate: "2026-11-06", publishedAt: null,
      ingestedAt: "2026-11-10T10:00:00Z", providerCheckedAt: null, latestProviderDate: null, freshness: "fresh" });
  });
  it("converts FRED OAS percentages to display basis points", () => {
    const result = qualify("BAMLC0A0CM", [row("2026-11-09", 0.85)]);
    expect(result.status).toBe("available");
    expect(result.observations[0].value).toBeCloseTo(85);
    expect(result).toMatchObject({ nativeUnit: "Percent", displayUnit: "bps" });
  });
  it.each([
    { source: "synthetic" }, { receipt_endpoint: null }, { raw_value: "1.23" }, { source_value: 99 },
    { row_hash: null }, { run_id: null }, { source_missing: 1 }, { ingested_at: null },
  ])("withholds an entire series if a selected observation is unverified: %o", (bad) => {
    const result = qualify("SOFR", [row("2026-11-06", 4.2), row("2026-11-09", 4.3, bad)]);
    expect(result.status).toBe("unavailable"); expect(result.observations).toEqual([]);
    expect(result.reason).toBeTruthy();
  });
  it("accepts separately verified repair captures and refuses an unverified repair", () => {
    const repaired = row("2026-11-09", 4.3, { receipt_endpoint: null, run_id: "repair" });
    expect(qualify("SOFR", [repaired]).status).toBe("unavailable");
    const evidence = new Set(["SOFR\u0000repair\u00002026-11-09\u0000"]);
    const result = qualify("SOFR", [repaired], { repairEvidence: evidence });
    expect(result.status).toBe("available");
    expect(result.evidenceMethods).toEqual(["audited-repair-capture"]);
  });
  it("does not classify missing metadata or incompatible units as a real rate", () => {
    expect(qualify("SOFR", [row("2026-11-09", 4.2)], { metadata: null }).status).toBe("unavailable");
    expect(qualify("SOFR", [row("2026-11-09", 4.2)], { metadata: { ...meta, units: "Index" } }).status).toBe("unavailable");
  });
  it("rejects duplicate, invalid and future dates rather than filling them", () => {
    for (const rows of [[row("2026-11-09", 1), row("2026-11-09", 2)], [row("2026-02-30", 1)], [row("2026-11-11", 1)]]) {
      expect(qualify("SOFR", rows).status).toBe("unavailable");
    }
  });
  it("rejects an observation whose provider revision is not yet effective in New York", () => {
    const result = qualify("SOFR", [row("2026-11-09", 4.2, { realtime_start: "2026-11-11" })], { now: new Date("2026-11-11T00:30:00Z") });
    expect(result.status).toBe("unavailable");
    expect(result.reason).toMatch(/revision date/i);
  });
  it("retains qualified as-of history when the separate board is future-dated", () => {
    const result = qualify("SOFR", [row("2026-11-09", 4.2)], { board: { latest_date: "2026-11-11", latest_value: 4.3 } });
    expect(result).toMatchObject({ status: "available", observationDate: "2026-11-09", boardStatus: "future" });
  });
  it("distinguishes sparse weekly freshness and detects a conflicting current board value", () => {
    const weekly = qualify("MORTGAGE30US", [row("2026-11-02", 6)], { metadata: { ...meta, frequency: "w" } });
    expect(weekly.freshness).toBe("fresh");
    const stale = qualify("SOFR", [row("2026-10-20", 4)]);
    expect(stale.freshness).toBe("stale");
    const conflict = qualify("SOFR", [row("2026-11-09", 4)], { board: { latest_date: "2026-11-09", latest_value: 8, as_of_date: "2026-11-10" } });
    expect(conflict.status).toBe("unavailable");
    expect(conflict.reason).toMatch(/board/i);
  });
});


describe("benchmark board provenance", () => {
  const board = { latest_date: "2026-11-09", latest_value: 4.2, as_of_date: "2026-11-10", source: "fred", latest_revision_start: "2026-11-09", latest_ingested_at: "2026-11-10T10:00:00Z", history_unknown_vintage_count: "0" };
  it("exposes board metadata without confusing warehouse capture with publication", () => {
    expect(qualify("SOFR", [row("2026-11-09", 4.2)], { board })).toMatchObject({ status: "available", boardStatus: "matched", publishedAt: null, boardMetadata: { status: "available", asOfDate: "2026-11-10", source: "fred", latestRevisionStart: "2026-11-09", latestIngestedAt: "2026-11-10T10:00:00Z", unknownVintageCount: 0 } });
  });
  it("excludes a future as-of board even when its observation is not future-dated", () => {
    expect(qualify("SOFR", [row("2026-11-09", 4.2)], { board: { ...board, as_of_date: "2026-11-11" } })).toMatchObject({ status: "available", boardStatus: "future", boardMetadata: { asOfDate: "2026-11-11" } });
  });
  it("never treats a board claiming a synthetic source as a matched provider board", () => {
    expect(qualify("SOFR", [row("2026-11-09", 4.2)], { board: { ...board, source: "synthetic" } })).toMatchObject({ status: "available", boardStatus: "unavailable", boardMetadata: { status: "invalid", source: null } });
  });
  it("treats absent and malformed metadata as unknown without discarding qualified observations", () => {
    expect(qualify("SOFR", [row("2026-11-09", 4.2)], { board: { latest_date: "2026-11-09", latest_value: 4.2 } })).toMatchObject({ status: "available", boardStatus: "unavailable", boardMetadata: { status: "unavailable", asOfDate: null } });
    expect(qualify("SOFR", [row("2026-11-09", 4.2)], { board: { ...board, latest_revision_start: "2026-02-30", latest_ingested_at: "yesterday", history_unknown_vintage_count: -1 } })).toMatchObject({ status: "available", boardMetadata: { status: "invalid", latestRevisionStart: null, latestIngestedAt: null, unknownVintageCount: null } });
  });
});
