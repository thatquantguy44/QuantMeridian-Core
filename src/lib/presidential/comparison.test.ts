import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { catalogResponse, snapshotResponse } from "@/lib/server/presidential/reader";
import { getPipelineCatalog, loadPipelineSelection } from "./bundle";
import { DEFAULT_CONFIG } from "./contracts";
import { derivePairedComparison } from "./comparison";

const original = { ...process.env };
function request(url: string) {
  const req = new Request(`http://localhost:3000${url}`);
  Object.defineProperty(req, Symbol.for("market-terminal.peer-address"), { value: "127.0.0.1" });
  return req;
}
beforeEach(() => {
  process.env.PRES_RESEARCH_LOCAL_ENABLED = "1";
  process.env.PRES_RESEARCH_ROOT = path.resolve("src/lib/server/presidential/fixtures/complete-publication");
  delete process.env.VERCEL; delete process.env.AWS_LAMBDA_FUNCTION_NAME;
  vi.stubGlobal("fetch", vi.fn(async (input: string) => input.endsWith("/catalog")
    ? catalogResponse(request(input)) : snapshotResponse(request(input), input.split("/").at(-1)!)));
});
afterEach(() => { process.env = { ...original }; vi.unstubAllGlobals(); });
async function selected() {
  const catalog = await getPipelineCatalog();
  return loadPipelineSelection(catalog, "crsp-market-proxy-annual");
}

describe("PR016-R09 matched comparison", () => {
  it("reconciles common sample to independently run engine results and evidence", async () => {
    const pair = derivePairedComparison(await selected(), DEFAULT_CONFIG, "common");
    expect(pair.rows.map(row => row.year)).toEqual([1936, 1937]);
    expect(pair.left.includedCount).toBe(2);
    expect(pair.right.includedCount).toBe(2);
    for (const row of pair.rows) expect(row.difference).toBeCloseTo(row.right.value! - row.left.value!, 14);
  });
  it("keeps sensitivity exclusions symmetric and retains their ledger rows", async () => {
    const pair = derivePairedComparison(await selected(), { ...DEFAULT_CONFIG, excludeYears: [1936] }, "common");
    expect(pair.left.includedCount).toBe(1);
    expect(pair.right.includedCount).toBe(1);
    expect(pair.rows[0].left.included).toBe(false);
    expect(pair.rows[0].right.included).toBe(false);
    expect(pair.rows[0].left.reasons.join(" ")).toContain("1936");
  });
  it("verifies inherited field timing and matching source observations", async () => {
    const pair = derivePairedComparison(await selected(), DEFAULT_CONFIG, "inherited");
    expect(pair.rows[0].inherited).toMatchObject({ valuationDate: "1935-10-31", valuationAvailable: "1935-11-30", policyDate: "1935-10-01", policyAvailable: "1935-11-01" });
    expect(pair.rows[0].left.valuation).toBe(20);
    expect(pair.rows[0].right.policyRatePct).toBe(2.5);
  });
  it("rejects unequal windows, mismatched evidence and inherited inputs", async () => {
    const selection = await selected();
    const windows = structuredClone(selection);
    windows.datasets.find(item => item.selectionKey === "shiller-sp-composite-annual")!.dataset.windows.pop();
    expect(() => derivePairedComparison(windows, DEFAULT_CONFIG, "common")).toThrow(/sample|window/i);
    const altered = structuredClone(selection);
    const evidence = altered.evidence.find(item => item.role === "public-series-comparison.json")!;
    const body = JSON.parse(evidence.content); body.annual_rows[0].differenceDecimal += 0.1; evidence.content = JSON.stringify(body);
    expect(() => derivePairedComparison(altered, DEFAULT_CONFIG, "common")).toThrow(/evidence|reconcil/i);
    const inherited = structuredClone(selection);
    inherited.datasets.find(item => item.selectionKey === "shiller-sp-composite-inherited-conditions-annual")!.dataset.fundamentals[0].valuation = 999;
    expect(() => derivePairedComparison(inherited, DEFAULT_CONFIG, "inherited")).toThrow(/fundamental|inherited/i);
  });
});
