import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import type { PipelineSelection } from "@/lib/presidential/bundle";
import type { AnalysisConfig } from "@/lib/presidential/contracts";
import { createPipelineRun } from "@/lib/presidential/pipelineReplay";
import { exportCycleCsv } from "@/lib/presidential/viewExports";
import { downloadText } from "@/lib/presidential/exports";
import { FigurePanel } from "./FigurePanel";
import { deriveCycleAnalysis, type CycleSummary } from "@/lib/presidential/cycle";
import { buttonClass, inputClass } from "./ResearchInputs";

function pct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  const result = value * 100;
  return Number.isFinite(result) ? `${result.toFixed(2)}%` : `${value.toExponential(3)} decimal`;
}
function detail(value: CycleSummary["best"]): string { return `${value.year} · ${value.president} · ${pct(value.returnDecimal)}`; }

export function CycleResearch({ selection, config, interpretation, initialSeries = "crsp", initialHighlight = false }: { selection: PipelineSelection; config: AnalysisConfig; interpretation: string; initialSeries?: "crsp" | "shiller"; initialHighlight?: boolean }) {
  const [series, setSeries] = useState<"crsp" | "shiller">(initialSeries);
  const [showTransitions, setShowTransitions] = useState(initialHighlight);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const result = useMemo(() => {
    try { return { value: deriveCycleAnalysis(selection), error: null }; }
    catch (error) { return { value: null, error: error instanceof Error ? error.message : "Cycle evidence is unavailable." }; }
  }, [selection]);
  const summary = series === "crsp" ? result.value?.crsp : result.value?.shiller;
  async function saveReplay() {
    setExporting(true); setExportError(null);
    try {
      const run = await createPipelineRun(selection, { kind: "cycle", series, highlightTransitions: showTransitions }, config, interpretation);
      downloadText("presidential-cycle-run.json", JSON.stringify(run, null, 2), "application/json");
    } catch { setExportError("Cycle replay could not be created. Check the selected snapshot and retry."); }
    finally { setExporting(false); }
  }
  const quality = selection.catalog.catalog.inputKind === "SYNTHETIC_FIXTURE" ? "DEMO · ILLUSTRATIVE DATA" : "USER-SUPPLIED · UNVERIFIED";
  return <Panel title="Presidential term cycles" code="CYCLE" resizable={false}>
    <div className="space-y-3 p-3">
      <p className="text-xs leading-relaxed text-term-text-dim">This supplementary descriptive view assigns each calendar-year return to the president in office on December 31. It does not change the primary political grouping at the window start. First-cycle years begin after the January 20 inauguration; a separate flag records a president changing within the window.</p>
      <p className="text-xs leading-relaxed text-term-text-dim">Both treatments use the same eligible common-sample years. Highlighting transitions does not exclude them. This view does not apply the separate sensitivity-year controls.</p>
      {selection.catalog.catalog.inputKind === "SYNTHETIC_FIXTURE" && <p className="text-xs font-semibold text-term-amber">FICTIONAL FIXTURE · no historical observations</p>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 max-w-md flex-1 flex-col gap-1 text-2xs text-term-text-dim">Cycle return construction
          <select aria-label="Cycle return construction" className={inputClass} value={series} onChange={event => setSeries(event.target.value as "crsp" | "shiller")}>
            <option value="crsp">CRSP market proxy</option><option value="shiller">Shiller dividend-reinvestment-style approximation</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-term-text"><input type="checkbox" checked={showTransitions} onChange={event => setShowTransitions(event.target.checked)} />Highlight inauguration transitions</label>
      </div>
      {result.error && <p role="alert" className="border border-term-amber/40 p-2 text-xs text-term-text">Cycle analysis unavailable: {result.error}</p>}
      {result.value && summary && <>
        <p className="text-xs text-term-text">{result.value.rows.length} paired cycle windows · {result.value.rows.filter(row => row.inaugurationTransition).length} inauguration-transition windows · {result.value.rows.filter(row => row.presidentChangedWithinWindow).length} president changes within a window. {result.value.excludedYears.length ? `Pre-1937 excluded: ${result.value.excludedYears.join(", ")}.` : "No pre-1937 windows in this sample."}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-xs" aria-label="Presidential cycle group summary">
            <thead><tr className="border-b border-term-border text-term-text-dim"><th className="p-2">President party</th><th className="p-2">Cycle year</th><th className="p-2">Windows / administrations</th><th className="p-2">Mean / median</th><th className="p-2">Sample standard deviation</th><th className="p-2">Minimum / maximum</th><th className="p-2">Best year</th><th className="p-2">Worst year</th><th className="p-2">Transitions / successions</th></tr></thead>
            <tbody>{summary.map(group => <tr key={`${group.presidentParty}-${group.termCycleYear}`} className="border-b border-term-border/50 align-top"><th className="p-2 font-normal">{group.presidentParty}</th><td className="p-2">{group.termCycleYear}</td><td className="p-2">{group.observations} / {group.administrations}</td><td className="p-2">{pct(group.meanReturnDecimal)} / {pct(group.medianReturnDecimal)}</td><td className="p-2">{pct(group.sampleStandardDeviationDecimal)}</td><td className="p-2">{pct(group.minimumReturnDecimal)} / {pct(group.maximumReturnDecimal)}</td><td className="p-2">{detail(group.best)}</td><td className="p-2">{detail(group.worst)}</td><td className="p-2">{group.inaugurationTransitionWindows} / {group.presidentChangedWithinWindow}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => downloadText("presidential-cycle.csv", exportCycleCsv(selection, result.value!, series, showTransitions), "text/csv")}>Download cycle CSV</button><button type="button" className={buttonClass} disabled={exporting} onClick={() => { void saveReplay(); }}>Download cycle replay</button></div>
        {exportError && <p role="alert" className="text-xs text-term-amber">{exportError}</p>}
        <FigurePanel id="presidential-cycle-summary" title="Presidential cycle summary" ready caption={`${series === "crsp" ? "CRSP market proxy" : "Shiller dividend-reinvestment-style approximation, not an official total-return index"}; ${result.value.rows.length} matched cycle windows; years ${result.value.rows.map(row => row.year).join(", ")}; pre-1937 excluded ${result.value.excludedYears.join(", ") || "none"}; year-end president assignment; ${showTransitions ? "inauguration transitions highlighted, no years removed" : "all eligible years"}; nominal USD returns in percent; descriptive, not causal; snapshot ${selection.catalog.snapshotId}; ${quality}.`} watermark={quality}>
          <svg role="img" aria-label="Presidential cycle summary figure" viewBox={`0 0 740 ${Math.max(140, summary.length * 30 + 90)}`} width="740" height={Math.max(140, summary.length * 30 + 90)} className="block h-auto w-full min-w-[480px]" fontFamily="Arial, sans-serif">
            <title>Presidential cycle summary</title><desc>Mean return and sample count for each president party and cycle year.</desc><rect width="740" height="100%" fill="#fff" /><text x="20" y="32" fill="#34414d" fontSize="14">Party / cycle year</text><text x="310" y="32" fill="#34414d" fontSize="14">Windows</text><text x="450" y="32" fill="#34414d" fontSize="14">Mean return</text><text x="610" y="32" fill="#34414d" fontSize="14">Std. dev.</text>
            {summary.map((group, index) => <g key={`${group.presidentParty}-${group.termCycleYear}`} fill="#34414d" fontSize="13"><text x="20" y={65 + index * 30}>{group.presidentParty} / {group.termCycleYear}</text><text x="310" y={65 + index * 30}>{group.observations}</text><text x="450" y={65 + index * 30}>{pct(group.meanReturnDecimal)}</text><text x="610" y={65 + index * 30}>{pct(group.sampleStandardDeviationDecimal)}</text></g>)}
          </svg>
        </FigurePanel>
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[800px] text-left text-xs" aria-label="Presidential cycle annual ledger">
            <thead><tr className="border-b border-term-border text-term-text-dim"><th className="p-2">Year</th><th className="p-2">Year-end president / party</th><th className="p-2">Cycle year</th><th className="p-2">CRSP proxy</th><th className="p-2">Shiller approximation</th><th className="p-2">Transition</th><th className="p-2">President changed within window</th></tr></thead>
            <tbody>{result.value.rows.map(row => <tr key={row.year} className={`border-b border-term-border/50 ${showTransitions && row.inaugurationTransition ? "bg-term-amber/10" : ""}`}><th className="p-2 font-normal">{row.year}</th><td className="p-2">{row.endOfYearPresidentName} / {row.endOfYearPresidentParty}</td><td className="p-2">{row.termCycleYear}</td><td className="p-2">{pct(row.crspMarketProxyReturnDecimal)}</td><td className="p-2">{pct(row.shillerSpCompositeApproximationReturnDecimal)}</td><td className="p-2">{row.inaugurationTransition ? showTransitions ? "Inauguration transition highlighted" : "First-cycle year" : "—"}</td><td className="p-2">{row.presidentChangedWithinWindow ? "Yes" : "No"}</td></tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>
  </Panel>;
}
