import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchVixForward } from "./vixForwardClient";
const ok = {
  source: "DB", basis: "spy_price", vix: [["2024-01-02", 13]], price: [["2024-01-02", 100]],
  inputs: { vixSeriesId: "VIXCLS", priceSeriesId: "SPY:close" },
  provenance: { policy: "observed-inputs-only", verifiedAt: "2024-01-03T00:00:00Z", vix: { provider: "Cboe via FRED" }, price: { provider: "Tiingo End-of-Day", kind: "observed close" } },
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
afterEach(() => vi.unstubAllGlobals());
describe("VIXR client accepts only current verified responses", () => {
  test("bypasses cached data and rejects an outage after success", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(reply(ok)).mockRejectedValueOnce(new Error("network unavailable"));
    vi.stubGlobal("fetch", fetch);
    expect((await fetchVixForward("spy_price")).source).toBe("DB");
    await expect(fetchVixForward("spy_price")).rejects.toThrow("network unavailable");
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/market-volatility/vix-forward?basis=spy_price", { cache: "no-store", signal: undefined });
  });
  test.each(["ERR", "SIM", "SNAPSHOT", "LIVE"])("rejects a %s body even if it includes plausible numbers", async (source) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply({ ...ok, source })));
    await expect(fetchVixForward("spy_price")).rejects.toThrow();
  });
  test.each([
    { ...ok, basis: "spy_total" }, { ...ok, provenance: null },
    { ...ok, price: [["2024-01-02", null]] }, { ...ok, vix: [] },
    { ...ok, provenance: { ...ok.provenance, price: { provider: "simulator", kind: "observed close" } } },
  ])("rejects mismatched, unverified or malformed data", async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(body)));
    await expect(fetchVixForward("spy_price")).rejects.toThrow(/verified provider history/);
  });
  test("rejects non-OK HTTP status and invalid JSON without using a past response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(reply(ok, 503)).mockResolvedValueOnce(new Response("<html>broken proxy</html>")));
    await expect(fetchVixForward("spy_price")).rejects.toThrow();
    await expect(fetchVixForward("spy_price")).rejects.toThrow();
  });
});
