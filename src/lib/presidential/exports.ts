import { METHOD_VERSION, type AnalysisResult, type ResearchDataset } from "./contracts";
import { analyzeDataset } from "./engine";

/** Stable JSON identity; this is not a trusted timestamp or verification receipt. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot export a nonfinite research value.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  throw new Error("Research exports require JSON-compatible values.");
}

async function digest(text: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("Research identity requires Web Crypto in a secure browser context.");
  const bytes = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}

export interface RunManifest {
  schemaVersion: "presidential-run/1";
  runId: string;
  generatedAt: string;
  timestampBasis: "LOCAL_CLOCK_NOT_INDEPENDENT_RECEIPT";
  methodVersion: string;
  codeRevision: null;
  sourceVerification: "NOT_INDEPENDENTLY_VERIFIED";
  replicationDisposition: "INDEPENDENT_RECONSTRUCTION";
  canonicalDatasetSha256: string;
  rawInputSha256: null;
  configSha256: string;
  interpretationSha256: string;
  dataset: ResearchDataset;
  analysis: AnalysisResult;
  interpretation: { kind: "AUTHOR_OPINION"; text: string };
  limitations: string[];
}

/** Amend commentary on an already reconciled receipt; numerical inputs remain unchanged. */
export async function withRunInterpretation(manifest: RunManifest, text: string): Promise<RunManifest> {
  const snapshot = { ...manifest };
  const interpretationSha256 = await digest(text);
  return { ...snapshot, generatedAt: new Date().toISOString(), interpretationSha256,
    interpretation: { kind: "AUTHOR_OPINION", text } };
}

export async function createRunManifest(dataset: ResearchDataset, result: AnalysisResult, interpretation: string, options?: { fictionalFixture?: boolean }): Promise<RunManifest> {
  // Snapshot before awaiting hashes so later UI changes cannot change the receipt's inputs.
  const datasetText = canonicalJson(dataset);
  const snapshot = JSON.parse(datasetText) as ResearchDataset;
  const analysis = JSON.parse(canonicalJson(result)) as AnalysisResult;
  if (canonicalJson(analyzeDataset(snapshot, analysis.config)) !== canonicalJson(analysis)) {
    throw new Error("Research result does not reconcile to this dataset and configuration.");
  }
  const configText = canonicalJson(analysis.config);
  const canonicalDatasetSha256 = await digest(datasetText);
  const configSha256 = await digest(configText);
  const runId = await digest(canonicalJson({ canonicalDatasetSha256, configSha256, methodVersion: METHOD_VERSION }));
  return {
    schemaVersion: "presidential-run/1", runId, generatedAt: new Date().toISOString(),
    timestampBasis: "LOCAL_CLOCK_NOT_INDEPENDENT_RECEIPT", methodVersion: METHOD_VERSION,
    codeRevision: null, sourceVerification: "NOT_INDEPENDENTLY_VERIFIED",
    replicationDisposition: "INDEPENDENT_RECONSTRUCTION", canonicalDatasetSha256,
    rawInputSha256: null, configSha256, interpretationSha256: await digest(interpretation),
    dataset: snapshot, analysis, interpretation: { kind: "AUTHOR_OPINION", text: interpretation },
    limitations: [
      "Descriptive analysis only; no causal attribution, statistical inference or predictive model.",
      "Political assignment is at the supplied decision date, not a verified reconstruction of the seed article's rule.",
      "Availability is supplied metadata, not independently authenticated. Unknown or later fundamental availability is omitted.",
      "The dataset hash covers canonical normalized JSON, not the original upload's bytes.",
      "Code revision is not embedded; preserve the module source and method version for independent replay.",
      ...(snapshot.kind === "ILLUSTRATIVE" || options?.fictionalFixture ? ["Fictional demonstration: not observed political or market evidence."] : []),
    ],
  };
}

/** Preserve numeric signs/precision, but prevent textual cells from becoming formulas. */
export function safeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot export nonfinite CSV values.");
    return String(value);
  }
  let text = String(value);
  if (/^[\s]*[=+\-@]/u.test(text) || /^[\t\r]/u.test(text)) text = `'${text}`;
  return /[",\r\n]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportAnalysisCsv(dataset: ResearchDataset, result: AnalysisResult, options?: { fictionalFixture?: boolean }): string {
  const headers = ["dataset_id", "data_kind", "currency", "return_basis", "nominal_real", "method_version",
    "selected_window_kind", "metric", "political_assignment", "max_endpoint_gap_days", "include_partial", "excluded_years",
    "window_id", "window_kind", "label", "decision_date", "requested_start_date", "requested_end_date", "actual_start_date", "actual_end_date",
    "start_level", "end_level", "start_source_id", "end_source_id", "cumulative_return_decimal", "annualized_return_decimal",
    "selected_return_decimal", "category", "president_party", "house_control", "senate_control", "government_structure", "president_id", "president_name", "mixed_control", "complete", "included", "reasons",
    "valuation", "valuation_definition", "policy_rate_percent", "fundamental_date", "fundamental_source_id"];
  const levels = new Map(dataset.levels.map((level) => [level.date, level]));
  const rows = result.rows.map((row) => [dataset.id, options?.fictionalFixture ? "SYNTHETIC_FIXTURE" : dataset.kind, dataset.currency, dataset.returnBasis, dataset.nominalReal,
    result.methodVersion, result.config.windowKind, result.config.metric, "AT_ORIGIN", result.config.maxEndpointGapDays,
    result.config.includePartial, result.config.excludeYears.join(";"), row.id, row.kind, row.label, row.decisionDate,
    row.startDate, row.endDate, row.actualStartDate, row.actualEndDate, row.startLevel, row.endLevel,
    levels.get(row.actualStartDate ?? "")?.sourceId ?? null, levels.get(row.actualEndDate ?? "")?.sourceId ?? null,
    row.cumulativeReturn, row.annualizedReturn, row.value, row.category, row.presidentParty, row.houseControl, row.senateControl, row.governmentStructure, row.presidentId, row.presidentName,
    row.mixedControl, row.complete, row.included, row.reasons.join("; "), row.valuation, row.valuationDefinition,
    row.policyRatePct, row.fundamentalDate, row.fundamentalSourceId]);
  return [headers, ...rows].map((row) => row.map(safeCsvCell).join(",")).join("\r\n") + "\r\n";
}

export function downloadText(filename: string, text: string, mime = "text/plain;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

const SVG_NS = "http://www.w3.org/2000/svg";
function wrappedLines(value: string, width = 120): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of value.slice(0, 6_000).split(/\s+/u)) {
    if (current && current.length + word.length > width) { lines.push(current); current = ""; }
    if (word.length > width) {
      if (current) { lines.push(current); current = ""; }
      for (let index = 0; index < word.length; index += width) lines.push(word.slice(index, index + width));
    } else current += (current ? " " : "") + word;
  }
  if (current) lines.push(current);
  if (value.length > 6_000) lines.push("Caption shortened; inspect the full run manifest.");
  return lines;
}

function figureDocument(svg: SVGSVGElement, caption: string, watermark: string | null): { xml: string; width: number; height: number } {
  const dimensions = (svg.getAttribute("viewBox") ?? "0 0 1000 420").trim().split(/[ ,]+/u).map(Number);
  const chartWidth = dimensions[2]; const chartHeight = dimensions[3];
  if (!Number.isFinite(chartWidth) || !Number.isFinite(chartHeight) || chartWidth <= 0 || chartHeight <= 0) {
    throw new Error("Figure has invalid dimensions.");
  }
  const lines = wrappedLines(caption);
  const top = watermark ? 50 : 12;
  const width = 1_600;
  const plotHeight = Math.max(300, width * chartHeight / chartWidth);
  const height = Math.ceil(top + plotHeight + 28 + lines.length * 17);
  const outer = document.createElementNS(SVG_NS, "svg");
  outer.setAttribute("xmlns", SVG_NS); outer.setAttribute("width", String(width)); outer.setAttribute("height", String(height));
  outer.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const background = document.createElementNS(SVG_NS, "rect");
  background.setAttribute("width", "100%"); background.setAttribute("height", "100%"); background.setAttribute("fill", "white");
  outer.appendChild(background);
  const copy = svg.cloneNode(true) as SVGSVGElement;
  // Export only the module's vector figure, without executable or remote resources.
  copy.querySelectorAll("script,foreignObject,image,use").forEach((node) => node.remove());
  [copy, ...Array.from(copy.querySelectorAll("*"))].forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      if (/^on/iu.test(attribute.name) || /href$/iu.test(attribute.name)) node.removeAttribute(attribute.name);
    }
  });
  copy.setAttribute("x", "0"); copy.setAttribute("y", String(top));
  copy.setAttribute("width", String(width)); copy.setAttribute("height", String(plotHeight));
  copy.removeAttribute("class"); copy.removeAttribute("style");
  outer.appendChild(copy);
  const addText = (value: string, y: number, size: number, color: string) => {
    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("x", "24"); text.setAttribute("y", String(y)); text.setAttribute("font-size", String(size));
    text.setAttribute("font-family", "Arial, sans-serif"); text.setAttribute("fill", color); text.textContent = value;
    outer.appendChild(text);
  };
  if (watermark) addText(watermark, 31, 21, "#9a3412");
  lines.forEach((line, index) => addText(line, top + plotHeight + 22 + index * 17, 13, "#1f2937"));
  return { xml: new XMLSerializer().serializeToString(outer), width, height };
}

export function exportSvgFigure(svg: SVGSVGElement, filename: string, caption: string, watermark: string | null): void {
  downloadText(filename, figureDocument(svg, caption, watermark).xml, "image/svg+xml;charset=utf-8");
}

export async function exportPngFigure(svg: SVGSVGElement, filename: string, caption: string, watermark: string | null): Promise<void> {
  const figure = figureDocument(svg, caption, watermark);
  const url = URL.createObjectURL(new Blob([figure.xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve(); image.onerror = () => reject(new Error("Could not rasterize the research figure.")); image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = figure.width; canvas.height = figure.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG export is unavailable in this browser.");
    context.drawImage(image, 0, 0, figure.width, figure.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("PNG export failed.")), "image/png"));
    const pngUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = pngUrl; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(pngUrl), 1_000);
  } finally { URL.revokeObjectURL(url); }
}
