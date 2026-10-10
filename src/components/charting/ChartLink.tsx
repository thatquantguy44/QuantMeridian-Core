
import Link from "@/components/Link";
import { AreaChart } from "lucide-react";
import type { SeriesRef, RangePreset, Transform, ChartType } from "@/lib/charting/spec";
import { templateToURL } from "@/lib/charting/templates";

interface ChartLinkProps {
  refs: SeriesRef[];
  range?: RangePreset;
  transform?: Transform;
  chartType?: ChartType;
  studio?: "MGC" | "MKC";
  className?: string;
  children?: React.ReactNode;
}

export function ChartLink({ refs, range = "2Y", transform = "none", chartType = "line", studio = "MGC", className, children }: ChartLinkProps) {
  const state = templateToURL({ refs, range, transform, chartType, indicators: [], studies: [] });
  const base = studio === "MKC" ? "/market-chart" : "/macro-chart";
  const href = `${base}?chart=${state}`;

  return (
    <Link href={href} className={className ?? "inline-flex items-center gap-1 text-3xs text-term-amber hover:text-term-text transition-colors"} title="Open in Chart Studio">
      {children ?? (
        <>
          <AreaChart className="h-3 w-3" />
          <span>Chart</span>
        </>
      )}
    </Link>
  );
}

export function econChartHref(id: string, transform: Transform = "none", range: RangePreset = "5Y"): string {
  const state = templateToURL({
    refs: [{ source: "econ", id }],
    range,
    transform,
    chartType: "line",
    indicators: [],
    studies: [],
    showRecession: true,
  });
  return `/macro-chart?chart=${state}`;
}

export function marketChartHref(id: string, assetClass?: string, range: RangePreset = "2Y"): string {
  const state = templateToURL({
    refs: [{ source: "market", id, assetClass }],
    range,
    transform: "none",
    chartType: "candles",
    indicators: [],
    studies: [],
  });
  return `/market-chart?chart=${state}`;
}
