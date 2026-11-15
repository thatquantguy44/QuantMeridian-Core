import { describe, expect, it } from "vitest";
import { defOf } from "@/data/benchmarkRates";
import { qualifyBenchmarkSeries, type BenchmarkEvidenceRow } from "./benchmarkQualification";
import { classifyRehearsalBoard, rehearseBenchmarkRefresh, type RefreshCandidate } from "./benchmarkRefreshRehearsal";

const now = new Date("2026-11-11T12:00:00Z");
const metadata = { source: "fred", frequency: "d", units: "Percent" };
function raw(id: string, date: string, value: number, extra: Partial<RefreshCandidate> = {}): RefreshCandidate {
  return { series_id: id, date, value, gold_missing: 0, realtime_start: "", realtime_end: "", source: "fred", source_value: value,
    raw_value: String(value), source_missing: 0, row_hash: "fixture-hash", run_id: `${id}-run`, ingested_at: "2026-11-11T10:00:00Z", receipt_endpoint: null, duplicate_count: 1, ...extra };
}
function base(id: string, value: number) {
  return qualifyBenchmarkSeries({ definition: defOf(id)!, metadata, rows: [{ ...raw(id, "2026-11-09", value), receipt_endpoint: "series/observations" } as BenchmarkEvidenceRow],
    firstRetainedDate: "2026-11-09", board: null, repairEvidence: new Set(), now });
}
function baselineRows(id: string, value: number): RefreshCandidate[] { return [raw(id, "2026-11-09", value)]; }
function receipt(id: string, observations: { date: string; value: string }[]) {
  return { series_id: id, run_id: `${id}-run`, endpoint: "series/observations", response_payload: JSON.stringify({ observations }) };
}

describe("isolated benchmark refresh rehearsal", () => {
  it("stages only source-reconciled past/current observations and quarantines a future date", async () => {
    const result = await rehearseBenchmarkRefresh({ baseline: [base("SOFR", 4.2)], baselineRows: baselineRows("SOFR", 4.2), matchedBaselineIds: new Set(["SOFR"]), revisedIds: new Set(), overflowIds: new Set(), now,
      candidates: [raw("SOFR", "2026-11-10", 4.3), raw("SOFR", "2026-11-12", 4.4)],
      receipts: [receipt("SOFR", [{ date: "2026-11-09", value: "4.2" }, { date: "2026-11-10", value: "4.3" }, { date: "2026-11-12", value: "4.4" }])], repairs: [] });
    expect(result.series[0]).toMatchObject({ id: "SOFR", status: "staged", priorGoldDate: "2026-11-09", latestDate: "2026-11-10", futureExcluded: 1 });
    expect(result.series[0].observations).toEqual([{ date: "2026-11-09", value: 4.2 }, { date: "2026-11-10", value: 4.3 }]);
    expect(result.promotable).toBe(false);
  });
  it("blocks a series when an observation is not in its receipt, without blocking another series", async () => {
    const result = await rehearseBenchmarkRefresh({ baseline: [base("SOFR", 4.2), base("DGS10", 4.8)], baselineRows: [...baselineRows("SOFR", 4.2), ...baselineRows("DGS10", 4.8)], matchedBaselineIds: new Set(["SOFR", "DGS10"]), revisedIds: new Set(), overflowIds: new Set(), now,
      candidates: [raw("SOFR", "2026-11-10", 4.3), raw("DGS10", "2026-11-10", 4.7)], receipts: [receipt("SOFR", [{ date: "2026-11-09", value: "4.2" }, { date: "2026-11-10", value: "9.9" }]), receipt("DGS10", [{ date: "2026-11-09", value: "4.8" }, { date: "2026-11-10", value: "4.7" }])], repairs: [] });
    expect(result.series[0]).toMatchObject({ status: "blocked", observations: [] });
    expect(result.series[1]).toMatchObject({ status: "staged", latestDate: "2026-11-10" });
  });
  it.each(["changed", "revised", "overflow", "duplicate", "invalid-date"])("blocks %s evidence before staging", async (kind) => {
    const result = await rehearseBenchmarkRefresh({ baseline: [base("SOFR", 4.2)], baselineRows: baselineRows("SOFR", 4.2), matchedBaselineIds: new Set(kind === "changed" ? [] : ["SOFR"]), revisedIds: new Set(kind === "revised" ? ["SOFR"] : []), overflowIds: new Set(kind === "overflow" ? ["SOFR"] : []), now,
      candidates: [raw("SOFR", kind === "invalid-date" ? "z-not-a-date" : "2026-11-10", 4.3, kind === "duplicate" ? { duplicate_count: 2 } : {})], receipts: [receipt("SOFR", [{ date: "2026-11-09", value: "4.2" }, { date: "2026-11-10", value: "4.3" }])], repairs: [] });
    expect(result.series[0]).toMatchObject({ status: "blocked", observations: [] });
  });
  it("rechecks baseline evidence in the source snapshot rather than trusting matching Gold values", async () => {
    const result = await rehearseBenchmarkRefresh({ baseline: [base("SOFR", 4.2)], baselineRows: baselineRows("SOFR", 4.2), matchedBaselineIds: new Set(["SOFR"]), revisedIds: new Set(), overflowIds: new Set(), now,
      candidates: [], receipts: [receipt("SOFR", [{ date: "2026-11-09", value: "9.9" }])], repairs: [] });
    expect(result.series[0]).toMatchObject({ status: "blocked", observations: [] });
  });
  it("never stages an unqualified or simulated baseline", async () => {
    const result = await rehearseBenchmarkRefresh({ baseline: [{ ...base("SOFR", 4.2), provider: "synthetic" }], baselineRows: baselineRows("SOFR", 4.2), matchedBaselineIds: new Set(["SOFR"]), revisedIds: new Set(), overflowIds: new Set(), now, candidates: [], receipts: [], repairs: [] });
    expect(result.series[0].status).toBe("blocked");
  });
});

describe("rehearsal options", () => {
  it("requires explicit valid series and a past baseline date", async () => {
    const { parseRehearsalArgs } = await import("./benchmarkRefreshRehearsal");
    expect(parseRehearsalArgs(["--series=SOFR,DGS10", "--baseline-through=2026-10-29"], now)).toMatchObject({ requestedIds: ["SOFR", "DGS10"], historicalDate: "2026-10-29" });
    for (const args of [["--series="], ["--series=SOFR,UNKNOWN"], ["--baseline-through="], ["--baseline-through=2026-02-30"], ["--baseline-through=2026-11-11"], ["--series=SOFR", "--series=DGS10"], ["--unknown"]]) {
      expect(() => parseRehearsalArgs(args, now), args.join(" ")).toThrow();
    }
  });
});


describe("rehearsal board status", () => {
  const board = { as_of_date: "2026-11-11", latest_date: "2026-11-09", latest_value: 4.2 };
  const observed = { date: "2026-11-09", value: 4.2 };
  it("excludes a future board cutoff even when its observation matches", () => {
    expect(classifyRehearsalBoard({ ...board, as_of_date: "2026-11-12" }, observed, 1, "2026-11-11")).toBe("future");
    expect(classifyRehearsalBoard({ ...board, latest_date: "2026-11-12" }, observed, 1, "2026-11-11")).toBe("future");
  });
  it("treats absent or invalid board cutoffs as unavailable", () => {
    for (const as_of_date of [null, "2026-02-30", "not-a-date"]) expect(classifyRehearsalBoard({ ...board, as_of_date }, observed, 1, "2026-11-11")).toBe("unavailable");
    expect(classifyRehearsalBoard(null, observed, 1, "2026-11-11")).toBe("unavailable");
    expect(classifyRehearsalBoard({ ...board, as_of_date: "2026-11-08" }, observed, 1, "2026-11-11")).toBe("unavailable");
  });
  it("compares a valid board to qualified observations in display units", () => {
    expect(classifyRehearsalBoard(board, observed, 1, "2026-11-11")).toBe("matched");
    expect(classifyRehearsalBoard(board, { ...observed, value: 420 }, 100, "2026-11-11")).toBe("matched");
    expect(classifyRehearsalBoard({ ...board, latest_value: 4.3 }, observed, 1, "2026-11-11")).toBe("differs");
    expect(classifyRehearsalBoard({ ...board, latest_value: null }, observed, 1, "2026-11-11")).toBe("unavailable");
  });
});
