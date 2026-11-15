import { useEffect, useRef, useState } from "react";
import { LineChart } from "@/components/charts/LineChart";
import { MultiAssetPanel } from "@/components/portfolioRegime/MultiAssetPanel";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Tag } from "@/components/ui/Panel";
import { breakChartGaps } from "@/lib/benchmarkHistory";
import { fetchVixForward } from "@/lib/vixForwardClient";
import { inspectPoraSource, sourceCsv, type PoraSourceBasis, type PoraSourceInspection } from "@/lib/portfolioRegime/sourceInspection";

function PoraSourceBadge({ loading, available, failed }: { loading: boolean; available: boolean; failed: boolean }) {
  return <Tag tone={available ? "blue" : failed ? "down" : "amber"}>{loading ? "Checking SPY source" : available ? "SPY retained DB · evidence checked" : failed ? "SPY source unavailable" : "SPY source not checked"}</Tag>;
}

/** An explicitly selected source preview; no dataset is admitted to a model here. */
export default function PortfolioRegimePage() {
  const [basis, setBasis] = useState<PoraSourceBasis | "">("");
  const [inspection, setInspection] = useState<PoraSourceInspection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => { active.current?.abort(); }, []);
  function selectBasis(value: PoraSourceBasis | "") {
    active.current?.abort(); active.current = null;
    setBasis(value); setInspection(null); setError(null); setLoading(false);
  }
  async function inspect() {
    if (!basis || active.current) return;
    const controller = new AbortController(); active.current = controller;
    setInspection(null); setError(null); setLoading(true);
    try {
      const data = await fetchVixForward(basis, controller.signal);
      const result = inspectPoraSource(data, basis);
      if (!controller.signal.aborted) setInspection(result);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Source history is unavailable.");
    } finally { if (active.current === controller) { active.current = null; setLoading(false); } }
  }
  function download() {
    if (!inspection) return;
    const url = URL.createObjectURL(new Blob([sourceCsv(inspection)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `PORA_${inspection.basis}_source.csv`; link.click(); URL.revokeObjectURL(url);
  }
  const recent = inspection?.rows.slice(-260) ?? [];
  const plot = breakChartGaps(recent.map(([date, value]) => ({ date, value })), 5);
  const percent = (value: number | null) => value === null ? "Unavailable" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  return <div className="flex min-h-full min-w-0 flex-col">
    <PageHeader code="PORA" title="Portfolio Optimization & Regime Analysis" desc="Source review and portfolio research" showStreaming={false} right={<><PoraSourceBadge loading={loading} available={!!inspection} failed={!!error} /><Tag tone="amber">Research preview</Tag></>} />
    <div className="grid min-w-0 grid-cols-1 gap-2 p-2 xl:grid-cols-3">
      <div className="min-w-0 space-y-2 xl:col-span-2">
      <Panel title="Source inspection" code="DATA" accent resizable={false}>
        <div className="space-y-3 p-3 text-xs text-term-text-dim">
          <p>Select a retained SPY history to inspect its evidence and coverage. This is a source review, not a portfolio snapshot or model run.</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">SPY history basis<select aria-label="SPY history basis" value={basis} onChange={(event) => selectBasis(event.target.value as PoraSourceBasis | "")} className="border border-term-border bg-term-panel-2 px-2 py-1 text-term-text"><option value="">Select a basis</option><option value="spy_price">SPY price · unadjusted close</option><option value="spy_total">SPY total return · derived index</option></select></label>
            <button type="button" onClick={() => void inspect()} disabled={!basis || loading} className="term-btn disabled:opacity-40">{loading ? "Checking source…" : "Inspect source history"}</button>
            <button type="button" onClick={download} disabled={!inspection} className="term-btn disabled:opacity-40">Export source CSV</button>
          </div>
          <p className="text-2xs">Current-vintage retained history is not a point-in-time archive. Source inspection does not establish historical data availability or investment eligibility.</p>
          {loading && <p role="status">Checking retained source evidence…</p>}
          {error && <p role="alert" className="border border-term-down/40 p-2 text-term-down">{error} No prior or substitute history is displayed.</p>}
          {!inspection && !loading && !error && <p className="border border-term-border p-3">No source selected. Choose a basis and inspect it to see data.</p>}
          {inspection && <div className="space-y-3">
            <div data-testid="pora-source-coverage" className="border border-term-border p-2 text-term-text">{inspection.count.toLocaleString()} observations · {inspection.firstDate} to {inspection.lastDate} · last observation {inspection.rows.at(-1)![1].toFixed(2)} {basis === "spy_price" ? "USD" : "index points"}</div>
            <div data-testid="pora-source-evidence" className="space-y-1 border border-term-border p-2 text-2xs"><div>{inspection.provider} · {inspection.kind}</div><div>{inspection.method}</div><div>Source check: {inspection.verifiedAt} · latest warehouse ingestion: {inspection.lastIngestedAt}</div><div>Source records: {inspection.sourceSeries.join(", ")}. Observation dates are not publication timestamps.</div></div>
            {inspection.warnings.map((warning, index) => <p key={index} className="text-2xs text-term-amber">{warning}</p>)}
            <div className="grid gap-2 sm:grid-cols-2"><div className="border border-term-border p-2">Change across retained sample: <span className="text-term-text">{percent(inspection.totalChangePct)}</span></div><div className="border border-term-border p-2">Change from previous observation ({inspection.previousDate ?? "unavailable"}): <span className="text-term-text">{percent(inspection.previousChangePct)}</span></div></div>
            <div className="overflow-x-auto"><LineChart series={[{ name: "SPY retained history", data: plot.map((row) => row.value), color: "#FF8C00" }]} labels={plot.map((row) => row.date)} height={180} yFmt={(value) => value.toFixed(1)} /><div className="text-2xs">Chart shows up to the latest 260 observations; gaps over five calendar days break the line. Spacing follows observation order.</div></div>
            <div className="overflow-x-auto"><table className="w-full text-left text-2xs" aria-label="Recent SPY observations"><thead><tr><th>Date</th><th>Retained value</th></tr></thead><tbody>{inspection.rows.slice(-10).reverse().map(([date, value]) => <tr key={date} className="border-t border-term-border"><td>{date}</td><td>{value.toFixed(4)}</td></tr>)}</tbody></table></div>
          </div>}
        </div>
      </Panel>
      <MultiAssetPanel />
      </div>
      <div className="space-y-2">
        <Panel title="Portfolio lab" code="PORT" resizable={false}><p className="p-3 text-xs text-term-text-dim">Portfolio optimizer is not available yet. A qualified multi-asset snapshot, model binding and independent checks are needed before weights can be calculated.</p></Panel>
        <Panel title="Regime lab" code="REG" resizable={false}><p className="p-3 text-xs text-term-text-dim">Statistical regime models and strategy evaluation are not available yet. This preview does not infer regimes or generate forecasts.</p></Panel>
        <Panel title="Source boundary" code="INFO" resizable={false}><p className="p-3 text-xs text-term-text-dim">The single-SPY view uses the existing VIXR check, including VIX evidence. The multi-asset comparison checks Tiingo inputs and retained receipts directly against the warehouse calendar. Neither contacts Tiingo or establishes original publication time. Missing evidence leaves the relevant view unavailable; no simulated prices are substituted.</p></Panel>
      </div>
    </div>
  </div>;
}
