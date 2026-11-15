import { createRequire } from "node:module";

const requireFromRuntime = createRequire(import.meta.url);
const LIMIT_KEY = "fred:benchmark-latest";
const COOLDOWN_MS = 30_000;
type Permit = "acquired" | "limited" | "unavailable";
interface LimiterClient {
  connect(): Promise<void>;
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
}
type ClientFactory = (connectionString: string) => LimiterClient;

/** A dedicated PostgreSQL table arbitrates one provider check across server instances. */
export async function acquireProviderPermit(connectionString: string, factory?: ClientFactory): Promise<Permit> {
  const url = connectionString.trim();
  if (!/^postgres(?:ql)?:\/\//i.test(url)) return "unavailable";
  let client: LimiterClient | undefined;
  try {
    const create = factory ?? ((value: string) => {
      const pg = requireFromRuntime("pg") as { Client: new (options: object) => LimiterClient };
      return new pg.Client({ connectionString: value, connectionTimeoutMillis: 2500, query_timeout: 2500, statement_timeout: 2500 });
    });
    client = create(url);
    await client.connect();
    // The conflict predicate is evaluated under PostgreSQL's row lock; use the
    // database clock *after* lock acquisition when extending an expired lease.
    const result = await client.query(`INSERT INTO benchmark_provider_control.request_gate AS gate (limiter_key, available_at)
      VALUES ($1, clock_timestamp() + ($2 * interval '1 millisecond'))
      ON CONFLICT (limiter_key) DO UPDATE SET available_at = clock_timestamp() + ($2 * interval '1 millisecond')
      WHERE gate.available_at <= clock_timestamp() RETURNING 1 AS acquired`, [LIMIT_KEY, COOLDOWN_MS]);
    if (result.rows.length === 0) return "limited";
    if (result.rows.length === 1 && (result.rows[0] as { acquired?: unknown })?.acquired === 1) return "acquired";
    return "unavailable";
  } catch {
    // Never log the DSN, driver error, or credential-bearing connection details.
    return "unavailable";
  } finally {
    if (client) await client.end().catch(() => {});
  }
}
