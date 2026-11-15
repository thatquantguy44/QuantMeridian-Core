import { afterEach, expect, test } from "vitest";
import { GET } from "./route";

const originalKey = process.env.FRED_API_KEY;
const originalLimiter = process.env.BENCHMARK_PROVIDER_LIMIT_DB_URL;
afterEach(() => {
  if (originalKey === undefined) delete process.env.FRED_API_KEY; else process.env.FRED_API_KEY = originalKey;
  if (originalLimiter === undefined) delete process.env.BENCHMARK_PROVIDER_LIMIT_DB_URL; else process.env.BENCHMARK_PROVIDER_LIMIT_DB_URL = originalLimiter;
});

test("FRED health reports missing limiter and never claims unprobed configuration is live", async () => {
  process.env.FRED_API_KEY = "fixture-key";
  delete process.env.BENCHMARK_PROVIDER_LIMIT_DB_URL;
  const read = async () => (await GET(new Request("http://localhost/api/dataops/health?scope=shell"))).json();
  let body = await read();
  expect(body.providers.FRED).toMatchObject({ status: "ERROR", live: false });
  expect(body.providers.FRED.detail).toContain("limiter is not configured");
  process.env.BENCHMARK_PROVIDER_LIMIT_DB_URL = "postgresql://fixture.invalid/control";
  body = await read();
  expect(body.providers.FRED).toMatchObject({ status: "CACHED", live: false });
  expect(body.providers.FRED.detail).toContain("reachability not probed");
  expect(JSON.stringify(body.providers.FRED)).not.toContain("fixture-key");
  expect(JSON.stringify(body.providers.FRED)).not.toContain("fixture.invalid");
});
