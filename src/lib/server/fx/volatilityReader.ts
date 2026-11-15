import { calendarAt } from "@/lib/fx/calendar";
import { volatilityDates } from "@/lib/fx/volatilityCalendar";
import type { GoldStore } from "../goldStore";
import { readGoldWindowRows } from "./historyReader";
import { MAX_VOLATILITY_ROWS } from "./volatility";

export async function readGoldVolatilityRows(store: GoldStore, startedAt: string) {
  const clock = calendarAt(startedAt);
  if (!clock.expectedDate || !clock.nextCheckAt) throw new Error("FRESHNESS_CALENDAR_UNKNOWN");
  return readGoldWindowRows(store, volatilityDates(clock.localDate), 253, MAX_VOLATILITY_ROWS);
}
