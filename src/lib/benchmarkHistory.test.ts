import { describe, expect, it } from "vitest";
import { breakChartGaps, calendarChanges, descriptiveHistory, matchedChangeCorrelation, priorMonths, rollingHistory } from "./benchmarkHistory";

describe("qualified benchmark history analytics", () => {
  it("clamps calendar month and leap-year windows without drifting", () => {
    expect(priorMonths("2024-03-31", 1)).toBe("2024-02-29");
    expect(priorMonths("2024-02-29", 12)).toBe("2023-02-28");
  });
  it("breaks chart lines at gaps without adding values to the original history", () => {
    const observed = [{ date: "2026-01-02", value: 1 }, { date: "2026-01-05", value: 2 }, { date: "2026-01-20", value: 3 }];
    const plotted = breakChartGaps(observed, 5);
    expect(plotted).toHaveLength(4);
    expect(plotted[2].date).toBe("");
    expect(Number.isNaN(plotted[2].value)).toBe(true);
    expect(observed).toHaveLength(3);
  });
  it("uses actual prior observation dates with a bounded calendar lookback", () => {
    const result = calendarChanges([
      { date: "2025-12-31", value: 3 }, { date: "2026-01-30", value: 3.4 },
      { date: "2026-02-27", value: 4 }, { date: "2026-03-02", value: 4.1 },
    ], "d");
    expect(result.find((x) => x.label === "1D")).toMatchObject({ date: "2026-02-27", value: 4, change: expect.closeTo(0.1), targetDate: "2026-03-01" });
    expect(result.find((x) => x.label === "1M")).toMatchObject({ date: "2026-01-30", value: 3.4, change: expect.closeTo(0.7) });
    expect(result.find((x) => x.label === "YTD")).toMatchObject({ date: "2025-12-31", value: 3 });
    expect(result.find((x) => x.label === "1Y")?.date).toBeNull();
  });
  it("does not invent a daily move for sparse monthly data or reuse the current observation", () => {
    const result = calendarChanges([{ date: "2026-01-01", value: 0 }, { date: "2026-02-01", value: -1 }], "m");
    expect(result.find((x) => x.label === "1D")?.change).toBeNull();
    expect(result.find((x) => x.label === "1M")?.change).toBe(-1);
    expect(calendarChanges([{ date: "2026-02-01", value: 0 }], "d").every((x) => x.change === null)).toBe(true);
  });
  it("uses sample statistics of observed level changes and never invents volatility", () => {
    const summary = descriptiveHistory([{ date: "2026-01-01", value: 0 }, { date: "2026-01-02", value: 2 }, { date: "2026-01-03", value: 3 }]);
    expect(summary).toMatchObject({ count: 3, firstDate: "2026-01-01", lastDate: "2026-01-03", min: 0, max: 3, percentile: null });
    expect(summary.changeVolatility).toBeCloseTo(Math.sqrt(0.5));
    expect(descriptiveHistory([{ date: "2026-01-01", value: 2 }]).changeVolatility).toBeNull();
  });
  it("calculates rolling changes and volatility only across qualified cadence-sized gaps", () => {
    const points = rollingHistory([{ date: "2026-01-02", value: 0 }, { date: "2026-01-05", value: 2 }, { date: "2026-01-06", value: 3 }, { date: "2026-01-20", value: 4 }], "d", 2);
    expect(points[0]).toMatchObject({ fromDate: "2026-01-02", date: "2026-01-06", change: 3 });
    expect(points[0].volatility).toBeCloseTo(Math.sqrt(0.5));
    expect(points[1]).toMatchObject({ date: "2026-01-20", change: null, volatility: null });
    expect(rollingHistory([{ date: "2026-01-01", value: 0 }, { date: "2026-01-02", value: 1 }, { date: "2026-01-03", value: 2 }], null, 2)[0].change).toBeNull();
  });
  it("correlates level changes on common dates and reports the actual sample", () => {
    const a = [{ date: "2026-01-01", value: 0 }, { date: "2026-01-02", value: 1 }, { date: "2026-01-03", value: 3 }, { date: "2026-01-04", value: 9 }];
    const b = [{ date: "2026-01-01", value: -1 }, { date: "2026-01-02", value: 1 }, { date: "2026-01-03", value: 5 }, { date: "2026-01-05", value: 8 }];
    const result = matchedChangeCorrelation({ a, b }, ["a", "b"]);
    expect(result).toMatchObject({ sampleCount: 2, firstDate: "2026-01-01", lastDate: "2026-01-03" });
    expect(result?.matrix[0][1]).toBeCloseTo(1);
    expect(matchedChangeCorrelation({ a, b: b.map((x) => ({ ...x, value: 1 })) }, ["a", "b"])).toBeNull();
  });
});
