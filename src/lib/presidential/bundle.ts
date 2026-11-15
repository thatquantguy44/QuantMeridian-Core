/** Explicit local snapshot selection. No refresh changes the loaded research. */
import type { ResearchDataset } from "./contracts";
import { canonicalJson } from "./exports";
import { canonicalDatasetSha256, parsePipelineDataset, parseStrictJson, sha256Bytes } from "./pipelineContract";

const HASH = /^[a-f0-9]{64}$/;
const MAX_RESPONSE = 40 * 1024 * 1024;
export interface PipelineCatalog {
  snapshotId: string;
  catalogSha256: string;
  catalogContent: string;
  receivedAt: string;
  catalog: {
    schemaVersion: "presidential-research-bundle/1";
    snapshotId: string;
    profileId: string;
    decisionPolicy: string;
    createdAt: string;
    inputKind: "CAPTURED_SOURCE" | "SYNTHETIC_FIXTURE";
    inputInventory: { captureFirstSeenAt: string; reviewAdmittedAt: string; captures?: Array<{ sourceId: string; firstSeenAt: string }> };
    datasets: Array<{ selectionKey: string; title: string; construction: string; firstYear: number; lastYear: number; windowCount: number; datasetId: string; canonicalSha256: string; bytes: number; sha256: string; manifestBytes: number; manifestSha256: string }>;
    limitations: string[];
    [key: string]: unknown;
  };
}
export interface PipelineSelection {
  catalog: PipelineCatalog; dataset: ResearchDataset; selectionKey: string;
  datasets: Array<{ selectionKey: string; dataset: ResearchDataset; manifest: Record<string, unknown>; datasetContent: string; manifestContent: string }>;
  evidence: Array<{ role: string; content: string; boundSelectionKeys: string[] }>;
}
function record(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid local research response.");
  return value as Record<string, any>;
}
async function requestJson(url: string, signal?: AbortSignal): Promise<Record<string, any>> {
  const response = await fetch(url, { method: "GET", cache: "no-store", redirect: "error", signal });
  const limit = Number(response.headers.get("content-length"));
  if (Number.isFinite(limit) && limit > MAX_RESPONSE) throw new Error("Local research response is too large.");
  if (!response.body) throw new Error("Local research response is unavailable.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > MAX_RESPONSE) { await reader.cancel(); throw new Error("Local research response is too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const body = record(parseStrictJson(bytes));
  if (!response.ok) {
    const code = record(body.error).code;
    const messages: Record<string, string> = {
      LOCAL_NOT_CONFIGURED: "Local pipeline data is not configured.",
      LOCAL_ONLY: "Local pipeline data is available only from this computer.",
      SOURCE_UNAVAILABLE: "The local pipeline snapshot is unavailable.",
      INTEGRITY_FAILURE: "The local pipeline snapshot failed integrity checks.",
      UNSUPPORTED_SCHEMA: "The local pipeline snapshot format is not supported.",
      INVALID_REQUEST: "The local pipeline request was rejected.",
    };
    throw new Error(messages[code] ?? "The local pipeline request failed.");
  }
  return record(body.selection);
}
async function catalogSelection(value: unknown): Promise<PipelineCatalog> {
  const selection = record(value), catalog = record(selection.catalog);
  if (typeof selection.snapshotId !== "string" || !HASH.test(selection.snapshotId) || typeof selection.catalogSha256 !== "string" || !HASH.test(selection.catalogSha256) || typeof selection.receivedAt !== "string" || catalog.schemaVersion !== "presidential-research-bundle/1" || catalog.snapshotId !== selection.snapshotId || typeof catalog.profileId !== "string" || typeof catalog.decisionPolicy !== "string" || typeof catalog.createdAt !== "string" || !["SYNTHETIC_FIXTURE", "CAPTURED_SOURCE"].includes(catalog.inputKind) || !Array.isArray(catalog.datasets) || catalog.datasets.length < 1 || catalog.datasets.length > 5 || !Array.isArray(catalog.limitations) || catalog.limitations.some((x: unknown) => typeof x !== "string")) throw new Error("Invalid local research catalog.");
  if (typeof selection.catalogContent !== "string") throw new Error("Catalog bytes are unavailable.");
  const catalogBytes = new TextEncoder().encode(selection.catalogContent);
  if (catalogBytes.length > 1024 * 1024 || await sha256Bytes(catalogBytes) !== selection.catalogSha256 || canonicalJson(parseStrictJson(catalogBytes)) !== canonicalJson(catalog)) throw new Error("Catalog bytes failed verification.");
  const semantic = record(catalog.semanticInventory), input = record(catalog.inputInventory);
  if (typeof input.captureFirstSeenAt !== "string" || typeof input.reviewAdmittedAt !== "string") throw new Error("Invalid local research provenance.");
  if (input.captures !== undefined && (!Array.isArray(input.captures) || input.captures.length > 5 || input.captures.some((item: unknown) => { const capture = record(item); return typeof capture.sourceId !== "string" || typeof capture.firstSeenAt !== "string"; }))) throw new Error("Invalid source capture provenance.");
  for (const key of ["profileId", "decisionPolicy", "producer", "inputInventory", "inputKind", "datasets", "artifacts", "sources", "quality", "limitations"]) {
    if (!(key in semantic) || canonicalJson(catalog[key]) !== canonicalJson(semantic[key])) throw new Error("Local research catalog identity mismatch.");
  }
  if (await sha256Bytes(new TextEncoder().encode(canonicalJson(semantic))) !== selection.snapshotId) throw new Error("Local research catalog identity mismatch.");
  const keys = new Set<string>();
  for (const raw of catalog.datasets) {
    const entry = record(raw);
    if (typeof entry.selectionKey !== "string" || keys.has(entry.selectionKey) || typeof entry.title !== "string" || typeof entry.construction !== "string" || typeof entry.datasetId !== "string" || !HASH.test(entry.canonicalSha256) || !Number.isInteger(entry.firstYear) || !Number.isInteger(entry.lastYear) || !Number.isInteger(entry.windowCount)) throw new Error("Invalid local research selection.");
    keys.add(entry.selectionKey);
  }
  return selection as PipelineCatalog;
}
export async function getPipelineCatalog(signal?: AbortSignal): Promise<PipelineCatalog> {
  return catalogSelection(await requestJson("/api/presidential/research/catalog", signal));
}
export async function loadPipelineSelection(catalog: PipelineCatalog, key: string, signal?: AbortSignal): Promise<PipelineSelection> {
  const selected = catalog.catalog.datasets.find(entry => entry.selectionKey === key);
  if (!selected) throw new Error("The selected dataset is not in this snapshot.");
  const response = await requestJson(`/api/presidential/research/snapshots/${catalog.snapshotId}`, signal);
  const received = await catalogSelection(response);
  if (received.snapshotId !== catalog.snapshotId || received.catalogSha256 !== catalog.catalogSha256 || canonicalJson(received.catalog) !== canonicalJson(catalog.catalog) || !Array.isArray(response.datasets)) throw new Error("The selected snapshot changed or failed verification.");
  return verifyPipelineSelection({ catalog, selectionKey: key, datasets: response.datasets, evidence: response.evidence });
}

/** Verify the embedded snapshot without a server, including exact source bytes. */
export async function verifyPipelineSelection(value: unknown): Promise<PipelineSelection> {
  const candidate = record(value);
  const catalog = await catalogSelection(candidate.catalog);
  const key = candidate.selectionKey;
  if (typeof key !== "string" || !catalog.catalog.datasets.some(entry => entry.selectionKey === key) || !Array.isArray(candidate.datasets) || !Array.isArray(candidate.evidence)) throw new Error("Invalid snapshot selection.");
  if (candidate.datasets.length !== catalog.catalog.datasets.length || !Array.isArray(candidate.evidence)) throw new Error("Snapshot inventory is incomplete.");
  const datasets = await Promise.all(catalog.catalog.datasets.map(async entry => {
    const match = candidate.datasets.filter((item: unknown) => record(item).selectionKey === entry.selectionKey);
    if (match.length !== 1) throw new Error("A selected dataset is unavailable.");
    const item = record(match[0]);
    if (typeof item.datasetContent !== "string" || typeof item.manifestContent !== "string") throw new Error("Snapshot source bytes are unavailable.");
    const datasetBytes = new TextEncoder().encode(item.datasetContent), manifestBytes = new TextEncoder().encode(item.manifestContent);
    if (datasetBytes.length !== entry.bytes || manifestBytes.length !== entry.manifestBytes || await sha256Bytes(datasetBytes) !== entry.sha256 || await sha256Bytes(manifestBytes) !== entry.manifestSha256 || canonicalJson(parseStrictJson(datasetBytes)) !== canonicalJson(item.dataset) || canonicalJson(parseStrictJson(manifestBytes)) !== canonicalJson(item.manifest)) throw new Error("Snapshot source bytes failed verification.");
    const dataset = await parsePipelineDataset(datasetBytes, entry.sha256);
    if (dataset.kind !== "USER_SUPPLIED" || dataset.id !== entry.datasetId || dataset.title !== entry.title || dataset.windows.length !== entry.windowCount || await canonicalDatasetSha256(dataset) !== entry.canonicalSha256) throw new Error("A snapshot dataset failed verification.");
    if (catalog.catalog.inputKind === "SYNTHETIC_FIXTURE" && !dataset.title.startsWith("Fictional fixture")) throw new Error("Fictional fixture labeling is missing.");
    return { selectionKey: entry.selectionKey, dataset, manifest: record(item.manifest), datasetContent: item.datasetContent, manifestContent: item.manifestContent };
  }));
  const artifactInventory = catalog.catalog.artifacts;
  if (!Array.isArray(artifactInventory) || artifactInventory.length !== candidate.evidence.length || artifactInventory.length > 32) throw new Error("Snapshot evidence is incomplete.");
  const evidence = await Promise.all(artifactInventory.map(async (raw: unknown) => {
    const artifact = record(raw);
    const matches = candidate.evidence.filter((item: unknown) => record(item).role === artifact.role);
    if (matches.length !== 1) throw new Error("Snapshot evidence is unavailable.");
    const item = record(matches[0]);
    if (typeof artifact.role !== "string" || typeof item.content !== "string" || !Array.isArray(item.boundSelectionKeys) || canonicalJson(item.boundSelectionKeys) !== canonicalJson(artifact.boundSelectionKeys)) throw new Error("Invalid snapshot evidence.");
    const bytes = new TextEncoder().encode(item.content);
    if (bytes.length !== artifact.bytes || await sha256Bytes(bytes) !== artifact.sha256) throw new Error("Snapshot evidence failed verification.");
    return { role: artifact.role, content: item.content, boundSelectionKeys: item.boundSelectionKeys as string[] };
  }));
  const dataset = datasets.find(item => item.selectionKey === key)?.dataset;
  if (!dataset || (candidate.dataset !== undefined && canonicalJson(candidate.dataset) !== canonicalJson(dataset))) throw new Error("The selected dataset failed verification.");
  return { catalog, dataset, selectionKey: key, datasets, evidence };
}
