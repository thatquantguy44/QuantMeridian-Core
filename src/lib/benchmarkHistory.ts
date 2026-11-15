import type { Obs, SeriesMap } from "@/data/benchmarkRates";

const DAY = 86_400_000;
const cadenceLag: Record<string, number> = { d: 5, w: 10, m: 45, q: 110, a: 400 };
export function cadenceGapDays(frequency: string | null): number | undefined {
  return cadenceLag[(frequency ?? "").toLowerCase().slice(0, 1)];
}
/** NaNs are rendering markers only; they are never returned as observations or exported. */
export function breakChartGaps(observations: Obs[], gapDays: number | undefined): Obs[] {
  const plotted: Obs[] = [];
  for (let i = 0; i < observations.length; i++) {
    if (i && (gapDays === undefined || (stamp(observations[i].date) - stamp(observations[i - 1].date)) / DAY > gapDays)) plotted.push({ date: "", value: NaN });
    plotted.push(observations[i]);
  }
  return plotted;
}
const stamp = (date: string) => Date.parse(`${date}T00:00:00Z`);
const dateString = (date: Date) => date.toISOString().slice(0, 10);

/** Subtract calendar months, clamping end-of-month dates instead of rolling into another month. */
export function priorMonths(date: string, months: number): string {
  const d = new Date(stamp(date));
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return dateString(d);
}

export interface CalendarChange {
  label: string;
  targetDate: string;
  date: string | null;
  value: number | null;
  change: number | null;
}

/** Compare to the latest observation on/before each target, within disclosed cadence-based limits. */
export function calendarChanges(observations: Obs[], frequency: string | null): CalendarChange[] {
  const latest = observations.at(-1);
  if (!latest) return [];
  const current = stamp(latest.date);
  const targets = [
    { label: "1D", date: dateString(new Date(current - DAY)), tolerance: 3 },
    { label: "1W", date: dateString(new Date(current - 7 * DAY)), tolerance: 7 },
    { label: "1M", date: priorMonths(latest.date, 1), tolerance: 31 },
    { label: "3M", date: priorMonths(latest.date, 3), tolerance: 93 },
    { label: "YTD", date: `${Number(latest.date.slice(0, 4)) - 1}-12-31`, tolerance: 400 },
    { label: "1Y", date: priorMonths(latest.date, 12), tolerance: 400 },
  ];
  const allowed = cadenceLag[(frequency ?? "").toLowerCase().slice(0, 1)];
  return targets.map(({ label, date, tolerance }) => {
    const target = stamp(date);
    let prior: Obs | undefined;
    if (allowed !== undefined) {
      for (let i = observations.length - 1; i >= 0; i--) {
        if (observations[i].date <= date && observations[i].date < latest.date) { prior = observations[i]; break; }
      }
    }
    if (!prior || allowed === undefined || (target - stamp(prior.date)) / DAY > Math.min(allowed, tolerance)) {
      return { label, targetDate: date, date: null, value: null, change: null };
    }
    return { label, targetDate: date, date: prior.date, value: prior.value, change: latest.value - prior.value };
  });
}

export interface HistoryDescription {
  count: number; firstDate: string | null; lastDate: string | null;
  min: number | null; max: number | null; mean: number | null; percentile: number | null;
  zScore: number | null; changeVolatility: number | null;
}
export function descriptiveHistory(observations: Obs[]): HistoryDescription {
  const values = observations.map((o) => o.value);
  const count = values.length;
  const mean = count ? values.reduce((a, b) => a + b, 0) / count : null;
  const stdev = (sample: number[]) => {
    if (sample.length < 2) return null;
    const avg = sample.reduce((a, b) => a + b, 0) / sample.length;
    return Math.sqrt(sample.reduce((a, x) => a + (x - avg) ** 2, 0) / (sample.length - 1));
  };
  const sigma = stdev(values);
  const changes = values.slice(1).map((v, i) => v - values[i]);
  const latest = values.at(-1);
  return { count, firstDate: observations[0]?.date ?? null, lastDate: observations.at(-1)?.date ?? null,
    min: count ? values.reduce((a, b) => Math.min(a, b)) : null, max: count ? values.reduce((a, b) => Math.max(a, b)) : null, mean,
    percentile: count >= 10 && latest !== undefined ? 100 * values.filter((v) => v <= latest).length / count : null,
    zScore: latest !== undefined && mean !== null && sigma !== null && sigma > 0 ? (latest - mean) / sigma : null,
    changeVolatility: stdev(changes) };
}

export interface MatchedCorrelation { ids: string[]; matrix: number[][]; sampleCount: number; firstDate: string; lastDate: string }
/** Correlate observed level changes over common dates; no filling or percentage division. */
export function matchedChangeCorrelation(map: SeriesMap, ids: string[], maxChanges = 60): MatchedCorrelation | null {
  if (ids.length < 2 || ids.some((id) => !map[id]?.length)) return null;
  const indexed = ids.map((id) => new Map(map[id].map((row) => [row.date, row.value])));
  const dates = [...indexed[0].keys()].filter((date) => indexed.every((index) => index.has(date))).slice(-(maxChanges + 1));
  if (dates.length < 3) return null;
  const changes = indexed.map((index) => dates.slice(1).map((date, i) => index.get(date)! - index.get(dates[i])!));
  const means = changes.map((xs) => xs.reduce((a, b) => a + b, 0) / xs.length);
  const sums = changes.map((xs, i) => xs.reduce((acc, x) => acc + (x - means[i]) ** 2, 0));
  if (sums.some((sum) => sum === 0)) return null;
  const matrix = changes.map((xs, i) => changes.map((ys, j) => xs.reduce((acc, x, k) => acc + (x - means[i]) * (ys[k] - means[j]), 0) / Math.sqrt(sums[i] * sums[j])));
  return { ids, matrix, sampleCount: dates.length - 1, firstDate: dates[0], lastDate: dates.at(-1)! };
}

export interface RollingHistoryPoint { fromDate: string; date: string; change: number | null; volatility: number | null }
/** Trailing observed-level changes; windows with a cadence gap are unavailable. */
export function rollingHistory(observations: Obs[], frequency: string | null, window = 20): RollingHistoryPoint[] {
  const allowed = cadenceLag[(frequency ?? "").toLowerCase().slice(0, 1)];
  if (!Number.isInteger(window) || window < 2) return [];
  const points: RollingHistoryPoint[] = [];
  for (let end = window; end < observations.length; end++) {
    const rows = observations.slice(end - window, end + 1);
    const gapsValid = allowed !== undefined && rows.slice(1).every((row, i) => (stamp(row.date) - stamp(rows[i].date)) / DAY <= allowed);
    if (!gapsValid) { points.push({ fromDate: rows[0].date, date: rows.at(-1)!.date, change: null, volatility: null }); continue; }
    const changes = rows.slice(1).map((row, i) => row.value - rows[i].value);
    const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
    const volatility = Math.sqrt(changes.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (changes.length - 1));
    points.push({ fromDate: rows[0].date, date: rows.at(-1)!.date, change: rows.at(-1)!.value - rows[0].value, volatility });
  }
  return points;
}
