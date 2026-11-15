import { describe, expect, it } from "vitest";
import { operatingDate } from "@/lib/fx/calendar";
import { captureRows } from "./snapshot";
import { assessHistory, buildHistory, verifyHistoryManifest } from "./history";

const at = "2026-10-30T17:00:00.000Z";
function dates(count = 22, end = "2026-10-30") {
  const out = []; let ms = Date.parse(`${end}T12:00:00Z`);
  while (out.length < count) {
    const date = new Date(ms).toISOString().slice(0, 10);
    if (operatingDate(date)) out.push(date);
    ms -= 86_400_000;
  }
  return out.reverse();
}
export function historyRows(count = 22) {
  return dates(count).flatMap((date, i) => ["USD", "JPY", "GBP"].map((c, j) => ({
    series_id: `ECB:EXR:D.${c}.EUR.SP00.A`, observation_date: date,
    value: j === 0 ? 1.1 + .11 * i / (count - 1) : j === 1 ? 165 : .88,
    is_missing: "0", revision_number: "1", realtime_start: "", realtime_end: "", ingested_at: at,
    source: "ecb", frequency: "d", units: `${c} per EUR`,
  })));
}
function build(rows = historyRows(), time = at) { return buildHistory(captureRows(rows, 320), time, time, time); }
describe("FX observed history and changes", () => {
  it("computes independent direct and inverse endpoint changes with exact dates/evidence", () => {
    const { history } = build();
    const direct = history.pairs[0].changes.find(c => c.intervals === 21)!;
    const inverse = history.pairs[1].changes.find(c => c.intervals === 21)!;
    expect(direct.simplePercent).toBeCloseTo(10, 10);
    expect(inverse.simplePercent).toBeCloseTo(-9.0909090909, 10);
    expect(direct).toMatchObject({ state: "AVAILABLE", startDate: dates()[0], endDate: "2026-10-30", observationsRequired: 22, observationsAvailable: 22 });
    expect(history.pairs).toHaveLength(4);
    expect(history.schedule.dates).toHaveLength(90);
    expect(history.pairs[2].points.at(-1)!.displayLevel).toBeCloseTo(165 / 1.21, 10);
    expect(history.evidence.every(e => e.receiptAt === null && e.knownByAt === at)).toBe(true);
    expect(history.pairs[0].points.at(-1)!.evidenceIds.every(id => history.evidence.some(e => e.evidenceId === id))).toBe(true);
  });
  it("distinguishes insufficient leading history from an unexpected interior gap", () => {
    const short = build(historyRows(21)).history.pairs[0];
    expect(short.changes[2].reasons.map(r => r.code)).toContain("INSUFFICIENT_HISTORY");
    expect(short.changes[1].state).toBe("AVAILABLE");
    const rows = historyRows().filter(r => !(r.series_id.includes("USD") && r.observation_date === dates()[2]));
    const gapped = build(rows).history.pairs;
    expect(gapped[0].changes[2].reasons.map(r => r.code)).toContain("HISTORY_GAP");
    expect(gapped[0].changes[1].state).toBe("AVAILABLE");
    expect(gapped[0].points.find(p => p.observationDate === dates()[2])!.displayLevel).toBeNull();
  });
  it("keeps a missing historical JPY leg from removing other pair observations", () => {
    const rows = historyRows().filter(r => !(r.series_id.includes("JPY") && r.observation_date === dates()[2]));
    const pairs = build(rows).history.pairs;
    expect(pairs[2].changes[2].state).toBe("UNAVAILABLE");
    expect(pairs[0].changes[2].state).toBe("AVAILABLE");
    expect(pairs[3].changes[2].state).toBe("AVAILABLE");
  });
  it("keeps a bounded historical conflict cluster local to the affected pair/date", () => {
    const rows = historyRows(); const old = rows.find(r => r.series_id.includes("JPY") && r.observation_date === dates()[5])!;
    for (let i = 0; i < 34; i++) rows.push({ ...old, value: 170 + i });
    const h = build(rows).history;
    expect(h.pairs[2].points.find(p => p.observationDate === old.observation_date)!.state).toBe("BLOCKED");
    expect(h.pairs[0].changes[2].state).toBe("AVAILABLE");
    expect(h.pairs[2].changes[2].reasons.map(r => r.code)).toContain("HISTORY_GAP");
  });
  it("identifies a present invalid leading endpoint as a gap rather than lack of history", () => {
    const rows = historyRows(); rows[0].value = -1;
    const change = build(rows).history.pairs[0].changes[2];
    expect(change.reasons.map(r => r.code)).toContain("HISTORY_GAP");
    expect(change.reasons.map(r => r.code)).not.toContain("INSUFFICIENT_HISTORY");
  });
  it("never restores current metrics from an older row after a future latest guard or conflict", () => {
    const rows = historyRows();
    rows.push({ ...rows.at(-2)!, observation_date: "2026-11-02" });
    const h = build(rows).history;
    expect(h.observationDate).toBe("2026-10-30");
    expect(h.pairs[2].endpointState).toBe("BLOCKED");
    expect(h.pairs[2].changes.every(c => c.state === "UNAVAILABLE")).toBe(true);
    expect(h.pairs[0].changes[2].state).toBe("AVAILABLE");
    const conflict = build([...historyRows(), { ...historyRows().at(-3)!, value: 9 }]).history;
    expect(conflict.pairs[0].points.at(-1)!.displayLevel).toBeNull();
  });
  it("preserves captured metrics on replay while suppressing them in a later stale assessment", () => {
    const m = build();
    expect(verifyHistoryManifest(JSON.parse(JSON.stringify(m)))).toEqual(m);
    const assessed = assessHistory(m.history, "2026-11-02T16:00:00.000Z");
    expect(assessed[0].changes.every(c => c.simplePercent === null && c.reasons.some(r => r.code === "STALE_ENDPOINT"))).toBe(true);
    expect(m.history.pairs[0].changes[2].state).toBe("AVAILABLE");
    const stale = build(historyRows(), "2026-11-02T17:00:00.000Z").history;
    expect(stale.pairs[0].points.at(-1)!.displayLevel).toBeCloseTo(1.21, 10);
    expect(stale.pairs[0].changes.every(c => c.state === "UNAVAILABLE")).toBe(true);
  });
  it("truncates only the historical left boundary and never waives unknown current freshness", () => {
    const jan = historyRows(2).map(r => ({ ...r, observation_date: r.observation_date === dates(2)[0] ? "2026-01-02" : "2026-01-05", ingested_at: "2026-01-05T16:00:00Z" }));
    const h = build(jan, "2026-01-05T17:00:00.000Z").history;
    expect(h.schedule.calendarTruncated).toBe(true);
    expect(h.schedule.dates).toEqual(["2026-01-02", "2026-01-05"]);
    expect(h.pairs[0].changes[1].state).toBe("UNAVAILABLE");
    const unknown = build([], "2026-01-01T17:00:00.000Z").history;
    expect(unknown.pairs.every(p => p.changes.every(c => c.state === "UNAVAILABLE"))).toBe(true);
  });
  it("rejects overflow, changed frozen metrics and malformed retained inputs", () => {
    expect(() => build([...historyRows(90), ...historyRows(22)])).toThrow();
    const m = build(); m.history.pairs[0].changes[2].simplePercent = 999;
    expect(() => verifyHistoryManifest(m)).toThrow("INTEGRITY_FAILURE");
  });
});
