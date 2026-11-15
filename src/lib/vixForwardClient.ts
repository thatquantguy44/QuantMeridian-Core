import type { VixForwardResponse } from "@/app/api/market-volatility/vix-forward/route";
import type { VixForwardBasis } from "@/lib/vixImpliedForward";

/** No shared snapshot/cache fallback: every mount or basis change checks the server again. */
export async function fetchVixForward(basis: VixForwardBasis, signal?: AbortSignal): Promise<VixForwardResponse> {
  const res = await fetch(`/api/market-volatility/vix-forward?basis=${basis}`, { cache: "no-store", signal });
  const body = await res.json() as VixForwardResponse;
  if (!res.ok || body?.source === "ERR") throw new Error(body?.error || "VIXR history unavailable.");
  const series = basis === "spy_price" ? "SPY:close" : basis === "spy_total" ? "SPY:total_return_index" : "SP500";
  const validSeries = (rows: unknown) => Array.isArray(rows) && rows.length > 0 && rows.every((row: unknown) =>
    Array.isArray(row) && row.length === 2 && typeof row[0] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row[0]) && typeof row[1] === "number" && Number.isFinite(row[1]) && row[1] > 0);
  if (body?.source !== "DB" || body.error || body.basis !== basis || body.inputs?.priceSeriesId !== series || body.inputs?.vixSeriesId !== "VIXCLS" ||
    body.provenance?.policy !== "observed-inputs-only" || !Number.isFinite(Date.parse(body.provenance?.verifiedAt)) ||
    body.provenance?.vix?.provider !== "Cboe via FRED" || body.provenance?.price?.provider !== (basis === "sp500_index" ? "S&P Dow Jones Indices via FRED" : "Tiingo End-of-Day") ||
    body.provenance?.price?.kind !== (basis === "spy_total" ? "derived total return" : basis === "spy_price" ? "observed close" : "published index") ||
    !validSeries(body.vix) || !validSeries(body.price)) {
    throw new Error("VIXR response has no matching verified provider history; no substitute data displayed.");
  }
  return body;
}
