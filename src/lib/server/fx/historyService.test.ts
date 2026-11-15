import { describe, expect, it, vi } from "vitest";
import { FxHistoryService } from "./historyService";
import { reviewedDates, type FxHistoryManifest } from "./history";

const at = "2026-10-30T17:00:00.000Z";
function rows() {
  return reviewedDates("2026-10-30").slice(-22).flatMap((date, i) => ["USD", "JPY", "GBP"].map((c, j) => ({
    series_id: `ECB:EXR:D.${c}.EUR.SP00.A`, observation_date: date, value: j === 0 ? 1.1 + .11 * i / 21 : j === 1 ? 165 : .88,
    is_missing: "0", revision_number: "1", realtime_start: "", realtime_end: "", ingested_at: at,
    source: "ecb", frequency: "d", units: `${c} per EUR`,
  })));
}
function dependencies() {
  let retained: FxHistoryManifest | null = null;
  return { now: () => at, read: vi.fn(async (_started: string) => rows()),
    save: vi.fn(async (m: FxHistoryManifest) => { retained = m; }),
    latest: vi.fn(async () => retained), get: vi.fn(async () => retained!) };
}
describe("FX history service boundary", () => {
  it("publishes a retained capture and preserves original metrics on historical replay", async () => {
    const d = dependencies(), service = new FxHistoryService(d);
    const result = await service.current();
    expect(result.error).toBeNull(); expect(result.history?.pairs[0].changes[2].simplePercent).toBeCloseTo(10, 10);
    expect(d.save).toHaveBeenCalledTimes(1);
    const replay = await service.replay(result.history!.historyId, "2026-11-02T16:00:00.000Z");
    expect(replay.history).toEqual(result.history);
    expect(replay.history.pairs[0].changes[2].state).toBe("AVAILABLE");
    expect(replay.pairs[0].changes[2].state).toBe("UNAVAILABLE");
    expect(replay.currentConsumptionPermitted).toBe(false);
  });
  it("blocks current metrics on a failed refresh while retaining separate dated history", async () => {
    const d = dependencies(), service = new FxHistoryService(d);
    const first = await service.current();
    d.read.mockRejectedValue(new Error("password=secret"));
    const failed = await service.current();
    expect(failed.history).toBeNull();
    expect(failed.retained?.historyId).toBe(first.history!.historyId);
    expect(failed.pairs[0].points).toEqual(first.pairs[0].points);
    expect(failed.pairs.every(p => p.changes.every(c => c.simplePercent === null))).toBe(true);
    expect(JSON.stringify(failed)).not.toContain("secret");
  });
  it("does not publish an eligible history when retention fails", async () => {
    const d = dependencies(); d.save.mockRejectedValue(new Error("disk secret"));
    const result = await new FxHistoryService(d).current();
    expect(result.history).toBeNull(); expect(result.error?.code).toBe("RETENTION_UNAVAILABLE");
    expect(result.pairs).toHaveLength(4);
    expect(result.pairs.every(p => p.changes.every(c => c.state === "UNAVAILABLE"))).toBe(true);
  });
  it("assesses replay after retrieval crosses a publication deadline", async () => {
    const d = dependencies(), service = new FxHistoryService(d);
    const first = await service.current();
    let clock = "2026-11-02T15:59:59.000Z"; d.now = () => clock;
    d.get.mockImplementation(async () => { clock = "2026-11-02T16:00:01.000Z"; return { history: first.history! } as FxHistoryManifest; });
    const replay = await service.replay(first.history!.historyId);
    expect(replay.assessedAt).toBe(clock);
    expect(replay.pairs[0].changes[2].state).toBe("UNAVAILABLE");
    expect(replay.history.pairs[0].changes[2].state).toBe("AVAILABLE");
  });
  it("rejects over-bound evidence and differentiates unknown calendar from disconnection", async () => {
    const d = dependencies(); d.read.mockResolvedValue(Array.from({ length: 321 }, () => rows()[0]));
    expect((await new FxHistoryService(d).current()).error?.code).toBe("INTEGRITY_FAILURE");
    d.read.mockRejectedValue(new Error("FRESHNESS_CALENDAR_UNKNOWN"));
    expect((await new FxHistoryService(d).current()).error?.code).toBe("FRESHNESS_CALENDAR_UNKNOWN");
  });
});
