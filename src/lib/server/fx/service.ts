import { lstat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createGoldStore, goldConfigStatus, goldParam, goldTable, type GoldStore } from "../goldStore";
import { calendarAt } from "@/lib/fx/calendar";
import type { FxPairResult, FxResearchResponse, FxSnapshot } from "@/lib/fx/contracts";
import { blockedPairs, buildSnapshot, captureRows, MAPPINGS, POLICIES, type FxManifest } from "./snapshot";
import { FxSnapshotStore } from "./store";
import { FxVolatilityService } from "./volatilityService";
import { readGoldVolatilityRows } from "./volatilityReader";
import { FxHistoryService } from "./historyService";
import { readGoldHistoryRows } from "./historyReader";

export async function readGoldRows(store: GoldStore): Promise<Record<string, unknown>[]> {
  // One statement sees one database statement snapshot, including catalog metadata.
  // Explicit NULL ordering prevents an invalid date being silently skipped.
  return store.raw(`WITH ranked AS (
    SELECT series_id, observation_date, value, is_missing, revision_number, realtime_start, realtime_end, ingested_at,
      DENSE_RANK() OVER (PARTITION BY series_id ORDER BY CASE WHEN observation_date IS NULL THEN 1 ELSE 0 END DESC, observation_date DESC) AS latest_rank
    FROM ${goldTable("fred_latest_observation")}
    WHERE series_id IN (${MAPPINGS.map((_, i) => goldParam(i + 1)).join(", ")})
  ) SELECT r.series_id, r.observation_date, r.value, r.is_missing, r.revision_number,
    r.realtime_start, r.realtime_end, r.ingested_at, d.source, d.frequency, d.units
    FROM ranked r LEFT JOIN ${goldTable("dim_series")} d ON d.series_id = r.series_id
    WHERE r.latest_rank = 1 ORDER BY r.series_id LIMIT 33`, MAPPINGS.map(m => m.seriesId));
}

interface Dependencies {
  read(): Promise<Record<string, unknown>[]>;
  save(m: FxManifest): Promise<void>;
  latest(now: string): Promise<FxManifest | null>;
  get(id: string, now: string): Promise<FxManifest>;
  now(): string;
}
export function assessSnapshot(snapshot: FxSnapshot, at: string): FxPairResult[] {
  const freshness = calendarAt(at);
  return snapshot.pairs.map(pair => {
    if (pair.state !== "ELIGIBLE") return pair;
    const unknown = !freshness.expectedDate || !freshness.nextCheckAt || at < snapshot.cutoffAt;
    if (!unknown && snapshot.observationDate! >= freshness.expectedDate!) return pair;
    const { referenceLevel, allowedPurposes: _allowed, ...rest } = pair;
    return { ...rest, state: unknown ? "BLOCKED" : "DEGRADED", allowedPurposes: [],
      reasons: [{ code: unknown ? "FRESHNESS_CALENDAR_UNKNOWN" : "STALE_SOURCE",
        message: unknown ? "Current calendar/clock admission is unavailable." : "Expected reference publication has not arrived in Gold." }],
      lastObserved: { value: referenceLevel, observationDate: snapshot.observationDate!, units: `${pair.quoteCurrency} per 1 ${pair.baseCurrency}`, sourceId: "ECB" } };
  });
}

export class FxResearchService {
  private active: Promise<FxResearchResponse> | null = null;
  constructor(private readonly deps: Dependencies, readonly history?: FxHistoryService, readonly volatility?: FxVolatilityService) {}
  async current(): Promise<FxResearchResponse> {
    // Coalesce concurrent reads only; this is not a cache or an older capture.
    if (!this.active) this.active = this.capture().finally(() => { this.active = null; });
    return this.active;
  }
  private async capture(): Promise<FxResearchResponse> {
    let phase = "SOURCE_UNAVAILABLE";
    try {
      const started = this.deps.now();
      const rows = await this.deps.read();
      const completed = this.deps.now();
      phase = "INTEGRITY_FAILURE";
      const manifest = buildSnapshot(captureRows(rows), started, completed, this.deps.now());
      phase = "RETENTION_UNAVAILABLE";
      await this.deps.save(manifest);
      const assessedAt = this.deps.now();
      return { snapshot: manifest.snapshot, pairs: assessSnapshot(manifest.snapshot, assessedAt), assessedAt,
        nextCheckAt: calendarAt(assessedAt).nextCheckAt, error: null, retained: null };
    } catch {
      const assessedAt = this.deps.now();
      const message = phase === "SOURCE_UNAVAILABLE" ? "Gold is unconfigured or unavailable. No new snapshot was published."
        : phase === "RETENTION_UNAVAILABLE" ? "Snapshot retention is unavailable. No new snapshot was published."
          : "Gold evidence failed integrity validation. No new snapshot was published.";
      const pairs = blockedPairs(phase, message);
      let previous: FxManifest | null = null;
      try { previous = await this.deps.latest(assessedAt); } catch { /* Unverifiable retained data is never displayed. */ }
      if (previous) pairs.forEach((pair, i) => {
        const old = previous!.snapshot.pairs[i];
        const value = old.state === "ELIGIBLE" ? old.referenceLevel : old.lastObserved?.value;
        if (value !== undefined) pair.lastObserved = { value, observationDate: previous!.snapshot.observationDate!,
          units: `${pair.quoteCurrency} per 1 ${pair.baseCurrency}`, sourceId: "ECB" };
      });
      return { snapshot: null, pairs, assessedAt, nextCheckAt: calendarAt(assessedAt).nextCheckAt,
        error: { code: phase, message }, retained: previous ? { snapshotId: previous.snapshot.snapshotId, cutoffAt: previous.snapshot.cutoffAt } : null };
    }
  }
  async replay(id: string, at?: string) {
    const manifest = await this.deps.get(id, at ?? this.deps.now());
    const assessedAt = at ?? this.deps.now();
    const age = Date.parse(assessedAt) - Date.parse(manifest.snapshot.createdAt);
    if (!Number.isFinite(age) || age < 0 || age >= POLICIES.retention.days * 86_400_000) throw new Error("REPLAY_UNAVAILABLE");
    return { snapshot: manifest.snapshot, historicalReplay: true, currentConsumptionPermitted: false,
      pairs: assessSnapshot(manifest.snapshot, assessedAt), assessedAt, nextCheckAt: calendarAt(assessedAt).nextCheckAt };
  }
}

let singleton: { root: string; service: FxResearchService } | undefined;
export function localFxService(): FxResearchService {
  if (process.env.FX_RESEARCH_LOCAL_ENABLED !== "1" || process.env.NODE_ENV === "production" || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error("LOCAL_NOT_CONFIGURED");
  }
  const base = resolve(process.cwd(), ".data");
  const root = resolve(process.env.FX_RESEARCH_SNAPSHOT_DIR || ".data/fx-reference-snapshots");
  if (dirname(root) !== base) throw new Error("RETENTION_UNAVAILABLE");
  if (singleton?.root === root) return singleton.service;
  const retained = new FxSnapshotStore(root);
  async function safePath() {
    for (const path of [base, root]) {
      try { if ((await lstat(path)).isSymbolicLink()) throw new Error("RETENTION_UNAVAILABLE"); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    }
  }
  function configuredStore() {
    const status = goldConfigStatus();
    if (!status.configured || !["postgres", "sqlite"].includes(status.backend)) throw new Error("SOURCE_UNAVAILABLE");
    return createGoldStore();
  }
  const history = new FxHistoryService({
    now: () => new Date().toISOString(), read: at => readGoldHistoryRows(configuredStore(), at),
    async save(m) { await safePath(); return retained.saveHistory(m); },
    async latest(now) { await safePath(); return retained.latestHistory(now); },
    async get(id, now) { await safePath(); return retained.getHistory(id, now); },
  });
  const volatility = new FxVolatilityService({
    now: () => new Date().toISOString(), read: at => readGoldVolatilityRows(configuredStore(), at),
    async save(m) { await safePath(); return retained.saveVolatility(m); },
    async latest(now) { await safePath(); return retained.latestVolatility(now); },
    async get(id, now) { await safePath(); return retained.getVolatility(id, now); },
  });
  const service = new FxResearchService({
    now: () => new Date().toISOString(),
    async read() {
      return readGoldRows(configuredStore());
    },
    async save(m) { await safePath(); return retained.save(m); },
    async latest(now) { await safePath(); return retained.latest(now); },
    async get(id, now) { await safePath(); return retained.get(id, now); },
  }, history, volatility);
  const sweep = () => safePath().then(() => retained.sweep(new Date().toISOString())).catch(() => {});
  void sweep();
  const timer = setInterval(() => { void sweep(); }, 60_000);
  timer.unref();
  singleton = { root, service };
  return service;
}
export function localFxHistoryService(): FxHistoryService {
  const service = localFxService().history;
  if (!service) throw new Error("LOCAL_NOT_CONFIGURED");
  return service;
}

export function localFxVolatilityService(): FxVolatilityService {
  const service = localFxService().volatility;
  if (!service) throw new Error("LOCAL_NOT_CONFIGURED");
  return service;
}
