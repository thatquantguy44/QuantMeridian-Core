import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
const mocks = vi.hoisted(() => ({ check: vi.fn(), permit: vi.fn() }));
vi.mock("@/lib/server/benchmarkProviderLatest", () => ({ checkFredLatest: mocks.check }));
vi.mock("@/lib/server/benchmarkProviderLimiter", () => ({ acquireProviderPermit: mocks.permit }));
const savedKey = process.env.FRED_API_KEY;
const savedDb = process.env.BENCHMARK_PROVIDER_LIMIT_DB_URL;
const req = () => new Request("http://local.test/api/benchmark-provider-latest");

describe("FRED provider check route", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-12T16:00:00Z")); mocks.check.mockReset(); mocks.permit.mockReset(); process.env.BENCHMARK_PROVIDER_LIMIT_DB_URL = "postgresql://fixture.invalid/control"; });
  afterEach(() => { vi.useRealTimers(); if (savedKey === undefined) delete process.env.FRED_API_KEY; else process.env.FRED_API_KEY = savedKey; if (savedDb === undefined) delete process.env.BENCHMARK_PROVIDER_LIMIT_DB_URL; else process.env.BENCHMARK_PROVIDER_LIMIT_DB_URL = savedDb; });
  it("reports missing provider configuration without contacting the limiter or FRED", async () => {
    delete process.env.FRED_API_KEY;
    const response = await GET(req()); const body = await response.json();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.series.map((item: { status: string }) => item.status)).toEqual(["not_configured", "not_configured"]);
    expect(mocks.check).not.toHaveBeenCalled(); expect(mocks.permit).not.toHaveBeenCalled();
  });
  it("fails closed when the shared limiter is unavailable", async () => {
    process.env.FRED_API_KEY = "fixture-key"; mocks.permit.mockResolvedValue("unavailable");
    const body = await (await GET(req())).json();
    expect(body.series).toMatchObject([{ status: "limiter_unavailable", checkedAt: null }, { status: "limiter_unavailable", checkedAt: null }]);
    expect(mocks.check).not.toHaveBeenCalled(); expect(JSON.stringify(body)).not.toContain("fixture-key");
  });
  it("fails closed if the limiter unexpectedly throws and can recover on a later attempt", async () => {
    process.env.FRED_API_KEY = "fixture-key";
    mocks.permit.mockRejectedValueOnce(new Error("private DSN")).mockResolvedValueOnce("acquired");
    mocks.check.mockImplementation(async (id: string) => ({ id, status: "checked", checkedAt: new Date().toISOString(), observationDate: "2026-11-10", futureObservationCount: 0, retryAfterSeconds: null }));
    const failed = await (await GET(req())).json();
    expect(failed.series.map((row: { status: string }) => row.status)).toEqual(["limiter_unavailable", "limiter_unavailable"]);
    expect(JSON.stringify(failed)).not.toContain("private DSN");
    expect(mocks.check).not.toHaveBeenCalled();
    const recovered = await (await GET(req())).json();
    expect(recovered.series.map((row: { status: string }) => row.status)).toEqual(["checked", "checked"]);
    expect(mocks.check).toHaveBeenCalledTimes(2);
  });
  it("checks only SOFR and DGS10 after a shared permit and preserves partial failure", async () => {
    process.env.FRED_API_KEY = "fixture-key"; mocks.permit.mockResolvedValueOnce("acquired").mockResolvedValueOnce("limited");
    mocks.check.mockImplementation(async (id: string) => ({ id, status: id === "SOFR" ? "checked" : "unavailable", checkedAt: new Date().toISOString(), observationDate: id === "SOFR" ? "2026-11-10" : null, futureObservationCount: 0, retryAfterSeconds: null }));
    const body = await (await GET(req())).json();
    expect(body).toMatchObject({ source: "FRED", asOfDate: "2026-11-12", asOfTimeZone: "America/New_York" });
    expect(body.series).toMatchObject([{ id: "SOFR", status: "checked" }, { id: "DGS10", status: "unavailable" }]);
    expect(JSON.stringify(body)).not.toContain("fixture-key"); expect(mocks.check).toHaveBeenCalledTimes(2);
    const again = await (await GET(req())).json();
    expect(again.series).toMatchObject([{ status: "rate_limited", retryAfterSeconds: 30 }, { status: "rate_limited", retryAfterSeconds: 30 }]);
    expect(mocks.check).toHaveBeenCalledTimes(2);
  });
});
