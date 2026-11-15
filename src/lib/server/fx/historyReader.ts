import { calendarAt } from "@/lib/fx/calendar";
import { goldParam, goldTable, type GoldStore } from "../goldStore";
import { MAX_HISTORY_ROWS, reviewedDates } from "./history";
import { MAPPINGS } from "./snapshot";

/** Current rows and latest guards share one uncached database statement snapshot. */
export async function readGoldHistoryRows(store: GoldStore, startedAt: string): Promise<Record<string, unknown>[]> {
  const clock = calendarAt(startedAt);
  if (!clock.expectedDate || !clock.nextCheckAt) throw new Error("FRESHNESS_CALENDAR_UNKNOWN");
  const dates = reviewedDates(clock.localDate);
  return readGoldWindowRows(store, dates, 90, MAX_HISTORY_ROWS);
}

/** Bounded allowlisted window reader shared by the two distinct capture contracts. */
export async function readGoldWindowRows(store: GoldStore, dates: string[], observations: number, maxRows: number): Promise<Record<string, unknown>[]> {
  if (!dates.length || !Number.isSafeInteger(observations) || observations < 1 || observations > 253 ||
    !Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1024) throw new Error("INTEGRITY_FAILURE");
  // Series placeholders come first in the SQL as well as the parameter array,
  // which preserves positional binding on SQLite as well as numbered PostgreSQL.
  const series = MAPPINGS.map((_, i) => `(${goldParam(i + 1)})`).join(", ");
  const calendar = dates.map((_, i) => `(CAST(${goldParam(i + 4)} AS TEXT))`).join(", ");
  return store.raw(`WITH requested_series(series_id) AS (VALUES ${series}),
    calendar(observation_date) AS (VALUES ${calendar}), ranked AS (
      SELECT series_id, observation_date, value, is_missing, revision_number, realtime_start, realtime_end, ingested_at,
        DENSE_RANK() OVER (PARTITION BY series_id ORDER BY CASE WHEN observation_date IS NULL THEN 1 ELSE 0 END DESC, observation_date DESC) AS latest_rank
      FROM ${goldTable("fred_latest_observation")}
      WHERE series_id IN (SELECT series_id FROM requested_series)
    ), anchor AS (
      SELECT MAX(r.observation_date) AS observation_date FROM ranked r
      JOIN calendar c ON c.observation_date = r.observation_date WHERE r.latest_rank = 1
    ), wanted AS (
      SELECT observation_date FROM calendar WHERE observation_date <= (SELECT observation_date FROM anchor)
      ORDER BY observation_date DESC LIMIT ${observations}
    ) SELECT r.series_id, r.observation_date, r.value, r.is_missing, r.revision_number,
      r.realtime_start, r.realtime_end, r.ingested_at, d.source, d.frequency, d.units
      FROM ranked r LEFT JOIN ${goldTable("dim_series")} d ON d.series_id = r.series_id
      WHERE r.latest_rank = 1 OR r.observation_date IN (SELECT observation_date FROM wanted)
      ORDER BY r.series_id, r.observation_date LIMIT ${maxRows + 1}`,
  [...MAPPINGS.map(m => m.seriesId), ...dates]);
}
