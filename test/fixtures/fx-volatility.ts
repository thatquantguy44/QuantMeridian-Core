import { volatilityDates } from "../../src/lib/fx/volatilityCalendar";
export const volatilityAt = "2026-10-30T17:00:00.000Z";
export function volatilityRows(count = 253) {
  return volatilityDates("2026-10-30").slice(-count).flatMap((date, i) => ["USD", "JPY", "GBP"].map((c, j) => ({
    series_id: `ECB:EXR:D.${c}.EUR.SP00.A`, observation_date: date,
    value: j === 0 ? Math.exp(i % 2 ? .01 : 0) : j === 1 ? 150 * Math.exp(i % 2 ? .01 : 0) : .88,
    is_missing: "0", revision_number: "1", realtime_start: "", realtime_end: "", ingested_at: volatilityAt,
    source: "ecb", frequency: "d", units: `${c} per EUR`,
  })));
}
