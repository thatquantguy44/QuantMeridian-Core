import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
const stub = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/server/naaim/reader", () => ({ readLocalNaaim: stub.read }));
function request(url = "http://localhost/api/sentiment/naaim", peer: string | null = "127.0.0.1", origin?: string) {
  const req = new Request(url, { headers: origin ? { origin } : {} });
  if (peer) Object.defineProperty(req, Symbol.for("market-terminal.peer-address"), { value: peer });
  return req;
}
afterEach(() => vi.resetAllMocks());
describe("local NAAIM HTTP boundary", () => {
  it("refuses nonlocal peers, hosts, origins, and query overrides before reading", async () => {
    for (const req of [request(undefined, null), request(undefined, "192.0.2.1"), request("http://example.com/api/sentiment/naaim"), request(undefined, undefined, "http://example.com")]) {
      expect((await GET(req)).status).toBe(403);
    }
    expect((await GET(request("http://localhost/api/sentiment/naaim?sim=1"))).status).toBe(400);
    expect(stub.read).not.toHaveBeenCalled();
  });
  it("returns no-store validated data and sanitized failures", async () => {
    stub.read.mockResolvedValue({ selection: { schemaVersion: "naaim-exposure-research/1" }, readStartedAt: "start", readCompletedAt: "complete" });
    const response = await GET(request());
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ error: null, readCompletedAt: "complete" });
    stub.read.mockRejectedValue(new Error("local path /private/secret"));
    const failed = await GET(request()), body = await failed.json();
    expect(body).toMatchObject({ selection: null, error: { code: "SOURCE_UNAVAILABLE" } });
    expect(JSON.stringify(body)).not.toContain("/private/secret");
  });
});
