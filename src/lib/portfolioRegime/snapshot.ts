import { benchmarkAsOfDate } from "@/lib/benchmarkAsOf";
import { PORA_ASSETS, type PoraAsset } from "./multiAssetContracts";
import { validateCatalogReference, type CatalogReference } from "./catalogReference";

export interface PoraSnapshotEvidence { field: "close" | "divCash" | "splitFactor"; rawValue: string; runId: string; rowHash: string; ingestedAt: string }
export interface PoraSnapshotObservation { date: string; close: number; dividend: number; splitFactor: number; totalReturnIndex: number; evidence: PoraSnapshotEvidence[] }
export interface PoraSnapshotContent {
  version: "pora-research-snapshot/1"; sourceMode: "WAREHOUSE_RECEIPT_RECONCILED"; knowledgeBasis: "CURRENT_VINTAGE"; modelAdmission: "NOT_ADMITTED"; sourceRights: "UNKNOWN"; currency: null;
  provider: "Tiingo End-of-Day"; returnBasis: "DERIVED_TOTAL_RETURN"; returnFormula: "((close + dividend) / previous_close) * split_factor - 1";
  calendar: "WAREHOUSE_NYSE"; calendarTimeZone: "America/New_York"; assetIdentity: "TICKER_ONLY"; membership: "FIXED_SELECTION_NOT_PIT"; receiptPayloads: "NOT_INCLUDED"; asOfDate: string; captureStartedAt: string; captureCompletedAt: string; assetOrder: PoraAsset[]; sessions: string[];
  receipts: { id: PoraAsset; runId: string; endpoint: string; ingestedAt: string; payloadSha256: string }[];
  assets: { id: PoraAsset; latestDate: string; futureGoldCount: number; observations: PoraSnapshotObservation[] }[];
}
export type PoraSnapshotContentV2 = Omit<PoraSnapshotContent, "version" | "assets"> & { version: "pora-research-snapshot/2"; assets: (PoraSnapshotContent["assets"][number] & { reference: CatalogReference })[] };
export type AnyPoraSnapshotContent = PoraSnapshotContent | PoraSnapshotContentV2;
export interface PoraSnapshot { snapshotId: string; content: AnyPoraSnapshotContent }
export interface SnapshotVerification { snapshotId: string; asOfDate: string; capturedAt: string; firstDate: string; lastDate: string; returnCount: number; assets: { id: PoraAsset; totalChange: number; returns: { date: string; value: number }[]; reference: CatalogReference | null }[] }
const invalid = (message: string): never => { throw new Error(message); };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: unknown, fields: string[]) => object(value) && Object.keys(value).sort().join("|") === fields.slice().sort().join("|");
const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const n = Date.parse(`${value}T00:00:00Z`); return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === value;
};
const timestamp = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));

/** Canonical JSON v1: sorted object keys, preserved array order and standard JS JSON scalars. */
export function canonicalSnapshotJson(value: unknown): string {
  const seen = new Set<object>(); let nodes = 0;
  function encode(item: unknown, depth: number): string {
    if (++nodes > 100_000 || depth > 20) return invalid("Snapshot exceeds canonicalization limits.");
    if (item === null || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "string") { if (item.length > 4096) return invalid("Snapshot text exceeds the supported limit."); return JSON.stringify(item); }
    if (typeof item === "number") { if (!Number.isFinite(item)) return invalid("Snapshot contains a nonfinite value."); return JSON.stringify(item); }
    if (!item || typeof item !== "object" || seen.has(item)) return invalid("Snapshot contains unsupported or cyclic data.");
    seen.add(item);
    let result: string;
    if (Array.isArray(item)) result = `[${item.map((child) => encode(child, depth + 1)).join(",")}]`;
    else {
      const record = item as Record<string, unknown>;
      result = `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${encode(record[key], depth + 1)}`).join(",")}}`;
    }
    seen.delete(item); return result;
  }
  return encode(value, 0);
}

/** Checks hash and internal math only: an unkeyed hash cannot authenticate the source. */
export async function verifySnapshot(input: unknown): Promise<SnapshotVerification> {
  if (!exact(input, ["snapshotId", "content"])) return invalid("Snapshot envelope is invalid.");
  const envelope = input as { snapshotId: unknown; content: unknown };
  if (typeof envelope.snapshotId !== "string" || !/^sha256:[0-9a-f]{64}$/.test(envelope.snapshotId)) return invalid("Snapshot ID is invalid.");
  const canonical = canonicalSnapshotJson(envelope.content);
  const bytes = new TextEncoder().encode(canonical);
  if (bytes.byteLength > 4_000_000) return invalid("Snapshot exceeds the supported size.");
  if (!globalThis.crypto?.subtle) return invalid("Snapshot integrity checking is unavailable in this browser.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const calculated = `sha256:${Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, "0")).join("")}`;
  if (calculated !== envelope.snapshotId) return invalid("Snapshot hash does not match its content.");
  const content = envelope.content;
  if (!exact(content, ["version", "sourceMode", "knowledgeBasis", "modelAdmission", "sourceRights", "currency", "provider", "returnBasis", "returnFormula", "calendar", "calendarTimeZone", "assetIdentity", "membership", "receiptPayloads", "asOfDate", "captureStartedAt", "captureCompletedAt", "assetOrder", "sessions", "receipts", "assets"])) return invalid("Snapshot content is invalid.");
  const data = content as unknown as AnyPoraSnapshotContent;
  const v2 = data.version === "pora-research-snapshot/2";
  if ((!v2 && data.version !== "pora-research-snapshot/1") || data.sourceMode !== "WAREHOUSE_RECEIPT_RECONCILED" || data.knowledgeBasis !== "CURRENT_VINTAGE" || data.modelAdmission !== "NOT_ADMITTED" || data.sourceRights !== "UNKNOWN" || data.currency !== null || data.provider !== "Tiingo End-of-Day" || data.returnBasis !== "DERIVED_TOTAL_RETURN" || data.returnFormula !== "((close + dividend) / previous_close) * split_factor - 1" || data.calendar !== "WAREHOUSE_NYSE" || data.calendarTimeZone !== "America/New_York" || data.assetIdentity !== "TICKER_ONLY" || data.membership !== "FIXED_SELECTION_NOT_PIT" || data.receiptPayloads !== "NOT_INCLUDED" ||
    !validDate(data.asOfDate) || !timestamp(data.captureStartedAt) || !timestamp(data.captureCompletedAt) || Date.parse(data.captureStartedAt) > Date.parse(data.captureCompletedAt) || benchmarkAsOfDate(new Date(data.captureStartedAt)) !== data.asOfDate || benchmarkAsOfDate(new Date(data.captureCompletedAt)) !== data.asOfDate ||
    !Array.isArray(data.assetOrder) || data.assetOrder.length < 2 || data.assetOrder.length > 4 || new Set(data.assetOrder).size !== data.assetOrder.length || data.assetOrder.some((id) => !PORA_ASSETS.includes(id)) ||
    !Array.isArray(data.sessions) || data.sessions.length !== 253 || data.sessions.some((day, i) => !validDate(day) || day > data.asOfDate || (i > 0 && day <= data.sessions[i - 1])) ||
    !Array.isArray(data.assets) || data.assets.length !== data.assetOrder.length || !Array.isArray(data.receipts) || !data.receipts.length || data.receipts.length > 3036) return invalid("Snapshot provenance or session coverage is invalid.");
  const receipts = new Map<string, PoraSnapshotContent["receipts"][number]>();
  for (const receipt of data.receipts) {
    if (!exact(receipt, ["id", "runId", "endpoint", "ingestedAt", "payloadSha256"]) || !data.assetOrder.includes(receipt.id) || typeof receipt.runId !== "string" || !receipt.runId || receipt.runId.length > 256 ||
      receipt.endpoint !== `tiingo/daily/${receipt.id.toLowerCase()}/prices` || !timestamp(receipt.ingestedAt) || Date.parse(receipt.ingestedAt) > Date.parse(data.captureCompletedAt) || !/^[0-9a-f]{64}$/.test(receipt.payloadSha256)) return invalid("Snapshot receipt fingerprint is invalid.");
    const key = `${receipt.id}|${receipt.runId}`; if (receipts.has(key)) return invalid("Snapshot receipt fingerprints are duplicated."); receipts.set(key, receipt);
  }
  const summaries: SnapshotVerification["assets"] = [];
  const usedReceipts = new Set<string>();
  for (let assetIndex = 0; assetIndex < data.assets.length; assetIndex++) {
    const asset = data.assets[assetIndex];
    if (!exact(asset, ["id", "latestDate", "futureGoldCount", "observations", ...(v2 ? ["reference"] : [])]) || asset.id !== data.assetOrder[assetIndex] || !validDate(asset.latestDate) || asset.latestDate < data.sessions.at(-1)! || asset.latestDate > data.asOfDate ||
      !Number.isSafeInteger(asset.futureGoldCount) || asset.futureGoldCount < 0 || !Array.isArray(asset.observations) || asset.observations.length !== data.sessions.length) return invalid("Snapshot asset coverage is invalid.");
    const reference = v2 ? validateCatalogReference((asset as PoraSnapshotContentV2["assets"][number]).reference, asset.id, data.captureCompletedAt) : null;
    let previousClose: number | null = null, previousIndex: number | null = null, firstIndex = 0, compounded = 1;
    const returns: { date: string; value: number }[] = [];
    for (let i = 0; i < asset.observations.length; i++) {
      const row = asset.observations[i];
      if (!exact(row, ["date", "close", "dividend", "splitFactor", "totalReturnIndex", "evidence"]) || row.date !== data.sessions[i] || !finite(row.close) || row.close <= 0 || !finite(row.dividend) || row.dividend < 0 || !finite(row.splitFactor) || row.splitFactor <= 0 || !finite(row.totalReturnIndex) || row.totalReturnIndex <= 0 || !Array.isArray(row.evidence) || row.evidence.length !== 3) return invalid("Snapshot observation is invalid.");
      const fields = ["close", "divCash", "splitFactor"] as const;
      const values = [row.close, row.dividend, row.splitFactor];
      for (let k = 0; k < fields.length; k++) {
        const evidence = row.evidence[k];
        if (!exact(evidence, ["field", "rawValue", "runId", "rowHash", "ingestedAt"]) || evidence.field !== fields[k] || typeof evidence.rawValue !== "string" || !evidence.rawValue.trim() || !Number.isFinite(Number(evidence.rawValue)) || !close(Number(evidence.rawValue), values[k]) || typeof evidence.runId !== "string" || !receipts.has(`${asset.id}|${evidence.runId}`) || typeof evidence.rowHash !== "string" || !evidence.rowHash || evidence.rowHash.length > 256 || !timestamp(evidence.ingestedAt) || Date.parse(evidence.ingestedAt) > Date.parse(data.captureCompletedAt)) return invalid("Snapshot source evidence is invalid.");
        usedReceipts.add(`${asset.id}|${evidence.runId}`);
      }
      if (previousClose !== null && previousIndex !== null) {
        const ratio = (row.close + row.dividend) / previousClose * row.splitFactor;
        if (!finite(ratio) || ratio <= 0 || !close(row.totalReturnIndex / previousIndex, ratio)) return invalid("Snapshot total-return calculations do not reconcile.");
        compounded *= ratio;
        returns.push({ date: row.date, value: ratio - 1 });
      }
      if (i === 0) firstIndex = row.totalReturnIndex;
      previousClose = row.close; previousIndex = row.totalReturnIndex;
    }
    const totalChange = previousIndex! / firstIndex - 1;
    if (!Number.isFinite(totalChange) || !Number.isFinite(compounded)) return invalid("Snapshot sample change is invalid.");
    if (Math.abs((compounded - 1) - totalChange) > 1e-8 * Math.max(1, Math.abs(totalChange))) return invalid("Snapshot compounded returns do not reconcile with the retained index.");
    summaries.push({ id: asset.id, totalChange, returns, reference });
  }
  if (usedReceipts.size !== receipts.size) return invalid("Snapshot contains unused receipt fingerprints.");
  return { snapshotId: envelope.snapshotId, asOfDate: data.asOfDate, capturedAt: data.captureCompletedAt, firstDate: data.sessions[0], lastDate: data.sessions.at(-1)!, returnCount: data.sessions.length - 1, assets: summaries };
}
