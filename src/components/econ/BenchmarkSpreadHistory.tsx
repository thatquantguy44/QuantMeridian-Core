import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart } from "@/components/charts/LineChart";
import { Panel } from "@/components/ui/Panel";
import { SPREAD_PAIRS, computeSpread, type Obs, type SpreadPair } from "@/data/benchmarkRates";
import { breakChartGaps, cadenceGapDays, priorMonths } from "@/lib/benchmarkHistory";
import { fetchQualifiedBenchmarks, type QualifiedBenchmarkSeries } from "@/lib/benchmarkQualified";
import { BENCHMARK_AS_OF_TIME_ZONE, benchmarkAsOfDate } from "@/lib/benchmarkAsOf";

interface LoadedSeries {
  observations: Obs[];
  checkedAtByDate: Record<string, string>;
  evidenceByDate: Record<string, string>;
}
type LoadedPair = Record<string, LoadedSeries>;
const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

/** Mounted per pair and snapshot: older pages cannot leak into another pair or refresh. */
export function BenchmarkSpreadHistory({ pair, series, checkedAt, onSelect }: { pair: SpreadPair; series: QualifiedBenchmarkSeries[]; checkedAt: string | null; onSelect: (id: string) => void }) {
  const inputs = [pair.seriesA, pair.seriesB].map((id) => series.find((item) => item.id === id));
  const [loaded, setLoaded] = useState<LoadedPair>(() => Object.fromEntries(inputs.flatMap((item) => item?.status === "available" ? [[item.id, {
    observations: item.observations,
    checkedAtByDate: Object.fromEntries(item.observations.map((row) => [row.date, checkedAt ?? "unknown"])),
    evidenceByDate: Object.fromEntries(item.observations.map((row) => [row.date, item.evidenceMethods.join("; ")])),
  }]] : [])));
  const [range, setRange] = useState("12");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, []);
  const complete = inputs.every((item) => item?.status === "available" && loaded[item.id]?.observations.length);
  const canLoad = complete && inputs.some((item) => !item!.firstRetainedDate || loaded[item!.id].observations[0].date > item!.firstRetainedDate);
  const map = useMemo(() => Object.fromEntries(Object.entries(loaded).map(([id, value]) => [id, value.observations])), [loaded]);
  const all = computeSpread(map, pair.id);
  const cutoff = range === "ALL" || !all?.dates.length ? null : priorMonths(all.dates.at(-1)!, Number(range));
  const selectedMap = useMemo(() => Object.fromEntries(Object.entries(map).map(([id, rows]) => [id, cutoff ? rows.filter((row) => row.date >= cutoff) : rows])), [map, cutoff]);
  const result = computeSpread(selectedMap, pair.id);
  const rows = result?.dates.map((date, i) => ({ date, value: result.hist[i] })) ?? [];
  const cadence = inputs.map((item) => cadenceGapDays(item?.frequency ?? null));
  const gap = cadence.every((days) => days !== undefined) ? Math.max(...cadence as number[]) : undefined;
  const plottedRows = rows.slice(-20000);
  const plot = breakChartGaps(plottedRows, gap);

  async function loadOlder() {
    if (!canLoad || loading || controller.current) return;
    const active = new AbortController(); controller.current = active;
    setLoading(true); setError(null);
    try {
      const pages = await Promise.all(inputs.map(async (item) => {
        if (!item || item.status !== "available") throw new Error("Both series need qualified history.");
        const before = loaded[item.id].observations[0].date;
        if (item.firstRetainedDate && before <= item.firstRetainedDate) return null;
        const response = await fetchQualifiedBenchmarks(active.signal, { id: item.id, before, limit: 1000 });
        const older = response.series[0];
        if (!older || older.status !== "available" || older.frequency !== item.frequency || older.nativeUnit !== item.nativeUnit || older.displayUnit !== item.displayUnit || older.observations.some((row) => row.date >= before)) throw new Error(`${item.id}: ${older?.reason ?? "Earlier qualified history is unavailable."}`);
        return { id: item.id, older, checkedAt: response.checkedAt };
      }));
      if (active.signal.aborted) return;
      setLoaded((current) => {
        const next = { ...current };
        for (const page of pages) if (page) {
          const previous = current[page.id];
          next[page.id] = { observations: [...page.older.observations, ...previous.observations],
            checkedAtByDate: { ...previous.checkedAtByDate, ...Object.fromEntries(page.older.observations.map((row) => [row.date, page.checkedAt])) },
            evidenceByDate: { ...previous.evidenceByDate, ...Object.fromEntries(page.older.observations.map((row) => [row.date, page.older.evidenceMethods.join("; ")])) } };
        }
        return next;
      });
    } catch (cause) {
      if (!active.signal.aborted) { active.abort(); setError(cause instanceof Error ? cause.message : "Earlier qualified history is unavailable."); }
    } finally { if (controller.current === active) { controller.current = null; setLoading(false); } }
  }

  function download() {
    if (!rows.length) return;
    const [a, b] = inputs;
    if (!a || !b) return;
    const valueA = new Map(loaded[a.id].observations.map((row) => [row.date, row.value]));
    const valueB = new Map(loaded[b.id].observations.map((row) => [row.date, row.value]));
    const csv = [["date", "spread_bps", "series_a", "series_a_value", "series_a_unit", "series_a_source_url", "series_a_page_evidence_methods", "series_a_page_checked_at", "series_a_page_as_of_date", "series_b", "series_b_value", "series_b_unit", "series_b_source_url", "series_b_page_evidence_methods", "series_b_page_checked_at", "series_b_page_as_of_date", "as_of_time_zone"], ...rows.map((row) => {
      const aChecked = loaded[a.id].checkedAtByDate[row.date]; const bChecked = loaded[b.id].checkedAtByDate[row.date];
      return [row.date, row.value, a.id, valueA.get(row.date)!, a.displayUnit, a.sourceUrl, loaded[a.id].evidenceByDate[row.date], aChecked, aChecked === "unknown" ? "unknown" : benchmarkAsOfDate(new Date(aChecked)), b.id, valueB.get(row.date)!, b.displayUnit, b.sourceUrl, loaded[b.id].evidenceByDate[row.date], bChecked, bChecked === "unknown" ? "unknown" : benchmarkAsOfDate(new Date(bChecked)), BENCHMARK_AS_OF_TIME_ZONE];
    })].map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `BMRK_${pair.id}_spread.csv`; link.click(); URL.revokeObjectURL(url);
  }

  return <Panel title={`${pair.label} — Qualified Spread History`} code="SPHX" accent right={<select aria-label="Spread pair" value={pair.id} onChange={(event) => onSelect(event.target.value)} className="border border-term-border bg-term-panel-3 px-1 py-px text-3xs text-term-amber">{SPREAD_PAIRS.map((p) => <option key={p.id} value={p.id}>{p.label} — {p.desc}</option>)}</select>}>
    <div className="flex flex-wrap items-center gap-2 p-2 text-2xs">
      <label>Window <select aria-label="Spread history window" value={range} onChange={(event) => setRange(event.target.value)} className="ml-1 bg-term-panel-2 p-1 text-term-text"><option value="12">1 year</option><option value="24">2 years</option><option value="60">5 years</option><option value="ALL">All loaded</option></select></label>
      <button type="button" onClick={loadOlder} disabled={!canLoad || loading} className="rounded border border-term-border px-2 py-1 disabled:opacity-40">{loading ? "Loading…" : complete && !canLoad ? "Earliest retained loaded" : "Load older spread history"}</button>
      <button type="button" onClick={download} disabled={!rows.length} className="rounded border border-term-border px-2 py-1 disabled:opacity-40">Export spread CSV</button>
    </div>
    <div className="px-2 pb-1 text-2xs text-term-text-dim" data-testid="benchmark-spread-history-coverage">{rows.length ? `${rows.length} matched observations · ${rows[0].date} to ${rows.at(-1)!.date}` : "Unavailable: both qualified series need matched observation dates."} {complete ? `${pair.seriesA}: ${selectedMap[pair.seriesA].length} loaded observations, ${selectedMap[pair.seriesA].length - rows.length} unmatched; ${pair.seriesB}: ${selectedMap[pair.seriesB].length} loaded observations, ${selectedMap[pair.seriesB].length - rows.length} unmatched.` : ""} Exact dates only; no filled values. Latest-revised pages can have different check times and are not a point-in-time archive.</div>
    <div className="px-2 pb-1 text-3xs text-term-text-mute">{inputs.map((item, i) => item?.status === "available" ? `${item.id}: ${loaded[item.id].observations[0]?.date ?? "unavailable"} to ${loaded[item.id].observations.at(-1)?.date ?? "unavailable"}, retained from ${item.firstRetainedDate ?? "unknown"}` : `${i ? pair.seriesB : pair.seriesA}: ${item?.reason ?? "qualified history unavailable"}`).join(" · ")}</div>
    {error && <div role="alert" className="px-2 pb-2 text-2xs text-term-down">{error} No older pages from this attempt were added; the existing matched history remains available.</div>}
    <div className="p-2"><LineChart series={[{ name: pair.label, data: plot.map((row) => row.value), color: "#3B9DFF" }]} labels={plot.map((row) => row.date)} height={300} yFmt={(value) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}bps`} /><div className="text-3xs text-term-text-mute">{rows.length > plottedRows.length ? `Chart shows the most recent ${plottedRows.length} matched observations; statistics and CSV cover the selected window. ` : ""}Gaps beyond the input cadence thresholds break the line; spacing follows observation order.</div></div>
    <div className="grid grid-cols-3 gap-px border-t border-term-border bg-term-border text-center text-2xs sm:grid-cols-6" data-testid="benchmark-spread-statistics">{[["Latest", result?.current, " bps"], ["Δ1 obs", result?.chg1d, " bps"], ["Δ20 obs", result?.chg20d, " bps"], ["Mean", result?.mean, " bps"], ["Z-score", result?.zScore, ""], ["Percentile", result?.percentile, "%"]].map(([label, value, unit]) => <div key={String(label)} className="bg-term-panel px-2 py-1.5"><div className="text-3xs text-term-text-mute">{label}</div><div className="tnum text-term-text">{typeof value === "number" ? `${value}${unit}` : "Unavailable"}</div></div>)}</div>
  </Panel>;
}
