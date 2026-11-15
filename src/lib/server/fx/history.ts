import { calendarAt, operatingDate } from "@/lib/fx/calendar";
import { FX_PAIRS, type FxReason, type FxSourceRow } from "@/lib/fx/contracts";
import { HISTORY_INTERVALS, HISTORY_ID_PREFIX, HISTORY_ID_PATTERN, type FxHistory, type FxHistoryChange, type FxHistoryPoint, type FxPairHistory } from "@/lib/fx/historyContracts";
import { buildSnapshot, canonical, digest, MAPPINGS, POLICIES, validateRows } from "./snapshot";

export { HISTORY_ID_PREFIX, HISTORY_ID_PATTERN } from "@/lib/fx/historyContracts";
export const MAX_HISTORY_ROWS = 320;
const HISTORY_V1 = Object.freeze({ version: "ecb-history90/1", method: "ecb-simple-observed-changes/1",
  observations: 90 as const, intervals: Object.freeze([1, 5, 21]), maxRows: MAX_HISTORY_ROWS,
  gaps: "NO_FILL_NO_BRIDGE", staleEndpoint: "SUPPRESS_CURRENT_CHANGES" });
export const HISTORY_POLICIES = Object.freeze({ history: HISTORY_V1, source: POLICIES });
const registry = new Map([[digest(HISTORY_POLICIES), HISTORY_POLICIES]]);
export interface FxHistoryManifest {
  history: FxHistory;
  inputs: { rows: FxSourceRow[]; readStartedAt: string; readCompletedAt: string };
  policies: typeof HISTORY_POLICIES;
}
const reason = (code: string, message: string): FxReason => ({ code, message });

/** Explicit reviewed date set also used by the SQL reader to select its window. */
export function reviewedDates(through: string, calendar = POLICIES.calendar): string[] {
  const out = [];
  for (let ms = Date.parse("2026-01-01T12:00:00Z"); ms <= Date.parse(`${through}T12:00:00Z`); ms += 86_400_000) {
    const date = new Date(ms).toISOString().slice(0, 10);
    if (operatingDate(date, calendar) === null) break;
    if (operatingDate(date, calendar)) out.push(date);
  }
  return out;
}
export function latestGuards(rows: FxSourceRow[]) {
  return MAPPINGS.flatMap(m => {
    const source = rows.filter(r => r.seriesId === m.seriesId);
    const date = source.some(r => r.observationDate === null) ? null : source.map(r => r.observationDate).sort().at(-1);
    return source.filter(r => r.observationDate === date);
  }).sort((a, b) => canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0);
}
export function dailyValidationRows(rows: FxSourceRow[]) {
  // All original rows remain in manifest.inputs. A daily validator needs only
  // two distinct rows per leg to prove a conflict; identical duplicates add no
  // competing evidence. This avoids applying S01's latest-guard cap to history.
  return MAPPINGS.flatMap(m => {
    const unique = new Map(rows.filter(r => r.seriesId === m.seriesId).map(r => [canonical(r), r]));
    return [...unique.values()].slice(0, 2);
  }).sort((a, b) => canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0);
}
function changesFor(pair: Pick<FxPairHistory, "points" | "endpointState" | "endpointReasons">): FxHistoryChange[] {
  const firstObserved = pair.points.findIndex(p => p.state === "OBSERVED");
  return HISTORY_INTERVALS.map(intervals => {
    const required = intervals + 1, start = pair.points.length - required;
    const window = pair.points.slice(Math.max(0, start));
    const observed = window.filter(p => p.state === "OBSERVED");
    const first = start >= 0 ? window[0] : null, last = window.at(-1);
    const base = { intervals, startDate: first?.observationDate ?? null, endDate: last?.observationDate ?? null,
      calendarDays: first && last ? (Date.parse(last.observationDate) - Date.parse(first.observationDate)) / 86_400_000 : null,
      observationsRequired: required, observationsAvailable: observed.length };
    let reasons: FxReason[] = [];
    const explicitGap = window.some(p => p.state === "BLOCKED" || p.reasons.some(r => r.code === "MISSING_OBSERVATION"));
    if (pair.endpointState === "DEGRADED") reasons = [reason("STALE_ENDPOINT", "The latest endpoint is stale; current change figures are unavailable.")];
    else if (pair.endpointState !== "ELIGIBLE") reasons = [reason("ENDPOINT_UNAVAILABLE", "The latest source endpoint is not admitted."), ...pair.endpointReasons];
    else if (explicitGap) reasons = [reason("HISTORY_GAP", "The change window contains a present but invalid, missing or conflicting source observation.")];
    else if (start < 0 || firstObserved < 0 || start < firstObserved) reasons = [reason("INSUFFICIENT_HISTORY", `This change requires ${required} consecutive qualified observations.`)];
    else if (observed.length !== required) reasons = [reason("HISTORY_GAP", "The change window contains a missing, invalid or conflicting observation; gaps are not bridged.")];
    const simplePercent = reasons.length ? null : 100 * (last!.displayLevel! / first!.displayLevel! - 1);
    if (simplePercent !== null && !Number.isFinite(simplePercent)) reasons.push(reason("INVALID_CHANGE", "The derived change is not finite."));
    return { ...base, state: reasons.length ? "UNAVAILABLE" : "AVAILABLE", simplePercent: reasons.length ? null : simplePercent, reasons };
  });
}
export function emptyHistoryPairs(code: string, message: string): FxPairHistory[] {
  return FX_PAIRS.map((pair, i) => {
    const base = { ...pair, endpointState: "BLOCKED" as const, endpointReasons: [reason(code, message)],
      derivation: (["DIRECT", "INVERSE", "CROSS", "CROSS"] as const)[i], points: [], validObservations: 0 };
    return { ...base, changes: changesFor(base) };
  });
}
export function denyHistoryMetrics(pairs: FxPairHistory[], failure: FxReason): FxPairHistory[] {
  return pairs.map(p => {
    const blocked = { ...p, endpointState: "BLOCKED" as const, endpointReasons: [failure] };
    return { ...blocked, changes: changesFor(blocked) };
  });
}
export function buildHistory(rows: FxSourceRow[], readStartedAt: string, readCompletedAt: string, createdAt: string,
  policyDefinition = HISTORY_POLICIES): FxHistoryManifest {
  validateRows(rows, MAX_HISTORY_ROWS);
  const policies = registry.get(digest(policyDefinition));
  if (!policies) throw new Error("REPLAY_VERSION_UNSUPPORTED");
  const endpoint = buildSnapshot(latestGuards(rows), readStartedAt, readCompletedAt, createdAt, policies.source).snapshot;
  const calendarKnown = !!endpoint.freshness.expectedDate && !!endpoint.freshness.nextCheckAt;
  const dates = endpoint.observationDate && calendarKnown ? reviewedDates(endpoint.observationDate, policies.source.calendar).slice(-90) : [];
  const calendarTruncated = !!endpoint.observationDate && calendarKnown && dates.length < 90;
  const scheduleReasons = !calendarKnown ? [reason("FRESHNESS_CALENDAR_UNKNOWN", "Current publication-calendar admission is unavailable.")]
    : calendarTruncated ? [reason("HISTORY_CALENDAR_TRUNCATED", "History stops at the earliest reviewed calendar date.")] : [];
  const pointsByPair: FxHistoryPoint[][] = FX_PAIRS.map(() => []);
  const evidence = new Map<string, FxHistory["evidence"][number]>();
  for (const date of dates) {
    const daily = buildSnapshot(dailyValidationRows(rows.filter(r => r.observationDate === date)), readStartedAt, readCompletedAt, createdAt, policies.source).snapshot;
    daily.pairs.forEach((pair, i) => {
      pair.evidence.forEach(e => evidence.set(e.evidenceId, e));
      const value = pair.state === "ELIGIBLE" ? pair.referenceLevel : pair.state === "DEGRADED" ? pair.lastObserved?.value : undefined;
      pointsByPair[i].push({ observationDate: date, state: value !== undefined ? "OBSERVED" : pair.state === "BLOCKED" ? "BLOCKED" : "MISSING",
        displayLevel: value ?? null, evidenceIds: pair.evidence.map(e => e.evidenceId),
        reasons: value !== undefined ? [] : pair.reasons });
    });
  }
  const pairs = endpoint.pairs.map((p, i) => {
    const pair = { baseCurrency: p.baseCurrency, quoteCurrency: p.quoteCurrency, endpointState: p.state,
      endpointReasons: p.reasons, derivation: p.derivation.kind, points: pointsByPair[i], validObservations: pointsByPair[i].filter(v => v.state === "OBSERVED").length };
    return { ...pair, changes: changesFor(pair) };
  });
  const history: FxHistory = { historyId: "", contractVersion: "fx-reference-history/1", cutoffAt: readCompletedAt, createdAt,
    knowledgeBasis: "CURRENT_VINTAGE", dataClass: "DESCRIPTIVE_HISTORY", allowedPurposes: ["RESEARCH"], exportDisposition: "DENIED",
    sourceSetId: "ECB_EURO_REFERENCE_DAILY", observationDate: endpoint.observationDate, requestedPairs: FX_PAIRS,
    historyPolicyVersion: policies.history.version, methodVersion: policies.history.method, sourcePolicyVersion: policies.source.source,
    freshness: endpoint.freshness, schedule: { dates, requestedObservations: 90, calendarTruncated, reasons: scheduleReasons },
    pairs, evidence: [...evidence.values()].sort((a, b) => a.evidenceId < b.evidenceId ? -1 : a.evidenceId > b.evidenceId ? 1 : 0) };
  const manifest = { history, inputs: { rows, readStartedAt, readCompletedAt }, policies };
  history.historyId = HISTORY_ID_PREFIX + manifestDigest(manifest);
  return manifest;
}
function manifestDigest(manifest: FxHistoryManifest) {
  const { historyId: _id, ...history } = manifest.history;
  return digest({ ...manifest, history });
}
export function verifyHistoryManifest(value: unknown): FxHistoryManifest {
  try {
    const m = value as FxHistoryManifest;
    if (!HISTORY_ID_PATTERN.test(m.history.historyId) || HISTORY_ID_PREFIX + manifestDigest(m) !== m.history.historyId) throw new Error();
    const rebuilt = buildHistory(m.inputs.rows, m.inputs.readStartedAt, m.inputs.readCompletedAt, m.history.createdAt, m.policies);
    if (canonical(rebuilt) !== canonical(m)) throw new Error();
    return m;
  } catch (e) {
    if ((e as Error).message === "REPLAY_VERSION_UNSUPPORTED") throw e;
    throw new Error("INTEGRITY_FAILURE");
  }
}
export function assessHistory(history: FxHistory, at: string): FxPairHistory[] {
  const freshness = calendarAt(at);
  const unknown = !freshness.expectedDate || !freshness.nextCheckAt || Date.parse(at) < Date.parse(history.cutoffAt);
  return history.pairs.map(pair => {
    if (pair.endpointState !== "ELIGIBLE") return pair;
    if (!unknown && history.observationDate! >= freshness.expectedDate!) return pair;
    const updated = { ...pair, endpointState: unknown ? "BLOCKED" as const : "DEGRADED" as const,
      endpointReasons: [reason(unknown ? "FRESHNESS_CALENDAR_UNKNOWN" : "STALE_SOURCE", "Current endpoint freshness is unavailable.")] };
    return { ...updated, changes: changesFor(updated) };
  });
}
