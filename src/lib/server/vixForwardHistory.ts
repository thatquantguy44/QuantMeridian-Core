import type { SeriesTuple, VixForwardBasis } from "@/lib/vixImpliedForward";

export interface HistoryRow {
  date: unknown;
  value: unknown;
  close?: unknown;
  dividend?: unknown;
  split_factor?: unknown;
}
export interface SourceRow {
  source: string;
  series_id: string;
  observation_date: unknown;
  value: unknown;
  raw_value: unknown;
  is_missing: unknown;
  row_hash: string | null;
  run_id: string | null;
  ingested_at: string | null;
  receipt_run_id: string | null;
  receipt_endpoint: string | null;
}
export interface InputProvenance {
  provider: string;
  table: string;
  column: string;
  kind: "published index" | "observed close" | "derived total return";
  method: string;
  sourceSeries: string[];
  lastIngestedAt: string;
  verifiedRows: number;
}
export interface VixForwardProvenance {
  policy: "observed-inputs-only";
  verifiedAt: string;
  vix: InputProvenance;
  price: InputProvenance;
}
export class VixSourceError extends Error {}

function day(value: unknown): string {
  const date = value instanceof Date
    ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
    : typeof value === "string" ? value.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new VixSourceError("Invalid observation date in retained history.");
  }
  return date;
}
function number(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") || String(value).trim() === "" || !Number.isFinite(Number(value))) {
    throw new VixSourceError("Missing or invalid value in retained history.");
  }
  return Number(value);
}
function equal(actual: unknown, expected: number, label: string): void {
  if (Math.abs(number(actual) - expected) > 1e-8 * Math.max(1, Math.abs(expected))) {
    throw new VixSourceError(`Source reconciliation failed for ${label}.`);
  }
}

/** Verify Gold values against source-labelled Silver observations, never a replacement feed. */
export function verifyHistory(basis: VixForwardBasis, vixRows: HistoryRow[], priceRows: HistoryRow[], sourceRows: SourceRow[]): {
  vix: SeriesTuple[]; price: SeriesTuple[]; provenance: VixForwardProvenance;
} {
  const records = new Map<string, SourceRow>();
  for (const row of sourceRows) {
    const key = `${row.source}:${row.series_id}:${day(row.observation_date)}`;
    if (records.has(key)) throw new VixSourceError(`Ambiguous source records for ${row.series_id}.`);
    records.set(key, row);
  }
  const used = new Map<string, SourceRow[]>();
  function observed(provider: string, series: string, date: string): number {
    const row = records.get(`${provider}:${series}:${date}`);
    if (!row || row.is_missing === null || row.is_missing === undefined || Number(row.is_missing) !== 0 || !row.row_hash || !row.run_id || !row.ingested_at || !Number.isFinite(Date.parse(row.ingested_at))) {
      throw new VixSourceError(`Missing provider evidence for ${series} on ${date}; no values substituted.`);
    }
    const expectedEndpoint = provider === "fred" ? "series/observations" : "tiingo/daily/spy/prices";
    if (row.receipt_run_id !== row.run_id || row.receipt_endpoint !== expectedEndpoint) {
      throw new VixSourceError(`Missing retained ${provider === "fred" ? "FRED" : "Tiingo"} response receipt for ${series} on ${date}; origin not verified.`);
    }
    const value = number(row.value);
    equal(row.raw_value, value, `${series} raw value on ${date}`);
    const members = used.get(series) ?? [];
    members.push(row);
    used.set(series, members);
    return value;
  }
  function tuples(rows: HistoryRow[], label: string, check: (row: HistoryRow, date: string) => void): SeriesTuple[] {
    if (!rows.length) throw new VixSourceError(`No Gold observations found for ${label}.`);
    let previous = "";
    return rows.map((row) => {
      const date = day(row.date);
      if (date <= previous || number(row.value) <= 0) throw new VixSourceError(`Invalid or duplicate Gold observation for ${label}.`);
      previous = date;
      check(row, date);
      return [date, number(row.value)];
    });
  }
  const vix = tuples(vixRows, "VIXCLS", (row, date) => equal(row.value, observed("fred", "VIXCLS", date), `VIXCLS on ${date}`));
  const sourceSeries = basis === "sp500_index" ? ["SP500"] : basis === "spy_price" ? ["SPY:close"] : ["SPY:close", "SPY:divCash", "SPY:splitFactor"];
  const reconstructed = new Map<string, number>();
  if (basis === "spy_total") {
    const dates = sourceRows.filter((row) => row.source === "tiingo" && row.series_id === "SPY:close").map((row) => day(row.observation_date)).sort();
    let previousClose: number | null = null;
    let index = 100;
    for (const date of dates) {
      const close = observed("tiingo", "SPY:close", date);
      const dividend = observed("tiingo", "SPY:divCash", date);
      const split = observed("tiingo", "SPY:splitFactor", date);
      if (close <= 0 || dividend < 0 || split <= 0) throw new VixSourceError(`Invalid Tiingo corporate-action inputs on ${date}.`);
      if (previousClose !== null) index *= (close + dividend) / previousClose * split;
      if (!Number.isFinite(index)) throw new VixSourceError("Invalid reconstructed SPY total-return index.");
      reconstructed.set(date, index);
      previousClose = close;
    }
  }
  const price = tuples(priceRows, sourceSeries.join(" + "), (row, date) => {
    if (basis === "spy_total") {
      const expected = reconstructed.get(date);
      if (expected === undefined) throw new VixSourceError(`Missing Tiingo close on ${date}.`);
      equal(row.close, observed("tiingo", "SPY:close", date), `SPY close on ${date}`);
      equal(row.dividend, observed("tiingo", "SPY:divCash", date), `SPY dividend on ${date}`);
      equal(row.split_factor, observed("tiingo", "SPY:splitFactor", date), `SPY split on ${date}`);
      equal(row.value, expected, `SPY total return on ${date}`);
    } else {
      equal(row.value, observed(basis === "spy_price" ? "tiingo" : "fred", sourceSeries[0], date), `${sourceSeries[0]} on ${date}`);
    }
  });
  // Missing Gold dates inside the retained source range must not become a multi-day "daily" return.
  for (const [series, values] of [["VIXCLS", vix], [sourceSeries[0], price]] as const) {
    const dates = new Set(values.map(([date]) => date));
    const provider = series.startsWith("SPY:") ? "tiingo" : "fred";
    for (const row of sourceRows) {
      if (row.source !== provider || row.series_id !== series || Number(row.is_missing) !== 0 || row.value === null) continue;
      const date = day(row.observation_date);
      if (date >= values[0][0] && date <= values.at(-1)![0] && !dates.has(date)) throw new VixSourceError(`Missing Gold observation for ${series} on ${date}.`);
    }
  }
  function provenance(series: string[], verifiedRows: number, details: Omit<InputProvenance, "sourceSeries" | "lastIngestedAt" | "verifiedRows">): InputProvenance {
    const rows = series.flatMap((id) => used.get(id) ?? []);
    return { ...details, sourceSeries: series, lastIngestedAt: rows.reduce((latest, row) => !latest || Date.parse(row.ingested_at!) > Date.parse(latest) ? row.ingested_at! : latest, ""), verifiedRows };
  }
  return { vix, price, provenance: {
    policy: "observed-inputs-only", verifiedAt: new Date().toISOString(),
    vix: provenance(["VIXCLS"], vix.length, { provider: "Cboe via FRED", table: "gold.fred_latest_observation", column: "value", kind: "published index", method: "Published VIX daily close, reconciled to retained FRED observations. Pre-September-2003 history was back-calculated by Cboe from historical option quotes." }),
    price: provenance(sourceSeries, price.length, basis === "sp500_index"
      ? { provider: "S&P Dow Jones Indices via FRED", table: "gold.fred_latest_observation", column: "value", kind: "published index", method: "Published S&P 500 price index; excludes dividends." }
      : { provider: "Tiingo End-of-Day", table: "gold.equity_total_return_index", column: basis === "spy_price" ? "close" : "total_return_index", kind: basis === "spy_price" ? "observed close" : "derived total return", method: basis === "spy_price" ? "Unadjusted SPY daily close in USD; excludes dividends." : "Index starts at 100 at the first retained Tiingo close. I(t) = I(t−1) × (close(t) + divCash(t)) / close(t−1) × splitFactor(t). Reconciled to every required source input; no missing-field defaults." }),
  } };
}
