import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FxSnapshotStore } from "./store";
import { buildSnapshot, canonical, captureRows, ID_PREFIX } from "./snapshot";
import { buildHistory } from "./history";

import { buildVolatility } from "./volatility";
import { volatilityRows, volatilityAt } from "../../../../test/fixtures/fx-volatility";

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.map(p => rm(p, { recursive: true, force: true }))); roots.length = 0; });
async function setup() {
  const root = await mkdtemp(join(tmpdir(), "fx-store-")); roots.push(root);
  return { root, store: new FxSnapshotStore(root) };
}
function fixture(at = "2026-10-30T17:00:00.000Z") {
  return buildSnapshot(captureRows(["USD", "JPY", "GBP"].map((c, i) => ({
    series_id: `ECB:EXR:D.${c}.EUR.SP00.A`, observation_date: "2026-10-30", value: [1.1, 165, .88][i],
    is_missing: "0", revision_number: "1", realtime_start: "", realtime_end: "", ingested_at: "2026-10-30T15:00:00Z",
    source: "ecb", frequency: "d", units: `${c} per EUR`,
  }))), at, at, at);
}
describe("bounded immutable FX retention", () => {
  it("retains typed history alongside S01 and replays both after reopening", async () => {
    const { root, store } = await setup(); const level = fixture();
    const history = buildHistory(level.inputs.rows, level.inputs.readStartedAt, level.inputs.readCompletedAt, level.snapshot.createdAt);
    const volatility = buildVolatility(captureRows(volatilityRows(), 1024), volatilityAt, volatilityAt, volatilityAt);
    await store.save(level); await store.saveHistory(history); await store.saveVolatility(volatility);
    const reopened = new FxSnapshotStore(root);
    expect(await reopened.getHistory(history.history.historyId, level.snapshot.createdAt)).toEqual(history);
    expect(await reopened.latestHistory(level.snapshot.createdAt)).toEqual(history);
    expect(await reopened.getVolatility(volatility.volatility.volatilityId, volatilityAt)).toEqual(volatility);
    expect(await reopened.latestVolatility(volatilityAt)).toEqual(volatility);
    await expect(reopened.getHistory(volatility.volatility.volatilityId, volatilityAt)).rejects.toThrow("REPLAY_UNAVAILABLE");
    await expect(reopened.getVolatility(history.history.historyId, volatilityAt)).rejects.toThrow("REPLAY_UNAVAILABLE");
    expect(await reopened.get(level.snapshot.snapshotId, level.snapshot.createdAt)).toEqual(level);
    await expect(reopened.get(history.history.historyId, level.snapshot.createdAt)).rejects.toThrow("REPLAY_UNAVAILABLE");
    await expect(reopened.getHistory(level.snapshot.snapshotId, level.snapshot.createdAt)).rejects.toThrow("REPLAY_UNAVAILABLE");
  });
  it("replays after reopening without querying Gold, detects tampering and validates IDs", async () => {
    const { root, store } = await setup(), m = fixture();
    await store.save(m);
    expect(await new FxSnapshotStore(root).get(m.snapshot.snapshotId, m.snapshot.createdAt)).toEqual(m);
    expect(await store.latest(m.snapshot.createdAt)).toEqual(m);
    await expect(store.get("../../secret", m.snapshot.createdAt)).rejects.toThrow("REPLAY_UNAVAILABLE");
    const file = (await readdir(root)).find(f => f.endsWith(".json"))!;
    const bad = JSON.parse(await readFile(join(root, file), "utf8")); bad.snapshot.pairs[0].referenceLevel = 7;
    await writeFile(join(root, file), JSON.stringify(bad));
    await expect(store.get(m.snapshot.snapshotId, m.snapshot.createdAt)).rejects.toThrow("INTEGRITY_FAILURE");
  });
  it("expires at thirty days and reports absent replay instead of rebuilding", async () => {
    const { store } = await setup(), m = fixture(); await store.save(m);
    await expect(store.get(m.snapshot.snapshotId, "2026-11-29T17:00:00.000Z")).rejects.toThrow("REPLAY_UNAVAILABLE");
    expect(await store.latest("2026-11-29T17:00:00.000Z")).toBeNull();
  });
  it("enforces the 500 snapshot cap under concurrent saves", async () => {
    const { root, store } = await setup();
    // Seed retained fixtures directly, then exercise publication at the real cap.
    for (let i = 0; i < 499; i++) {
      const at = new Date(Date.parse("2026-10-30T17:00:00Z") + i).toISOString();
      const m = buildSnapshot([], at, at, at);
      await writeFile(join(root, `${m.snapshot.snapshotId.slice(ID_PREFIX.length)}.json`), canonical(m));
    }
    const a = fixture("2026-10-30T17:00:01.000Z"), b = fixture("2026-10-30T17:00:02.000Z");
    const history = buildHistory(b.inputs.rows, b.inputs.readStartedAt, b.inputs.readCompletedAt, b.snapshot.createdAt);
    const volatility = buildVolatility(b.inputs.rows, b.inputs.readStartedAt, b.inputs.readCompletedAt, b.snapshot.createdAt);
    await Promise.all([store.save(a), store.saveHistory(history), store.saveVolatility(volatility)]);
    expect((await readdir(root)).filter(f => f.endsWith(".json"))).toHaveLength(500);
    expect(await store.getHistory(history.history.historyId, b.snapshot.createdAt)).toEqual(history);
  }, 30_000);
  it("rejects oversized volatility evidence before publishing an artifact", async () => {
    const { root, store } = await setup();
    const rows = volatilityRows().map(r => ({ ...r, realtime_start: "x".repeat(256), realtime_end: "x".repeat(256) }));
    const m = buildVolatility(captureRows(rows, 1024), volatilityAt, volatilityAt, volatilityAt);
    expect(Buffer.byteLength(canonical(m))).toBeGreaterThan(1048576);
    await expect(store.saveVolatility(m)).rejects.toThrow("RETENTION_UNAVAILABLE");
    expect(await readdir(root)).toEqual([]);
  });
  it("fails closed on busy publication rather than breaking another writer's lock", async () => {
    const { root, store } = await setup(); await writeFile(join(root, `.writer-${process.pid}-12345678-1234-1234-1234-123456789abc.lock`), "busy");
    await expect(store.save(fixture())).rejects.toThrow("RETENTION_UNAVAILABLE");
  });
  it("recovers a dead process's uniquely named orphan without breaking a live lock", async () => {
    const { root, store } = await setup();
    await writeFile(join(root, ".writer-2147483647-12345678-1234-1234-1234-123456789abc.lock"), "");
    await store.save(fixture());
    expect((await readdir(root)).filter(f => f.endsWith(".lock"))).toEqual([]);
  });
  it("removes orphaned unpublished staging content during the next exclusive sweep", async () => {
    const { root, store } = await setup();
    const name = ".pending-12345678-1234-1234-1234-123456789abc";
    await writeFile(join(root, name), "unpublished source evidence left by a terminated writer");
    await store.sweep("2026-10-30T17:00:00.000Z");
    expect(await readdir(root)).not.toContain(name);
  });
});
