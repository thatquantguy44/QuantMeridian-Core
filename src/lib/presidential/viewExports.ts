/** Explicitly labeled CSV exports for matched and cycle views. */
import type { PipelineSelection } from "./bundle";
import type { ComparisonMode, PairedComparison } from "./comparison";
import type { AnalysisConfig } from "./contracts";
import type { deriveCycleAnalysis } from "./cycle";
import { safeCsvCell } from "./exports";

function csv(rows: unknown[][]): string { return rows.map(row => row.map(safeCsvCell).join(",")).join("\r\n") + "\r\n"; }
export function exportPairedCsv(selection: PipelineSelection, pair: PairedComparison, mode: ComparisonMode, config: AnalysisConfig): string {
  const headers = ["snapshot_id", "profile", "input_kind", "comparison_sample", "sample_years", "excluded_years", "metric", "currency", "return_units", "crsp_construction", "shiller_construction", "year", "decision_date", "political_configuration", "crsp_return_decimal", "shiller_return_decimal", "difference_decimal", "inclusion", "reasons", "cape", "cape_observation_date", "cape_assumed_available", "policy_rate_percent", "policy_observation_date", "policy_assumed_available", "limitations"];
  const sampleYears = pair.rows.map(row => row.year).join(";");
  const limitations = "Descriptive comparison; Shiller is an approximation. Assumed availability dates are not verified real-time vintages.";
  return csv([headers, ...pair.rows.map(row => [selection.catalog.snapshotId, selection.catalog.catalog.profileId, selection.catalog.catalog.inputKind, mode, sampleYears, config.excludeYears.join(";"), config.metric, pair.leftDataset.currency, "decimal return", pair.leftDataset.title, pair.rightDataset.title, row.year, row.left.decisionDate, row.left.category, row.left.value, row.right.value, row.difference, row.left.included ? "Included" : "Excluded", [...new Set([...row.left.reasons, ...row.right.reasons])].join("; "), row.left.valuation, row.inherited?.valuationDate ?? null, row.inherited?.valuationAvailable ?? null, row.left.policyRatePct, row.inherited?.policyDate ?? null, row.inherited?.policyAvailable ?? null, limitations])]);
}
export function exportCycleCsv(selection: PipelineSelection, cycle: ReturnType<typeof deriveCycleAnalysis>, series: "crsp" | "shiller", highlightTransitions: boolean): string {
  const headers = ["snapshot_id", "profile", "input_kind", "view", "sample_years", "pre_1937_exclusions", "assignment", "selected_construction", "transition_treatment", "year", "term_start_year", "term_cycle_year", "inauguration_transition", "president_changed_within_window", "year_end_president_id", "year_end_president", "year_end_party", "crsp_proxy_return_decimal", "shiller_approximation_return_decimal", "limitations"];
  const years = cycle.rows.map(row => row.year).join(";");
  return csv([headers, ...cycle.rows.map(row => [selection.catalog.snapshotId, selection.catalog.catalog.profileId, selection.catalog.catalog.inputKind, "presidential cycle", years, cycle.excludedYears.join(";"), "year-end president", series === "crsp" ? "CRSP market proxy" : "Shiller dividend-reinvestment-style approximation", highlightTransitions ? "inauguration transitions highlighted; no exclusions" : "all eligible years", row.year, row.termStartYear, row.termCycleYear, row.inaugurationTransition, row.presidentChangedWithinWindow, row.endOfYearPresidentId, row.endOfYearPresidentName, row.endOfYearPresidentParty, row.crspMarketProxyReturnDecimal, row.shillerSpCompositeApproximationReturnDecimal, "Descriptive; Shiller is an approximation and the year-end assignment differs from the primary at-origin grouping."])]);
}
