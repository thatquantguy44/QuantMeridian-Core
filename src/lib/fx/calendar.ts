import type { FxFreshness } from "./contracts";

export const CALENDAR_VERSION = "ecb-target-2026-2028/1";
export const TARGET_CLOSURES: Record<string, readonly string[]> = {
  "2026": ["01-01", "04-03", "04-06", "05-01", "12-25", "12-26"],
  "2027": ["01-01", "03-26", "03-29", "05-01", "12-25", "12-26"],
  "2028": ["01-01", "04-14", "04-17", "05-01", "12-25", "12-26"],
};
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
function localParts(at: number) {
  const p = Object.fromEntries(formatter.formatToParts(at).map(part => [part.type, part.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
export function operatingDate(date: string, calendar = TARGET_CLOSURES): boolean | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(`${date}T12:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) return null;
  const closures = calendar[date.slice(0, 4)];
  if (!closures) return null;
  const day = new Date(ms).getUTCDay();
  return day !== 0 && day !== 6 && !closures.includes(date.slice(5));
}
function shift(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
function deadline(date: string) {
  const guess = Date.parse(`${date}T17:00:00Z`);
  return new Date(guess - (localParts(guess).minutes - 17 * 60) * 60_000).toISOString();
}
export function calendarAt(at: string, calendar = TARGET_CLOSURES, version = CALENDAR_VERSION): FxFreshness {
  const ms = Date.parse(at);
  if (!Number.isFinite(ms)) throw new Error("INVALID_CLOCK");
  const { date } = localParts(ms);
  let expectedDate: string | null = null;
  let nextCheckAt: string | null = null;
  if (operatingDate(date, calendar) !== null) {
    for (let i = 0; i < 12; i++) {
      const d = shift(date, -i), open = operatingDate(d, calendar);
      if (open === null) break;
      if (open && Date.parse(deadline(d)) <= ms) { expectedDate = d; break; }
    }
    for (let i = 0; i < 12; i++) {
      const d = shift(date, i), open = operatingDate(d, calendar);
      if (open === null) break;
      if (open && Date.parse(deadline(d)) > ms) { nextCheckAt = deadline(d); break; }
    }
  }
  return { evaluatedAt: at, localDate: date, expectedDate, nextCheckAt,
    deadline: "17:00 Europe/Berlin", calendarVersion: version };
}
