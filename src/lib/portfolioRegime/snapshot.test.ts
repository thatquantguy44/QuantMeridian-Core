import { describe, expect, it } from "vitest";
import { canonicalSnapshotJson, verifySnapshot, type PoraSnapshotContent } from "./snapshot";

import { snapshotFixtureContent as content, signSnapshotFixture as sign } from "./snapshot.fixture";

describe("PORA research snapshot", () => {
  it("validates canonical content and replays returns without provider requests", async () => {
    const original = content(), snapshot = await sign(original);
    const result = await verifySnapshot(snapshot);
    expect(result.snapshotId).toBe(snapshot.snapshotId);
    expect(result.assets.map((asset) => asset.id)).toEqual(["SPY", "AGG"]);
    expect(result.assets[0].totalChange).toBeCloseTo(2.52);
    expect(result.returnCount).toBe(252);
    expect(canonicalSnapshotJson({ b: 1, a: 2 })).toBe(canonicalSnapshotJson({ a: 2, b: 1 }));
  });
  it("detects changed observations even if the snapshot ID was not changed", async () => {
    const snapshot = await sign(content()); snapshot.content.assets[0].observations[1].close = 999;
    await expect(verifySnapshot(snapshot)).rejects.toThrow(/hash/i);
  });
  it("rejects inconsistent calculations even if an altered artifact is rehashed", async () => {
    const data = content(); data.assets[0].observations[1].totalReturnIndex = 999;
    await expect(verifySnapshot(await sign(data))).rejects.toThrow(/reconcil/i);
  });
  it("rejects accumulated index drift even when each individual step is within tolerance", async () => {
    const data = content();
    for (let i = 0; i < data.assets[0].observations.length; i++) {
      const row = data.assets[0].observations[i]; row.totalReturnIndex = row.close * (1 + i * 5e-10);
    }
    await expect(verifySnapshot(await sign(data))).rejects.toThrow(/compounded/i);
  });
  it.each([
    (data: PoraSnapshotContent) => { data.knowledgeBasis = "POINT_IN_TIME" as never; },
    (data: PoraSnapshotContent) => { data.sourceMode = "SYNTHETIC" as never; },
    (data: PoraSnapshotContent) => { data.assets[0].observations.pop(); },
    (data: PoraSnapshotContent) => { data.assets[0].observations[1].evidence[0].runId = "unknown"; },
    (data: PoraSnapshotContent) => { data.receipts[0].payloadSha256 = "not-a-hash"; },
    (data: PoraSnapshotContent) => { data.receipts.push({ ...data.receipts[0], runId: "unused-receipt" }); },
    (data: PoraSnapshotContent) => { data.sessions[1] = data.sessions[0]; },
    (data: PoraSnapshotContent) => { (data.assets[0].observations[1] as any).extra = "unexpected"; },
  ])("rejects invalid, unverified or unsupported snapshot contents", async (change) => {
    const data = content(); change(data); await expect(verifySnapshot(await sign(data))).rejects.toThrow();
  });
});
