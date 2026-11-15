import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogResponse, snapshotResponse } from "@/lib/server/presidential/reader";
import { getPipelineCatalog, loadPipelineSelection, verifyPipelineSelection } from "./bundle";
import { analyzeDataset } from "./engine";
import { DEFAULT_CONFIG } from "./contracts";
import { createRunManifest, exportAnalysisCsv } from "./exports";

const originalEnv = { ...process.env };
function localRequest(url: string) {
  const request = new Request(`http://localhost:3000${url}`);
  Object.defineProperty(request, Symbol.for("market-terminal.peer-address"), { value: "127.0.0.1" });
  return request;
}
beforeEach(() => {
  process.env.PRES_RESEARCH_LOCAL_ENABLED = "1";
  process.env.PRES_RESEARCH_ROOT = path.resolve("src/lib/server/presidential/fixtures/publication");
  delete process.env.VERCEL; delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  vi.stubGlobal("fetch", vi.fn(async (input: string) => input.endsWith("/catalog")
    ? catalogResponse(localRequest(input)) : snapshotResponse(localRequest(input), input.split("/").at(-1)!)));
});
afterEach(() => { process.env = { ...originalEnv }; vi.unstubAllGlobals(); });

describe("PR016-R08 explicit pipeline selection", () => {
  it("selects and verifies the Python-produced fixture and labels exported results", async () => {
    const catalog = await getPipelineCatalog();
    expect(catalog.catalog.inputKind).toBe("SYNTHETIC_FIXTURE");
    const selected = await loadPipelineSelection(catalog, catalog.catalog.datasets[0].selectionKey);
    const result = analyzeDataset(selected.dataset, DEFAULT_CONFIG);
    expect(result.includedCount).toBe(1);
    expect(exportAnalysisCsv(selected.dataset, result, { fictionalFixture: true })).toContain("SYNTHETIC_FIXTURE");
    const manifest = await createRunManifest(selected.dataset, result, "", { fictionalFixture: true });
    expect(manifest.limitations.join(" ")).toMatch(/fictional/i);
  });
  it("loads each of the five fixture datasets only from the selected immutable bundle", async () => {
    process.env.PRES_RESEARCH_ROOT = path.resolve("src/lib/server/presidential/fixtures/complete-publication");
    const catalog = await getPipelineCatalog();
    expect(catalog.catalog.datasets).toHaveLength(5);
    const counts = [];
    for (const entry of catalog.catalog.datasets) {
      const selected = await loadPipelineSelection(catalog, entry.selectionKey);
      counts.push(selected.dataset.windows.length);
      expect(selected.dataset.title).toMatch(/^Fictional fixture/);
    }
    expect(counts).toEqual([3, 2, 2, 2, 2]);
  });
  it("rejects changed snapshot identities and unavailable selections", async () => {
    const catalog = await getPipelineCatalog();
    await expect(loadPipelineSelection(catalog, "missing")).rejects.toThrow(/not in this snapshot/);
    await expect(loadPipelineSelection({ ...catalog, catalogSha256: "0".repeat(64) }, catalog.catalog.datasets[0].selectionKey)).rejects.toThrow(/changed or failed/);
  });
  it("verifies the complete saved snapshot without a producer or network", async () => {
    process.env.PRES_RESEARCH_ROOT = path.resolve("src/lib/server/presidential/fixtures/complete-publication");
    const catalog = await getPipelineCatalog();
    const selection = await loadPipelineSelection(catalog, catalog.catalog.datasets[0].selectionKey);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("network forbidden"); }));
    expect((await verifyPipelineSelection(selection)).catalog.snapshotId).toBe(catalog.snapshotId);
    const changed = structuredClone(selection); changed.datasets[0].datasetContent += " ";
    await expect(verifyPipelineSelection(changed)).rejects.toThrow(/source bytes/i);
  });
  it("rejects changed evidence in a snapshot response", async () => {
    process.env.PRES_RESEARCH_ROOT = path.resolve("src/lib/server/presidential/fixtures/complete-publication");
    const catalog = await getPipelineCatalog();
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const response = await snapshotResponse(localRequest(input), input.split("/").at(-1)!);
      const body = await response.json();
      body.selection.evidence[0].content += " ";
      return Response.json(body);
    }));
    await expect(loadPipelineSelection(catalog, catalog.catalog.datasets[0].selectionKey)).rejects.toThrow(/evidence failed verification/);
  });
  it("returns the configured error without falling back to a demo", async () => {
    delete process.env.PRES_RESEARCH_LOCAL_ENABLED;
    await expect(getPipelineCatalog()).rejects.toThrow(/not configured/i);
  });
});
