import { useEffect, useState } from "react";
import { Panel } from "@/components/ui/Panel";
import type { AnalysisResult, ResearchDataset } from "@/lib/presidential/contracts";
import { pct } from "./ResearchCharts";

export function ResearchLedger({ dataset, result }: { dataset: ResearchDataset; result: AnalysisResult }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(result.rows.length / 100));
  const currentPage = Math.min(page, pageCount - 1);
  const first = currentPage * 100;
  useEffect(() => { setPage(0); }, [result]);
  return <Panel title="Window ledger" code="AUDIT" resizable={false}>
    <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-2xs text-term-text-dim">
      <span>Showing {result.rows.length ? first + 1 : 0}–{Math.min(first + 100, result.rows.length)} of {result.rows.length} windows. Downloads contain every row.</span>
      {pageCount > 1 && <div className="flex gap-3"><button type="button" disabled={currentPage === 0} className="disabled:opacity-40" onClick={() => setPage(currentPage - 1)}>Previous windows</button><span>Page {currentPage + 1} of {pageCount}</span><button type="button" disabled={currentPage === pageCount - 1} className="disabled:opacity-40" onClick={() => setPage(currentPage + 1)}>Next windows</button></div>}
    </div>
    <div className="max-w-full overflow-x-auto">
      <table aria-label="Window inclusion and exclusion ledger" className="w-full min-w-[1120px] border-collapse text-left text-2xs">
        <caption className="px-3 py-2 text-left leading-relaxed text-term-text-dim">Every supplied window, including windows outside the selected sampling frame and failed attempts. Endpoint values use dated index levels; future observations cannot fill a missing starting endpoint. Fundamental omissions do not erase an otherwise valid return.</caption>
        <thead className="border-y border-term-border bg-term-panel-2 text-term-text-dim"><tr>
          {["Window / origin", "Requested endpoints", "Actual endpoints / levels", "Origin classification", "Return", "At-origin fundamentals", "Inclusion / reasons"].map(label => <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-term-border">
          {result.rows.slice(first, first + 100).map(row => <tr key={row.id} className="align-top text-term-text">
            <th scope="row" className="max-w-[180px] break-words px-3 py-2 font-medium">{row.label}<span className="mt-1 block font-mono text-3xs text-term-text-dim">{row.id} · {row.kind} · origin {row.decisionDate}</span>{!row.complete && <span className="mt-1 block text-term-amber">Partial window</span>}</th>
            <td className="whitespace-nowrap px-3 py-2 font-mono">{row.startDate}<br />to {row.endDate}</td>
            <td className="px-3 py-2 font-mono">{row.actualStartDate ?? "Missing"} / {row.startLevel ?? "Missing"}<br />{row.actualEndDate ?? "Missing"} / {row.endLevel ?? "Missing"}</td>
            <td className="max-w-[190px] px-3 py-2">{row.category}<span className="mt-1 block text-term-text-dim">{row.presidentName ?? "Unknown president"}</span>{row.mixedControl && <span className="mt-1 block text-term-amber">Control changed within window</span>}</td>
            <td className="whitespace-nowrap px-3 py-2 font-mono">{pct(row.value, 2)}<span className="mt-1 block text-3xs text-term-text-dim">cumulative {pct(row.cumulativeReturn, 2)}</span></td>
            <td className="max-w-[230px] break-words px-3 py-2">Valuation: {row.valuation ?? "Unavailable"}{row.valuationDefinition && <span className="block text-term-text-dim">{row.valuationDefinition}</span>}<span className="block">Policy rate: {row.policyRatePct === null ? "Unavailable" : `${row.policyRatePct}%`}</span><span className="mt-1 block font-mono text-3xs text-term-text-dim">{row.fundamentalDate ?? "No eligible observation"}<br />{row.fundamentalSourceId ?? "No eligible source"}</span></td>
            <td className="max-w-[260px] break-words px-3 py-2"><span className={row.included ? "text-term-up" : "text-term-amber"}>{row.included ? "Included" : "Excluded"}</span><ul className="mt-1 space-y-1 text-3xs text-term-text-dim">{row.reasons.map((reason, i) => <li key={`${reason}-${i}`}>{reason.replaceAll("_", " ")}</li>)}</ul></td>
          </tr>)}
          {!result.rows.length && <tr><td colSpan={7} className="p-4 text-term-text-dim">No windows of the selected type were supplied.</td></tr>}
        </tbody>
      </table>
    </div>
    <p className="border-t border-term-border px-3 py-2 text-2xs text-term-text-dim">Index unit: {dataset.currency} · {dataset.nominalReal} · {dataset.returnBasis}. Decimal inputs are displayed as percentages. A valid return with an unavailable fundamental is excluded from that scatter only.</p>
  </Panel>;
}

export function SummaryTable({ result, name = "Category summary" }: { result: AnalysisResult; name?: string }) {
  return <div className="max-w-full overflow-x-auto"><table aria-label={name} className="w-full min-w-[780px] border-collapse text-left text-2xs">
    <caption className="sr-only">{name}</caption>
    <thead className="border-b border-term-border bg-term-panel-2 text-term-text-dim"><tr>{["Origin category", "Windows", "Administrations", "Mean", "Descriptive 95% range", "Median", "Min", "Max"].map(label => <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
    <tbody className="divide-y divide-term-border text-term-text">{result.groups.map(group => <tr key={group.category}><th scope="row" className="px-3 py-2 font-medium">{group.category}</th><td className="px-3 py-2">{group.count}</td><td className="px-3 py-2">{group.administrationCount}</td><td className="px-3 py-2 font-mono">{pct(group.mean, 2)}</td><td className="px-3 py-2 font-mono" title={group.interval.unavailableReason ?? "95% administration-cluster resampling range; descriptive only, not a causal confidence interval."}>{group.interval.lower === null || group.interval.upper === null ? "Unavailable" : `${pct(group.interval.lower, 2)} to ${pct(group.interval.upper, 2)}`}</td>{[group.median, group.min, group.max].map((value, i) => <td key={i} className="px-3 py-2 font-mono">{pct(value, 2)}</td>)}</tr>)}
      {!result.groups.length && <tr><td colSpan={8} className="p-3 text-term-text-dim">No eligible windows for a category summary.</td></tr>}
    </tbody>
  </table></div>;
}
