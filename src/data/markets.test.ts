import { describe, test, expect } from "vitest";
import { isAnnualized, horizonDateRange, heatmapFromCards, moversFromCards, HEAT_HORIZONS } from "./markets";

describe("horizon utilities", () => {
  test("isAnnualized returns true only for 3Y and 5Y", () => {
    expect(isAnnualized("1D")).toBe(false);
    expect(isAnnualized("1W")).toBe(false);
    expect(isAnnualized("MTD")).toBe(false);
    expect(isAnnualized("YTD")).toBe(false);
    expect(isAnnualized("1Y")).toBe(false);
    expect(isAnnualized("3Y")).toBe(true);
    expect(isAnnualized("5Y")).toBe(true);
  });

  test("HEAT_HORIZONS has all 7 options", () => {
    expect(HEAT_HORIZONS).toHaveLength(7);
    const values = HEAT_HORIZONS.map(h => h.value);
    expect(values).toContain("1D");
    expect(values).toContain("5Y");
  });

  test("horizonDateRange formats with asOf", () => {
    const range = horizonDateRange("1D", "2026-06-23");
    expect(range).toContain("2026-06-23");
    expect(range).toContain("→");
  });

  test("horizonDateRange handles null asOf", () => {
    const range = horizonDateRange("YTD", null);
    expect(typeof range).toBe("string");
  });
});

describe("heatmapFromCards", () => {
  const mockCards = [
    { series_id: "SPY", display_name: "S&P 500", asset_class: "Equity", price: 500, ret_1d: 0.01, ret_5d: 0.02, mtd: 0.03, ytd: 0.10, ret_1y: 0.15, cagr_3y: 0.08, cagr_5y: 0.09 },
    { series_id: "XLK", display_name: "Technology", asset_class: "Equity", price: 200, ret_1d: -0.005, ret_5d: 0.01, mtd: 0.02, ytd: 0.20, ret_1y: 0.25, cagr_3y: 0.12, cagr_5y: 0.14 },
  ] as any;

  test("returns heat cells with correct fields", () => {
    const cells = heatmapFromCards(mockCards, "1D");
    expect(cells.length).toBeGreaterThan(0);
    expect(cells[0]).toHaveProperty("ticker");
    expect(cells[0]).toHaveProperty("chgPct");
    expect(cells[0]).toHaveProperty("weight");
    expect(cells[0]).toHaveProperty("sector");
  });

  test("uses correct horizon return field", () => {
    const cells1d = heatmapFromCards(mockCards, "1D");
    const cellsYtd = heatmapFromCards(mockCards, "YTD");
    const spy1d = cells1d.find(c => c.ticker === "SPY");
    const spyYtd = cellsYtd.find(c => c.ticker === "SPY");
    if (spy1d && spyYtd) {
      expect(spy1d.chgPct).not.toBe(spyYtd.chgPct);
    }
  });
});

describe("moversFromCards", () => {
  test("separates gainers and losers", () => {
    const cards = [
      { series_id: "SPY", display_name: "S&P 500", asset_class: "Equity", price: 500, ret_1d: 0.02 },
      { series_id: "XLE", display_name: "Energy", asset_class: "Equity", price: 100, ret_1d: -0.03 },
    ] as any;
    const result = moversFromCards(cards);
    expect(result.gainers.length).toBeGreaterThan(0);
    expect(result.losers.length).toBeGreaterThan(0);
    expect(result.gainers[0].chgPct).toBeGreaterThanOrEqual(0);
    expect(result.losers[0].chgPct).toBeLessThanOrEqual(0);
  });
});
