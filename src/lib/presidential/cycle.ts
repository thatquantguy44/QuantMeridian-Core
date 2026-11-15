/** Strict cycle ledger reconciliation; the primary at-origin grouping is unchanged. */
import type { PipelineSelection } from "./bundle";
import { derivePairedComparison } from "./comparison";
import { DEFAULT_CONFIG, type PoliticalParty } from "./contracts";
import { canonicalJson } from "./exports";
import { parseStrictJson } from "./pipelineContract";

export interface CycleRow {
  year: number; termStartYear: number; termCycleYear: number; inaugurationTransition: boolean;
  presidentChangedWithinWindow: boolean; endOfYearPresidentId: string; endOfYearPresidentName: string;
  endOfYearPresidentParty: PoliticalParty; crspMarketProxyReturnDecimal: number;
  shillerSpCompositeApproximationReturnDecimal: number;
}
type ReturnField = "crspMarketProxyReturnDecimal" | "shillerSpCompositeApproximationReturnDecimal";
export interface CycleSummary {
  presidentParty: PoliticalParty; termCycleYear: number; observations: number; administrations: number;
  meanReturnDecimal: number; medianReturnDecimal: number; sampleStandardDeviationDecimal: number | null;
  minimumReturnDecimal: number; maximumReturnDecimal: number;
  best: { year: number; president: string; returnDecimal: number };
  worst: { year: number; president: string; returnDecimal: number };
  inaugurationTransitionWindows: number; presidentChangedWithinWindow: number;
}
const COLUMNS = ["year", "termStartYear", "termCycleYear", "inaugurationTransition", "presidentChangedWithinWindow", "endOfYearPresidentId", "endOfYearPresidentName", "endOfYearPresidentParty", "crspMarketProxyReturnDecimal", "shillerSpCompositeApproximationReturnDecimal"];
const KEYS = ["crsp-market-proxy-common-sample-annual", "shiller-sp-composite-annual"];
const PARTIES = ["D", "R", "OTHER", "TIED", "UNKNOWN"];
function obj(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid cycle evidence.");
  return value as Record<string, any>;
}
function csv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false, closed = false;
  function fieldEnd() { if (field.length > 10_000) throw new Error("Cycle CSV cell is too large."); row.push(field); field = ""; closed = false; }
  function rowEnd() { fieldEnd(); rows.push(row); row = []; if (rows.length > 100_001) throw new Error("Cycle CSV exceeds row limit."); }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { quoted = false; closed = true; }
      else field += ch;
    } else if (ch === '"') {
      if (field || closed) throw new Error("Malformed cycle CSV.");
      quoted = true;
    } else if (ch === ",") fieldEnd();
    else if (ch === "\n") rowEnd();
    else if (ch === "\r") { if (text[i + 1] !== "\n") throw new Error("Malformed cycle CSV."); }
    else { if (closed) throw new Error("Malformed cycle CSV."); field += ch; }
  }
  if (quoted) throw new Error("Malformed cycle CSV.");
  if (field || row.length || closed) rowEnd();
  return rows;
}
function integer(text: string): number {
  if (!/^\d{1,4}$/.test(text)) throw new Error("Invalid cycle year.");
  return Number(text);
}
function decimal(text: string): number {
  if (!/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) throw new Error("Invalid cycle return.");
  const value = Number(text); if (!Number.isFinite(value)) throw new Error("Invalid cycle return."); return value;
}
function bool(text: string): boolean {
  if (text === "True") return true;
  if (text === "False") return false;
  throw new Error("Invalid cycle boolean flag.");
}
function parseLedger(text: string): CycleRow[] {
  const [header, ...rows] = csv(text);
  if (!header || canonicalJson(header) !== canonicalJson(COLUMNS)) throw new Error("Invalid cycle CSV ledger header.");
  return rows.map(cells => {
    if (cells.length !== COLUMNS.length || !cells[5].trim() || !cells[6].trim() || !PARTIES.includes(cells[7])) throw new Error("Invalid cycle ledger row.");
    return { year: integer(cells[0]), termStartYear: integer(cells[1]), termCycleYear: integer(cells[2]), inaugurationTransition: bool(cells[3]), presidentChangedWithinWindow: bool(cells[4]), endOfYearPresidentId: cells[5], endOfYearPresidentName: cells[6], endOfYearPresidentParty: cells[7] as PoliticalParty, crspMarketProxyReturnDecimal: decimal(cells[8]), shillerSpCompositeApproximationReturnDecimal: decimal(cells[9]) };
  });
}
export function cyclePosition(year: number): { termStartYear: number; termCycleYear: number } | null {
  if (!Number.isInteger(year) || year < 1937) return null;
  const termStartYear = year - ((year - 1) % 4);
  return { termStartYear, termCycleYear: year - termStartYear + 1 };
}
export function summarizeCycle(rows: CycleRow[], field: ReturnField): CycleSummary[] {
  const groups = new Map<string, CycleRow[]>();
  for (const row of rows) {
    const key = `${row.endOfYearPresidentParty}|${row.termCycleYear}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.values()].map(group => {
    const ordered = [...group].sort((a, b) => a.year - b.year);
    const values = ordered.map(row => row[field]);
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const midpoint = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
    const dispersion = values.length > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1)) : null;
    const best = ordered.reduce((a, b) => b[field] > a[field] ? b : a);
    const worst = ordered.reduce((a, b) => b[field] < a[field] ? b : a);
    return { presidentParty: ordered[0].endOfYearPresidentParty, termCycleYear: ordered[0].termCycleYear,
      observations: ordered.length, administrations: new Set(ordered.map(row => row.endOfYearPresidentId)).size,
      meanReturnDecimal: mean, medianReturnDecimal: median, sampleStandardDeviationDecimal: dispersion,
      minimumReturnDecimal: sorted[0], maximumReturnDecimal: sorted.at(-1)!,
      best: { year: best.year, president: best.endOfYearPresidentName, returnDecimal: best[field] },
      worst: { year: worst.year, president: worst.endOfYearPresidentName, returnDecimal: worst[field] },
      inaugurationTransitionWindows: ordered.filter(row => row.inaugurationTransition).length,
      presidentChangedWithinWindow: ordered.filter(row => row.presidentChangedWithinWindow).length };
  }).sort((a, b) => a.presidentParty < b.presidentParty ? -1 : a.presidentParty > b.presidentParty ? 1 : a.termCycleYear - b.termCycleYear);
}
function close(left: unknown, right: unknown): boolean {
  if (typeof left === "number" && typeof right === "number") return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-12;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, i) => close(value, right[i]));
  if (left && right && typeof left === "object" && typeof right === "object") {
    const a = obj(left), b = obj(right), keys = Object.keys(a).sort();
    return canonicalJson(keys) === canonicalJson(Object.keys(b).sort()) && keys.every(key => close(a[key], b[key]));
  }
  return left === right;
}
function item(selection: PipelineSelection, role: string) {
  const rows = selection.evidence.filter(value => value.role === role);
  if (rows.length !== 1 || KEYS.some(key => !rows[0].boundSelectionKeys.includes(key))) throw new Error("Cycle evidence is unavailable.");
  return rows[0].content;
}
export function deriveCycleAnalysis(selection: PipelineSelection): { rows: CycleRow[]; excludedYears: number[]; crsp: CycleSummary[]; shiller: CycleSummary[] } {
  const pair = derivePairedComparison(selection, { ...DEFAULT_CONFIG, excludeYears: [] }, "common");
  const rows = parseLedger(item(selection, "presidential-cycle-ledger.csv"));
  const summary = obj(parseStrictJson(new TextEncoder().encode(item(selection, "presidential-cycle-summary.json"))));
  const excludedYears = pair.rows.filter(row => row.year < 1937).map(row => row.year);
  const eligible = pair.rows.filter(row => row.year >= 1937);
  if (rows.length !== eligible.length || !rows.length || new Set(rows.map(row => row.year)).size !== rows.length) throw new Error("Cycle ledger sample count does not match.");
  const controls = pair.leftDataset.controls;
  function control(date: string) { return controls.find(value => value.startDate <= date && date < value.endDate); }
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index], pairRow = eligible[index], position = cyclePosition(row.year);
    const start = control(pairRow.left.decisionDate), end = control(`${row.year}-12-31`);
    if (!position || row.year !== pairRow.year || row.termStartYear !== position.termStartYear || row.termCycleYear !== position.termCycleYear || row.inaugurationTransition !== (row.termCycleYear === 1) || !start || !end || row.presidentChangedWithinWindow !== (start.presidentId !== end.presidentId) || row.endOfYearPresidentId !== end.presidentId || row.endOfYearPresidentName !== end.presidentName || row.endOfYearPresidentParty !== end.presidentParty || !close(row.crspMarketProxyReturnDecimal, pairRow.left.cumulativeReturn) || !close(row.shillerSpCompositeApproximationReturnDecimal, pairRow.right.cumulativeReturn)) throw new Error("Cycle ledger flags, assignment or returns do not reconcile.");
  }
  const crsp = summarizeCycle(rows, "crspMarketProxyReturnDecimal"), shiller = summarizeCycle(rows, "shillerSpCompositeApproximationReturnDecimal");
  if (summary.schema_version !== 1 || summary.kind !== "PRESIDENTIAL_TERM_CYCLE_DESCRIPTIVE" || summary.observations !== rows.length || summary.first_annual_year !== rows[0].year || summary.last_annual_year !== rows.at(-1)!.year || !close(summary.excludedPre1937Years, excludedYears) || summary.inaugurationTransitionWindows !== rows.filter(row => row.inaugurationTransition).length || summary.presidentChangedWithinWindow !== rows.filter(row => row.presidentChangedWithinWindow).length || !Array.isArray(summary.series) || summary.series.length !== 2) throw new Error("Cycle summary counts do not reconcile.");
  const first = obj(summary.series[0]), second = obj(summary.series[1]);
  if (first.id !== "crsp_market_proxy" || first.returnField !== "crspMarketProxyReturnDecimal" || !close(first.byPartyAndCycle, crsp) || second.id !== "shiller_sp_composite_approximation" || second.returnField !== "shillerSpCompositeApproximationReturnDecimal" || !close(second.byPartyAndCycle, shiller)) throw new Error("Cycle summary statistics do not reconcile.");
  return { rows, excludedYears, crsp, shiller };
}
