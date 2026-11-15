import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMultiAssetPreview, multiAssetCsv } from "./multiAssetClient";

const dates = Array.from({ length: 253 }, (_, i) => new Date(Date.UTC(2024, 0, 2 + i)).toISOString().slice(0, 10));
function fixture() {
  const returns = dates.slice(1).map((date) => ({ date, value: 0.001 }));
  return { source: "DB", asOfDate: "2026-11-12", checkedAt: "2026-11-12T16:00:00.000Z", firstDate: dates[0], lastDate: dates.at(-1), sessionCount: 253, returnCount: 252,
    assets: ["SPY", "AGG"].map((id) => ({ id, latestDate: dates.at(-1), futureCount: 0, lastIngestedAt: "2026-11-11T00:00:00Z", totalChange: Math.pow(1.001, 252) - 1, returns })) };
}
afterEach(() => vi.unstubAllGlobals());
describe("PORA multi-asset client boundary", () => {
  it("uses an uncached explicit selection and exports aligned evidence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture()))));
    const result = await fetchMultiAssetPreview(["SPY", "AGG"]);
    expect(result.assets).toHaveLength(2);
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/portfolio-regime/source-check?ids=SPY%2CAGG", { cache: "no-store", signal: undefined });
    const csv = multiAssetCsv(result); expect(csv).toContain("source_checked_at"); expect(csv).toContain(dates[1]); expect(csv).toContain("Tiingo End-of-Day");
  });
  it.each([
    (body: any) => { body.source = "SIM"; },
    (body: any) => { body.assets[0].id = "BIL"; },
    (body: any) => { body.assets[0].returns[2].date = body.assets[0].returns[1].date; },
    (body: any) => { body.assets[0].returns[2].value = -1; },
    (body: any) => { body.assets[0].totalChange = 123; },
    (body: any) => { body.assets[0].lastIngestedAt = "2026-11-13T00:00:00Z"; },
    (body: any) => { body.assets.pop(); },
  ])("rejects non-observed or inconsistent responses", async (change) => {
    const body = fixture(); change(body); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    await expect(fetchMultiAssetPreview(["SPY", "AGG"])).rejects.toThrow();
  });
});
