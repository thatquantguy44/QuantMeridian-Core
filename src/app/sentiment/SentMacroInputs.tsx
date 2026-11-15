import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { SENT_MACRO_SERIES, type SentMacroId, type SentMacroResponse, type SentMacroSeries } from "@/lib/sentiment/macro";

function unit(s: SentMacroSeries) { return s.units === "Index" ? "index points" : s.id.startsWith("DGS") ? "%" : "pp"; }
function value(n: number | null, s: SentMacroSeries) { return n === null ? "No data" : `${n.toFixed(2)} ${unit(s)}`; }
const cell = "border-b border-term-border-soft px-3 py-2 text-left text-2xs text-term-text-dim";
const control = "rounded-sm border border-term-border bg-term-panel-2 px-2 py-1 text-2xs text-term-text disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber";

export function SentMacroInputs({ data, loading, error }: { data: SentMacroResponse | null; loading: boolean; error: string | null }) {
  const [id, setId] = useState<SentMacroId>("VIXCLS");
  const [page, setPage] = useState(0);
  const selected = Array.isArray(data?.series) ? data.series.find(s => s?.id === id) : undefined;
  if (!data || !selected || !Array.isArray(selected.observations)) return <Panel title="Macro & Market Inputs" code="GOLD"><div role="status" className="p-3 text-2xs text-term-text-dim">
    <p>{loading ? "Loading source data…" : "No data"}</p><p>{error ?? "Waiting for the macro Gold connection."}</p>
  </div></Panel>;
  const lastPage = Math.max(0, Math.ceil(selected.observations.length / 25) - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * 25;
  const history = [...selected.observations].reverse().slice(start, start + 25);
  return <Panel title="Macro & Market Inputs — Stored Gold Observations" code="GOLD">
    <p className="px-3 py-2 text-2xs text-term-text-dim">FRED via macro Gold · read at <time dateTime={data.assessedAt}>{data.assessedAt}</time>. Observation age is measured in UTC calendar days at this read; it is not a publication-calendar freshness verdict.</p>
    <div role="region" aria-label="Macro source table scroll area" tabIndex={0} className="overflow-x-auto">
      <table aria-label="SENT macro source observations" className="w-full border-collapse tnum whitespace-nowrap">
        <caption className="sr-only">Seven verified FRED series. Spread values are percentage points, yields percent and VIX index points.</caption>
        <thead className="bg-term-panel-2"><tr>{["Input", "Latest observation", "Reported date", "Age (days)", "Warehouse ingested at", "State"].map(c => <th key={c} scope="col" className={cell}>{c}</th>)}</tr></thead>
        <tbody>{data.series.map(s => <tr key={s.id}>
          <th scope="row" className={cell}><span className="font-semibold text-term-text">{s.label}</span><span className="block text-3xs text-term-text-mute">{s.id}</span></th>
          <td className={cell} data-testid={`macro-latest-${s.id}`}>{value(s.latest?.value ?? null, s)}</td>
          <td className={cell}>{s.latestReportedDate ?? "Unknown"}</td><td className={cell}>{s.ageCalendarDays ?? "Unknown"}</td>
          <td className={cell}>{s.ingestedAt ?? "Unknown"}</td><td className={cell}>{s.state === "AVAILABLE" ? "Observed" : s.reason === "LATEST_MISSING" ? "Latest marked missing" : "No data"}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <details className="border-t border-term-border p-3">
      <summary className="cursor-pointer text-2xs text-term-amber">Inspect macro history</summary>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-2xs text-term-text-dim">
        <label className="flex flex-wrap items-center gap-2">Series <select aria-label="Macro series" className={control} value={id} onChange={e => { setId(e.target.value as SentMacroId); setPage(0); }}>
          {SENT_MACRO_SERIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select></label>
        <span>{selected.observations.length} stored rows, including {selected.observations.filter(o => o.value === null).length} marked missing · up to 252 rows</span>
      </div>
      <div className="mt-2 overflow-x-auto" role="region" aria-label="Macro history scroll area" tabIndex={0}>
        <table aria-label="Macro historical observations" className="w-full border-collapse tnum whitespace-nowrap">
          <thead><tr><th scope="col" className={cell}>Reported date</th><th scope="col" className={cell}>Value ({unit(selected)})</th><th scope="col" className={cell}>State</th></tr></thead>
          <tbody>{history.map(o => <tr key={o.date}><th scope="row" className={cell}>{o.date}</th><td className={cell}>{value(o.value, selected)}</td><td className={cell}>{o.value === null ? "Marked missing" : "Observed"}</td></tr>)}</tbody>
        </table>
      </div>
      {!history.length && <p className="py-2 text-2xs text-term-text-dim">No data — this series has no admitted observations.</p>}
      <nav aria-label="Macro history pagination" className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span role="status" className="text-2xs text-term-text-dim">Showing {history.length ? start + 1 : 0}–{start + history.length} of {selected.observations.length}</span>
        <div className="flex gap-2"><button type="button" className={control} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Newer macro observations</button><button type="button" className={control} disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Older macro observations</button></div>
      </nav>
    </details>
    <p className="border-t border-term-border px-3 py-2 text-3xs text-term-text-mute">Missing observations stay empty. Warehouse ingestion is separate from the observation date; original provider publication times are unknown. These inputs do not supply missing NAAIM, put/call or breadth data.</p>
  </Panel>;
}
