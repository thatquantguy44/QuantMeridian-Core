import { describe, expect, it } from "vitest";
import type { VixForwardResponse } from "@/app/api/market-volatility/vix-forward/route";
import { inspectPoraSource, sourceCsv } from "./sourceInspection";

const input = (): VixForwardResponse => ({
  source: "DB", basis: "spy_total", vix: [["2024-01-02", 12]], price: [["2024-01-02", 100], ["2024-01-03", 101], ["2024-01-04", 100]],
  inputs: { vixSeriesId: "VIXCLS", priceSeriesId: "SPY:total_return_index", priceLabel: "SPY total return", vixFirst: "2024-01-02", vixLast: "2024-01-02", priceFirst: "2024-01-02", priceLast: "2024-01-04" },
  provenance: { policy: "observed-inputs-only", verifiedAt: "2024-01-05T16:00:00Z", vix: { provider: "Cboe via FRED", table: "gold.fred_latest_observation", column: "value", kind: "published index", method: "VIX", sourceSeries: ["VIXCLS"], lastIngestedAt: "2024-01-05T15:00:00Z", verifiedRows: 1 }, price: { provider: "Tiingo End-of-Day", table: "gold.equity_total_return_index", column: "total_return_index", kind: "derived total return", method: "Derived from close, dividends and splits", sourceSeries: ["SPY:close", "SPY:divCash", "SPY:splitFactor"], lastIngestedAt: "2024-01-05T15:00:00Z", verifiedRows: 3 } },
  citations: [], warnings: [],
});

describe("PORA observed source inspection", () => {
  it("reports exact observed coverage and descriptive change, preserving the derived basis", () => {
    const result = inspectPoraSource(input(), "spy_total");
    expect(result).toMatchObject({ basis: "spy_total", firstDate: "2024-01-02", lastDate: "2024-01-04", count: 3, provider: "Tiingo End-of-Day", kind: "derived total return" });
    expect(result.totalChangePct).toBeCloseTo(0);
    expect(result.previousChangePct).toBeCloseTo((100 / 101 - 1) * 100);
    expect(result.previousDate).toBe("2024-01-03");
  });
  it("does not report a return when there is only one observation", () => {
    const value = input(); value.price = [value.price[0]]; value.inputs.priceLast = value.price[0][0]; value.provenance!.price.verifiedRows = 1;
    const result = inspectPoraSource(value, "spy_total");
    expect(result.previousChangePct).toBeNull(); expect(result.totalChangePct).toBeNull();
  });
  it.each([
    (value: VixForwardResponse) => { (value as any).source = "SIM"; },
    (value: VixForwardResponse) => { value.price = [["2024-01-02", 100], ["2024-01-02", 101]]; },
    (value: VixForwardResponse) => { value.price[1] = ["2024-02-30", 101]; },
    (value: VixForwardResponse) => { value.price[1] = ["2024-01-03", Infinity]; },
    (value: VixForwardResponse) => { value.price[2] = ["2024-01-06", 100]; value.inputs.priceLast = "2024-01-06"; },
    (value: VixForwardResponse) => { value.inputs.priceLast = "2024-01-03"; },
    (value: VixForwardResponse) => { value.provenance!.price.verifiedRows = 2; },
    (value: VixForwardResponse) => { value.provenance!.price.sourceSeries.pop(); },
    (value: VixForwardResponse) => { value.provenance!.price.lastIngestedAt = "2024-01-06T00:00:00Z"; },
  ])("rejects synthetic, malformed, future or inconsistent evidence", (change) => {
    const value = input(); change(value); expect(() => inspectPoraSource(value, "spy_total")).toThrow();
  });
  it("exports only returned observations and protects spreadsheet text cells", () => {
    const value = input(); value.provenance!.price.method = '=HYPERLINK("https://example.invalid")';
    const csv = sourceCsv(inspectPoraSource(value, "spy_total"));
    expect(csv.split("\r\n")).toHaveLength(5);
    expect(csv).toContain("2024-01-04"); expect(csv).toContain("2024-01-05T16:00:00Z");
    expect(csv).toContain("'=HYPERLINK");
  });
});
