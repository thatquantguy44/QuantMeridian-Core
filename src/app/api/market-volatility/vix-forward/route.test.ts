import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET, type VixForwardResponse } from "./route";
import type { SourceRow } from "@/lib/server/vixForwardHistory";

const mocks = vi.hoisted(() => ({ goldEnabled: vi.fn(), raw: vi.fn() }));
vi.mock("@/lib/server/goldStore", () => ({
  goldEnabled: mocks.goldEnabled, goldParam: (index: number) => `$${index}`,
  goldStore: () => ({ raw: mocks.raw }), goldTable: (table: string) => `gold.${table}`, bronzeTable: (table: string) => `bronze.${table}`, silverTable: (table: string) => `silver.${table}`,
}));
const sourceRows = (): SourceRow[] => [
  ["fred", "VIXCLS", "2024-01-02", 13.2], ["fred", "VIXCLS", "2024-01-03", 14.04],
  ["fred", "SP500", "2024-01-02", 4742.83],
  ["tiingo", "SPY:close", "2024-01-02", 100], ["tiingo", "SPY:close", "2024-01-03", 99],
  ["tiingo", "SPY:divCash", "2024-01-02", 0], ["tiingo", "SPY:divCash", "2024-01-03", 2],
  ["tiingo", "SPY:splitFactor", "2024-01-02", 1], ["tiingo", "SPY:splitFactor", "2024-01-03", 1],
].map(([source, series_id, observation_date, value]) => ({ source, series_id, observation_date, value, raw_value: String(value), is_missing: 0, row_hash: "test-receipt", run_id: "unit-test-only", ingested_at: "2024-01-04T00:00:00Z", receipt_run_id: "unit-test-only", receipt_endpoint: source === "fred" ? "series/observations" : "tiingo/daily/spy/prices" })) as SourceRow[];
let evidence: SourceRow[];
async function call(query = ""): Promise<{ res: Response; body: VixForwardResponse }> {
  const res = await GET(new Request(`http://local.test/api/market-volatility/vix-forward${query}`));
  return { res, body: await res.json() };
}
describe("/api/market-volatility/vix-forward", () => {
  beforeEach(() => {
    vi.restoreAllMocks(); mocks.goldEnabled.mockReturnValue(true); evidence = sourceRows();
    mocks.raw.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes("silver.fred_observation")) return evidence.filter((row) => params.includes(row.series_id));
      if (params[0] === "VIXCLS") return [{ date: "2024-01-02", value: 13.2 }, { date: new Date(2024, 0, 3), value: "14.04" }];
      if (params[0] === "SP500") return [{ date: "2024-01-02", value: 4742.83 }];
      if (params[0] === "SPY") return sql.includes("total_return_index AS value")
        ? [{ date: "2024-01-02", value: 100, close: 100, dividend: 0, split_factor: 1 }, { date: "2024-01-03", value: 101, close: 99, dividend: 2, split_factor: 1 }]
        : [{ date: "2024-01-02", value: 100 }, { date: "2024-01-03", value: 99 }];
      return [];
    });
  });
  test("reconciles price history to Tiingo and labels the provider separately from the fund issuer", async () => {
    const { res, body } = await call();
    expect(res.status).toBe(200); expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body.source).toBe("DB"); expect(body.basis).toBe("spy_price");
    expect(body.vix).toEqual([["2024-01-02", 13.2], ["2024-01-03", 14.04]]);
    expect(body.price).toEqual([["2024-01-02", 100], ["2024-01-03", 99]]);
    expect(body.provenance?.price).toMatchObject({ provider: "Tiingo End-of-Day", column: "close", kind: "observed close", verifiedRows: 2 });
    expect(body.citations.find((c) => c.seriesId === "SPY")?.url).toBe("https://www.tiingo.com/documentation/end-of-day");
    expect(body.citations.find((c) => c.seriesId === "SPY_FUND")?.source).toMatch(/not the price-feed provider/);
    expect(mocks.raw.mock.calls.find((c) => c[1][0] === "SPY")?.[0]).toContain("close AS value");
  });
  test("reconstructs reinvested dividends and reconciles the FRED alternative", async () => {
    const total = (await call("?basis=spy_total")).body;
    expect(total.source).toBe("DB"); expect(total.price.at(-1)).toEqual(["2024-01-03", 101]);
    expect(total.provenance?.price.kind).toBe("derived total return");
    expect(total.provenance?.price.sourceSeries).toEqual(["SPY:close", "SPY:divCash", "SPY:splitFactor"]);
    const index = (await call("?basis=sp500_index")).body;
    expect(index.source).toBe("DB"); expect(index.inputs.priceSeriesId).toBe("SP500");
    expect(index.warnings.join(" ")).toMatch(/ten years/);
  });
  test("rejects an unknown basis without querying another series", async () => {
    const { res, body } = await call("?basis=drop%20table");
    expect(res.status).toBe(400); expect(body.source).toBe("ERR"); expect(body.price).toEqual([]); expect(mocks.raw).not.toHaveBeenCalled();
  });
  test("fails closed without a configured database", async () => {
    mocks.goldEnabled.mockReturnValue(false);
    const { res, body } = await call();
    expect(res.status).toBe(503); expect(body.error).toMatch(/MACRO_DB_URL/);
    expect(body.vix).toEqual([]); expect(body.price).toEqual([]); expect(body.provenance).toBeNull(); expect(mocks.raw).not.toHaveBeenCalled();
  });
  test.each(["SPY:divCash", "SPY:splitFactor"])("does not default a missing %s", async (series) => {
    evidence = evidence.filter((row) => row.series_id !== series);
    const { res, body } = await call("?basis=spy_total");
    expect(res.status).toBe(503); expect(body.error).toContain(series);
    expect(body.vix).toEqual([]); expect(body.price).toEqual([]);
  });
  test.each(["synthetic", "unknown", "stooq"])("rejects %s-labelled SPY inputs", async (source) => {
    evidence = evidence.map((row) => row.series_id.startsWith("SPY:") ? { ...row, source } : row);
    const { body } = await call();
    expect(body.source).toBe("ERR"); expect(body.price).toEqual([]); expect(body.vix).toEqual([]);
  });
  test("rejects fabricated values, raw-value mismatches and incomplete receipts", async () => {
    evidence.find((row) => row.series_id === "SPY:close")!.value = 999;
    expect((await call()).body.source).toBe("ERR");
    evidence = sourceRows(); evidence.find((row) => row.series_id === "SPY:close")!.run_id = null;
    expect((await call()).body.error).toMatch(/provider evidence/);
    evidence = sourceRows(); evidence.find((row) => row.series_id === "SPY:divCash" && row.observation_date === "2024-01-03")!.value = 0;
    evidence.find((row) => row.series_id === "SPY:divCash" && row.observation_date === "2024-01-03")!.raw_value = "0";
    expect((await call("?basis=spy_total")).body.error).toMatch(/reconciliation failed/);
  });
  test("returns no partial series and no credentials when a read fails", async () => {
    mocks.raw.mockRejectedValue(new Error("connection refused postgres://secret:password@host"));
    const { res, body } = await call();
    expect(res.status).toBe(503); expect(body.source).toBe("ERR");
    expect(body.error).toMatch(/unavailable/); expect(JSON.stringify(body)).not.toMatch(/secret|password/);
    expect(body.vix).toEqual([]); expect(body.price).toEqual([]); expect(body.provenance).toBeNull();
  });
});
