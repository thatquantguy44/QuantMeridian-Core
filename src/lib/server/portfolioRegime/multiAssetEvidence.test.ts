import { describe, expect, it } from "vitest";
import { verifyMultiAssetEvidence, type MultiAssetEvidence } from "./multiAssetEvidence";

const dates = ["2024-01-02", "2024-01-03", "2024-01-04"];
function fixture(): MultiAssetEvidence {
  const gold = [
    ...dates.map((date, i) => ({ ticker: "SPY", date, close: [100, 102, 103][i], dividend: 0, split: 1, index: [100, 102, 103][i] })),
    ...dates.map((date, i) => ({ ticker: "AGG", date, close: [100, 100.5, 100.3][i], dividend: 0, split: 1, index: [100, 100.5, 100.3][i] })),
  ];
  const silver = gold.flatMap((row) => [["close", row.close], ["divCash", row.dividend], ["splitFactor", row.split]].map(([field, value]) => ({ source: "tiingo", seriesId: `${row.ticker}:${field}`, date: row.date, value, rawValue: String(value), missing: 0, hash: "fixture", runId: `fixture-${row.ticker}`, ingestedAt: "2024-01-05T15:00:00Z" })));
  const receipts = ["SPY", "AGG"].map((ticker) => ({ ticker, source: "tiingo", endpoint: `tiingo/daily/${ticker.toLowerCase()}/prices`, runId: `fixture-${ticker}`, ingestedAt: "2024-01-05T15:00:00Z", payload: JSON.stringify({ format: "tiingo", ticker, data: gold.filter((row) => row.ticker === ticker).map((row) => ({ date: `${row.date}T00:00:00.000Z`, close: row.close, divCash: row.dividend, splitFactor: row.split })) }) }));
  return { asOfDate: "2024-01-05", checkedAt: "2024-01-05T16:00:00Z", dates: [...dates], latest: [{ ticker: "SPY", latestDate: "2024-01-04", futureCount: 0 }, { ticker: "AGG", latestDate: "2024-01-04", futureCount: 0 }], gold, silver, receipts };
}

describe("PORA multi-asset source evidence", () => {
  it("verifies aligned inputs against retained provider receipts and calculates returns without filling gaps", () => {
    const result = verifyMultiAssetEvidence(fixture(), ["SPY", "AGG"]);
    expect(result).toMatchObject({ source: "DB", asOfDate: "2024-01-05", firstDate: "2024-01-02", lastDate: "2024-01-04", sessionCount: 3, returnCount: 2 });
    expect(result.assets.map((asset) => asset.id)).toEqual(["SPY", "AGG"]);
    expect(result.assets[0].returns[0].value).toBeCloseTo(0.02);
    expect(result.assets[0].totalChange).toBeCloseTo(0.03);
    expect(result.assets[1].totalChange).toBeCloseTo(0.003);
  });
  it("reconciles a cash dividend and split using the declared return formula", () => {
    const data = fixture();
    const gold = data.gold.filter((row) => row.ticker === "SPY");
    gold[1].close = 51; gold[1].dividend = 1; gold[1].split = 2; gold[1].index = 104;
    gold[2].close = 52; gold[2].index = 104 * 52 / 51;
    for (const row of gold) for (const [field, value] of [["close", row.close], ["divCash", row.dividend], ["splitFactor", row.split]] as const) {
      const item = data.silver.find((entry) => entry.seriesId === `SPY:${field}` && entry.date === row.date)!;
      item.value = value; item.rawValue = String(value);
    }
    const receipt = data.receipts.find((item) => item.ticker === "SPY")!;
    receipt.payload = JSON.stringify({ format: "tiingo", ticker: "SPY", data: gold.map((row) => ({ date: row.date, close: row.close, divCash: row.dividend, splitFactor: row.split })) });
    const spy = verifyMultiAssetEvidence(data, ["SPY", "AGG"]).assets[0];
    expect(spy.returns[0].value).toBeCloseTo(0.04);
    expect(spy.returns[1].value).toBeCloseTo(52 / 51 - 1);
    expect(spy.totalChange).toBeCloseTo(1.04 * 52 / 51 - 1);
  });
  it.each([
    (data: MultiAssetEvidence) => { data.gold.pop(); },
    (data: MultiAssetEvidence) => { data.gold[1].index = 999; },
    (data: MultiAssetEvidence) => { data.gold[1].dividend = 1; },
    (data: MultiAssetEvidence) => { data.silver[0].source = "synthetic"; },
    (data: MultiAssetEvidence) => { data.silver[0].rawValue = "999"; },
    (data: MultiAssetEvidence) => { data.silver[0].value = Infinity; },
    (data: MultiAssetEvidence) => { data.silver[0].ingestedAt = "2024-01-06T00:00:00Z"; },
    (data: MultiAssetEvidence) => { data.silver.push(data.silver[0]); },
    (data: MultiAssetEvidence) => { data.receipts[0].payload = "{}"; },
    (data: MultiAssetEvidence) => { data.receipts[0].endpoint = "unknown"; },
    (data: MultiAssetEvidence) => { data.receipts[0].ingestedAt = "2024-01-06T00:00:00Z"; },
    (data: MultiAssetEvidence) => { data.receipts[0].ingestedAt = "2024-01-05"; },
    (data: MultiAssetEvidence) => { data.silver[0].ingestedAt = "2024-01-05"; },
    (data: MultiAssetEvidence) => { data.silver[0].missing = " "; },
    (data: MultiAssetEvidence) => { data.dates[1] = "2024-01-02"; },
    (data: MultiAssetEvidence) => { data.latest[0].latestDate = "2024-01-03"; },
  ])("rejects missing, inconsistent or unverified evidence without partial results", (change) => {
    const data = fixture(); change(data); expect(() => verifyMultiAssetEvidence(data, ["SPY", "AGG"])).toThrow();
  });
  it("rejects a receipt value that disagrees with both retained layers", () => {
    const data = fixture(); const payload = JSON.parse(data.receipts[0].payload); payload.data[1].close = 999; data.receipts[0].payload = JSON.stringify(payload);
    expect(() => verifyMultiAssetEvidence(data, ["SPY", "AGG"])).toThrow(/receipt/i);
  });
});
