import { SQUEEZE_MODEL_DATASET_FILES, type SqueezeModelDatasetFile } from "./contracts";

export const SQUEEZE_QUALITY_DECISION_CONTRACT_VERSION = "1.0" as const;

export type SqueezeQualityState = "VALID" | "DEGRADED" | "QUARANTINED";
export type SqueezeGateRequirement = "REQUIRED" | "OPTIONAL";
export type SqueezeQualityDisposition = "ACCEPT" | "DEGRADE" | "QUARANTINE" | "SUPPRESS";
export type SqueezeQualitySeverity = "INFO" | "WARNING" | "ERROR" | "CRITICAL";
export type SqueezeQualityRuleId = "ROW_QUALITY" | "SOURCE_FRESHNESS" | "SOURCE_COVERAGE";

export const SQUEEZE_COVERAGE_GRAINS = [
  "SECURITY_LISTING",
  "BOOK_SECURITY",
  "BOOK_SECURITY_WITH_SOURCE_HEARTBEAT",
  "BOOK_SOURCE_HEARTBEAT",
  "PROVIDER_SECURITY",
  "SOURCE_SECURITY",
  "VENUE_SCOPE_SECURITY",
  "LISTING_SECURITY",
  "PROVIDER_UNDERLYING",
  "ETF_SECURITY",
  "SOURCE_HEARTBEAT",
] as const;

export type SqueezeCoverageGrain = typeof SQUEEZE_COVERAGE_GRAINS[number];

export type SqueezeQualityReasonCode =
  | "QUALITY_VALID"
  | "QUALITY_DEGRADED_ALLOWED"
  | "QUALITY_DEGRADED_NOT_ALLOWED"
  | "QUALITY_QUARANTINED"
  | "FRESHNESS_WITHIN_BUDGET"
  | "STALE_REQUIRED_SOURCE"
  | "STALE_OPTIONAL_SOURCE"
  | "COVERAGE_WITHIN_MINIMUM"
  | "REQUIRED_COVERAGE_COLLAPSE"
  | "OPTIONAL_COVERAGE_COLLAPSE";

export interface SqueezeQualityGateUnit {
  /** Opaque, policy-defined coverage grain such as security or provider/security. */
  coverageKey: string;
  /** Stable IDs for the current material records represented by this unit. */
  recordIds: readonly string[];
  observedAt: string;
  qualityState: SqueezeQualityState;
}

export interface SqueezeDatasetGateInput {
  dataset: SqueezeModelDatasetFile;
  decisionAt: string;
  /** Current material units only; callers must not pass an undifferentiated history. */
  units: readonly SqueezeQualityGateUnit[];
}

export interface SqueezeCoverageGatePolicy {
  grain: SqueezeCoverageGrain;
  expectedKeys: readonly string[];
  /** Coverage below this ratio is a systemic collapse; equality passes. */
  minimumRatio: number;
}

export type SqueezeFreshnessGatePolicy =
  | { mode: "ELAPSED"; budgetMs: number }
  | {
    mode: "NEXT_BUSINESS_PUBLICATION";
    calendar: "WEEKDAYS_ONLY";
    publicationTimeUtc: string;
    gracePeriodMs: number;
  };

export interface SqueezeDatasetGatePolicy {
  policyVersion: string;
  requirement: SqueezeGateRequirement;
  allowDegraded: boolean;
  freshness: SqueezeFreshnessGatePolicy;
  coverage: SqueezeCoverageGatePolicy;
}

export interface SqueezeQualityAffectedScope {
  dataset: SqueezeModelDatasetFile;
  coverageKeys: string[];
  recordIds: string[];
}

export interface SqueezeQualityEvidence {
  decisionAt: string;
  requirement: SqueezeGateRequirement;
  unitCount?: number;
  validCount?: number;
  degradedCount?: number;
  quarantinedCount?: number;
  maximumAgeMs?: number | null;
  freshnessMode?: SqueezeFreshnessGatePolicy["mode"];
  freshnessBudgetMs?: number;
  gracePeriodMs?: number;
  earliestFreshnessDeadlineAt?: string | null;
  expectedCoverageCount?: number;
  observedCoverageCount?: number;
  coverageRatio?: number;
  coverageGrain?: SqueezeCoverageGrain;
  minimumCoverageRatio?: number;
}

export interface SqueezeQualityDecision {
  contractVersion: typeof SQUEEZE_QUALITY_DECISION_CONTRACT_VERSION;
  policyVersion: string;
  ruleId: SqueezeQualityRuleId;
  severity: SqueezeQualitySeverity;
  disposition: SqueezeQualityDisposition;
  reasonCode: SqueezeQualityReasonCode;
  affected: SqueezeQualityAffectedScope;
  evidence: SqueezeQualityEvidence;
}

export interface SqueezeDatasetGateReport {
  contractVersion: typeof SQUEEZE_QUALITY_DECISION_CONTRACT_VERSION;
  policyVersion: string;
  dataset: SqueezeModelDatasetFile;
  decisionAt: string;
  disposition: SqueezeQualityDisposition;
  decisions: SqueezeQualityDecision[];
}

const DISPOSITION_PRECEDENCE: Record<SqueezeQualityDisposition, number> = {
  ACCEPT: 0,
  DEGRADE: 1,
  QUARANTINE: 2,
  SUPPRESS: 3,
};

const SEVERITY_BY_DISPOSITION: Record<SqueezeQualityDisposition, SqueezeQualitySeverity> = {
  ACCEPT: "INFO",
  DEGRADE: "WARNING",
  QUARANTINE: "ERROR",
  SUPPRESS: "CRITICAL",
};

function timestamp(value: string, label: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (match === null) throw new Error(`${label} must be a canonical UTC timestamp`);
  const parsed = Date.parse(value);
  const normalized = `${value.slice(0, 19)}.${(match[7] ?? "").padEnd(3, "0")}Z`;
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== normalized) {
    throw new Error(`${label} must be a canonical UTC timestamp`);
  }
  return parsed;
}

function nonEmptyUnique(values: readonly string[], label: string): void {
  if (values.length === 0 || values.some((value) => value.length === 0)) {
    throw new Error(`${label} must contain non-empty values`);
  }
  if (new Set(values).size !== values.length) throw new Error(`${label} values must be unique`);
}

function validatePolicy(policy: SqueezeDatasetGatePolicy): void {
  if (policy.policyVersion.trim().length === 0) throw new Error("policyVersion must be non-empty");
  if (policy.requirement !== "REQUIRED" && policy.requirement !== "OPTIONAL") {
    throw new Error("requirement must be REQUIRED or OPTIONAL");
  }
  if (typeof policy.allowDegraded !== "boolean") throw new Error("allowDegraded must be boolean");
  if (policy.freshness.mode === "ELAPSED") {
    if (!Number.isFinite(policy.freshness.budgetMs) || policy.freshness.budgetMs < 0) {
      throw new Error("freshness.budgetMs must be a non-negative finite number");
    }
  } else if (policy.freshness.mode === "NEXT_BUSINESS_PUBLICATION") {
    if (policy.freshness.calendar !== "WEEKDAYS_ONLY") {
      throw new Error("freshness.calendar must be WEEKDAYS_ONLY");
    }
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(policy.freshness.publicationTimeUtc)) {
      throw new Error("freshness.publicationTimeUtc must be HH:mm:ss UTC");
    }
    if (!Number.isFinite(policy.freshness.gracePeriodMs) || policy.freshness.gracePeriodMs < 0) {
      throw new Error("freshness.gracePeriodMs must be a non-negative finite number");
    }
  } else {
    throw new Error("freshness.mode is invalid");
  }
  nonEmptyUnique(policy.coverage.expectedKeys, "coverage.expectedKeys");
  if (!(SQUEEZE_COVERAGE_GRAINS as readonly string[]).includes(policy.coverage.grain)) {
    throw new Error("coverage.grain is invalid");
  }
  if (!Number.isFinite(policy.coverage.minimumRatio)
    || policy.coverage.minimumRatio < 0
    || policy.coverage.minimumRatio > 1) {
    throw new Error("coverage.minimumRatio must be between 0 and 1");
  }
}

function canonicalUtcTimestamp(valueMs: number): string {
  const iso = new Date(valueMs).toISOString();
  return iso.endsWith(".000Z") ? `${iso.slice(0, -5)}Z` : iso;
}

function nextWeekdayDate(valueMs: number): Date {
  const observed = new Date(valueMs);
  const candidate = new Date(Date.UTC(
    observed.getUTCFullYear(),
    observed.getUTCMonth(),
    observed.getUTCDate() + 1,
  ));
  while (candidate.getUTCDay() === 0 || candidate.getUTCDay() === 6) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return candidate;
}

function freshnessDeadlineMs(observedAtMs: number, policy: SqueezeFreshnessGatePolicy): number {
  if (policy.mode === "ELAPSED") return observedAtMs + policy.budgetMs;
  const [hours, minutes, seconds] = policy.publicationTimeUtc.split(":").map(Number);
  const nextBusinessDay = nextWeekdayDate(observedAtMs);
  return Date.UTC(
    nextBusinessDay.getUTCFullYear(),
    nextBusinessDay.getUTCMonth(),
    nextBusinessDay.getUTCDate(),
    hours,
    minutes,
    seconds,
  ) + policy.gracePeriodMs;
}

function validateInput(input: SqueezeDatasetGateInput, decisionAtMs: number): void {
  if (!(SQUEEZE_MODEL_DATASET_FILES as readonly string[]).includes(input.dataset)) {
    throw new Error("dataset must be a known Squeeze Radar model dataset");
  }
  const keys = input.units.map((unit) => unit.coverageKey);
  if (keys.some((key) => key.length === 0) || new Set(keys).size !== keys.length) {
    throw new Error("unit coverageKey values must be non-empty and unique");
  }
  const allRecordIds: string[] = [];
  for (const unit of input.units) {
    nonEmptyUnique(unit.recordIds, `recordIds for ${unit.coverageKey}`);
    allRecordIds.push(...unit.recordIds);
    if (unit.qualityState !== "VALID" && unit.qualityState !== "DEGRADED" && unit.qualityState !== "QUARANTINED") {
      throw new Error(`qualityState for ${unit.coverageKey} is invalid`);
    }
    if (timestamp(unit.observedAt, `observedAt for ${unit.coverageKey}`) > decisionAtMs) {
      throw new Error(`observedAt for ${unit.coverageKey} cannot be after decisionAt`);
    }
  }
  if (new Set(allRecordIds).size !== allRecordIds.length) throw new Error("recordIds must be unique across units");
}

function decision(
  input: SqueezeDatasetGateInput,
  policy: SqueezeDatasetGatePolicy,
  ruleId: SqueezeQualityRuleId,
  disposition: SqueezeQualityDisposition,
  reasonCode: SqueezeQualityReasonCode,
  coverageKeys: readonly string[],
  recordIds: readonly string[],
  evidence: Omit<SqueezeQualityEvidence, "decisionAt" | "requirement">,
): SqueezeQualityDecision {
  return {
    contractVersion: SQUEEZE_QUALITY_DECISION_CONTRACT_VERSION,
    policyVersion: policy.policyVersion,
    ruleId,
    severity: SEVERITY_BY_DISPOSITION[disposition],
    disposition,
    reasonCode,
    affected: {
      dataset: input.dataset,
      coverageKeys: [...coverageKeys].sort(),
      recordIds: [...recordIds].sort(),
    },
    evidence: {
      decisionAt: input.decisionAt,
      requirement: policy.requirement,
      ...evidence,
    },
  };
}

function qualityDecision(
  input: SqueezeDatasetGateInput,
  policy: SqueezeDatasetGatePolicy,
): SqueezeQualityDecision {
  const quarantined = input.units.filter((unit) => unit.qualityState === "QUARANTINED");
  const degraded = input.units.filter((unit) => unit.qualityState === "DEGRADED");
  const evidence = {
    unitCount: input.units.length,
    validCount: input.units.length - quarantined.length - degraded.length,
    degradedCount: degraded.length,
    quarantinedCount: quarantined.length,
  };
  if (quarantined.length > 0) {
    return decision(input, policy, "ROW_QUALITY", "QUARANTINE", "QUALITY_QUARANTINED",
      quarantined.map((unit) => unit.coverageKey), quarantined.flatMap((unit) => unit.recordIds), evidence);
  }
  if (degraded.length > 0) {
    const disposition = policy.allowDegraded ? "DEGRADE" : policy.requirement === "REQUIRED" ? "SUPPRESS" : "DEGRADE";
    return decision(input, policy, "ROW_QUALITY", disposition,
      policy.allowDegraded ? "QUALITY_DEGRADED_ALLOWED" : "QUALITY_DEGRADED_NOT_ALLOWED",
      degraded.map((unit) => unit.coverageKey), degraded.flatMap((unit) => unit.recordIds), evidence);
  }
  return decision(input, policy, "ROW_QUALITY", "ACCEPT", "QUALITY_VALID", [], [], evidence);
}

function freshnessDecision(
  input: SqueezeDatasetGateInput,
  policy: SqueezeDatasetGatePolicy,
  decisionAtMs: number,
): SqueezeQualityDecision {
  const unitsWithClocks = input.units.map((unit) => {
    const observedAtMs = timestamp(unit.observedAt, unit.coverageKey);
    return { unit, observedAtMs, deadlineMs: freshnessDeadlineMs(observedAtMs, policy.freshness) };
  });
  const stale = unitsWithClocks.filter(({ deadlineMs }) => decisionAtMs > deadlineMs).map(({ unit }) => unit);
  const earliestDeadlineMs = unitsWithClocks.length === 0
    ? null
    : Math.min(...unitsWithClocks.map(({ deadlineMs }) => deadlineMs));
  const evidence: Omit<SqueezeQualityEvidence, "decisionAt" | "requirement"> = {
    maximumAgeMs: unitsWithClocks.length === 0
      ? null
      : Math.max(...unitsWithClocks.map(({ observedAtMs }) => decisionAtMs - observedAtMs)),
    freshnessMode: policy.freshness.mode,
    earliestFreshnessDeadlineAt: earliestDeadlineMs === null ? null : canonicalUtcTimestamp(earliestDeadlineMs),
    ...(policy.freshness.mode === "ELAPSED"
      ? { freshnessBudgetMs: policy.freshness.budgetMs }
      : { gracePeriodMs: policy.freshness.gracePeriodMs }),
  };
  if (stale.length === 0) {
    return decision(input, policy, "SOURCE_FRESHNESS", "ACCEPT", "FRESHNESS_WITHIN_BUDGET", [], [], evidence);
  }
  const required = policy.requirement === "REQUIRED";
  return decision(input, policy, "SOURCE_FRESHNESS", required ? "SUPPRESS" : "DEGRADE",
    required ? "STALE_REQUIRED_SOURCE" : "STALE_OPTIONAL_SOURCE",
    stale.map((unit) => unit.coverageKey), stale.flatMap((unit) => unit.recordIds), evidence);
}

function coverageDecision(
  input: SqueezeDatasetGateInput,
  policy: SqueezeDatasetGatePolicy,
): SqueezeQualityDecision {
  const present = new Set(input.units.map((unit) => unit.coverageKey));
  const missing = policy.coverage.expectedKeys.filter((key) => !present.has(key));
  const observedCount = policy.coverage.expectedKeys.length - missing.length;
  const coverageRatio = observedCount / policy.coverage.expectedKeys.length;
  const evidence = {
    expectedCoverageCount: policy.coverage.expectedKeys.length,
    observedCoverageCount: observedCount,
    coverageRatio,
    coverageGrain: policy.coverage.grain,
    minimumCoverageRatio: policy.coverage.minimumRatio,
  };
  if (coverageRatio >= policy.coverage.minimumRatio) {
    return decision(input, policy, "SOURCE_COVERAGE", "ACCEPT", "COVERAGE_WITHIN_MINIMUM", [], [], evidence);
  }
  const required = policy.requirement === "REQUIRED";
  return decision(input, policy, "SOURCE_COVERAGE", required ? "SUPPRESS" : "DEGRADE",
    required ? "REQUIRED_COVERAGE_COLLAPSE" : "OPTIONAL_COVERAGE_COLLAPSE", missing, [], evidence);
}

export function evaluateSqueezeDatasetGate(
  input: SqueezeDatasetGateInput,
  policy: SqueezeDatasetGatePolicy,
): SqueezeDatasetGateReport {
  validatePolicy(policy);
  const decisionAtMs = timestamp(input.decisionAt, "decisionAt");
  validateInput(input, decisionAtMs);
  const expectedKeys = new Set(policy.coverage.expectedKeys);
  const unexpected = input.units.find((unit) => !expectedKeys.has(unit.coverageKey));
  if (unexpected !== undefined) throw new Error(`unexpected coverageKey ${unexpected.coverageKey}`);
  const decisions = [
    qualityDecision(input, policy),
    freshnessDecision(input, policy, decisionAtMs),
    coverageDecision(input, policy),
  ];
  const disposition = decisions.reduce<SqueezeQualityDisposition>((current, item) => (
    DISPOSITION_PRECEDENCE[item.disposition] > DISPOSITION_PRECEDENCE[current]
      ? item.disposition
      : current
  ), "ACCEPT");
  return {
    contractVersion: SQUEEZE_QUALITY_DECISION_CONTRACT_VERSION,
    policyVersion: policy.policyVersion,
    dataset: input.dataset,
    decisionAt: input.decisionAt,
    disposition,
    decisions,
  };
}
