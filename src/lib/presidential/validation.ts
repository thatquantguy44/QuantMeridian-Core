import type {
  AnalysisConfig, FundamentalObservation, GroupingDimension, IndexLevel, PoliticalInterval, PoliticalParty,
  ResearchDataset, ResearchSource, ResearchWindow,
} from "./contracts";

type RecordValue = Record<string, unknown>;
const PARTIES: PoliticalParty[] = ["D", "R", "OTHER", "TIED", "UNKNOWN"];
const DAY_MS = 86_400_000;

function fail(path: string, reason: string): never { throw new Error(`${path}: ${reason}`); }
function record(value: unknown, path: string): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(path, "must be an object");
  return value as RecordValue;
}
function fields(value: RecordValue, names: string[], path: string): void {
  const unknown = Object.keys(value).filter(key => !names.includes(key));
  if (unknown.length) fail(path, `unknown field(s): ${unknown.join(", ")}`);
}
function text(value: unknown, path: string, limit = 1000): string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > limit) {
    fail(path, `must be a nonempty string of at most ${limit} characters`);
  }
  return value;
}
function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, "must be an array");
  if (value.length > 100_000) fail(path, "exceeds 100000 records; split the research dataset");
  return value;
}
function boolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") fail(path, "must be true or false");
  return value;
}
function choice<T extends string>(value: unknown, options: readonly T[], path: string): T {
  if (typeof value !== "string" || !options.includes(value as T)) fail(path, `must be ${options.join(" or ")}`);
  return value as T;
}
function finite(value: unknown, path: string, positive = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || (positive && value <= 0)) {
    fail(path, positive ? "must be a finite positive number" : "must be a finite number or null when unavailable");
  }
  return value;
}
function nullableNumber(value: unknown, path: string, positive = false): number | null {
  return value === null ? null : finite(value, path, positive);
}
/** Parse UTC date-only strings without accepting JavaScript's calendar rollover. */
export function isoDate(value: unknown, path: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000-")) fail(path, "must be a valid ISO date YYYY-MM-DD");
  const ms = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) fail(path, "must be a valid ISO calendar date YYYY-MM-DD");
  return value;
}
export function dateDays(date: string): number { return Date.parse(`${date}T00:00:00Z`) / DAY_MS; }
function unique(values: string[], path: string, label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) fail(path, `duplicate ${label}: ${value}`);
    seen.add(value);
  }
}

/** Validate and copy local inputs. No coercion, provider lookups, or return-basis substitution. */
export function parseResearchDataset(value: unknown): ResearchDataset {
  const input = record(value, "dataset");
  fields(input, ["schemaVersion", "id", "title", "kind", "currency", "nominalReal", "returnBasis", "sources", "levels", "controls", "windows", "fundamentals"], "dataset");
  if (input.schemaVersion !== 1) fail("schemaVersion", "must be 1");
  const id = text(input.id, "id", 200);
  const title = text(input.title, "title");
  const kind = choice(input.kind, ["ILLUSTRATIVE", "USER_SUPPLIED"] as const, "kind");
  const currency = text(input.currency, "currency", 3);
  if (!/^[A-Z]{3}$/.test(currency)) fail("currency", "must be a three-letter uppercase currency code");
  const nominalReal = choice(input.nominalReal, ["NOMINAL"] as const, "nominalReal (real returns are not implemented)");
  const returnBasis = choice(input.returnBasis, ["TOTAL_RETURN", "PRICE_RETURN"] as const, "returnBasis");

  const sources: ResearchSource[] = array(input.sources, "sources").map((value, index) => {
    const path = `sources[${index}]`; const row = record(value, path);
    fields(row, ["id", "title", "locator", "note"], path);
    const source: ResearchSource = { id: text(row.id, `${path}.id`, 200), title: text(row.title, `${path}.title`), locator: row.locator === null ? null : text(row.locator, `${path}.locator`, 4000) };
    if (row.note !== undefined) source.note = text(row.note, `${path}.note`, 10_000);
    return source;
  });
  if (sources.length === 0) fail("sources", "include at least one explicit source record, including for fictional fixtures");
  unique(sources.map(source => source.id), "sources", "source ID");
  const sourceIds = new Set(sources.map(source => source.id));
  function sourceId(value: unknown, path: string): string {
    const id = text(value, path, 200);
    if (!sourceIds.has(id)) fail(path, `unknown source ID ${id}; add it to sources`);
    return id;
  }

  const levels: IndexLevel[] = array(input.levels, "levels").map((value, index) => {
    const path = `levels[${index}]`; const row = record(value, path);
    fields(row, ["date", "value", "sourceId"], path);
    return { date: isoDate(row.date, `${path}.date`), value: finite(row.value, `${path}.value`, true), sourceId: sourceId(row.sourceId, `${path}.sourceId`) };
  });
  unique(levels.map(row => row.date), "levels", "observation date");

  const controls: PoliticalInterval[] = array(input.controls, "controls").map((value, index) => {
    const path = `controls[${index}]`; const row = record(value, path);
    fields(row, ["id", "startDate", "endDate", "presidentId", "presidentName", "presidentParty", "houseControl", "senateControl", "sourceId"], path);
    const startDate = isoDate(row.startDate, `${path}.startDate`); const endDate = isoDate(row.endDate, `${path}.endDate`);
    if (endDate <= startDate) fail(path, "endDate must follow startDate for a half-open interval");
    return {
      id: text(row.id, `${path}.id`, 200), startDate, endDate,
      presidentId: text(row.presidentId, `${path}.presidentId`, 200), presidentName: text(row.presidentName, `${path}.presidentName`),
      presidentParty: choice(row.presidentParty, PARTIES, `${path}.presidentParty`), houseControl: choice(row.houseControl, PARTIES, `${path}.houseControl`), senateControl: choice(row.senateControl, PARTIES, `${path}.senateControl`),
      sourceId: sourceId(row.sourceId, `${path}.sourceId`),
    };
  });
  unique(controls.map(row => row.id), "controls", "interval ID");
  const orderedControls = [...controls].sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (let index = 1; index < orderedControls.length; index++) {
    if (orderedControls[index].startDate < orderedControls[index - 1].endDate) fail("controls", `overlapping intervals ${orderedControls[index - 1].id} and ${orderedControls[index].id}`);
  }

  const windows: ResearchWindow[] = array(input.windows, "windows").map((value, index) => {
    const path = `windows[${index}]`; const row = record(value, path);
    fields(row, ["id", "label", "kind", "startDate", "endDate", "decisionDate", "complete"], path);
    const kind = choice(row.kind, ["CALENDAR_YEAR", "PRESIDENTIAL_PERIOD"] as const, `${path}.kind`);
    const startDate = isoDate(row.startDate, `${path}.startDate`); const endDate = isoDate(row.endDate, `${path}.endDate`); const decisionDate = isoDate(row.decisionDate, `${path}.decisionDate`);
    const complete = boolean(row.complete, `${path}.complete`);
    if (endDate <= startDate) fail(path, "endDate must follow startDate");
    if (decisionDate > startDate) fail(`${path}.decisionDate`, "must be on or before startDate for the at-origin assignment");
    if (kind === "CALENDAR_YEAR") {
      if (!startDate.endsWith("-12-31") || Number(endDate.slice(0, 4)) !== Number(startDate.slice(0, 4)) + 1 || (complete && !endDate.endsWith("-12-31"))) {
        fail(path, "a complete CALENDAR_YEAR must run previous Dec31 through Dec31 of the next year; a partial year keeps that same starting anchor");
      }
    }
    return { id: text(row.id, `${path}.id`, 200), label: text(row.label, `${path}.label`), kind, startDate, endDate, decisionDate, complete };
  });
  unique(windows.map(row => row.id), "windows", "window ID");
  unique(windows.map(row => `${row.kind}|${row.startDate}|${row.endDate}`), "windows", "window dates within kind");

  const fundamentals: FundamentalObservation[] = array(input.fundamentals, "fundamentals").map((value, index) => {
    const path = `fundamentals[${index}]`; const row = record(value, path);
    fields(row, ["date", "availableDate", "valuation", "valuationDefinition", "policyRatePct", "sourceId"], path);
    const date = isoDate(row.date, `${path}.date`); const availableDate = row.availableDate === null ? null : isoDate(row.availableDate, `${path}.availableDate`);
    if (availableDate !== null && availableDate < date) fail(`${path}.availableDate`, "cannot precede the observation date");
    return { date, availableDate, valuation: nullableNumber(row.valuation, `${path}.valuation`), valuationDefinition: text(row.valuationDefinition, `${path}.valuationDefinition`), policyRatePct: nullableNumber(row.policyRatePct, `${path}.policyRatePct`), sourceId: sourceId(row.sourceId, `${path}.sourceId`) };
  });
  unique(fundamentals.map(row => `${row.date}|${row.availableDate ?? "UNKNOWN"}`), "fundamentals", "observation date and availability vintage");
  if (new Set(fundamentals.map(row => row.valuationDefinition)).size > 1) fail("fundamentals.valuationDefinition", "use one valuation definition throughout the dataset; do not pool P/E and CAPE or differing constructions");
  return { schemaVersion: 1, id, title, kind, currency, nominalReal, returnBasis, sources, levels, controls, windows, fundamentals };
}

export function parseAnalysisConfig(value: unknown): AnalysisConfig {
  const input = record(value, "config");
  fields(input, ["windowKind", "metric", "grouping", "includePartial", "maxEndpointGapDays", "excludeYears"], "config");
  const windowKind = choice(input.windowKind, ["CALENDAR_YEAR", "PRESIDENTIAL_PERIOD"] as const, "config.windowKind");
  const metric = choice(input.metric, ["CUMULATIVE", "ANNUALIZED"] as const, "config.metric");
  const grouping = choice(input.grouping, ["POLITICAL_CONFIGURATION", "PRESIDENT_PARTY", "HOUSE_CONTROL", "SENATE_CONTROL", "GOVERNMENT_STRUCTURE"] as const, "config.grouping") as GroupingDimension;
  const includePartial = boolean(input.includePartial, "config.includePartial");
  const maxEndpointGapDays = finite(input.maxEndpointGapDays, "config.maxEndpointGapDays");
  if (!Number.isInteger(maxEndpointGapDays) || maxEndpointGapDays < 0 || maxEndpointGapDays > 31) fail("config.maxEndpointGapDays", "must be an integer from 0 through 31 calendar days");
  const excludeYears = array(input.excludeYears, "config.excludeYears").map((value, index) => {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 9999) fail(`config.excludeYears[${index}]`, "must be an integer end year from 0 through 9999");
    return value;
  });
  unique(excludeYears.map(String), "config.excludeYears", "excluded year");
  return { windowKind, metric, grouping, includePartial, maxEndpointGapDays, excludeYears };
}
