import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogResponse, snapshotResponse } from "@/lib/server/presidential/reader";
import { getPipelineCatalog, loadPipelineSelection } from "./bundle";
import { cyclePosition, deriveCycleAnalysis, summarizeCycle, type CycleRow } from "./cycle";

const env = { ...process.env };
function request(url: string) {
  const req = new Request(`http://localhost:3000${url}`);
  Object.defineProperty(req, Symbol.for("market-terminal.peer-address"), { value: "127.0.0.1" });
  return req;
}
beforeEach(() => {
  process.env.PRES_RESEARCH_LOCAL_ENABLED = "1";
  process.env.PRES_RESEARCH_ROOT = path.resolve("src/lib/server/presidential/fixtures/complete-publication");
  delete process.env.VERCEL; delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  vi.stubGlobal("fetch", vi.fn(async (input: string) => input.endsWith("/catalog") ? catalogResponse(request(input)) : snapshotResponse(request(input), input.split("/").at(-1)!)));
});
afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals(); });
async function selected() { const catalog = await getPipelineCatalog(); return loadPipelineSelection(catalog, "crsp-market-proxy-annual"); }

describe("PR016-R10 presidential-cycle reconciliation", () => {
  it("reconstructs the fixture ledger and records the 1936 omission", async () => {
    const cycle = deriveCycleAnalysis(await selected());
    expect(cycle.excludedYears).toEqual([1936]);
    expect(cycle.rows).toHaveLength(1);
    expect(cycle.rows[0]).toMatchObject({ year: 1937, termStartYear: 1937, termCycleYear: 1, inaugurationTransition: true, presidentChangedWithinWindow: false });
    expect(cycle.crsp[0].sampleStandardDeviationDecimal).toBeNull();
  });
  it("assigns all four cycle years and excludes pre-1937 observations", () => {
    expect(cyclePosition(1936)).toBeNull();
    expect([1937, 1938, 1939, 1940, 1941].map(year => cyclePosition(year)?.termCycleYear)).toEqual([1, 2, 3, 4, 1]);
  });
  it("uses earliest year for equal best and worst returns and sample dispersion", () => {
    const base: CycleRow = { year: 1937, termStartYear: 1937, termCycleYear: 1, inaugurationTransition: true, presidentChangedWithinWindow: false, endOfYearPresidentId: "a", endOfYearPresidentName: "Fiction A", endOfYearPresidentParty: "D", crspMarketProxyReturnDecimal: 0.1, shillerSpCompositeApproximationReturnDecimal: 0.2 };
    const summary = summarizeCycle([base, { ...base, year: 1941, termStartYear: 1941, endOfYearPresidentId: "b", endOfYearPresidentName: "Fiction B" }], "crspMarketProxyReturnDecimal");
    expect(summary[0]).toMatchObject({ observations: 2, administrations: 2, sampleStandardDeviationDecimal: 0, best: { year: 1937 }, worst: { year: 1937 } });
  });
  it("rejects changed flags, summaries, missing years and malformed CSV", async () => {
    const data = await selected();
    const altered = structuredClone(data);
    const ledger = altered.evidence.find(item => item.role === "presidential-cycle-ledger.csv")!;
    ledger.content = ledger.content.replace(",True,False,", ",False,False,");
    expect(() => deriveCycleAnalysis(altered)).toThrow(/cycle|flag/i);
    const badSummary = structuredClone(data);
    const summary = badSummary.evidence.find(item => item.role === "presidential-cycle-summary.json")!;
    const json = JSON.parse(summary.content); json.observations = 2; summary.content = JSON.stringify(json);
    expect(() => deriveCycleAnalysis(badSummary)).toThrow(/summary|count/i);
    const missing = structuredClone(data);
    missing.evidence.find(item => item.role === "presidential-cycle-ledger.csv")!.content = ledger.content.split("\n")[0] + "\n";
    expect(() => deriveCycleAnalysis(missing)).toThrow(/cycle|count|sample/i);
    const malformed = structuredClone(data);
    malformed.evidence.find(item => item.role === "presidential-cycle-ledger.csv")!.content = '"bad';
    expect(() => deriveCycleAnalysis(malformed)).toThrow(/CSV|ledger/i);
  });
});
