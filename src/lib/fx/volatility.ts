import type { FxPairHistory } from "./historyContracts";
import { ANNUALIZATION_FACTOR, VOLATILITY_WINDOWS, type FxVolatilityMetric } from "./volatilityContracts";

/** Mean-centered sample dispersion of observed daily log returns, in decimal units. */
export function sampleLogVolatility(levels: readonly number[]) {
  if (levels.length < 3 || levels.some(value => !Number.isFinite(value) || value <= 0)) throw new Error("INVALID_VOLATILITY_INPUT");
  let count = 0, mean = 0, m2 = 0;
  for (let i = 1; i < levels.length; i++) {
    const value = Math.log(levels[i]) - Math.log(levels[i - 1]);
    const delta = value - mean;
    mean += delta / ++count;
    m2 += delta * (value - mean);
  }
  const dailySigma = Math.sqrt(Math.max(0, m2) / (count - 1));
  const annualizedSigma = dailySigma * Math.sqrt(ANNUALIZATION_FACTOR);
  if (!Number.isFinite(dailySigma) || !Number.isFinite(annualizedSigma)) throw new Error("INVALID_VOLATILITY");
  return { dailySigma, annualizedSigma };
}

/** Points include every expected date; missing dates are explicit, never compressed. */
export function calculateVolatility(pair: Pick<FxPairHistory, "points" | "endpointState" | "endpointReasons">, calendarTruncated = false): FxVolatilityMetric[] {
  const valid = (p: typeof pair.points[number]) => p.state === "OBSERVED" && typeof p.displayLevel === "number" && Number.isFinite(p.displayLevel) && p.displayLevel > 0;
  const firstObserved = pair.points.findIndex(valid);
  return VOLATILITY_WINDOWS.map(window => {
    const start = pair.points.length - window - 1;
    const points = pair.points.slice(Math.max(0, start));
    const first = start >= 0 ? points[0] : null, last = points.at(-1);
    const returnsAvailable = points.slice(1).filter((p, i) => valid(p) && valid(points[i])).length;
    const base = { window, levelsRequired: window + 1, levelsAvailable: points.filter(valid).length, returnsAvailable,
      startDate: first?.observationDate ?? null, endDate: last?.observationDate ?? null,
      firstReturn: first && points[1] ? { startDate: first.observationDate, endDate: points[1].observationDate } : null,
      lastReturn: points.length > 1 ? { startDate: points.at(-2)!.observationDate, endDate: last!.observationDate } : null,
      calendarDays: first && last ? (Date.parse(last.observationDate) - Date.parse(first.observationDate)) / 86_400_000 : null };
    const issue = (code: string, message: string) => [{ code, message }];
    let reasons = pair.endpointState === "DEGRADED" ? issue("STALE_ENDPOINT", "The latest endpoint is stale; current volatility is unavailable.")
      : pair.endpointState !== "ELIGIBLE" ? [...issue("ENDPOINT_UNAVAILABLE", "The latest endpoint is not admitted."), ...pair.endpointReasons]
        : points.some(p => p.state === "BLOCKED" || p.state === "OBSERVED" && !valid(p) || p.reasons.some(r => r.code === "MISSING_OBSERVATION")) ? issue("HISTORY_GAP", "Invalid, missing or conflicting evidence occurs inside this window.")
          : start < 0 && calendarTruncated ? issue("HISTORY_CALENDAR_TRUNCATED", "The requested window extends beyond reviewed historical calendar coverage.")
            : start < 0 || firstObserved < 0 || start < firstObserved ? issue("INSUFFICIENT_HISTORY", `This window requires ${window + 1} consecutive qualified levels.`)
              : returnsAvailable !== window ? issue("HISTORY_GAP", "The window has a gap; returns are not bridged or imputed.") : [];
    let result: { dailySigma: number; annualizedSigma: number } | null = null;
    if (!reasons.length) {
      try { result = sampleLogVolatility(points.map(p => p.displayLevel!)); }
      catch { reasons = issue("INVALID_VOLATILITY", "The volatility calculation is not finite."); }
    }
    return { ...base, state: reasons.length ? "UNAVAILABLE" : "AVAILABLE", dailySigma: result?.dailySigma ?? null,
      annualizedSigma: result?.annualizedSigma ?? null, reasons };
  });
}
