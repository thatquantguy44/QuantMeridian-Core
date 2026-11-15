import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";
const stub = vi.hoisted(() => ({ read: vi.fn(), enabled: vi.fn() }));
vi.mock("@/lib/server/sentMacro", () => ({ readSentMacro: stub.read }));
vi.mock("@/lib/server/goldStore", () => ({ goldEnabled: stub.enabled }));
afterEach(() => vi.resetAllMocks());
it("rejects all source/date/SIM overrides before reading", async () => {
  for (const q of ["?sim=1", "?source=other", "?date=2020-01-01"]) expect((await GET(new Request("http://localhost/api/sentiment/macro" + q))).status).toBe(400);
  expect(stub.read).not.toHaveBeenCalled();
});
it("returns seven explicit no-data states on unconfigured or failed connections with sanitized errors", async () => {
  for (const enabled of [false, true]) {
    stub.enabled.mockReturnValue(enabled); stub.read.mockRejectedValue(new Error("private database credentials"));
    const r = await GET(new Request("http://localhost/api/sentiment/macro")); const b = await r.json();
    expect(r.status).toBe(503); expect(r.headers.get("cache-control")).toBe("no-store");
    expect(b.series).toHaveLength(7); expect(b.series.every((s: { latest: unknown }) => s.latest === null)).toBe(true);
    expect(JSON.stringify(b)).not.toContain("private database credentials");
  }
});
it("returns uncached validated macro data", async () => {
  stub.enabled.mockReturnValue(true); stub.read.mockResolvedValue({ schemaVersion: "sent-macro/1", series: [], error: null });
  const r = await GET(new Request("http://localhost/api/sentiment/macro"));
  expect(r.status).toBe(200); expect(r.headers.get("cache-control")).toBe("no-store");
  expect((await r.json()).error).toBeNull();
});
