import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { catalogResponse, snapshotResponse } from "@/lib/server/presidential/reader";
import { getPipelineCatalog, loadPipelineSelection } from "./bundle";
import { derivePairedComparison } from "./comparison";
import { deriveCycleAnalysis } from "./cycle";
import { DEFAULT_CONFIG } from "./contracts";
import { exportCycleCsv, exportPairedCsv } from "./viewExports";

const env = { ...process.env };
function request(url: string) { const req = new Request(`http://localhost:3000${url}`); Object.defineProperty(req, Symbol.for("market-terminal.peer-address"), { value: "127.0.0.1" }); return req; }
beforeEach(() => {
  process.env.PRES_RESEARCH_LOCAL_ENABLED = "1";
  process.env.PRES_RESEARCH_ROOT = path.resolve("src/lib/server/presidential/fixtures/complete-publication");
  delete process.env.VERCEL; delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  vi.stubGlobal("fetch", vi.fn(async (input: string) => input.endsWith("/catalog") ? catalogResponse(request(input)) : snapshotResponse(request(input), input.split("/").at(-1)!)));
});
afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals(); });
async function selected() { const catalog = await getPipelineCatalog(); return loadPipelineSelection(catalog, "crsp-market-proxy-annual"); }

it("labels paired CSV with sample, sources, exclusions and fixture classification", async () => {
  const selection = await selected(), config = { ...DEFAULT_CONFIG, excludeYears: [1936] };
  const result = derivePairedComparison(selection, config, "inherited");
  const csv = exportPairedCsv(selection, result, "inherited", config);
  expect(csv).toContain("SYNTHETIC_FIXTURE");
  expect(csv).toContain("1936;1937");
  expect(csv).toContain("1935-10-31");
  expect(csv).toContain("1935-11-01");
  expect(csv).toContain("not verified real-time vintages");
  expect(csv).toContain("Excluded");
  expect(csv).toContain(selection.catalog.snapshotId);
});

it("labels cycle CSV with year-end assignment, both series and omitted years", async () => {
  const selection = await selected(), cycle = deriveCycleAnalysis(selection);
  const csv = exportCycleCsv(selection, cycle, "shiller", true);
  expect(csv).toContain("SYNTHETIC_FIXTURE");
  expect(csv).toContain("year-end president");
  expect(csv).toContain("1936");
  expect(csv).toContain("Shiller");
  expect(csv).toContain("inauguration");
  expect(csv).toContain(selection.catalog.snapshotId);
});
