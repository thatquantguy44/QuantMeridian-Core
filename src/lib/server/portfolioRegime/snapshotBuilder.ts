import { createHash } from "node:crypto";
import { benchmarkAsOfDate } from "@/lib/benchmarkAsOf";
import { canonicalSnapshotJson, type AnyPoraSnapshotContent, type PoraSnapshot, type PoraSnapshotContent, type PoraSnapshotEvidence } from "@/lib/portfolioRegime/snapshot";
import { validateCatalogReference, type CatalogReference } from "@/lib/portfolioRegime/catalogReference";
import { PoraEvidenceError, verifyMultiAssetEvidence, type MultiAssetEvidence, type PoraAsset } from "./multiAssetEvidence";

/** Freeze the same evidence that passed source reconciliation; raw receipt payloads stay in the warehouse. */
export function createSourceSnapshot(data: MultiAssetEvidence, ids: PoraAsset[], captureStartedAt: string, references?: ReadonlyMap<PoraAsset, CatalogReference>): PoraSnapshot {
  verifyMultiAssetEvidence(data, ids);
  if (!Number.isFinite(Date.parse(captureStartedAt)) || Date.parse(captureStartedAt) > Date.parse(data.checkedAt) || benchmarkAsOfDate(new Date(captureStartedAt)) !== data.asOfDate) throw new PoraEvidenceError("The as-of date changed during the source capture; retry it.");
  const gold = new Map(data.gold.map((row) => [`${row.ticker}|${row.date}`, row]));
  const source = new Map(data.silver.map((row) => [`${row.seriesId}|${row.date}`, row]));
  const latest = new Map(data.latest.map((row) => [row.ticker, row]));
  const referencedReceipts = new Set(data.silver.map((row) => `${row.seriesId.split(":")[0]}|${row.runId}`));
  const receipts = data.receipts.filter((receipt) => referencedReceipts.has(`${receipt.ticker}|${receipt.runId}`)).map((receipt) => ({ id: receipt.ticker as PoraAsset, runId: receipt.runId, endpoint: receipt.endpoint, ingestedAt: receipt.ingestedAt, payloadSha256: createHash("sha256").update(receipt.payload, "utf8").digest("hex") })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : a.runId < b.runId ? -1 : a.runId > b.runId ? 1 : 0);
  const assets = ids.map((id) => ({ id, latestDate: latest.get(id)!.latestDate, futureGoldCount: latest.get(id)!.futureCount,
    observations: data.dates.map((date) => {
      const row = gold.get(`${id}|${date}`)!;
      const evidence: PoraSnapshotEvidence[] = (["close", "divCash", "splitFactor"] as const).map((field) => {
        const item = source.get(`${id}:${field}|${date}`)!;
        return { field, rawValue: String(item.rawValue), runId: item.runId!, rowHash: item.hash!, ingestedAt: item.ingestedAt! };
      });
      return { date, close: Number(row.close), dividend: Number(row.dividend), splitFactor: Number(row.split), totalReturnIndex: Number(row.index), evidence };
    }) }));
  const legacy: PoraSnapshotContent = { version: "pora-research-snapshot/1", sourceMode: "WAREHOUSE_RECEIPT_RECONCILED", knowledgeBasis: "CURRENT_VINTAGE", modelAdmission: "NOT_ADMITTED", sourceRights: "UNKNOWN", currency: null,
    provider: "Tiingo End-of-Day", returnBasis: "DERIVED_TOTAL_RETURN", returnFormula: "((close + dividend) / previous_close) * split_factor - 1",
    calendar: "WAREHOUSE_NYSE", calendarTimeZone: "America/New_York", assetIdentity: "TICKER_ONLY", membership: "FIXED_SELECTION_NOT_PIT", receiptPayloads: "NOT_INCLUDED", asOfDate: data.asOfDate, captureStartedAt, captureCompletedAt: data.checkedAt, assetOrder: [...ids], sessions: [...data.dates], receipts, assets };
  let content: AnyPoraSnapshotContent = legacy;
  if (references) {
    if (references.size !== ids.length || ids.some((id) => !references.has(id))) throw new PoraEvidenceError("Catalog evidence is incomplete for the selected assets.");
    content = { ...legacy, version: "pora-research-snapshot/2", assets: assets.map((asset) => ({ ...asset, reference: validateCatalogReference(references.get(asset.id)!, asset.id, data.checkedAt) })) };
  }
  const canonical = canonicalSnapshotJson(content);
  if (Buffer.byteLength(canonical, "utf8") > 4_000_000) throw new PoraEvidenceError("The captured snapshot exceeds the supported size.");
  return { snapshotId: `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`, content };
}
