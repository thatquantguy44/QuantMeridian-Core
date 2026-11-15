import { expect, test } from "vitest";
import { verifyHistory, type HistoryRow, type SourceRow } from "./vixForwardHistory";

function fixtures() {
  const vix: HistoryRow[] = [{ date: "2024-01-02", value: 15 }, { date: "2024-01-03", value: 16 }, { date: "2024-01-04", value: 17 }];
  const price: HistoryRow[] = [
    { date: "2024-01-02", close: 100, dividend: 0, split_factor: 1, value: 100 },
    { date: "2024-01-03", close: 50, dividend: 0, split_factor: 2, value: 100 },
    { date: "2024-01-04", close: 49, dividend: 1, split_factor: 1, value: 100 },
  ];
  const source = (provider: string, series: string, date: unknown, value: unknown): SourceRow => ({ source: provider, series_id: series, observation_date: date, value, raw_value: String(value), is_missing: 0, row_hash: "unit-test-receipt", run_id: "unit-test-only", ingested_at: "2024-01-05T00:00:00Z", receipt_run_id: "unit-test-only", receipt_endpoint: provider === "fred" ? "series/observations" : "tiingo/daily/spy/prices" });
  const evidence = [...vix.map((row) => source("fred", "VIXCLS", row.date, row.value)), ...price.flatMap((row) => [source("tiingo", "SPY:close", row.date, row.close), source("tiingo", "SPY:divCash", row.date, row.dividend), source("tiingo", "SPY:splitFactor", row.date, row.split_factor)])];
  return { vix, price, evidence };
}
test("reconciles splits and reinvested dividends including a truncated Gold serving range", () => {
  const { vix, price, evidence } = fixtures();
  const history = verifyHistory("spy_total", vix, price.slice(1), evidence);
  expect(history.price).toEqual([["2024-01-03", 100], ["2024-01-04", 100]]);
  expect(history.provenance.price.verifiedRows).toBe(2);
});
test("a plausible but incorrect Gold total-return index is rejected", () => {
  const { vix, price, evidence } = fixtures(); price[2].value = 99;
  expect(() => verifyHistory("spy_total", vix, price, evidence)).toThrow(/SPY total return/);
});
test("missing corporate-action evidence before the Gold serving range still blocks reconstruction", () => {
  const { vix, price, evidence } = fixtures();
  const incomplete = evidence.filter((row) => !(row.series_id === "SPY:divCash" && row.observation_date === "2024-01-02"));
  expect(() => verifyHistory("spy_total", vix, price.slice(1), incomplete)).toThrow(/SPY:divCash/);
});
test("an interior missing Gold date is an error, not a multi-day daily return", () => {
  const { vix, price, evidence } = fixtures();
  expect(() => verifyHistory("spy_total", vix, [price[0], price[2]], evidence)).toThrow(/Missing Gold observation/);
});
test("ambiguous provider observations cannot be silently selected", () => {
  const { vix, price, evidence } = fixtures();
  expect(() => verifyHistory("spy_total", vix, price, [...evidence, evidence[0]])).toThrow(/Ambiguous/);
});
test.each([null, "", " ", Number.NaN, Number.POSITIVE_INFINITY, true, 0, -1])("rejects invalid or nonpositive Gold values (%s)", (value) => {
  const { vix, price, evidence } = fixtures(); vix[0].value = value;
  expect(() => verifyHistory("spy_total", vix, price, evidence)).toThrow();
});
test("cannot round a mismatching source close into agreement", () => {
  const { vix, price, evidence } = fixtures();
  price[0].value = 100.00004;
  expect(() => verifyHistory("spy_price", vix, price, evidence)).toThrow(/reconciliation failed/);
});

test("a source label and run ID without a retained provider response receipt are insufficient", () => {
  const { vix, price, evidence } = fixtures();
  evidence[0].receipt_run_id = null;
  expect(() => verifyHistory("spy_total", vix, price, evidence)).toThrow(/Missing retained FRED response receipt/);
});
test("a receipt from the wrong endpoint is rejected", () => {
  const { vix, price, evidence } = fixtures();
  evidence[0].receipt_endpoint = "synthetic/fixtures";
  expect(() => verifyHistory("spy_total", vix, price, evidence)).toThrow(/origin not verified/);
});
