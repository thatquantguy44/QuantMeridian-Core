import { describe, expect, it } from "vitest";
import { buildSnapshot, captureRows, verifyManifest } from "./snapshot";
import { calendarAt } from "@/lib/fx/calendar";

const time = "2026-10-30T17:00:00.000Z";
export function goldRows(date = "2026-10-30") {
  return ["USD", "JPY", "GBP"].map((ccy, i) => ({
    series_id: `ECB:EXR:D.${ccy}.EUR.SP00.A`, observation_date: date,
    value: [1.1, 165, 0.88][i], is_missing: "0", revision_number: "1",
    realtime_start: "", realtime_end: "", ingested_at: "2026-10-30T16:30:00+00:00",
    source: "ecb", frequency: "d", units: `${ccy} per EUR`,
  }));
}
function build(rows = goldRows(), at = time) {
  return buildSnapshot(captureRows(rows), at, at, at);
}
describe("FX current-capture admission", () => {
  it("derives four research-only rates from exact common-date Gold evidence", () => {
    const { snapshot } = build();
    expect(snapshot.pairs.map(p => p.state)).toEqual(Array(4).fill("ELIGIBLE"));
    [1.1, 1 / 1.1, 150, 1.25].forEach((v, i) => expect(snapshot.pairs[i].referenceLevel).toBeCloseTo(v, 10));
    expect(snapshot.pairs[2].evidence.map(e => e.sourceQuoteCurrency)).toEqual(["USD", "JPY"]);
    for (const p of snapshot.pairs) {
      expect(p.allowedPurposes).toEqual(["RESEARCH"]);
      expect(p.exportDisposition).toBe("DENIED");
      expect(p.evidence[0]).toMatchObject({ receiptAt: null, goldAvailableAt: null, publishedAt: null, knownByAt: time });
    }
  });
  it("does not mix dates or silently shrink the universe", () => {
    const rows = goldRows(); rows[1].observation_date = "2026-10-29";
    const { snapshot } = build(rows);
    expect(snapshot.observationDate).toBe("2026-10-30");
    expect(snapshot.pairs.map(p => p.state)).toEqual(["ELIGIBLE", "ELIGIBLE", "MISSING", "ELIGIBLE"]);
    expect(snapshot.pairs[2].referenceLevel).toBeUndefined();
  });
  it("retains malformed JSON values and blocks only their affected leg", () => {
    const rows: Record<string, unknown>[] = goldRows(); rows[1].value = { bad: [true] };
    const m = buildSnapshot(captureRows(rows), time, time, time);
    expect(m.snapshot.pairs.map(p => p.state)).toEqual(["ELIGIBLE", "ELIGIBLE", "BLOCKED", "ELIGIBLE"]);
    expect(verifyManifest(JSON.parse(JSON.stringify(m)))).toEqual(m);
    const bad = captureRows(goldRows());
    (bad[0].value as unknown as { value: unknown }).value = "1.1";
    expect(() => buildSnapshot(bad, time, time, time)).toThrow("INTEGRITY_FAILURE");
  });
  it("isolates a future-dated leg before choosing the common date", () => {
    const rows = goldRows(); rows[1].observation_date = "2026-11-02";
    expect(build(rows).snapshot.pairs.map(p => p.state)).toEqual(["ELIGIBLE", "ELIGIBLE", "BLOCKED", "ELIGIBLE"]);
  });
  it.each([0, -1, NaN, Infinity, -Infinity])("blocks invalid latest %s without falling back", value => {
    const rows = goldRows(); rows[0].value = value;
    const { snapshot } = build([...rows, { ...goldRows()[0], observation_date: "2026-10-29" }]);
    expect(snapshot.pairs.every(p => p.state === "BLOCKED" && p.referenceLevel === undefined)).toBe(true);
    expect(verifyManifest(JSON.parse(JSON.stringify(build(rows))))).toEqual(build(rows));
  });
  it("preserves missingness, mapping failure, conflicts and after-cutoff clocks", () => {
    const rows = goldRows(); rows[1].is_missing = "1";
    expect(build(rows).snapshot.pairs[2].state).toBe("MISSING");
    rows[1].source = "fred";
    expect(build(rows).snapshot.pairs[2].state).toBe("BLOCKED");
    expect(build([...goldRows(), { ...goldRows()[0], value: 9 }]).snapshot.pairs[0].state).toBe("BLOCKED");
    const future = goldRows(); future[0].ingested_at = "2026-10-30T18:00:00Z";
    expect(build(future).snapshot.pairs[0].reasons.map(r => r.code)).toContain("AFTER_CUTOFF");
  });
  it("keeps stale values display-only at the inclusive publication deadline", () => {
    expect(build(goldRows(), "2026-11-02T15:59:59Z").snapshot.pairs[0].state).toBe("ELIGIBLE");
    const stale = build(goldRows(), "2026-11-02T16:00:00Z").snapshot.pairs;
    expect(stale.map(p => p.state)).toEqual(Array(4).fill("DEGRADED"));
    expect(stale[2].lastObserved?.value).toBe(150);
    expect(stale.every(p => p.referenceLevel === undefined && p.allowedPurposes.length === 0)).toBe(true);
  });
  it("reproduces frozen inputs and rejects tampering or unsupported versions", () => {
    const manifest = build();
    expect(verifyManifest(JSON.parse(JSON.stringify(manifest)))).toEqual(manifest);
    const bad = structuredClone(manifest); bad.snapshot.pairs[0].referenceLevel = 9;
    expect(() => verifyManifest(bad)).toThrow("INTEGRITY_FAILURE");
    const unsupported = structuredClone(manifest); unsupported.snapshot.methodVersion = "unknown";
    expect(() => verifyManifest(unsupported)).toThrow();
    expect(() => buildSnapshot(captureRows(goldRows()), time, "2026-10-29T17:00:00Z", time)).toThrow();
  });
});
describe("ECB release calendar", () => {
  it.each([
    ["2026-10-31T12:00:00Z", "2026-10-30"], ["2026-11-01T12:00:00Z", "2026-10-30"],
    ["2026-04-06T18:00:00Z", "2026-04-02"], ["2026-05-14T15:00:00Z", "2026-05-14"],
    ["2026-03-27T16:00:00Z", "2026-03-27"], ["2026-03-30T15:00:00Z", "2026-03-30"],
    ["2026-10-23T15:00:00Z", "2026-10-23"], ["2026-10-26T16:00:00Z", "2026-10-26"],
  ])("qualifies %s against operating date %s", (at, expected) => {
    expect(calendarAt(at).expectedDate).toBe(expected);
    expect(Date.parse(calendarAt(at).nextCheckAt!)).toBeGreaterThan(Date.parse(at));
  });
  it.each(["2025-12-30T17:00:00Z", "2026-01-01T17:00:00Z", "2029-01-02T17:00:00Z"])("fails closed for unsupported lookup %s", at => {
    expect(calendarAt(at).expectedDate).toBeNull();
  });
});
