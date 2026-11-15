export const FX_PAIRS = [
  { baseCurrency: "EUR", quoteCurrency: "USD" },
  { baseCurrency: "USD", quoteCurrency: "EUR" },
  { baseCurrency: "USD", quoteCurrency: "JPY" },
  { baseCurrency: "GBP", quoteCurrency: "USD" },
] as const;

export type FxState = "ELIGIBLE" | "MISSING" | "DEGRADED" | "BLOCKED";
export interface FxReason { code: string; message: string; seriesId?: string }
export type JsonValue = null | string | boolean | number | JsonValue[] | { [key: string]: JsonValue };
export type EvidenceValue =
  | { kind: "FINITE"; value: number }
  | { kind: "NULL" }
  | { kind: "NONFINITE"; value: "NaN" | "Infinity" | "-Infinity" }
  | { kind: "NEGATIVE_ZERO" }
  | { kind: "INVALID"; value: JsonValue };

/** Only the allowlisted decoded Gold projection is retained. */
export interface FxSourceRow {
  seriesId: string;
  observationDate: string | null;
  value: EvidenceValue;
  isMissing: string | number | null;
  revisionNumber: string | number | null;
  realtimeStart: string | null;
  realtimeEnd: string | null;
  ingestedAt: string | null;
  source: string | null;
  frequency: string | null;
  units: string | null;
}
export interface FxEvidence {
  evidenceId: string;
  sourceId: "ECB";
  seriesId: string;
  sourceBaseCurrency: "EUR";
  sourceQuoteCurrency: string;
  sourceLevel: number;
  sourceUnit: string;
  observationDate: string;
  publishedAt: null;
  observedAt: null;
  receiptAt: null;
  goldAvailableAt: null;
  upstreamRecordedAt: string;
  upstreamClockKind: "SILVER_INGESTION";
  goldReadStartedAt: string;
  goldReadCompletedAt: string;
  knownByAt: string;
  revisionId: string;
  contentId: string;
  revisionBasis: "GOLD_CONTENT";
  sourcePolicyId: string;
  sourcePolicyVersion: string;
  freshnessState: "CURRENT" | "STALE";
  freshnessEvidence: FxFreshness;
}
export interface FxFreshness {
  evaluatedAt: string;
  localDate: string;
  expectedDate: string | null;
  deadline: "17:00 Europe/Berlin";
  nextCheckAt: string | null;
  calendarVersion: string;
}
interface PairBase {
  baseCurrency: string;
  quoteCurrency: string;
  reasons: FxReason[];
  evidence: FxEvidence[];
  derivation: { kind: "DIRECT" | "INVERSE" | "CROSS"; formula: string; evidenceIds: string[] };
  dataClass: "REFERENCE";
  exportDisposition: "DENIED";
}
export type FxPairResult = PairBase & (
  | { state: "ELIGIBLE"; referenceLevel: number; allowedPurposes: ["RESEARCH"]; lastObserved?: never }
  | { state: Exclude<FxState, "ELIGIBLE">; referenceLevel?: never; allowedPurposes: []; lastObserved?: { value: number; observationDate: string; units: string; sourceId: "ECB" } }
);
export interface FxSnapshot {
  snapshotId: string;
  contractVersion: "fx-reference-snapshot/1";
  cutoffAt: string;
  createdAt: string;
  sourceSetId: "ECB_EURO_REFERENCE_DAILY";
  observationDate: string | null;
  requestedPairs: typeof FX_PAIRS;
  selectionPolicyVersion: string;
  freshnessPolicyVersion: string;
  conventionVersion: string;
  methodVersion: string;
  knowledgeBasis: "CURRENT_VINTAGE";
  pairs: FxPairResult[];
  freshness: FxFreshness;
}
export interface FxResearchResponse {
  snapshot: FxSnapshot | null;
  pairs: FxPairResult[];
  assessedAt: string;
  nextCheckAt: string | null;
  error: FxReason | null;
  retained: { snapshotId: string; cutoffAt: string } | null;
}
