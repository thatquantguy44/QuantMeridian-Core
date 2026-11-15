import type { FxFreshness } from "./contracts";
import type { FxPairHistory } from "./historyContracts";

export const VOLATILITY_WINDOWS = [5, 21, 63, 126, 252] as const;
export type VolatilityWindow = typeof VOLATILITY_WINDOWS[number];
export const VOLATILITY_ID_PREFIX = "fx-reference-volatility/1:sha256:";
export const VOLATILITY_ID_PATTERN = /^fx-reference-volatility\/1:sha256:[a-f0-9]{64}$/;
export const VOLATILITY_METHOD = "ecb-sample-log-volatility/1";
export const ANNUALIZATION_FACTOR = 252;
export interface FxVolatilityMetric {
  window: VolatilityWindow;
  state: "AVAILABLE" | "UNAVAILABLE";
  dailySigma: number | null;
  annualizedSigma: number | null;
  levelsRequired: number;
  levelsAvailable: number;
  returnsAvailable: number;
  startDate: string | null;
  endDate: string | null;
  firstReturn: { startDate: string; endDate: string } | null;
  lastReturn: { startDate: string; endDate: string } | null;
  calendarDays: number | null;
  reasons: FxPairHistory["endpointReasons"];
}
export interface FxPairVolatility extends Omit<FxPairHistory, "changes"> {
  metrics: FxVolatilityMetric[];
  /** Estimates computed from qualified levels ending at the capture observation date, even when current use is stale-blocked. */
  historicalMetrics: FxVolatilityMetric[];
}
export interface FxVolatilityEvidence {
  evidenceId: string;
  seriesId: string;
  sourceLevel: number;
  sourceUnit: string;
  observationDate: string;
  revisionId: string;
  upstreamRecordedAt: string;
}
export interface FxVolatility {
  volatilityId: string;
  contractVersion: "fx-reference-volatility/1";
  createdAt: string;
  cutoffAt: string;
  observationDate: string | null;
  knowledgeBasis: "CURRENT_VINTAGE";
  allowedPurposes: ["RESEARCH"];
  exportDisposition: "DENIED";
  sourceSetId: "ECB_EURO_REFERENCE_DAILY";
  methodVersion: typeof VOLATILITY_METHOD;
  estimator: "SAMPLE_CENTERED_LOG_RETURNS";
  annualizationFactor: 252;
  policyVersion: "ecb-volatility253/1";
  historicalCalendarVersion: "ecb-target-history-2025-2028/1";
  freshness: FxFreshness;
  schedule: { dates: string[]; requestedObservations: 253; calendarTruncated: boolean; reasons: FxPairHistory["endpointReasons"] };
  pairs: FxPairVolatility[];
  goldReadStartedAt: string;
  knownByAt: string;
  publishedAt: null;
  receiptAt: null;
  goldAvailableAt: null;
  evidence: FxVolatilityEvidence[];
}
export interface FxVolatilityResponse {
  volatility: FxVolatility | null;
  pairs: FxPairVolatility[];
  assessedAt: string;
  nextCheckAt: string | null;
  error: FxPairHistory["endpointReasons"][number] | null;
  retained: Pick<FxVolatility, "volatilityId" | "cutoffAt" | "schedule" | "evidence"> | null;
}
