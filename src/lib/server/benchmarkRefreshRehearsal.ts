import { benchmarkAsOfDate } from "@/lib/benchmarkAsOf";
import { BENCHMARK_FRED_IDS, defOf, type Obs } from "@/data/benchmarkRates";
import type { QualifiedBenchmarkSeries } from "@/lib/benchmarkQualified";
import { benchmarkEvidenceKey, qualifyBenchmarkSeries, type BenchmarkEvidenceRow } from "./benchmarkQualification";
import { verifyBenchmarkReceipts, type BenchmarkReceipt } from "./benchmarkReceiptEvidence";
import { verifyBenchmarkRepairEvidence, type BenchmarkRepairBatch } from "./benchmarkRepairEvidence";

export interface RefreshEvidenceRow extends BenchmarkEvidenceRow { series_id: string }
export interface RefreshCandidate extends RefreshEvidenceRow { duplicate_count: number }
export interface RehearsalSeries {
  id: string; status: "staged" | "blocked"; reason: string | null; priorGoldDate: string | null;
  latestDate: string | null; futureExcluded: number; addedCount: number; observations: Obs[];
  evidence: { date: string; method: string; runId: string; ingestedAt: string; realtimeStart: string | null; realtimeEnd: string | null; rawValue: string; rowHash: string }[];
}
export interface RehearsalResult { asOfDate: string; promotable: false; series: RehearsalSeries[] }

export interface RehearsalBoard { as_of_date: string | null; latest_date: string | null; latest_value: unknown }

/** Board status is a snapshot comparison, never evidence of source authenticity. */
export function classifyRehearsalBoard(board: RehearsalBoard | null, observed: Obs | undefined, factor: number, asOfDate: string): "matched" | "differs" | "future" | "unavailable" {
  const validDate = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!board) return "unavailable";
  if ((validDate(board.as_of_date) && board.as_of_date > asOfDate) || (validDate(board.latest_date) && board.latest_date > asOfDate)) return "future";
  if (!validDate(board.as_of_date) || !validDate(board.latest_date) || board.latest_date > board.as_of_date || board.latest_value == null || !["string", "number"].includes(typeof board.latest_value) || String(board.latest_value).trim() === "") return "unavailable";
  const value = Number(board.latest_value) * factor;
  if (!Number.isFinite(value) || !observed || !Number.isFinite(observed.value)) return "unavailable";
  return board.latest_date === observed.date && Math.abs(value - observed.value) <= 1e-9 * Math.max(1, Math.abs(value), Math.abs(observed.value)) ? "matched" : "differs";
}

/** Strict options: invalid requests must not silently select all series or the current baseline. */
export function parseRehearsalArgs(args: string[], now: Date): { requestedIds: string[]; historicalDate: string | undefined } {
  if (args.some((arg) => !arg.startsWith("--series=") && !arg.startsWith("--baseline-through="))) throw new Error("Supported options: --series=ID,ID and --baseline-through=YYYY-MM-DD.");
  const seriesArgs = args.filter((arg) => arg.startsWith("--series="));
  const dateArgs = args.filter((arg) => arg.startsWith("--baseline-through="));
  if (seriesArgs.length > 1 || dateArgs.length > 1) throw new Error("Repeated rehearsal options are not supported.");
  const seriesArg = seriesArgs[0]?.slice("--series=".length);
  const historicalDate = dateArgs[0]?.slice("--baseline-through=".length);
  const requestedIds = seriesArg === undefined ? BENCHMARK_FRED_IDS : [...new Set(seriesArg.split(","))];
  if (!requestedIds.length || requestedIds.some((id) => !BENCHMARK_FRED_IDS.includes(id))) throw new Error("Unsupported benchmark series.");
  if (historicalDate !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(historicalDate) || !Number.isFinite(Date.parse(`${historicalDate}T00:00:00Z`)) || new Date(`${historicalDate}T00:00:00Z`).toISOString().slice(0, 10) !== historicalDate || historicalDate >= benchmarkAsOfDate(now))) throw new Error("Historical baseline date must be a valid past date.");
  return { requestedIds, historicalDate };
}

/** Append-only rehearsal. It creates no production writes or claim of full Gold-board parity. */
export async function rehearseBenchmarkRefresh(input: {
  baseline: QualifiedBenchmarkSeries[]; baselineRows: RefreshEvidenceRow[]; matchedBaselineIds: Set<string>; revisedIds: Set<string>; overflowIds: Set<string>;
  candidates: RefreshCandidate[]; receipts: BenchmarkReceipt[]; repairs: BenchmarkRepairBatch[]; now: Date;
}): Promise<RehearsalResult> {
  const asOfDate = benchmarkAsOfDate(input.now);
  const candidates: RefreshCandidate[] = input.candidates.map((row) => ({ ...row, receipt_endpoint: null }));
  const baselineRows: RefreshEvidenceRow[] = input.baselineRows.map((row) => ({ ...row, receipt_endpoint: null }));
  const allRows = [...baselineRows, ...candidates];
  const receipts = verifyBenchmarkReceipts(input.receipts, allRows);
  for (const row of allRows) if (row.run_id && receipts.has(benchmarkEvidenceKey(row.series_id, row.run_id, row.date, row.realtime_start))) row.receipt_endpoint = "series/observations";
  const repairs = await verifyBenchmarkRepairEvidence(input.repairs, allRows);
  const groups = new Map<string, RefreshCandidate[]>(), baselineGroups = new Map<string, RefreshEvidenceRow[]>();
  for (const row of candidates) { const group = groups.get(row.series_id) ?? []; group.push(row); groups.set(row.series_id, group); }
  for (const row of baselineRows) { const group = baselineGroups.get(row.series_id) ?? []; group.push(row); baselineGroups.set(row.series_id, group); }
  const series = input.baseline.map((base): RehearsalSeries => {
    const def = defOf(base.id);
    const rows = groups.get(base.id) ?? [];
    const futureExcluded = rows.filter((row) => row.date > asOfDate).length;
    const blocked = (reason: string): RehearsalSeries => ({ id: base.id, status: "blocked", reason, priorGoldDate: base.observationDate,
      latestDate: null, futureExcluded, addedCount: 0, observations: [], evidence: [] });
    if (!def || base.status !== "available" || base.provider !== "FRED" || !base.frequency || !base.nativeUnit || !base.observationDate || !base.observations.length || !base.evidenceMethods.length) return blocked(base.reason ?? "Qualified baseline unavailable.");
    if (!input.matchedBaselineIds.has(base.id)) return blocked("Gold snapshot changed or did not match the qualified baseline.");
    if (input.revisedIds.has(base.id)) return blocked("A retained Gold observation differs from the latest Silver revision.");
    if (input.overflowIds.has(base.id)) return blocked("Candidate count exceeds the bounded rehearsal limit.");
    const verifiedRows = baselineGroups.get(base.id) ?? [];
    const checkedBaseline = qualifyBenchmarkSeries({ definition: def, metadata: { source: "fred", frequency: base.frequency, units: base.nativeUnit },
      rows: verifiedRows, firstRetainedDate: null, board: null, repairEvidence: repairs, now: input.now });
    if (checkedBaseline.status !== "available" || checkedBaseline.observations.length !== base.observations.length ||
      checkedBaseline.observations.some((item, i) => item.date !== base.observations[i].date || item.value !== base.observations[i].value)) return blocked("Baseline source evidence does not match the qualified snapshot.");
    if (rows.some((row) => !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(`${row.date}T00:00:00Z`)) || new Date(`${row.date}T00:00:00Z`).toISOString().slice(0, 10) !== row.date)) return blocked("Invalid candidate observation date.");
    const present = rows.filter((row) => row.date <= asOfDate);
    let prior = base.observationDate;
    const appended: Obs[] = [];
    const evidenceOf = (row: RefreshEvidenceRow, method: string) => ({ date: row.date, method, runId: row.run_id!, ingestedAt: row.ingested_at!,
      realtimeStart: row.realtime_start, realtimeEnd: row.realtime_end ?? null, rawValue: String(row.raw_value), rowHash: row.row_hash! });
    const evidence: RehearsalSeries["evidence"] = verifiedRows.map((row) => evidenceOf(row, row.receipt_endpoint === "series/observations" ? "provider-receipt" : "audited-repair-capture"));
    for (const row of present) {
      if (Number(row.duplicate_count) !== 1 || row.date <= prior) return blocked("Duplicate or unordered candidate observations.");
      const qualified = qualifyBenchmarkSeries({ definition: def, metadata: { source: "fred", frequency: base.frequency, units: base.nativeUnit },
        rows: [row], firstRetainedDate: null, board: null, repairEvidence: repairs, now: input.now });
      if (qualified.status !== "available") return blocked(`Candidate ${row.date}: ${qualified.reason}`);
      appended.push(qualified.observations[0]);
      evidence.push(evidenceOf(row, qualified.evidenceMethods[0]));
      prior = row.date;
    }
    const observations = [...base.observations, ...appended];
    return { id: base.id, status: "staged", reason: null, priorGoldDate: base.observationDate, latestDate: observations.at(-1)!.date,
      futureExcluded, addedCount: appended.length, observations, evidence };
  });
  return { asOfDate, promotable: false, series };
}
