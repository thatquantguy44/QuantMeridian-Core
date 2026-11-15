import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/server/portfolioRegime/multiAssetReader", () => ({ readMultiAssetSnapshot: mocks.read }));
const call = (query: string) => GET(new Request(`http://local.test/api/portfolio-regime/snapshot?${query}`));
describe("PORA snapshot route", () => {
  beforeEach(() => { mocks.read.mockReset(); });
  it.each(["", "ids=SPY", "ids=SPY,SPY", "ids=SPY,UNKNOWN", "ids=SPY,AGG&extra=1"])("rejects invalid selection %s before reading", async (query) => {
    expect((await call(query)).status).toBe(400); expect(mocks.read).not.toHaveBeenCalled();
  });
  it("returns a no-store snapshot for the selected assets", async () => {
    mocks.read.mockResolvedValue({ preview: { source: "DB" }, snapshot: { snapshotId: "test" } });
    const response = await call("ids=SPY,AGG"); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.read).toHaveBeenCalledWith(["SPY", "AGG"]); expect(await response.json()).toHaveProperty("snapshot");
  });
  it("does not expose connection errors or a partial snapshot", async () => {
    mocks.read.mockRejectedValue(new Error("private connection details"));
    const response = await call("ids=SPY,AGG"); const body = await response.json();
    expect(response.status).toBe(503); expect(body.snapshot).toBeNull(); expect(JSON.stringify(body)).not.toContain("private connection");
  });
});
