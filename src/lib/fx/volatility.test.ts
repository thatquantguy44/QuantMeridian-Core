import { describe, expect, it } from "vitest";
import { calculateVolatility, sampleLogVolatility } from "./volatility";
import type { FxPairHistory } from "./historyContracts";

function pair(count = 253): FxPairHistory {
  return { baseCurrency: "EUR", quoteCurrency: "USD", endpointState: "ELIGIBLE", endpointReasons: [], derivation: "DIRECT", changes: [], validObservations: count,
    points: Array.from({ length: count }, (_, i) => ({ observationDate: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
      state: "OBSERVED", displayLevel: Math.exp(i % 2 ? .01 : 0), evidenceIds: [], reasons: [] })) };
}
describe("FX descriptive log-return volatility", () => {
  it("matches an independent centered sample oracle and fixed annualization", () => {
    const s = sampleLogVolatility([1, Math.exp(-.01), Math.exp(-.01), 1]);
    expect(s.dailySigma).toBeCloseTo(.01, 14);
    expect(s.annualizedSigma).toBeCloseTo(.15874507866387544, 14);
    const metrics = calculateVolatility(pair());
    expect(metrics.map(m => [m.window, m.levelsRequired, m.returnsAvailable])).toEqual([[5,6,5],[21,22,21],[63,64,63],[126,127,126],[252,253,252]]);
    expect(metrics.every(m => m.state === "AVAILABLE" && m.annualizedSigma === m.dailySigma! * Math.sqrt(252))).toBe(true);
  });
  it("centers nonzero constant returns and handles extreme positive finite scales", () => {
    expect(sampleLogVolatility([1, 2, 4, 8, 16, 32]).dailySigma).toBeCloseTo(0, 14);
    expect(sampleLogVolatility([Number.MIN_VALUE, Number.MAX_VALUE, 1]).dailySigma).toBeGreaterThan(0);
    for (const levels of [[], [1], [1, 2], [1, 0, 2], [1, Infinity, 2], [1, -2, 3]]) expect(() => sampleLogVolatility(levels)).toThrow();
  });
  it("preserves exact endpoint metadata and equal direct/inverse dispersion", () => {
    const p = pair(); const m = calculateVolatility(p)[4];
    expect(m).toMatchObject({ levelsAvailable: 253, returnsAvailable: 252, startDate: p.points[0].observationDate, endDate: p.points[252].observationDate, calendarDays: 252,
      firstReturn: { startDate: p.points[0].observationDate, endDate: p.points[1].observationDate } });
    const inverse = { ...p, points: p.points.map(point => ({ ...point, displayLevel: 1 / point.displayLevel! })) };
    expect(calculateVolatility(inverse)[4].dailySigma).toBeCloseTo(m.dailySigma!, 14);
  });
  it("requires N+1 levels and localizes a gap to its containing windows", () => {
    expect(calculateVolatility(pair(252))[4]).toMatchObject({ state: "UNAVAILABLE", dailySigma: null, reasons: [{ code: "INSUFFICIENT_HISTORY", message: expect.any(String) }] });
    const p = pair(); p.points[100] = { ...p.points[100], state: "MISSING", displayLevel: null };
    expect(calculateVolatility(p).map(m => m.state)).toEqual(["AVAILABLE", "AVAILABLE", "AVAILABLE", "AVAILABLE", "UNAVAILABLE"]);
    expect(calculateVolatility(p)[4].returnsAvailable).toBe(250);
    expect(calculateVolatility(p)[4].reasons[0].code).toBe("HISTORY_GAP");
  });
  it("distinguishes invalid leading evidence, calendar truncation and stale endpoints", () => {
    const p = pair(22); p.points[0].displayLevel = -1;
    expect(calculateVolatility(p)[1].reasons[0].code).toBe("HISTORY_GAP");
    expect(calculateVolatility(pair(22), true)[4].reasons[0].code).toBe("HISTORY_CALENDAR_TRUNCATED");
    expect(calculateVolatility({ ...pair(), endpointState: "DEGRADED" }).every(m => m.dailySigma === null && m.reasons[0].code === "STALE_ENDPOINT")).toBe(true);
  });

  it("keeps a historical estimate available when the current endpoint is stale", () => {
    const stale = { ...pair(), endpointState: "DEGRADED" as const, endpointReasons: [{ code: "STALE_SOURCE", message: "Expected publication is missing." }] };
    const current = calculateVolatility(stale);
    const historical = calculateVolatility({ ...stale, endpointState: "ELIGIBLE", endpointReasons: [] });
    expect(current[4]).toMatchObject({ state: "UNAVAILABLE", dailySigma: null, reasons: [{ code: "STALE_ENDPOINT" }] });
    expect(historical[4]).toMatchObject({ state: "AVAILABLE", endDate: stale.points.at(-1)?.observationDate });
    expect(historical[4].annualizedSigma).toBeGreaterThan(0);
  });
});
