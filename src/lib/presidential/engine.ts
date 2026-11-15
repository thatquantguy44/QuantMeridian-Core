import { METHOD_VERSION, type AnalysisConfig, type AnalysisResult, type DescriptiveInterval, type FundamentalObservation, type GroupingDimension, type GroupSummary, type IndexLevel, type PoliticalInterval, type PoliticalParty, type ResearchDataset, type WindowResult } from "./contracts";
import { dateDays, parseAnalysisConfig, parseResearchDataset } from "./validation";

/** Stable display categories. These encode at-decision labels, not causal attribution. */
function category(control: PoliticalInterval | undefined): string {
  if (!control || !["D", "R"].includes(control.presidentParty) || !["D", "R"].includes(control.houseControl) || !["D", "R"].includes(control.senateControl)) return "UNCLASSIFIED";
  const congress = control.houseControl === control.senateControl ? `${control.houseControl} Congress` : "Split Congress";
  return `${control.presidentParty} president · ${congress}`;
}

function governmentStructure(control: PoliticalInterval | undefined): string {
  if (!control) return "UNCLASSIFIED government";
  if (![control.presidentParty, control.houseControl, control.senateControl].every(party => party === "D" || party === "R")) {
    return `${control.presidentParty} president · ${control.houseControl} House · ${control.senateControl} Senate`;
  }
  if (control.presidentParty === "D" && control.houseControl === "D" && control.senateControl === "D") return "Unified D government";
  if (control.presidentParty === "R" && control.houseControl === "R" && control.senateControl === "R") return "Unified R government";
  return "Divided government";
}

function partyLabel(party: PoliticalParty | null, institution: "president" | "House" | "Senate"): string {
  return party === null ? `UNCLASSIFIED ${institution}` : `${party} ${institution}`;
}

function groupLabel(row: WindowResult, dimension: GroupingDimension): string {
  switch (dimension) {
    case "POLITICAL_CONFIGURATION": return row.category;
    case "PRESIDENT_PARTY": return partyLabel(row.presidentParty, "president");
    case "HOUSE_CONTROL": return partyLabel(row.houseControl, "House");
    case "SENATE_CONTROL": return partyLabel(row.senateControl, "Senate");
    case "GOVERNMENT_STRUCTURE": return row.governmentStructure;
  }
}

function endpoint(levels: IndexLevel[], requested: string, maxGap: number): IndexLevel | null {
  let lo = 0; let hi = levels.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (levels[mid].date <= requested) lo = mid + 1;
    else hi = mid;
  }
  const latest = levels[lo - 1];
  return latest && dateDays(requested) - dateDays(latest.date) <= maxGap ? latest : null;
}

function controlAt(controls: PoliticalInterval[], date: string): PoliticalInterval | undefined {
  let lo = 0; let hi = controls.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (controls[mid].startDate <= date) lo = mid + 1;
    else hi = mid;
  }
  const selected = controls[lo - 1];
  return selected && date < selected.endDate ? selected : undefined;
}

interface KnownStateIndex { changes: number[]; nextKnown: number[] }
interface ControlCoverageIndex { controls: PoliticalInterval[]; gaps: number[]; unknowns: number[]; states: KnownStateIndex[] }

/** Prefix transitions skip UNKNOWN; the first known state inside a query has no predecessor inside it. */
function indexKnownStates(values: (string | null)[]): KnownStateIndex {
  const changes = [0]; let previous: string | null = null;
  for (const value of values) {
    changes.push(changes[changes.length - 1] + Number(value !== null && previous !== null && value !== previous));
    if (value !== null) previous = value;
  }
  const nextKnown = new Array<number>(values.length + 1); nextKnown[values.length] = values.length;
  for (let index = values.length - 1; index >= 0; index--) nextKnown[index] = values[index] === null ? nextKnown[index + 1] : index;
  return { changes, nextKnown };
}

function indexControlCoverage(controls: PoliticalInterval[]): ControlCoverageIndex {
  const gaps = [0]; const unknowns = [0];
  for (let index = 0; index < controls.length; index++) {
    gaps.push(gaps[index] + Number(index > 0 && controls[index].startDate > controls[index - 1].endDate));
    unknowns.push(unknowns[index] + Number([controls[index].presidentParty, controls[index].houseControl, controls[index].senateControl].includes("UNKNOWN")));
  }
  const known = (value: string) => value === "UNKNOWN" ? null : value;
  return { controls, gaps, unknowns, states: [
    indexKnownStates(controls.map(row => row.presidentId)),
    indexKnownStates(controls.map(row => known(row.presidentParty))),
    indexKnownStates(controls.map(row => known(row.houseControl))),
    indexKnownStates(controls.map(row => known(row.senateControl))),
  ] };
}

/** Binary-search the half-open exposure range, then query coverage in constant time. */
function exposure(index: ControlCoverageIndex, start: string, end: string): { mixed: boolean; gap: boolean; unknown: boolean } {
  const { controls } = index;
  if (start >= end) return { mixed: false, gap: false, unknown: false };
  let lo = 0; let hi = controls.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (controls[mid].endDate <= start) lo = mid + 1;
    else hi = mid;
  }
  const from = lo; hi = controls.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (controls[mid].startDate < end) lo = mid + 1;
    else hi = mid;
  }
  const to = lo;
  if (from >= to) return { mixed: false, gap: true, unknown: false };
  const mixed = index.states.some(state => {
    const first = state.nextKnown[from];
    return first < to && state.changes[to] - state.changes[first + 1] > 0;
  });
  return {
    mixed,
    gap: controls[from].startDate > start || controls[to - 1].endDate < end || index.gaps[to] - index.gaps[from + 1] > 0,
    unknown: index.unknowns[to] - index.unknowns[from] > 0,
  };
}

/** Sweep availability once; late revisions of older observations never displace newer eligible observations. */
function fundamentalsByDecision(dataset: ResearchDataset): Map<string, FundamentalObservation> {
  type AvailableObservation = FundamentalObservation & { availableDate: string };
  const available = dataset.fundamentals.filter((row): row is AvailableObservation => row.availableDate !== null)
    .sort((a, b) => a.availableDate.localeCompare(b.availableDate) || a.date.localeCompare(b.date));
  const decisions = [...new Set(dataset.windows.map(window => window.decisionDate))].sort();
  const selections = new Map<string, FundamentalObservation>();
  let cursor = 0; let selected: AvailableObservation | undefined;
  for (const decision of decisions) {
    while (cursor < available.length && available[cursor].availableDate <= decision) {
      const candidate = available[cursor++];
      if (candidate.date <= decision && (!selected || candidate.date > selected.date || (candidate.date === selected.date && candidate.availableDate > selected.availableDate))) selected = candidate;
    }
    if (selected) selections.set(decision, selected);
  }
  return selections;
}

const BOOTSTRAP_RESAMPLES = 2000;

function stableSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function pseudoRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4_294_967_296;
  };
}

function mean(values: number[]): number {
  return values.reduce((value, observation, index) => value + (observation - value) / (index + 1), 0);
}

function percentile(values: number[], probability: number): number {
  const position = (values.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return values[lower] + (values[upper] - values[lower]) * (position - lower);
}

function descriptiveInterval(category: string, members: WindowResult[]): DescriptiveInterval {
  const clusters = new Map<string, { count: number; mean: number }>();
  for (const member of members) {
    if (member.presidentId === null || member.value === null) continue;
    const existing = clusters.get(member.presidentId) ?? { count: 0, mean: 0 };
    existing.mean += (member.value - existing.mean) / (existing.count + 1);
    existing.count += 1;
    clusters.set(member.presidentId, existing);
  }
  const clusterRows = [...clusters.entries()].sort(([left], [right]) => left.localeCompare(right));
  if (clusterRows.length < 2) {
    return {
      method: "ADMINISTRATION_CLUSTER_RESAMPLE", level: 0.95, resamples: BOOTSTRAP_RESAMPLES,
      clusterCount: clusterRows.length, lower: null, upper: null,
      unavailableReason: "At least two distinct administrations are required for a descriptive administration-cluster resample.",
    };
  }
  const random = pseudoRandom(stableSeed(`${category}|${clusterRows.map(([id, cluster]) => `${id}:${cluster.count}:${cluster.mean}`).join("|")}`));
  const estimates: number[] = [];
  for (let resample = 0; resample < BOOTSTRAP_RESAMPLES; resample++) {
    let total = 0;
    let count = 0;
    for (let draw = 0; draw < clusterRows.length; draw++) {
      const cluster = clusterRows[Math.floor(random() * clusterRows.length)][1];
      total += cluster.mean * cluster.count;
      count += cluster.count;
    }
    estimates.push(total / count);
  }
  estimates.sort((left, right) => left - right);
  return {
    method: "ADMINISTRATION_CLUSTER_RESAMPLE", level: 0.95, resamples: BOOTSTRAP_RESAMPLES,
    clusterCount: clusterRows.length, lower: percentile(estimates, 0.025), upper: percentile(estimates, 0.975), unavailableReason: null,
  };
}

function summaries(rows: WindowResult[], dimension: GroupingDimension): GroupSummary[] {
  const grouped = new Map<string, WindowResult[]>();
  for (const row of rows) {
    if (!row.included || row.value === null) continue;
    const label = groupLabel(row, dimension);
    const members = grouped.get(label) ?? [];
    members.push(row); grouped.set(label, members);
  }
  return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, members]) => {
    const values = members.map(row => row.value!).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    return {
      category, count: values.length,
      administrationCount: new Set(members.map(row => row.presidentId).filter((id): id is string => id !== null)).size,
      // Positive index levels bound simple/CAGR returns below by -1, so the
      // incremental update also avoids overflow at the upper finite limit.
      mean: mean(values),
      median: values.length % 2 ? values[middle] : values[middle - 1] / 2 + values[middle] / 2,
      min: values[0], max: values[values.length - 1],
      interval: descriptiveInterval(category, members),
    };
  });
}

/** Pure descriptive analysis. Inputs and configuration are validated on every entry. */
export function analyzeDataset(input: ResearchDataset, requestedConfig: AnalysisConfig): AnalysisResult {
  const dataset = parseResearchDataset(input);
  const config = parseAnalysisConfig(requestedConfig);
  const levels = [...dataset.levels].sort((a, b) => a.date.localeCompare(b.date));
  const controls = [...dataset.controls].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const coverage = indexControlCoverage(controls);
  const inheritedByDecision = fundamentalsByDecision(dataset);
  const rows: WindowResult[] = dataset.windows.map(window => {
    const reasons: string[] = [];
    let included = true;
    if (window.kind !== config.windowKind) { included = false; reasons.push(`Window kind ${window.kind} is outside selected ${config.windowKind} sampling frame.`); }
    if (!window.complete && !config.includePartial) { included = false; reasons.push("Partial window excluded by configuration."); }
    const endYear = Number(window.endDate.slice(0, 4));
    const excludedYears = config.excludeYears.filter(year => {
      if (window.kind === "CALENDAR_YEAR") return year === endYear;
      const yearText = String(year).padStart(4, "0");
      // Sensitivity exposure is (requested start, requested end]: the baseline
      // close does not itself expose a window to that prior calendar year.
      return dateDays(window.startDate) + 1 <= dateDays(`${yearText}-12-31`)
        && dateDays(window.endDate) >= dateDays(`${yearText}-01-01`);
    });
    if (excludedYears.length) {
      included = false;
      reasons.push(window.kind === "CALENDAR_YEAR"
        ? `Prespecified sensitivity excludes annual return end year ${endYear}.`
        : `Prespecified sensitivity excludes the entire presidential window overlapping return year(s) ${excludedYears.join(", ")}; no partial crisis-free return is constructed.`);
    }
    const start = endpoint(levels, window.startDate, config.maxEndpointGapDays);
    const end = endpoint(levels, window.endDate, config.maxEndpointGapDays);
    if (!start) { included = false; reasons.push(`Start endpoint unavailable: no observation on or before ${window.startDate} within ${config.maxEndpointGapDays} calendar days.`); }
    if (!end) { included = false; reasons.push(`End endpoint unavailable: no observation on or before ${window.endDate} within ${config.maxEndpointGapDays} calendar days.`); }
    let cumulativeReturn: number | null = null; let annualizedReturn: number | null = null;
    if (start && end) {
      const elapsedDays = dateDays(end.date) - dateDays(start.date);
      if (elapsedDays <= 0) {
        included = false; reasons.push("Actual endpoint dates do not define a positive-length return window.");
      } else {
        const cumulative = end.value / start.value - 1;
        const annualized = Math.expm1((Math.log(end.value) - Math.log(start.value)) * 365.2425 / elapsedDays);
        cumulativeReturn = Number.isFinite(cumulative) ? cumulative : null;
        annualizedReturn = Number.isFinite(annualized) ? annualized : null;
        if (cumulativeReturn === null) reasons.push("Cumulative return is numerically nonfinite; check level scale.");
        if (annualizedReturn === null) reasons.push("Annualized return is numerically nonfinite; check level scale and elapsed time.");
      }
    }
    const value = config.metric === "CUMULATIVE" ? cumulativeReturn : annualizedReturn;
    if (value === null) included = false;
    const selectedControl = controlAt(controls, window.decisionDate);
    const assignedCategory = category(selectedControl);
    if (assignedCategory === "UNCLASSIFIED") reasons.push("Political control at the decision date is missing or not fully classified D/R; retained as UNCLASSIFIED.");
    const { mixed, gap, unknown } = exposure(coverage, start?.date ?? window.startDate, end?.date ?? window.endDate);
    if (gap) reasons.push("Political-control coverage has gaps during the return window; no missing interval is imputed.");
    if (unknown) reasons.push("Political-control coverage includes UNKNOWN institutional states; unknown coverage alone does not establish an actual control change.");
    const inherited = inheritedByDecision.get(window.decisionDate);
    if (!inherited) reasons.push("No fundamental observation has both an observation date and known availability date on or before the decision date.");
    else {
      if (inherited.valuation === null) reasons.push("Eligible fundamental observation has no valuation; no substitute definition is used.");
      if (inherited.policyRatePct === null) reasons.push("Eligible fundamental observation has no policy rate.");
    }
    return {
      id: window.id, label: window.label, kind: window.kind, startDate: window.startDate, endDate: window.endDate,
      decisionDate: window.decisionDate, actualStartDate: start?.date ?? null, actualEndDate: end?.date ?? null,
      startLevel: start?.value ?? null, endLevel: end?.value ?? null, cumulativeReturn, annualizedReturn, value,
      category: assignedCategory,
      presidentParty: selectedControl?.presidentParty ?? null,
      houseControl: selectedControl?.houseControl ?? null,
      senateControl: selectedControl?.senateControl ?? null,
      governmentStructure: governmentStructure(selectedControl),
      presidentId: selectedControl?.presidentId ?? null, presidentName: selectedControl?.presidentName ?? null,
      mixedControl: mixed, complete: window.complete, included, reasons,
      valuation: inherited?.valuation ?? null, valuationDefinition: inherited?.valuationDefinition ?? null,
      policyRatePct: inherited?.policyRatePct ?? null, fundamentalDate: inherited?.date ?? null, fundamentalSourceId: inherited?.sourceId ?? null,
    };
  });
  const breakdowns: AnalysisResult["breakdowns"] = {
    POLITICAL_CONFIGURATION: summaries(rows, "POLITICAL_CONFIGURATION"),
    PRESIDENT_PARTY: summaries(rows, "PRESIDENT_PARTY"),
    HOUSE_CONTROL: summaries(rows, "HOUSE_CONTROL"),
    SENATE_CONTROL: summaries(rows, "SENATE_CONTROL"),
    GOVERNMENT_STRUCTURE: summaries(rows, "GOVERNMENT_STRUCTURE"),
  };
  const groups = breakdowns[config.grouping];
  const includedCount = rows.filter(row => row.included).length;
  const warnings = [
    dataset.kind === "ILLUSTRATIVE" ? "ILLUSTRATIVE: all fixture observations and executives are fictional. These are software demonstrations, not historical research results." : "User-supplied observations have not been independently verified by this module.",
    "At-decision political assignments are an explicit independent-reconstruction convention; the seed article's assignment rules and original exhibit remain unavailable, so exact source replication is unavailable.",
    "Descriptive historical grouping does not identify causal presidential impact. The displayed 95% administration-cluster resampling intervals summarize supplied historical variation; they are not causal confidence intervals, hypothesis tests, or investment forecasts.",
    "Window rows can share administrations or political regimes; the row count is not a count of independent presidential observations. Administration counts use distinct supplied president IDs at decision time.",
    "Fundamentals use only an observation dated and explicitly available on or before each decision date; unknown or later availability is ineligible. This selection does not independently verify the supplied vintage history.",
    "Political exposure diagnostics use half-open actual return-date intervals [start, end); endpoint dates and at-decision category remain separately inspectable.",
  ];
  if (config.excludeYears.length) warnings.push(`Sensitivity variant excludes annual return end year(s) ${config.excludeYears.join(", ")} and whole presidential periods overlapping those years in (requested startDate, requested endDate]. The baseline close alone does not count as exposure; no crisis-free subperiod is constructed. Retain the full-sample result as the primary comparison.`);
  if (config.includePartial) warnings.push("Partial windows are included and flagged; cumulative returns across unequal durations are not directly comparable.");
  if (!includedCount) warnings.push("No windows satisfy the selected sampling frame, availability, and inclusion rules.");
  if (rows.some(row => row.included && row.category === "UNCLASSIFIED")) warnings.push("Some included returns have unclassified political control; they remain a separate group.");
  return { methodVersion: METHOD_VERSION, config, rows, breakdowns, groups, includedCount, excludedCount: rows.length - includedCount, warnings };
}
