# Handoff: SIM-to-Live Data Wiring

> Track builds that wire deterministic simulation widgets to live market/economic pipelines.

**Created:** 2026-06-24
**Plan:** [`docs/SIM_TO_LIVE_UPGRADE_PLAN.md`](../SIM_TO_LIVE_UPGRADE_PLAN.md)
**Branch:** `claude/bold-noether-h3mc2l`
**Status:** Completed — archived from active handoffs

---

## Build Tracker

### Tier 1 — Directly Wireable (existing hooks + data sources)

| # | Build | Page(s) | Pipeline | Status |
|---|-------|---------|----------|--------|
| 1 | [Dashboard live indices](#build-1-dashboard-live-indices) | `/`, `/markets` | FRED + market_data_pipeline | [x] Complete |
| 2 | [Liquidity early warning signals](#build-2-liquidity-early-warning-signals) | `/liquidity` | FRED (SOFR, EFFR, HY OAS) | [x] Complete |
| 3 | [Fear/greed live components](#build-3-feargreed-live-components) | `/sentiment` | FRED (OAS, curve, momentum) | [x] Complete |
| 4 | [Dashboard heatmap & movers from pipeline](#build-4-dashboard-heatmap--movers-from-pipeline) | `/` | market_data_pipeline | [x] Complete |
| 5 | [Cash optimizer live funding rates](#build-5-cash-optimizer-live-funding-rates) | `/cash-optimizer` | FRED (SOFR, CP, DFF) | [x] Complete |
| 6 | [Reinvestment live yield curves](#build-6-reinvestment-live-yield-curves) | `/reinvestment` | FRED (Treasury curve) | [x] Complete |
| 7 | [Markets quote board live overlay](#build-7-markets-quote-board-live-overlay) | `/markets` | market_data_pipeline | [x] Complete |
| 8 | [Rates RV live z-scores](#build-8-rates-rv-live-z-scores) | `/economics/curve` | Curve history (already fetched) | [x] Complete |
| 9 | [Macro regime live classification](#build-9-macro-regime-live-classification) | `/economics/regime` | FRED (8-10 series) | [x] Complete |
| 10 | [Alert live triggers](#build-10-alert-live-triggers) | `/alerts` | FRED (5+ series) | [x] Complete |

### Tier 2 — Partial Upgrades (price overlays, rate columns)

| # | Build | Page(s) | Pipeline | Status |
|---|-------|---------|----------|--------|
| 11 | [SecLending inventory price overlay](#build-11-seclending-inventory-price-overlay) | `/securities-lending` | market_data_pipeline | [x] Complete |
| 12 | [Collateral & PF mark-to-market overlay](#build-12-collateral--pf-mark-to-market-overlay) | `/collateral`, `/prime-finance` | market_data_pipeline | [ ] Not started |
| 13 | [Squeeze radar short interest (Yahoo)](#build-13-squeeze-radar-short-interest) | `/securities-lending/squeeze` | Yahoo Finance (new) | [ ] Not started |

### Config-Only (no code changes)

| # | Item | Env Var | Status |
|---|------|---------|--------|
| C1 | News headlines live | `ALPHA_VANTAGE_KEY` or `MARKETAUX_KEY` | [ ] Document in README |
| C2 | Social intelligence live | Reddit/StockTwits API keys | [ ] Document in README |
| C3 | AAII survey snapshot | `npm run export:aaii-snapshot` | [ ] Verify CLI exists |

### Tier 3 — Remains SIM (proprietary data, no public source)

These are documented but not actionable from public pipelines:

| Page | Widget Category | Reason |
|------|----------------|--------|
| Trading Desk | PnL, execution, risk, e-trading | OMS/EMS integration needed |
| Optimization | Solver runs, duals, trades | Internal solver needed |
| Sources & Uses | Matching engine | Internal ledger needed |
| Securities Lending | Loan book, borrow requests | Vendor feed needed |
| Prime Finance | Client data, financing | Internal PB systems |
| Liquidity | Cash buckets, facilities, stress | Internal treasury |
| Copilot | All summaries | Aggregates proprietary data |
| ML Models | Model inference | Trained models needed |

---

## Build Details

### Build 1: Dashboard Live Indices

**Goal:** Replace SIM `getIndices()` with live data from FRED + market pipeline on the dashboard and markets pages.

**FRED series to wire:**
- `VIXCLS` (VIX), `DTWEXBGS` (DXY), `DGS10` (10Y yield), `SOFR`
- `GOLDPMGBD228NLBM` (Gold), `DCOILWTICO` (WTI Oil)

**Pipeline data:** `useMarketView("market")` cards provide SPX, NDX, INDU, RUT, BTC returns.

**Files to modify:**
- `src/data/markets.ts` — add `mergeLiveIndices(sim, fredData, pipelineData)` function
- `src/app/page.tsx` — add `useLiveSeriesSet()` + `useMarketView()` calls, merge into `getIndices()` fallback
- `src/app/markets/page.tsx` — same pattern (partially done already via `mergeIndexQuotes`)

**Acceptance:** Index values match FRED when key is set; SIM fallback when not.

---

### Build 2: Liquidity Early Warning Signals

**Goal:** Wire the 4 FRED/Yahoo-sourced early warning signals to live data.

**FRED series to wire:**
- `SOFR` and `EFFR` → compute SOFR−EFFR spread
- `BAMLH0A0HYM2` → HY OAS level, compute 5d move
- `VIXCLS` → equity drawdown proxy (optional, via VIX level)

**Files to modify:**
- `src/data/liquidity.ts` — add `mergeLiveEWS(signals, fredData)` that patches live values into the signal objects
- `src/app/liquidity/page.tsx` — add `useLiveSeriesSet(["SOFR", "EFFR", "BAMLH0A0HYM2"], "lin", 10)` call

**Acceptance:** EWS table shows live values with FRED badge when key is set; SIM otherwise.

---

### Build 3: Fear/Greed Live Components

**Goal:** Feed FRED data into the sentiment composite's market-based sub-scores.

**FRED series:**
- `BAMLH0A0HYM2` (HY OAS) → Junk Bond Demand sub-score
- `DGS10`, `DGS2` → Safe Haven Demand (yield curve steepness)
- `VIXCLS` → already wired

**Files to modify:**
- `src/data/sentiment.ts` — modify `getSentimentIndex()` to accept optional live inputs for each component
- `src/app/sentiment/page.tsx` — fetch FRED series, pass to composite

**Acceptance:** Composite index reflects live market conditions when FRED key is set. Individual component badges show FRED vs SIM.

---

### Build 4: Dashboard Heatmap & Movers from Pipeline

**Goal:** When market pipeline is configured, derive heatmap and movers from live snapshot data.

**Data source:** `useMarketView("market")` → `SnapshotCard[]` with 1D returns.

**Files to modify:**
- `src/data/markets.ts` — add `heatmapFromCards(cards)` and `moversFromCards(cards)` mapping functions
- `src/app/page.tsx` — add `useMarketView("market")` call, use live-derived heatmap/movers when available

**Acceptance:** Heatmap shows real sector performance when pipeline is configured.

---

### Build 5: Cash Optimizer Live Funding Rates

**Goal:** Overlay live money market rates onto the funding source rate column.

**FRED series:**
- `SOFR` → GC Repo rate
- `DCPF3M` → Commercial Paper rate (3M financial)
- `DFF` → Fed Funds effective → Operating Cash proxy

**Files to modify:**
- `src/data/cash.ts` — add `mergeLiveFundingRates(sources, fredData)` function
- `src/app/cash-optimizer/page.tsx` — add `useLiveSeriesSet()`, merge into funding sources

**Acceptance:** Rate column shows live FRED rates; cost calculations update accordingly.

---

### Build 6: Reinvestment Live Yield Curves

**Goal:** Feed live Treasury yields into reinvestment assumption curves.

**FRED series:** `DGS3MO`, `DGS6MO`, `DGS1`, `DGS2`, `DGS5`, `DGS10`

**Files to modify:**
- `src/data/reinvestment.ts` — add function to patch position yields from live curve
- `src/app/reinvestment/page.tsx` — add `useLiveSeriesSet()`, pass to reinvestment data

**Acceptance:** Reinvestment rates reflect current Treasury curve; scenario analysis uses live base rates.

---

### Build 7: Markets Quote Board Live Overlay

**Goal:** Extend the existing `cardsToQuotes()` merge in markets page to cover more fields.

**Current state:** Page already has `useMarketView` and `cardsToQuotes()` but only overlays top-level asset class cards. The full quote board still uses SIM.

**Files to modify:**
- `src/app/markets/page.tsx` — expand `cardsToQuotes()` to map pipeline cards onto the DataGrid quote rows (price, change, return)

**Acceptance:** Quote board prices match pipeline snapshot when configured.

---

### Build 8: Rates RV Live Z-Scores

**Goal:** Compute butterfly z-scores from historical curve data instead of random draws.

**Data source:** `useCurveSnapshots()` already fetches historical curve points from FRED.

**Files to modify:**
- `src/data/ratesRV.ts` — add `computeButterfliesFromHistory(currentSnap, historicalSnaps)` that computes rolling butterfly values and derives z-scores/percentiles from the actual distribution

**Acceptance:** When curve history is live, butterfly z-scores reflect actual historical positioning.

---

### Build 9: Macro Regime Live Classification

**Goal:** Classify macro regime from live FRED indicators instead of seeded regime.

**FRED series (inputs to regime model):**
- Growth: `PAYEMS` (change), `INDPRO` (change), `GDPC1`
- Inflation: `CPIAUCSL` (YoY), `CPILFESL` (YoY)
- Policy: `DFF`, `DGS10`, `T10Y2Y`
- Credit: `BAMLC0A0CM` (IG OAS), `BAMLH0A0HYM2` (HY OAS)

**Files to modify:**
- `src/data/macroRegime.ts` — add `computeLiveRegime(fredData)` that classifies growth/inflation quadrant from latest observations
- `src/app/economics/regime/page.tsx` — add `useLiveSeriesSet()` for regime inputs, call live classifier

**Acceptance:** Regime quadrant updates from real indicators; playbooks adjust to live regime.

---

### Build 10: Alert Live Triggers

**Goal:** Evaluate alert thresholds against live FRED data.

**Approach:** Map alert rule definitions to FRED series IDs. When live data is available, compute threshold crossings from latest observations.

**FRED series:** Depends on alert definitions — primarily `SOFR`, `VIXCLS`, `BAMLH0A0HYM2`, `DGS10`, `T10Y2Y`.

**Files to modify:**
- `src/data/alerts.ts` — add `fredSeriesForAlert(alert)` mapping and `evaluateLiveAlerts(alerts, fredData)` function
- `src/app/alerts/page.tsx` — add `useLiveSeriesSet()`, merge live trigger values into alert objects

**Acceptance:** Alerts fire based on real FRED values when key is set.

---

### Build 11: SecLending Inventory Price Overlay

**Goal:** Overlay live market prices on the securities lending inventory's `marketValue` column.

**Data source:** `useMarketView("market")` → match by ticker to get current prices.

**Files to modify:**
- `src/app/securities-lending/page.tsx` — add `useMarketView` hook, patch `marketValue` on inventory rows when live prices available

**Acceptance:** Market value column uses live prices when pipeline is configured.

---

### Build 12: Collateral & PF Mark-to-Market Overlay

**Goal:** Overlay live asset prices on collateral and prime finance exposure calculations.

**Data source:** `useMarketView("market")` for equity prices; FRED for Treasury/bond benchmarks.

**Files to modify:**
- `src/app/collateral/page.tsx` — add price overlay for asset valuations
- `src/app/prime-finance/page.tsx` — add price overlay for exposure mark-to-market

**Acceptance:** Exposure and valuation columns reflect live prices when available.

---

### Build 13: Squeeze Radar Short Interest

**Goal:** Wire Yahoo Finance short interest data into the squeeze radar.

**Approach:** This requires adding a Yahoo Finance short interest API call to the market pipeline or a dedicated API route.

**Files to modify:**
- New: `src/app/api/market/short-interest/route.ts` — fetch short interest from Yahoo Finance
- `src/data/squeeze.ts` — add `mergeShortInterest(board, liveData)` function
- `src/app/securities-lending/squeeze/page.tsx` — add fetch call, merge into squeeze board

**Acceptance:** Short interest % and days-to-cover use real data when available.

---

## Changelog

| Date | Build | Action | Commit |
|------|-------|--------|--------|
| 2026-06-24 | — | Initial plan and handoff created | `7acf61c` |
| 2026-06-24 | 1, 2, 5, 6 | Wire FRED into dashboard indices, liquidity EWS, cash rates, reinvestment yields | `91f9287` |
| 2026-06-24 | 3, 8, 9 | Wire FRED into sentiment composite, rates RV z-scores, macro regime | `d2aa75f` |
| 2026-06-24 | SIM raw | Add SIM raw level fallback for inflation drill-throughs (indicators, batch, series routes) | — |
| 2026-06-24 | 7 | Markets quote board: expand pipeline overlay to all asset-class tabs | — |
| 2026-06-24 | 10 | Alert live triggers: threshold evaluation against FRED series (VIX, HY OAS, 10Y, T10Y2Y) | — |
| 2026-06-24 | 11 | SecLending inventory: overlay live market prices on market value column | — |
