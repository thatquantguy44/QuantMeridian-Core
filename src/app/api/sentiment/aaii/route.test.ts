import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
const stub = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/server/aaii/reader", () => ({ readLocalAaii: stub.read }));
function request(url = "http://localhost/api/sentiment/aaii", peer: string | null = "127.0.0.1", origin?: string) {
  const req = new Request(url, { headers: origin ? { origin } : {} });
  if (peer) Object.defineProperty(req, Symbol.for("market-terminal.peer-address"), { value: peer });
  return req;
}
afterEach(() => vi.resetAllMocks());
describe("local AAII HTTP boundary", () => {
  it("refuses unverified/nonlocal peers, nonlocal hosts, cross-origin requests and query overrides before reading", async () => {
    for (const req of [request(undefined, null), request(undefined, "192.0.2.1"), request("http://example.com/api/sentiment/aaii"), request(undefined, undefined, "http://example.com")]) {
      expect((await GET(req)).status).toBe(403);
    }
    expect((await GET(request("http://localhost/api/sentiment/aaii?sim=1"))).status).toBe(400);
    expect(stub.read).not.toHaveBeenCalled();
  });
  it("returns no-store validated history with separate terminal read clocks", async () => {
    stub.read.mockResolvedValue({ selection: { schemaVersion: "aaii-research/1" }, readStartedAt: "start", readCompletedAt: "complete" });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ readCompletedAt: "complete", error: null });
  });
  it.each(["LOCAL_NOT_CONFIGURED", "READER_NOT_ADMITTED", "INTEGRITY_FAILURE", "private driver secret"])('sanitizes failure %s without SIM or last-known history', async code => {
    stub.read.mockRejectedValue(new Error(code));
    const response = await GET(request()), body = await response.json();
    expect(response.status).toBe(503); expect(body.selection).toBeNull();
    expect(body.error.code).toBe(code === "private driver secret" ? "SOURCE_UNAVAILABLE" : code);
    expect(JSON.stringify(body)).not.toContain("private driver secret");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
