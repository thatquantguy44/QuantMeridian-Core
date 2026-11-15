import { useEffect, useRef, useState } from "react";
import { EmptyWorkspace } from "./Workspace";
import { HistoryChart } from "./HistoryChart";
import { usePairHistory } from "@/lib/fx/usePairHistory";
import { ProvenanceBadge } from "@/components/ui/ProvenanceBadge";

const level = (value: number) => new Intl.NumberFormat("en-US", { maximumSignificantDigits: 10 }).format(value);
const percent = (value: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6, signDisplay: "always" }).format(value)}%`;
export function ResearchHistory({ selected }: { selected: number }) {
  const { data, loading, error, refresh } = usePairHistory();
  const [replay, setReplay] = useState<{ id: string; state: "CHECKING" | "VERIFIED" | "UNAVAILABLE" } | null>(null);
  const replayAbort = useRef<AbortController | null>(null);
  const pair = data?.pairs[selected];
  const units = pair ? `${pair.quoteCurrency} per 1 ${pair.baseCurrency}` : "";
  const schedule = data?.history?.schedule ?? data?.retained?.schedule;
  const identity = data?.history?.historyId ?? data?.retained?.historyId;
  const cutoffAt = data?.history?.cutoffAt ?? data?.retained?.cutoffAt;
  useEffect(() => () => replayAbort.current?.abort(), [identity]);
  async function verifyReplay() {
    if (!identity) return;
    replayAbort.current?.abort(); const controller = new AbortController(); replayAbort.current = controller;
    setReplay({ id: identity, state: "CHECKING" });
    try {
      const response = await fetch(`/api/fx/research/histories/${encodeURIComponent(identity)}`, { signal: controller.signal, cache: "no-store" });
      const result = await response.json();
      if (!response.ok || result.historicalReplay !== true || result.currentConsumptionPermitted !== false || result.history?.historyId !== identity) throw new Error();
      if (!controller.signal.aborted) setReplay({ id: identity, state: "VERIFIED" });
    } catch {
      if (controller.signal.aborted) {
        if (replayAbort.current === controller) setReplay(null);
      } else { setReplay({ id: identity, state: "UNAVAILABLE" }); void refresh(); }
    }
  }
  const evidence = new Map((data?.history?.evidence ?? data?.retained?.evidence ?? []).map(e => [e.evidenceId, e]));
  const state = data?.retained ? "Retained history — current metrics unavailable" : pair?.endpointState === "DEGRADED" ? "Stale endpoint — dated history only"
    : pair?.endpointState === "ELIGIBLE" ? "Current endpoint · research only" : "Current endpoint unavailable";
  return <div className="space-y-3 p-3 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-term-text">{pair ? `${pair.baseCurrency}/${pair.quoteCurrency} history` : "Pair history"}</h2>
        <ProvenanceBadge source={identity ? "ECB_REFERENCE" : "UNAVAILABLE"} /></div>
      <button type="button" disabled={loading} onClick={() => { void refresh(); }} className="term-btn disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber">Refresh pair history</button>
    </div>
    <p role="status" className="text-2xs text-term-text-dim">{loading ? "Checking dated history and source evidence…" : state}</p>
    {(error || data?.error) && <p role="alert" className="border border-term-border p-2 text-term-amber">{error ?? data!.error!.message}</p>}
    {!!pair?.endpointReasons.length && <ul aria-label="History endpoint reasons" className="space-y-1 text-2xs text-term-amber">
      {pair.endpointReasons.map((r, i) => <li key={i}>{r.message}</li>)}
    </ul>}
    {schedule?.reasons.map((r, i) => <p key={i} className="text-2xs text-term-amber">{r.message}</p>)}
    {!pair || pair.points.length === 0 ? <EmptyWorkspace title={loading ? "Loading pair history" : "No pair history"}
      description={loading ? "Reading and validating dated reference observations." : "No qualified dated history is available for the requested pair. Current changes are unavailable."}
      columns={["Observation date", "Reference level", "Source", "Coverage"]} /> : <>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {pair.changes.map(c => <section key={c.intervals} aria-label={`${c.intervals} observed interval change`} className="border border-term-border bg-term-panel p-3">
          <h3 className="text-2xs text-term-text-dim">{c.intervals} observed interval{c.intervals === 1 ? "" : "s"}</h3>
          {c.state === "AVAILABLE" ? <output aria-label={`${c.intervals}-interval change`} className="my-2 block font-mono text-lg text-term-text">{percent(c.simplePercent!)}</output>
            : <p className="my-2 text-term-amber">Unavailable</p>}
          <p className="text-2xs text-term-text-dim">{c.startDate ?? "No start date"} → {c.endDate ?? "No endpoint"}</p>
          {c.calendarDays !== null && <p className="text-2xs text-term-text-dim">{c.calendarDays} calendar day{c.calendarDays === 1 ? "" : "s"} · {c.observationsAvailable}/{c.observationsRequired} observations</p>}
          {c.reasons.length > 0 && <ul className="mt-2 space-y-1 text-2xs text-term-text-dim">{c.reasons.map((r, i) => <li key={i}>{r.message}</li>)}</ul>}
        </section>)}
      </div>
      <div className="flex flex-wrap justify-between gap-2 text-2xs text-term-text-dim">
        <p>{units} · {pair.derivation === "DIRECT" ? "Direct ECB reference" : pair.derivation === "INVERSE" ? "Terminal-derived inverse" : "Terminal-derived cross"}</p>
        <p>{pair.validObservations} / {pair.points.length} qualified observations</p>
      </div>
      <p className="text-2xs text-term-text-dim">Window: up to 90 TARGET observations. Gaps remain visible; source dates determine calendar spacing.</p>
      <HistoryChart points={pair.points} units={units} />
      <div className="max-h-80 overflow-auto border border-term-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber" tabIndex={0} aria-label="Historical observations table scroll area">
        <table className="w-full text-left text-2xs">
          <caption className="sr-only">{pair.baseCurrency}/{pair.quoteCurrency} historical observations — {units}</caption>
          <thead className="sticky top-0 bg-term-panel-2 text-term-text-dim"><tr>{["Observation date", units, "Coverage / evidence"].map(h => <th key={h} scope="col" className="whitespace-nowrap px-2 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody>{[...pair.points].reverse().map(point => <tr key={point.observationDate} className="border-t border-term-border">
            <th scope="row" className="whitespace-nowrap px-2 py-2 font-medium">{point.observationDate}</th>
            <td className="whitespace-nowrap px-2 py-2 font-mono">{point.displayLevel === null ? "Unavailable" : level(point.displayLevel)}</td>
            <td className="min-w-0 px-2 py-2 text-term-text-dim">{point.state === "OBSERVED" ? <details><summary className="cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber">Observed · source evidence</summary>
              <ul className="mt-1 space-y-2">{point.evidenceIds.map(id => {
                const e = evidence.get(id);
                return <li key={id} className="space-y-1 break-all">
                  <p>{e?.seriesId} · {e && level(e.sourceLevel)} {e?.sourceUnit} · {e?.observationDate}</p>
                  <p>Revision: <span className="font-mono">{e?.revisionId}</span></p>
                  <p>Gold read: {e?.goldReadStartedAt} → {e?.goldReadCompletedAt}</p>
                  <p>Recorded upstream ingestion: {e?.upstreamRecordedAt} (not publication)</p>
                  <p className="font-mono">Evidence: {id}</p>
                </li>;
              })}</ul>
            </details> : point.reasons.map(r => r.message).join(" ")}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="text-2xs leading-relaxed text-term-text-dim">Simple changes are recomputed for the selected pair direction. A rising {pair.baseCurrency}/{pair.quoteCurrency} reference means {pair.baseCurrency} appreciated against {pair.quoteCurrency}; it is not total return or portfolio PnL.</p>
    </>}
    {identity && <details className="border-t border-term-border pt-3 text-2xs text-term-text-dim" open>
      <summary className="cursor-pointer font-medium text-term-text">History capture evidence</summary>
      <dl className="mt-2 space-y-2">
        <div><dt>History identity</dt><dd className="break-all font-mono">{identity}</dd></div>
        <div><dt>Capture cutoff (UTC)</dt><dd className="break-all">{cutoffAt}</dd></div>
        <div><dt>Current assessment (UTC)</dt><dd className="break-all">{data!.assessedAt}</dd></div>
        {data?.history && <div><dt>Method / policy</dt><dd className="break-all">{data.history.methodVersion} / {data.history.historyPolicyVersion}</dd></div>}
        <div><dt>Knowledge basis</dt><dd>Current vintage. Historical system knowledge is not certified; original receipt and first Gold publication times are unknown.</dd></div>
        <div><dt>Use and replay</dt><dd>Research only. Historical replay preserves the original assessment; current metrics are assessed separately. Level and history captures share 500 artifacts / 30 days of local retention.</dd></div>
      </dl>
      <button type="button" onClick={() => { void verifyReplay(); }} disabled={replay?.id === identity && replay.state === "CHECKING"}
        className="term-btn mt-2 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber">Verify history replay</button>
      {replay?.id === identity && <p role="status" className="mt-2">{replay.state === "VERIFIED" ? "Historical replay verified — current metrics unchanged."
        : replay.state === "CHECKING" ? "Verifying retained history…" : "Historical replay unavailable."}</p>}
    </details>}
    <p className="text-2xs leading-relaxed text-term-text-dim">Source: ECB reference rates; terminal-derived inverses/crosses as indicated. Information only. Reporting conversion, hedge calculations and exports remain disabled.</p>
  </div>;
}
