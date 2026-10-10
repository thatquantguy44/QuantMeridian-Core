export const MASTER_JSON_SCHEMA_VERSION = 1 as const;

export type MasterDataProvider = "FRED" | "YAHOO";

export type MasterAssetClass =
  | "MACRO"
  | "RATE"
  | "CREDIT"
  | "FX"
  | "EQUITY"
  | "ETF"
  | "INDEX"
  | "COMMODITY"
  | "CRYPTO"
  | "OTHER";

export type MasterFrequency = "D" | "W" | "M" | "Q" | "A" | "INTRADAY" | "UNKNOWN";

export type MasterLicenseTier =
  | "redistributable-public"
  | "private-cache"
  | "restricted"
  | "unknown";

export type MasterTransformPolicy =
  | "store_raw_derive_display"
  | "provider_adjusted"
  | "display_ready"
  | "unknown";

export type MasterRuntimeSource = "FRED" | "YAHOO" | "MASTER" | "SNAPSHOT" | "SIM";

export interface MasterSeriesMetadata {
  displayName: string;
  description?: string;
  providerUrl?: string;
  licenseTier: MasterLicenseTier;
  transformPolicy: MasterTransformPolicy;
  notes?: string[];
}

export interface MasterValueObservation {
  date: string;
  value: number | null;
  realtimeStart?: string;
  realtimeEnd?: string;
  revisedAt?: string;
}

export interface MasterOhlcvObservation {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adjClose?: number | null;
  volume?: number | null;
  dividends?: number | null;
  splits?: number | null;
}

export type MasterObservation = MasterValueObservation | MasterOhlcvObservation;

export interface MasterSeriesFile<TObservation extends MasterObservation = MasterObservation> {
  schemaVersion: typeof MASTER_JSON_SCHEMA_VERSION;
  provider: MasterDataProvider;
  symbol: string;
  sourceId: string;
  assetClass: MasterAssetClass;
  frequency: MasterFrequency;
  currency: string | null;
  units: string;
  generatedAt: string;
  firstObservationDate: string | null;
  lastObservationDate: string | null;
  observations: TObservation[];
  metadata: MasterSeriesMetadata;
}

export interface MasterManifestEntry {
  provider: MasterDataProvider;
  symbol: string;
  path: string;
  assetClass: MasterAssetClass;
  frequency: MasterFrequency;
  firstObservationDate: string | null;
  lastObservationDate: string | null;
  generatedAt: string;
  observations: number;
  licenseTier: MasterLicenseTier;
}

export interface MasterManifestFile {
  schemaVersion: typeof MASTER_JSON_SCHEMA_VERSION;
  generatedAt: string;
  entries: MasterManifestEntry[];
}

export interface MasterRefreshFailure {
  id: string;
  reason: string;
  providerStatus?: number;
}

export interface MasterRefreshReport {
  provider: MasterDataProvider;
  startedAt: string;
  finishedAt: string;
  written: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: MasterRefreshFailure[];
}

export function isMasterValueObservation(obs: MasterObservation): obs is MasterValueObservation {
  return "value" in obs;
}

export function isMasterOhlcvObservation(obs: MasterObservation): obs is MasterOhlcvObservation {
  return "close" in obs;
}

