import { describe, expect, it, vi } from "vitest";
import { FxVolatilityService } from "./volatilityService";
import type { FxVolatilityManifest } from "./volatility";
import { volatilityRows, volatilityAt as at } from "../../../../test/fixtures/fx-volatility";
function dependencies() {
  let retained: FxVolatilityManifest | null = null;
  return { now: () => at, read: vi.fn(async (_at: string) => volatilityRows()),
    save: vi.fn(async (m: FxVolatilityManifest) => { retained = m; }),
    latest: vi.fn(async () => retained), get: vi.fn(async () => retained!) };
}
describe("FX volatility publication and replay boundary", () => {
  it("coalesces capture, persists before publishing and replays both scalings", async () => {
    const d = dependencies(), service = new FxVolatilityService(d);
    const [a,b] = await Promise.all([service.current(),service.current()]);
    expect(a).toEqual(b); expect(a.error).toBeNull(); expect(d.read).toHaveBeenCalledTimes(1); expect(d.save).toHaveBeenCalledTimes(1);
    const replay = await service.replay(a.volatility!.volatilityId);
    expect(replay.volatility).toEqual(a.volatility); expect(replay.currentConsumptionPermitted).toBe(false);
    expect(replay.pairs[0].metrics[4].state).toBe("AVAILABLE");
  });
  it("retains verified points but no current estimates after source failure", async () => {
    const d = dependencies(), service = new FxVolatilityService(d), first = await service.current();
    d.read.mockRejectedValue(new Error("secret connection"));
    const failed = await service.current();
    expect(failed.volatility).toBeNull(); expect(failed.retained?.volatilityId).toBe(first.volatility!.volatilityId);
    expect(failed.pairs[0].points).toEqual(first.pairs[0].points);
    expect(failed.pairs.every(p => p.metrics.every(m => m.dailySigma === null))).toBe(true);
    expect(JSON.stringify(failed)).not.toContain("secret");
    d.latest.mockRejectedValue(new Error("INTEGRITY_FAILURE"));
    expect((await service.current()).retained).toBeNull();
  });
  it("does not publish current estimates when persistence fails", async () => {
    const d = dependencies(); d.save.mockRejectedValue(new Error("disk"));
    const result = await new FxVolatilityService(d).current();
    expect(result.error?.code).toBe("RETENTION_UNAVAILABLE"); expect(result.volatility).toBeNull();
    expect(result.pairs).toHaveLength(4); expect(result.pairs.every(p=>p.metrics.every(m=>m.dailySigma===null))).toBe(true);
  });
  it("rechecks time after replay retrieval, suppressing expired eligibility and retention", async () => {
    const d = dependencies(), service = new FxVolatilityService(d), first = await service.current();
    let clock = "2026-11-02T15:59:59.000Z"; d.now = () => clock;
    d.get.mockImplementation(async () => { clock = "2026-11-02T16:00:00.000Z"; return { volatility: first.volatility! } as FxVolatilityManifest; });
    const replay = await service.replay(first.volatility!.volatilityId);
    expect(replay.pairs[0].metrics.every(m=>m.dailySigma===null)).toBe(true);
    expect(replay.volatility.pairs[0].metrics[4].state).toBe("AVAILABLE");
    d.get.mockImplementation(async () => { clock = "2026-11-29T17:00:00.000Z"; return { volatility: first.volatility! } as FxVolatilityManifest; });
    await expect(service.replay(first.volatility!.volatilityId)).rejects.toThrow("REPLAY_UNAVAILABLE");
  });
});
