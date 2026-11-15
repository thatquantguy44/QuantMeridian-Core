/** Reconcile paired research against two independent engine runs and the evidence ledger. */
import type { AnalysisConfig, AnalysisResult, ResearchDataset, WindowResult } from "./contracts";
import type { PipelineSelection } from "./bundle";
import { analyzeDataset } from "./engine";
import { canonicalJson } from "./exports";
import { parseStrictJson } from "./pipelineContract";

export type ComparisonMode = "common" | "inherited";
export interface InheritedTiming { valuationDate: string; valuationAvailable: string; policyDate: string; policyAvailable: string }
export interface PairedRow { year: number; left: WindowResult; right: WindowResult; difference: number; inherited: InheritedTiming | null }
export interface PairedComparison { leftDataset: ResearchDataset; rightDataset: ResearchDataset; left: AnalysisResult; right: AnalysisResult; rows: PairedRow[] }
const COMMON = ["crsp-market-proxy-common-sample-annual", "shiller-sp-composite-annual"] as const;
const INHERITED = ["crsp-market-proxy-inherited-conditions-annual", "shiller-sp-composite-inherited-conditions-annual"] as const;
function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid comparison evidence.");
  return value as Record<string, any>;
}
function equalNumber(left: unknown, right: unknown): boolean {
  return typeof left === "number" && Number.isFinite(left) && typeof right === "number" && Number.isFinite(right) && Math.abs(left - right) <= 1e-12;
}
function evidence(selection: PipelineSelection, role: string, keys: readonly string[]) {
  const matches = selection.evidence.filter(item => item.role === role);
  if (matches.length !== 1 || keys.some(key => !matches[0].boundSelectionKeys.includes(key))) throw new Error("Required comparison evidence is unavailable.");
  try { return object(parseStrictJson(new TextEncoder().encode(matches[0].content))); }
  catch { throw new Error("Invalid comparison evidence."); }
}
function selectedDataset(selection: PipelineSelection, key: string): ResearchDataset {
  const matches = selection.datasets.filter(item => item.selectionKey === key);
  if (matches.length !== 1) throw new Error("The required matched dataset is unavailable.");
  return matches[0].dataset;
}
export function derivePairedComparison(selection: PipelineSelection, config: AnalysisConfig, mode: ComparisonMode): PairedComparison {
  if (config.windowKind !== "CALENDAR_YEAR") throw new Error("Paired comparisons require calendar-year windows.");
  const keys = mode === "common" ? COMMON : INHERITED;
  const leftDataset = selectedDataset(selection, keys[0]), rightDataset = selectedDataset(selection, keys[1]);
  if (canonicalJson(leftDataset.windows) !== canonicalJson(rightDataset.windows) || canonicalJson(leftDataset.controls) !== canonicalJson(rightDataset.controls) || leftDataset.windows.length === 0) throw new Error("Paired samples or political-control windows do not match.");
  if (mode === "inherited" && canonicalJson(leftDataset.fundamentals) !== canonicalJson(rightDataset.fundamentals)) throw new Error("Inherited fundamentals do not match.");
  const comparison = evidence(selection, "public-series-comparison.json", COMMON);
  if (comparison.schema_version !== 1 || comparison.kind !== "PUBLIC_SERIES_ROBUSTNESS_COMPARISON" || comparison.decision_policy !== "window_start" || !Array.isArray(comparison.annual_rows) || object(comparison.summary).observations !== comparison.annual_rows.length) throw new Error("Comparison evidence is invalid.");
  const byYear = new Map<number, Record<string, any>>();
  for (const value of comparison.annual_rows) {
    const row = object(value);
    if (!Number.isInteger(row.year) || byYear.has(row.year)) throw new Error("Comparison evidence has duplicate or invalid years.");
    byYear.set(row.year, row);
  }
  if (mode === "common" && byYear.size !== leftDataset.windows.length) throw new Error("Common sample does not match comparison evidence.");
  const inheritedRows = new Map<number, Record<string, any>>();
  if (mode === "inherited") {
    const audit = evidence(selection, "inherited-conditions-join-audit.json", INHERITED);
    if (audit.schema_version !== 1 || audit.kind !== "FROZEN_INHERITED_CONDITIONS_JOIN" || !Array.isArray(audit.rows) || audit.observations !== audit.rows.length || audit.rows.length !== leftDataset.windows.length) throw new Error("Inherited audit sample is invalid.");
    for (const value of audit.rows) {
      const row = object(value);
      if (!Number.isInteger(row.year) || inheritedRows.has(row.year)) throw new Error("Inherited audit has duplicate or invalid years.");
      inheritedRows.set(row.year, row);
    }
  }
  const left = analyzeDataset(leftDataset, config), right = analyzeDataset(rightDataset, config);
  if (left.rows.length !== right.rows.length || left.includedCount !== right.includedCount || left.excludedCount !== right.excludedCount) throw new Error("Paired engine samples do not match.");
  const rows: PairedRow[] = left.rows.map((a, index) => {
    const b = right.rows[index], year = Number(a.endDate.slice(0, 4)), reference = byYear.get(year);
    if (!b || !reference || a.id !== b.id || a.startDate !== b.startDate || a.endDate !== b.endDate || a.decisionDate !== b.decisionDate || a.actualStartDate !== b.actualStartDate || a.actualEndDate !== b.actualEndDate || a.included !== b.included || a.category !== b.category || a.presidentParty !== b.presidentParty || a.houseControl !== b.houseControl || a.senateControl !== b.senateControl) throw new Error("Paired sample windows or exclusions do not match.");
    if (reference.decisionDate !== a.decisionDate || reference.presidentParty !== a.presidentParty || reference.houseControl !== a.houseControl || reference.senateControl !== a.senateControl || !equalNumber(reference.crspMarketProxyReturnDecimal, a.cumulativeReturn) || !equalNumber(reference.shillerSpCompositeApproximationReturnDecimal, b.cumulativeReturn) || !equalNumber(reference.differenceDecimal, (b.cumulativeReturn ?? NaN) - (a.cumulativeReturn ?? NaN))) throw new Error("Comparison evidence does not reconcile with the two engine runs.");
    if (a.value === null || b.value === null) throw new Error("Matched return endpoints are unavailable.");
    let inherited: InheritedTiming | null = null;
    if (mode === "inherited") {
      const audit = inheritedRows.get(year), fundamental = audit && object(audit.fundamental);
      if (!audit || !fundamental || !equalNumber(fundamental.valuation, a.valuation) || !equalNumber(fundamental.policyRatePct, a.policyRatePct) || !equalNumber(a.valuation, b.valuation) || !equalNumber(a.policyRatePct, b.policyRatePct) || fundamental.date !== audit.valuation_observation_date || fundamental.availableDate !== audit.valuation_assumed_available_date || audit.valuation_observation_date !== `${year - 1}-10-31` || audit.valuation_assumed_available_date !== `${year - 1}-11-30` || audit.policy_observation_date !== `${year - 1}-10-01` || audit.policy_assumed_available_date !== `${year - 1}-11-01` || audit.valuation_assumed_available_date > a.decisionDate || audit.policy_assumed_available_date > a.decisionDate) throw new Error("Inherited inputs or assumed timing do not reconcile.");
      inherited = { valuationDate: audit.valuation_observation_date, valuationAvailable: audit.valuation_assumed_available_date, policyDate: audit.policy_observation_date, policyAvailable: audit.policy_assumed_available_date };
    }
    return { year, left: a, right: b, difference: b.value - a.value, inherited };
  });
  if (left.groups.length !== right.groups.length || left.groups.some(group => {
    const matching = right.groups.find(other => other.category === group.category);
    return !matching || matching.count !== group.count;
  })) throw new Error("Paired comparison groups do not match.");
  return { leftDataset, rightDataset, left, right, rows };
}
