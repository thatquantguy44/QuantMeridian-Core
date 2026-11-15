import { describe, expect, it } from "vitest";
import { normalizeSentMacro, readSentMacro } from "./sentMacro";
import { SENT_MACRO_SERIES } from "@/lib/sentiment/macro";
const at = "2026-10-31T12:00:00.000Z";
function row(overrides: Record<string, unknown> = {}) {
  return { series_id: "VIXCLS", source: "fred", frequency: "d", units: "Index", observation_date: "2026-10-29",
    value: 17, is_missing: "0", ingested_at: "2026-10-30T10:00:00.000000+00:00", ...overrides };
}
describe("SENT macro Gold normalization", () => {
  it("admits actual catalog units and PostgreSQL bigint flags, with explicit observation age", () => {
    const result = normalizeSentMacro([row(), row({ series_id: "DGS10", units: "Percent", value: 4.5 })], at);
    expect(result.series).toHaveLength(7);
    expect(result.series[0]).toMatchObject({ id: "VIXCLS", state: "AVAILABLE", latest: { date: "2026-10-29", value: 17 }, ageCalendarDays: 2 });
    expect(result.series.find(s => s.id === "DGS10")).toMatchObject({ units: "Percent", state: "AVAILABLE" });
    expect(result.series.find(s => s.id === "DGS2")).toMatchObject({ state: "UNAVAILABLE", latest: null });
  });
  it("preserves missing rows, including a numeric value flagged missing, without substituting a prior observation", () => {
    const result = normalizeSentMacro([row({ is_missing: "1", value: 999 }), row({ observation_date: "2026-10-28", value: 16 })], at).series[0];
    expect(result.state).toBe("UNAVAILABLE"); expect(result.latest).toBeNull();
    expect(result.observations.map(o => o.value)).toEqual([16, null]);
    expect(result.reason).toBe("LATEST_MISSING");
  });
  it.each([
    { source: "SIM" }, { frequency: "m" }, { units: "Percent" }, { value: "17" },
    { value: Infinity }, { value: -1 }, { is_missing: null }, { is_missing: "2" },
    { observation_date: "2026-02-30" }, { observation_date: "2026-11-02" },
    { ingested_at: "2026-11-01T00:00:00Z" },
  ])("rejects invalid source/unit/value/date evidence without losing other series: %j", override => {
    const result = normalizeSentMacro([row(override), row({ series_id: "DGS10", units: "Percent", value: 4.5 })], at);
    expect(result.series[0]).toMatchObject({ state: "UNAVAILABLE", latest: null, observations: [] });
    expect(result.series.find(s => s.id === "DGS10")?.state).toBe("AVAILABLE");
  });
  it("rejects duplicated dates/catalog join duplication and more than 252 rows", () => {
    for (const rows of [[row(), row()], Array.from({ length: 253 }, () => row())]) {
      expect(normalizeSentMacro(rows, at).series[0]).toMatchObject({ state: "UNAVAILABLE", reason: "INTEGRITY_FAILURE" });
    }
  });
  it("keeps zero and negative rate values, without rescaling percentage-point units", () => {
    const r = normalizeSentMacro([row({ value: 0 }), row({ series_id: "DGS2", units: "Percent", value: -.1 })], at);
    expect(r.series[0].latest?.value).toBe(0);
    expect(r.series.find(s => s.id === "DGS2")?.latest?.value).toBe(-.1);
  });
  it("isolates a 253-row joined overflow to its series while six complete windows remain available", () => {
    const rows = SENT_MACRO_SERIES.flatMap(s => Array.from({ length: 252 }, (_, i) => {
      const d = new Date("2026-10-29"); d.setUTCDate(d.getUTCDate() - i);
      return row({ series_id: s.id, units: s.units, observation_date: d.toISOString().slice(0, 10) });
    }));
    rows.push(row());
    const result = normalizeSentMacro(rows, at);
    expect(result.series[0].reason).toBe("INTEGRITY_FAILURE");
    expect(result.series.slice(1).every(s => s.state === "AVAILABLE" && s.observations.length === 252)).toBe(true);
  });
  it("uses one bounded parameterized Gold statement with catalog identity and missing flags", async () => {
    const queries: { sql: string; params?: unknown[] }[] = [];
    const result = await readSentMacro({ raw: async <T>(sql: string, params?: unknown[]) => { queries.push({ sql, params }); return [row()] as T[]; } }, () => at);
    expect(result.series[0].state).toBe("AVAILABLE"); expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain("DENSE_RANK()");
    expect(queries[0].sql).toContain("is_missing"); expect(queries[0].sql).toContain("LIMIT 1772");
    expect(queries[0].sql).toContain("joined_rank<=253");
    expect(queries[0].params).toHaveLength(7);
  });
});
