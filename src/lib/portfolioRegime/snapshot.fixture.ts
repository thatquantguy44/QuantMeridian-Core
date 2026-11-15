import { canonicalSnapshotJson, type AnyPoraSnapshotContent, type PoraSnapshotContent } from "./snapshot";

export function snapshotFixtureContent(): PoraSnapshotContent {
  const sessions = Array.from({ length: 253 }, (_, i) => new Date(Date.UTC(2024, 0, 2 + i)).toISOString().slice(0, 10));
  const assets = ["SPY", "AGG"] as const;
  const receipts = assets.map((id) => ({ id, runId: `run-${id}`, endpoint: `tiingo/daily/${id.toLowerCase()}/prices`, ingestedAt: "2026-11-11T00:00:00Z", payloadSha256: "a".repeat(64) }));
  return { version: "pora-research-snapshot/1", sourceMode: "WAREHOUSE_RECEIPT_RECONCILED", knowledgeBasis: "CURRENT_VINTAGE", modelAdmission: "NOT_ADMITTED", sourceRights: "UNKNOWN", currency: null,
    provider: "Tiingo End-of-Day", returnBasis: "DERIVED_TOTAL_RETURN", returnFormula: "((close + dividend) / previous_close) * split_factor - 1",
    calendar: "WAREHOUSE_NYSE", calendarTimeZone: "America/New_York", assetIdentity: "TICKER_ONLY", membership: "FIXED_SELECTION_NOT_PIT", receiptPayloads: "NOT_INCLUDED", asOfDate: "2026-11-12", captureStartedAt: "2026-11-12T16:00:00.000Z", captureCompletedAt: "2026-11-12T16:00:01.000Z", assetOrder: [...assets], sessions,
    receipts, assets: assets.map((id) => ({ id, latestDate: sessions.at(-1)!, futureGoldCount: 0, observations: sessions.map((date, i) => {
      const close = 100 + i; const fields = ["close", "divCash", "splitFactor"] as const;
      return { date, close, dividend: 0, splitFactor: 1, totalReturnIndex: close, evidence: fields.map((field) => ({ field, rawValue: String(field === "close" ? close : field === "divCash" ? 0 : 1), runId: `run-${id}`, rowHash: "fixture", ingestedAt: "2026-11-11T00:00:00Z" })) };
    }) })) };
}
export async function signSnapshotFixture(value: AnyPoraSnapshotContent) {
  const bytes = new TextEncoder().encode(canonicalSnapshotJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return { snapshotId: `sha256:${Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("")}`, content: value };
}
