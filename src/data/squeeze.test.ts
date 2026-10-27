import { describe, expect, test } from "vitest";
import { getSqueezeCandidates, mergeShortInterest, type SqueezeRow } from "./squeeze";

const row: SqueezeRow = {
  ticker: "GME", name: "GameStop", sector: "Consumer", assetClass: "EQUITY",
  classification: "SPECIAL", price: 10, utilization: 85, feeBps: 200,
  feeMom5: 12, feeMom20: 18, feeHist: [180, 200],
  shortInterestPct: 3, daysToCover: 1, shortInterestSource: "SIM",
  shortInterestAsOf: null, putCall: 1, skew: 2, etfFlow: null,
  priceChg5: 4, attention: 50, heat: 40, direction: "HEATING", squeezeScore: 30,
};

describe("SQZ Yahoo overlay", () => {
  test("recomputes scores and candidate view without changing the SIM base", () => {
    const base = [row];
    const merged = mergeShortInterest(base, [{
      ticker: "GME", shortInterestPct: 27.5, daysToCover: 5.2, asOf: "2026-10-15",
    }]);
    expect(base[0].shortInterestSource).toBe("SIM");
    expect(merged[0].shortInterestSource).toBe("YAHOO");
    expect(merged[0].shortInterestAsOf).toBe("2026-10-15");
    expect(merged[0].heat).toBeGreaterThan(row.heat);
    expect(merged[0].squeezeScore).toBeGreaterThan(row.squeezeScore);
    expect(getSqueezeCandidates(base)).toHaveLength(0);
    expect(getSqueezeCandidates(merged)).toHaveLength(1);
  });

  test("missing Yahoo rows retain SIM provenance and values", () => {
    expect(mergeShortInterest([row], [])[0]).toEqual(row);
  });
});
