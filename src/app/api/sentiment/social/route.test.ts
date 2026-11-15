import { afterEach, expect, it, vi } from "vitest";
import { GET } from "./route";
const stub = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/socialProviders", () => ({ fetchLiveSocial: stub }));
afterEach(() => vi.resetAllMocks());
it("rejects SIM/source overrides before calling the real-only provider", async () => {
  expect((await GET(new Request("http://localhost/api/sentiment/social?sim=1"))).status).toBe(400);
  expect(stub).not.toHaveBeenCalled();
});
it("requests real-only observations and never returns a simulated failure payload", async () => {
  stub.mockRejectedValue(new Error("private provider error"));
  const result = await GET(new Request("http://localhost/api/sentiment/social"));
  expect(stub).toHaveBeenCalledWith({ realOnly: true });
  expect(await result.json()).toEqual({ source: "ERR", platforms: [], tickers: [], sectors: [], themes: [], totalPosts: 0 });
  expect(result.headers.get("cache-control")).toBe("no-store");
});
