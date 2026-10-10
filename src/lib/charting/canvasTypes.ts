/** Shared rendering types for the charting canvas (pure, no React). */

export interface CanvasSeries {
  label: string;
  color: string;
  values: (number | null)[]; // aligned to the chart axis
  area?: boolean;
  dashed?: boolean;
  /** Faint guide line (e.g. a motion "trail" of the full path); excluded from tooltip/crosshair. */
  ghost?: boolean;
}

export interface OHLC {
  o: number | null;
  h: number | null;
  l: number | null;
  c: number | null;
}

/** An oscillator sub-pane (RSI, MACD, …) rendered below the main pane. */
export interface OscPane {
  id: string;
  label: string;
  lines: CanvasSeries[];
  bars?: { values: (number | null)[]; pos: string; neg: string };
  refLines?: { v: number; label?: string }[];
  height?: number;
  domain?: [number, number];
  fmt?: (v: number) => string;
}
