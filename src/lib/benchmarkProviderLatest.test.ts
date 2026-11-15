import { afterEach, expect, it, vi } from "vitest";
import { fetchProviderLatest } from "./benchmarkProviderLatest";
const now = "2026-11-12T16:00:00.000Z";
const item = (id: "SOFR" | "DGS10") => ({ id, status: "checked", checkedAt: now, observationDate: "2026-11-10", futureObservationCount: 0, retryAfterSeconds: null });
const valid = { source: "FRED", startedAt: now, asOfDate: "2026-11-12", asOfTimeZone: "America/New_York", series: [item("SOFR"), item("DGS10")] };
const response = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
afterEach(() => vi.unstubAllGlobals());
it("accepts a scoped provider-date response without caching", async () => {
  const fetcher = vi.fn().mockResolvedValue(response(valid)); vi.stubGlobal("fetch", fetcher);
  expect(await fetchProviderLatest()).toEqual(valid);
  expect(fetcher).toHaveBeenCalledWith("/api/benchmark-provider-latest", expect.objectContaining({ cache: "no-store" }));
});
it("rejects simulated, future, partial and malformed responses", async () => {
  for (const bad of [
    { ...valid, source: "SIM" }, { ...valid, asOfDate: "2026-11-13" }, { ...valid, series: [item("SOFR")] },
    { ...valid, series: [item("SOFR"), item("SOFR")] },
    { ...valid, series: [{ ...item("SOFR"), observationDate: "2026-11-13" }, item("DGS10")] },
    { ...valid, series: [{ ...item("SOFR"), value: 4.2 }, item("DGS10")] },
    { ...valid, series: [{ ...item("SOFR"), status: "unavailable" }, item("DGS10")] },
    { ...valid, series: [{ ...item("SOFR"), futureObservationCount: -1 }, item("DGS10")] },
  ]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(bad)));
    await expect(fetchProviderLatest()).rejects.toThrow(/malformed/i);
  }
});
