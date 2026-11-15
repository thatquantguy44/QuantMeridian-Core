import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { GET as replay } from "../histories/[id]/route";
const stub = vi.hoisted(() => ({ current: vi.fn(), replay: vi.fn(), factory: vi.fn() }));
vi.mock("@/lib/server/fx/service", () => ({ localFxHistoryService: stub.factory }));
function request(query = "", peer = "127.0.0.1") {
  const r = new Request(`http://localhost/api/fx/research/history${query}`);
  Object.defineProperty(r, Symbol.for("market-terminal.peer-address"), { value: peer });
  return r;
}
afterEach(() => vi.resetAllMocks());
describe("FX history HTTP boundary", () => {
  it("rejects window/source/date overrides and non-loopback peers before reading", async () => {
    for (const q of ["?window=5", "?cutoffAt=2020-01-01", "?source=fred"]) expect((await GET(request(q))).status).toBe(400);
    expect((await GET(request("", "192.0.2.1"))).status).toBe(403);
    expect(stub.factory).not.toHaveBeenCalled();
  });
  it("returns explicit four-pair unavailability when local admission is disabled", async () => {
    stub.factory.mockImplementation(() => { throw new Error("LOCAL_NOT_CONFIGURED"); });
    const r = await GET(request()), body = await r.json();
    expect(r.status).toBe(503); expect(r.headers.get("cache-control")).toBe("no-store");
    expect(body.history).toBeNull(); expect(body.pairs).toHaveLength(4);
    expect(body.pairs.every((p: { changes: { simplePercent: number | null }[] }) => p.changes.every(c => c.simplePercent === null))).toBe(true);
  });
  it("distinguishes current capture, invalid replay IDs and missing/corrupt historical artifacts", async () => {
    stub.factory.mockReturnValue(stub); stub.current.mockResolvedValue({ error: null, history: { historyId: "test" } });
    expect((await GET(request())).status).toBe(200);
    expect((await replay(request(), { params: { id: "../../other" } })).status).toBe(400);
    const id = `fx-reference-history/1:sha256:${"a".repeat(64)}`;
    stub.replay.mockRejectedValue(new Error("REPLAY_UNAVAILABLE"));
    expect((await replay(request(), { params: { id } })).status).toBe(404);
    stub.replay.mockRejectedValue(new Error("INTEGRITY_FAILURE"));
    expect((await replay(request(), { params: { id } })).status).toBe(409);
  });
});
