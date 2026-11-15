import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalSnapshotJson } from "@/lib/portfolioRegime/snapshot";
import { qualifyCatalogReference } from "@/lib/portfolioRegime/catalogReference";
import type { PoraAsset } from "@/lib/portfolioRegime/multiAssetContracts";
import { createSourceSnapshot } from "./snapshotBuilder";
import type { MultiAssetEvidence } from "./multiAssetEvidence";

function evidence(): MultiAssetEvidence {
  const dates = ["2024-01-02", "2024-01-03"];
  const gold = ["SPY", "AGG"].flatMap((ticker) => dates.map((date, i) => ({ ticker, date, close: 100 + i, dividend: 0, split: 1, index: 100 + i })));
  const silver = gold.flatMap((row) => [["close", row.close], ["divCash", row.dividend], ["splitFactor", row.split]].map(([field, value]) => ({ source: "tiingo", seriesId: `${row.ticker}:${field}`, date: row.date, value, rawValue: String(value), missing: 0, hash: "test-hash", runId: `run-${row.ticker}`, ingestedAt: "2024-01-05T15:00:00Z" })));
  const receipts = ["SPY", "AGG"].map((ticker) => ({ ticker, source: "tiingo", endpoint: `tiingo/daily/${ticker.toLowerCase()}/prices`, runId: `run-${ticker}`, ingestedAt: "2024-01-05T15:00:00Z", payload: JSON.stringify({ format: "tiingo", ticker, data: gold.filter((row) => row.ticker === ticker).map((row) => ({ date: row.date, close: row.close, divCash: row.dividend, splitFactor: row.split })) }) }));
  return { asOfDate: "2024-01-05", checkedAt: "2024-01-05T16:00:00Z", dates, latest: ["SPY", "AGG"].map((ticker) => ({ ticker, latestDate: "2024-01-03", futureCount: 0 })), gold, silver, receipts };
}

describe("PORA snapshot builder", () => {
  it("binds selected observations, source evidence, receipt fingerprints and capture metadata", () => {
    const data = evidence(); const snapshot = createSourceSnapshot(data, ["SPY", "AGG"], "2024-01-05T15:59:00Z");
    expect(snapshot.snapshotId).toBe(`sha256:${createHash("sha256").update(canonicalSnapshotJson(snapshot.content)).digest("hex")}`);
    expect(snapshot.content.assetOrder).toEqual(["SPY", "AGG"]);
    expect(snapshot.content.assets[0].observations[1]).toMatchObject({ date: "2024-01-03", close: 101, dividend: 0, splitFactor: 1 });
    expect(snapshot.content.receipts[0].payloadSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(snapshot)).not.toContain("\"payload\":");
    const changed = evidence(); changed.silver[0].hash = "different-hash";
    expect(createSourceSnapshot(changed, ["SPY", "AGG"], "2024-01-05T15:59:00Z").snapshotId).not.toBe(snapshot.snapshotId);
  });
  it("binds a v2 catalog record to each selected asset and changes the snapshot ID when it changes", () => {
    const data = evidence(); const at = "2024-01-05T15:59:00Z";
    const makeRef = (id: PoraAsset, units: string) => qualifyCatalogReference(id,
      [{ seriesId: id, title: "Fictional test fund", units, category: "equity", frequency: "d", active: "1", downstreamUseCase: "equity_total_return", updatedAt: "2024-01-05T15:30:00Z" }],
      [{ seriesId: id, manifestName: "equity_tiingo", updatedAt: "2024-01-05T15:30:00Z" }], data.checkedAt);
    const refs = new Map<PoraAsset, ReturnType<typeof makeRef>>([["SPY", makeRef("SPY", "USD")], ["AGG", makeRef("AGG", "USD")]]);
    const snapshot = createSourceSnapshot(data, ["SPY", "AGG"], at, refs);
    expect(snapshot.content.version).toBe("pora-research-snapshot/2");
    if (snapshot.content.version !== "pora-research-snapshot/2") throw new Error("wrong snapshot version");
    expect(snapshot.content.assets[0].reference).toMatchObject({ seriesId: "SPY", unitLabel: "USD", tradingCurrency: null, stableId: null });
    refs.set("SPY", makeRef("SPY", "EUR"));
    expect(createSourceSnapshot(data, ["SPY", "AGG"], at, refs).snapshotId).not.toBe(snapshot.snapshotId);
    refs.delete("AGG");
    expect(() => createSourceSnapshot(data, ["SPY", "AGG"], at, refs)).toThrow(/catalog/i);
  });
  it("omits receipts not referenced by selected observations", () => {
    const data = evidence(); data.receipts.push({ ...data.receipts[0], runId: "unused-run" });
    const snapshot = createSourceSnapshot(data, ["SPY", "AGG"], "2024-01-05T15:59:00Z");
    expect(snapshot.content.receipts.some((receipt) => receipt.runId === "unused-run")).toBe(false);
  });
  it("rejects a capture whose New York as-of date changed", () => {
    expect(() => createSourceSnapshot(evidence(), ["SPY", "AGG"], "2024-01-04T16:00:00Z")).toThrow(/as-of date/i);
  });
  it("refuses to freeze evidence that no longer reconciles", () => {
    const data = evidence(); data.gold[0].close = 500;
    expect(() => createSourceSnapshot(data, ["SPY", "AGG"], "2024-01-05T15:59:00Z")).toThrow();
  });
});
