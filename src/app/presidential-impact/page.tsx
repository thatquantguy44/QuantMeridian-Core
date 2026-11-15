import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, Tag } from "@/components/ui/Panel";
import { ProvenanceBadge } from "@/components/ui/ProvenanceBadge";
import { DEFAULT_CONFIG, GROUPING_LABELS, type AnalysisConfig, type ResearchDataset } from "@/lib/presidential/contracts";
import { analyzeDataset } from "@/lib/presidential/engine";
import { createRunManifest, downloadText, exportAnalysisCsv, withRunInterpretation } from "@/lib/presidential/exports";
import { AnalysisControls, ResearchInputs, buttonClass } from "@/components/presidential/ResearchInputs";
import { ResearchFigures } from "@/components/presidential/ResearchFigures";
import { ResearchLedger, SummaryTable } from "@/components/presidential/ResearchLedger";
import { ResearchEvidence } from "@/components/presidential/ResearchEvidence";
import { PairedResearch } from "@/components/presidential/PairedResearch";
import { CycleResearch } from "@/components/presidential/CycleResearch";
import type { PipelineSelection } from "@/lib/presidential/bundle";
import { createPipelineRun, type PipelineView, type ReplayResult } from "@/lib/presidential/pipelineReplay";

export default function PresidentialImpactPage() {
  const [dataset, setDataset] = useState<ResearchDataset | null>(null);
  const [pipeline, setPipeline] = useState<PipelineSelection | null>(null);
  const loadEpoch = useRef(0);
  const [replayedFixture, setReplayedFixture] = useState(false);
  const [restoredView, setRestoredView] = useState<PipelineView | null>(null);
  const [viewRevision, setViewRevision] = useState(0);
  const fictionalFixture = pipeline?.catalog.catalog.inputKind === "SYNTHETIC_FIXTURE" || replayedFixture;
  const [config, setConfig] = useState<AnalysisConfig>({ ...DEFAULT_CONFIG });
  const [exclude2008, setExclude2008] = useState(false);
  const [additionalYears, setAdditionalYears] = useState("");
  const [interpretation, setInterpretation] = useState("");
  const [numericalReceipt, setNumericalReceipt] = useState<{
    value: Awaited<ReturnType<typeof createRunManifest>>;
    dataset: ResearchDataset;
    result: ReturnType<typeof analyzeDataset>;
  } | null>(null);
  const [receipt, setReceipt] = useState<{
    value: Awaited<ReturnType<typeof createRunManifest>>;
    dataset: ResearchDataset;
    result: ReturnType<typeof analyzeDataset>;
    interpretation: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const result = useMemo(() => dataset ? analyzeDataset(dataset, { ...config, excludeYears: [] }) : null, [dataset, config]);
  const numericalManifest = numericalReceipt?.dataset === dataset && numericalReceipt?.result === result ? numericalReceipt.value : null;
  // Invalidate stale receipts during render, before an effect can clear them.
  const manifest = receipt?.dataset === dataset && receipt?.result === result && receipt?.interpretation === interpretation ? receipt.value : null;
  const invalidYears = additionalYears.trim() !== "" && (!/^\d{4}(\s*,\s*\d{4})*$/.test(additionalYears.trim()) || additionalYears.split(",").some(value => Number(value.trim()) < 1000));
  const excludedYears = useMemo(() => [...new Set([...(exclude2008 ? [2008] : []), ...(invalidYears ? [] : additionalYears.split(",").map(value => value.trim()).filter(Boolean).map(Number))])].sort((a, b) => a - b), [exclude2008, additionalYears, invalidYears]);
  const sensitivity = useMemo(() => dataset && excludedYears.length ? analyzeDataset(dataset, { ...config, excludeYears: excludedYears }) : null, [dataset, config, excludedYears]);
  useEffect(() => {
    let active = true;
    setNumericalReceipt(null); setError(null);
    if (dataset && result) void createRunManifest(dataset, result, "", { fictionalFixture })
      .then(value => { if (active) setNumericalReceipt({ value, dataset, result }); })
      .catch(() => { if (active) setError("Run identity could not be created. Export is unavailable; local results remain inspectable."); });
    return () => { active = false; };
  }, [dataset, result, fictionalFixture]);
  useEffect(() => {
    let active = true;
    setReceipt(null);
    if (numericalManifest && dataset && result) void withRunInterpretation(numericalManifest, interpretation)
      .then(value => { if (active) setReceipt({ value, dataset, result, interpretation }); })
      .catch(() => { if (active) setError("Commentary identity could not be created. Export is unavailable."); });
    return () => { active = false; };
  }, [numericalManifest, dataset, result, interpretation]);
  function load(value: ResearchDataset | null, selection: PipelineSelection | null = null) {
    loadEpoch.current++;
    setPipeline(selection); setReplayedFixture(false); setRestoredView(null); setViewRevision(value => value + 1);
    setDataset(value); setConfig({ ...DEFAULT_CONFIG }); setExclude2008(false); setAdditionalYears(""); setInterpretation(""); setError(null);
  }
  function restoreRun(restored: ReplayResult) {
    loadEpoch.current++;
    setDataset(restored.dataset); setPipeline(restored.snapshot); setReplayedFixture(restored.fictionalFixture);
    setConfig({ ...restored.config, excludeYears: [] });
    setExclude2008(restored.config.excludeYears.includes(2008));
    setAdditionalYears(restored.config.excludeYears.filter(year => year !== 2008).join(", "));
    setInterpretation(restored.interpretation); setRestoredView(restored.view);
    setViewRevision(value => value + 1); setError(null);
  }
  async function saveRunManifest(isSensitivity: boolean) {
    if (!dataset || !result || (isSensitivity && !sensitivity)) return;
    try {
      const selectedResult = isSensitivity ? sensitivity! : result;
      const value = pipeline ? await createPipelineRun(pipeline, { kind: "standalone" }, selectedResult.config, interpretation)
        : await createRunManifest(dataset, selectedResult, interpretation, { fictionalFixture });
      downloadText(isSensitivity ? "presidential-sensitivity-run.json" : "presidential-run.json", JSON.stringify(value, null, 2), "application/json");
    } catch { setError("The run manifest could not be exported. Try again."); }
  }
  return <div className="flex min-h-full min-w-0 flex-col">
    <PageHeader code="PRES" title="Presidential Impact" desc="Inherited conditions, political labels and market returns" showStreaming={false}
      right={<><Tag tone="amber">Local research</Tag>{(dataset?.kind === "ILLUSTRATIVE" || fictionalFixture) && <ProvenanceBadge source="SIM" simSelected />}<Tag>{dataset ? dataset.kind === "ILLUSTRATIVE" || fictionalFixture ? "DEMO" : "Unverified inputs" : "No dataset"}</Tag></>} />
    <div className="min-w-0 space-y-2 p-2">
      <div className="border border-term-border bg-term-panel px-3 py-3">
        <h2 className="text-sm font-medium text-term-text">What did the president inherit—and what changed?</h2>
        <p className="mt-1 max-w-5xl text-xs leading-relaxed text-term-text-dim">Reconstruct descriptive comparisons, inspect their assumptions and export figures for your research. Political labels do not establish presidential causation. This first version supports supplied nominal index levels and dated control intervals; published-article replication remains unverified.</p>
      </div>
      <ResearchInputs onLoad={load} onReplay={restoreRun} epoch={loadEpoch} />
      {dataset && result ? <>
        <div className={`space-y-2 border p-3 ${dataset.kind === "ILLUSTRATIVE" || fictionalFixture ? "border-term-amber/50 bg-term-amber/10" : "border-term-border bg-term-panel"}`}>
          <p className="text-xs font-semibold text-term-amber">{dataset.kind === "ILLUSTRATIVE" || fictionalFixture ? "DEMO · ILLUSTRATIVE DATA" : "USER-SUPPLIED · UNVERIFIED"}</p>
          <p className="break-words text-sm text-term-text">{dataset.title}</p>
          <p className="text-2xs leading-relaxed text-term-text-dim">{dataset.kind === "ILLUSTRATIVE" || fictionalFixture ? "All observations, political intervals and results in this demonstration are fictional. Do not cite these numbers as historical evidence." : "Source definitions and dates are supplied by you. Loading the file does not verify its accuracy, point-in-time availability or reuse rights."}</p>
          {pipeline && <div className="space-y-1 break-words text-2xs leading-relaxed text-term-text-dim" aria-label="Pipeline snapshot provenance">
            <p>Profile {pipeline.catalog.catalog.profileId} · snapshot {pipeline.catalog.snapshotId} · created {pipeline.catalog.catalog.createdAt} · received {pipeline.catalog.receivedAt}</p>
            <p>{pipeline.catalog.catalog.datasets.find(entry => entry.selectionKey === pipeline.selectionKey)?.construction} · assignment {pipeline.catalog.catalog.decisionPolicy}</p>
            <p>{pipeline.catalog.catalog.inputInventory.captures?.length ? pipeline.catalog.catalog.inputInventory.captures.map(item => `${item.sourceId} first seen ${item.firstSeenAt}`).join(" · ") : `Capture first seen ${pipeline.catalog.catalog.inputInventory.captureFirstSeenAt}`} · controls review admitted {pipeline.catalog.catalog.inputInventory.reviewAdmittedAt}. Source authenticity and real-time vintage availability are not independently verified.</p>
            {pipeline.catalog.catalog.limitations.map(item => <p key={item}>{item}</p>)}
          </div>}
          <div className="flex flex-wrap gap-2"><span className="text-2xs text-term-text-dim">{dataset.currency} · {dataset.nominalReal} · {dataset.returnBasis}</span><button type="button" className={buttonClass} onClick={() => load(null)}>Clear dataset</button></div>
        </div>
        <AnalysisControls config={config} onChange={value => setConfig({ ...value, excludeYears: [] })} exclude2008={exclude2008} onExclude2008={setExclude2008} additionalYears={additionalYears} onAdditionalYears={setAdditionalYears} />
        {pipeline && pipeline.datasets.length === 5 && <><PairedResearch key={`paired-${viewRevision}`} selection={pipeline} config={config} excludedYears={excludedYears} interpretation={interpretation} initialMode={restoredView?.kind === "paired" ? restoredView.sample : "common"} /><CycleResearch key={`cycle-${viewRevision}`} selection={pipeline} config={{ ...config, excludeYears: excludedYears }} interpretation={interpretation} initialSeries={restoredView?.kind === "cycle" ? restoredView.series : "crsp"} initialHighlight={restoredView?.kind === "cycle" && restoredView.highlightTransitions} /></>}
        {invalidYears && <p role="alert" className="border border-term-amber/40 p-3 text-xs text-term-text">Use four-digit years separated by commas. No additional-year sensitivity is calculated until corrected.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border border-term-border bg-term-panel px-3 py-2">
          <p role="status" className="text-xs text-term-text">Full sample: <strong>{result.includedCount}</strong> included / <strong>{result.excludedCount}</strong> excluded windows · {result.groups.length} observed {GROUPING_LABELS[config.grouping]} groups</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} disabled={!manifest} onClick={() => downloadText("presidential-analysis.csv", exportAnalysisCsv(dataset, result, { fictionalFixture }), "text/csv")}>Download analysis CSV</button>
            <button type="button" className={buttonClass} disabled={!manifest} onClick={() => { void saveRunManifest(false); }}>Download run manifest</button>
          </div>
        </div>
        {error && <p role="alert" className="border border-term-amber/40 p-3 text-xs text-term-text">{error}</p>}
        {result.warnings.length > 0 && <Panel title="Research limitations" resizable={false}><ul className="space-y-1 p-3 text-xs leading-relaxed text-term-text-dim">{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></Panel>}
        <ResearchFigures dataset={dataset} result={result} runId={manifest?.runId ?? null} fictionalFixture={fictionalFixture} />
        <Panel title={`Full-sample ${GROUPING_LABELS[config.grouping]} summary`} resizable={false}><SummaryTable result={result} name={`Full-sample ${GROUPING_LABELS[config.grouping]} summary`} /><p className="p-3 text-2xs text-term-text-dim">Means, medians and ranges describe supplied windows. The 95% administration-cluster resampling range is descriptive and retains repeated windows within an administration; it is not causal or predictive inference.</p></Panel>
        {sensitivity && <Panel title="Sensitivity comparison" code="SENSITIVITY" resizable={false}>
          <div className="space-y-2 p-3"><h2 className="text-sm font-medium text-term-text">Sensitivity comparison</h2><p className="text-xs leading-relaxed text-term-text-dim">Exclude {config.windowKind === "CALENDAR_YEAR" ? "annual-return years" : "whole presidential periods overlapping"} {excludedYears.join(", ")}, consistently across all categories. Presidential-period overlap uses (requested start, requested end], so the starting baseline day is not an extra exposure year. {sensitivity.includedCount} included / {sensitivity.excludedCount} excluded. Full-sample results above remain the primary comparison.</p><div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => downloadText("presidential-sensitivity.csv", exportAnalysisCsv(dataset, sensitivity, { fictionalFixture }), "text/csv")}>Download sensitivity CSV</button><button type="button" className={buttonClass} onClick={() => { void saveRunManifest(true); }}>Download sensitivity manifest</button></div></div>
          <SummaryTable result={sensitivity} name={`Sensitivity ${GROUPING_LABELS[config.grouping]} summary`} />
        </Panel>}
        <ResearchLedger dataset={dataset} result={result} />
        <ResearchEvidence dataset={dataset} result={result} runId={manifest?.runId ?? null} interpretation={interpretation} onInterpretation={setInterpretation} />
      </> : <Panel resizable={false}>
        <div className="space-y-3 px-4 py-10"><h2 className="text-sm font-medium text-term-text">No research dataset loaded</h2><p className="max-w-2xl text-xs leading-relaxed text-term-text-dim">Import your source-backed JSON, or explicitly load the illustrative dataset to try the analysis and figure exports. No market data, political history or demonstration values load automatically.</p><p className="max-w-2xl text-2xs leading-relaxed text-term-text-dim">Prepare index levels, political-control intervals, analysis windows and dated starting fundamentals. Separate calendar-year comparisons from presidential periods. Record source substitutions before describing a reconstruction as a replication.</p></div>
      </Panel>}
    </div>
  </div>;
}
