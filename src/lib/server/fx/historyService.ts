import { calendarAt } from "@/lib/fx/calendar";
import type { FxHistoryResponse } from "@/lib/fx/historyContracts";
import { assessHistory, buildHistory, denyHistoryMetrics, emptyHistoryPairs, MAX_HISTORY_ROWS, type FxHistoryManifest } from "./history";
import { captureRows, POLICIES } from "./snapshot";

interface Dependencies {
  now(): string;
  read(startedAt: string): Promise<Record<string, unknown>[]>;
  save(m: FxHistoryManifest): Promise<void>;
  latest(now: string): Promise<FxHistoryManifest | null>;
  get(id: string, now: string): Promise<FxHistoryManifest>;
}
export class FxHistoryService {
  private active: Promise<FxHistoryResponse> | null = null;
  constructor(private readonly deps: Dependencies) {}
  async current(): Promise<FxHistoryResponse> {
    if (!this.active) this.active = this.capture().finally(() => { this.active = null; });
    return this.active;
  }
  private async capture(): Promise<FxHistoryResponse> {
    let phase = "SOURCE_UNAVAILABLE";
    try {
      const startedAt = this.deps.now(), rows = await this.deps.read(startedAt), completedAt = this.deps.now();
      phase = "INTEGRITY_FAILURE";
      const manifest = buildHistory(captureRows(rows, MAX_HISTORY_ROWS), startedAt, completedAt, this.deps.now());
      phase = "RETENTION_UNAVAILABLE";
      await this.deps.save(manifest);
      const assessedAt = this.deps.now();
      return { history: manifest.history, pairs: assessHistory(manifest.history, assessedAt), assessedAt,
        nextCheckAt: calendarAt(assessedAt).nextCheckAt, error: null, retained: null };
    } catch (e) {
      if (phase === "SOURCE_UNAVAILABLE" && (e as Error).message === "FRESHNESS_CALENDAR_UNKNOWN") phase = "FRESHNESS_CALENDAR_UNKNOWN";
      const assessedAt = this.deps.now();
      const message = phase === "SOURCE_UNAVAILABLE" ? "Gold history is unavailable. No new history capture was published."
        : phase === "RETENTION_UNAVAILABLE" ? "History retention is unavailable. No new history capture was published."
          : phase === "FRESHNESS_CALENDAR_UNKNOWN" ? "The current publication calendar is outside reviewed coverage."
            : "History evidence failed integrity validation. No new history capture was published.";
      const failure = { code: phase, message };
      let retained: FxHistoryManifest | null = null;
      try { retained = await this.deps.latest(assessedAt); } catch { /* Never display unverified retained history. */ }
      return { history: null, pairs: retained ? denyHistoryMetrics(retained.history.pairs, failure) : emptyHistoryPairs(phase, message),
        assessedAt, nextCheckAt: calendarAt(assessedAt).nextCheckAt, error: failure,
        retained: retained ? { historyId: retained.history.historyId, cutoffAt: retained.history.cutoffAt,
          schedule: retained.history.schedule, evidence: retained.history.evidence } : null };
    }
  }
  async replay(id: string, at?: string) {
    const m = await this.deps.get(id, at ?? this.deps.now());
    const assessedAt = at ?? this.deps.now();
    const age = Date.parse(assessedAt) - Date.parse(m.history.createdAt);
    if (!Number.isFinite(age) || age < 0 || age >= POLICIES.retention.days * 86_400_000) throw new Error("REPLAY_UNAVAILABLE");
    return { history: m.history, historicalReplay: true, currentConsumptionPermitted: false,
      pairs: assessHistory(m.history, assessedAt), assessedAt, nextCheckAt: calendarAt(assessedAt).nextCheckAt };
  }
}
