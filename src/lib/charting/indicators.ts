/**
 * Technical indicators for the charting engine — pure functions over a series'
 * aligned (number|null)[] close values. Overlays (MA family, Bollinger) share
 * the price scale; oscillators (RSI, MACD) render in their own sub-pane.
 *
 * Indicators are computed on the dense (non-null) subsequence and scattered
 * back to the chart axis, so gaps don't corrupt the windows.
 */
import type { CanvasSeries, OscPane, OHLC } from "./canvasTypes";

export type IndicatorType = "sma" | "ema" | "bollinger" | "rsi" | "macd";

export interface IndicatorSpec {
  id: string;
  type: IndicatorType;
  length?: number;
  fast?: number;
  slow?: number;
  signal?: number;
  k?: number; // bollinger std multiplier
}

export interface IndicatorResult {
  overlays: CanvasSeries[];
  oscPanes: OscPane[];
}

export const INDICATOR_PRESETS: { label: string; spec: Omit<IndicatorSpec, "id"> }[] = [
  { label: "SMA 20", spec: { type: "sma", length: 20 } },
  { label: "SMA 50", spec: { type: "sma", length: 50 } },
  { label: "SMA 200", spec: { type: "sma", length: 200 } },
  { label: "EMA 21", spec: { type: "ema", length: 21 } },
  { label: "EMA 50", spec: { type: "ema", length: 50 } },
  { label: "Bollinger 20", spec: { type: "bollinger", length: 20, k: 2 } },
  { label: "RSI 14", spec: { type: "rsi", length: 14 } },
  { label: "MACD 12/26/9", spec: { type: "macd", fast: 12, slow: 26, signal: 9 } },
];

const OVERLAY_COLORS = ["#F5C518", "#22D3EE", "#EC4899", "#94A3B8", "#A78BFA", "#2ECC71"];

// ── dense helpers ────────────────────────────────────────────────────────────

function compact(values: (number | null)[]): { idx: number[]; v: number[] } {
  const idx: number[] = [];
  const v: number[] = [];
  values.forEach((x, i) => {
    if (x != null && Number.isFinite(x)) { idx.push(i); v.push(x); }
  });
  return { idx, v };
}

function scatter(len: number, idx: number[], dense: (number | null)[]): (number | null)[] {
  const full: (number | null)[] = new Array(len).fill(null);
  idx.forEach((p, k) => { full[p] = dense[k]; });
  return full;
}

function smaDense(v: number[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i];
    if (i >= n) sum -= v[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}

function emaDense(v: number[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (n + 1);
  let prev = v.length ? v[0] : NaN;
  for (let i = 0; i < v.length; i++) {
    prev = i === 0 ? v[i] : v[i] * k + prev * (1 - k);
    out.push(i >= n - 1 ? prev : null);
  }
  return out;
}

function stdevDense(v: number[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < v.length; i++) {
    if (i < n - 1) { out.push(null); continue; }
    let m = 0;
    for (let j = i - n + 1; j <= i; j++) m += v[j];
    m /= n;
    let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += (v[j] - m) ** 2;
    out.push(Math.sqrt(s / n));
  }
  return out;
}

function rsiDense(v: number[], n: number): (number | null)[] {
  const out: (number | null)[] = new Array(v.length).fill(null);
  if (v.length <= n) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const ch = v[i] - v[i - 1];
    if (ch >= 0) gain += ch; else loss -= ch;
  }
  gain /= n; loss /= n;
  out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < v.length; i++) {
    const ch = v[i] - v[i - 1];
    gain = (gain * (n - 1) + (ch > 0 ? ch : 0)) / n;
    loss = (loss * (n - 1) + (ch < 0 ? -ch : 0)) / n;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

// ── public: OHLC synthesis + indicator dispatch ──────────────────────────────

/**
 * Derive an OHLC series from a close-only series for candle rendering.
 * Open = prior close; high/low bracket the move by a return-scaled range.
 * Deterministic (no randomness) — clearly a *derived* representation of close.
 */
export function synthOHLC(values: (number | null)[]): OHLC[] {
  return values.map((c, i) => {
    if (c == null) return { o: null, h: null, l: null, c: null };
    const prev = i > 0 && values[i - 1] != null ? (values[i - 1] as number) : c;
    const o = prev;
    const ret = prev ? Math.abs(c / prev - 1) : 0;
    const r = Math.min(0.05, Math.max(0.002, ret * 0.6 + 0.003));
    return { o, h: Math.max(o, c) * (1 + r), l: Math.min(o, c) * (1 - r), c };
  });
}

export function computeIndicator(spec: IndicatorSpec, values: (number | null)[], colorSeed: number): IndicatorResult {
  const len = values.length;
  const { idx, v } = compact(values);
  const color = OVERLAY_COLORS[colorSeed % OVERLAY_COLORS.length];

  switch (spec.type) {
    case "sma": {
      const n = spec.length ?? 50;
      return { overlays: [{ label: `SMA ${n}`, color, values: scatter(len, idx, smaDense(v, n)) }], oscPanes: [] };
    }
    case "ema": {
      const n = spec.length ?? 21;
      return { overlays: [{ label: `EMA ${n}`, color, values: scatter(len, idx, emaDense(v, n)) }], oscPanes: [] };
    }
    case "bollinger": {
      const n = spec.length ?? 20;
      const k = spec.k ?? 2;
      const mid = smaDense(v, n);
      const sd = stdevDense(v, n);
      const upper = mid.map((m, i) => (m == null || sd[i] == null ? null : m + k * (sd[i] as number)));
      const lower = mid.map((m, i) => (m == null || sd[i] == null ? null : m - k * (sd[i] as number)));
      return {
        overlays: [
          { label: `BB ${n} upper`, color, values: scatter(len, idx, upper), dashed: true },
          { label: `BB ${n} mid`, color, values: scatter(len, idx, mid) },
          { label: `BB ${n} lower`, color, values: scatter(len, idx, lower), dashed: true },
        ],
        oscPanes: [],
      };
    }
    case "rsi": {
      const n = spec.length ?? 14;
      return {
        overlays: [],
        oscPanes: [{
          id: spec.id,
          label: `RSI ${n}`,
          lines: [{ label: `RSI ${n}`, color, values: scatter(len, idx, rsiDense(v, n)) }],
          refLines: [{ v: 70, label: "70" }, { v: 30, label: "30" }],
          domain: [0, 100],
          fmt: (x) => x.toFixed(0),
        }],
      };
    }
    case "macd": {
      const fast = spec.fast ?? 12, slow = spec.slow ?? 26, signal = spec.signal ?? 9;
      const ef = emaDense(v, fast), es = emaDense(v, slow);
      const macd = v.map((_, i) => (ef[i] != null && es[i] != null ? (ef[i] as number) - (es[i] as number) : null));
      const mc = compact(macd);
      const sigDense = emaDense(mc.v, signal);
      const sig = scatter(v.length, mc.idx, sigDense);
      const hist = macd.map((m, i) => (m != null && sig[i] != null ? m - (sig[i] as number) : null));
      return {
        overlays: [],
        oscPanes: [{
          id: spec.id,
          label: `MACD ${fast}/${slow}/${signal}`,
          lines: [
            { label: "MACD", color: "#22D3EE", values: scatter(len, idx, macd) },
            { label: "Signal", color: "#FF8C00", values: scatter(len, idx, sig) },
          ],
          bars: { values: scatter(len, idx, hist), pos: "#2ECC71", neg: "#FF3B3B" },
          refLines: [{ v: 0 }],
          fmt: (x) => x.toFixed(2),
        }],
      };
    }
  }
}
