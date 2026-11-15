import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { GET as replay } from "../snapshots/[id]/route";
function localRequest(url: string, init?: RequestInit, peer = "127.0.0.1") {
  const request = new Request(url, init);
  Object.defineProperty(request, Symbol.for("market-terminal.peer-address"), { value: peer });
  return request;
}
const stub = vi.hoisted(() => ({ current: vi.fn(), replay: vi.fn(), factory: vi.fn() }));
vi.mock("@/lib/server/fx/service", () => ({ localFxService: stub.factory }));
afterEach(() => vi.resetAllMocks());
describe("FX research HTTP boundary", () => {
  it("rejects source, purpose, date and unknown query overrides before touching the service", async () => {
    for (const query of ["cutoffAt=2020-01-01", "purpose=REPORTING_CONVERSION", "source=fred", "x=1"]) {
      const response = await GET(localRequest(`http://localhost/api/fx/research/snapshot?${query}`));
      expect(response.status).toBe(400); expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(stub.factory).not.toHaveBeenCalled();
  });
  it("rejects remote hosts and cross-origin requests", async () => {
    expect((await GET(new Request("https://example.com/api/fx/research/snapshot"))).status).toBe(403);
    expect((await GET(new Request("http://localhost/api/fx/research/snapshot", { headers: { origin: "https://example.com" } }))).status).toBe(403);
    expect(stub.factory).not.toHaveBeenCalled();
  });
  it("rejects a remote socket despite a forged localhost Host or forwarded address", async () => {
    const request = localRequest("http://localhost/api/fx/research/snapshot", { headers: { "x-forwarded-for": "127.0.0.1" } }, "192.0.2.1");
    expect((await GET(request)).status).toBe(403);
    expect(stub.factory).not.toHaveBeenCalled();
  });
  it("returns explicit four-pair configuration failure with no internal exception details", async () => {
    stub.factory.mockImplementation(() => { throw new Error("LOCAL_NOT_CONFIGURED"); });
    const response = await GET(localRequest("http://localhost/api/fx/research/snapshot"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.pairs).toHaveLength(4); expect(body.snapshot).toBeNull();
    expect(body.pairs.every((p: { referenceLevel?: number }) => p.referenceLevel === undefined)).toBe(true);
  });
  it("forwards a successful capture and represents an unavailable replay explicitly", async () => {
    stub.factory.mockReturnValue(stub); stub.current.mockResolvedValue({ error: null, snapshot: { snapshotId: "test" } });
    expect((await GET(localRequest("http://localhost/api/fx/research/snapshot"))).status).toBe(200);
    const id = `fx-reference-snapshot/1:sha256:${"a".repeat(64)}`;
    stub.replay.mockRejectedValue(new Error("REPLAY_UNAVAILABLE"));
    expect((await replay(localRequest("http://localhost/api/fx/research/snapshots/test"), { params: { id } })).status).toBe(404);
    stub.replay.mockRejectedValue(new Error("INTEGRITY_FAILURE"));
    expect((await replay(localRequest("http://localhost/api/fx/research/snapshots/test"), { params: { id } })).status).toBe(409);
  });
});
