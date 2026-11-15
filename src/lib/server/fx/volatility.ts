import { calendarAt } from "@/lib/fx/calendar";
import { volatilityDates, VOLATILITY_CALENDAR_VERSION, VOLATILITY_CALENDAR_EVIDENCE } from "@/lib/fx/volatilityCalendar";
import { calculateVolatility } from "@/lib/fx/volatility";
import { VOLATILITY_ID_PREFIX, VOLATILITY_ID_PATTERN, VOLATILITY_METHOD, VOLATILITY_WINDOWS,
  type FxVolatility, type FxPairVolatility } from "@/lib/fx/volatilityContracts";
import type { FxSourceRow, FxReason } from "@/lib/fx/contracts";
import { buildSnapshot, canonical, digest, POLICIES, validateRows, VOLATILITY_HISTORY_POLICIES } from "./snapshot";
import { latestGuards, dailyValidationRows, emptyHistoryPairs } from "./history";

export { volatilityDates } from "@/lib/fx/volatilityCalendar";
export const MAX_VOLATILITY_ROWS = 1024;
export const VOLATILITY_POLICIES = Object.freeze({ source: POLICIES, historicalSource: VOLATILITY_HISTORY_POLICIES,
  calendarEvidence: VOLATILITY_CALENDAR_EVIDENCE,
  volatility: Object.freeze({ version: "ecb-volatility253/1", method: VOLATILITY_METHOD, windows: VOLATILITY_WINDOWS,
    observations: 253, maxRows: MAX_VOLATILITY_ROWS, estimator: "SAMPLE_CENTERED_LOG_RETURNS", annualizationFactor: 252,
    gaps: "NO_FILL_NO_BRIDGE", staleEndpoint: "SUPPRESS_CURRENT_VOLATILITY", maxBytes: 1048576 }),
});
export interface FxVolatilityManifest {
  volatility: FxVolatility;
  inputs: { rows: FxSourceRow[]; readStartedAt: string; readCompletedAt: string };
  policies: typeof VOLATILITY_POLICIES;
}
const policyHash = digest(VOLATILITY_POLICIES);
export function emptyVolatilityPairs(code: string, message: string): FxPairVolatility[] {
  return emptyHistoryPairs(code, message).map(({ changes: _changes, ...pair }) => ({ ...pair,
    metrics: calculateVolatility(pair), historicalMetrics: calculateHistoricalMetrics(pair) }));
}
export function denyVolatilityMetrics(pairs: FxPairVolatility[], failure: FxReason): FxPairVolatility[] {
  return pairs.map(pair => { const denied = { ...pair, endpointState: "BLOCKED" as const, endpointReasons: [failure] };
    return { ...denied, metrics: calculateVolatility(denied) }; });
}
function calculateHistoricalMetrics(pair: Pick<FxPairVolatility, "points" | "endpointState" | "endpointReasons">, calendarTruncated = false) {
  return calculateVolatility({ ...pair, endpointState: "ELIGIBLE", endpointReasons: [] }, calendarTruncated);
}
export function buildVolatility(rows: FxSourceRow[], readStartedAt: string, readCompletedAt: string, createdAt: string,
  policyDefinition = VOLATILITY_POLICIES): FxVolatilityManifest {
  if (digest(policyDefinition) !== policyHash) throw new Error("REPLAY_VERSION_UNSUPPORTED");
  validateRows(rows, MAX_VOLATILITY_ROWS);
  const endpoint = buildSnapshot(latestGuards(rows), readStartedAt, readCompletedAt, createdAt).snapshot;
  const known = !!endpoint.freshness.expectedDate && !!endpoint.freshness.nextCheckAt;
  const dates = known && endpoint.observationDate ? volatilityDates(endpoint.observationDate).slice(-253) : [];
  const calendarTruncated = !!endpoint.observationDate && known && dates.length < 253;
  const reasons = !known ? [{ code: "FRESHNESS_CALENDAR_UNKNOWN", message: "Current freshness coverage is unavailable." }]
    : calendarTruncated ? [{ code: "HISTORY_CALENDAR_TRUNCATED", message: "History stops at the earliest reviewed historical calendar date." }] : [];
  const points: FxPairVolatility["points"][] = endpoint.pairs.map(() => []);
  const evidence = new Map<string, FxVolatility["evidence"][number]>();
  for (const date of dates) {
    const daily = buildSnapshot(dailyValidationRows(rows.filter(r => r.observationDate === date)), readStartedAt, readCompletedAt, createdAt, VOLATILITY_HISTORY_POLICIES).snapshot;
    daily.pairs.forEach((pair, i) => {
      pair.evidence.forEach(e => evidence.set(e.evidenceId, { evidenceId: e.evidenceId, seriesId: e.seriesId, sourceLevel: e.sourceLevel,
        sourceUnit: e.sourceUnit, observationDate: e.observationDate, revisionId: e.revisionId, upstreamRecordedAt: e.upstreamRecordedAt }));
      const value = pair.state === "ELIGIBLE" ? pair.referenceLevel : pair.state === "DEGRADED" ? pair.lastObserved?.value : undefined;
      points[i].push({ observationDate: date, state: value !== undefined ? "OBSERVED" : pair.state === "BLOCKED" ? "BLOCKED" : "MISSING",
        displayLevel: value ?? null, evidenceIds: pair.evidence.map(e => e.evidenceId), reasons: value !== undefined ? [] : pair.reasons });
    });
  }
  const pairs = endpoint.pairs.map((p, i) => {
    const pair = { baseCurrency: p.baseCurrency, quoteCurrency: p.quoteCurrency, endpointState: p.state,
      endpointReasons: p.reasons, derivation: p.derivation.kind, points: points[i], validObservations: points[i].filter(p => p.state === "OBSERVED").length };
    return { ...pair, metrics: calculateVolatility(pair, calendarTruncated), historicalMetrics: calculateHistoricalMetrics(pair, calendarTruncated) };
  });
  const volatility: FxVolatility = { volatilityId: "", contractVersion: "fx-reference-volatility/1", createdAt, cutoffAt: readCompletedAt,
    observationDate: endpoint.observationDate, knowledgeBasis: "CURRENT_VINTAGE", allowedPurposes: ["RESEARCH"], exportDisposition: "DENIED",
    sourceSetId: "ECB_EURO_REFERENCE_DAILY", methodVersion: VOLATILITY_METHOD, estimator: "SAMPLE_CENTERED_LOG_RETURNS", annualizationFactor: 252,
    policyVersion: "ecb-volatility253/1", historicalCalendarVersion: VOLATILITY_CALENDAR_VERSION,
    freshness: endpoint.freshness, schedule: { dates, requestedObservations: 253, calendarTruncated, reasons }, pairs,
    goldReadStartedAt: readStartedAt, knownByAt: readCompletedAt, publishedAt: null, receiptAt: null, goldAvailableAt: null,
    evidence: [...evidence.values()].sort((a,b) => a.evidenceId.localeCompare(b.evidenceId)) };
  const m = { volatility, inputs: { rows, readStartedAt, readCompletedAt }, policies: VOLATILITY_POLICIES };
  volatility.volatilityId = VOLATILITY_ID_PREFIX + manifestDigest(m);
  return m;
}
function manifestDigest(m: FxVolatilityManifest) {
  const { volatilityId: _id, ...volatility } = m.volatility;
  // Historical metrics are deterministic display derivatives; excluding them keeps v1 replay IDs stable.
  const pairs = volatility.pairs.map(({ historicalMetrics: _historicalMetrics, ...pair }) => pair);
  return digest({ ...m, volatility: { ...volatility, pairs } });
}
export function verifyVolatilityManifest(value: unknown): FxVolatilityManifest {
  try {
    const m = value as FxVolatilityManifest;
    if (!VOLATILITY_ID_PATTERN.test(m.volatility.volatilityId) || m.volatility.volatilityId !== VOLATILITY_ID_PREFIX + manifestDigest(m)) throw new Error();
    const rebuilt = buildVolatility(m.inputs.rows, m.inputs.readStartedAt, m.inputs.readCompletedAt, m.volatility.createdAt, m.policies);
    const normalized = m.volatility.pairs.every(pair => Array.isArray(pair.historicalMetrics)) ? m : {
      ...m,
      volatility: { ...m.volatility, pairs: m.volatility.pairs.map((pair, i) => ({ ...pair, historicalMetrics: rebuilt.volatility.pairs[i].historicalMetrics })) },
    };
    if (canonical(rebuilt) !== canonical(normalized)) throw new Error();
    return normalized;
  } catch (e) {
    if ((e as Error).message === "REPLAY_VERSION_UNSUPPORTED") throw e;
    throw new Error("INTEGRITY_FAILURE");
  }
}
export function assessVolatility(v: FxVolatility, at: string): FxPairVolatility[] {
  const fresh = calendarAt(at), unknown = !fresh.expectedDate || !fresh.nextCheckAt || Date.parse(at) < Date.parse(v.cutoffAt);
  return v.pairs.map(pair => {
    if (pair.endpointState !== "ELIGIBLE" || !unknown && v.observationDate! >= fresh.expectedDate!) return pair;
    const updated = { ...pair, endpointState: unknown ? "BLOCKED" as const : "DEGRADED" as const,
      endpointReasons: [{ code: unknown ? "FRESHNESS_CALENDAR_UNKNOWN" : "STALE_SOURCE", message: "Current endpoint freshness is unavailable." }] };
    return { ...updated, metrics: calculateVolatility(updated, v.schedule.calendarTruncated) };
  });
}
