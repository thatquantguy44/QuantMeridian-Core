import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acquireProviderPermit } from "./benchmarkProviderLimiter";

// This opt-in test only writes to a purpose-created, marked disposable database.
const testUrl = process.env.BENCHMARK_LIMIT_TEST_DB_URL;
const nonce = process.env.BENCHMARK_LIMIT_TEST_NONCE;
const requireFromRuntime = createRequire(import.meta.url);
describe.skipIf(!testUrl || !nonce)("shared PostgreSQL limiter integration", () => {
  let client: { connect(): Promise<void>; query(sql: string): Promise<{ rows: Array<{ name: string; token: string }> }>; end(): Promise<void> };
  beforeAll(async () => {
    const pg = requireFromRuntime("pg");
    client = new pg.Client({ connectionString: testUrl, connectionTimeoutMillis: 2500 });
    await client.connect();
    const result = await client.query("SELECT current_database() AS name, token FROM benchmark_limiter_test_identity");
    if (result.rows.length !== 1 || !result.rows[0].name.startsWith("bmrk_limiter_test_") || result.rows[0].token !== nonce) throw new Error("Refusing to write to an unmarked test database.");
  });
  afterAll(async () => { if (client) await client.end(); });
  it("grants one of many independent connections and grants one again after expiry", async () => {
    const first = await Promise.all(Array.from({ length: 16 }, () => acquireProviderPermit(testUrl!)));
    expect(first.filter((x) => x === "acquired")).toHaveLength(1);
    expect(first.filter((x) => x === "limited")).toHaveLength(15);
    await client.query("UPDATE benchmark_provider_control.request_gate SET available_at = clock_timestamp() - interval '1 second'");
    const next = await Promise.all(Array.from({ length: 8 }, () => acquireProviderPermit(testUrl!)));
    expect(next.filter((x) => x === "acquired")).toHaveLength(1);
    expect(next.filter((x) => x === "limited")).toHaveLength(7);
  });
});
