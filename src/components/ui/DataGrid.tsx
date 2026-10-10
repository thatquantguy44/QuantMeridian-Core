
import clsx from "clsx";
import { useMemo, useState, type ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: string;
  render: (row: T) => ReactNode;
  /** value used for sorting; falls back to render output if omitted */
  sortVal?: (row: T) => number | string;
  className?: (row: T) => string;
}

interface DataGridProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  dense?: boolean;
  maxHeight?: string;
  onRowClick?: (row: T) => void;
  selectedKey?: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  zebra?: boolean;
}

/** Bloomberg-style sortable data grid (AG-Grid-like density, zero deps). */
export function DataGrid<T>({ columns, rows, rowKey, dense = true, maxHeight, onRowClick, selectedKey, initialSort, zebra }: DataGridProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortVal) return rows;
    const arr = [...rows].sort((a, b) => {
      const va = col.sortVal!(a);
      const vb = col.sortVal!(b);
      if (typeof va === "number" && typeof vb === "number") return va - vb;
      return String(va).localeCompare(String(vb));
    });
    return sort.dir === "desc" ? arr.reverse() : arr;
  }, [rows, sort, columns]);

  const toggle = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortVal) return;
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  const minWidth = Math.max(520, columns.reduce((sum, col) => {
    const parsed = col.width ? Number.parseInt(col.width, 10) : NaN;
    return sum + (Number.isFinite(parsed) ? parsed : 112);
  }, 0));

  return (
    <div className="analytics-scroll min-h-0 overflow-auto" style={{ maxHeight }}>
      <table className="w-full border-collapse" style={{ minWidth }}>
        <thead className="sticky top-0 z-10">
          <tr className="bg-term-panel-2">
            {columns.map((c) => (
              <th
                key={c.key}
                onClick={() => toggle(c.key)}
                className={clsx(
                  "select-none border-b border-term-border px-2 py-1 text-2xs font-semibold uppercase tracking-wider text-term-text-mute",
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                  c.sortVal && "cursor-pointer hover:text-term-amber"
                )}
                style={{ width: c.width }}
              >
                <span className="inline-flex items-center gap-1">
                  {c.header}
                  {sort?.key === c.key && <span className="text-term-amber">{sort.dir === "desc" ? "▼" : "▲"}</span>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tnum">
          {sorted.map((row, i) => {
            const k = rowKey(row, i);
            return (
              <tr
                key={k}
                onClick={() => onRowClick?.(row)}
                className={clsx(
                  "border-b border-term-border-soft transition-colors",
                  onRowClick && "cursor-pointer",
                  selectedKey === k ? "bg-term-amber-soft" : zebra && i % 2 ? "bg-white/[0.012]" : "",
                  "hover:bg-term-panel-2"
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={clsx(
                      dense ? "px-2 py-[3px]" : "px-2 py-1.5",
                      "text-xs",
                      c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                      c.className?.(row)
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
