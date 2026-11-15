import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, type ResearchDataset } from "@/lib/presidential/contracts";
import { analyzeDataset } from "@/lib/presidential/engine";
import { illustrativeDataset } from "@/lib/presidential/fixtures";
import { CategoryChart, FundamentalScatter, PoliticalTimeline, pct } from "./ResearchCharts";

const dataset: ResearchDataset = {
  schemaVersion: 1, id: "finite-boundary", title: "Finite numeric boundary fixture", kind: "ILLUSTRATIVE",
  currency: "USD", nominalReal: "NOMINAL", returnBasis: "TOTAL_RETURN",
  sources: [{ id: "S1", title: "Invented software boundary observations", locator: null }],
  levels: [{ date: "2019-12-31", value: 1, sourceId: "S1" }, { date: "2020-12-31", value: Number.MAX_VALUE, sourceId: "S1" }, { date: "2021-12-31", value: Number.MAX_VALUE, sourceId: "S1" }],
  controls: [
    { id: "C1", startDate: "2019-12-31", endDate: "2020-12-31", presidentId: "P1", presidentName: "Fictional one", presidentParty: "D", houseControl: "D", senateControl: "D", sourceId: "S1" },
    { id: "C2", startDate: "2020-12-31", endDate: "2022-01-01", presidentId: "P2", presidentName: "Fictional two", presidentParty: "R", houseControl: "R", senateControl: "R", sourceId: "S1" },
  ],
  windows: [
    { id: "W1", label: "2020", kind: "CALENDAR_YEAR", startDate: "2019-12-31", endDate: "2020-12-31", decisionDate: "2019-12-31", complete: true },
    { id: "W2", label: "2021", kind: "CALENDAR_YEAR", startDate: "2020-12-31", endDate: "2021-12-31", decisionDate: "2020-12-31", complete: true },
  ],
  fundamentals: [
    { date: "2019-12-31", availableDate: "2019-12-31", valuation: -1e308, valuationDefinition: "Supplied signed ratio", policyRatePct: -1e308, sourceId: "S1" },
    { date: "2020-12-31", availableDate: "2020-12-31", valuation: 1e308, valuationDefinition: "Supplied signed ratio", policyRatePct: 1e308, sourceId: "S1" },
  ],
};

describe("presidential research chart boundaries", () => {
  const result = analyzeDataset(dataset, DEFAULT_CONFIG);
  it("formats finite extreme returns without overflowing the percent conversion", () => {
    expect(pct(Number.MAX_VALUE)).toBe("+1.8e+310%");
    expect(pct(-Number.MAX_VALUE)).toBe("-1.8e+310%");
    expect(pct(null)).toBe("Unavailable");
    expect(pct(0.1)).toBe("+10.0%");
  });
  it("renders an accepted MAX_VALUE category mean with finite SVG coordinates", () => {
    expect(result.groups.some(group => group.mean === Number.MAX_VALUE)).toBe(true);
    const html = renderToStaticMarkup(createElement(CategoryChart, { result }));
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html).toContain("1.8e+310%");
    expect(html).toContain("data-return=");
  });
  it("renders descriptive administration-cluster intervals without calling them causal confidence intervals", () => {
    const html = renderToStaticMarkup(createElement(CategoryChart, { result: analyzeDataset(illustrativeDataset, { ...DEFAULT_CONFIG, grouping: "PRESIDENT_PARTY" }) }));
    expect(html).toContain("descriptive-interval");
    expect(html).toContain("administration-cluster resampling range");
    expect(html).toMatch(/not causal confidence interval/i);
  });
  it.each(["valuation", "policyRatePct"] as const)("renders opposite-sign extreme %s inputs without overflowing the domain", field => {
    const html = renderToStaticMarkup(createElement(FundamentalScatter, { rows: result.rows, field, definition: "Supplied signed ratio" }));
    expect(html).not.toMatch(/NaN|Infinity/);
    expect(html.match(/<circle /g)).toHaveLength(2);
  });
  it("shows an explicit unavailable scatter above 2,000 eligible observations without sampling", () => {
    const rows = Array.from({ length: 2001 }, (_, index) => ({ ...result.rows[0], id: `W${index}` }));
    const html = renderToStaticMarkup(createElement(FundamentalScatter, { rows, field: "policyRatePct" }));
    expect(html).toContain("Figure unavailable");
    expect(html).toContain("2,000");
    expect(html).not.toContain("<circle");
    expect(html).not.toMatch(/NaN|Infinity/);
  });
  it("shows an explicit unavailable timeline above 2,000 intervals without sampling", () => {
    const large = { ...dataset, controls: Array.from({ length: 2001 }, (_, index) => ({ ...dataset.controls[0], id: `C${index}` })) };
    const html = renderToStaticMarkup(createElement(PoliticalTimeline, { dataset: large }));
    expect(html).toContain("Figure unavailable");
    expect(html).toContain("2,000");
    expect(html).toContain("run manifest");
    expect(html).not.toMatch(/NaN|Infinity/);
  });
});
