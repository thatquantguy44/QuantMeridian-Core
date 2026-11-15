import type { PoliticalParty, ResearchDataset } from "./contracts";

/** Invented inputs for offline software demonstration. No dates/parties imply real historical control. */
function makeIllustrativeDataset(): ResearchDataset {
  const sourceId = "ILLUSTRATIVE-INVENTED";
  const dataset: ResearchDataset = {
    schemaVersion: 1, id: "illustrative-presidential-v1", title: "Fictional presidential research demonstration",
    kind: "ILLUSTRATIVE", currency: "USD", nominalReal: "NOMINAL", returnBasis: "TOTAL_RETURN",
    sources: [{ id: sourceId, title: "Invented levels, fictional executives, and illustrative political states", locator: null, note: "All values and executive identities are made up for software verification. Calendar labels 2000–2017 do not describe actual market returns or actual political control." }],
    levels: [{ date: "1999-12-31", value: 100, sourceId }], controls: [], windows: [], fundamentals: [],
  };
  const returns = [0.08, -0.06, 0.11, 0.04, -0.09, 0.07, 0.03, 0.12, -0.04, 0.09, 0.02, -0.08, 0.10, 0.05, -0.03, 0.06, -0.02, 0.04];
  const executiveNames = ["Illustrative Alder", "Illustrative Birch", "Illustrative Cedar", "Illustrative Dune"];
  let level = 100;
  for (let index = 0; index < returns.length; index++) {
    const year = 2000 + index; const startDate = `${year - 1}-12-31`; const endDate = `${year}-12-31`;
    level *= 1 + returns[index];
    dataset.levels.push({ date: endDate, value: level, sourceId });
    const presidentParty: PoliticalParty = index < 8 ? "D" : "R";
    const congress = index % 3;
    const executive = Math.min(3, Math.floor(index / 4));
    dataset.controls.push({ id: `illustrative-control-${year}`, startDate, endDate, presidentId: `fictional-executive-${executive}`, presidentName: executiveNames[executive], presidentParty,
      houseControl: congress === 1 ? "R" : "D", senateControl: congress === 2 ? "R" : congress === 1 ? "R" : "D", sourceId });
    dataset.windows.push({ id: `illustrative-year-${year}`, label: `${year} · fictional`, kind: "CALENDAR_YEAR", startDate, endDate, decisionDate: startDate, complete: true });
    dataset.fundamentals.push({ date: `${year - 1}-12-30`, availableDate: startDate, valuation: 14 + index * 0.35 + (index % 3) * 0.6, valuationDefinition: "Fictional trailing-earnings valuation ratio (not actual P/E or CAPE)", policyRatePct: -0.2 + index * 0.17, sourceId });
  }
  for (let index = 0; index < 4; index++) {
    const startYear = 1999 + index * 4;
    dataset.windows.push({ id: `illustrative-period-${index + 1}`, label: `Fictional period ${index + 1}`, kind: "PRESIDENTIAL_PERIOD", startDate: `${startYear}-12-31`, endDate: `${startYear + 4}-12-31`, decisionDate: `${startYear}-12-31`, complete: true });
  }
  return dataset;
}

export const illustrativeDataset: ResearchDataset = makeIllustrativeDataset();
