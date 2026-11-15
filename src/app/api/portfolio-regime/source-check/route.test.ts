import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/server/portfolioRegime/multiAssetReader", () => ({ readMultiAssetPreview: mocks.read }));
const call = (query: string) => GET(new Request(`http://local.test/api/portfolio-regime/source-check?${query}`));

describe("PORA source-check route", () => {
  beforeEach(() => { mocks.read.mockReset(); });
  it.each(["", "ids=SPY", "ids=SPY,SPY", "ids=SPY,UNKNOWN", "ids=SPY,AGG,ACWI,BIL,SPY", "ids=SPY,AGG&ids=SPY,AGG", "ids=SPY,AGG&extra=1"])("rejects invalid selection %s without reading the warehouse", async (query) => {
    const response = await call(query); expect(response.status).toBe(400); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("returns a no-store verified response for the selected assets", async () => {
    mocks.read.mockResolvedValue({ source: "DB", assets: [{ id: "SPY" }, { id: "AGG" }] });
    const response = await call("ids=SPY,AGG");
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.read).toHaveBeenCalledWith(["SPY", "AGG"]);
    expect(await response.json()).toMatchObject({ source: "DB" });
  });
  it("hides connection details and returns no data on failed reads", async () => {
    mocks.read.mockRejectedValue(new Error("fixture private connection details"));
    const response = await call("ids=SPY,AGG"); const body = await response.json();
    expect(response.status).toBe(503); expect(body.source).toBe("ERR");
    expect(body.assets).toEqual([]); expect(JSON.stringify(body)).not.toContain("private connection");
  });
});
