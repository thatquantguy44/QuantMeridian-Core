import type { FX_PAIRS, FxEvidence, FxFreshness, FxPairResult, FxReason } from "./contracts";

export const HISTORY_INTERVALS = [1, 5, 21] as const;
export const HISTORY_ID_PREFIX = "fx-reference-history/1:sha256:";
export const HISTORY_ID_PATTERN = /^fx-reference-history\/1:sha256:[a-f0-9]{64}$/;
export type HistoryInterval = typeof HISTORY_INTERVALS[number];
export interface FxHistoryPoint {
  observationDate: string;
  state: "OBSERVED" | "MISSING" | "BLOCKED";
  /** Descriptive historical evidence, never a current consumable referenceLevel. */
  displayLevel: number | null;
  evidenceIds: string[];
  reasons: FxReason[];
}
export interface FxHistoryChange {
  intervals: HistoryInterval;
  state: "AVAILABLE" | "UNAVAILABLE";
  simplePercent: number | null;
  startDate: string | null;
  endDate: string | null;
  calendarDays: number | null;
  observationsRequired: number;
  observationsAvailable: number;
  reasons: FxReason[];
}
export interface FxPairHistory {
  baseCurrency: string;
  quoteCurrency: string;
  endpointState: FxPairResult["state"];
  endpointReasons: FxReason[];
  derivation: FxPairResult["derivation"]["kind"];
  points: FxHistoryPoint[];
  changes: FxHistoryChange[];
  validObservations: number;
}
export interface FxHistory {
  historyId: string;
  contractVersion: "fx-reference-history/1";
  cutoffAt: string;
  createdAt: string;
  knowledgeBasis: "CURRENT_VINTAGE";
  dataClass: "DESCRIPTIVE_HISTORY";
  allowedPurposes: ["RESEARCH"];
  exportDisposition: "DENIED";
  sourceSetId: "ECB_EURO_REFERENCE_DAILY";
  observationDate: string | null;
  requestedPairs: typeof FX_PAIRS;
  historyPolicyVersion: string;
  methodVersion: string;
  sourcePolicyVersion: string;
  freshness: FxFreshness;
  schedule: { dates: string[]; requestedObservations: 90; calendarTruncated: boolean; reasons: FxReason[] };
  pairs: FxPairHistory[];
  evidence: FxEvidence[];
}
export interface FxHistoryResponse {
  history: FxHistory | null;
  /** Current assessment, separate from the immutable capture in history.pairs. */
  pairs: FxPairHistory[];
  assessedAt: string;
  nextCheckAt: string | null;
  error: FxReason | null;
  retained: { historyId: string; cutoffAt: string; schedule: FxHistory["schedule"]; evidence: FxEvidence[] } | null;
}
