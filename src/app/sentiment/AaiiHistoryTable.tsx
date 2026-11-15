import { useState } from "react";
import clsx from "clsx";
import { Panel } from "@/components/ui/Panel";
import { fmtSigned, pnlClass } from "@/lib/format";

/** Input is the same chronological selection used by the snapshot and chart. */
export interface AaiiHistoryRow { date: string; bullish: number; neutral: number; bearish: number; spread: number; gapDays: number | null }
export function AaiiHistoryTable({ history }: { history: readonly AaiiHistoryRow[] }) {
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(history.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * pageSize;
  const rows = [...history].reverse().slice(start, start + pageSize);
  const control = "rounded-sm border border-term-border bg-term-panel-2 px-2 py-1 text-2xs text-term-text disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-term-amber";

  return (
    <Panel title="AAII Historical Data" code="LOG">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-term-border px-3 py-2 text-2xs text-term-text-dim">
        <span>{history.length} observations · {history[0]?.date ?? "—"} to {history[history.length - 1]?.date ?? "—"} · newest first</span>
        <label className="flex items-center gap-2">
          Rows per page
          <select aria-label="AAII rows per page" value={pageSize} className={control} onChange={event => {
            setPageSize(Number(event.target.value));
            setPage(0);
          }}>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={104}>All (up to 104)</option>
          </select>
        </label>
      </div>
      <div className="overflow-x-auto" role="region" aria-label="AAII history table scroll area" tabIndex={0}>
        <table aria-label="AAII historical observations" className="w-full border-collapse tnum whitespace-nowrap">
          <caption className="sr-only">Historical AAII observations, newest first. Shares are percentages; spread is percentage points.</caption>
          <thead className="bg-term-panel-2"><tr>{["Reported survey date", "Bullish (%)", "Neutral (%)", "Bearish (%)", "Spread (pp)", "Gap (days)"].map((column, i) => (
            <th key={column} scope="col" className={clsx("border-b border-term-border px-3 py-1 text-3xs font-semibold uppercase tracking-wider text-term-text-mute", i === 0 ? "text-left" : "text-right")}>{column}</th>
          ))}</tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.date} className="border-b border-term-border-soft hover:bg-term-panel-2">
                <th scope="row" className="px-3 py-1 text-left text-2xs font-normal text-term-text-dim"><time dateTime={row.date}>{row.date}</time></th>
                <td className="px-3 py-1 text-right text-2xs text-term-up">{row.bullish.toFixed(1)}%</td>
                <td className="px-3 py-1 text-right text-2xs text-term-text-mute">{row.neutral.toFixed(1)}%</td>
                <td className="px-3 py-1 text-right text-2xs text-term-down">{row.bearish.toFixed(1)}%</td>
                <td className={clsx("px-3 py-1 text-right text-2xs font-semibold", pnlClass(row.spread))}>{fmtSigned(row.spread, 1)}</td>
                <td className="px-3 py-1 text-right text-2xs text-term-text-dim">{row.gapDays ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {history.length === 0 && <p role="status" className="p-3 text-2xs text-term-text-dim">No historical observations available.</p>}
      <nav aria-label="AAII history pagination" className="flex flex-wrap items-center justify-between gap-2 border-t border-term-border px-3 py-2">
        <span role="status" className="text-2xs text-term-text-dim">Showing {rows.length ? start + 1 : 0}–{start + rows.length} of {history.length}</span>
        <div className="flex gap-2">
          <button type="button" className={control} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Newer observations</button>
          <button type="button" className={control} disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>Older observations</button>
        </div>
      </nav>
    </Panel>
  );
}
