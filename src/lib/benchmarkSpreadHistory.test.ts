import { describe, expect, it } from "vitest";
import { computeSpread } from "@/data/benchmarkRates";

describe("qualified spread history", () => {
  it("uses exact common dates, preserves zeros and negatives, and reports percent rates in basis points", () => {
    const result = computeSpread({
      DGS10: [{ date: "2024-01-01", value: 0 }, { date: "2024-01-02", value: 9 }, { date: "2024-01-03", value: -0.5 }],
      DGS2: [{ date: "2024-01-01", value: -1 }, { date: "2024-01-03", value: 0 }],
    }, "t2s10s");
    expect(result?.dates).toEqual(["2024-01-01", "2024-01-03"]);
    expect(result?.hist).toEqual([100, -50]);
    expect(result).toMatchObject({ current: -50, mean: 25, min: -50, max: 100, chg1d: -150 });
  });
  it("subtracts credit rates already expressed in basis points without rescaling", () => {
    const result = computeSpread({
      BAMLH0A0HYM2: [{ date: "2024-01-01", value: 300 }],
      BAMLC0A0CM: [{ date: "2024-01-01", value: 75 }],
    }, "ig_hy");
    expect(result?.hist).toEqual([225]);
    expect(result?.chg1d).toBeNull();
  });
  it("does not manufacture a spread when a leg has no qualified history", () => {
    expect(computeSpread({ DGS10: [{ date: "2024-01-01", value: 4 }] }, "t2s10s")).toMatchObject({ current: null, dates: [], hist: [] });
  });
});
