import { describe, expect, it } from "vitest";
import { analyzeDataset } from "./engine";
import { DEFAULT_CONFIG, type ResearchDataset } from "./contracts";
import { canonicalJson, createRunManifest, exportAnalysisCsv, safeCsvCell, withRunInterpretation } from "./exports";

const dataset: ResearchDataset = {
  schemaVersion: 1, id: "export-fixture", title: "Fictional export checks", kind: "ILLUSTRATIVE",
  currency: "USD", returnBasis: "TOTAL_RETURN", nominalReal: "NOMINAL",
  sources: [{ id: "s", title: "Test fixture", locator: null }],
  levels: [{ date: "2000-12-31", value: 100, sourceId: "s" }, { date: "2001-12-31", value: 80, sourceId: "s" }],
  controls: [{ id: "c", startDate: "2000-01-01", endDate: "2003-01-01", presidentId: "p", presidentName: "=TEST()", presidentParty: "D", houseControl: "D", senateControl: "R", sourceId: "s" }],
  windows: [{ id: "w", label: "@fictional, \"window\"", kind: "CALENDAR_YEAR", startDate: "2000-12-31", endDate: "2001-12-31", decisionDate: "2000-12-31", complete: true }],
  fundamentals: [],
};

describe("presidential research exports", () => {
  it("canonicalizes object keys while preserving values and rejecting nonfinite numbers", () => {
    expect(canonicalJson({ z: 2, a: { c: 4, b: 3 } })).toBe('{"a":{"b":3,"c":4},"z":2}');
    expect(() => canonicalJson({ value: Infinity })).toThrow();
  });
  it("protects textual spreadsheet formulas and preserves negative numeric cells", () => {
    expect(safeCsvCell(" =SUM(A1)" )).toContain("' =SUM(A1)");
    expect(safeCsvCell(-0.2)).toBe("-0.2");
    expect(safeCsvCell(null)).toBe("");
    expect(safeCsvCell('a,"b"')).toBe('"a,""b"""');
  });
  it("exports full-precision decimal returns, inclusion status and source definitions", () => {
    const result = analyzeDataset(dataset, DEFAULT_CONFIG);
    const csv = exportAnalysisCsv(dataset, result);
    expect(csv).toContain(String(80 / 100 - 1));
    expect(csv).toContain("ILLUSTRATIVE");
    expect(csv).toContain("TOTAL_RETURN");
    expect(csv).toContain("NOMINAL");
    expect(csv).toContain("actual_start_date");
    expect(csv).toContain("included");
    expect(csv).toContain("'=TEST()");
    expect(csv).not.toContain("NaN");
  });
  it("binds replay data and config to stable content identity, independently of commentary/time", async () => {
    const result = analyzeDataset(dataset, DEFAULT_CONFIG);
    const first = await createRunManifest(dataset, result, "My test interpretation");
    const second = await createRunManifest(dataset, result, "A revised interpretation");
    expect(first.runId).toMatch(/^[a-f0-9]{64}$/);
    expect(first.runId).toBe(second.runId);
    expect(first.interpretationSha256).not.toBe(second.interpretationSha256);
    expect(first.dataset).toEqual(dataset);
    expect(first.codeRevision).toBeNull();
    expect(first.sourceVerification).toBe("NOT_INDEPENDENTLY_VERIFIED");
    expect(first.interpretation.kind).toBe("AUTHOR_OPINION");
  });
  it("changes identity when inputs/config change and rejects an inconsistent result", async () => {
    const result = analyzeDataset(dataset, DEFAULT_CONFIG);
    const first = await createRunManifest(dataset, result, "");
    const config = { ...DEFAULT_CONFIG, excludeYears: [2001] };
    const second = await createRunManifest(dataset, analyzeDataset(dataset, config), "");
    expect(first.runId).not.toBe(second.runId);
    await expect(createRunManifest(dataset, { ...result, includedCount: 999 }, "")).rejects.toThrow();
  });
  it("updates author opinion without recalculating or mutating the numerical receipt", async () => {
    const base = await createRunManifest(dataset, analyzeDataset(dataset, DEFAULT_CONFIG), "");
    const updated = await withRunInterpretation(base, "My view");
    expect(updated.runId).toBe(base.runId);
    expect(updated.analysis).toBe(base.analysis);
    expect(updated.dataset).toBe(base.dataset);
    expect(updated.interpretation.text).toBe("My view");
    expect(updated.interpretationSha256).not.toBe(base.interpretationSha256);
    expect(base.interpretation.text).toBe("");
  });
});
