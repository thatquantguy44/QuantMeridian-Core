import { useEffect, useState, type MutableRefObject } from "react";
import { Panel } from "@/components/ui/Panel";
import { GROUPING_LABELS, type AnalysisConfig, type ResearchDataset } from "@/lib/presidential/contracts";
import { illustrativeDataset } from "@/lib/presidential/fixtures";
import { parseResearchDataset } from "@/lib/presidential/validation";
import { downloadText } from "@/lib/presidential/exports";
import { getPipelineCatalog, loadPipelineSelection, type PipelineCatalog, type PipelineSelection } from "@/lib/presidential/bundle";
import { replayPresidentialRun, type ReplayResult } from "@/lib/presidential/pipelineReplay";

export const inputClass = "min-w-0 max-w-full border border-term-border bg-term-panel-2 px-2 py-1.5 text-xs text-term-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber";
export const buttonClass = "term-btn focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber disabled:cursor-not-allowed disabled:opacity-50";

export function ResearchInputs({ onLoad, onReplay, epoch }: { onLoad: (dataset: ResearchDataset | null, pipeline?: PipelineSelection | null) => void; onReplay: (result: ReplayResult) => void; epoch: MutableRefObject<number> }) {
  const [error, setError] = useState<string | null>(null);
  const [activity, setActivity] = useState<{ token: number; message: string } | null>(null);
  const [catalog, setCatalog] = useState<PipelineCatalog | null>(null);
  const [selectedKey, setSelectedKey] = useState("");
  useEffect(() => () => { epoch.current++; }, [epoch]);
  const reading = activity?.token === epoch.current;
  function start(message: string) {
    const token = ++epoch.current;
    setError(null); setActivity({ token, message });
    return token;
  }
  function finish(token: number) { if (token === epoch.current) setActivity(null); }
  async function importFile(file: File | undefined) {
    if (!file) return;
    const token = start("Reading local JSON…");
    if (file.size > 5 * 1024 * 1024) { setError("Import rejected: JSON files must be no larger than 5 MiB."); finish(token); return; }
    try {
      let value: unknown;
      try { value = JSON.parse(await file.text()); }
      catch { throw new Error("Import rejected: select a valid JSON document."); }
      const dataset = parseResearchDataset(value);
      if (token === epoch.current) onLoad(dataset, null);
    } catch (e) { if (token === epoch.current) setError(e instanceof Error ? e.message : "The research dataset could not be read."); }
    finally { finish(token); }
  }
  async function importReplay(file: File | undefined) {
    if (!file) return;
    const token = start("Verifying saved research run…");
    if (file.size > 40 * 1024 * 1024) { setError("Run import rejected: files must be no larger than 40 MiB."); finish(token); return; }
    try {
      const restored = await replayPresidentialRun(new Uint8Array(await file.arrayBuffer()));
      if (token === epoch.current) onReplay(restored);
    } catch (e) { if (token === epoch.current) setError(e instanceof Error ? e.message : "The saved run could not be verified."); }
    finally { finish(token); }
  }
  async function checkPipeline() {
    const token = start("Checking local pipeline snapshots…");
    try {
      const next = await getPipelineCatalog();
      if (token !== epoch.current) return;
      setCatalog(next);
      setSelectedKey(current => next.catalog.datasets.some(entry => entry.selectionKey === current) ? current : next.catalog.datasets[0].selectionKey);
    } catch (e) { if (token === epoch.current) setError(e instanceof Error ? e.message : "The local pipeline is unavailable."); }
    finally { finish(token); }
  }
  async function loadPipeline() {
    if (!catalog || !selectedKey) return;
    const token = start("Verifying selected pipeline snapshot…");
    try {
      const selection = await loadPipelineSelection(catalog, selectedKey);
      if (token === epoch.current) onLoad(selection.dataset, selection);
    } catch (e) { if (token === epoch.current) setError(e instanceof Error ? e.message : "The selected snapshot is unavailable."); }
    finally { finish(token); }
  }
  return <Panel title="Research inputs" code="LOCAL" resizable={false}>
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-2xs text-term-text-dim">
          Import research JSON
          <input type="file" accept=".json,application/json" aria-label="Import research JSON" className={`${inputClass} w-full text-2xs`}
            onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void importFile(file); }} />
        </label>
        <button type="button" className={buttonClass} onClick={() => { setError(null); onLoad(illustrativeDataset, null); }}>Load illustrative dataset</button>
        <button type="button" className={buttonClass} onClick={() => downloadText("presidential-illustrative-template.json", JSON.stringify(illustrativeDataset, null, 2), "application/json")}>Download JSON template</button>
      </div>
      <label className="flex max-w-xl flex-col gap-1 text-2xs text-term-text-dim">Import saved research run
        <input type="file" accept=".json,application/json" aria-label="Import saved research run" className={`${inputClass} w-full text-2xs`} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void importReplay(file); }} />
      </label>
      <p className="text-2xs leading-relaxed text-term-text-dim">Saved v1 and v2 runs are verified and replayed locally. Maximum run file size is 40 MiB.</p>
      <p className="text-2xs leading-relaxed text-term-text-dim">Files stay in this browser session. Maximum 5 MiB. The template contains fictional observations: replace its data, sources and kind before using your own evidence. Imported observations are not independently verified.</p>
      <div className="space-y-2 border-t border-term-border pt-3">
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" className={buttonClass} onClick={() => { void checkPipeline(); }}>{catalog ? "Check for pipeline updates" : "Check for pipeline snapshots"}</button>
          {catalog && <>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-2xs text-term-text-dim">Pipeline dataset
              <select aria-label="Pipeline dataset" className={`${inputClass} w-full`} value={selectedKey} onChange={event => { epoch.current++; setActivity(null); setError(null); setSelectedKey(event.target.value); }}>
                {catalog.catalog.datasets.map(entry => <option key={entry.selectionKey} value={entry.selectionKey}>{entry.title} · {entry.firstYear}–{entry.lastYear} · {entry.windowCount} windows</option>)}
              </select>
            </label>
            <button type="button" className={buttonClass} onClick={() => { void loadPipeline(); }}>Load pipeline snapshot</button>
          </>}
        </div>
        {catalog && <p className="break-words text-2xs text-term-text-dim">Available profile {catalog.catalog.profileId} · snapshot {catalog.snapshotId.slice(0, 12)} · {catalog.catalog.inputKind === "SYNTHETIC_FIXTURE" ? "FICTIONAL FIXTURE — not historical observations" : "captured inputs — source authenticity not independently verified"}. Checking for updates does not replace your loaded analysis.</p>}
      </div>
      {reading && <p role="status" className="text-xs text-term-text-dim">{activity?.message}</p>}
      {error && <p role="alert" className="border border-term-down/40 bg-term-down/10 p-2 text-xs text-term-text">{error}</p>}
    </div>
  </Panel>;
}

export function AnalysisControls({ config, onChange, exclude2008, onExclude2008, additionalYears, onAdditionalYears }: {
  config: AnalysisConfig; onChange: (config: AnalysisConfig) => void;
  exclude2008: boolean; onExclude2008: (value: boolean) => void;
  additionalYears: string; onAdditionalYears: (value: string) => void;
}) {
  return <Panel title="Comparison definitions" code="METHOD" resizable={false}>
    <div className="space-y-3 p-3">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="flex min-w-0 flex-col gap-1 text-2xs text-term-text-dim">Window type
          <select className={inputClass} value={config.windowKind} onChange={e => onChange({ ...config, windowKind: e.target.value as AnalysisConfig["windowKind"] })}>
            <option value="CALENDAR_YEAR">Calendar year</option><option value="PRESIDENTIAL_PERIOD">Presidential period</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-2xs text-term-text-dim">Return metric
          <select className={inputClass} value={config.metric} onChange={e => onChange({ ...config, metric: e.target.value as AnalysisConfig["metric"] })}>
            <option value="CUMULATIVE">Cumulative return</option><option value="ANNUALIZED">Annualized return</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-2xs text-term-text-dim">Comparison groups
          <select className={inputClass} value={config.grouping} onChange={e => onChange({ ...config, grouping: e.target.value as AnalysisConfig["grouping"] })}>
            {Object.entries(GROUPING_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-2xs text-term-text-dim">Maximum endpoint gap (days)
          <input className={inputClass} type="number" min={0} max={31} step={1} value={config.maxEndpointGapDays}
            onChange={e => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 31) onChange({ ...config, maxEndpointGapDays: n }); }} />
        </label>
      </div>
      <label className="flex items-start gap-2 text-xs text-term-text"><input type="checkbox" className="mt-0.5 accent-term-amber" checked={config.includePartial} onChange={e => onChange({ ...config, includePartial: e.target.checked })} />Include partial windows</label>
      <div className="grid min-w-0 gap-3 border-t border-term-border pt-3 sm:grid-cols-2">
        <label className="flex items-start gap-2 text-xs text-term-text"><input type="checkbox" className="mt-0.5 accent-term-amber" checked={exclude2008} onChange={e => onExclude2008(e.target.checked)} />Show sensitivity excluding 2008</label>
        <label className="flex min-w-0 flex-col gap-1 text-2xs text-term-text-dim">Additional sensitivity years (comma-separated)
          <input className={inputClass} inputMode="numeric" placeholder="e.g. 2020" value={additionalYears} onChange={e => onAdditionalYears(e.target.value)} />
        </label>
      </div>
      <p className="text-2xs leading-relaxed text-term-text-dim">Full sample remains the primary comparison.</p>
      <p className="text-2xs leading-relaxed text-term-text-dim">Political labels are assigned at the window origin; changes within a window remain flagged in the ledger. The 95% administration-cluster resampling range is descriptive only, not a causal confidence interval or investment signal. Sensitivity exclusions remove selected annual-return years or whole presidential periods overlapping a selected year, across all categories. Partial-period results are not a completed-term estimate.</p>
    </div>
  </Panel>;
}
