import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type ResearchDataset } from "./contracts";
import { analyzeDataset } from "./engine";
import { parseResearchDataset } from "./validation";
import { illustrativeDataset } from "./fixtures";

function example(): ResearchDataset {
  return {
    schemaVersion: 1, id: "test-fiction", title: "Fictional numerical test", kind: "ILLUSTRATIVE",
    currency: "USD", nominalReal: "NOMINAL", returnBasis: "TOTAL_RETURN",
    sources: [{ id: "fiction", title: "Invented unit-test inputs", locator: null }],
    levels: [
      { date: "1999-12-31", value: 100, sourceId: "fiction" },
      { date: "2000-12-31", value: 110, sourceId: "fiction" },
      { date: "2001-12-31", value: 99, sourceId: "fiction" },
    ],
    controls: [{ id: "c1", startDate: "1999-01-01", endDate: "2003-01-01", presidentId: "fiction-a", presidentName: "Fiction A", presidentParty: "D", houseControl: "R", senateControl: "D", sourceId: "fiction" }],
    windows: [
      { id: "y2000", label: "2000 example", kind: "CALENDAR_YEAR", startDate: "1999-12-31", endDate: "2000-12-31", decisionDate: "1999-12-31", complete: true },
      { id: "y2001", label: "2001 example", kind: "CALENDAR_YEAR", startDate: "2000-12-31", endDate: "2001-12-31", decisionDate: "2000-12-31", complete: true },
    ],
    fundamentals: [{ date: "1999-12-30", availableDate: "1999-12-31", valuation: 20, valuationDefinition: "Fictional trailing earnings ratio", policyRatePct: -0.25, sourceId: "fiction" }],
  };
}

describe("presidential research validation", () => {
  it("accepts an explicit fictional dataset without altering it", () => {
    const data = example();
    expect(parseResearchDataset(data)).toEqual(data);
  });
  it.each(["2000-02-30", "2001-02-29", "2000-1-01", "2000-01-01T00:00:00Z"])("rejects invalid or non-ISO date %s", date => {
    const data = example(); data.levels[0].date = date;
    expect(() => parseResearchDataset(data)).toThrow(/levels.*date/i);
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -1, null, "100"])("rejects invalid index level %s rather than coercing it", value => {
    const data = example(); (data.levels[0] as unknown as { value: unknown }).value = value;
    expect(() => parseResearchDataset(data)).toThrow(/levels.*positive|levels.*finite/i);
  });
  it("rejects unknown source references and duplicate observation dates", () => {
    const data = example(); data.levels[0].sourceId = "missing";
    expect(() => parseResearchDataset(data)).toThrow(/unknown source/i);
    data.levels[0].sourceId = "fiction"; data.levels.push({ ...data.levels[0] });
    expect(() => parseResearchDataset(data)).toThrow(/duplicate.*date/i);
  });
  it("rejects overlapping controls but allows exactly adjacent half-open intervals", () => {
    const data = example();
    data.controls[0].endDate = "2000-01-01";
    data.controls.push({ ...data.controls[0], id: "c2", startDate: "2000-01-01", endDate: "2003-01-01" });
    expect(() => parseResearchDataset(data)).not.toThrow();
    data.controls[1].startDate = "1999-12-31";
    expect(() => parseResearchDataset(data)).toThrow(/overlap/i);
  });
  it("rejects duplicate window identities and duplicate kind/date windows", () => {
    const data = example(); data.windows.push({ ...data.windows[0], id: "same-dates" });
    expect(() => parseResearchDataset(data)).toThrow(/duplicate.*window|duplicate.*dates/i);
  });
  it("requires a complete annual window to span previous Dec31 through Dec31", () => {
    const data = example(); data.windows[0].startDate = "2000-01-01";
    expect(() => parseResearchDataset(data)).toThrow(/calendar.year|Dec|12-31/i);
  });
  it("rejects an after-start decision date and mixed valuation definitions", () => {
    const data = example(); data.windows[0].decisionDate = "2000-01-01";
    expect(() => parseResearchDataset(data)).toThrow(/decision/i);
    data.windows[0].decisionDate = "1999-12-31";
    data.fundamentals.push({ ...data.fundamentals[0], date: "2000-12-30", availableDate: "2000-12-31", valuationDefinition: "Fictional CAPE" });
    expect(() => parseResearchDataset(data)).toThrow(/valuation.*definition/i);
  });
  it("does not accept nonfinite fundamentals or invalid enumerations", () => {
    const data = example(); data.fundamentals[0].policyRatePct = Number.NaN;
    expect(() => parseResearchDataset(data)).toThrow(/policyRatePct/i);
    data.fundamentals[0].policyRatePct = 0;
    (data as unknown as { returnBasis: string }).returnBasis = "ADJUSTED_OR_OTHER";
    expect(() => parseResearchDataset(data)).toThrow(/returnBasis/i);
  });
  it.each([-4, 0])("preserves finite valuation ratio %s under its explicit supplied definition", valuation => {
    const data = example(); data.fundamentals[0].valuation = valuation;
    expect(parseResearchDataset(data).fundamentals[0].valuation).toBe(valuation);
    expect(analyzeDataset(data, DEFAULT_CONFIG).rows[0].valuation).toBe(valuation);
  });
  it("requires an explicit nominal basis and does not pretend to implement real returns", () => {
    const data = example();
    (data as unknown as { nominalReal: string }).nominalReal = "REAL";
    expect(() => parseResearchDataset(data)).toThrow(/nominalReal.*NOMINAL/i);
    delete (data as unknown as { nominalReal?: string }).nominalReal;
    expect(() => parseResearchDataset(data)).toThrow(/nominalReal/i);
  });
});

describe("presidential research engine", () => {
  it("calculates independent +10%, -10% examples and counts administrations rather than years", () => {
    const result = analyzeDataset(example(), DEFAULT_CONFIG);
    expect(result.rows.map(r => r.cumulativeReturn)).toEqual([0.10000000000000009, -0.09999999999999998]);
    expect(result.includedCount).toBe(2);
    expect(result.groups[0]).toMatchObject({ category: "D president · Split Congress", count: 2, administrationCount: 1, min: -0.09999999999999998, max: 0.10000000000000009 });
    expect(result.groups[0].mean).toBeCloseTo(0, 14);
    expect(result.groups[0].median).toBeCloseTo(0, 14);
    expect(result.warnings.join(" ")).toMatch(/causal/i);
  });
  it("reports descriptive political breakdowns and deterministic administration-cluster intervals", () => {
    const first = analyzeDataset(illustrativeDataset, { ...DEFAULT_CONFIG, grouping: "PRESIDENT_PARTY" });
    const second = analyzeDataset(illustrativeDataset, { ...DEFAULT_CONFIG, grouping: "PRESIDENT_PARTY" });
    expect(first.groups).toEqual(first.breakdowns.PRESIDENT_PARTY);
    expect(first.breakdowns.HOUSE_CONTROL.map(group => group.category)).toEqual(expect.arrayContaining(["D House", "R House"]));
    expect(first.breakdowns.SENATE_CONTROL.map(group => group.category)).toEqual(expect.arrayContaining(["D Senate", "R Senate"]));
    expect(first.breakdowns.GOVERNMENT_STRUCTURE.map(group => group.category)).toEqual(expect.arrayContaining(["Unified D government", "Unified R government", "Divided government"]));
    const democratic = first.groups.find(group => group.category === "D president");
    expect(democratic).toMatchObject({ count: 8, administrationCount: 2, interval: { method: "ADMINISTRATION_CLUSTER_RESAMPLE", level: 0.95, resamples: 2000, clusterCount: 2, unavailableReason: null } });
    expect(democratic?.interval.lower).not.toBeNull();
    expect(democratic?.interval.upper).not.toBeNull();
    expect(first).toEqual(second);
    expect(first.warnings.join(" ")).toMatch(/cluster-resampling|not causal/i);
  });
  it("uses actual elapsed days, including leap years, for CAGR while retaining cumulative return", () => {
    const result = analyzeDataset(example(), { ...DEFAULT_CONFIG, metric: "ANNUALIZED" });
    const row = result.rows[0];
    expect(row.cumulativeReturn).toBeCloseTo(0.1, 14);
    expect(row.annualizedReturn).toBeCloseTo(Math.pow(1.1, 365.2425 / 366) - 1, 14);
    expect(row.value).toBe(row.annualizedReturn);
  });
  it.each([3, 4])("keeps averages and medians finite for %i returns near the floating-point limit", count => {
    const data = example();
    data.levels = [];
    data.windows = [2000, 2002, 2004, 2006].slice(0, count).map(year => {
      data.levels.push({ date: `${year - 1}-12-31`, value: 1, sourceId: "fiction" }, { date: `${year}-12-31`, value: Number.MAX_VALUE, sourceId: "fiction" });
      return { id: `extreme-${year}`, label: `Extreme scale ${year}`, kind: "CALENDAR_YEAR", startDate: `${year - 1}-12-31`, endDate: `${year}-12-31`, decisionDate: `${year - 1}-12-31`, complete: true };
    });
    data.controls[0].endDate = "2008-01-01";
    const result = analyzeDataset(data, DEFAULT_CONFIG);
    expect(result.includedCount).toBe(count);
    expect(result.groups[0].mean).toBe(Number.MAX_VALUE);
    expect(Number.isFinite(result.groups[0].median)).toBe(true);
  });
  it("retains endpoints but excludes a numerically overflowing return instead of reporting zero", () => {
    const data = example();
    data.windows = [data.windows[0]];
    data.levels[0].value = 1e-308;
    data.levels[1].value = 1e308;
    const row = analyzeDataset(data, DEFAULT_CONFIG).rows[0];
    expect(row).toMatchObject({ included: false, startLevel: 1e-308, endLevel: 1e308, cumulativeReturn: null, annualizedReturn: null, value: null });
    expect(row.reasons.join(" ")).toMatch(/nonfinite/i);
  });
  it("keeps a missing previous-year baseline excluded in the ledger", () => {
    const data = example(); data.levels.shift();
    const result = analyzeDataset(data, DEFAULT_CONFIG);
    expect(result.rows[0]).toMatchObject({ included: false, actualStartDate: null, cumulativeReturn: null, value: null });
    expect(result.rows[0].reasons.join(" ")).toMatch(/start.*endpoint|start.*observation/i);
    expect(result.rows).toHaveLength(2);
  });
  it("takes only the latest observation at or before an endpoint within the exact permitted gap", () => {
    const data = example(); data.levels[0].date = "1999-12-30";
    expect(analyzeDataset(data, DEFAULT_CONFIG).rows[0].included).toBe(false);
    const row = analyzeDataset(data, { ...DEFAULT_CONFIG, maxEndpointGapDays: 1 }).rows[0];
    expect(row).toMatchObject({ included: true, actualStartDate: "1999-12-30", startLevel: 100 });
    expect(row.annualizedReturn).toBeCloseTo(Math.pow(1.1, 365.2425 / 367) - 1, 14);
  });
  it("does not use a later observation or reuse the same date for both endpoints", () => {
    const data = example(); data.levels = [{ date: "2000-01-01", value: 100, sourceId: "fiction" }];
    const result = analyzeDataset(data, { ...DEFAULT_CONFIG, maxEndpointGapDays: 31 });
    expect(result.rows[0].included).toBe(false);
    expect(result.rows[1].included).toBe(false);
    data.levels = [{ date: "1999-12-31", value: 100, sourceId: "fiction" }];
    data.windows = [{ ...data.windows[0], kind: "PRESIDENTIAL_PERIOD", endDate: "2000-01-03", complete: false }];
    const sameDate = analyzeDataset(data, { ...DEFAULT_CONFIG, windowKind: "PRESIDENTIAL_PERIOD", includePartial: true, maxEndpointGapDays: 31 }).rows[0];
    expect(sameDate.included).toBe(false);
    expect(sameDate.reasons.join(" ")).toMatch(/positive.length/i);
  });
  it("assigns the at-decision half-open control and flags later control changes", () => {
    const data = example(); data.controls[0].endDate = "1999-12-31";
    data.controls.push({ ...data.controls[0], id: "c2", startDate: "1999-12-31", endDate: "2000-06-01", presidentParty: "R", houseControl: "R", senateControl: "R" });
    data.controls.push({ ...data.controls[1], id: "c3", startDate: "2000-06-01", endDate: "2003-01-01", senateControl: "D" });
    const row = analyzeDataset(data, DEFAULT_CONFIG).rows[0];
    expect(row.category).toBe("R president · R Congress");
    expect(row.mixedControl).toBe(true);
  });
  it.each(["UNKNOWN", "TIED", "OTHER"] as const)("does not treat %s chamber control as split", control => {
    const data = example(); data.controls[0].senateControl = control;
    const row = analyzeDataset(data, DEFAULT_CONFIG).rows[0];
    expect(row.category).toBe("UNCLASSIFIED");
    expect(row.included).toBe(true);
    expect(row.reasons.join(" ")).toMatch(/control/i);
  });
  it("keeps missing control unclassified and audits an interior coverage gap", () => {
    const data = example(); data.controls[0].startDate = "2000-02-01";
    const row = analyzeDataset(data, DEFAULT_CONFIG).rows[0];
    expect(row.category).toBe("UNCLASSIFIED");
    expect(row.reasons.join(" ")).toMatch(/gap|coverage|decision/i);
  });
  it("audits interior unknown control without inventing an actual control change", () => {
    const data = example();
    data.controls[0].houseControl = "D";
    data.controls[0].endDate = "2000-06-01";
    data.controls.push({ ...data.controls[0], id: "unknown-middle", startDate: "2000-06-01", endDate: "2000-09-01", houseControl: "UNKNOWN" });
    data.controls.push({ ...data.controls[0], id: "known-again", startDate: "2000-09-01", endDate: "2003-01-01" });
    const row = analyzeDataset(data, DEFAULT_CONFIG).rows[0];
    expect(row.category).toBe("D president · D Congress");
    expect(row.mixedControl).toBe(false);
    expect(row.reasons.join(" ")).toMatch(/unknown.*control|control.*unknown/i);
  });
  it("ignores control transitions, unknown states, and gaps strictly outside actual exposure", () => {
    const data = example(); data.windows = [data.windows[0]];
    data.controls[0].endDate = "1999-12-30";
    data.controls.push({ ...data.controls[0], id: "inside", startDate: "1999-12-31", endDate: "2001-01-01", houseControl: "D", senateControl: "D" });
    data.controls.push({ ...data.controls[0], id: "after", startDate: "2001-01-02", endDate: "2003-01-01", houseControl: "UNKNOWN" });
    const row = analyzeDataset(data, DEFAULT_CONFIG).rows[0];
    expect(row.mixedControl).toBe(false);
    expect(row.reasons.join(" ")).not.toMatch(/coverage.*gap|coverage.*UNKNOWN/);
  });
  it("detects distinct known states across unknown coverage and an interior gap", () => {
    const data = example(); data.controls[0].endDate = "2000-06-01";
    data.controls.push({ ...data.controls[0], id: "unknown", startDate: "2000-06-02", endDate: "2000-09-01", houseControl: "UNKNOWN" });
    data.controls.push({ ...data.controls[0], id: "different", startDate: "2000-09-01", endDate: "2003-01-01", houseControl: "D" });
    const row = analyzeDataset(data, DEFAULT_CONFIG).rows[0];
    expect(row.mixedControl).toBe(true);
    expect(row.reasons.join(" ")).toMatch(/coverage.*gap/);
    expect(row.reasons.join(" ")).toMatch(/coverage.*UNKNOWN/);
  });
  it("skips future revisions and unknown availability without discarding valid returns", () => {
    const data = example();
    data.fundamentals.push({ ...data.fundamentals[0], valuation: 99, availableDate: "2000-01-01" });
    let row = analyzeDataset(data, DEFAULT_CONFIG).rows[0];
    expect(row.valuation).toBe(20);
    expect(row.policyRatePct).toBe(-0.25);
    data.fundamentals = [{ ...data.fundamentals[1], availableDate: null }];
    row = analyzeDataset(data, DEFAULT_CONFIG).rows[0];
    expect(row.valuation).toBeNull();
    expect(row.included).toBe(true);
    expect(row.reasons.join(" ")).toMatch(/fundamental|availab/i);
  });
  it("selects a later eligible revision deterministically, independent of row order", () => {
    const data = example();
    data.fundamentals[0].date = "1999-12-01";
    data.fundamentals[0].availableDate = "1999-12-02";
    data.fundamentals.unshift({ ...data.fundamentals[0], valuation: 25, availableDate: "1999-12-20" });
    expect(analyzeDataset(data, DEFAULT_CONFIG).rows[0].valuation).toBe(25);
  });
  it("joins unsorted decisions by availability without letting a late older-period revision replace newer data", () => {
    const data = example(); data.windows.reverse();
    const sample = data.fundamentals[0];
    data.fundamentals = [
      { ...sample, date: "1999-11-01", availableDate: "1999-11-02", valuation: 10 },
      { ...sample, date: "1999-12-01", availableDate: "1999-12-02", valuation: 20 },
      { ...sample, date: "1999-11-01", availableDate: "2000-06-01", valuation: 99 },
      { ...sample, date: "1999-12-01", availableDate: "2000-12-30", valuation: 25 },
      { ...sample, date: "2000-12-15", availableDate: "2001-01-01", valuation: 40 },
    ];
    expect(analyzeDataset(data, DEFAULT_CONFIG).rows.map(row => row.valuation)).toEqual([25, 20]);
  });
  it("handles a 10000-window offline working set with exact indexed coverage and delayed-vintage selections", () => {
    const data = example(); data.levels = []; data.controls = []; data.windows = []; data.fundamentals = [];
    const day = (offset: number) => new Date(Date.UTC(2000, 0, 1) + offset * 86_400_000).toISOString().slice(0, 10);
    for (let index = 0; index <= 10000; index++) data.levels.push({ date: day(index), value: 100 + index, sourceId: "fiction" });
    for (let index = 0; index < 10000; index++) {
      data.windows.push({ id: `day-${index}`, label: `Fictional day ${index}`, kind: "PRESIDENTIAL_PERIOD", startDate: day(index), endDate: day(index + 1), decisionDate: day(index), complete: true });
      if (index < 7500) {
        data.controls.push({ id: `control-${index}`, startDate: day(index), endDate: day(index + 1), presidentId: "fiction-a", presidentName: "Fiction A", presidentParty: "D", houseControl: index % 2 ? "R" : "D", senateControl: "D", sourceId: "fiction" });
        data.fundamentals.push({ date: day(index), availableDate: day(index + 10), valuation: index, valuationDefinition: "Fictional signed ratio", policyRatePct: 1, sourceId: "fiction" });
      }
    }
    const result = analyzeDataset(data, { ...DEFAULT_CONFIG, windowKind: "PRESIDENTIAL_PERIOD" });
    expect(result.includedCount).toBe(10000);
    expect(result.rows[0].valuation).toBeNull();
    expect(result.rows[10].valuation).toBe(0);
    expect(result.rows[100].valuation).toBe(90);
    expect(result.rows[9999].valuation).toBe(7499);
    expect(result.rows.every(row => !row.mixedControl)).toBe(true);
    expect(result.rows[7499].reasons.join(" ")).not.toMatch(/coverage.*gap/);
    expect(result.rows[7500].reasons.join(" ")).toMatch(/coverage.*gap/);
  });
  it("retains wrong-kind, partial, and excluded-end-year windows with independent reasons", () => {
    const data = example();
    data.windows.push({ id: "period", label: "Fictional partial period", kind: "PRESIDENTIAL_PERIOD", startDate: "1999-12-31", endDate: "2001-12-31", decisionDate: "1999-12-31", complete: false });
    const result = analyzeDataset(data, { ...DEFAULT_CONFIG, excludeYears: [2000] });
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].included).toBe(false);
    expect(result.rows[0].reasons.join(" ")).toMatch(/2000/);
    expect(result.rows[2].reasons.join(" ")).toMatch(/kind|selected/i);
    const period = analyzeDataset(data, { ...DEFAULT_CONFIG, windowKind: "PRESIDENTIAL_PERIOD", includePartial: true }).rows[2];
    expect(period.included).toBe(true);
    expect(period.cumulativeReturn).toBeCloseTo(-0.01, 14);
  });
  it("excludes named annual return years and whole overlapping periods while ignoring the prior-year baseline date", () => {
    const data = example();
    data.levels = [
      { date: "2007-12-31", value: 100, sourceId: "fiction" },
      { date: "2008-12-31", value: 80, sourceId: "fiction" },
      { date: "2009-12-31", value: 88, sourceId: "fiction" },
    ];
    data.controls[0].startDate = "2007-01-01"; data.controls[0].endDate = "2011-01-01";
    data.windows = [
      { id: "annual2008", label: "2008 fictional return", kind: "CALENDAR_YEAR", startDate: "2007-12-31", endDate: "2008-12-31", decisionDate: "2007-12-31", complete: true },
      { id: "annual2009", label: "2009 fictional return", kind: "CALENDAR_YEAR", startDate: "2008-12-31", endDate: "2009-12-31", decisionDate: "2008-12-31", complete: true },
      { id: "periodAcross2008", label: "Fictional window crossing 2008", kind: "PRESIDENTIAL_PERIOD", startDate: "2007-12-31", endDate: "2009-12-31", decisionDate: "2007-12-31", complete: true },
      { id: "periodBaseline2008", label: "Fictional window with baseline only in 2008", kind: "PRESIDENTIAL_PERIOD", startDate: "2008-12-31", endDate: "2009-12-31", decisionDate: "2008-12-31", complete: true },
    ];
    const full = analyzeDataset(data, DEFAULT_CONFIG);
    expect(full.includedCount).toBe(2);
    const annual = analyzeDataset(data, { ...DEFAULT_CONFIG, excludeYears: [2008] });
    expect(annual.rows[0].included).toBe(false);
    expect(annual.rows[1].included).toBe(true);
    expect(annual.rows[0].cumulativeReturn).toBe(full.rows[0].cumulativeReturn);
    const periods = analyzeDataset(data, { ...DEFAULT_CONFIG, windowKind: "PRESIDENTIAL_PERIOD", excludeYears: [2008] });
    expect(periods.rows[2].included).toBe(false);
    expect(periods.rows[2].reasons.join(" ")).toMatch(/entire.*overlap|overlap.*entire/i);
    expect(periods.rows[3].included).toBe(true);
    expect(analyzeDataset(data, DEFAULT_CONFIG)).toEqual(full);
  });
  it.each([
    { maxEndpointGapDays: -1 }, { maxEndpointGapDays: 0.5 }, { maxEndpointGapDays: Number.NaN }, { maxEndpointGapDays: 32 },
    { excludeYears: [2000.5] }, { metric: "INVALID" }, { windowKind: "MONTHLY" }, { includePartial: "false" },
    { grouping: "NOT_A_BREAKDOWN" },
  ])("rejects invalid analysis configuration %j", change => {
    expect(() => analyzeDataset(example(), { ...DEFAULT_CONFIG, ...change } as typeof DEFAULT_CONFIG)).toThrow(/config|metric|windowKind|includePartial|gap|excludeYears/i);
  });
  it("revalidates direct inputs so a JSON-serialized NaN cannot become an accepted null level", () => {
    const data = example(); data.levels[0].value = Number.NaN;
    expect(() => analyzeDataset(JSON.parse(JSON.stringify(data)), DEFAULT_CONFIG)).toThrow(/levels/i);
  });
  it("is deterministic and does not mutate the supplied inputs or config", () => {
    const data = example(); const before = JSON.stringify(data); const config = { ...DEFAULT_CONFIG, excludeYears: [2001] };
    expect(analyzeDataset(data, config)).toEqual(analyzeDataset(data, config));
    expect(JSON.stringify(data)).toBe(before);
    expect(config.excludeYears).toEqual([2001]);
  });
});

describe("illustrative research fixture", () => {
  it("is valid, explicitly fictional, covers six configurations, and keeps annual/period frames separate", () => {
    const data = parseResearchDataset(illustrativeDataset);
    expect(data.kind).toBe("ILLUSTRATIVE");
    expect(data.title).toMatch(/fiction|illustrat/i);
    expect(data.windows.filter(w => w.kind === "CALENDAR_YEAR")).toHaveLength(18);
    expect(data.windows.filter(w => w.kind === "PRESIDENTIAL_PERIOD")).toHaveLength(4);
    const annual = analyzeDataset(data, DEFAULT_CONFIG);
    expect(annual.groups).toHaveLength(6);
    expect(annual.rows.some(r => r.value !== null && r.value < 0)).toBe(true);
    expect(annual.rows.some(r => r.value !== null && r.value > 0)).toBe(true);
    expect(annual.groups.every(g => g.administrationCount <= g.count)).toBe(true);
    expect(data.sources.every(s => /fiction|illustrat|invented/i.test(s.title))).toBe(true);
  });
});
