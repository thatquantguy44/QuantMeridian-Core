import type { Citation } from "@/lib/marketVolatility";
import { BASIS_OPTIONS, type SeriesTuple, type VixForwardBasis } from "@/lib/vixImpliedForward";
import { bronzeTable, goldEnabled, goldParam, goldStore, goldTable, silverTable } from "@/lib/server/goldStore";
import { verifyHistory, VixSourceError, type HistoryRow, type SourceRow, type VixForwardProvenance } from "@/lib/server/vixForwardHistory";
import { json } from "@/lib/server/http";

export const runtime = "nodejs";
export interface VixForwardResponse {
  source: "DB" | "ERR";
  basis: VixForwardBasis;
  vix: SeriesTuple[];
  price: SeriesTuple[];
  inputs: {
    vixSeriesId: "VIXCLS"; priceSeriesId: string; priceLabel: string;
    vixFirst: string | null; vixLast: string | null; priceFirst: string | null; priceLast: string | null;
  };
  provenance: VixForwardProvenance | null;
  citations: Citation[];
  warnings: string[];
  error?: string;
}
const PRICE_SOURCE = {
  spy_price: { column: "close", seriesId: "SPY:close" },
  spy_total: { column: "total_return_index", seriesId: "SPY:total_return_index" },
  sp500_index: { column: "value", seriesId: "SP500" },
} as const;
const CITATIONS: Record<string, Citation> = {
  VIXCLS: { seriesId: "VIXCLS", title: "CBOE Volatility Index: VIX", source: "Cboe via FRED", url: "https://fred.stlouisfed.org/series/VIXCLS", note: "Published daily index; 30-day expected S&P 500 volatility, annualized. Pre-September-2003 values are Cboe’s historical back-calculation from option quotes." },
  VIX_HISTORY: { seriesId: "VIX_HISTORY", title: "VIX historical calculation disclosure", source: "Cboe filing published by the SEC", url: "https://www.sec.gov/rules/sro/cboe/34-48807.pdf", note: "The revised VIX was introduced in September 2003, with historical index values calculated back to January 2, 1990." },
  SP500: { seriesId: "SP500", title: "S&P 500 price index", source: "S&P Dow Jones Indices via FRED", url: "https://fred.stlouisfed.org/series/SP500", note: "Daily close, excluding dividends; FRED provides the latest ten years." },
  SPY: { seriesId: "SPY", title: "SPY daily prices and corporate actions", source: "Tiingo End-of-Day → pipeline → Gold", url: "https://www.tiingo.com/documentation/end-of-day", note: "Price uses close. Total return is calculated from close, divCash and splitFactor, starting at 100; it is not Tiingo adjClose or an official S&P total-return index." },
  SPY_FUND: { seriesId: "SPY_FUND", title: "SPY fund reference", source: "State Street (fund issuer; not the price-feed provider)", url: "https://www.ssga.com/us/en/institutional/etfs/state-street-spdr-sp-500-etf-trust-spy" },
};
export function parseBasis(value: string | null): VixForwardBasis | null {
  if (value === null) return "spy_price";
  return BASIS_OPTIONS.some((option) => option.id === value) ? value as VixForwardBasis : null;
}
function response(basis: VixForwardBasis, history: ReturnType<typeof verifyHistory> | null, warnings: string[], error?: string): VixForwardResponse {
  const vix = history?.vix ?? [], price = history?.price ?? [];
  return {
    source: history && !error ? "DB" : "ERR", basis, vix, price,
    inputs: { vixSeriesId: "VIXCLS", priceSeriesId: PRICE_SOURCE[basis].seriesId, priceLabel: BASIS_OPTIONS.find((option) => option.id === basis)!.label,
      vixFirst: vix[0]?.[0] ?? null, vixLast: vix.at(-1)?.[0] ?? null, priceFirst: price[0]?.[0] ?? null, priceLast: price.at(-1)?.[0] ?? null },
    provenance: history?.provenance ?? null,
    citations: [CITATIONS.VIXCLS, CITATIONS.VIX_HISTORY, ...(basis === "sp500_index" ? [CITATIONS.SP500] : [CITATIONS.SPY, CITATIONS.SPY_FUND])],
    warnings: error ? [...warnings, error] : warnings, ...(error ? { error } : {}),
  };
}
function send(body: VixForwardResponse, status = 200): Response {
  return json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export async function GET(req: Request) {
  const basis = parseBasis(new URL(req.url).searchParams.get("basis"));
  if (!basis) return send(response("spy_price", null, [], "Unsupported return basis; no alternate series selected."), 400);
  if (!goldEnabled()) return send(response(basis, null, [], "MACRO_DB_URL not configured."), 503);
  try {
    const sourceIds = ["VIXCLS", ...(basis === "sp500_index" ? ["SP500"] : basis === "spy_price" ? ["SPY:close"] : ["SPY:close", "SPY:divCash", "SPY:splitFactor"])];
    const [vixRows, priceRows, sourceRows] = await Promise.all([
      goldStore().raw<HistoryRow>(`SELECT observation_date AS date, value FROM ${goldTable("fred_latest_observation")} WHERE series_id = ${goldParam(1)} AND value IS NOT NULL ORDER BY observation_date ASC`, ["VIXCLS"]),
      basis === "sp500_index"
        ? goldStore().raw<HistoryRow>(`SELECT observation_date AS date, value FROM ${goldTable("fred_latest_observation")} WHERE series_id = ${goldParam(1)} AND value IS NOT NULL ORDER BY observation_date ASC`, ["SP500"])
        : goldStore().raw<HistoryRow>(`SELECT observation_date AS date, ${PRICE_SOURCE[basis].column} AS value, close, dividend, split_factor FROM ${goldTable("equity_total_return_index")} WHERE ticker = ${goldParam(1)} ORDER BY observation_date ASC`, ["SPY"]),
      goldStore().raw<SourceRow>(`SELECT s.source, s.series_id, s.observation_date, s.value, s.raw_value, s.is_missing, s.row_hash, s.run_id, s.ingested_at,
          b.run_id AS receipt_run_id, b.endpoint AS receipt_endpoint
        FROM ${silverTable("fred_observation")} s
        LEFT JOIN ${bronzeTable("fred_api_response")} b ON b.source = s.source AND b.run_id = s.run_id
          AND b.series_id = CASE WHEN s.source = 'tiingo' THEN 'SPY' ELSE s.series_id END
        WHERE s.series_id IN (${sourceIds.map((_, i) => goldParam(i + 1)).join(", ")}) AND s.source IN ('fred', 'tiingo')
        ORDER BY s.observation_date ASC`, sourceIds),
    ]);
    const history = verifyHistory(basis, vixRows, priceRows, sourceRows);
    const warnings = ["Retained daily history, not a live quote feed. Missing or unreconciled provider evidence blocks results; no simulated, synthetic, snapshot or alternate-feed fallback."];
    if (basis === "sp500_index") warnings.push("FRED provides only the latest ten years of S&P 500 daily history; select SPY for longer retained coverage.");
    for (const [label, last] of [["VIX", history.vix.at(-1)![0]], [PRICE_SOURCE[basis].seriesId, history.price.at(-1)![0]]]) {
      const age = Math.floor((Date.now() - Date.parse(`${last}T00:00:00Z`)) / 86400000);
      if (age > 5) warnings.push(`${label} history is ${age} calendar days behind today (through ${last}).`);
    }
    return send(response(basis, history, warnings));
  } catch (err) {
    console.warn("[market-volatility/vix-forward] History/source verification failed:", err instanceof VixSourceError ? err.message : err instanceof Error ? err.name : "Unknown failure");
    const error = err instanceof VixSourceError ? err.message : "Gold history or provider evidence unavailable. Check database connectivity and retained source records.";
    return send(response(basis, null, [], error), 503);
  }
}
