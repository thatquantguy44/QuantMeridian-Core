import { calendarAt } from "@/lib/fx/calendar";
import type { FxVolatilityResponse } from "@/lib/fx/volatilityContracts";
import { assessVolatility, buildVolatility, denyVolatilityMetrics, emptyVolatilityPairs, MAX_VOLATILITY_ROWS, type FxVolatilityManifest } from "./volatility";
import { captureRows, POLICIES } from "./snapshot";

interface Dependencies {
  now(): string;
  read(startedAt: string): Promise<Record<string, unknown>[]>;
  save(m: FxVolatilityManifest): Promise<void>;
  latest(now: string): Promise<FxVolatilityManifest | null>;
  get(id: string, now: string): Promise<FxVolatilityManifest>;
}
export class FxVolatilityService {
  private active: Promise<FxVolatilityResponse> | null = null;
  constructor(private readonly deps: Dependencies) {}
  async current(): Promise<FxVolatilityResponse> {
    if (!this.active) this.active = this.capture().finally(() => { this.active = null; });
    return this.active;
  }
  private async capture(): Promise<FxVolatilityResponse> {
    let phase = "SOURCE_UNAVAILABLE";
    try {
      const startedAt = this.deps.now(), rows = await this.deps.read(startedAt), completedAt = this.deps.now();
      phase = "INTEGRITY_FAILURE";
      const manifest = buildVolatility(captureRows(rows, MAX_VOLATILITY_ROWS), startedAt, completedAt, this.deps.now());
      phase = "RETENTION_UNAVAILABLE";
      await this.deps.save(manifest);
      const assessedAt = this.deps.now();
      return { volatility: manifest.volatility, pairs: assessVolatility(manifest.volatility, assessedAt), assessedAt,
        nextCheckAt: calendarAt(assessedAt).nextCheckAt, error: null, retained: null };
    } catch (e) {
      if (phase === "SOURCE_UNAVAILABLE" && (e as Error).message === "FRESHNESS_CALENDAR_UNKNOWN") phase = "FRESHNESS_CALENDAR_UNKNOWN";
      const assessedAt = this.deps.now();
      const message = phase === "SOURCE_UNAVAILABLE" ? "Gold volatility is unavailable. No new volatility capture was published."
        : phase === "RETENTION_UNAVAILABLE" ? "Volatility retention is unavailable. No new volatility capture was published."
          : phase === "FRESHNESS_CALENDAR_UNKNOWN" ? "The current publication calendar is outside reviewed coverage."
            : "Volatility evidence failed integrity validation. No new volatility capture was published.";
      const failure = { code: phase, message };
      let retained: FxVolatilityManifest | null = null;
      try { retained = await this.deps.latest(assessedAt); } catch { /* Never display unverified retained volatility. */ }
      return { volatility: null, pairs: retained ? denyVolatilityMetrics(retained.volatility.pairs, failure) : emptyVolatilityPairs(phase, message),
        assessedAt, nextCheckAt: calendarAt(assessedAt).nextCheckAt, error: failure,
        retained: retained ? { volatilityId: retained.volatility.volatilityId, cutoffAt: retained.volatility.cutoffAt,
          schedule: retained.volatility.schedule, evidence: retained.volatility.evidence } : null };
    }
  }
  async replay(id: string, at?: string) {
    const m = await this.deps.get(id, at ?? this.deps.now());
    const assessedAt = at ?? this.deps.now();
    const age = Date.parse(assessedAt) - Date.parse(m.volatility.createdAt);
    if (!Number.isFinite(age) || age < 0 || age >= POLICIES.retention.days * 86_400_000) throw new Error("REPLAY_UNAVAILABLE");
    return { volatility: m.volatility, historicalReplay: true, currentConsumptionPermitted: false,
      pairs: assessVolatility(m.volatility, assessedAt), assessedAt, nextCheckAt: calendarAt(assessedAt).nextCheckAt };
  }
}
