import clsx from "clsx";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { FrequencyBadge } from "./FrequencyBadge";

interface DataSourceStripProps {
  source: string;
  freq?: string;
  unit?: string;
  asOf?: string | null;
  className?: string;
}

export function DataSourceStrip({ source, freq, unit, asOf, className }: DataSourceStripProps) {
  return (
    <span className={clsx("inline-flex items-center gap-1", className)}>
      <ProvenanceBadge source={source} asOf={asOf} />
      {freq && <FrequencyBadge freq={freq} />}
      {unit && (
        <span
          className="inline-flex items-center rounded-sm border border-term-border bg-term-panel-3 px-1.5 py-px text-3xs font-semibold text-term-text-mute"
          title={`Units: ${unit}`}
        >
          {unit}
        </span>
      )}
    </span>
  );
}
