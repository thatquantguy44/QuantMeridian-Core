import { PORA_ASSETS, type MultiAssetPreview, type PoraAsset } from "./multiAssetContracts";
import { validateMultiAssetPreview } from "./multiAssetClient";
import { verifySnapshot, type PoraSnapshot, type SnapshotVerification } from "./snapshot";

export interface SnapshotArtifact { origin: "CAPTURED" | "IMPORTED"; json: string; verification: SnapshotVerification }
export interface CapturedSnapshot extends SnapshotArtifact { origin: "CAPTURED"; preview: MultiAssetPreview }
const MAX_SNAPSHOT_BYTES = 4_100_000;
const MAX_RESPONSE_BYTES = 4_500_000;
const invalid = (): never => { throw new Error("The source comparison does not match the captured snapshot."); };
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));

async function readResponse(response: Response): Promise<unknown> {
  const length = response.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) throw new Error("Snapshot response exceeds the supported size.");
  if (!response.body) throw new Error("Snapshot response is empty.");
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) { void reader.cancel().catch(() => {}); throw new Error("Snapshot response exceeds the supported size."); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new Error("Snapshot response is malformed."); }
}

/** Rechecks source data and ensures the returned comparison uses exactly the frozen inputs. */
export async function captureSnapshot(ids: PoraAsset[], signal?: AbortSignal): Promise<CapturedSnapshot> {
  if (ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length || ids.some((id) => !PORA_ASSETS.includes(id))) throw new Error("Select two to four distinct supported assets.");
  const response = await fetch(`/api/portfolio-regime/snapshot?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store", signal });
  const body = await readResponse(response);
  if (!body || typeof body !== "object") throw new Error("Snapshot response is malformed.");
  const result = body as { preview?: unknown; snapshot?: unknown; error?: unknown };
  if (!response.ok) throw new Error(typeof result.error === "string" && result.error.length <= 300 ? result.error : "Snapshot source check is unavailable.");
  const preview = validateMultiAssetPreview(result.preview, ids);
  const verification = await verifySnapshot(result.snapshot);
  const snapshot = result.snapshot as PoraSnapshot;
  const data = snapshot.content;
  if (data.asOfDate !== preview.asOfDate || data.captureCompletedAt !== preview.checkedAt || data.sessions[0] !== preview.firstDate || data.sessions.at(-1) !== preview.lastDate || data.sessions.length !== preview.sessionCount || data.assetOrder.length !== ids.length || data.assetOrder.some((id, i) => id !== ids[i])) return invalid();
  for (let i = 0; i < preview.assets.length; i++) {
    const asset = preview.assets[i], frozen = data.assets[i];
    if (asset.id !== frozen.id || asset.latestDate !== frozen.latestDate || asset.futureCount !== frozen.futureGoldCount || !close(asset.totalChange, verification.assets[i].totalChange)) return invalid();
    let lastIngested = "";
    for (const row of frozen.observations) for (const evidence of row.evidence) if (!lastIngested || Date.parse(evidence.ingestedAt) > Date.parse(lastIngested)) lastIngested = evidence.ingestedAt;
    if (asset.lastIngestedAt !== lastIngested) return invalid();
    for (let j = 1; j < frozen.observations.length; j++) {
      const row = frozen.observations[j], prior = frozen.observations[j - 1], item = asset.returns[j - 1];
      if (row.date !== item.date || !close(item.value, (row.close + row.dividend) / prior.close * row.splitFactor - 1)) return invalid();
    }
  }
  return { origin: "CAPTURED", json: JSON.stringify(snapshot), verification, preview };
}

/** Imported files are checked locally; their source authenticity is not established. */
export async function importSnapshotFile(file: File): Promise<SnapshotArtifact> {
  if (file.size < 1 || file.size > MAX_SNAPSHOT_BYTES) throw new Error("Snapshot file size is outside the supported limit.");
  let parsed: unknown;
  try { parsed = JSON.parse(await file.text()); } catch { throw new Error("Snapshot file is not valid JSON."); }
  const verification = await verifySnapshot(parsed);
  return { origin: "IMPORTED", json: JSON.stringify(parsed), verification };
}

/** Replayed returns preserve their source-verification status in every exported row. */
export function snapshotReplayCsv(artifact: SnapshotArtifact): string {
  const check = artifact.verification;
  const cell = (value: string | number) => {
    const raw = String(value); const safe = typeof value === "string" && /^[\s\u0000-\u001f]*[=+@\-]/.test(raw) ? `'${raw}` : raw;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const source = artifact.origin === "CAPTURED" ? "RECEIPTS_CHECKED_AT_CAPTURE" : "IMPORTED_ORIGIN_NOT_RECHECKED";
  const rows = [["date", "asset", "total_return_fraction", "snapshot_id", "snapshot_origin", "knowledge_basis", "source_as_of_date", "capture_completed_at"],
    ...check.assets.flatMap((asset) => asset.returns.map((row) => [row.date, asset.id, row.value, check.snapshotId, source, "CURRENT_VINTAGE", check.asOfDate, check.capturedAt]))];
  return rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
