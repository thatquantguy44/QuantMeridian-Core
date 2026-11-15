import { afterEach, describe, expect, it, vi } from "vitest";
import { checkFredLatest } from "./benchmarkProviderLatest";

const asOf = "2026-11-12";
const checked = "2026-11-12T16:00:00.000Z";
const observation = (date: string, value: string) => ({ date, value, realtime_start: asOf, realtime_end: asOf });
const payload = (observations: unknown[]) => ({ realtime_start: asOf, realtime_end: asOf, sort_order: "desc", offset: 0, limit: 100, count: observations.length, observations });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("bounded FRED latest-observation check", () => {
  it("reports the latest nonmissing as-of date and discloses future observations", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(checked));
    const fetcher = vi.fn().mockResolvedValue(response(payload([observation("2026-11-13", "4.3"), observation("2026-11-12", "."), observation("2026-11-10", "0")]))) as typeof fetch;
    const result = await checkFredLatest("SOFR", "test-key", asOf, fetcher);
    expect(result).toMatchObject({ id: "SOFR", status: "checked", checkedAt: checked, observationDate: "2026-11-10", futureObservationCount: 1 });
    expect(result).not.toHaveProperty("value");
    const [url, init] = vi.mocked(fetcher).mock.calls[0];
    expect(String(url)).toMatch(/^https:\/\/api\.stlouisfed\.org\/fred\/series\/observations\?/);
    const params = new URL(String(url)).searchParams;
    expect(params.get("series_id")).toBe("SOFR"); expect(params.get("sort_order")).toBe("desc");
    expect(params.get("limit")).toBe("100"); expect(params.get("realtime_start")).toBe(asOf);
    expect(init).toMatchObject({ redirect: "error", cache: "no-store" });
  });
  it("does not attempt a request without a configured key", async () => {
    const fetcher = vi.fn() as typeof fetch;
    expect(await checkFredLatest("DGS10", "", asOf, fetcher)).toMatchObject({ status: "not_configured", checkedAt: null, observationDate: null });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not expose credentials or fabricate a date on connection errors", async () => {
    const result = await checkFredLatest("SOFR", "test-key", asOf, vi.fn().mockRejectedValue(new Error("test-key")) as typeof fetch);
    expect(result).toMatchObject({ status: "unavailable", observationDate: null });
    expect(JSON.stringify(result)).not.toContain("test-key");
  });
  it.each([
    [429, { error_message: "test-key" }, "provider_rate_limited"],
    [423, { error_message: "test-key" }, "provider_locked"],
    [400, { error_code: 400, error_message: "The api_key test-key is not registered." }, "credential_rejected"],
    [400, { error_code: 400, error_message: "Invalid series_id test-key." }, "unavailable"],
    [403, { error_message: "test-key" }, "unavailable"],
  ])("classifies HTTP %i without exposing provider errors", async (code, body, status) => {
    const result = await checkFredLatest("SOFR", "test-key", asOf, vi.fn().mockResolvedValue(response(body, code)) as typeof fetch);
    expect(result).toMatchObject({ status, observationDate: null, futureObservationCount: 0, retryAfterSeconds: null });
    expect(result.checkedAt).not.toBeNull();
    expect(JSON.stringify(result)).not.toContain("test-key");
  });
  it.each([
    payload([observation("2026-02-30", "1")]),
    payload([observation("2026-11-10", "4"), observation("2026-11-11", "4")]),
    payload([observation("2026-11-11", "0x10")]),
    { ...payload([observation("2026-11-11", "4")]), realtime_end: "2026-11-13" },
    { ...payload([observation("2026-11-11", "4")]), count: 20 },
  ])("rejects malformed or incomplete provider responses", async (body) => {
    const result = await checkFredLatest("SOFR", "test-key", asOf, vi.fn().mockResolvedValue(response(body)) as typeof fetch);
    expect(result).toMatchObject({ status: "invalid_response", observationDate: null });
  });
  it("times out a stalled request without exposing an observation", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(checked));
    const fetcher = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      (init as RequestInit).signal!.addEventListener("abort", () => reject(new Error("aborted")));
    })) as typeof fetch;
    const pending = checkFredLatest("SOFR", "test-key", asOf, fetcher);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toMatchObject({ status: "unavailable", observationDate: null });
  });
  it("treats a timed-out response stream as unavailable", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(checked));
    const fetcher = vi.fn((_url, init) => Promise.resolve(new Response(new ReadableStream({
      start(controller) { (init as RequestInit).signal!.addEventListener("abort", () => controller.error(new Error("aborted"))); },
    })))) as typeof fetch;
    const pending = checkFredLatest("SOFR", "test-key", asOf, fetcher);
    await vi.advanceTimersByTimeAsync(8000);
    expect(await pending).toMatchObject({ status: "unavailable", observationDate: null });
  });
  it("rejects an oversized provider body", async () => {
    const huge = new Response("x".repeat(128 * 1024 + 1));
    expect(await checkFredLatest("SOFR", "test-key", asOf, vi.fn().mockResolvedValue(huge) as typeof fetch)).toMatchObject({ status: "invalid_response", observationDate: null });
  });
  it("reports an all-missing bounded response without inventing an observation", async () => {
    const result = await checkFredLatest("DGS10", "test-key", asOf, vi.fn().mockResolvedValue(response(payload([observation("2026-11-12", ".")]))) as typeof fetch);
    expect(result).toMatchObject({ status: "no_observation", observationDate: null });
  });
});
