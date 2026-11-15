import { afterEach, describe, expect, it, vi } from "vitest";
import { FxResearchService, readGoldRows, localFxService } from "./service";
import { buildSnapshot, captureRows } from "./snapshot";
import type { FxManifest } from "./snapshot";
import type { GoldStore } from "../goldStore";
import { createGoldStore } from "../goldStore";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const at = "2026-10-30T17:00:00.000Z";
function rows() { return ["USD", "JPY", "GBP"].map((c, i) => ({
  series_id: `ECB:EXR:D.${c}.EUR.SP00.A`, observation_date: "2026-10-30", value: [1.1, 165, .88][i], is_missing: "0",
  revision_number: "1", realtime_start: "", realtime_end: "", ingested_at: at, source: "ecb", frequency: "d", units: `${c} per EUR`,
})); }
function deps() {
  let retained: FxManifest | null = null;
  return { save: vi.fn(async (m: FxManifest) => { retained = m; }), latest: vi.fn(async () => retained),
    get: vi.fn(async () => retained!), read: vi.fn(async () => rows()), now: () => at };
}
afterEach(() => vi.unstubAllEnvs());
describe("FX Gold service boundary", () => {
  it("reads one bounded statement with fixed parameters, without cached latest/history", async () => {
    const raw = vi.fn(async (_sql: string, _params: unknown[]) => rows());
    await readGoldRows({ raw } as unknown as GoldStore);
    expect(raw).toHaveBeenCalledTimes(1);
    expect(raw.mock.calls[0]).toEqual([expect.stringContaining("DENSE_RANK()"), [
      "ECB:EXR:D.USD.EUR.SP00.A", "ECB:EXR:D.JPY.EUR.SP00.A", "ECB:EXR:D.GBP.EUR.SP00.A",
    ]]);
    expect(String(raw.mock.calls[0][0])).toContain("LIMIT 33");
  });
  it("executes the real SQL through the read-only SQLite Gold backend without skipping a bad latest value", async () => {
    const root = mkdtempSync(join(tmpdir(), "fx-sql-")), file = join(root, "gold.db");
    const Database = createRequire(import.meta.url)("better-sqlite3");
    const db = new Database(file);
    try {
      db.exec(`CREATE TABLE gold_fred_latest_observation (series_id TEXT, observation_date TEXT, value REAL, is_missing TEXT, revision_number TEXT, realtime_start TEXT, realtime_end TEXT, ingested_at TEXT);
        CREATE TABLE gold_dim_series (series_id TEXT, source TEXT, frequency TEXT, units TEXT);`);
      const insert = db.prepare("INSERT INTO gold_fred_latest_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      const dim = db.prepare("INSERT INTO gold_dim_series VALUES (?, ?, ?, ?)");
      for (const r of rows()) {
        insert.run(r.series_id, r.observation_date, r.value, r.is_missing, r.revision_number, r.realtime_start, r.realtime_end, r.ingested_at);
        dim.run(r.series_id, r.source, r.frequency, r.units);
      }
      const r = rows()[0];
      insert.run(r.series_id, "2026-11-02", 0, "0", "2", "", "", at);
      vi.stubEnv("MACRO_DB_BACKEND", ""); vi.stubEnv("MACRO_DB_URL", `sqlite:${file}`);
      const actual = await readGoldRows(createGoldStore());
      expect(actual).toHaveLength(3);
      const manifest = buildSnapshot(captureRows(actual), "2026-11-02T17:00:00.000Z", "2026-11-02T17:00:00.000Z", "2026-11-02T17:00:00.000Z");
      expect(manifest.snapshot.pairs.every(p => p.state === "BLOCKED")).toBe(true);
    } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
  });
  it("publishes only after retention and reassesses fresh frozen evidence at a later deadline", async () => {
    const d = deps(); const service = new FxResearchService(d);
    const first = await service.current();
    expect(d.save).toHaveBeenCalledTimes(1);
    expect(first.pairs.every(p => p.state === "ELIGIBLE")).toBe(true);
    const frozen = first.snapshot!;
    d.read.mockRejectedValue(new Error("password=secret"));
    const failed = await service.current();
    expect(failed.snapshot).toBeNull(); expect(failed.retained?.snapshotId).toBe(frozen.snapshotId);
    expect(JSON.stringify(failed)).not.toContain("secret");
    expect(failed.pairs.every(p => p.state === "BLOCKED" && p.referenceLevel === undefined && !!p.lastObserved)).toBe(true);
    const replay = await service.replay(frozen.snapshotId, "2026-11-02T16:00:00.000Z");
    expect(replay.historicalReplay).toBe(true); expect(replay.currentConsumptionPermitted).toBe(false);
    expect(replay.snapshot).toEqual(frozen);
    expect(replay.pairs.every(p => p.state === "DEGRADED" && p.referenceLevel === undefined)).toBe(true);
  });
  it("does not expose a new eligible snapshot on persistence failure", async () => {
    const d = deps(); d.save.mockRejectedValue(new Error("disk secret"));
    const response = await new FxResearchService(d).current();
    expect(response.snapshot).toBeNull(); expect(response.error?.code).toBe("RETENTION_UNAVAILABLE");
    expect(response.pairs.every(p => p.state === "BLOCKED" && p.referenceLevel === undefined)).toBe(true);
  });
  it("uses completion time for the replay assessment when retrieval crosses a release deadline", async () => {
    const d = deps(), service = new FxResearchService(d); const first = await service.current();
    let clock = "2026-11-02T15:59:59.000Z"; d.now = () => clock;
    const stored = buildSnapshot(captureRows(rows()), at, at, at);
    d.get.mockImplementation(async () => { clock = "2026-11-02T16:00:01.000Z"; return stored; });
    const result = await service.replay(first.snapshot!.snapshotId);
    expect(result.assessedAt).toBe(clock); expect(result.pairs[0].state).toBe("DEGRADED");
  });
  it("fails local configuration closed in production, without opt-in, or with an escaping path", () => {
    vi.stubEnv("FX_RESEARCH_LOCAL_ENABLED", ""); expect(() => localFxService()).toThrow("LOCAL_NOT_CONFIGURED");
    vi.stubEnv("FX_RESEARCH_LOCAL_ENABLED", "1"); vi.stubEnv("NODE_ENV", "production");
    expect(() => localFxService()).toThrow("LOCAL_NOT_CONFIGURED");
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("FX_RESEARCH_SNAPSHOT_DIR", "../outside");
    expect(() => localFxService()).toThrow("RETENTION_UNAVAILABLE");
  });
  it("rejects a replay for an absent ID without a fresh Gold query", async () => {
    const d = deps(); d.get.mockRejectedValue(new Error("REPLAY_UNAVAILABLE"));
    await expect(new FxResearchService(d).replay("unknown")).rejects.toThrow("REPLAY_UNAVAILABLE");
    expect(d.read).not.toHaveBeenCalled();
  });
});
