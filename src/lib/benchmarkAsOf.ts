/** One explicit calendar boundary for BMRK/BRA; this does not imply provider publication time. */
export const BENCHMARK_AS_OF_TIME_ZONE = "America/New_York" as const;
const formatter = new Intl.DateTimeFormat("en-US", { timeZone: BENCHMARK_AS_OF_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export function benchmarkAsOfDate(now: Date): string {
  const parts = Object.fromEntries(formatter.formatToParts(now).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
