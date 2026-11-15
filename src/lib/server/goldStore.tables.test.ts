import { afterEach, expect, test, vi } from "vitest";
import { bronzeTable, goldTable, silverTable } from "./goldStore";
afterEach(() => vi.unstubAllEnvs());
test.each([
  ["sqlite:./test.db", "", "gold_fred_observation", "silver_fred_observation"],
  ["postgres://localhost/test", "", "gold.fred_observation", "silver.fred_observation"],
  ["", "databricks", "test_catalog.gold.fred_observation", "test_catalog.silver.fred_observation"],
])("resolves Gold and provider-evidence tables for %s %s", (url, backend, gold, silver) => {
  vi.stubEnv("MACRO_DB_URL", url); vi.stubEnv("MACRO_DB_BACKEND", backend); vi.stubEnv("MACRO_CATALOG", "test_catalog");
  expect(goldTable("fred_observation")).toBe(gold); expect(silverTable("fred_observation")).toBe(silver);
  expect(bronzeTable("fred_api_response")).toBe(gold.replace("gold", "bronze").replace("fred_observation", "fred_api_response"));
});
