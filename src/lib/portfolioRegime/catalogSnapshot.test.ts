import { describe, expect, it } from "vitest";
import { qualifyCatalogReference, unavailableCatalogReference } from "./catalogReference";
import { qualifySnapshot } from "./qualification";
import { verifySnapshot, type PoraSnapshotContentV2 } from "./snapshot";
import { signSnapshotFixture, snapshotFixtureContent } from "./snapshot.fixture";

function v2() {
  const base = snapshotFixtureContent();
  const assets = base.assets.map((asset) => ({ ...asset, reference: qualifyCatalogReference(asset.id,
    [{ seriesId: asset.id, title: "Fictional test fund", units: "USD", frequency: "d", category: "equity", active: "1", downstreamUseCase: "equity_total_return", updatedAt: "2026-11-11T03:00:00Z" }],
    [{ seriesId: asset.id, manifestName: "equity_tiingo", updatedAt: "2026-11-11T04:00:00Z" }], base.captureCompletedAt) }));
  return { ...base, version: "pora-research-snapshot/2" as const, assets };
}
const sign = (data: ReturnType<typeof v2>) => signSnapshotFixture(data as PoraSnapshotContentV2);

describe("PORA versioned catalog evidence", () => {
  it("continues to import v1 snapshots without inventing metadata", async () => {
    const result = await verifySnapshot(await signSnapshotFixture(snapshotFixtureContent()));
    expect(result.assets.every((asset) => asset.reference === null)).toBe(true);
  });
  it("checks and exposes bound v2 metadata without qualifying identity or trading currency", async () => {
    const snapshot = await sign(v2()); const verification = await verifySnapshot(snapshot);
    expect(verification.assets[0].reference).toMatchObject({ status: "REPORTED", unitLabel: "USD", stableId: null, tradingCurrency: null });
    const report = qualifySnapshot({ origin: "CAPTURED", json: JSON.stringify(snapshot), verification });
    expect(report.assets[0].blockers).toContain("TICKER_ONLY_IDENTITY");
    expect(report.assets[0].blockers).toContain("CURRENCY_UNKNOWN");
    expect(report.assets[0].reference).toMatchObject({ status: "REPORTED", unitLabel: "USD" });
    expect(report.catalogLabels).toBe("MATCHING_UNVERIFIED_LABELS");
    expect(report.modelAdmission).toBe("BLOCKED");
  });
  it("distinguishes missing and conflicting unit labels", async () => {
    const missing = v2(); missing.assets[0].reference = unavailableCatalogReference("CATALOG_READ_FAILED");
    const unavailable = await verifySnapshot(await sign(missing));
    expect(qualifySnapshot({ origin: "IMPORTED", json: "", verification: unavailable }).catalogLabels).toBe("INCOMPLETE");
    const changed = v2(); changed.assets[1].reference.unitLabel = "EUR";
    const mismatch = await verifySnapshot(await sign(changed));
    expect(qualifySnapshot({ origin: "IMPORTED", json: "", verification: mismatch }).catalogLabels).toBe("CONFLICTING_LABELS");
  });
  it("changes snapshot identity when catalog evidence changes", async () => {
    const data = v2(), first = await sign(data); data.assets[0].reference.unitLabel = "EUR";
    expect((await sign(data)).snapshotId).not.toBe(first.snapshotId);
  });
  it.each([
    (data: ReturnType<typeof v2>) => { data.assets[0].reference.seriesId = "AGG"; },
    (data: ReturnType<typeof v2>) => { data.assets[0].reference.stableId = "invented" as never; },
    (data: ReturnType<typeof v2>) => { data.assets[0].reference.tradingCurrency = "USD" as never; },
    (data: ReturnType<typeof v2>) => { data.assets[0].reference.source = "SYNTHETIC" as never; },
    (data: ReturnType<typeof v2>) => { data.assets[0].reference.manifestUpdatedAt = "2026-11-13T00:00:00Z"; },
  ])("rejects invalid or unverified metadata even if rehashed", async (change) => {
    const data = v2(); change(data); await expect(verifySnapshot(await sign(data))).rejects.toThrow(/catalog/i);
  });
});
