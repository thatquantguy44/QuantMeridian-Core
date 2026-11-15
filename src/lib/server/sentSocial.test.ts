import { afterEach, expect, it, vi } from "vitest";
import { fetchLiveSocial } from "./socialProviders";
vi.mock("@/data/news", () => ({ getSocialIntel: () => { throw new Error("SENT must never invoke SIM enrichment"); } }));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("returns only observed provider rows with no seeded sectors/themes/tickers", async () => {
  vi.stubEnv("REDDIT_USER_AGENT", "fixture"); vi.stubEnv("STOCKTWITS_ENABLED", ""); vi.stubEnv("STOCKTWITS_ACCESS_TOKEN", "");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: { children: [{ data: { title: "$REAL earnings beat" } }] } }))));
  const result = await fetchLiveSocial({ realOnly: true });
  expect(result.source).toBe("Reddit");
  expect(result.intel.tickers.map(t => t.label)).toEqual(["REAL"]);
  expect(result.intel.sectors).toEqual([]);
  expect(result.intel.themes.every(t => t.label === "Earnings Resilience")).toBe(true);
  expect(result.intel.totalPosts).toBeGreaterThan(0);
});
it("does not fabricate neutral StockTwits sentiment or live rows from empty Reddit pages", async () => {
  vi.stubEnv("REDDIT_USER_AGENT", "fixture"); vi.stubEnv("STOCKTWITS_ENABLED", "1"); vi.stubEnv("STOCKTWITS_ACCESS_TOKEN", "");
  const fetcher = vi.fn(async (_url: unknown) => new Response(JSON.stringify({ data: { children: [] } })));
  vi.stubGlobal("fetch", fetcher);
  const result = await fetchLiveSocial({ realOnly: true });
  expect(result.source).toBe("ERR"); expect(result.intel.platforms).toEqual([]); expect(result.intel.tickers).toEqual([]);
  expect(fetcher.mock.calls.every(call => !String(call[0]).includes("stocktwits"))).toBe(true);
});
it("returns no rows when providers have no connection, without any SIM fallback", async () => {
  vi.stubEnv("REDDIT_USER_AGENT", ""); vi.stubEnv("STOCKTWITS_ENABLED", ""); vi.stubEnv("STOCKTWITS_ACCESS_TOKEN", "");
  const result = await fetchLiveSocial({ realOnly: true });
  expect(result.source).toBe("ERR");
  expect(result.intel).toEqual({ tickers: [], sectors: [], themes: [], platforms: [], totalPosts: 0 });
});
