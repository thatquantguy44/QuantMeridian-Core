import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createGoldStore } from "../goldStore";
import { buildHistory } from "./history";
import { captureRows } from "./snapshot";
import { readGoldHistoryRows } from "./historyReader";
import { operatingDate } from "@/lib/fx/calendar";

afterEach(() => vi.unstubAllEnvs());
describe("bounded single-statement FX history reader", () => {
  it("reads exactly the selected schedule plus latest guards, preserving gaps and a future latest guard", async () => {
    const root = mkdtempSync(join(tmpdir(), "fx-history-sql-")), file = join(root, "gold.db");
    const Database = createRequire(import.meta.url)("better-sqlite3"), db = new Database(file);
    try {
      db.exec(`CREATE TABLE gold_fred_latest_observation (series_id TEXT, observation_date TEXT, value REAL, is_missing TEXT, revision_number TEXT, realtime_start TEXT, realtime_end TEXT, ingested_at TEXT);
        CREATE TABLE gold_dim_series (series_id TEXT, source TEXT, frequency TEXT, units TEXT);`);
      const insert = db.prepare("INSERT INTO gold_fred_latest_observation VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
      for (const c of ["USD", "JPY", "GBP"]) {
        const id = `ECB:EXR:D.${c}.EUR.SP00.A`;
        db.prepare("INSERT INTO gold_dim_series VALUES (?, 'ecb', 'd', ?)").run(id, `${c} per EUR`);
        for (let ms = Date.parse("2026-01-01T12:00:00Z"); ms <= Date.parse("2026-10-30T12:00:00Z"); ms += 86_400_000) {
          const date = new Date(ms).toISOString().slice(0, 10);
          if (operatingDate(date) && !(c === "JPY" && date === "2026-10-27")) insert.run(id, date, c === "JPY" ? 165 : c === "GBP" ? .88 : 1.1, "0", "1", "", "", "2026-10-30T16:00:00Z");
        }
      }
      // A future latest guard must survive the schedule filter and cannot move
      // unrelated currency windows or be replaced by the older JPY endpoint.
      insert.run("ECB:EXR:D.JPY.EUR.SP00.A", "2026-11-02", 170, "0", "2", "", "", "2026-10-30T16:00:00Z");
      vi.stubEnv("MACRO_DB_BACKEND", ""); vi.stubEnv("MACRO_DB_URL", `sqlite:${file}`);
      const at = "2026-10-30T17:00:00.000Z";
      const rows = await readGoldHistoryRows(createGoldStore(), at);
      expect(rows).toHaveLength(270); // 270 scheduled rows - one gap + one guard
      expect(rows.some(r => r.observation_date === "2026-11-02")).toBe(true);
      const h = buildHistory(captureRows(rows, 320), at, at, at).history;
      expect(h.schedule.dates).toHaveLength(90);
      expect(h.pairs[0].validObservations).toBe(90);
      expect(h.pairs[2].validObservations).toBe(89);
      expect(h.pairs[2].endpointState).toBe("BLOCKED");
      expect(h.pairs[2].changes.every(c => c.state === "UNAVAILABLE")).toBe(true);
    } finally { db.close(); rmSync(root, { recursive: true, force: true }); }
  });
});
