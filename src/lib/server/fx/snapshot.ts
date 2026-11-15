import { createHash } from "node:crypto";
import { VOLATILITY_CALENDAR, VOLATILITY_CALENDAR_VERSION, VOLATILITY_CALENDAR_EVIDENCE } from "@/lib/fx/volatilityCalendar";
import { FX_PAIRS, type EvidenceValue, type FxEvidence, type FxPairResult, type FxReason, type FxSnapshot, type FxSourceRow, type JsonValue } from "@/lib/fx/contracts";
import { calendarAt, operatingDate, TARGET_CLOSURES } from "@/lib/fx/calendar";

export const MAPPINGS = ["USD", "JPY", "GBP"].map(currency => ({
  currency, seriesId: `ECB:EXR:D.${currency}.EUR.SP00.A`, units: `${currency} per EUR`,
}));
export const ID_PREFIX = "fx-reference-snapshot/1:sha256:";
export const ID_PATTERN = /^fx-reference-snapshot\/1:sha256:[a-f0-9]{64}$/;
// Immutable retained v1 definition. Future policy revisions must add registry
// entries, preserving this definition and its numerical/calendar dispatch.
const APPROVED_V1 = {
  selection: "ecb-current-max-date/1", freshness: "ecb-target-17-berlin/1",
  convention: "ecb-fx-core4/1", method: "ecb-reference-arithmetic/1",
  source: "ecb-fx-internal-research/1", allowedPurposes: ["RESEARCH"], exportDisposition: "DENIED",
  reviewedOn: "2026-10-30", calendarVersion: "ecb-target-2026-2028/1", calendar: TARGET_CLOSURES, mappings: MAPPINGS,
  retention: { days: 30, snapshots: 500 },
  attribution: "Source: ECB reference rates; terminal-derived inverse/cross where indicated. Information only.",
  sourceEvidence: [
    { url: "https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html",
      reviewedSummary: "Public ESCB statistics may be reused with attribution and unchanged statistics/metadata; third-party data require originator permission." },
    { url: "https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html",
      reviewedSummary: "Reproduction must be accurate and cite ECB. Modifications must be identified. Paid incorporation requires free-source disclosures." },
    { url: "https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html",
      reviewedSummary: "EUR-base informational reference rates, usually around 16:00 CET on working days except TARGET closures; transaction use strongly discouraged." },
    { url: "https://www.ecb.europa.eu/ecb/contacts/working-hours/html/index.en.html",
      reviewedSummary: "Only starred TARGET closures in the 2026–2028 lists are included in the retained calendar." },
  ],
};
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
export const POLICIES = freeze(APPROVED_V1);
export function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value) && !Object.is(value, -0)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  throw new Error("INTEGRITY_FAILURE");
}
export function digest(value: unknown) { return createHash("sha256").update(canonical(value)).digest("hex"); }
function encodeValue(value: unknown): EvidenceValue {
  if (value === null) return { kind: "NULL" };
  if (typeof value === "number") {
    if (Object.is(value, -0)) return { kind: "NEGATIVE_ZERO" };
    return Number.isFinite(value) ? { kind: "FINITE", value } : { kind: "NONFINITE", value: String(value) as "NaN" | "Infinity" | "-Infinity" };
  }
  if (canonical(value).length > 256) throw new Error("INTEGRITY_FAILURE");
  return { kind: "INVALID", value: value as JsonValue };
}
function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > 256) throw new Error("INTEGRITY_FAILURE");
  return value;
}
function scalar(value: unknown): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return text(value);
}
export function captureRows(rows: Record<string, unknown>[], maximumRows = 32): FxSourceRow[] {
  if (rows.length > maximumRows) throw new Error("INTEGRITY_FAILURE");
  return rows.map(r => {
    const seriesId = text(r.series_id);
    if (!MAPPINGS.some(m => m.seriesId === seriesId)) throw new Error("INTEGRITY_FAILURE");
    return { seriesId: seriesId!, observationDate: text(r.observation_date), value: encodeValue(r.value),
      isMissing: scalar(r.is_missing), revisionNumber: scalar(r.revision_number), realtimeStart: text(r.realtime_start),
      realtimeEnd: text(r.realtime_end), ingestedAt: text(r.ingested_at), source: text(r.source), frequency: text(r.frequency), units: text(r.units) };
  }).sort((a, b) => canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0);
}
export interface FxManifest {
  snapshot: FxSnapshot;
  inputs: { rows: FxSourceRow[]; readStartedAt: string; readCompletedAt: string };
  policies: typeof POLICIES;
  policyEvidenceHash: string;
}
// Additive historical qualification definition; the default v1 freshness policy
// and its serialized contents remain unchanged. Only volatility daily history
// requests this definition; current endpoint admission still uses POLICIES.
export const VOLATILITY_HISTORY_POLICIES = freeze({ ...APPROVED_V1,
  calendar: VOLATILITY_CALENDAR, calendarVersion: VOLATILITY_CALENDAR_VERSION,
  reviewedOn: "2026-10-31", sourceEvidence: [...APPROVED_V1.sourceEvidence,
    { url: VOLATILITY_CALENDAR_EVIDENCE.url, reviewedSummary: VOLATILITY_CALENDAR_EVIDENCE.summary }],
});
const policyRegistry = new Map([[digest(APPROVED_V1), APPROVED_V1],
  [digest(VOLATILITY_HISTORY_POLICIES), VOLATILITY_HISTORY_POLICIES]]);
function recordedPolicy(policies: typeof POLICIES) {
  const supported = policyRegistry.get(digest(policies));
  if (!supported) throw new Error("REPLAY_VERSION_UNSUPPORTED");
  return supported;
}
function utc(at: string) {
  const ms = Date.parse(at);
  const normalized = at.length === 20 ? at.replace("Z", ".000Z") : at;
  if (!Number.isFinite(ms) || new Date(ms).toISOString() !== normalized) throw new Error("INVALID_CLOCK");
  return ms;
}
function reason(code: string, message: string, seriesId?: string): FxReason {
  return { code, message, ...(seriesId ? { seriesId } : {}) };
}
export function validateRows(rows: FxSourceRow[], maximumRows = 32) {
  if (!Array.isArray(rows) || rows.length > maximumRows) throw new Error("INTEGRITY_FAILURE");
  const decoded = rows.map(r => {
    const v = r.value;
    let value: unknown;
    switch (v.kind) {
      case "FINITE":
        if (typeof v.value !== "number" || !Number.isFinite(v.value) || Object.is(v.value, -0)) throw new Error("INTEGRITY_FAILURE");
        value = v.value; break;
      case "NULL": value = null; break;
      case "NEGATIVE_ZERO": value = -0; break;
      case "NONFINITE":
        if (!["NaN", "Infinity", "-Infinity"].includes(v.value)) throw new Error("INTEGRITY_FAILURE");
        value = Number(v.value); break;
      case "INVALID":
        if (v.value === null || typeof v.value === "number") throw new Error("INTEGRITY_FAILURE");
        value = v.value; break;
      default: throw new Error("INTEGRITY_FAILURE");
    }
    if (canonical(encodeValue(value)) !== canonical(v)) throw new Error("INTEGRITY_FAILURE");
    return { series_id: r.seriesId, observation_date: r.observationDate, value, is_missing: r.isMissing,
      revision_number: r.revisionNumber, realtime_start: r.realtimeStart, realtime_end: r.realtimeEnd,
      ingested_at: r.ingestedAt, source: r.source, frequency: r.frequency, units: r.units };
  });
  if (canonical(captureRows(decoded, maximumRows)) !== canonical(rows)) throw new Error("INTEGRITY_FAILURE");
}
export function blockedPairs(code: string, message: string): FxPairResult[] {
  return FX_PAIRS.map(pair => ({ ...pair, state: "BLOCKED", reasons: [reason(code, message)], evidence: [],
    allowedPurposes: [], dataClass: "REFERENCE", exportDisposition: "DENIED",
    derivation: { kind: "DIRECT", formula: "Unavailable", evidenceIds: [] } }));
}
export function buildSnapshot(rows: FxSourceRow[], readStartedAt: string, readCompletedAt: string, createdAt: string, policyDefinition = POLICIES): FxManifest {
  validateRows(rows);
  const policies = recordedPolicy(policyDefinition);
  if (utc(readStartedAt) > utc(readCompletedAt) || utc(readCompletedAt) > utc(createdAt)) throw new Error("INVALID_CLOCK");
  const freshness = calendarAt(readCompletedAt, policies.calendar, policies.calendarVersion);
  const legs = MAPPINGS.map(mapping => {
    const all = rows.filter(r => r.seriesId === mapping.seriesId);
    const latestDate = all.some(r => r.observationDate === null) ? null : all.map(r => r.observationDate).sort().at(-1);
    const latest = all.filter(r => r.observationDate === latestDate);
    const row = latest[0];
    const reasons: FxReason[] = [];
    const add = (code: string, message: string) => reasons.push(reason(code, message, mapping.seriesId));
    if (!freshness.expectedDate || !freshness.nextCheckAt) add("FRESHNESS_CALENDAR_UNKNOWN", "Publication calendar lookup is outside reviewed coverage.");
    const dateValid = !!row?.observationDate && operatingDate(row.observationDate, policies.calendar) === true && row.observationDate <= freshness.localDate;
    if (!row) add("MISSING_LEG", "No Gold observation is present.");
    else {
      if (!dateValid) add("CONVENTION_UNQUALIFIED", "Latest observation date is invalid, future-dated or outside the qualified calendar.");
      if (new Set(latest.map(canonical)).size > 1) add("REVISION_CONFLICT", "Conflicting latest rows or catalog mappings.");
      if (row.source !== "ecb" || row.frequency !== "d" || row.units !== mapping.units) add("SOURCE_MAPPING_UNQUALIFIED", "ECB direction, units or daily source metadata do not match the approved mapping.");
      if (row.isMissing === 1 || row.isMissing === "1") add("MISSING_OBSERVATION", "Latest source observation is explicitly missing.");
      else if (row.isMissing !== 0 && row.isMissing !== "0") add("INTEGRITY_FAILURE", "Unknown source missingness flag.");
      if (!(row.value.kind === "FINITE" && row.value.value > 0) && !reasons.some(r => r.code === "MISSING_OBSERVATION")) add("INVALID_LEVEL", "Latest reference level must be finite and strictly positive.");
      if (!row.revisionNumber || !/^\d+$/.test(String(row.revisionNumber)) || Number(row.revisionNumber) < 1) add("KNOWLEDGE_EVIDENCE_MISSING", "Gold revision identity is missing or invalid.");
      const ingested = Date.parse(row.ingestedAt ?? "");
      if (!Number.isFinite(ingested)) add("KNOWLEDGE_EVIDENCE_MISSING", "Recorded upstream ingestion clock is missing or invalid.");
      else if (ingested > utc(readCompletedAt)) add("AFTER_CUTOFF", "Recorded upstream ingestion is after the capture cutoff.");
    }
    return { mapping, row, reasons, dateValid };
  });
  const observationDate = legs.filter(l => l.dateValid).map(l => l.row.observationDate!).sort().at(-1) ?? null;
  const pairs: FxPairResult[] = FX_PAIRS.map((pair, index) => {
    const indexes = [[0], [0], [0, 1], [2, 0]][index];
    const selected = indexes.map(i => legs[i]);
    const reasons = selected.flatMap(l => l.reasons);
    for (const leg of selected) {
      if (leg.row && leg.dateValid && leg.row.observationDate !== observationDate) reasons.push(reason("MISSING_OBSERVATION", "Required leg is absent on the selected common date.", leg.mapping.seriesId));
    }
    const blocked = reasons.some(r => !["MISSING_LEG", "MISSING_OBSERVATION"].includes(r.code));
    const evidence: FxEvidence[] = selected.filter(l => l.reasons.length === 0 && l.row.observationDate === observationDate).map(l => {
      const id = digest({ row: l.row, mapping: l.mapping });
      if (l.row.value.kind !== "FINITE") throw new Error("INTEGRITY_FAILURE");
      return { evidenceId: id, contentId: id, revisionId: `gold-content:${id}`, revisionBasis: "GOLD_CONTENT",
        sourceId: "ECB", seriesId: l.mapping.seriesId, sourceBaseCurrency: "EUR", sourceQuoteCurrency: l.mapping.currency,
        sourceLevel: l.row.value.value, sourceUnit: l.mapping.units, observationDate: observationDate!,
        publishedAt: null, observedAt: null, receiptAt: null, goldAvailableAt: null,
        upstreamRecordedAt: l.row.ingestedAt!, upstreamClockKind: "SILVER_INGESTION", goldReadStartedAt: readStartedAt,
        goldReadCompletedAt: readCompletedAt, knownByAt: readCompletedAt, sourcePolicyId: "ecb-fx-internal-research", sourcePolicyVersion: policies.source,
        freshnessState: observationDate! < freshness.expectedDate! ? "STALE" : "CURRENT", freshnessEvidence: freshness };
    });
    const base = { ...pair, reasons, evidence, dataClass: "REFERENCE" as const, exportDisposition: "DENIED" as const,
      derivation: { kind: (["DIRECT", "INVERSE", "CROSS", "CROSS"] as const)[index],
        formula: ["u", "1/u", "j/u", "u/g"][index], evidenceIds: evidence.map(e => e.evidenceId) } };
    if (reasons.length) return { ...base, state: blocked ? "BLOCKED" : "MISSING", allowedPurposes: [] };
    const values = selected.map(l => l.row.value.kind === "FINITE" ? l.row.value.value : NaN);
    const level = index === 0 ? values[0] : index === 1 ? 1 / values[0] : values[1] / values[0];
    if (!Number.isFinite(level) || level <= 0) return { ...base, state: "BLOCKED", allowedPurposes: [], reasons: [reason("INVALID_LEVEL", "Derived reference level is not finite and positive.")] };
    if (observationDate! < freshness.expectedDate!) return { ...base, state: "DEGRADED", allowedPurposes: [],
      reasons: [reason("STALE_SOURCE", "Expected reference publication has not arrived in Gold.")],
      lastObserved: { value: level, observationDate: observationDate!, units: `${pair.quoteCurrency} per 1 ${pair.baseCurrency}`, sourceId: "ECB" } };
    return { ...base, state: "ELIGIBLE", allowedPurposes: ["RESEARCH"], referenceLevel: level };
  });
  const snapshot: FxSnapshot = { snapshotId: "", contractVersion: "fx-reference-snapshot/1", cutoffAt: readCompletedAt, createdAt,
    sourceSetId: "ECB_EURO_REFERENCE_DAILY", observationDate, requestedPairs: FX_PAIRS,
    selectionPolicyVersion: policies.selection, freshnessPolicyVersion: policies.freshness, conventionVersion: policies.convention,
    methodVersion: policies.method, knowledgeBasis: "CURRENT_VINTAGE", pairs, freshness };
  const manifest = { snapshot, inputs: { rows, readStartedAt, readCompletedAt }, policies, policyEvidenceHash: digest(policies.sourceEvidence) };
  snapshot.snapshotId = ID_PREFIX + manifestDigest(manifest);
  return manifest;
}
function manifestDigest(manifest: FxManifest) {
  const { snapshotId: _id, ...snapshot } = manifest.snapshot;
  return digest({ ...manifest, snapshot });
}
export function verifyManifest(value: unknown): FxManifest {
  try {
    const m = value as FxManifest;
    if (!ID_PATTERN.test(m.snapshot.snapshotId) || ID_PREFIX + manifestDigest(m) !== m.snapshot.snapshotId) throw new Error();
    const policies = recordedPolicy(m.policies);
    const rebuilt = buildSnapshot(m.inputs.rows, m.inputs.readStartedAt, m.inputs.readCompletedAt, m.snapshot.createdAt, policies);
    if (canonical(rebuilt) !== canonical(m)) throw new Error();
    return m;
  } catch (e) {
    if ((e as Error).message === "REPLAY_VERSION_UNSUPPORTED") throw e;
    throw new Error("INTEGRITY_FAILURE");
  }
}
