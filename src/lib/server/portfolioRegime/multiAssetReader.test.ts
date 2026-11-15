import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readMultiAssetPreview } from "./multiAssetReader";
const previousUrl = process.env.MACRO_DB_URL;
const previousBackend = process.env.MACRO_DB_BACKEND;
const restore = (key: string, value: string | undefined) => { if (value === undefined) delete process.env[key]; else process.env[key] = value; };
const dates = Array.from({ length: 253 }, (_, i) => new Date(Date.UTC(2024, 0, 2 + i)).toISOString().slice(0, 10)).reverse();
beforeEach(() => { process.env.MACRO_DB_URL = "postgresql://fixture.invalid/control"; delete process.env.MACRO_DB_BACKEND; });
afterEach(() => { restore("MACRO_DB_URL", previousUrl); restore("MACRO_DB_BACKEND", previousBackend); });

describe("PORA read-only warehouse capture", () => {
  it("rejects off-calendar records and rolls back without requesting detailed data", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("MAX(observation_date)")) return { rows: [{ ticker: "SPY", latestDate: dates[0], futureCount: 0, invalidDateCount: 0 }, { ticker: "AGG", latestDate: dates[0], futureCount: 0, invalidDateCount: 0 }] };
      if (sql.includes("FROM gold.market_calendar")) return { rows: dates.map((date) => ({ date })) };
      if (sql.includes("UNION ALL SELECT")) return { rows: [{ ticker: "SPY" }] };
      return { rows: [] };
    });
    const connect = vi.fn().mockResolvedValue(undefined), end = vi.fn().mockResolvedValue(undefined);
    const factory = vi.fn().mockReturnValue({ connect, query, end });
    await expect(readMultiAssetPreview(["SPY", "AGG"], factory)).rejects.toThrow(/outside.*calendar/i);
    expect(factory).toHaveBeenCalledWith(expect.objectContaining({ options: "-c default_transaction_read_only=on", statement_timeout: 15000 }));
    expect(query.mock.calls.some(([sql]) => sql === "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql === "ROLLBACK")).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.includes("total_return_index AS index"))).toBe(false);
    expect(end).toHaveBeenCalledOnce();
  });
  it("never creates a client for an invalid asset selection", async () => {
    const factory = vi.fn();
    await expect(readMultiAssetPreview(["SPY", "SPY"], factory)).rejects.toThrow(/distinct/i);
    expect(factory).not.toHaveBeenCalled();
  });
  it("never creates a client without a configured PostgreSQL source", async () => {
    delete process.env.MACRO_DB_URL;
    const factory = vi.fn();
    await expect(readMultiAssetPreview(["SPY", "AGG"], factory)).rejects.toThrow(/not configured/i);
    expect(factory).not.toHaveBeenCalled();
  });
});
