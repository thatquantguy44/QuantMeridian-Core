import type { SqueezeModelDatasetFile, SqueezeModelDatasets } from "./contracts";

export const SQUEEZE_SIM_PUBLICATION_CONTRACT_VERSION = "1.0" as const;

export interface SqueezeDatasetCoverage {
  rowCount: number;
  latestFirstKnowableAt: string | null;
}

export interface SqueezeSimPublication {
  contractVersion: typeof SQUEEZE_SIM_PUBLICATION_CONTRACT_VERSION;
  streamId: string;
  snapshotId: string;
  dataMode: "SIM";
  scenarioId: string;
  datasetVersion: string;
  decisionAt: string;
  publishedAt: string;
  coverage: Record<SqueezeModelDatasetFile, SqueezeDatasetCoverage>;
  datasets: SqueezeModelDatasets;
}

export interface SqueezePublicationDescriptor {
  streamId: string;
  snapshotId: string;
  decisionAt: string;
  publishedAt: string;
}

export type SqueezePublicationErrorCode =
  | "BUNDLE_INVALID"
  | "CLOCK_INVALID"
  | "DECISION_CONTENT_CONFLICT"
  | "DECISION_TIME_REGRESSION"
  | "NON_SIM_INPUT"
  | "PUBLICATION_STREAM_MISMATCH"
  | "PUBLICATION_TIME_REGRESSION";

export interface SqueezePublicationFailure {
  code: SqueezePublicationErrorCode;
  message: string;
}

export type SqueezePublishResult =
  | { status: "PUBLISHED"; publication: SqueezeSimPublication }
  | {
    status: "RETAINED_LAST_GOOD";
    error: SqueezePublicationFailure;
    lastGood: SqueezePublicationDescriptor;
  }
  | { status: "UNAVAILABLE"; error: SqueezePublicationFailure; lastGood: null };

export type SqueezeLastGoodRead =
  | {
    status: "CURRENT" | "LAST_GOOD";
    ageMs: number;
    publication: SqueezeSimPublication;
    lastFailure: SqueezePublicationFailure | null;
  }
  | {
    status: "UNAVAILABLE";
    reasonCode: "NO_LAST_GOOD";
    lastGood: null;
  }
  | {
    status: "UNAVAILABLE";
    reasonCode: "LAST_GOOD_EXPIRED";
    ageMs: number;
    lastGood: SqueezePublicationDescriptor;
  };

export interface SqueezePublishOptions {
  decisionAt: string;
}

export interface SqueezeLastGoodReadOptions {
  freshnessBudgetMs: number;
}

export interface SqueezePublicationClock {
  now(): string;
}
