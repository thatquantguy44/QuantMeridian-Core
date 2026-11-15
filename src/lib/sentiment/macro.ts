export const SENT_MACRO_SERIES = [
  { id: "VIXCLS", label: "Market volatility (VIX)", units: "Index" },
  { id: "BAMLH0A0HYM2", label: "High-yield credit spread", units: "Percent" },
  { id: "BAMLC0A0CM", label: "Investment-grade credit spread", units: "Percent" },
  { id: "DGS10", label: "10-year Treasury yield", units: "Percent" },
  { id: "DGS2", label: "2-year Treasury yield", units: "Percent" },
  { id: "DGS3MO", label: "3-month Treasury yield", units: "Percent" },
  { id: "T10Y2Y", label: "10Y–2Y Treasury spread", units: "Percent" },
] as const;
export type SentMacroId = typeof SENT_MACRO_SERIES[number]["id"];
export interface SentMacroObservation { date: string; value: number | null }
export interface SentMacroSeries {
  id: SentMacroId;
  label: string;
  units: "Index" | "Percent";
  source: "FRED";
  state: "AVAILABLE" | "UNAVAILABLE";
  observations: SentMacroObservation[];
  latest: { date: string; value: number } | null;
  latestReportedDate: string | null;
  ageCalendarDays: number | null;
  ingestedAt: string | null;
  reason: "NO_SOURCE_DATA" | "CATALOG_MISMATCH" | "INTEGRITY_FAILURE" | "LATEST_MISSING" | "SOURCE_UNAVAILABLE" | null;
}
export interface SentMacroResponse {
  schemaVersion: "sent-macro/1";
  assessedAt: string;
  series: SentMacroSeries[];
  error: { code: string; message: string } | null;
}
export function emptyMacroSeries(reason: SentMacroSeries["reason"] = "NO_SOURCE_DATA"): SentMacroSeries[] {
  return SENT_MACRO_SERIES.map(s => ({ ...s, source: "FRED", state: "UNAVAILABLE", observations: [], latest: null,
    latestReportedDate: null, ageCalendarDays: null, ingestedAt: null, reason }));
}
