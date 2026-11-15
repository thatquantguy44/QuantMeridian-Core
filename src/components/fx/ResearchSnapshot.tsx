import { EmptyWorkspace } from "./Workspace";
import type { FxPairResult, FxResearchResponse } from "@/lib/fx/contracts";

function label(pair: FxPairResult) {
  if (pair.state === "ELIGIBLE") return "Current reference";
  if (pair.state === "DEGRADED") return "Stale — display only";
  if (pair.lastObserved) return "Unverified — retained evidence";
  return pair.state === "MISSING" ? "Missing observation" : "Unavailable";
}
function level(pair: FxPairResult) { return pair.state === "ELIGIBLE" ? pair.referenceLevel : pair.lastObserved?.value; }
function number(value: number) { return new Intl.NumberFormat("en-US", { maximumSignificantDigits: 10 }).format(value); }
export function ResearchOverview({ data, selected, loading }: { data: FxResearchResponse | null; selected: number; loading: boolean }) {
  if (!data) return <EmptyWorkspace title={loading ? "Loading reference snapshot" : "No reference snapshot"}
    description={loading ? "Checking the current reference evidence." : "Reference data is unavailable. The requested pairs remain visible when a validated snapshot can be read."}
    columns={["Currency pair", "Quote units", "Reference level", "Observation date", "Coverage"]} />;
  const pair = data.pairs[selected], value = level(pair);
  const date = pair.lastObserved?.observationDate ?? data.snapshot?.observationDate;
  return <div className="space-y-3 p-3 text-xs">
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-term-border pb-3">
      <div>
        <h2 className="text-sm font-semibold text-term-text">{pair.baseCurrency}/{pair.quoteCurrency}</h2>
        <p className="mt-1 text-term-text-dim">{label(pair)}</p>
        <p className="mt-1 text-2xs text-term-text-dim">{pair.derivation.kind === "INVERSE" ? "Terminal-derived inverse" : pair.derivation.kind === "CROSS" ? "Terminal-derived cross" : "Direct ECB reference"}</p>
        {value !== undefined ? <output aria-label={pair.state === "ELIGIBLE" ? "Selected reference level" : "Last observed level"}
          className="my-2 block font-mono text-2xl text-term-text">{number(value)}</output> : <p className="my-2 text-term-text-dim">No reference level</p>}
        <p className="text-2xs text-term-text-dim">{pair.quoteCurrency} per 1 {pair.baseCurrency} · {date ?? "No selected date"}</p>
      </div>
      <p className="text-2xs text-term-text-dim">{data.pairs.filter(p => p.state === "ELIGIBLE").length} / 4 research-eligible</p>
    </div>
    {pair.reasons.length > 0 && <ul className="space-y-1 text-term-amber">{pair.reasons.map((r, i) => <li key={i}>{r.message}</li>)}</ul>}
    {pair.lastObserved && <p className="text-2xs text-term-text-dim">Dated reference evidence only. Any inverse or cross shown was calculated from same-date retained ECB legs.</p>}
    <div className="overflow-x-auto">
      <table aria-label="Reference coverage" className="w-full text-left text-2xs">
        <thead className="text-term-text-dim"><tr>{["Pair", "Quote units", "Level", "Date", "Status"].map(h => <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{data.pairs.map(p => <tr key={`${p.baseCurrency}/${p.quoteCurrency}`} className="border-t border-term-border">
          <th scope="row" className="whitespace-nowrap px-2 py-2 font-medium">{p.baseCurrency}/{p.quoteCurrency}</th>
          <td className="whitespace-nowrap px-2 py-2">{p.quoteCurrency} per 1 {p.baseCurrency}</td>
          <td className="px-2 py-2 font-mono">{level(p) === undefined ? "Unavailable" : number(level(p)!)}</td>
          <td className="whitespace-nowrap px-2 py-2">{p.lastObserved?.observationDate ?? data.snapshot?.observationDate ?? "Unavailable"}</td>
          <td className="whitespace-nowrap px-2 py-2">{label(p)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="text-2xs leading-relaxed text-term-text-dim">Source: ECB reference rates; terminal-derived inverse/cross where indicated. Information only.</p>
    <p className="text-2xs text-term-text-dim">Reporting conversion and hedge calculations are disabled.</p>
  </div>;
}

export function ResearchEvidence({ data, selected }: { data: FxResearchResponse | null; selected: number }) {
  const snapshot = data?.snapshot;
  const identity = snapshot?.snapshotId ?? data?.retained?.snapshotId;
  if (!identity) return <EmptyWorkspace title="No snapshot evidence" description="A validated retained snapshot is needed to inspect source revisions and capture clocks."
    columns={["Source", "Observation date", "Snapshot cutoff", "Usage", "Status"]} />;
  const evidence = data!.pairs[selected].evidence;
  const derivation = data!.pairs[selected].derivation;
  return <div className="space-y-3 p-3 text-xs leading-relaxed">
    <h2 className="font-semibold text-term-text">Snapshot evidence</h2>
    <dl className="space-y-2 text-term-text-dim">
      <div><dt className="text-2xs uppercase">Snapshot identity</dt><dd className="break-all font-mono text-term-text">{identity}</dd></div>
      <div><dt>Capture cutoff (UTC)</dt><dd className="break-all text-term-text">{snapshot?.cutoffAt ?? data!.retained!.cutoffAt}</dd></div>
      <div><dt>Current assessment (UTC)</dt><dd className="break-all text-term-text">{data!.assessedAt}</dd></div>
      <div><dt>Knowledge basis</dt><dd>Current vintage — historical point-in-time knowledge is not certified.</dd></div>
      <div><dt>Permitted use</dt><dd>Research only. Exports, reporting conversion and hedge calculations are disabled.</dd></div>
      <div><dt>Selected derivation</dt><dd>{derivation.kind} · {derivation.formula} (u = USD per EUR; j = JPY per EUR; g = GBP per EUR)</dd></div>
      {snapshot && <><div><dt>Expected publication date</dt><dd>{snapshot.freshness.expectedDate ?? "Unknown calendar coverage"} · 17:00 Europe/Berlin</dd></div>
        <div><dt>Method / calendar</dt><dd className="break-all">{snapshot.methodVersion} / {snapshot.freshness.calendarVersion}</dd></div></>}
    </dl>
    <p className="text-2xs text-term-text-dim">Original receipt and first Gold publication times are unknown.</p>
    {evidence.map(e => <section key={e.evidenceId} className="space-y-1 border-t border-term-border pt-3 text-2xs text-term-text-dim">
      <h3 className="break-all font-medium text-term-text">{e.seriesId}</h3>
      <p>{number(e.sourceLevel)} {e.sourceUnit} · {e.observationDate}</p>
      <p className="break-all">Gold read: {e.goldReadStartedAt} → {e.goldReadCompletedAt}</p>
      <p className="break-all">Upstream recorded ingestion: {e.upstreamRecordedAt} (not publication)</p>
      <p className="break-all">Revision: {e.revisionId}</p>
    </section>)}
    <p className="border-t border-term-border pt-3 text-2xs text-term-text-dim">Replay is retained locally for at most 30 days or 500 snapshots. A missing or unverifiable retained artifact cannot be rebuilt from today's revised rates.</p>
  </div>;
}
