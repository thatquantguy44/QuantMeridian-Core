import { describe, expect, it, vi } from "vitest";
import { acquireProviderPermit } from "./benchmarkProviderLimiter";

const connection = "postgresql://fixture.invalid/test";
function fake(rows: unknown[] = [{ acquired: 1 }], fail = false) {
  return { connect: vi.fn().mockImplementation(async () => { if (fail) throw new Error("secret connection details"); }),
    query: vi.fn().mockResolvedValue({ rows }), end: vi.fn().mockResolvedValue(undefined) };
}
describe("shared FRED request limiter", () => {
  it("fails closed when the dedicated control database is missing", async () => {
    const factory = vi.fn();
    expect(await acquireProviderPermit("", factory)).toEqual("unavailable");
    expect(factory).not.toHaveBeenCalled();
  });
  it("uses an atomic PostgreSQL lease and closes the connection", async () => {
    const client = fake();
    expect(await acquireProviderPermit(connection, () => client)).toEqual("acquired");
    const [sql, params] = client.query.mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT/i); expect(sql).toMatch(/clock_timestamp/i);
    expect(params).toEqual(["fred:benchmark-latest", 30_000]);
    expect(client.end).toHaveBeenCalled();
  });
  it("reports a lease held by another process without calling the provider", async () => {
    const client = fake([]);
    expect(await acquireProviderPermit(connection, () => client)).toEqual("limited");
    expect(client.end).toHaveBeenCalled();
  });
  it("fails closed on database errors without exposing details", async () => {
    const client = fake([], true);
    expect(await acquireProviderPermit(connection, () => client)).toEqual("unavailable");
    expect(client.end).toHaveBeenCalled();
  });
  it("refuses unknown database schemes rather than falling back", async () => {
    const factory = vi.fn();
    expect(await acquireProviderPermit("sqlite:./local.db", factory)).toEqual("unavailable");
    expect(factory).not.toHaveBeenCalled();
  });
});
