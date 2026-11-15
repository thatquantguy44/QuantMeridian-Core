import { TARGET_CLOSURES, operatingDate } from "./calendar";

export const VOLATILITY_CALENDAR_VERSION = "ecb-target-history-2025-2028/1";
// Reviewed 2025 TARGET holidays: ECB 2025 consolidated tender calendar and
// TARGET operating schedule. Existing 2026–2028 definitions stay unchanged.
export const VOLATILITY_CALENDAR: Record<string, readonly string[]> = Object.freeze({
  ...TARGET_CLOSURES, "2025": Object.freeze(["01-01", "04-18", "04-21", "05-01", "12-25", "12-26"]),
});
export const VOLATILITY_CALENDAR_EVIDENCE = Object.freeze({
  reviewedOn: "2026-10-31",
  url: "https://www.ecb.europa.eu/mopo/implement/omo/shared/pdf/ecb.omocc240725.en.pdf?14e414620fdca3a3d2ca87c9a313a034=",
  ruleUrl: "https://eur-lex.europa.eu/eli/dec/2022/911/2025-10-06/eng",
  summary: "TARGET excludes weekends, New Year, Good Friday, Easter Monday, 1 May, Christmas and 26 December; 2025 Easter closures are 18/21 April.",
});
export function volatilityDates(through: string): string[] {
  const out: string[] = [];
  for (let ms = Date.parse("2025-01-01T12:00:00Z"); ms <= Date.parse(`${through}T12:00:00Z`); ms += 86400000) {
    const date = new Date(ms).toISOString().slice(0, 10), open = operatingDate(date, VOLATILITY_CALENDAR);
    if (open === null) break;
    if (open) out.push(date);
  }
  return out;
}
