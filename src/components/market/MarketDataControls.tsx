
import clsx from "clsx";
import type { ReturnBasis } from "@/data/marketPipeline";
import { Tag } from "@/components/ui/Panel";

export function MarketDataControls({
  basis,
  onBasisChange,
  asof,
  onAsOfChange,
  latestAsOf,
  earliestAsOf,
}: {
  basis: ReturnBasis;
  onBasisChange: (basis: ReturnBasis) => void;
  asof: string;
  onAsOfChange: (asof: string) => void;
  latestAsOf?: string | null;
  earliestAsOf?: string | null;
}) {
  return (
    <span className="flex flex-wrap items-center justify-end gap-2">
      <span className="inline-flex overflow-hidden rounded-sm border border-term-border bg-term-panel-2">
        {(["total", "price"] as ReturnBasis[]).map((b) => (
          <button
            key={b}
            onClick={() => onBasisChange(b)}
            className={clsx(
              "px-2 py-1 text-3xs font-semibold uppercase tracking-wide",
              basis === b ? "bg-term-amber text-black" : "text-term-text-mute hover:text-term-text"
            )}
            title={b === "total" ? "Adjusted-close total return" : "Raw-close price return"}
          >
            {b}
          </button>
        ))}
      </span>
      <label className="flex items-center gap-1 text-3xs font-semibold uppercase tracking-wide text-term-text-mute">
        As Of
        <input
          type="date"
          value={asof}
          min={earliestAsOf ?? undefined}
          max={latestAsOf ?? undefined}
          onChange={(e) => onAsOfChange(e.target.value)}
          className="h-6 border border-term-border bg-term-panel-2 px-1 text-3xs text-term-text outline-none"
          title="Blank uses the latest available data date"
        />
      </label>
      {asof && (
        <button className="term-btn h-6 px-2 py-0 text-3xs" onClick={() => onAsOfChange("")}>
          Latest
        </button>
      )}
      {!asof && latestAsOf && <Tag tone="neutral">Latest {latestAsOf}</Tag>}
    </span>
  );
}
