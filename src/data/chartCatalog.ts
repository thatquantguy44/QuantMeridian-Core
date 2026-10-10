import type { ChartSource } from "@/lib/charting/spec";
import { FRED_CATALOG, ECON_CATEGORY_LABEL } from "@/data/econSeries";

/** A selectable series in a charting studio's picker. */
export interface CatalogItem {
  source: ChartSource;
  id: string;
  label: string;
  sub?: string;     // secondary text (full name / id)
  group: string;    // section in the picker
  assetClass?: string;
}

/**
 * Market instruments for the Market Chart Studio (`MKC`). These resolve to real
 * series via the Market Lens engine: index proxies use committed monthly
 * returns, other ETFs use committed yearly returns, and ^VIX maps to FRED VIXCLS.
 * ETF proxies — labelled as such per the proxy policy.
 */
export const MARKET_CATALOG: CatalogItem[] = [
  // Equity indices (committed monthly)
  { source: "market", id: "SPY", label: "SPY", sub: "S&P 500 (proxy)", group: "US Equity", assetClass: "EQUITY" },
  { source: "market", id: "QQQ", label: "QQQ", sub: "Nasdaq 100 (proxy)", group: "US Equity", assetClass: "EQUITY" },
  { source: "market", id: "IWM", label: "IWM", sub: "Russell 2000 (proxy)", group: "US Equity", assetClass: "EQUITY" },
  { source: "market", id: "DIA", label: "DIA", sub: "Dow Jones (proxy)", group: "US Equity", assetClass: "EQUITY" },
  { source: "market", id: "RSP", label: "RSP", sub: "S&P 500 Equal Weight", group: "US Equity", assetClass: "EQUITY" },
  { source: "market", id: "VTI", label: "VTI", sub: "US Total Market", group: "US Equity", assetClass: "EQUITY" },
  { source: "market", id: "VTV", label: "VTV", sub: "US Value", group: "US Equity", assetClass: "EQUITY" },
  { source: "market", id: "VUG", label: "VUG", sub: "US Growth", group: "US Equity", assetClass: "EQUITY" },
  { source: "market", id: "MTUM", label: "MTUM", sub: "US Momentum", group: "US Equity", assetClass: "EQUITY" },
  // Sectors
  { source: "market", id: "XLK", label: "XLK", sub: "Technology", group: "Sectors", assetClass: "EQUITY" },
  { source: "market", id: "XLF", label: "XLF", sub: "Financials", group: "Sectors", assetClass: "EQUITY" },
  { source: "market", id: "XLE", label: "XLE", sub: "Energy", group: "Sectors", assetClass: "EQUITY" },
  { source: "market", id: "XLY", label: "XLY", sub: "Consumer Discretionary", group: "Sectors", assetClass: "EQUITY" },
  { source: "market", id: "XLV", label: "XLV", sub: "Health Care", group: "Sectors", assetClass: "EQUITY" },
  { source: "market", id: "XLI", label: "XLI", sub: "Industrials", group: "Sectors", assetClass: "EQUITY" },
  { source: "market", id: "XLP", label: "XLP", sub: "Consumer Staples", group: "Sectors", assetClass: "EQUITY" },
  { source: "market", id: "XLU", label: "XLU", sub: "Utilities", group: "Sectors", assetClass: "EQUITY" },
  { source: "market", id: "XLB", label: "XLB", sub: "Materials", group: "Sectors", assetClass: "EQUITY" },
  { source: "market", id: "XLRE", label: "XLRE", sub: "Real Estate", group: "Sectors", assetClass: "REIT" },
  { source: "market", id: "XLC", label: "XLC", sub: "Communication Svcs", group: "Sectors", assetClass: "EQUITY" },
  // High Beta / Crowding
  { source: "market", id: "SMH", label: "SMH", sub: "Semiconductor ETF", group: "High Beta", assetClass: "EQUITY" },
  { source: "market", id: "XBI", label: "XBI", sub: "Biotech ETF", group: "High Beta", assetClass: "EQUITY" },
  { source: "market", id: "ARKK", label: "ARKK", sub: "ARK Innovation ETF", group: "High Beta", assetClass: "EQUITY" },
  // Banks / Funding
  { source: "market", id: "KRE", label: "KRE", sub: "Regional Banks ETF", group: "Banks & Funding", assetClass: "EQUITY" },
  { source: "market", id: "KBE", label: "KBE", sub: "Bank ETF", group: "Banks & Funding", assetClass: "EQUITY" },
  // International
  { source: "market", id: "EFA", label: "EFA", sub: "Developed ex-US (proxy)", group: "International", assetClass: "EQUITY" },
  { source: "market", id: "EEM", label: "EEM", sub: "Emerging Markets (proxy)", group: "International", assetClass: "EQUITY" },
  { source: "market", id: "VGK", label: "VGK", sub: "Europe", group: "International", assetClass: "EQUITY" },
  { source: "market", id: "EWJ", label: "EWJ", sub: "Japan", group: "International", assetClass: "EQUITY" },
  { source: "market", id: "EWG", label: "EWG", sub: "Germany", group: "International", assetClass: "EQUITY" },
  { source: "market", id: "FXI", label: "FXI", sub: "China Large-Cap", group: "International", assetClass: "EQUITY" },
  // Fixed income
  { source: "market", id: "AGG", label: "AGG", sub: "US Aggregate Bond", group: "Fixed Income", assetClass: "BOND" },
  { source: "market", id: "TLT", label: "TLT", sub: "20Y+ Treasury", group: "Fixed Income", assetClass: "BOND" },
  { source: "market", id: "IEF", label: "IEF", sub: "7-10Y Treasury", group: "Fixed Income", assetClass: "BOND" },
  { source: "market", id: "SHY", label: "SHY", sub: "1-3Y Treasury", group: "Fixed Income", assetClass: "BOND" },
  { source: "market", id: "TIP", label: "TIP", sub: "TIPS", group: "Fixed Income", assetClass: "BOND" },
  { source: "market", id: "LQD", label: "LQD", sub: "IG Corporate", group: "Fixed Income", assetClass: "BOND" },
  { source: "market", id: "HYG", label: "HYG", sub: "High Yield", group: "Fixed Income", assetClass: "BOND" },
  { source: "market", id: "JNK", label: "JNK", sub: "HY Bond ETF (SPDR)", group: "Fixed Income", assetClass: "BOND" },
  { source: "market", id: "BKLN", label: "BKLN", sub: "Senior Loan ETF", group: "Fixed Income", assetClass: "BOND" },
  { source: "market", id: "EMB", label: "EMB", sub: "EM Bonds", group: "Fixed Income", assetClass: "BOND" },
  { source: "market", id: "MBB", label: "MBB", sub: "Agency MBS ETF", group: "Fixed Income", assetClass: "BOND" },
  { source: "market", id: "MUB", label: "MUB", sub: "Municipal Bond ETF", group: "Fixed Income", assetClass: "BOND" },
  // Commodities & FX
  { source: "market", id: "GLD", label: "GLD", sub: "Gold", group: "Commodities & FX", assetClass: "COMMODITY" },
  { source: "market", id: "SLV", label: "SLV", sub: "Silver", group: "Commodities & FX", assetClass: "COMMODITY" },
  { source: "market", id: "USO", label: "USO", sub: "Crude Oil", group: "Commodities & FX", assetClass: "COMMODITY" },
  { source: "market", id: "DBC", label: "DBC", sub: "Broad Commodities", group: "Commodities & FX", assetClass: "COMMODITY" },
  { source: "market", id: "UUP", label: "UUP", sub: "US Dollar", group: "Commodities & FX", assetClass: "CURRENCY" },
  { source: "market", id: "FXE", label: "FXE", sub: "Euro Currency ETF", group: "Commodities & FX", assetClass: "CURRENCY" },
  { source: "market", id: "FXY", label: "FXY", sub: "Japanese Yen ETF", group: "Commodities & FX", assetClass: "CURRENCY" },
  // Crypto
  { source: "market", id: "IBIT", label: "IBIT", sub: "iShares Bitcoin Trust", group: "Crypto", assetClass: "EQUITY" },
  // Volatility
  { source: "market", id: "^VIX", label: "VIX", sub: "CBOE Volatility Index", group: "Volatility", assetClass: "VOLATILITY" },
];

/**
 * Macro series for the Economic & Macro Chart Studio (`MGC`), derived from the
 * 72-series FRED catalog and grouped by economic category. Series resolve via
 * /api/chart/series (FRED live when FRED_API_KEY is set, else the econ model).
 */
export const MACRO_CATALOG: CatalogItem[] = FRED_CATALOG.map((s) => ({
  source: "econ" as ChartSource,
  id: s.id,
  label: s.short,
  sub: s.label,
  group: ECON_CATEGORY_LABEL[s.category] ?? s.category,
}));
