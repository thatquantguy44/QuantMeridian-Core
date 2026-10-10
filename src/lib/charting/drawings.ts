/**
 * Drawing tools for chart annotation — trendlines, horizontal levels, and
 * Fibonacci retracements. Drawings are stored per-chart and persisted to
 * localStorage alongside saved templates.
 */

export type DrawingType = "hline" | "trendline" | "fib";

export interface HLine {
  type: "hline";
  id: string;
  value: number;
  color: string;
  label?: string;
}

export interface TrendLine {
  type: "trendline";
  id: string;
  x1: number; // axis index
  y1: number; // value
  x2: number;
  y2: number;
  color: string;
}

export interface FibRetracement {
  type: "fib";
  id: string;
  high: number;
  low: number;
  x1: number; // axis index of high
  x2: number; // axis index of low
  color: string;
}

export type Drawing = HLine | TrendLine | FibRetracement;

export type DrawMode = "none" | "hline" | "trendline" | "fib";

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

const LS_DRAW_KEY = "chart-drawings";

export function loadDrawings(chartId: string): Drawing[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_DRAW_KEY);
    const all: Record<string, Drawing[]> = raw ? JSON.parse(raw) : {};
    return all[chartId] ?? [];
  } catch {
    return [];
  }
}

export function saveDrawings(chartId: string, drawings: Drawing[]): void {
  try {
    const raw = localStorage.getItem(LS_DRAW_KEY);
    const all: Record<string, Drawing[]> = raw ? JSON.parse(raw) : {};
    all[chartId] = drawings;
    localStorage.setItem(LS_DRAW_KEY, JSON.stringify(all));
  } catch {
    // quota exceeded — silent fail
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 8);
}
