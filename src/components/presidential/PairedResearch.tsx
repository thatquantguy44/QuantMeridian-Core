import { useMemo, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import type { PipelineSelection } from "@/lib/presidential/bundle";
import type { AnalysisConfig } from "@/lib/presidential/contracts";
import { derivePairedComparison, type ComparisonMode, type PairedComparison } from "@/lib/presidential/comparison";
import { createPipelineRun } from "@/lib/presidential/pipelineReplay";
import { exportPairedCsv } from "@/lib/presidential/viewExports";
import { downloadText } from "@/lib/presidential/exports";
import { CategoryChart } from "./ResearchCharts";
import { FigurePanel } from "./FigurePanel";
import { buttonClass, inputClass } from "./ResearchInputs";

function percent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  const scaled = value * 100;
  return Number.isFinite(scaled) ? `${scaled.toFixed(2)}%` : `${value.toExponential(3)} decimal`;
}

function GroupTable({ pair, label }: { pair: PairedComparison; label: string }) {
  return <div className="overflow-x-auto">
    <table className="w-full min-w-[680px] text-left text-xs" aria-label={label}>
      <thead><tr className="border-b border-term-border text-term-text-dim"><th className="p-2">Group</th><th className="p-2">Windows</th><th className="p-2">CRSP proxy mean</th><th className="p-2">Shiller mean</th><th className="p-2">Difference</th></tr></thead>
      <tbody>{pair.left.groups.map(group => {
        const right = pair.right.groups.find(item => item.category === group.category)!;
        return <tr key={group.category} className="border-b border-term-border/50"><th className="p-2 font-normal">{group.category}</th><td className="p-2">{group.count}</td><td className="p-2">{percent(group.mean)}</td><td className="p-2">{percent(right.mean)}</td><td className="p-2">{percent(right.mean - group.mean)}</td></tr>;
      })}</tbody>
    </table>
  </div>;
}

export function PairedResearch({ selection, config, excludedYears, interpretation, initialMode = "common" }: {
  selection: PipelineSelection; config: AnalysisConfig; excludedYears: number[]; interpretation: string; initialMode?: ComparisonMode;
}) {
  const [mode, setMode] = useState<ComparisonMode>(initialMode);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const result = useMemo(() => {
    try {
      const full = derivePairedComparison(selection, { ...config, excludeYears: [] }, mode);
      const sensitivity = excludedYears.length
        ? derivePairedComparison(selection, { ...config, excludeYears: excludedYears }, mode)
        : null;
      return { full, sensitivity, error: null };
    } catch (error) {
      return { full: null, sensitivity: null, error: error instanceof Error ? error.message : "Matched comparison is unavailable." };
    }
  }, [selection, config, excludedYears, mode]);
  const pair = result.sensitivity ?? result.full;
  const exportConfig = { ...config, excludeYears: excludedYears };
  async function saveReplay() {
    setExporting(true); setExportError(null);
    try {
      const run = await createPipelineRun(selection, { kind: "paired", sample: mode }, exportConfig, interpretation);
      downloadText("presidential-paired-run.json", JSON.stringify(run, null, 2), "application/json");
    } catch { setExportError("Paired replay could not be created. Check the selected snapshot and retry."); }
    finally { setExporting(false); }
  }
  const quality = selection.catalog.catalog.inputKind === "SYNTHETIC_FIXTURE" ? "DEMO · ILLUSTRATIVE DATA" : "USER-SUPPLIED · UNVERIFIED";
  return <Panel title="Matched return comparison" code="PAIRED" resizable={false}>
    <div className="space-y-3 p-3">
      <label className="flex max-w-md flex-col gap-1 text-2xs text-term-text-dim">Comparison sample
        <select aria-label="Comparison sample" className={inputClass} value={mode} onChange={event => setMode(event.target.value as ComparisonMode)}>
          <option value="common">Common sample · CRSP proxy vs Shiller</option>
          <option value="inherited">Matched inherited conditions · CRSP proxy vs Shiller</option>
        </select>
      </label>
      {selection.catalog.catalog.inputKind === "SYNTHETIC_FIXTURE" && <p className="text-xs font-semibold text-term-amber">FICTIONAL FIXTURE · no historical observations</p>}
      <p className="text-xs leading-relaxed text-term-text-dim">Both series use the same annual windows and political assignment. The full CRSP sample remains separately selectable above. The Shiller series is a dividend-reinvestment-style reconstruction; it is not an official total-return index.</p>
      {mode === "inherited" && <p className="text-xs leading-relaxed text-term-text-dim">CAPE and the effective funds rate use the prior October observations with assumed November availability. These dates are a timing convention, not verified real-time vintages.</p>}
      {result.error && <p role="alert" className="border border-term-amber/40 p-2 text-xs text-term-text">Matched comparison unavailable: {result.error}</p>}
      {result.full && pair && <>
        <p className="break-words text-2xs text-term-text-dim">Left: {pair.leftDataset.title} · Right: {pair.rightDataset.title}</p>
        <p className="text-xs text-term-text">Full paired sample: {result.full.left.includedCount} included / {result.full.left.excludedCount} excluded windows. {result.sensitivity && `Sensitivity excluding ${excludedYears.join(", ")}: ${pair.left.includedCount} included / ${pair.left.excludedCount} excluded in both series.`}</p>
        <h3 className="text-xs font-semibold text-term-text">Full paired sample</h3>
        <GroupTable pair={result.full} label="Full paired comparison group summary" />
        {result.sensitivity && <><h3 className="text-xs font-semibold text-term-text">Sensitivity comparison</h3><GroupTable pair={result.sensitivity} label="Paired sensitivity group summary" /></>}
        <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => downloadText("presidential-paired.csv", exportPairedCsv(selection, pair, mode, exportConfig), "text/csv")}>Download paired CSV</button><button type="button" className={buttonClass} disabled={exporting} onClick={() => { void saveReplay(); }}>Download paired replay</button></div>
        {exportError && <p role="alert" className="text-xs text-term-amber">{exportError}</p>}
        <div className="grid min-w-0 gap-2 xl:grid-cols-2">
          <FigurePanel id="presidential-paired-crsp" title="Matched CRSP proxy groups" ready caption={`${pair.leftDataset.title}; matched ${mode} sample ${pair.rows.map(row => row.year).join(", ")}; ${pair.left.includedCount} included; ${config.metric}; ${pair.leftDataset.currency}; nominal total returns in percent; excluded years ${excludedYears.join(", ") || "none"}; political assignment at origin; descriptive, not causal; snapshot ${selection.catalog.snapshotId}; ${quality}.`} watermark={quality}><CategoryChart result={pair.left} /></FigurePanel>
          <FigurePanel id="presidential-paired-shiller" title="Matched Shiller groups" ready caption={`${pair.rightDataset.title}; dividend-reinvestment-style approximation, not an official total-return index; matched ${mode} sample ${pair.rows.map(row => row.year).join(", ")}; ${pair.right.includedCount} included; ${config.metric}; ${pair.rightDataset.currency}; nominal total returns in percent; excluded years ${excludedYears.join(", ") || "none"}; political assignment at origin; descriptive, not causal; snapshot ${selection.catalog.snapshotId}; ${quality}.`} watermark={quality}><CategoryChart result={pair.right} /></FigurePanel>
        </div>
        <p className="text-2xs text-term-text-dim">Annual ledger {result.sensitivity ? "shows the sensitivity selection and retains excluded rows" : "shows the full paired sample"}.</p>
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[850px] text-left text-xs" aria-label="Matched annual comparison ledger">
            <thead><tr className="border-b border-term-border text-term-text-dim"><th className="p-2">Year / decision</th><th className="p-2">Political configuration</th><th className="p-2">CRSP proxy</th><th className="p-2">Shiller</th><th className="p-2">Difference</th><th className="p-2">Inclusion</th>{mode === "inherited" && <th className="p-2">Inherited input timing</th>}</tr></thead>
            <tbody>{pair.rows.map(row => <tr key={row.year} className="border-b border-term-border/50 align-top">
              <th className="p-2 font-normal">{row.year}<br /><span className="text-2xs text-term-text-dim">{row.left.decisionDate}</span></th>
              <td className="p-2">{row.left.category}</td><td className="p-2">{percent(row.left.value)}</td><td className="p-2">{percent(row.right.value)}</td><td className="p-2">{percent(row.difference)}</td>
              <td className="p-2">{row.left.included ? "Included" : `Excluded: ${[...new Set([...row.left.reasons, ...row.right.reasons])].join(" ")}`}</td>
              {mode === "inherited" && <td className="p-2">CAPE {row.left.valuation ?? "unavailable"}: observed {row.inherited?.valuationDate}, assumed available {row.inherited?.valuationAvailable}<br />FEDFUNDS {row.left.policyRatePct ?? "unavailable"}%: observed {row.inherited?.policyDate}, assumed available {row.inherited?.policyAvailable}</td>}
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </div>
  </Panel>;
}
