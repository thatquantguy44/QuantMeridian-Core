/** Detached v1/v2 research replay. No producer, source paths or network needed. */
import { verifyPipelineSelection, type PipelineSelection } from "./bundle";
import { derivePairedComparison, type ComparisonMode } from "./comparison";
import { deriveCycleAnalysis } from "./cycle";
import { METHOD_VERSION, type AnalysisConfig, type ResearchDataset } from "./contracts";
import { analyzeDataset } from "./engine";
import { canonicalJson, createRunManifest } from "./exports";
import { parseStrictJson, sha256Bytes } from "./pipelineContract";
import { parseAnalysisConfig, parseResearchDataset } from "./validation";

export type PipelineView = { kind: "standalone" } | { kind: "paired"; sample: ComparisonMode } | { kind: "cycle"; series: "crsp" | "shiller"; highlightTransitions: boolean };
export interface PipelineRun {
  schemaVersion: "presidential-run/2"; runId: string; generatedAt: string; timestampBasis: "LOCAL_CLOCK_NOT_INDEPENDENT_RECEIPT"; methodVersion: string;
  view: PipelineView; viewSha256: string; config: AnalysisConfig; analysis: any;
  provenance: { inputKind: string; [key: string]: unknown }; provenanceSha256: string;
  snapshot: PipelineSelection; interpretation: { kind: "AUTHOR_OPINION"; text: string };
  interpretationSha256: string; limitations: string[];
}
export interface ReplayResult {
  runId: string; analysis: any; dataset: ResearchDataset; config: AnalysisConfig;
  interpretation: string; snapshot: PipelineSelection | null; view: PipelineView; fictionalFixture: boolean;
}
const MAX_BYTES = 40 * 1024 * 1024;
function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid replay record.");
  return value as Record<string, any>;
}
async function hash(value: unknown): Promise<string> { return sha256Bytes(new TextEncoder().encode(canonicalJson(value))); }
function validateView(value: unknown): PipelineView {
  const view = object(value), keys = Object.keys(view).sort().join(",");
  if (view.kind === "standalone" && keys === "kind") return { kind: "standalone" };
  if (view.kind === "paired" && keys === "kind,sample" && ["common", "inherited"].includes(view.sample)) return { kind: "paired", sample: view.sample };
  if (view.kind === "cycle" && keys === "highlightTransitions,kind,series" && ["crsp", "shiller"].includes(view.series) && typeof view.highlightTransitions === "boolean") return { kind: "cycle", series: view.series, highlightTransitions: view.highlightTransitions };
  throw new Error("Invalid replay view.");
}
function provenance(snapshot: PipelineSelection): PipelineRun["provenance"] {
  const catalog = snapshot.catalog.catalog;
  return { snapshotId: snapshot.catalog.snapshotId, catalogSha256: snapshot.catalog.catalogSha256,
    profileId: catalog.profileId, decisionPolicy: catalog.decisionPolicy, inputKind: catalog.inputKind, selectionKey: snapshot.selectionKey,
    producer: catalog.producer, inputInventory: catalog.inputInventory,
    datasets: catalog.datasets, artifacts: catalog.artifacts, receivedAt: snapshot.catalog.receivedAt,
    sourceVerification: "NOT_INDEPENDENTLY_VERIFIED" };
}
function datasetHash(snapshot: PipelineSelection, key: string): string {
  const entry = snapshot.catalog.catalog.datasets.find(item => item.selectionKey === key);
  if (!entry) throw new Error("Replay dataset is unavailable.");
  return entry.canonicalSha256;
}
async function calculate(snapshot: PipelineSelection, view: PipelineView, config: AnalysisConfig) {
  if (view.kind === "standalone") {
    const analysis = analyzeDataset(snapshot.dataset, config);
    const prior = await createRunManifest(snapshot.dataset, analysis, "", { fictionalFixture: snapshot.catalog.catalog.inputKind === "SYNTHETIC_FIXTURE" });
    return { methodVersion: METHOD_VERSION, runId: prior.runId, analysis };
  }
  if (view.kind === "paired") {
    const pair = derivePairedComparison(snapshot, config, view.sample);
    const keys = view.sample === "common" ? ["crsp-market-proxy-common-sample-annual", "shiller-sp-composite-annual"] : ["crsp-market-proxy-inherited-conditions-annual", "shiller-sp-composite-inherited-conditions-annual"];
    const methodVersion = "presidential-paired/1";
    const runId = await hash({ methodVersion, sample: view.sample, datasetHashes: keys.map(key => datasetHash(snapshot, key)), config });
    return { methodVersion, runId, analysis: { left: pair.left, right: pair.right, rows: pair.rows } };
  }
  const methodVersion = "presidential-cycle/1";
  const runId = await hash({ methodVersion, datasetHashes: [datasetHash(snapshot, "crsp-market-proxy-common-sample-annual"), datasetHash(snapshot, "shiller-sp-composite-annual")] });
  return { methodVersion, runId, analysis: deriveCycleAnalysis(snapshot) };
}
export async function createPipelineRun(selection: PipelineSelection, requestedView: PipelineView, requestedConfig: AnalysisConfig, interpretation: string): Promise<PipelineRun> {
  if (typeof interpretation !== "string" || interpretation.length > 20_000) throw new Error("Invalid interpretation.");
  const snapshot = await verifyPipelineSelection(JSON.parse(canonicalJson(selection)));
  const view = validateView(requestedView), config = parseAnalysisConfig(requestedConfig);
  const calculated = await calculate(snapshot, view, config), source = provenance(snapshot);
  const run: PipelineRun = {
    schemaVersion: "presidential-run/2", ...calculated, generatedAt: new Date().toISOString(), timestampBasis: "LOCAL_CLOCK_NOT_INDEPENDENT_RECEIPT",
    view, viewSha256: await hash(view), config, provenance: source, provenanceSha256: await hash(source), snapshot,
    interpretation: { kind: "AUTHOR_OPINION", text: interpretation },
    interpretationSha256: await sha256Bytes(new TextEncoder().encode(interpretation)),
    limitations: ["Descriptive research; source authenticity and real-time vintages are not independently verified.",
      ...(snapshot.catalog.catalog.inputKind === "SYNTHETIC_FIXTURE" ? ["Fictional demonstration: not observed political or market evidence."] : []),
      "Raw provider captures are not embedded; the selected dataset and evidence bytes are embedded for detached analysis replay.",
      ...(view.kind === "cycle" ? ["Cycle results do not apply standalone analysis or sensitivity configuration."] : [])],
  };
  if (new TextEncoder().encode(JSON.stringify(run)).length > MAX_BYTES) throw new Error("Replay exceeds the export size limit.");
  return run;
}
export async function replayPresidentialRun(bytes: Uint8Array): Promise<ReplayResult> {
  if (!(bytes instanceof Uint8Array) || bytes.length > MAX_BYTES) throw new Error("Replay exceeds the size limit.");
  const run = object(parseStrictJson(bytes));
  const interpretation = object(run.interpretation);
  if (interpretation.kind !== "AUTHOR_OPINION" || typeof interpretation.text !== "string" || interpretation.text.length > 20_000 || await sha256Bytes(new TextEncoder().encode(interpretation.text)) !== run.interpretationSha256) throw new Error("Replay interpretation failed verification.");
  if (run.schemaVersion === "presidential-run/1") {
    const dataset = parseResearchDataset(run.dataset), config = parseAnalysisConfig(object(run.analysis).config);
    const analysis = analyzeDataset(dataset, config);
    const recomputed = await createRunManifest(dataset, analysis, interpretation.text);
    if (run.runId !== recomputed.runId || run.methodVersion !== recomputed.methodVersion || run.canonicalDatasetSha256 !== recomputed.canonicalDatasetSha256 || run.configSha256 !== recomputed.configSha256 || canonicalJson(run.analysis) !== canonicalJson(analysis)) throw new Error("Replay analysis does not reconcile.");
    const fictionalFixture = dataset.kind === "ILLUSTRATIVE" || (Array.isArray(run.limitations) && run.limitations.some((item: unknown) => typeof item === "string" && item.includes("Fictional demonstration")));
    return { runId: run.runId, analysis, dataset, config, interpretation: interpretation.text, snapshot: null, view: { kind: "standalone" }, fictionalFixture };
  }
  if (run.schemaVersion !== "presidential-run/2") throw new Error("Unsupported replay version.");
  if (run.timestampBasis !== "LOCAL_CLOCK_NOT_INDEPENDENT_RECEIPT" || typeof run.generatedAt !== "string" || !Number.isFinite(Date.parse(run.generatedAt)) || new Date(run.generatedAt).toISOString() !== run.generatedAt) throw new Error("Invalid local export time.");
  const recomputed = await createPipelineRun(run.snapshot, validateView(run.view), parseAnalysisConfig(run.config), interpretation.text);
  if (run.runId !== recomputed.runId || run.methodVersion !== recomputed.methodVersion || run.viewSha256 !== recomputed.viewSha256 || run.provenanceSha256 !== recomputed.provenanceSha256 || canonicalJson(run.provenance) !== canonicalJson(recomputed.provenance) || canonicalJson(run.analysis) !== canonicalJson(recomputed.analysis) || canonicalJson(run.limitations) !== canonicalJson(recomputed.limitations)) throw new Error("Replay analysis or provenance does not reconcile.");
  return { runId: recomputed.runId, analysis: recomputed.analysis, dataset: recomputed.snapshot.dataset, config: recomputed.config, interpretation: interpretation.text, snapshot: recomputed.snapshot, view: recomputed.view, fictionalFixture: recomputed.snapshot.catalog.catalog.inputKind === "SYNTHETIC_FIXTURE" };
}
