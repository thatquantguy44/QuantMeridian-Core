import { cp, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogResponse, snapshotResponse } from "./reader";

const fixture = path.resolve("src/lib/server/presidential/fixtures/publication");
const original = { ...process.env };
let root: string, id: string;
function request(query = "", peer = "127.0.0.1", headers: HeadersInit = {}): Request {
  const req = new Request(`http://localhost:3000/api/presidential/research/catalog${query}`, { headers });
  Object.defineProperty(req, Symbol.for("market-terminal.peer-address"), { value: peer });
  return req;
}
beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "pres-reader-test-"));
  await cp(fixture, root, { recursive: true });
  process.env.PRES_RESEARCH_LOCAL_ENABLED = "1";
  process.env.PRES_RESEARCH_ROOT = root;
  delete process.env.VERCEL;
  delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  id = JSON.parse(await readFile(path.join(root, "gold/current.json"), "utf8")).snapshotId;
});
afterEach(async () => { vi.restoreAllMocks(); process.env = { ...original }; await rm(root, { recursive: true, force: true }); });
async function code(response: Response): Promise<string | undefined> { return (await response.json()).error?.code; }

describe("PR016-R07/N02 private PRES reader", () => {
  it("reads a real Python-produced fixture without exposing filesystem paths", async () => {
    const result = await catalogResponse(request());
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("no-store");
    const body = await result.json();
    expect(body.selection.snapshotId).toBe(id);
    expect(body.selection.catalog.inputKind).toBe("SYNTHETIC_FIXTURE");
    expect(JSON.stringify(body)).not.toContain(root);
    const snapshot = await snapshotResponse(request(), id);
    expect(snapshot.status).toBe(200);
    const selected = await snapshot.json();
    expect(selected.selection.datasets[0].dataset.title).toMatch(/^Fictional fixture/);
    expect(selected.selection.datasets[0].dataset.windows).toHaveLength(1);
  });
  it("reads all five datasets and evidence from one Python-produced generation", async () => {
    const complete = path.resolve("src/lib/server/presidential/fixtures/complete-publication");
    await rm(path.join(root, "gold"), { recursive: true });
    await cp(path.join(complete, "gold"), path.join(root, "gold"), { recursive: true });
    const pointer = JSON.parse(await readFile(path.join(root, "gold/current.json"), "utf8"));
    const catalog = await catalogResponse(request());
    expect(catalog.status).toBe(200);
    const available = await catalog.json();
    expect(available.selection.catalog.datasets).toHaveLength(5);
    expect(available.selection.evidence).toBeUndefined();
    const snapshot = await snapshotResponse(request(), pointer.snapshotId);
    expect(snapshot.status).toBe(200);
    const bundle = (await snapshot.json()).selection;
    expect(bundle.datasets.map((item: {dataset: {windows: unknown[]}}) => item.dataset.windows.length)).toEqual([3, 2, 2, 2, 2]);
    expect(bundle.evidence).toHaveLength(7);
    expect(bundle.catalog.inputKind).toBe("SYNTHETIC_FIXTURE");
    const evidencePath = path.join(root, "gold/snapshots", pointer.snapshotId, "evidence/presidential-cycle-ledger.csv");
    await writeFile(evidencePath, "altered");
    expect(await code(await snapshotResponse(request(), pointer.snapshotId))).toBe("INTEGRITY_FAILURE");
    expect(await code(await catalogResponse(request()))).toBe("INTEGRITY_FAILURE");
    await rm(evidencePath);
    expect(await code(await snapshotResponse(request(), pointer.snapshotId))).toBe("SOURCE_UNAVAILABLE");
  });
  it("rejects spoofed, cross-origin and query requests before reading", async () => {
    expect(await code(await catalogResponse(request("", "192.0.2.8", { "x-forwarded-for": "127.0.0.1" })))).toBe("LOCAL_ONLY");
    expect(await code(await catalogResponse(request("", "127.0.0.1", { origin: "https://evil.example" })))).toBe("LOCAL_ONLY");
    expect(await code(await catalogResponse(request("", "127.0.0.1", { "sec-fetch-site": "cross-site" })))).toBe("LOCAL_ONLY");
    expect(await code(await catalogResponse(request("?path=/etc/passwd")))).toBe("INVALID_REQUEST");
    expect(await code(await snapshotResponse(request(), "../current.json"))).toBe("INVALID_REQUEST");
  });
  it("defaults off and rejects missing configuration", async () => {
    delete process.env.PRES_RESEARCH_LOCAL_ENABLED;
    expect(await code(await catalogResponse(request()))).toBe("LOCAL_NOT_CONFIGURED");
    process.env.PRES_RESEARCH_LOCAL_ENABLED = "1";
    process.env.PRES_RESEARCH_ROOT = "relative";
    expect(await code(await catalogResponse(request()))).toBe("LOCAL_NOT_CONFIGURED");
  });
  it("rejects byte corruption and preserves the requested snapshot if the pointer changes", async () => {
    await writeFile(path.join(root, "gold/current.json"), "{}");
    expect(await code(await catalogResponse(request()))).toBe("INTEGRITY_FAILURE");
    expect((await snapshotResponse(request(), id)).status).toBe(200);
    await writeFile(path.join(root, "gold/snapshots", id, "datasets/crsp-market-proxy-annual.json"), "{}");
    expect(await code(await snapshotResponse(request(), id))).toBe("INTEGRITY_FAILURE");
  });
  it("detects a file changed while an open handle is being read", async () => {
    const originalOpen = fs.open.bind(fs);
    const dataset = path.join(root, "gold/snapshots", id, "datasets/crsp-market-proxy-annual.json");
    vi.spyOn(fs, "open").mockImplementation(async (...args: Parameters<typeof fs.open>) => {
      const handle = await originalOpen(...args);
      if (String(args[0]).endsWith("/datasets/crsp-market-proxy-annual.json")) {
        const originalRead = handle.read.bind(handle);
        vi.spyOn(handle, "read").mockImplementationOnce(async (...readArgs: Parameters<typeof handle.read>) => {
          const result = await originalRead(...readArgs);
          await fs.appendFile(dataset, " ");
          return result;
        });
      }
      return handle;
    });
    expect(await code(await snapshotResponse(request(), id))).toBe("INTEGRITY_FAILURE");
  });
  it("rejects symlinks in a snapshot ancestor and dataset", async () => {
    const datasets = path.join(root, "gold/snapshots", id, "datasets");
    await rm(datasets, { recursive: true });
    await symlink(path.join(fixture, "gold/snapshots", id, "datasets"), datasets);
    expect(await code(await snapshotResponse(request(), id))).toBe("INTEGRITY_FAILURE");
  });
  it("rejects unsupported schema, duplicate pointer keys and oversized inputs", async () => {
    const catalogPath = path.join(root, "gold/snapshots", id, "catalog.json");
    const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
    catalog.schemaVersion = "presidential-research-bundle/999";
    await writeFile(catalogPath, JSON.stringify(catalog));
    expect(await code(await snapshotResponse(request(), id))).toBe("UNSUPPORTED_SCHEMA");
    await writeFile(path.join(root, "gold/current.json"), '{"snapshotId":1,"snapshotId":2}');
    expect(await code(await catalogResponse(request()))).toBe("INTEGRITY_FAILURE");
    await writeFile(path.join(root, "gold/current.json"), "x".repeat(65537));
    expect(await code(await catalogResponse(request()))).toBe("INTEGRITY_FAILURE");
    expect(await code(await snapshotResponse(request(), "f".repeat(64)))).toBe("SOURCE_UNAVAILABLE");
  });
});
