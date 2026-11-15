import { describe, expect, it } from "vitest";
import { buildVolatility, volatilityDates, verifyVolatilityManifest, assessVolatility } from "./volatility";
import { captureRows, canonical, POLICIES } from "./snapshot";
import { buildHistory } from "./history";

import { volatilityAt as at, volatilityRows } from "../../../../test/fixtures/fx-volatility";

function build(rows = volatilityRows(), time = at) { return buildVolatility(captureRows(rows, 1024), time, time, time); }
describe("retained 253-level volatility capture", () => {
  it("qualifies 2025 history, all windows, cross covariance and compact full evidence under 1 MiB", () => {
    const m = build(), v = m.volatility;
    expect(v.schedule.dates).toHaveLength(253); expect(v.schedule.dates[0].startsWith("2025")).toBe(true);
    expect(v.evidence).toHaveLength(759); expect(m.inputs.rows).toHaveLength(759);
    expect(v.pairs.every(p => p.metrics.every(metric => metric.state === "AVAILABLE"))).toBe(true);
    expect(v.pairs[0].metrics[4].dailySigma).toBeCloseTo(v.pairs[1].metrics[4].dailySigma!, 14);
    expect(v.pairs[2].metrics[4].dailySigma).toBeCloseTo(0, 14);
    expect(Buffer.byteLength(canonical(m))).toBeLessThanOrEqual(1048576);
    expect(v.receiptAt).toBeNull(); expect(v.knownByAt).toBe(at);
    expect(POLICIES.calendar["2025"]).toBeUndefined();
    expect(buildHistory(captureRows(volatilityRows(90),320),at,at,at).history.schedule.dates).toHaveLength(90);
  });
  it("does not mislabel absent source evidence as a historical calendar boundary", () => {
    const empty = build([]).volatility;
    expect(empty.observationDate).toBeNull(); expect(empty.schedule.calendarTruncated).toBe(false);
    expect(empty.schedule.reasons).toEqual([]);
    expect(empty.pairs.every(p => p.metrics.every(m => m.reasons[0].code === "ENDPOINT_UNAVAILABLE"))).toBe(true);
  });
  it("replays exact recorded content and denies unsupported/tampered artifacts", () => {
    const m = build(); expect(verifyVolatilityManifest(JSON.parse(JSON.stringify(m)))).toEqual(m);
    const legacy = structuredClone(m); legacy.volatility.pairs.forEach(pair => { delete (pair as { historicalMetrics?: unknown }).historicalMetrics; });
    expect(verifyVolatilityManifest(legacy).volatility.pairs[0].historicalMetrics[4].state).toBe("AVAILABLE");
    const changed = structuredClone(m); changed.volatility.pairs[0].metrics[0].dailySigma = 999;
    expect(() => verifyVolatilityManifest(changed)).toThrow("INTEGRITY_FAILURE");
    const later = assessVolatility(m.volatility, "2026-11-02T16:00:00.000Z");
    expect(later.every(p => p.metrics.every(metric => metric.dailySigma === null))).toBe(true);
    expect(m.volatility.pairs[0].metrics[4].state).toBe("AVAILABLE");
  });
  it("isolates a historical leg gap and preserves invalid latest guards", () => {
    const rows = volatilityRows(); const gapDate = rows[100].observation_date;
    const gapped = build(rows.filter(r => !(r.series_id.includes("JPY") && r.observation_date === gapDate))).volatility;
    expect(gapped.pairs[2].metrics[4].reasons[0].code).toBe("HISTORY_GAP");
    expect(gapped.pairs[0].metrics[4].state).toBe("AVAILABLE");
    const guarded = build([...rows,{ ...rows.at(-2)!, observation_date: "2026-11-02" }]).volatility;
    expect(guarded.pairs[2].endpointState).toBe("BLOCKED");
    expect(guarded.pairs[0].metrics[4].state).toBe("AVAILABLE");
  });
  it("fails closed on over-bound inputs, unsupported capture clocks and unknown historical coverage", () => {
    expect(() => build([...volatilityRows(), ...Array.from({length:266},()=>volatilityRows()[0])])).toThrow();
    const v = build(volatilityRows(), "2029-01-02T17:00:00.000Z").volatility;
    expect(v.pairs.every(p => p.metrics.every(m => m.state === "UNAVAILABLE"))).toBe(true);
    expect(v.schedule.reasons[0].code).toBe("FRESHNESS_CALENDAR_UNKNOWN");
    expect(volatilityDates("2025-01-02")).toEqual(["2025-01-02"]);
    expect(volatilityDates("2025-04-22")).not.toContain("2025-04-18");
    expect(volatilityDates("2025-04-22")).not.toContain("2025-04-21");
  });
});
