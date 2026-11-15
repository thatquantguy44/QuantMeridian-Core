import { afterEach, describe, expect, it, vi } from "vitest";
import { aaiiPair } from "@/lib/aaii/testFixtures";
import { readAaiiSelection, localAaiiConfigured, type AaiiClient } from "./reader";

const at = "2026-10-31T12:00:00.000Z";
const admitted = {
  transactionReadOnly: true, canSelectGold: true, roleMatchesApprovedReader: true,
  ownsGold: false, hasGoldWritePrivileges: false, isSuperuser: false,
  canCreateRoles: false, canCreateDatabases: false, canReplicate: false, bypassesRls: false,
  hasUnapprovedRoleMembership: false, hasOtherApplicationRelationPrivileges: false,
  scopeRestricted: true,
};
function client(evidence: unknown = admitted, rows: unknown[] = aaiiPair()) {
  const queries: string[] = [];
  let ended = false;
  const connection: AaiiClient = {
    connect: async () => {},
    query: async (sql) => {
      queries.push(sql);
      return { rows: sql.includes('AS "transactionReadOnly"') ? [evidence] : sql.includes("ORDER BY survey_date") ? rows : [] };
    },
    end: async () => { ended = true; },
  };
  return { connection, queries, ended: () => ended };
}
afterEach(() => vi.unstubAllEnvs());
describe("AAII bounded reader", () => {
  it("derives latest and complete selected history from one bounded read and closes its transaction", async () => {
    const c = client();
    const selection = await readAaiiSelection(c.connection, () => at);
    expect(selection.observations).toHaveLength(2);
    expect(selection.provenance.latestSurveyDate).toBe("2026-10-22");
    expect(selection.provenance.providerPublishedAt).toBeNull();
    expect(c.queries.filter(q => q.includes("ORDER BY survey_date"))).toHaveLength(1);
    expect(c.queries.some(q => q.includes("READ ONLY"))).toBe(true);
    expect(c.queries.at(-1)).toBe("ROLLBACK");
    expect(c.ended()).toBe(true);
  });
  it.each([null, { ...admitted, hasGoldWritePrivileges: true }, { ...admitted, scopeRestricted: false }])("refuses invalid admission before selecting survey data", async evidence => {
    const c = client(evidence);
    await expect(readAaiiSelection(c.connection, () => at)).rejects.toThrow("READER_NOT_ADMITTED");
    expect(c.queries.some(q => q.includes("ORDER BY survey_date"))).toBe(false);
    expect(c.ended()).toBe(true);
  });
  it("rejects malformed or empty Gold without replacing it with examples", async () => {
    for (const rows of [[], [{ ...aaiiPair()[0], bullish: 40 }]]) {
      const c = client(admitted, rows);
      await expect(readAaiiSelection(c.connection, () => at)).rejects.toThrow("INTEGRITY_FAILURE");
      expect(c.ended()).toBe(true);
    }
  });
  it("closes failed connections and never exposes driver error text", async () => {
    const c = client();
    c.connection.connect = async () => { throw new Error("private connection details"); };
    await expect(readAaiiSelection(c.connection, () => at)).rejects.toThrow("SOURCE_UNAVAILABLE");
    expect(c.ended()).toBe(true);
  });
  it("requires explicit local opt-in, the approved reader and exact local target; production is always off", () => {
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("VERCEL", ""); vi.stubEnv("AWS_LAMBDA_FUNCTION_NAME", "");
    vi.stubEnv("AAII_RESEARCH_LOCAL_ENABLED", "1");
    vi.stubEnv("AAII_POSTGRES_EXPECTED_ROLE", "quantmeridian_aaii_reader");
    const url = "postgresql://quantmeridian_aaii_reader:password@127.0.0.1:55438/additional_market_data";
    vi.stubEnv("AAII_POSTGRES_URL", url);
    expect(localAaiiConfigured()).toBe(true);
    for (const bad of [url.replace("127.0.0.1", "example.com"), url + "?host=example.com", url.replace("additional_market_data", "macro_medallion"), url.replace("quantmeridian_aaii_reader", "market_data")]) {
      vi.stubEnv("AAII_POSTGRES_URL", bad); expect(localAaiiConfigured()).toBe(false);
    }
    vi.stubEnv("AAII_POSTGRES_URL", url); vi.stubEnv("NODE_ENV", "production");
    expect(localAaiiConfigured()).toBe(false);
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("AAII_RESEARCH_LOCAL_ENABLED", "0");
    expect(localAaiiConfigured()).toBe(false);
  });
});
