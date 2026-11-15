import { afterEach, describe, expect, it, vi } from "vitest";
import { captureSnapshot, importSnapshotFile, snapshotReplayCsv } from "./snapshotClient";
import { snapshotFixtureContent, signSnapshotFixture } from "./snapshot.fixture";

async function fixture() {
  const content = snapshotFixtureContent(), snapshot = await signSnapshotFixture(content);
  const preview = { source: "DB", asOfDate: content.asOfDate, checkedAt: content.captureCompletedAt, firstDate: content.sessions[0], lastDate: content.sessions.at(-1), sessionCount: 253, returnCount: 252,
    assets: content.assets.map((asset) => ({ id: asset.id, latestDate: asset.latestDate, futureCount: asset.futureGoldCount, lastIngestedAt: "2026-11-11T00:00:00Z", totalChange: 2.52,
      returns: asset.observations.slice(1).map((row, i) => ({ date: row.date, value: row.close / asset.observations[i].close - 1 })) })) };
  return { snapshot, preview };
}
afterEach(() => vi.unstubAllGlobals());
describe("PORA snapshot capture and import", () => {
  it("captures the selected data, checks the hash and binds the preview to it", async () => {
    const body = await fixture(); vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    const result = await captureSnapshot(["SPY", "AGG"]);
    expect(result.verification.snapshotId).toBe(body.snapshot.snapshotId);
    expect(result.preview.assets.map((x) => x.id)).toEqual(["SPY", "AGG"]);
    expect(JSON.parse(result.json).snapshotId).toBe(body.snapshot.snapshotId);
  });
  it("rejects a preview that does not match the freshly captured snapshot", async () => {
    const body = await fixture(); body.preview.assets[0].lastIngestedAt = "2026-11-10T00:00:00Z";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body))));
    await expect(captureSnapshot(["SPY", "AGG"])).rejects.toThrow(/match/i);
  });
  it("rejects oversized responses before accepting a snapshot", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x".repeat(4_500_001))));
    await expect(captureSnapshot(["SPY", "AGG"])).rejects.toThrow(/size/i);
  });
  it("imports a self-consistent artifact without contacting the source", async () => {
    const body = await fixture(); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const result = await importSnapshotFile(new File([JSON.stringify(body.snapshot)], "snapshot.json", { type: "application/json" }));
    expect(result.verification.returnCount).toBe(252); expect(result.origin).toBe("IMPORTED"); expect(fetcher).not.toHaveBeenCalled();
    expect(snapshotReplayCsv(result)).toContain("IMPORTED_ORIGIN_NOT_RECHECKED");
  });
  it("keeps a self-consistent rehashed file explicitly unverified", async () => {
    const data = snapshotFixtureContent(); data.assets[0].observations[0].evidence[0].rowHash = "unverified-altered-evidence";
    const snapshot = await signSnapshotFixture(data);
    const result = await importSnapshotFile(new File([JSON.stringify(snapshot)], "rehashed.json"));
    expect(result.origin).toBe("IMPORTED");
    expect(snapshotReplayCsv(result)).toContain("IMPORTED_ORIGIN_NOT_RECHECKED");
  });
  it("rejects modified, malformed or oversized files", async () => {
    const body = await fixture(); body.snapshot.content.assets[0].observations[0].close = 999;
    await expect(importSnapshotFile(new File([JSON.stringify(body.snapshot)], "bad.json"))).rejects.toThrow(/hash/i);
    await expect(importSnapshotFile(new File(["not json"], "bad.json"))).rejects.toThrow();
    await expect(importSnapshotFile(new File(["x".repeat(4_100_001)], "large.json"))).rejects.toThrow(/size/i);
  });
});
