export const AAII_SOURCE = "aaii";
export const AAII_DATASET = "aaii-investor-sentiment";
export const AAII_MAX_HISTORY = 104;
export const AAII_STALE_AFTER_DAYS = 10;
export const AAII_TOTAL_TOLERANCE = .002;
export const AAII_SPREAD_TOLERANCE_PP = 1e-8;
export interface AaiiObservation {
  surveyDate:string;
  bullishPct:number;
  neutralPct:number;
  bearishPct:number;
  bullBearSpreadPp:number;
  previousSurveyDate:string|null;
  gapDays:number|null;
  spreadChangePp:number|null;
  adjacentContext:"NONE"|"UPSTREAM_ONLY"|"WITHIN_SELECTION";
  versionToken:string;
  firstSeenAt:string;
  retrievedAt:string;
  providerPublishedAt:string|null;
}
/** Validated current-vintage research selection, never a historical PIT snapshot. */
export interface AaiiSelection {
  schemaVersion:"aaii-research/1";
  methodVersion:"aaii-gold-normalization/1";
  assessedAt:string;
  observations:AaiiObservation[];
  provenance:{source:"AAII";dataset:typeof AAII_DATASET;knowledgeBasis:"CURRENT_VINTAGE";
    dataState:"LIVE"|"STALE";latestSurveyDate:string;ageCalendarDays:number;staleAfterCalendarDays:10;
    firstSeenAt:string;retrievedAt:string;providerPublishedAt:string|null;freshnessBasis:"REPORTED_DATE_UTC_CALENDAR"};
}
export interface AaiiReadResponse {
  selection: AaiiSelection | null;
  readStartedAt: string | null;
  readCompletedAt: string | null;
  error: { code: string; message: string } | null;
}
