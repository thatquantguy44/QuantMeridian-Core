import { describe, expect, it, vi } from "vitest";
import { readCatalogReferences } from "./catalogReferenceReader";

const ids = ["SPY", "AGG"] as const;
const at = "2026-11-12T16:00:00Z";
const series = ids.map((seriesId) => ({ seriesId, title: "Fictional test fund", units: "USD", frequency: "d", category: "equity", active: "1", downstreamUseCase: "equity_total_return", updatedAt: "2026-11-11T03:00:00Z" }));
const mappings = ids.map((seriesId) => ({ seriesId, manifestName: "equity_tiingo", updatedAt: "2026-11-11T04:00:00Z" }));

describe("read-only PORA catalog reference capture", () => {
  it("reads only selected catalog rows and binds their local timestamps", async () => {
    const query = vi.fn(async (sql: string) => ({ rows: sql.includes("FROM meta.fred_series_manifest_map") ? mappings : sql.includes("FROM meta.fred_series") ? series : [] }));
    const refs = await readCatalogReferences({ query }, [...ids], () => at);
    expect(refs.get("SPY")).toMatchObject({ status: "REPORTED", unitLabel: "USD", tradingCurrency: null, stableId: null });
    expect(refs.get("AGG")).toMatchObject({ status: "REPORTED", manifestName: "equity_tiingo" });
    expect(query.mock.calls.map(([sql]) => sql)).toContain("SAVEPOINT pora_catalog_reference");
    expect(query.mock.calls.map(([sql]) => sql)).toContain("RELEASE SAVEPOINT pora_catalog_reference");
  });
  it("exposes a catalog query failure as unavailable after rolling back the savepoint", async () => {
    const query = vi.fn(async (sql: string) => { if (sql.includes("FROM meta.fred_series")) throw new Error("sensitive database detail"); return { rows: [] }; });
    const refs = await readCatalogReferences({ query }, [...ids], () => at);
    expect(refs.get("SPY")).toMatchObject({ status: "UNAVAILABLE", reason: "CATALOG_READ_FAILED", unitLabel: null });
    expect(JSON.stringify([...refs])).not.toContain("sensitive database detail");
    expect(query.mock.calls.map(([sql]) => sql)).toContain("ROLLBACK TO SAVEPOINT pora_catalog_reference");
  });
  it("does not mask a failure to restore the transaction", async () => {
    const query = vi.fn(async (sql: string) => { if (sql.includes("FROM meta.fred_series") || sql.startsWith("ROLLBACK TO")) throw new Error("database disconnected"); return { rows: [] }; });
    await expect(readCatalogReferences({ query }, [...ids], () => at)).rejects.toThrow();
  });
  it("fails closed when the bounded catalog query contains excess rows", async () => {
    const query = vi.fn(async (sql: string) => ({ rows: sql.includes("FROM meta.fred_series_manifest_map") ? mappings : sql.includes("FROM meta.fred_series") ? [...series, series[0]] : [] }));
    const refs = await readCatalogReferences({ query }, [...ids], () => at);
    expect(refs.get("SPY")).toMatchObject({ status: "CONFLICT", reason: "AMBIGUOUS_CATALOG_ROWS" });
    expect(refs.get("AGG")).toMatchObject({ status: "CONFLICT", reason: "AMBIGUOUS_CATALOG_ROWS" });
  });
});
