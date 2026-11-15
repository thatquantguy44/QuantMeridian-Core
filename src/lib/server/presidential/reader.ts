/** Private, fixed-root, immutable PRES snapshot reader. No network or subprocesses. */
import { constants, promises as fs } from "node:fs";
import path from "node:path";
import { canonicalJson } from "@/lib/presidential/exports";
import { canonicalDatasetSha256, parsePipelineDataset, parseStrictJson, sha256Bytes } from "@/lib/presidential/pipelineContract";

const HASH = /^[a-f0-9]{64}$/;
const SEGMENT = /^[a-zA-Z0-9._-]+$/;
const DATASETS = [
  "crsp-market-proxy-annual.json", "crsp-market-proxy-common-sample-annual.json",
  "shiller-sp-composite-annual.json", "crsp-market-proxy-inherited-conditions-annual.json",
  "shiller-sp-composite-inherited-conditions-annual.json",
] as const;
const ARTIFACTS = [
  "public-series-comparison.json", "public-series-comparison.csv", "inherited-conditions-join-audit.json",
  "inherited-conditions-ledger.csv", "presidential-cycle-ledger.csv", "presidential-cycle-summary.json",
  "shiller_total_return_monthly.csv",
] as const;
type Code = "LOCAL_ONLY" | "INVALID_REQUEST" | "LOCAL_NOT_CONFIGURED" | "SOURCE_UNAVAILABLE" | "INTEGRITY_FAILURE" | "UNSUPPORTED_SCHEMA";
class ReadError extends Error { constructor(public code: Code) { super(code); } }
function fail(code: Code): never { throw new ReadError(code); }
function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("INTEGRITY_FAILURE");
  return value as Record<string, any>;
}
function digest(value: unknown): value is string { return typeof value === "string" && HASH.test(value); }
function configuredRoot(): string {
  const root = process.env.PRES_RESEARCH_ROOT;
  if (process.env.PRES_RESEARCH_LOCAL_ENABLED !== "1" || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || !root || !path.isAbsolute(root)) return fail("LOCAL_NOT_CONFIGURED");
  return root;
}
function boundary(request: Request): void {
  const url = new URL(request.url);
  const peer = (request as unknown as Record<symbol, unknown>)[Symbol.for("market-terminal.peer-address")];
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(String(peer)) ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      (origin !== null && origin !== url.origin) || (fetchSite !== null && !["same-origin", "none"].includes(fetchSite))) fail("LOCAL_ONLY");
  if (url.search || url.hash) fail("INVALID_REQUEST");
}

/** Open bounded regular files with no-follow and recheck ancestor identity after reading. */
async function readFile(root: string, names: string[], limit: number): Promise<Uint8Array> {
  if (names.some(name => !SEGMENT.test(name) || name === "." || name === "..")) return fail("INVALID_REQUEST");
  let realRoot: string;
  try { realRoot = await fs.realpath(root); } catch { return fail("SOURCE_UNAVAILABLE"); }
  const dirs: Array<{ path: string; dev: number; ino: number }> = [];
  let current = realRoot;
  try {
    const rootStat = await fs.lstat(current);
    if (!rootStat.isDirectory()) return fail("INTEGRITY_FAILURE");
    dirs.push({ path: current, dev: rootStat.dev, ino: rootStat.ino });
    for (const name of names.slice(0, -1)) {
      current = path.join(current, name);
      const info = await fs.lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) return fail("INTEGRITY_FAILURE");
      dirs.push({ path: current, dev: info.dev, ino: info.ino });
    }
    const filename = path.join(current, names[names.length - 1]);
    const handle = await fs.open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const before = await handle.stat();
      if (!before.isFile() || before.size < 1 || before.size > limit) return fail("INTEGRITY_FAILURE");
      const bytes = Buffer.alloc(before.size + 1);
      let total = 0;
      while (total < bytes.length) {
        const { bytesRead } = await handle.read(bytes, total, bytes.length - total, total);
        if (!bytesRead) break;
        total += bytesRead;
      }
      const after = await handle.stat();
      if (total !== before.size || after.size !== before.size || after.mtimeMs !== before.mtimeMs || after.ino !== before.ino || after.dev !== before.dev) return fail("INTEGRITY_FAILURE");
      const finalFile = await fs.lstat(filename);
      if (!finalFile.isFile() || finalFile.isSymbolicLink() || finalFile.ino !== before.ino || finalFile.dev !== before.dev) return fail("INTEGRITY_FAILURE");
      for (const dir of dirs) {
        const afterDir = await fs.lstat(dir.path);
        if (!afterDir.isDirectory() || afterDir.isSymbolicLink() || afterDir.dev !== dir.dev || afterDir.ino !== dir.ino) return fail("INTEGRITY_FAILURE");
      }
      return bytes.subarray(0, total);
    } finally { await handle.close(); }
  } catch (error) {
    if (error instanceof ReadError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EACCES") return fail("SOURCE_UNAVAILABLE");
    return fail("INTEGRITY_FAILURE");
  }
}
function parse(bytes: Uint8Array): Record<string, any> {
  try { return object(parseStrictJson(bytes)); } catch (error) {
    if (error instanceof ReadError) throw error;
    return fail("INTEGRITY_FAILURE");
  }
}
async function hashCanonical(value: unknown): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(canonicalJson(value)));
}
async function generation(root: string, id: string, expectedCatalog?: string) {
  if (!HASH.test(id)) return fail("INVALID_REQUEST");
  const base = ["gold", "snapshots", id];
  const catalogBytes = await readFile(root, [...base, "catalog.json"], 1024 * 1024);
  const catalogSha256 = await sha256Bytes(catalogBytes);
  if (expectedCatalog && expectedCatalog !== catalogSha256) return fail("INTEGRITY_FAILURE");
  const catalog = parse(catalogBytes);
  if (catalog.schemaVersion !== "presidential-research-bundle/1") return fail("UNSUPPORTED_SCHEMA");
  if (catalog.snapshotId !== id) return fail("INTEGRITY_FAILURE");
  const semantic = object(catalog.semanticInventory);
  if (await hashCanonical(semantic) !== id) return fail("INTEGRITY_FAILURE");
  for (const field of ["profileId", "decisionPolicy", "producer", "inputInventory", "inputKind", "datasets", "artifacts", "sources", "quality", "limitations"]) {
    if (!(field in catalog) || !(field in semantic) || canonicalJson(catalog[field]) !== canonicalJson(semantic[field])) return fail("INTEGRITY_FAILURE");
  }
  if (!Array.isArray(catalog.datasets) || ![1, 5].includes(catalog.datasets.length) || !Array.isArray(catalog.artifacts)) return fail("UNSUPPORTED_SCHEMA");
  const expectedDatasets = catalog.datasets.length === 1 ? DATASETS.slice(0, 1) : [...DATASETS];
  const expectedArtifacts = catalog.datasets.length === 1 ? [] : [...ARTIFACTS];
  if (catalog.artifacts.length !== expectedArtifacts.length || !Array.isArray(catalog.sources) || !["CAPTURED_SOURCE", "SYNTHETIC_FIXTURE"].includes(catalog.inputKind)) return fail("INTEGRITY_FAILURE");
  const sources = new Map<string, unknown>();
  for (const item of catalog.sources) {
    const source = object(item);
    if (typeof source.id !== "string" || sources.has(source.id)) return fail("INTEGRITY_FAILURE");
    sources.set(source.id, source);
  }
  const datasets = [];
  let totalBytes = catalogBytes.byteLength;
  for (let index = 0; index < expectedDatasets.length; index++) {
    const name = expectedDatasets[index], entry = object(catalog.datasets[index]);
    const manifestName = name.replace(/\.json$/, ".manifest.json");
    if (entry.selectionKey !== name.replace(/\.json$/, "") || entry.path !== `datasets/${name}` || entry.manifestPath !== `datasets/${manifestName}` || !digest(entry.sha256) || !digest(entry.manifestSha256) || !digest(entry.canonicalSha256)) return fail("INTEGRITY_FAILURE");
    const datasetBytes = await readFile(root, [...base, "datasets", name], 5 * 1024 * 1024);
    const manifestBytes = await readFile(root, [...base, "datasets", manifestName], 1024 * 1024);
    totalBytes += datasetBytes.byteLength + manifestBytes.byteLength;
    if (entry.bytes !== datasetBytes.byteLength || entry.manifestBytes !== manifestBytes.byteLength || await sha256Bytes(manifestBytes) !== entry.manifestSha256) return fail("INTEGRITY_FAILURE");
    try {
      const dataset = await parsePipelineDataset(datasetBytes, entry.sha256);
      const manifest = parse(manifestBytes);
      if (await canonicalDatasetSha256(dataset) !== entry.canonicalSha256 || dataset.id !== entry.datasetId || dataset.title !== entry.title || dataset.windows.length !== entry.windowCount) return fail("INTEGRITY_FAILURE");
      if (dataset.sources.some(source => !sources.has(source.id) || canonicalJson(source) !== canonicalJson(sources.get(source.id))) || manifest.input_kind !== catalog.inputKind) return fail("INTEGRITY_FAILURE");
      if (catalog.inputKind === "SYNTHETIC_FIXTURE" && (!dataset.title.startsWith("Fictional fixture") || manifest.dataset_kind !== "SYNTHETIC_FIXTURE")) return fail("INTEGRITY_FAILURE");
      const decoder = new TextDecoder("utf-8", { fatal: true });
      datasets.push({ selectionKey: entry.selectionKey, dataset, manifest,
        datasetContent: decoder.decode(datasetBytes), manifestContent: decoder.decode(manifestBytes) });
    } catch (error) {
      if (error instanceof ReadError) throw error;
      return fail("INTEGRITY_FAILURE");
    }
  }
  const evidence = [];
  const validSelections = new Set(datasets.map(item => item.selectionKey));
  for (let index = 0; index < expectedArtifacts.length; index++) {
    const name = expectedArtifacts[index], entry = object(catalog.artifacts[index]);
    if (entry.role !== name || entry.path !== `evidence/${name}` || !digest(entry.sha256) || !Array.isArray(entry.boundSelectionKeys) || entry.boundSelectionKeys.length === 0 || entry.boundSelectionKeys.some((key: unknown) => typeof key !== "string" || !validSelections.has(key))) return fail("INTEGRITY_FAILURE");
    const bytes = await readFile(root, [...base, "evidence", name], 5 * 1024 * 1024);
    totalBytes += bytes.byteLength;
    if (entry.bytes !== bytes.byteLength || await sha256Bytes(bytes) !== entry.sha256) return fail("INTEGRITY_FAILURE");
    let content: string;
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (name.endsWith(".json")) parseStrictJson(bytes);
    } catch { return fail("INTEGRITY_FAILURE"); }
    evidence.push({ role: entry.role, boundSelectionKeys: entry.boundSelectionKeys, content });
  }
  if (totalBytes > 40 * 1024 * 1024) return fail("INTEGRITY_FAILURE");
  const catalogContent = new TextDecoder("utf-8", { fatal: true }).decode(catalogBytes);
  return { snapshotId: id, catalogSha256, catalogContent, catalog, datasets, evidence };
}
function response(value: unknown, status: number): Response {
  const text = JSON.stringify(value);
  if (Buffer.byteLength(text, "utf8") > 40 * 1024 * 1024) throw new ReadError("INTEGRITY_FAILURE");
  return new Response(text, { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
function failure(error: unknown): Response {
  const code: Code = error instanceof ReadError ? error.code : "INTEGRITY_FAILURE";
  const messages: Record<Code, string> = {
    LOCAL_ONLY: "Available only to the local application.", INVALID_REQUEST: "Invalid research request.", LOCAL_NOT_CONFIGURED: "Local research data is not configured.", SOURCE_UNAVAILABLE: "The local research snapshot is unavailable.", INTEGRITY_FAILURE: "The local research snapshot failed integrity checks.", UNSUPPORTED_SCHEMA: "The local research snapshot uses an unsupported schema.",
  };
  return response({ error: { code, message: messages[code] }, selection: null }, code === "LOCAL_ONLY" ? 403 : code === "INVALID_REQUEST" ? 400 : 503);
}
export async function catalogResponse(request: Request): Promise<Response> {
  try {
    boundary(request);
    const root = configuredRoot();
    const pointer = parse(await readFile(root, ["gold", "current.json"], 65536));
    if (Object.keys(pointer).sort().join(",") !== "catalogPath,catalogSha256,schemaVersion,snapshotId" || pointer.schemaVersion !== "presidential-research-pointer/1" || !digest(pointer.snapshotId) || !digest(pointer.catalogSha256) || pointer.catalogPath !== `gold/snapshots/${pointer.snapshotId}/catalog.json`) return fail("INTEGRITY_FAILURE");
    const selection = await generation(root, pointer.snapshotId, pointer.catalogSha256);
    const { datasets: _datasets, evidence: _evidence, ...catalogOnly } = selection;
    return response({ error: null, selection: { ...catalogOnly, receivedAt: new Date().toISOString() } }, 200);
  } catch (error) { return failure(error); }
}
export async function snapshotResponse(request: Request, id: string): Promise<Response> {
  try {
    boundary(request);
    if (!HASH.test(id)) return fail("INVALID_REQUEST");
    const selection = await generation(configuredRoot(), id);
    return response({ error: null, selection: { ...selection, receivedAt: new Date().toISOString() } }, 200);
  } catch (error) { return failure(error); }
}
