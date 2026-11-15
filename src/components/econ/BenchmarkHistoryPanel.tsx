import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart } from "@/components/charts/LineChart";
import { Panel } from "@/components/ui/Panel";
import { BENCHMARK_SERIES, defOf, type Obs } from "@/data/benchmarkRates";
import { breakChartGaps, cadenceGapDays, calendarChanges, descriptiveHistory, priorMonths, rollingHistory } from "@/lib/benchmarkHistory";
import { benchmarkChange, benchmarkValue, fetchQualifiedBenchmarks, type QualifiedBenchmarkSeries } from "@/lib/benchmarkQualified";
import { BENCHMARK_AS_OF_TIME_ZONE, benchmarkAsOfDate } from "@/lib/benchmarkAsOf";

interface HistoryPage { key: string; observations: Obs[]; methods: string[]; pageCheckedAt: string; checkedAtByDate: Record<string, string> }
const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

/** A separate, bounded history explorer; current cards never inherit an older page's as-of date. */
export function BenchmarkHistoryPanel({ series, checkedAt }: { series: QualifiedBenchmarkSeries[]; checkedAt: string | null }) {
  const [id, setId] = useState("SOFR");
  const [range, setRange] = useState("ALL");
  const [page, setPage] = useState<HistoryPage | null>(null);
  const [loadingKey, setLoadingKey] = useState("");
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const key = `${checkedAt ?? "none"}:${id}`;
  const currentKey = useRef(key);
  currentKey.current = key;
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { setLoadingKey(""); setFailure(null); return () => { controller.current?.abort(); }; }, [key]);
  const item = series.find((row) => row.id === id);
  const def = defOf(id);
  const observations = page?.key === key ? page.observations : item?.status === "available" ? item.observations : [];
  const methods = page?.key === key ? page.methods : item?.evidenceMethods ?? [];
  const cutoff = range === "ALL" || !observations.length ? null : priorMonths(observations.at(-1)!.date, Number(range) * 12);
  const shown = useMemo(() => cutoff ? observations.filter((row) => row.date >= cutoff) : observations, [observations, cutoff]);
  const stats = useMemo(() => descriptiveHistory(shown), [shown]);
  const changes = useMemo(() => calendarChanges(shown, item?.frequency ?? null), [shown, item?.frequency]);
  const rolling = useMemo(() => rollingHistory(shown, item?.frequency ?? null), [shown, item?.frequency]);
  const rollingChart = rolling.slice(-20000);
  const noMore = !!item?.firstRetainedDate && !!observations.length && observations[0].date <= item.firstRetainedDate;
  const loading = loadingKey === key;

  async function loadOlder() {
    const before = observations[0]?.date;
    if (!before || !item || loading) return;
    controller.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setLoadingKey(key); setFailure(null);
    try {
      const result = await fetchQualifiedBenchmarks(active.signal, { id, before, limit: 1000 });
      const older = result.series.find((row) => row.id === id);
      if (active.signal.aborted || currentKey.current !== key) return;
      if (result.series.length !== 1 || !older || older.status !== "available" || older.frequency !== item.frequency || older.nativeUnit !== item.nativeUnit || older.observations.some((row) => row.date >= before)) throw new Error(older?.reason ?? "Earlier qualified history is unavailable.");
      setPage({ key, observations: [...older.observations, ...observations], methods: [...new Set([...older.evidenceMethods, ...methods])], pageCheckedAt: result.checkedAt, checkedAtByDate: { ...(page?.key === key ? page.checkedAtByDate : {}), ...Object.fromEntries(older.observations.map((row) => [row.date, result.checkedAt])) } });
    } catch (error) {
      if (!active.signal.aborted && currentKey.current === key) setFailure({ key, message: error instanceof Error ? error.message : "Earlier history is unavailable." });
    } finally { if (currentKey.current === key) setLoadingKey(""); }
  }

  function download() {
    if (!item || !def || !shown.length) return;
    const rows = [["series", "date", "value", "display_unit", "distributor", "source_url", "loaded_batch_evidence_methods", "observation_page_checked_at", "observation_page_as_of_date", "as_of_time_zone"],
      ...shown.map((o) => {
        const checked = page?.key === key ? page.checkedAtByDate[o.date] ?? checkedAt : checkedAt;
        return [id, o.date, o.value, def.unit, "FRED", item.sourceUrl, methods.join("; "), checked ?? "unknown", checked ? benchmarkAsOfDate(new Date(checked)) : "unknown", BENCHMARK_AS_OF_TIME_ZONE];
      })];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `BMRK_${id}_history.csv`; a.click(); URL.revokeObjectURL(url);
  }

  // Gaps are rendering markers only; exports retain the original observations.
  const chartRows = shown.slice(-20000);
  const plot = breakChartGaps(chartRows, cadenceGapDays(item?.frequency ?? null));
  const format = (value: number | null) => def && value !== null ? benchmarkValue(def, value) : "Unavailable";
  const formatChange = (value: number | null) => def ? benchmarkChange(def, value) : "Unavailable";
  return <Panel title="Qualified Historical Analysis" code="HIST+" className="col-span-12" resizable={false}>
    <div className="flex flex-wrap items-end gap-2 p-2 text-xs">
      <label>Series <select aria-label="Historical series" value={id} onChange={(event) => setId(event.target.value)} className="ml-1 bg-term-panel-2 p-1 text-term-text">{BENCHMARK_SERIES.map((row) => <option key={row.id} value={row.id}>{row.short} · {row.id}</option>)}</select></label>
      <label>Window <select aria-label="Historical window" value={range} onChange={(event) => setRange(event.target.value)} className="ml-1 bg-term-panel-2 p-1 text-term-text"><option value="1">1 year</option><option value="2">2 years</option><option value="5">5 years</option><option value="ALL">All loaded</option></select></label>
      <button type="button" onClick={loadOlder} disabled={!observations.length || loading || noMore} className="rounded border border-term-border px-2 py-1 disabled:opacity-40">{loading ? "Loading…" : noMore ? "Earliest retained loaded" : "Load older history"}</button>
      <button type="button" onClick={download} disabled={!shown.length} className="rounded border border-term-border px-2 py-1 disabled:opacity-40">Export loaded CSV</button>
    </div>
    <div className="px-2 pb-2 text-2xs text-term-text-dim" data-testid="benchmark-history-coverage">{shown.length ? `${stats.count} observations · ${stats.firstDate} to ${stats.lastDate} · retained from ${item?.firstRetainedDate ?? "unknown"} · ${item?.frequency ?? "unknown"} frequency` : item?.reason ?? "No qualified history available."} {page?.key === key ? `Older page checked ${page.pageCheckedAt}.` : ""} Latest-revised history; not a point-in-time archive.</div>
    {failure?.key === key && <div role="alert" className="px-2 pb-2 text-2xs text-term-down">{failure.message} The current qualified history remains available.</div>}
    {shown.length > 0 && <div className="grid gap-2 p-2 xl:grid-cols-2">
      <div className="min-w-0 overflow-auto"><LineChart series={[{ name: id, data: plot.map((o) => o.value), color: "#FF8C00" }]} labels={plot.map((o) => o.date)} height={180} yFmt={(v) => format(v)} /><div className="text-3xs text-term-text-mute">{shown.length > chartRows.length ? `Chart shows the most recent ${chartRows.length} observations. ` : ""}Gaps beyond cadence thresholds break the line; spacing follows observation order.</div></div>
      <div className="overflow-auto"><table className="w-full text-left text-2xs"><thead><tr><th>Period</th><th>Target date</th><th>Actual date</th><th>Prior level</th><th>Change</th></tr></thead><tbody>{changes.map((change) => <tr key={change.label} className="border-t border-term-border"><td>{change.label}</td><td>{change.targetDate}</td><td>{change.date ?? "Unavailable"}</td><td>{format(change.value)}</td><td>{formatChange(change.change)}</td></tr>)}</tbody></table><div className="pt-2 text-3xs text-term-text-mute">Latest observation on or before target; allowable lag is bounded by cadence and horizon. Percent-denominated rate changes are in basis points; changes are not annualized returns.</div></div>
      <div className="xl:col-span-2 text-2xs text-term-text-dim" data-testid="benchmark-history-statistics">Sample: {stats.count} · Range: {format(stats.min)} to {format(stats.max)} · Mean: {format(stats.mean)} · Percentile: {stats.percentile === null ? "Unavailable" : `${stats.percentile.toFixed(1)}%`} · Z-score: {stats.zScore?.toFixed(2) ?? "Unavailable"} · Std. dev. of consecutive observed changes: {formatChange(stats.changeVolatility)} (not annualized; intervals may differ).</div>
      <div className="xl:col-span-2 min-w-0 overflow-auto" data-testid="benchmark-rolling-history">
        <div className="pb-1 text-2xs text-term-text-dim">Trailing 20-observation change: {formatChange(rolling.at(-1)?.change ?? null)} · change volatility: {formatChange(rolling.at(-1)?.volatility ?? null)} · {rolling.at(-1)?.fromDate ?? "—"} to {rolling.at(-1)?.date ?? "—"}.</div>
        {rollingChart.some((row) => row.change !== null) ? <LineChart series={[{ name: "20-observation change", data: rollingChart.map((row) => row.change ?? NaN), color: "#FF8C00" }, { name: "Change volatility", data: rollingChart.map((row) => row.volatility ?? NaN), color: "#3B9DFF" }]} labels={rollingChart.map((row) => row.date)} height={150} yFmt={(v) => formatChange(v)} /> : <div className="text-2xs text-term-text-dim">Unavailable: 21 qualified observations without oversized cadence gaps are required.</div>}
        <div className="text-3xs text-term-text-mute">Amber: change; blue: sample standard deviation of 20 consecutive changes. Windows crossing cadence gaps are unavailable; volatility is not annualized.</div>
      </div>
    </div>}
  </Panel>;
}
