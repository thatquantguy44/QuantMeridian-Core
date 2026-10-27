export type {
  BorrowEventRecord,
  DataDictionaryRecord,
  EquityMarketDailyRecord,
  EtfSnapshotRecord,
  InventorySnapshotRecord,
  LoanSnapshotRecord,
  ManifestRecord,
  MarketBorrowSnapshotRecord,
  OptionsSnapshotRecord,
  SecurityEventRecord,
  SecurityRecord,
  ShortInterestRecord,
  ShortSaleVolumeRecord,
  SqueezeRadarCSVRecordContracts,
  TruthEventRecord,
} from "./contracts.generated";

import type {
  DataDictionaryRecord,
  ManifestRecord,
  SqueezeRadarCSVRecordContracts,
} from "./contracts.generated";

export interface LegacySqueezeManifestRecord {
  dataset_version: "1.0";
  scenario_id: string;
  seed: number;
  generator_version: string;
  data_mode: "SIM";
  base_currency: "USD";
  calendar_start: string;
  calendar_end: string;
  generated_at: string;
  model_input_path: string;
  truth_path: string;
}

export type SqueezeManifestRecord = ManifestRecord | LegacySqueezeManifestRecord;

export const SQUEEZE_MODEL_DATASET_FILES = [
  "securities.csv",
  "inventory_snapshots.csv",
  "loan_snapshots.csv",
  "borrow_events.csv",
  "market_borrow_snapshots.csv",
  "short_interest.csv",
  "short_sale_volume.csv",
  "equity_market_daily.csv",
  "options_snapshots.csv",
  "etf_snapshots.csv",
  "security_events.csv",
] as const;

export type SqueezeModelDatasetFile = typeof SQUEEZE_MODEL_DATASET_FILES[number];
export type SqueezeModelDatasets = Pick<SqueezeRadarCSVRecordContracts, SqueezeModelDatasetFile>;
export type SqueezeModelRecord = SqueezeModelDatasets[SqueezeModelDatasetFile][number];

export interface SqueezeCsvBundle {
  rootDir: string;
  manifest: SqueezeManifestRecord;
  datasets: SqueezeModelDatasets;
  dataDictionary: DataDictionaryRecord[];
}

export type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type ReadonlySqueezeCsvBundle = DeepReadonly<SqueezeCsvBundle>;

export interface SqueezeBundleSnapshot extends Omit<ReadonlySqueezeCsvBundle, "datasets"> {
  decisionAt: string;
  datasets: SqueezeModelDatasets;
}

export interface PointInTimeRecord {
  first_knowable_at: string;
  revision: number;
}
