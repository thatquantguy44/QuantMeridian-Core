import { SENT_MACRO_SERIES, emptyMacroSeries, type SentMacroResponse } from "@/lib/sentiment/macro";
import { goldParam, goldStore, goldTable, type GoldStore } from "./goldStore";

function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("INTEGRITY_FAILURE");
  return value;
}
export function normalizeSentMacro(values: readonly unknown[], assessedAt: string): SentMacroResponse {
  const today = date(assessedAt.slice(0, 10));
  const rows = values as Record<string, unknown>[];
  if (rows.length > 1771 || rows.some(r => !r || !SENT_MACRO_SERIES.some(s => s.id === r.series_id))) throw new Error("INTEGRITY_FAILURE");
  const series = emptyMacroSeries();
  series.forEach(s => {
    const selected = rows.filter(r => r.series_id === s.id);
    if (!selected.length) return;
    let reason: "CATALOG_MISMATCH" | "INTEGRITY_FAILURE" = "INTEGRITY_FAILURE";
    try {
      if (selected.length > 252) throw new Error(reason);
      if (selected.some(r => r.source !== "fred" || r.frequency !== "d" || r.units !== s.units)) {
        reason = "CATALOG_MISMATCH"; throw new Error(reason);
      }
      const observed = selected.map(r => {
        const observationDate = date(r.observation_date);
        if (observationDate > today) throw new Error(reason);
        const missing = r.is_missing === 1 || r.is_missing === "1";
        if (!missing && r.is_missing !== 0 && r.is_missing !== "0") throw new Error(reason);
        if (!missing && (typeof r.value !== "number" || !Number.isFinite(r.value) || s.id === "VIXCLS" && r.value < 0)) throw new Error(reason);
        if (r.ingested_at !== null && (typeof r.ingested_at !== "string" || !Number.isFinite(Date.parse(r.ingested_at)) || Date.parse(r.ingested_at) > Date.parse(assessedAt))) throw new Error(reason);
        return { date: observationDate, value: missing ? null : r.value as number, ingestedAt: r.ingested_at as string | null };
      }).sort((a, b) => a.date.localeCompare(b.date));
      if (new Set(observed.map(o => o.date)).size !== observed.length) throw new Error(reason);
      const latest = observed[observed.length - 1];
      s.observations = observed.map(({ date, value }) => ({ date, value }));
      s.latestReportedDate = latest.date;
      s.ageCalendarDays = (Date.parse(today) - Date.parse(latest.date)) / 86400000;
      s.ingestedAt = latest.ingestedAt;
      s.latest = latest.value === null ? null : { date: latest.date, value: latest.value };
      s.state = s.latest ? "AVAILABLE" : "UNAVAILABLE";
      s.reason = s.latest ? null : "LATEST_MISSING";
    } catch { s.reason = reason; }
  });
  return { schemaVersion: "sent-macro/1", assessedAt, series, error: null };
}

/** One statement, allowlisted series, consistent catalog/history, no date filling. */
export async function readSentMacro(store: Pick<GoldStore, "raw"> = goldStore(), now = () => new Date().toISOString()) {
  const rows = await store.raw<Record<string, unknown>>(`WITH ranked AS (
    SELECT series_id,observation_date,value,is_missing,ingested_at,
      DENSE_RANK() OVER (PARTITION BY series_id ORDER BY CASE WHEN observation_date IS NULL THEN 1 ELSE 0 END DESC,observation_date DESC) AS observation_rank
    FROM ${goldTable("fred_latest_observation")}
    WHERE series_id IN (${SENT_MACRO_SERIES.map((_, i) => goldParam(i + 1)).join(",")})
  ), joined AS (SELECT r.series_id,r.observation_date,r.value,r.is_missing,r.ingested_at,d.source,d.frequency,d.units,
      ROW_NUMBER() OVER (PARTITION BY r.series_id ORDER BY CASE WHEN r.observation_date IS NULL THEN 1 ELSE 0 END DESC,r.observation_date DESC) AS joined_rank
    FROM ranked r LEFT JOIN ${goldTable("dim_series")} d ON d.series_id=r.series_id
    WHERE r.observation_rank<=252)
    SELECT series_id,observation_date,value,is_missing,ingested_at,source,frequency,units
    FROM joined WHERE joined_rank<=253 ORDER BY series_id,observation_date LIMIT 1772`, SENT_MACRO_SERIES.map(s => s.id));
  return normalizeSentMacro(rows, now());
}
