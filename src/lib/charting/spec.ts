/**
 * Charting layer — declarative chart spec.
 *
 * A ChartSpec is the serializable unit of a chart: it round-trips to a URL
 * param / localStorage / DB row so charts are bookmarkable, shareable, savable
 * as templates, and embeddable elsewhere in the terminal. Phase 0 supports a
 * single pane with line/area series, a range preset, and a normalize transform;
 * the shape is forward-compatible with the fuller engine in the plan.
 */

export type ChartSource = "fred" | "econ" | "market" | "lens" | "book" | "upload";

export interface SeriesRef {
  source: ChartSource;
  id: string;
  /** asset class hint for market/lens series (drives the synthetic/real path). */
  assetClass?: string;
}

export type Transform = "none" | "index100" | "pct_change" | "yoy" | "mom" | "zscore" | "log";
export type RangePreset = "1M" | "3M" | "6M" | "1Y" | "2Y" | "5Y" | "MAX";
export type ChartType = "line" | "area" | "candles";

export interface SeriesLayer {
  ref: SeriesRef;
  chartType: ChartType;
  color?: string;
}

export interface ChartSpec {
  title?: string;
  range: RangePreset;
  transform: Transform;
  series: SeriesLayer[];
}

export const RANGE_PRESETS: RangePreset[] = ["1M", "3M", "6M", "1Y", "2Y", "5Y", "MAX"];

/** Months of history a range preset implies (null = all). */
export function rangeMonths(p: RangePreset): number | null {
  switch (p) {
    case "1M": return 1;
    case "3M": return 3;
    case "6M": return 6;
    case "1Y": return 12;
    case "2Y": return 24;
    case "5Y": return 60;
    case "MAX": return null;
  }
}

/** Palette for series layers (terminal accents). */
export const SERIES_COLORS = [
  "#FF8C00", // amber
  "#3B9DFF", // blue
  "#2ECC71", // green
  "#A78BFA", // violet
  "#22D3EE", // cyan
  "#EC4899", // pink
  "#F5C518", // gold
  "#94A3B8", // slate
];

export function encodeSpec(spec: ChartSpec): string {
  const json = JSON.stringify(spec);
  if (typeof window === "undefined") return Buffer.from(json).toString("base64url");
  return btoa(unescape(encodeURIComponent(json)));
}

export function decodeSpec(s: string): ChartSpec | null {
  try {
    const json =
      typeof window === "undefined"
        ? Buffer.from(s, "base64url").toString("utf8")
        : decodeURIComponent(escape(atob(s)));
    const obj = JSON.parse(json);
    if (!obj || !Array.isArray(obj.series)) return null;
    return obj as ChartSpec;
  } catch {
    return null;
  }
}
