import { afterEach, expect, it, vi } from "vitest";
import { fetchQualifiedBenchmarks } from "./benchmarkQualified";
import { qualifyBenchmarkSeries } from "./server/benchmarkQualification";
import { defOf } from "@/data/benchmarkRates";

const rate = qualifyBenchmarkSeries({ definition: defOf("SOFR")!, metadata: { source: "fred", frequency: "d", units: "Percent" },
  rows: [{ date: "2026-10-23", value: 4.3, gold_missing: 0, realtime_start: "", source: "fred", source_value: 4.3,
    raw_value: "4.3", source_missing: 0, row_hash: "fixture", run_id: "run", ingested_at: "2026-10-24T12:00:00Z", receipt_endpoint: "series/observations" }],
  firstRetainedDate: "2018-04-03", board: null, repairEvidence: new Set(), now: new Date("2026-11-10T12:00:00Z") });
const ok = { source: "DB", checkedAt: "2026-11-10T12:00:00Z", asOfDate: "2026-11-10", asOfTimeZone: "America/New_York", series: [rate] };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => vi.unstubAllGlobals());
it("never reuses a successful response after a connection failure", async () => {
  const fetch = vi.fn().mockResolvedValueOnce(reply(ok)).mockRejectedValueOnce(new Error("offline")); vi.stubGlobal("fetch", fetch);
  expect((await fetchQualifiedBenchmarks()).series[0].observations).toHaveLength(1);
  await expect(fetchQualifiedBenchmarks()).rejects.toThrow("offline");
  expect(fetch).toHaveBeenCalledWith("/api/econ/benchmark/qualified?n=520", expect.objectContaining({ cache: "no-store" }));
});
it.each(["SIM", "SNAPSHOT", "LIVE"])("rejects %s responses with plausible numeric values", async (source) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ ...ok, source })));
  await expect(fetchQualifiedBenchmarks()).rejects.toThrow();
});
it("rejects malformed or unqualified series rather than rendering its values", async () => {
  for (const bad of [
    { ...rate, provider: "synthetic" },
    { ...rate, futureGoldCount: -1 },
    { ...rate, futureGoldCount: 1, firstFutureGoldDate: "2026-11-09" },
    { ...rate, latestWarehouseSourceStatus: "verified", latestWarehouseSourceDate: "2026-11-11", latestWarehouseSourceValue: 4, latestWarehouseSourceIngestedAt: "2026-11-09T12:00:00Z", latestWarehouseSourceEvidence: ["provider-receipt"] },
    { ...rate, observations: [{ date: "2026-11-11", value: 4 }], observationDate: "2026-11-11", latestRetainedDate: "2026-11-11" }, { ...rate, observations: [{ date: "2026-10-23", value: null }] },
    { ...rate, observationDate: "2026-10-24" }, { ...rate, sourceUrl: "https://example.com" },
    { ...rate, latestWarehouseSourceStatus: "verified", latestWarehouseSourceValue: null },
    { ...rate, latestWarehouseSourceStatus: "verified", latestWarehouseSourceEvidence: ["synthetic"] },
    { ...rate, status: "unavailable", observations: [{ date: "2026-10-23", value: 4.3 }] },
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ ...ok, series: [bad] })));
    await expect(fetchQualifiedBenchmarks()).rejects.toThrow();
  }
});
it("rejects populated error responses and malformed JSON", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply({ ...ok, source: "ERR" })).mockResolvedValueOnce(new Response("broken")));
  await expect(fetchQualifiedBenchmarks()).rejects.toThrow();
  await expect(fetchQualifiedBenchmarks()).rejects.toThrow();
});
it("requires an explicitly scoped single-series historical page ending before its requested boundary", async () => {
  const page = { id: "SOFR", before: "2026-10-24", limit: 1000 };
  const older = { ...rate, latestRetainedDate: "2026-10-26" };
  const body = { ...ok, historyBefore: page.before, series: [older] };
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply(body)).mockResolvedValueOnce(reply({ ...body, historyBefore: "2026-10-25" })).mockResolvedValueOnce(reply({ ...body, series: [{ ...older, observations: [{ date: page.before, value: 4 }], observationDate: page.before }] })));
  await expect(fetchQualifiedBenchmarks(undefined, page)).resolves.toMatchObject({ historyBefore: page.before });
  await expect(fetchQualifiedBenchmarks(undefined, page)).rejects.toThrow();
  await expect(fetchQualifiedBenchmarks(undefined, page)).rejects.toThrow();
});

it("rejects an as-of date or timezone that does not match the response timestamp", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply({ ...ok, asOfDate: "2026-11-11" })).mockResolvedValueOnce(reply({ ...ok, asOfTimeZone: "UTC" })));
  await expect(fetchQualifiedBenchmarks()).rejects.toThrow();
  await expect(fetchQualifiedBenchmarks()).rejects.toThrow();
});


it("rejects fabricated, malformed, and undisclosed future board metadata", async () => {
  const base = { status: "available", asOfDate: "2026-11-10", source: "fred", latestRevisionStart: "2026-10-23", latestIngestedAt: "2026-10-24T12:00:00Z", unknownVintageCount: 0 };
  for (const boardMetadata of [{ ...base, source: "synthetic" }, { ...base, unknownVintageCount: -1 }, { ...base, latestIngestedAt: "2026-02-30T12:00:00Z" }, { ...base, asOfDate: "2026-11-11" }, { ...base, latestRevisionStart: "2026-11-11" }]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ ...ok, series: [{ ...rate, boardStatus: "matched", boardMetadata }] })));
    await expect(fetchQualifiedBenchmarks()).rejects.toThrow();
  }
});
