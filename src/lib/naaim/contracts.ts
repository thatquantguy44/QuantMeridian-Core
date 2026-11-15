export const NAAIM_SCHEMA_VERSION = "naaim-exposure-research/1";
export const NAAIM_DATASET = "naaim-exposure-index-public-delayed";
export const NAAIM_ATTRIBUTION = "Source: NAAIM Exposure Index® (National Association of Active Investment Managers).";
export const NAAIM_DELAY_NOTICE = "NAAIM delays this public feed by three months. The observation date is as_of_date; a recent capture does not mean current-week data. Internal research only.";

export interface NaaimObservation {
  asOfDate: string;
  exposure: number;
  firstSeenAt: string;
  versionToken: string;
}
export interface NaaimSelection {
  schemaVersion: typeof NAAIM_SCHEMA_VERSION;
  artifactGeneratedAt: string;
  observations: NaaimObservation[];
  provenance: {
    source: "NAAIM Exposure Index®";
    dataset: typeof NAAIM_DATASET;
    attribution: typeof NAAIM_ATTRIBUTION;
    displayName: "NAAIM Exposure Index — 3-month-delayed public data";
    delayedPublicDisplay: true;
    providerDelayMonths: 3;
    delayNotice: typeof NAAIM_DELAY_NOTICE;
    knowledgeBasis: "CURRENT_VINTAGE";
    latestAsOfDate: string;
  };
}
export interface NaaimReadResponse {
  selection: NaaimSelection | null;
  readStartedAt: string | null;
  readCompletedAt: string | null;
  error: { code: string; message: string } | null;
}
