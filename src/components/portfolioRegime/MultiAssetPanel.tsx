import { useEffect, useRef, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { PORA_ASSETS, type MultiAssetPreview, type PoraAsset } from "@/lib/portfolioRegime/multiAssetContracts";
import { fetchMultiAssetPreview, multiAssetCsv } from "@/lib/portfolioRegime/multiAssetClient";
import { qualifySnapshot } from "@/lib/portfolioRegime/qualification";
import type { CatalogReason, CatalogReference } from "@/lib/portfolioRegime/catalogReference";
import { captureSnapshot, importSnapshotFile, snapshotReplayCsv, type SnapshotArtifact } from "@/lib/portfolioRegime/snapshotClient";

const ASSET_BLOCKER_LABELS = {
  TICKER_ONLY_IDENTITY: "Ticker-only identity",
  CURRENCY_UNKNOWN: "Currency unknown",
  SOURCE_RIGHTS_UNKNOWN: "Source rights unknown",
  MEMBERSHIP_NOT_POINT_IN_TIME: "fixed selection without point-in-time membership evidence",
};
const CATALOG_REASON_LABELS: Record<CatalogReason, string> = {
  CATALOG_RECORD_MISSING: "Catalog record or mapping missing",
  CATALOG_READ_FAILED: "Catalog read failed",
  INVALID_CATALOG_RECORD: "Catalog record invalid or timestamp after capture",
  AMBIGUOUS_CATALOG_ROWS: "Ambiguous catalog rows",
  CATALOG_SOURCE_MISMATCH: "Catalog source or configuration conflict",
};
function CatalogEvidence({ reference }: { reference: CatalogReference | null }) {
  if (!reference) return <>Not captured in this v1 snapshot</>;
  if (reference.status !== "REPORTED") return <>{reference.status}: {reference.reason && CATALOG_REASON_LABELS[reference.reason]}</>;
  return <><span>EcoMedallion catalog: {reference.seriesId} · {reference.title ?? "title not recorded"}</span><br /><span>Unit label: {reference.unitLabel ?? "not recorded"} · {reference.manifestName}</span><br /><span>Series updated: {reference.seriesUpdatedAt} · mapping updated: {reference.manifestUpdatedAt}</span></>;
}
const LABELS: Record<PoraAsset, string> = { SPY: "US equity ETF", AGG: "US aggregate bond ETF", ACWI: "Global equity ETF", BIL: "US Treasury bill ETF" };
type Operation = "idle" | "checking" | "capturing" | "importing";
function download(filename: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}

/** Explicit selection only; changed inputs cancel work and clear dependent results. */
export function MultiAssetPanel() {
  const [selected, setSelected] = useState<PoraAsset[]>([]);
  const [data, setData] = useState<MultiAssetPreview | null>(null);
  const [snapshot, setSnapshot] = useState<SnapshotArtifact | null>(null);
  const [operation, setOperation] = useState<Operation>("idle");
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; active.current?.abort(); }, []);
  function reset() {
    generation.current++; active.current?.abort(); active.current = null;
    setData(null); setSnapshot(null); setError(null); setOperation("idle");
  }
  function toggle(id: PoraAsset) {
    reset();
    setSelected((existing) => PORA_ASSETS.filter((asset) => asset === id ? !existing.includes(id) : existing.includes(asset)));
  }
  async function check() {
    if (selected.length < 2 || operation !== "idle") return;
    reset(); const id = generation.current; const controller = new AbortController(); active.current = controller; setOperation("checking");
    try {
      const result = await fetchMultiAssetPreview(selected, controller.signal);
      if (!controller.signal.aborted && generation.current === id) setData(result);
    } catch (cause) {
      if (!controller.signal.aborted && generation.current === id) setError(cause instanceof Error ? cause.message : "Multi-asset source history is unavailable.");
    } finally { if (generation.current === id) { active.current = null; setOperation("idle"); } }
  }
  async function freeze() {
    if (!data || operation !== "idle") return;
    reset(); const id = generation.current; const controller = new AbortController(); active.current = controller; setOperation("capturing");
    try {
      const result = await captureSnapshot(selected, controller.signal);
      if (!controller.signal.aborted && generation.current === id) { setData(result.preview); setSnapshot(result); }
    } catch (cause) {
      if (!controller.signal.aborted && generation.current === id) setError(cause instanceof Error ? cause.message : "Snapshot capture is unavailable.");
    } finally { if (generation.current === id) { active.current = null; setOperation("idle"); } }
  }
  async function importFile(file: File) {
    reset(); setSelected([]); const id = generation.current; setOperation("importing");
    try {
      const result = await importSnapshotFile(file);
      if (generation.current === id) setSnapshot(result);
    } catch (cause) {
      if (generation.current === id) setError(cause instanceof Error ? cause.message : "Snapshot import failed.");
    } finally { if (generation.current === id) setOperation("idle"); }
  }
  const busy = operation !== "idle";
  const report = snapshot ? qualifySnapshot(snapshot) : null;
  return <div aria-label="Multi-asset source comparison" role="region"><Panel title="Multi-asset source comparison" code="DATA+" resizable={false}>
    <div className="space-y-3 p-3 text-xs text-term-text-dim">
      <p>Select two or more candidates to compare retained Tiingo-input total returns. These choices are research inputs, not portfolio holdings or recommended allocations.</p>
      <fieldset><legend className="mb-1 text-2xs uppercase tracking-wide">Candidate ETFs</legend><div className="flex flex-wrap gap-x-4 gap-y-2">{PORA_ASSETS.map((id) => <label key={id} className="flex items-center gap-1"><input type="checkbox" aria-label={id} checked={selected.includes(id)} onChange={() => toggle(id)} /> <span className="text-term-text">{id}</span> <span className="text-2xs">{LABELS[id]}</span></label>)}</div></fieldset>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void check()} disabled={selected.length < 2 || busy} className="term-btn disabled:opacity-40">{operation === "checking" ? "Checking sources…" : "Check multi-asset history"}</button><button type="button" onClick={() => data && download("PORA_multi_asset_returns.csv", multiAssetCsv(data), "text/csv;charset=utf-8")} disabled={!data || busy} className="term-btn disabled:opacity-40">Export aligned returns CSV</button></div>
      <p className="text-2xs">The comparison uses 253 common sessions from the retained NYSE calendar, ending at the earliest selected asset's latest retained date. Values are current vintage, not a point-in-time archive. No prices are filled or substituted.</p>
      {busy && <p role="status">{operation === "checking" ? "Checking source records and retained receipts…" : operation === "capturing" ? "Rechecking source evidence and capturing snapshot…" : "Checking imported snapshot integrity…"}</p>}
      {error && <p role="alert" className="border border-term-down/40 p-2 text-term-down">{error} No partial or substitute result is displayed.</p>}
      {!data && !busy && !error && !snapshot && <p className="border border-term-border p-2">No comparison checked. Select at least two assets.</p>}
      {data && <div className="space-y-2">
        <div data-testid="pora-multi-coverage" className="border border-term-border p-2 text-term-text">{data.sessionCount} sessions · {data.returnCount} aligned returns · {data.firstDate} to {data.lastDate} · as-of cutoff {data.asOfDate}</div>
        <p className="text-2xs">Derived total-return changes use Tiingo close, cash dividend and split inputs, checked against retained receipts. The earliest date has no return in this window. Source check: {data.checkedAt}.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[610px] text-left text-2xs" aria-label="Multi-asset source coverage"><thead><tr><th>Asset</th><th>Sample change</th><th>Latest retained date</th><th>Latest source ingestion</th><th>Future Gold excluded</th></tr></thead><tbody>{data.assets.map((asset) => <tr key={asset.id} data-testid={`pora-multi-asset-${asset.id}`} className="border-t border-term-border"><td className="py-1 text-term-text">{asset.id}</td><td>{asset.totalChange >= 0 ? "+" : ""}{(asset.totalChange * 100).toFixed(2)}%</td><td>{asset.latestDate}</td><td>{asset.lastIngestedAt}</td><td>{asset.futureCount}</td></tr>)}</tbody></table></div>
        <p className="text-2xs">This comparison is not an admitted optimizer snapshot. Returns are not forecasts, portfolio weights or a backtest.</p>
      </div>}
      <section aria-label="Research snapshot" className="space-y-2 border-t border-term-border pt-3">
        <h2 className="text-xs font-semibold text-term-text">Research snapshot</h2>
        <p className="text-2xs">Capture rechecks the selected sources and refreshes the comparison. The snapshot stays in this session until exported; it is not admitted to a model.</p>
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" onClick={() => void freeze()} disabled={!data || busy} className="term-btn disabled:opacity-40">{operation === "capturing" ? "Capturing…" : "Capture research snapshot"}</button>
          <button type="button" onClick={() => snapshot && download(`PORA_${snapshot.verification.snapshotId.slice(7, 19)}_snapshot.json`, snapshot.json, "application/json;charset=utf-8")} disabled={!snapshot || busy} className="term-btn disabled:opacity-40">Export snapshot JSON</button>
          <button type="button" onClick={() => snapshot && download("PORA_snapshot_replayed_returns.csv", snapshotReplayCsv(snapshot), "text/csv;charset=utf-8")} disabled={!snapshot || busy} className="term-btn disabled:opacity-40">Export replayed returns CSV</button>
          <button type="button" onClick={() => report && download("PORA_snapshot_qualification.json", JSON.stringify(report, null, 2), "application/json;charset=utf-8")} disabled={!report || busy} className="term-btn disabled:opacity-40">Export qualification report JSON</button>
          <label className="flex max-w-full flex-col gap-1 text-2xs">Import snapshot JSON<input aria-label="Import snapshot JSON" type="file" accept=".json,application/json" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void importFile(file); }} className="max-w-full text-2xs" /></label>
        </div>
        {snapshot && <div className="space-y-1 border border-term-border p-2 text-2xs">
          <p className="text-term-text">{snapshot.origin === "CAPTURED" ? "Receipt evidence checked at capture." : "Imported file: origin and retained receipt contents not rechecked."}</p>
          <p data-testid="pora-snapshot-id" className="break-all">Snapshot ID: {snapshot.verification.snapshotId}</p>
          <p>{snapshot.verification.assets.map((asset) => asset.id).join(", ")} · {snapshot.verification.firstDate} to {snapshot.verification.lastDate} · {snapshot.verification.returnCount} replayed returns per asset · captured {snapshot.verification.capturedAt}</p>
          <p>SHA-256 checks content integrity, not provider authenticity. Current-vintage only; source rights and currency metadata remain unknown.</p>
        </div>}
        {report && <section aria-label="Snapshot qualification report" className="space-y-2 border border-term-border p-2 text-2xs">
          <h3 className="text-xs font-semibold text-term-text">Snapshot qualification report</h3>
          <p className="font-semibold text-term-text">Model admission blocked</p>
          <p>Research snapshot available · current vintage · {report.firstDate} to {report.lastDate} · as-of {report.asOfDate}</p>
          <p>{report.sourceEvidence === "RECEIPTS_CHECKED_AT_CAPTURE" ? "Retained source records and receipts checked at capture." : "Origin and receipt contents not rechecked for this imported file."} Internal checks do not prove provider authenticity; a matching hash can be recomputed.</p>
          <p>For each asset, the file has aligned observations, reconciled return calculations and consistent source references. These are internal checks against the snapshot, not an independent source or calendar verification.</p>
          <p>{report.catalogLabels === "MATCHING_UNVERIFIED_LABELS" ? "Catalog unit labels match across the selected assets." : report.catalogLabels === "CONFLICTING_LABELS" ? "Catalog unit labels conflict across the selected assets." : "Catalog unit labels are incomplete or were not captured."} Catalog data is current EcoMedallion configuration, not an independently verified security identity or trading currency. Catalog update timestamps are not provider publication times.</p>
          {snapshot?.origin === "IMPORTED" && <p>Imported catalog evidence and its origin have not been rechecked.</p>}
          <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left" aria-label="Asset qualification"><thead><tr><th>Asset</th><th>Checked coverage</th><th>Catalog evidence</th><th>Unresolved for each asset</th></tr></thead><tbody>{report.assets.map((asset) => <tr key={asset.id} className="border-t border-term-border align-top"><td className="py-1 text-term-text">{asset.id}</td><td>{asset.sessionCount} sessions / {asset.returnCount} returns</td><td><CatalogEvidence reference={asset.reference} /></td><td>{asset.blockers.map((blocker) => ASSET_BLOCKER_LABELS[blocker]).join("; ")}</td></tr>)}</tbody></table></div>
          <p>Point-in-time availability is not established, and the warehouse calendar is not independently verified. Admission policy, numerical model and model binding remain unresolved. The report does not grant source rights or approve model use.</p>
          <div className="space-y-1 border-t border-term-border pt-2">
            <h4 className="font-semibold text-term-text">Dated local investigation · {report.context.reviewedOn}</h4>
            <p>This historical review is not evidence bound to this snapshot and has not been rechecked for the current warehouse or imported file.</p>
            <p>{report.context.currency} <a className="underline" href={report.context.references.manifest} target="_blank" rel="noreferrer">Reviewed manifest</a></p>
            <p>{report.context.calendar} <a className="underline" href={report.context.references.mergedFix} target="_blank" rel="noreferrer">Merged EcoMedallion fix</a>. NYSE notices: <a className="underline" href={report.context.references.closure2018} target="_blank" rel="noreferrer">2018</a> · <a className="underline" href={report.context.references.closure2025} target="_blank" rel="noreferrer">2025</a>.</p>
            <p>{report.context.rights} <a className="underline" href={report.context.references.tiingo} target="_blank" rel="noreferrer">Tiingo documentation</a></p>
            <p>{report.context.membership}</p>
          </div>
        </section>}
      </section>
    </div>
  </Panel></div>;
}
