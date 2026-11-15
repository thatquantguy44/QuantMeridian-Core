import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
const mocks = vi.hoisted(() => ({ enabled: vi.fn(), raw: vi.fn() }));
vi.mock("@/lib/server/goldStore", () => ({
  goldEnabled: mocks.enabled, goldStore: () => ({ raw: mocks.raw }), goldParam: (i: number) => `$${i}`,
  goldTable: (table: string) => `gold.${table}`, silverTable: (table: string) => `silver.${table}`, bronzeTable: (table: string) => `bronze.${table}`,
}));
vi.mock("@/lib/server/benchmarkRepairEvidence", () => ({ verifyBenchmarkRepairEvidence: async () => new Set() }));
const observation = (series_id: string, value: number) => ({ series_id, date: "2026-10-23", value, gold_missing: 0, realtime_start: "", realtime_end: "",
  source: "fred", source_value: value, raw_value: String(value), source_missing: 0, row_hash: "fixture", run_id: `${series_id}-run`, ingested_at: "2026-10-24T10:00:00Z" });
async function request(query = "?ids=SOFR,DGS10") {
  const response = await GET(new Request(`http://local.test/api/econ/benchmark/qualified${query}`));
  return { response, body: await response.json() };
}
describe("qualified benchmark route", () => {
  beforeEach(() => {
    mocks.raw.mockReset();
    mocks.enabled.mockReturnValue(true);
    mocks.raw.mockImplementation(async (sql: string) => {
      if (sql.includes("WITH ranked")) return [observation("SOFR", 4.3), observation("DGS10", 4.1)];
      if (sql.includes("WITH latest_source")) return [{ ...observation("SOFR", 4.4), date: "2026-10-26" }, observation("DGS10", 4.1)];
      if (sql.includes("gold.dim_series")) return ["SOFR", "DGS10"].map((series_id) => ({ series_id, source: "fred", frequency: "d", units: "Percent" }));
      if (sql.includes("future_gold") || sql.includes("future_source")) return [];
      if (sql.includes("MIN(observation_date)")) return ["SOFR", "DGS10"].map((series_id) => ({ series_id, first_date: "2018-04-03", last_date: "2026-10-26" }));
      if (sql.includes("gold.benchmark_rate_board")) return [];
      if (sql.includes("bronze.fred_api_response")) return ["SOFR", "DGS10"].map((series_id) => ({ series_id, run_id: `${series_id}-run`, endpoint: "series/observations", response_payload: JSON.stringify({ observations: series_id === "SOFR" ? [{ date: "2026-10-23", value: "4.3" }, { date: "2026-10-26", value: "4.4" }] : [{ date: "2026-10-23", value: "4.1" }] }) }));
      return [];
    });
  });
  it("serves per-series validated observations and distinct source dates", async () => {
    const { response, body } = await request();
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.series).toHaveLength(2);
    expect(body.series[0]).toMatchObject({ id: "SOFR", status: "available", observationDate: "2026-10-23", publishedAt: null, latestProviderDate: null });
    expect(body.series[0].observations).toEqual([{ date: "2026-10-23", value: 4.3 }]);
    expect(body.series[0]).toMatchObject({ latestWarehouseSourceDate: "2026-10-26", latestWarehouseSourceValue: 4.4, latestWarehouseSourceIngestedAt: "2026-10-24T10:00:00Z", latestWarehouseSourceEvidence: ["provider-receipt"], latestWarehouseSourceStatus: "verified" });
  });
  it("leaves a series unavailable without its provider evidence while retaining independent data", async () => {
    const handler = mocks.raw.getMockImplementation()!;
    mocks.raw.mockImplementation(async (sql: string) => sql.includes("bronze.fred_api_response")
      ? [{ series_id: "SOFR", run_id: "SOFR-run", endpoint: "series/observations", response_payload: JSON.stringify({ observations: [{ date: "2026-10-23", value: "4.3" }, { date: "2026-10-26", value: "4.4" }] }) }] : handler(sql));
    const { body } = await request();
    expect(body.series[0].status).toBe("available");
    expect(body.series[1].status).toBe("unavailable"); expect(body.series[1].observations).toEqual([]);
  });
  it("keeps qualified Gold history while withholding an unverified newer source record", async () => {
    const handler = mocks.raw.getMockImplementation()!;
    mocks.raw.mockImplementation(async (sql: string) => sql.includes("bronze.fred_api_response")
      ? [{ series_id: "SOFR", run_id: "SOFR-run", endpoint: "series/observations", response_payload: JSON.stringify({ observations: [{ date: "2026-10-23", value: "4.3" }] }) }] : handler(sql));
    const { body } = await request();
    expect(body.series[0]).toMatchObject({ status: "available", observationDate: "2026-10-23", latestWarehouseSourceStatus: "unverified", latestWarehouseSourceValue: null, latestWarehouseSourceDate: null });
  });
  it("limits Gold and latest source to the as-of date and discloses future Gold records", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-10T12:00:00Z"));
    try {
      const handler = mocks.raw.getMockImplementation()!;
      mocks.raw.mockImplementation(async (sql: string) => sql.includes("future_gold") || sql.includes("future_source") ? [{ series_id: "SOFR", future_count: "1", first_future_date: "2026-11-11" }]
        : sql.includes("gold.benchmark_rate_board") ? [{ series_id: "SOFR", latest_date: "2026-11-11", latest_value: 4.9 }] : handler(sql));
      const { body } = await request("?ids=SOFR");
      expect(body.series[0]).toMatchObject({ status: "available", observationDate: "2026-10-23", futureGoldCount: 1, firstFutureGoldDate: "2026-11-11", futureSourceCount: 1, firstFutureSourceDate: "2026-11-11", boardStatus: "future" });
      const ranked = mocks.raw.mock.calls.find(([sql]) => sql.includes("WITH ranked"));
      const source = mocks.raw.mock.calls.find(([sql]) => sql.includes("WITH latest_source"));
      expect(ranked?.[0]).toContain("observation_date <= $2"); expect(ranked?.[1]).toEqual(["SOFR", "2026-11-10", 520]);
      expect(source?.[0]).toContain("observation_date <= $2"); expect(source?.[1]).toEqual(["SOFR", "2026-11-10"]);
    } finally { vi.useRealTimers(); }
  });
  it("uses the New York as-of date when UTC has already rolled into the next day", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T00:30:00Z"));
    try {
      const { body } = await request("?ids=SOFR");
      expect(body).toMatchObject({ asOfDate: "2026-11-10", asOfTimeZone: "America/New_York" });
      const ranked = mocks.raw.mock.calls.find(([sql]) => sql.includes("WITH ranked"));
      expect(ranked?.[1]).toEqual(["SOFR", "2026-11-10", 520]);
    } finally { vi.useRealTimers(); }
  });
  it("bounds historical pages by date and does not compare them to the current board", async () => {
    const handler = mocks.raw.getMockImplementation()!;
    mocks.raw.mockImplementation(async (sql: string) => sql.includes("gold.benchmark_rate_board") ? [{ series_id: "SOFR", latest_date: "2026-10-30", latest_value: 4.9 }] : handler(sql));
    const { response, body } = await request("?ids=SOFR&before=2026-10-25&n=100");
    expect(response.status).toBe(200);
    expect(body.series[0]).toMatchObject({ status: "available", observationDate: "2026-10-23", latestRetainedDate: "2026-10-26" });
    expect(body.historyBefore).toBe("2026-10-25");
    const query = mocks.raw.mock.calls.find(([sql]) => sql.includes("WITH ranked"));
    expect(query?.[0]).toContain("observation_date < $3");
    expect(query?.[1][0]).toBe("SOFR"); expect(query?.[1][2]).toBe("2026-10-25"); expect(query?.[1][3]).toBe(100);
    expect((await request("?ids=SOFR&before=2026-02-30")).response.status).toBe(400);
    expect((await request("?ids=SOFR,DGS10&before=2026-10-25")).response.status).toBe(400);
  });
  it("rejects unknown IDs and does not accept a SIM override", async () => {
    expect((await request("?ids=SOFR,UNKNOWN&sim=1")).response.status).toBe(400);
    mocks.enabled.mockReturnValue(false);
    const { body } = await request("?ids=SOFR&sim=1");
    expect(body.source).toBe("ERR"); expect(body.series).toEqual([]);
  });
  it("returns no observations when a connection fails", async () => {
    const exampleConnectionError = ["postgres://sensitive", "credential@host"].join(":");
    mocks.raw.mockRejectedValue(new Error(exampleConnectionError));
    const { response, body } = await request();
    expect(response.status).toBe(503); expect(body.source).toBe("ERR"); expect(body.series).toEqual([]);
    expect(JSON.stringify(body)).not.toMatch(/sensitive|credential/);
  });

it("reads provenance and falls back only for columns missing in an older warehouse", async () => {
  const original = mocks.raw.getMockImplementation()!;
  mocks.raw.mockImplementation(async (sql: string) => {
    if (!sql.includes("gold.benchmark_rate_board")) return original(sql);
    if (sql.includes("latest_revision_start")) throw Object.assign(new Error('column "latest_revision_start" does not exist'), { code: "42703" });
    return [{ series_id: "SOFR", latest_date: "2026-10-23", latest_value: 4.3, as_of_date: "2026-10-23", source: "fred", latest_ingested_at: "2026-10-24T10:00:00Z", history_unknown_vintage_count: 0 }];
  });
  const { response, body } = await request("?ids=SOFR");
  expect(response.status).toBe(200);
  expect(body.series[0]).toMatchObject({ status: "available", boardStatus: "matched", boardMetadata: { status: "partial", latestRevisionStart: null, unknownVintageCount: 0 } });
});

it("does not disguise a board connection or permission error as an old schema", async () => {
  const original = mocks.raw.getMockImplementation()!;
  mocks.raw.mockImplementation(async (sql: string) => { if (sql.includes("gold.benchmark_rate_board")) throw Object.assign(new Error("permission denied"), { code: "42501" }); return original(sql); });
  expect((await request("?ids=SOFR")).response.status).toBe(503);
});
});
