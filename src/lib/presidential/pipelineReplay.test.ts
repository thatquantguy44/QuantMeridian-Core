import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogResponse, snapshotResponse } from "@/lib/server/presidential/reader";
import { getPipelineCatalog, loadPipelineSelection } from "./bundle";
import { DEFAULT_CONFIG } from "./contracts";
import { createRunManifest } from "./exports";
import { analyzeDataset } from "./engine";
import { createPipelineRun, replayPresidentialRun } from "./pipelineReplay";

const env = { ...process.env };
function req(url: string) { const request = new Request(`http://localhost:3000${url}`); Object.defineProperty(request, Symbol.for("market-terminal.peer-address"), { value: "127.0.0.1" }); return request; }
beforeEach(() => {
  process.env.PRES_RESEARCH_LOCAL_ENABLED = "1";
  process.env.PRES_RESEARCH_ROOT = path.resolve("src/lib/server/presidential/fixtures/complete-publication");
  delete process.env.VERCEL; delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  vi.stubGlobal("fetch", vi.fn(async (input: string) => input.endsWith("/catalog") ? catalogResponse(req(input)) : snapshotResponse(req(input), input.split("/").at(-1)!)));
});
afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals(); });
async function selected() { const catalog = await getPipelineCatalog(); return loadPipelineSelection(catalog, "crsp-market-proxy-annual"); }
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

describe("PR016-R11 detached pipeline replay", () => {
  it.each([
    { kind: "standalone" } as const,
    { kind: "paired", sample: "common" } as const,
    { kind: "paired", sample: "inherited" } as const,
    { kind: "cycle", series: "crsp", highlightTransitions: true } as const,
  ])("replays $kind without network or source paths", async view => {
    const selection = await selected();
    const run = await createPipelineRun(selection, view, DEFAULT_CONFIG, "Fixture interpretation");
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("network forbidden"); }));
    const restored = await replayPresidentialRun(encode(run));
    expect(restored.runId).toBe(run.runId);
    expect(restored.analysis).toEqual(run.analysis);
    expect(JSON.stringify(run)).not.toContain(process.env.PRES_RESEARCH_ROOT!);
    expect(run.provenance.inputKind).toBe("SYNTHETIC_FIXTURE");
    expect(run.limitations.join(" ")).toMatch(/fictional/i);
  });
  it("preserves the existing standalone numerical identity", async () => {
    const selection = await selected();
    const oldRun = await createRunManifest(selection.dataset, analyzeDataset(selection.dataset, DEFAULT_CONFIG), "");
    const newRun = await createPipelineRun(selection, { kind: "standalone" }, DEFAULT_CONFIG, "notes");
    expect(newRun.runId).toBe(oldRun.runId);
  });
  it("keeps numeric identity stable across notes and display-only cycle flags", async () => {
    const selection = await selected();
    const first = await createPipelineRun(selection, { kind: "cycle", series: "crsp", highlightTransitions: false }, DEFAULT_CONFIG, "first");
    const second = await createPipelineRun(selection, { kind: "cycle", series: "shiller", highlightTransitions: true }, DEFAULT_CONFIG, "second");
    expect(first.runId).toBe(second.runId);
    expect(first.viewSha256).not.toBe(second.viewSha256);
    expect(first.interpretationSha256).not.toBe(second.interpretationSha256);
  });
  it("rejects changed source bytes, analysis and notes", async () => {
    const run = await createPipelineRun(await selected(), { kind: "paired", sample: "common" }, DEFAULT_CONFIG, "notes");
    const changed = structuredClone(run); changed.snapshot.datasets[0].datasetContent += " ";
    await expect(replayPresidentialRun(encode(changed))).rejects.toThrow();
    const catalog = structuredClone(run); catalog.snapshot.catalog.catalogContent += " ";
    await expect(replayPresidentialRun(encode(catalog))).rejects.toThrow(/catalog bytes/i);
    const evidence = structuredClone(run); evidence.snapshot.evidence[0].content += " ";
    await expect(replayPresidentialRun(encode(evidence))).rejects.toThrow(/evidence failed/i);
    const sidecar = structuredClone(run); sidecar.snapshot.datasets[0].manifestContent += " ";
    await expect(replayPresidentialRun(encode(sidecar))).rejects.toThrow(/source bytes/i);
    const wrong = structuredClone(run); wrong.analysis.rows[0].difference += 1;
    await expect(replayPresidentialRun(encode(wrong))).rejects.toThrow(/reconcil/i);
    const notes = structuredClone(run); notes.interpretation.text = "changed";
    await expect(replayPresidentialRun(encode(notes))).rejects.toThrow(/interpretation/i);
  });
  it("continues to replay existing v1 run exports", async () => {
    const selection = await selected();
    const analysis = analyzeDataset(selection.dataset, DEFAULT_CONFIG);
    const v1 = await createRunManifest(selection.dataset, analysis, "old format", { fictionalFixture: true });
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("network forbidden"); }));
    expect((await replayPresidentialRun(encode(v1))).runId).toBe(v1.runId);
  });
});
