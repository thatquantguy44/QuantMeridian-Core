/** Local research inputs; user-supplied observations are not independently verified. */
export const METHOD_VERSION = "presidential-impact/0.2.0";
export type PoliticalParty = "D" | "R" | "OTHER" | "TIED" | "UNKNOWN";
export type WindowKind = "CALENDAR_YEAR" | "PRESIDENTIAL_PERIOD";
export type ReturnMetric = "CUMULATIVE" | "ANNUALIZED";
export type GroupingDimension = "POLITICAL_CONFIGURATION" | "PRESIDENT_PARTY" | "HOUSE_CONTROL" | "SENATE_CONTROL" | "GOVERNMENT_STRUCTURE";

export const GROUPING_LABELS: Record<GroupingDimension, string> = {
  POLITICAL_CONFIGURATION: "President × Congress",
  PRESIDENT_PARTY: "President party",
  HOUSE_CONTROL: "House control",
  SENATE_CONTROL: "Senate control",
  GOVERNMENT_STRUCTURE: "Unified / divided government",
};

export interface ResearchSource {
  id: string;
  title: string;
  locator: string | null;
  note?: string;
}
export interface IndexLevel { date: string; value: number; sourceId: string }
/** A normalized interval splits whenever any institution changes; end is exclusive. */
export interface PoliticalInterval {
  id: string;
  startDate: string;
  endDate: string;
  presidentId: string;
  presidentName: string;
  presidentParty: PoliticalParty;
  houseControl: PoliticalParty;
  senateControl: PoliticalParty;
  sourceId: string;
}
export interface ResearchWindow {
  id: string;
  label: string;
  kind: WindowKind;
  startDate: string;
  endDate: string;
  decisionDate: string;
  complete: boolean;
}
export interface FundamentalObservation {
  date: string;
  availableDate: string | null;
  valuation: number | null;
  valuationDefinition: string;
  policyRatePct: number | null;
  sourceId: string;
}
export interface ResearchDataset {
  schemaVersion: 1;
  id: string;
  title: string;
  kind: "ILLUSTRATIVE" | "USER_SUPPLIED";
  currency: string;
  nominalReal: "NOMINAL";
  returnBasis: "TOTAL_RETURN" | "PRICE_RETURN";
  sources: ResearchSource[];
  levels: IndexLevel[];
  controls: PoliticalInterval[];
  windows: ResearchWindow[];
  fundamentals: FundamentalObservation[];
}
export interface AnalysisConfig {
  windowKind: WindowKind;
  metric: ReturnMetric;
  grouping: GroupingDimension;
  includePartial: boolean;
  maxEndpointGapDays: number;
  excludeYears: number[];
}
export const DEFAULT_CONFIG: AnalysisConfig = {
  windowKind: "CALENDAR_YEAR", metric: "CUMULATIVE", grouping: "POLITICAL_CONFIGURATION", includePartial: false,
  maxEndpointGapDays: 0, excludeYears: [],
};
export interface WindowResult {
  id: string;
  label: string;
  kind: WindowKind;
  startDate: string;
  endDate: string;
  decisionDate: string;
  actualStartDate: string | null;
  actualEndDate: string | null;
  startLevel: number | null;
  endLevel: number | null;
  cumulativeReturn: number | null;
  annualizedReturn: number | null;
  value: number | null;
  category: string;
  presidentParty: PoliticalParty | null;
  houseControl: PoliticalParty | null;
  senateControl: PoliticalParty | null;
  governmentStructure: string;
  presidentId: string | null;
  presidentName: string | null;
  mixedControl: boolean;
  complete: boolean;
  included: boolean;
  reasons: string[];
  valuation: number | null;
  valuationDefinition: string | null;
  policyRatePct: number | null;
  fundamentalDate: string | null;
  fundamentalSourceId: string | null;
}
export interface GroupSummary {
  category: string;
  count: number;
  administrationCount: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  interval: DescriptiveInterval;
}
/**
 * A deterministic administration-cluster resample of an arithmetic mean.
 * It is descriptive only: clustered historical windows are not independent
 * presidential experiments and these bounds are not causal confidence intervals.
 */
export interface DescriptiveInterval {
  method: "ADMINISTRATION_CLUSTER_RESAMPLE";
  level: 0.95;
  resamples: 2000;
  clusterCount: number;
  lower: number | null;
  upper: number | null;
  unavailableReason: string | null;
}
export interface AnalysisResult {
  methodVersion: string;
  config: AnalysisConfig;
  rows: WindowResult[];
  breakdowns: Record<GroupingDimension, GroupSummary[]>;
  groups: GroupSummary[];
  includedCount: number;
  excludedCount: number;
  warnings: string[];
}
