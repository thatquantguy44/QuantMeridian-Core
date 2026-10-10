# Benchmark Rate Analysis — Module Group Handoff

> This document is a **build plan and prompt** for four new analytics modules that extend the existing Benchmark Rates (`BMRK`) module. Hand this to Claude Code (or any AI assistant) when you are ready to build each module. Each module reuses the same `SeriesMap` data layer and pure-function analytics pattern established by BMRK.

**Module Group:** Benchmark Rate Analysis  
**Parent Module:** `BMRK` — Benchmark Rates (`/economics/benchmark`)  
**Created:** 2026-06-24  
**Status:** Completed — BMRK/BRA/YCURV/RVOL/FCOST/UTIL are integrated

---

## Architecture Overview

All three modules share the same foundation:

```
SeriesMap (Record<string, Obs[]>)
  │
  ├─ BMRK  — Status, trend, spread analysis (BUILT)
  ├─ YCURV — Yield curve construction & analytics
  ├─ FCOST — Blended funding cost monitor
  ├─ RVOL  — Rate volatility surface & regime detection
  └─ UTIL  — Securities lending utilization & custom benchmark blends
```

### Shared Patterns

1. **Data layer:** Each module imports from `src/data/benchmarkRates.ts` for series definitions and `SeriesMap`/`Obs` types. New analytics go into dedicated data files (e.g., `src/data/yieldCurveAnalytics.ts`).
2. **Data fetching:** Each page calls `useLiveSeriesSet(IDS, "lin", N)` and merges with `buildFallback(N)` — identical to BMRK.
3. **Pure analytics:** All computations are pure functions over `SeriesMap`. No side effects, no data source coupling. Works identically on FRED, database, or SIM input.
4. **PDF export:** Each module gets a dedicated PDF builder (e.g., `src/lib/yieldCurvePdf.ts`) using the shared `PdfReport` class from `src/lib/pdfReport.ts`.
5. **API route:** Each module gets a route under `/api/econ/` using the FRED → SNAPSHOT → SIM cascade.
6. **Nav entry:** Each module registers in `src/lib/nav.ts` under `group: "ECONOMICS"` and a route in `src/App.tsx` under the economics DrillProvider.

### Existing Infrastructure to Reuse

| Asset | Location | What It Provides |
|-------|----------|-----------------|
| Series definitions (33 rates) | `src/data/benchmarkRates.ts` | `BENCHMARK_SERIES`, `BenchmarkDef`, `defOf()`, `simSeries()` |
| Core types | `src/data/benchmarkRates.ts` | `SeriesMap`, `Obs`, `BenchmarkCategory`, `BenchmarkUnit` |
| Trend engine | `src/data/benchmarkRates.ts` | `computeTrend()` — 1/5/20/60/120d changes, MAs, percentile, range |
| Spread engine | `src/data/benchmarkRates.ts` | `computeSpread()`, `computeAllSpreads()`, `SPREAD_PAIRS` |
| Correlation engine | `src/data/benchmarkRates.ts` | `computeCorrelation()` — N×N matrix from daily returns |
| Regime classifier | `src/data/benchmarkRates.ts` | `classifyRegime()` — Tightening/Restrictive/Neutral/Easing/Accommodative |
| Status board | `src/data/benchmarkRates.ts` | `computeStatusBoard()` — traffic-light per rate |
| PDF report builder | `src/lib/pdfReport.ts` | `PdfReport` class with `kpiStrip`, `table`, `metricRows`, `captureElement`, `sectionTitle` |
| BMRK PDF generator | `src/lib/benchmarkPdf.ts` | Reference implementation for tab-aware PDF export |
| Batch API route | `src/app/api/econ/benchmark/route.ts` | FRED → SNAPSHOT → SIM cascade pattern |
| Data hook | `src/lib/useEcon.ts` | `useLiveSeriesSet(ids, units, n)` for batch FRED fetching |
| Existing curve module | `src/data/econCurve.ts` | `CurveSnapshot`, `getCurveMetrics()` — snapshot-based, not time-series |
| Existing curve RV | `src/data/ratesRV.ts` | `computeButterflies()`, `computeSpreadZScores()`, `computeCarryRoll()` |
| Securities lending | `src/data/securitiesLending.ts` | `InventoryRow` (utilization, feeBps, classification), `getLoanBook()`, `getSLSummary()` |
| Squeeze radar | `src/data/squeeze.ts` | `SqueezeRow` (utilization, heat, feeMom, shortInterest), `getSqueezeBoard()`, `getSectorHeat()` |
| Security universe | `src/data/universe.ts` | `LENDABLE`, `BORROWERS`, `Security` (ticker, sector, assetClass, borrowFee, hardToBorrow) |

### Differentiation from Existing Modules

| Existing Module | What It Does | What the New Module Adds |
|----------------|-------------|------------------------|
| **CURV** (Curve Lab) | Point-in-time curve snapshots, inversion detection | **YCURV** adds daily curve *time series* — track shape metrics over months, animate curve evolution, regime transitions |
| **FUND** (Funding) | Repo corridor, reserve balances, FX basis | **FCOST** adds *blended cost* by counterparty tier, all-in borrowing rates, desk-level funding attribution |
| **BMRK** (Benchmark) | Per-rate trend/status/spread | **RVOL** adds *volatility as a first-class metric* — vol surface, vol regimes, vol-of-vol, term structure of vol |
| **SLAB** (Sec Lending) | Per-name inventory, loan book, revenue | **UTIL** adds *aggregate utilization analytics* — sector/class-level utilization time series, benchmark rate overlays, custom rate blends, rate-sensitivity analysis |
| **SQZ** (Squeeze Radar) | Per-name squeeze scoring, heat signals | **UTIL** adds *macro lens* — how benchmark rate moves drive aggregate utilization, not individual name signals |

---

## Module 1: YCURV — Yield Curve Constructor

**Code:** `YCURV`  
**Label:** Yield Curve Analytics  
**Route:** `/economics/yield-curve`  
**Description:** Daily yield curve construction, shape analytics & regime tracking

### Purpose

Track how the entire curve shape evolves over time — not just individual rates (BMRK) or a single snapshot (CURV), but the daily progression of slope, curvature, and butterfly metrics with historical context.

### Files to Create

| File | Purpose |
|------|---------|
| `src/data/yieldCurveAnalytics.ts` | Pure analytics engine — curve construction, shape metrics, regime detection |
| `src/app/economics/yield-curve/page.tsx` | Full analytics page — 3 tabs |
| `src/lib/yieldCurvePdf.ts` | PDF export for YCURV module |
| `src/app/api/econ/yield-curve/route.ts` | API route (optional — can share BMRK batch endpoint) |

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/nav.ts` | Add `{ code: "YCURV", label: "Yield Curve Analytics", href: "/economics/yield-curve", icon: Spline, desc: "Daily curve shape, slope history & regime shifts", group: "ECONOMICS" }` |
| `src/App.tsx` | Add import and `<Route path="yield-curve" element={<EconYieldCurve />} />` in economics group |

### Series Required

All from existing `BENCHMARK_SERIES` Treasury category — no new FRED IDs needed:

```typescript
const CURVE_TENORS = ["DGS1MO", "DGS3MO", "DGS6MO", "DGS1", "DGS2", "DGS5", "DGS10", "DGS20", "DGS30"];
const TENOR_YEARS = [1/12, 3/12, 6/12, 1, 2, 5, 10, 20, 30];
```

### Analytics Engine — `yieldCurveAnalytics.ts`

#### Types

```typescript
export interface CurvePoint {
  tenor: string;       // "DGS1MO", "DGS2", etc.
  years: number;       // 0.083, 2, etc.
  yield: number | null;
}

export interface DailyCurve {
  date: string;
  points: CurvePoint[];
  slope2s10s: number | null;    // DGS10 - DGS2 in bps
  slope3m10y: number | null;    // DGS10 - DGS3MO in bps
  curvature: number | null;     // 2*DGS5 - DGS2 - DGS10 in bps (butterfly body)
  longEnd: number | null;       // DGS30 - DGS10 in bps
}

export interface CurveShapeMetrics {
  current: DailyCurve;
  history: DailyCurve[];        // full daily history
  slope2s10s: TrendMetrics;     // reuse BMRK's TrendMetrics
  slope3m10y: TrendMetrics;
  curvature: TrendMetrics;
  longEnd: TrendMetrics;
  inversions: InversionSegment[];
  regime: CurveRegime;
}

export type CurveRegime =
  | "Bull Steepening"    // yields falling, long end falling less → curve steepens
  | "Bear Steepening"    // yields rising, short end rising less → curve steepens
  | "Bull Flattening"    // yields falling, long end falling more → curve flattens
  | "Bear Flattening"    // yields rising, short end rising more → curve flattens
  | "Inversion Deepening"
  | "Inversion Unwinding"
  | "Stable";

export interface InversionSegment {
  pair: string;         // e.g., "2s10s"
  startDate: string;
  endDate: string | null; // null if still inverted
  maxDepthBps: number;
  currentBps: number | null;
}

export interface ButterflyTrade {
  label: string;        // e.g., "2-5-10 Butterfly"
  wings: [string, string]; // short tenor, long tenor
  body: string;           // middle tenor
  valueBps: number | null;
  zScore: number | null;
  percentile: number | null;
  signal: "rich" | "cheap" | "fair";
}
```

#### Functions

```typescript
// Build daily curve from SeriesMap — one DailyCurve per date
export function buildCurveHistory(map: SeriesMap): DailyCurve[]

// Compute full shape analytics
export function computeCurveShape(map: SeriesMap): CurveShapeMetrics

// Classify the current curve regime from recent moves
export function classifyCurveRegime(history: DailyCurve[], lookback?: number): CurveRegime

// Find all inversion segments across common pairs
export function findInversions(history: DailyCurve[]): InversionSegment[]

// Compute standard butterfly trades with z-scores
export function computeButterflies(map: SeriesMap): ButterflyTrade[]

// Compare two curves (e.g., today vs 30 days ago) — returns per-tenor diff in bps
export function curveDiff(a: DailyCurve, b: DailyCurve): { tenor: string; years: number; diffBps: number }[]

// Interpolate a par yield at an arbitrary maturity (linear on log-years)
export function interpolateYield(curve: DailyCurve, years: number): number | null
```

### Page Layout — 3 Tabs

#### Tab 1: Curve Shape

| Panel | Content |
|-------|---------|
| **KPI Strip** | 2s10s Slope (bps), 3m10Y Slope, Curvature, Long End, Curve Regime |
| **Live Curve Chart** | Interactive yield curve with current + overlays (1W ago, 1M ago, 1Y ago) |
| **Curve Diff Bar Chart** | Per-tenor change in bps over selected period |
| **Shape Metrics Grid** | slope2s10s, slope3m10y, curvature, longEnd — each with current, change, percentile, z-score |

#### Tab 2: Slope History

| Panel | Content |
|-------|---------|
| **Slope Time Series** | Line chart of 2s10s and 3m10y slopes over time with zero-line and inversion shading |
| **Curvature Time Series** | Butterfly body (2-5-10) over time |
| **Inversion Tracker** | DataGrid of all inversion episodes — pair, start, end, duration, max depth |
| **Regime Timeline** | Color-coded bar showing Bull Steep / Bear Flat / etc. transitions |

#### Tab 3: Relative Value

| Panel | Content |
|-------|---------|
| **Butterfly Trades** | DataGrid of standard butterfly spreads with z-scores and rich/cheap signals |
| **Carry & Roll** | Per-tenor carry (3M horizon) and rolldown in bps — reuse `computeCarryRoll()` from `ratesRV.ts` |
| **Curve Correlation** | Heatmap of daily yield changes across tenors (reuse `computeCorrelation()` from BMRK) |

### PDF Export

```typescript
// src/lib/yieldCurvePdf.ts
export interface YcurvPdfOptions {
  map: SeriesMap;
  source: string;
  tab: "shape" | "slopes" | "rv";
  timeRange: string;
  curveChartRef?: HTMLElement | null;
  slopeChartRef?: HTMLElement | null;
}

export async function generateYieldCurvePdf(opts: YcurvPdfOptions): Promise<void>
```

### Database Extension

When wired to a database, the curve constructor can pull from the same `daily_benchmark_rates` table used by BMRK — just filter to Treasury series. No new tables needed unless you want to store pre-computed curve metrics:

```sql
-- Optional: pre-computed daily curve metrics
CREATE TABLE daily_curve_metrics (
  observation_date DATE NOT NULL,
  slope_2s10s     DECIMAL(10,4),
  slope_3m10y     DECIMAL(10,4),
  curvature_2510  DECIMAL(10,4),
  long_end_1030   DECIMAL(10,4),
  regime          VARCHAR(30),
  PRIMARY KEY (observation_date)
);
```

---

## Module 2: FCOST — Funding Cost Monitor

**Code:** `FCOST`  
**Label:** Funding Cost Monitor  
**Route:** `/economics/funding-cost`  
**Description:** Blended borrowing costs by counterparty tier & desk attribution

### Purpose

Translate raw benchmark rates into actionable *cost of funds* for different counterparty quality tiers. A treasury or funding desk doesn't think in terms of "SOFR is 4.82%" — they think "our AA-rated counterparties can borrow at SOFR + IG OAS = X, while our BBB clients are at SOFR + BBB OAS = Y." This module builds those composites, tracks them over time, and attributes funding costs to business desks.

### Files to Create

| File | Purpose |
|------|---------|
| `src/data/fundingCost.ts` | Pure analytics — tier definitions, composite rate construction, desk attribution |
| `src/app/economics/funding-cost/page.tsx` | Full analytics page — 3 tabs |
| `src/lib/fundingCostPdf.ts` | PDF export for FCOST module |

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/nav.ts` | Add `{ code: "FCOST", label: "Funding Cost Monitor", href: "/economics/funding-cost", icon: Banknote, desc: "Blended borrowing costs by tier & desk attribution", group: "ECONOMICS" }` |
| `src/App.tsx` | Add import and route |

### Series Required

All from existing `BENCHMARK_SERIES` — no new FRED IDs:

```typescript
// Base rates (overnight)
const BASE_RATES = ["SOFR", "EFFR", "OBFR"];

// Credit spreads (added on top of base)
const CREDIT_SPREADS = ["BAMLC0A1CAAA", "BAMLC0A0CM", "BAMLC0A4CBBB", "BAMLH0A0HYM2"];

// Term structure (for term funding costs)
const TERM_RATES = ["DGS1MO", "DGS3MO", "DGS1", "DGS2", "DGS5"];

// Mortgage (end-user cost benchmark)
const MORTGAGE_RATES = ["MORTGAGE30US", "MORTGAGE15US"];
```

### Analytics Engine — `fundingCost.ts`

#### Types

```typescript
export type CreditTier = "Sovereign" | "AA" | "A" | "BBB" | "HY" | "Secured";

export interface TierDefinition {
  id: CreditTier;
  label: string;
  baseRate: string;          // FRED series ID for base rate
  spreadSeries: string | null; // FRED series ID for credit spread (null = no spread)
  spreadMultiplier: number;    // 1.0 for direct, 0.5 for partial, etc.
  fixedSpreadBps: number;      // fallback or additional fixed spread
  color: string;               // chart color
}

export interface TierCost {
  tier: TierDefinition;
  baseRate: number | null;
  spreadBps: number | null;
  allInRate: number | null;     // base + spread in %
  allInBps: number | null;      // same in bps
  chg1d: number | null;         // daily change in bps
  chg20d: number | null;        // 20-day change in bps
  percentile: number | null;    // 2-year percentile
  zScore: number | null;
  history: number[];            // daily all-in rate history
  dates: string[];
}

export type DeskId = "SLAB" | "COLL" | "CASH" | "REINV" | "PB" | "REPO";

export interface DeskFundingProfile {
  desk: DeskId;
  label: string;
  primaryTier: CreditTier;        // dominant counterparty quality
  weightedCostBps: number | null;  // blended cost across tiers
  tierBreakdown: { tier: CreditTier; weight: number; costBps: number | null }[];
  vsYesterday: number | null;      // change in bps
  vs20dAgo: number | null;
  signal: "cheap" | "normal" | "expensive";
}

export interface FundingCostSummary {
  sovrRate: number | null;
  aaAllIn: number | null;
  bbbAllIn: number | null;
  hyAllIn: number | null;
  securedRate: number | null;
  spreadCompression: number | null;  // IG-HY spread narrowing/widening vs 20d ago
  regime: string;                     // "Tight" | "Normal" | "Wide" | "Stress"
}

export interface TermFundingLadder {
  tenor: string;        // "O/N", "1M", "3M", "1Y", "2Y", "5Y"
  years: number;
  secured: number | null;   // Treasury rate
  aa: number | null;        // Treasury + AAA OAS
  bbb: number | null;       // Treasury + BBB OAS
  hy: number | null;        // Treasury + HY OAS
}
```

#### Functions

```typescript
// Default tier definitions — configurable for different institutions
export const DEFAULT_TIERS: TierDefinition[]

// Compute all-in cost for each tier from SeriesMap
export function computeTierCosts(map: SeriesMap, tiers?: TierDefinition[]): TierCost[]

// Compute desk-level funding attribution
export function computeDeskFunding(map: SeriesMap): DeskFundingProfile[]

// Build term funding ladder (O/N through 5Y) by credit tier
export function computeTermLadder(map: SeriesMap): TermFundingLadder[]

// Summary KPIs
export function computeFundingCostSummary(map: SeriesMap): FundingCostSummary

// Compute spread between two tiers over time (e.g., HY - AA)
export function computeTierSpread(costs: TierCost[], tierA: CreditTier, tierB: CreditTier): SpreadResult

// Classify funding regime from tier spreads and levels
export function classifyFundingRegime(costs: TierCost[]): "Tight" | "Normal" | "Wide" | "Stress"
```

#### Tier Definitions (Default)

```typescript
export const DEFAULT_TIERS: TierDefinition[] = [
  { id: "Sovereign", label: "Sovereign / Agency",    baseRate: "SOFR",  spreadSeries: null,              spreadMultiplier: 0, fixedSpreadBps: 0,  color: "#3B9DFF" },
  { id: "Secured",   label: "Secured (Repo/GC)",     baseRate: "BGCR",  spreadSeries: null,              spreadMultiplier: 0, fixedSpreadBps: -2, color: "#22D3EE" },
  { id: "AA",        label: "AA-Rated Unsecured",     baseRate: "SOFR",  spreadSeries: "BAMLC0A1CAAA",   spreadMultiplier: 1, fixedSpreadBps: 5,  color: "#2ECC71" },
  { id: "A",         label: "A-Rated Unsecured",      baseRate: "SOFR",  spreadSeries: "BAMLC0A0CM",     spreadMultiplier: 1, fixedSpreadBps: 0,  color: "#A78BFA" },
  { id: "BBB",       label: "BBB-Rated Unsecured",    baseRate: "SOFR",  spreadSeries: "BAMLC0A4CBBB",   spreadMultiplier: 1, fixedSpreadBps: 0,  color: "#FFB400" },
  { id: "HY",        label: "High Yield / Sub-IG",    baseRate: "SOFR",  spreadSeries: "BAMLH0A0HYM2",   spreadMultiplier: 1, fixedSpreadBps: 0,  color: "#FF3B3B" },
];
```

### Page Layout — 3 Tabs

#### Tab 1: Cost Dashboard

| Panel | Content |
|-------|---------|
| **KPI Strip** | Secured Rate, AA All-In, BBB All-In, HY All-In, IG-HY Spread, Funding Regime |
| **Tier Cost Chart** | Stacked/multi-line chart of all-in rates by tier over time |
| **Tier Comparison Grid** | DataGrid — tier, base rate, spread, all-in, change 1D/20D, percentile, z-score |
| **Term Funding Ladder** | Heatmap or grid showing cost by tenor (rows) × credit tier (columns) |

#### Tab 2: Desk Attribution

| Panel | Content |
|-------|---------|
| **Desk Funding Grid** | DataGrid — desk, primary tier, weighted cost, vs yesterday, vs 20d ago, signal |
| **Desk Cost Bar Chart** | Horizontal bar chart comparing weighted funding cost across desks |
| **Tier Breakdown** | Per-desk pie/donut showing tier weight mix |
| **Cost Trend by Desk** | Multi-line chart of each desk's blended cost over time |

#### Tab 3: Spread Analysis

| Panel | Content |
|-------|---------|
| **Tier Spread Chart** | Time series of key inter-tier spreads (HY-IG, BBB-AA, Secured-Unsecured) |
| **Spread Stats Grid** | Current, mean, z-score, percentile for each tier pair |
| **Funding Stress Indicator** | Composite gauge from HY OAS level + tier spread widening + volatility |
| **Historical Regime Timeline** | Color bar showing Tight/Normal/Wide/Stress transitions |

### Database Extension

FCOST uses the same `daily_benchmark_rates` table as BMRK. Optional additions:

```sql
-- Desk funding profiles (if desk weights come from an external system)
CREATE TABLE desk_funding_weights (
  desk_id      VARCHAR(10) NOT NULL,
  credit_tier  VARCHAR(20) NOT NULL,
  weight       DECIMAL(5,4) NOT NULL,
  effective_date DATE NOT NULL,
  PRIMARY KEY (desk_id, credit_tier, effective_date)
);

-- Custom tier definitions per institution
CREATE TABLE funding_tier_config (
  tier_id          VARCHAR(20) PRIMARY KEY,
  label            VARCHAR(100),
  base_rate_series VARCHAR(30),
  spread_series    VARCHAR(30),
  spread_mult      DECIMAL(5,3) DEFAULT 1.0,
  fixed_spread_bps DECIMAL(10,2) DEFAULT 0
);
```

---

## Module 3: RVOL — Rate Volatility Surface

**Code:** `RVOL`  
**Label:** Rate Volatility  
**Route:** `/economics/rate-vol`  
**Description:** Realized volatility surface, vol regimes & term structure of vol

### Purpose

Rate levels and spreads are necessary but not sufficient — the *volatility* of those rates matters for risk management, option pricing, and regime detection. This module computes realized volatility across all benchmark rates, builds a term structure of vol (short-dated rates are typically less volatile than long-dated), and detects vol regime shifts.

### Files to Create

| File | Purpose |
|------|---------|
| `src/data/rateVolatility.ts` | Pure analytics — rolling vol, vol-of-vol, vol surface, regime detection |
| `src/app/economics/rate-vol/page.tsx` | Full analytics page — 3 tabs |
| `src/lib/rateVolPdf.ts` | PDF export for RVOL module |

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/nav.ts` | Add `{ code: "RVOL", label: "Rate Volatility", href: "/economics/rate-vol", icon: Activity, desc: "Realized vol surface, vol regimes & vol-of-vol", group: "ECONOMICS" }` |
| `src/App.tsx` | Add import and route |

### Series Required

All from existing `BENCHMARK_SERIES` — no new FRED IDs. Vol is computed from daily changes of existing series.

### Analytics Engine — `rateVolatility.ts`

#### Types

```typescript
export type VolWindow = 5 | 10 | 20 | 60 | 120;

export interface RealizedVol {
  seriesId: string;
  def: BenchmarkDef;
  windows: Record<VolWindow, VolMetrics>;
  volOfVol20d: number | null;        // vol of the 20d rolling vol
  currentVsHistoric: "low" | "normal" | "elevated" | "extreme";
  percentile: number | null;         // 2-year percentile of 20d vol
  volTrend: "rising" | "falling" | "stable";
}

export interface VolMetrics {
  window: VolWindow;
  annualized: number | null;         // annualized realized vol in bps (rates) or % (commodities)
  raw: number | null;                // non-annualized stdev of daily changes
  history: number[];                 // rolling vol time series
  dates: string[];
  zScore: number | null;             // current vs 2-year mean
  percentile: number | null;
}

export interface VolSurface {
  seriesIds: string[];                // x-axis (e.g., tenor points)
  windows: VolWindow[];               // y-axis (lookback windows)
  grid: (number | null)[][];          // [windowIdx][seriesIdx]
  labels: string[];                   // display labels for x-axis
}

export type VolRegime = "Low Vol" | "Normal" | "Elevated" | "Vol Storm";

export interface VolRegimeResult {
  regime: VolRegime;
  score: number;                      // 0-100
  drivers: string[];                  // what's contributing
  transition: "stable" | "rising" | "falling";
  daysInRegime: number;
}

export interface VolConePoint {
  window: VolWindow;
  current: number | null;
  min: number | null;
  p25: number | null;
  median: number | null;
  p75: number | null;
  max: number | null;
}

export interface VolCone {
  seriesId: string;
  points: VolConePoint[];             // one per window
}

export interface CrossAssetVol {
  seriesId: string;
  label: string;
  vol20d: number | null;
  vol60d: number | null;
  volRatio: number | null;            // vol20d / vol60d — >1 means vol is rising
  percentile: number | null;
  regime: "low" | "normal" | "elevated" | "extreme";
}
```

#### Functions

```typescript
// Compute realized vol for a single series across all windows
export function computeRealizedVol(obs: Obs[], def: BenchmarkDef): RealizedVol

// Compute realized vol for all benchmark series
export function computeAllVols(map: SeriesMap): RealizedVol[]

// Build the vol surface (tenor × window grid) for a category
export function buildVolSurface(map: SeriesMap, ids: string[], windows?: VolWindow[]): VolSurface

// Compute the vol cone (percentile bands across windows) for a single series
export function computeVolCone(obs: Obs[], def: BenchmarkDef): VolCone

// Classify overall vol regime from cross-asset vol levels
export function classifyVolRegime(vols: RealizedVol[]): VolRegimeResult

// Cross-asset vol comparison (normalized for unit differences)
export function computeCrossAssetVol(map: SeriesMap): CrossAssetVol[]

// Vol-of-vol: rolling stdev of 20d realized vol
export function computeVolOfVol(obs: Obs[], innerWindow?: VolWindow, outerWindow?: number): number | null

// Correlation of vol changes across rates (do vols move together?)
export function volCorrelation(map: SeriesMap, ids: string[], window?: number): CorrelationResult
```

#### Vol Computation Method

```typescript
// Daily changes for rates in % → absolute change (not log return)
// Daily changes for bps series → absolute change
// Daily changes for $/bbl, $/oz → log return
// Annualization: stdev * sqrt(252)
// Vol expressed in: bps for rate series, % for commodity series
```

### Page Layout — 3 Tabs

#### Tab 1: Vol Dashboard

| Panel | Content |
|-------|---------|
| **KPI Strip** | Vol Regime, Avg 20D Vol (bps), Vol Trend, # Elevated, # Extreme, Vol-of-Vol |
| **Cross-Asset Vol Grid** | DataGrid — rate, category, 5d vol, 20d vol, 60d vol, percentile, vol ratio (20/60), regime tag |
| **Vol Heatmap** | Color-coded grid: rates (rows) × windows (columns), darker = higher vol |
| **Top Vol Movers** | Bar chart of biggest 20d vol changes (rising or falling) |

#### Tab 2: Vol Surface & Cone

| Panel | Content |
|-------|---------|
| **Vol Surface Chart** | 3D or heatmap — Treasury tenors (x) × vol windows (y) → vol level (color/z) |
| **Vol Cone** | Per-series fan chart showing current vol vs historical percentile bands across windows |
| **Term Structure of Vol** | Line chart of 20d vol by tenor — typically upward-sloping for rates |
| **Surface Change** | Diff heatmap: today's surface minus 20-day-ago surface |

#### Tab 3: Vol Regime

| Panel | Content |
|-------|---------|
| **Regime Classification** | Current regime with score, drivers, and days-in-regime |
| **Regime Timeline** | Historical bar showing Low/Normal/Elevated/Storm transitions |
| **Vol Clustering** | Correlation matrix of vol changes across rates — identifies contagion |
| **Regime Playbook** | Per-regime desk implications (same pattern as BMRK regime) |

### Vol Regime Classification Logic

```typescript
// Score 0-100 based on:
// - % of rates with 20d vol > 75th percentile (weight 30)
// - Average z-score of 20d vols (weight 25)
// - Vol-of-vol level (weight 20)
// - Number of rates with vol ratio > 1.5 (weight 15)
// - Cross-asset vol correlation (weight 10)
//
// Regime thresholds:
// 0-25:  "Low Vol"
// 25-50: "Normal"
// 50-75: "Elevated"
// 75+:   "Vol Storm"
```

### Database Extension

No new tables needed for vol — it's computed from the same `daily_benchmark_rates` data. Optional pre-computation:

```sql
-- Pre-computed daily vol metrics (avoids recomputation on every page load for large histories)
CREATE TABLE daily_rate_volatility (
  observation_date DATE NOT NULL,
  series_id        VARCHAR(30) NOT NULL,
  vol_5d           DECIMAL(10,4),
  vol_10d          DECIMAL(10,4),
  vol_20d          DECIMAL(10,4),
  vol_60d          DECIMAL(10,4),
  vol_120d         DECIMAL(10,4),
  vol_of_vol_20d   DECIMAL(10,4),
  percentile_2y    INTEGER,
  PRIMARY KEY (observation_date, series_id)
);
```

---

## Module 4: UTIL — Securities Lending Utilization & Custom Benchmarks

**Code:** `UTIL`  
**Label:** Utilization Analytics  
**Route:** `/economics/utilization`  
**Description:** Aggregate lending utilization, benchmark rate overlays & custom rate blends

### Purpose

Securities lending desks track utilization at the individual name level (SLAB) and monitor squeeze risk (SQZ), but there is no macro view of *how aggregate utilization moves with benchmark rates*. When SOFR rises, do overnight GC utilization rates follow? When credit spreads widen, does HTB supply dry up? This module provides that macro lens — aggregate utilization time series by sector, asset class, and classification, overlaid with daily benchmark rates. It also lets users build custom blended benchmarks (e.g., "60% SOFR + 40% BGCR" or "SOFR + 0.5 × IG OAS") and track those blends over time against utilization.

### Files to Create

| File | Purpose |
|------|---------|
| `src/data/utilizationAnalytics.ts` | Pure analytics — utilization aggregation, time series, benchmark correlation, custom blends |
| `src/app/economics/utilization/page.tsx` | Full analytics page — 4 tabs |
| `src/lib/utilizationPdf.ts` | PDF export for UTIL module |
| `src/app/api/econ/utilization/route.ts` | API route for utilization time series (optional — can be computed client-side from existing data) |

### Files to Modify

| File | Change |
|------|--------|
| `src/lib/nav.ts` | Add `{ code: "UTIL", label: "Utilization Analytics", href: "/economics/utilization", icon: Gauge, desc: "Lending utilization, benchmark overlays & custom rate blends", group: "ECONOMICS" }` |
| `src/App.tsx` | Add import and `<Route path="utilization" element={<EconUtilization />} />` in economics group |

### Data Sources

This module bridges two data domains:

```
┌─────────────────────────┐     ┌──────────────────────────┐
│  Securities Lending     │     │  Benchmark Rates         │
│  ─────────────────      │     │  ──────────────          │
│  InventoryRow[]         │     │  SeriesMap (33 rates)    │
│    • utilization %      │     │    • SOFR, EFFR, BGCR    │
│    • feeBps             │     │    • DGS2, DGS10, DGS30  │
│    • classification     │     │    • IG OAS, HY OAS      │
│  SqueezeRow[]           │     │    • Mortgage, Commodity  │
│    • heat score         │     │                          │
│    • feeHist (daily)    │     │  Custom Blends           │
│    • sector aggregates  │     │    • User-defined combos │
│  SLSummary              │     │    • Weighted composites  │
│    • total utilization  │     │                          │
└─────────────────────────┘     └──────────────────────────┘
         │                                │
         └────────── UTIL Module ─────────┘
              Overlay · Correlate · Blend
```

### Analytics Engine — `utilizationAnalytics.ts`

#### Types

```typescript
import type { SeriesMap, Obs, BenchmarkDef } from "@/data/benchmarkRates";
import type { InventoryRow } from "@/data/securitiesLending";
import type { SqueezeRow, SectorHeat } from "@/data/squeeze";

// ── Utilization Time Series ──────────────────────────────────────────

export type UtilGroupBy = "sector" | "assetClass" | "classification" | "source" | "all";

export interface UtilizationSnapshot {
  date: string;
  groups: Record<string, UtilGroupMetrics>;
  overall: UtilGroupMetrics;
}

export interface UtilGroupMetrics {
  utilization: number;        // weighted average utilization %
  totalOnLoan: number;        // market value on loan
  totalAvailable: number;     // market value available
  avgFeeBps: number;          // weighted average fee
  nameCount: number;          // number of securities
  htbCount: number;           // number classified HTB
  specialCount: number;       // number classified SPECIAL
}

export interface UtilizationTimeSeries {
  groupKey: string;           // "Technology" or "EQUITY" or "HTB" or "ALL"
  groupBy: UtilGroupBy;
  history: Obs[];             // date + utilization %
  feeHistory: Obs[];          // date + avg fee bps
  current: UtilGroupMetrics;
  trend: TrendMetrics;        // reuse BMRK TrendMetrics on utilization time series
}

// ── Custom Benchmark Blends ──────────────────────────────────────────

export interface BlendComponent {
  seriesId: string;           // FRED series ID or custom ID
  weight: number;             // decimal weight (e.g., 0.6 for 60%)
  label: string;              // display label
}

export interface CustomBlend {
  id: string;                 // unique blend ID
  name: string;               // user-facing name, e.g. "Repo Funding Blend"
  components: BlendComponent[];
  spreadBps: number;          // additional fixed spread in bps (e.g., +25bps)
  description: string;
}

export interface BlendResult {
  blend: CustomBlend;
  history: Obs[];             // computed daily blend values
  current: number | null;
  chg1d: number | null;
  chg20d: number | null;
  percentile: number | null;
  zScore: number | null;
  trend: TrendMetrics;
}

// ── Benchmark-Utilization Correlation ────────────────────────────────

export interface RateUtilCorrelation {
  rateId: string;
  rateLabel: string;
  utilGroup: string;          // sector or classification
  correlation: number | null; // Pearson correlation of daily changes
  beta: number | null;        // regression beta: 1bps rate move → X% util change
  rSquared: number | null;
  window: number;             // lookback days
  interpretation: string;     // "Strong positive" / "Weak negative" / etc.
}

// ── Rate Sensitivity ─────────────────────────────────────────────────

export interface RateSensitivity {
  rateId: string;
  rateLabel: string;
  impact: "positive" | "negative" | "neutral";
  magnitude: "low" | "moderate" | "high";
  beta: number | null;
  description: string;        // e.g., "Rising SOFR → higher GC utilization"
}

export interface UtilSummary {
  overallUtil: number | null;
  htbUtil: number | null;
  gcUtil: number | null;
  avgFeeBps: number | null;
  utilTrend: "rising" | "falling" | "stable";
  topSensitivity: string;     // most correlated benchmark rate
  blendCount: number;         // number of active custom blends
}

// ── Preset Blends ────────────────────────────────────────────────────

export const PRESET_BLENDS: CustomBlend[] = [
  {
    id: "gc-funding",
    name: "GC Funding Rate",
    components: [
      { seriesId: "SOFR", weight: 0.5, label: "SOFR" },
      { seriesId: "BGCR", weight: 0.3, label: "BGCR" },
      { seriesId: "TGCR", weight: 0.2, label: "TGCR" },
    ],
    spreadBps: 0,
    description: "Weighted average of secured overnight rates — proxy for GC repo funding cost",
  },
  {
    id: "unsecured-short",
    name: "Unsecured Short-Term",
    components: [
      { seriesId: "EFFR", weight: 0.6, label: "EFFR" },
      { seriesId: "OBFR", weight: 0.4, label: "OBFR" },
    ],
    spreadBps: 10,
    description: "Blended unsecured overnight rate with 10bps institutional spread",
  },
  {
    id: "lending-rebate",
    name: "Lending Rebate Benchmark",
    components: [
      { seriesId: "SOFR", weight: 1.0, label: "SOFR" },
    ],
    spreadBps: -15,
    description: "SOFR minus 15bps — typical GC rebate rate for securities lending",
  },
  {
    id: "htb-cost",
    name: "HTB Borrowing Cost",
    components: [
      { seriesId: "SOFR", weight: 1.0, label: "SOFR" },
      { seriesId: "BAMLH0A0HYM2", weight: 0.01, label: "HY OAS (scaled)" },
    ],
    spreadBps: 200,
    description: "Approximated all-in cost of borrowing hard-to-borrow names",
  },
  {
    id: "term-reinvest",
    name: "Term Reinvestment Yield",
    components: [
      { seriesId: "DGS3MO", weight: 0.5, label: "3M T-Bill" },
      { seriesId: "DGS1", weight: 0.3, label: "1Y Treasury" },
      { seriesId: "DGS2", weight: 0.2, label: "2Y Treasury" },
    ],
    spreadBps: 0,
    description: "Blended short-duration reinvestment benchmark for cash collateral",
  },
];
```

#### Functions

```typescript
// ── Utilization Aggregation ──────────────────────────────────────────

// Build utilization time series by group (sector, asset class, classification, source)
// Uses InventoryRow[] from securitiesLending.ts + SqueezeRow[] for feeHist
export function buildUtilizationTimeSeries(
  inventory: InventoryRow[],
  squeezeBoard: SqueezeRow[],
  groupBy: UtilGroupBy
): UtilizationTimeSeries[]

// Current snapshot of utilization across all groups
export function computeUtilizationSnapshot(
  inventory: InventoryRow[],
  groupBy: UtilGroupBy
): UtilizationSnapshot

// Summary KPIs
export function computeUtilSummary(
  inventory: InventoryRow[],
  blends: BlendResult[]
): UtilSummary

// ── Custom Benchmark Blends ──────────────────────────────────────────

// Compute a custom blend's daily time series from SeriesMap
export function computeBlend(map: SeriesMap, blend: CustomBlend): BlendResult

// Compute all preset + user blends
export function computeAllBlends(
  map: SeriesMap,
  presets?: CustomBlend[],
  userBlends?: CustomBlend[]
): BlendResult[]

// Validate a blend definition (weights sum to reasonable range, all series exist)
export function validateBlend(blend: CustomBlend, availableIds: string[]): string[]  // returns error messages

// ── Rate-Utilization Correlation ─────────────────────────────────────

// Correlate benchmark rate changes with utilization changes
export function computeRateUtilCorrelation(
  map: SeriesMap,
  utilSeries: UtilizationTimeSeries[],
  rateIds: string[],
  window?: number
): RateUtilCorrelation[]

// Rate sensitivity analysis — which benchmark rates most affect utilization
export function computeRateSensitivity(
  map: SeriesMap,
  utilSeries: UtilizationTimeSeries[]
): RateSensitivity[]

// ── Overlay Helpers ──────────────────────────────────────────────────

// Normalize a rate series and a utilization series to [0,100] for overlay charting
export function normalizeForOverlay(
  rateObs: Obs[],
  utilObs: Obs[],
  rangeDays: number
): { ratePct: number[]; utilPct: number[]; dates: string[] }
```

### Page Layout — 4 Tabs

#### Tab 1: Utilization Dashboard

| Panel | Content |
|-------|---------|
| **KPI Strip** | Overall Util %, HTB Util %, GC Util %, Avg Fee (bps), Util Trend, SOFR (cross-ref) |
| **Utilization by Sector** | Horizontal bar chart — sector utilization % with HTB/SPECIAL counts |
| **Utilization by Classification** | Donut chart — GC / WARM / SPECIAL / HTB share of on-loan MV |
| **Utilization Heatmap** | Sector (rows) × Classification (columns) → utilization % (color intensity) |
| **Top Utilization Names** | DataGrid — top 20 by utilization with fee, classification, sector, sparkline |

#### Tab 2: Benchmark Overlay

| Panel | Content |
|-------|---------|
| **Dual-Axis Chart** | Left axis: aggregate utilization % — Right axis: selected benchmark rate. User selects rate from dropdown. Shared time axis. |
| **Rate Selection** | TermSelect dropdown of all 33 BMRK rates + custom blends |
| **Time Range** | TermToggleGroup: 1M / 3M / 6M / 1Y / 2Y |
| **Correlation Grid** | DataGrid — each benchmark rate's correlation with overall/HTB/GC utilization, beta, R², interpretation |
| **Rate Sensitivity Panel** | Ranked list of which rates most affect utilization, with direction and magnitude badges |
| **Scatter Plot** | Daily rate change (x) vs daily utilization change (y) for selected rate — visual correlation |

#### Tab 3: Custom Blends

| Panel | Content |
|-------|---------|
| **Preset Blends Grid** | DataGrid — blend name, current value, chg 1D/20D, percentile, z-score, description |
| **Blend Builder** | Interactive form: add/remove components (series + weight), set fixed spread, name the blend. Preview chart updates live. |
| **Blend Chart** | Line chart of selected blend over time, with optional utilization overlay |
| **Blend Comparison** | Multi-line chart comparing multiple blends on same axis |
| **Blend vs Utilization** | Dual-axis chart of selected blend vs selected utilization group |
| **Active Blends** | Saved user blends stored in localStorage, editable and deletable |

**Blend Builder UI Detail:**

```
┌─────────────────────────────────────────────────────────────────┐
│ BLEND BUILDER                                           [Save] │
├─────────────────────────────────────────────────────────────────┤
│ Name: [Custom Repo Blend_____]                                 │
│                                                                 │
│ Components:                                                     │
│  ┌──────────────────┬────────┬────────┐                         │
│  │ Series           │ Weight │        │                         │
│  ├──────────────────┼────────┼────────┤                         │
│  │ SOFR      [▼]    │ 60%    │ [✕]    │                         │
│  │ BGCR      [▼]    │ 30%    │ [✕]    │                         │
│  │ EFFR      [▼]    │ 10%    │ [✕]    │                         │
│  └──────────────────┴────────┴────────┘                         │
│  [+ Add Component]         Total: 100%                          │
│                                                                 │
│ Fixed Spread: [+25] bps                                         │
│                                                                 │
│ Preview: ════════════════════════════════════                    │
│          4.82% (current)  +0.3bps (1D)  P62 (percentile)       │
└─────────────────────────────────────────────────────────────────┘
```

#### Tab 4: Rate Impact Analysis

| Panel | Content |
|-------|---------|
| **Scenario Builder** | What-if: "If SOFR moves +25bps, what happens to utilization?" Uses regression betas from correlation analysis. |
| **Impact Grid** | DataGrid — for each utilization group (sector/class), estimated change from a rate shock |
| **Historical Parallels** | Find past episodes where the selected rate moved a similar amount, show what utilization did |
| **Regime Cross-Reference** | Current BMRK regime → expected utilization behavior (table mapping regimes to utilization patterns) |
| **Desk Playbook** | Per-regime lending strategy notes (e.g., "Tightening → expect GC util to rise, widen rebate spreads") |

### Custom Blend Persistence

User-created blends are stored in `localStorage` under key `bmrk-custom-blends`:

```typescript
// Read/write helpers
export function loadUserBlends(): CustomBlend[] {
  const raw = localStorage.getItem("bmrk-custom-blends");
  return raw ? JSON.parse(raw) : [];
}

export function saveUserBlends(blends: CustomBlend[]): void {
  localStorage.setItem("bmrk-custom-blends", JSON.stringify(blends));
}

export function deleteUserBlend(id: string): void {
  const blends = loadUserBlends().filter((b) => b.id !== id);
  saveUserBlends(blends);
}
```

### PDF Export

```typescript
// src/lib/utilizationPdf.ts
export interface UtilPdfOptions {
  map: SeriesMap;
  inventory: InventoryRow[];
  squeezeBoard: SqueezeRow[];
  blends: BlendResult[];
  source: string;
  tab: "dashboard" | "overlay" | "blends" | "impact";
  groupBy: UtilGroupBy;
  selectedRate: string;
  selectedBlend: string;
  timeRange: string;
  chartRef?: HTMLElement | null;
  overlayChartRef?: HTMLElement | null;
  blendChartRef?: HTMLElement | null;
}

export async function generateUtilizationPdf(opts: UtilPdfOptions): Promise<void>
```

### Database Extension

UTIL uses two data domains that may come from different sources:

```sql
-- Utilization history (new table — not in BMRK)
CREATE TABLE daily_utilization (
  observation_date DATE        NOT NULL,
  group_type       VARCHAR(20) NOT NULL,  -- 'sector', 'assetClass', 'classification', 'all'
  group_key        VARCHAR(50) NOT NULL,  -- 'Technology', 'EQUITY', 'HTB', 'ALL'
  utilization_pct  DECIMAL(8,4),
  avg_fee_bps      DECIMAL(10,4),
  on_loan_mv       DECIMAL(18,2),
  available_mv     DECIMAL(18,2),
  name_count       INTEGER,
  htb_count        INTEGER,
  special_count    INTEGER,
  PRIMARY KEY (observation_date, group_type, group_key)
);

-- Custom blend definitions (optional — can also live in localStorage or app config)
CREATE TABLE custom_blend_definitions (
  blend_id    VARCHAR(30) PRIMARY KEY,
  name        VARCHAR(100),
  description TEXT,
  spread_bps  DECIMAL(10,2) DEFAULT 0,
  created_by  VARCHAR(100),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE custom_blend_components (
  blend_id   VARCHAR(30) NOT NULL REFERENCES custom_blend_definitions(blend_id),
  series_id  VARCHAR(30) NOT NULL,
  weight     DECIMAL(5,4) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (blend_id, series_id)
);

-- Benchmark rates come from the existing daily_benchmark_rates table (shared with BMRK)
```

### Provider Interface Extension

```typescript
interface UtilizationProvider {
  // Utilization time series by group
  getUtilizationHistory(
    groupType: UtilGroupBy,
    groupKey: string,
    n: number
  ): Promise<Obs[]>;

  // All groups for a given groupType
  getUtilizationSnapshot(
    groupType: UtilGroupBy,
    date?: string
  ): Promise<UtilizationSnapshot>;

  // Custom blends from DB (supplements localStorage)
  getCustomBlends(): Promise<CustomBlend[]>;
  saveCustomBlend(blend: CustomBlend): Promise<void>;
  deleteCustomBlend(id: string): Promise<void>;

  source: string;
}
```

---

## Implementation Order

### Recommended Sequence

```
Phase 1: YCURV (Yield Curve Analytics)
  - Reuses the most existing data (all Treasury tenors already in BMRK)
  - Reuses computeTrend() and computeCorrelation() directly
  - Partially overlaps with existing ratesRV.ts — can import helpers
  - Estimated: ~500 LOC analytics, ~600 LOC page

Phase 2: RVOL (Rate Volatility)
  - Pure computation layer on top of existing SeriesMap
  - No new data fetching — vol is derived from daily changes
  - Vol regime feeds back into BMRK's regime classifier (optional enhancement)
  - Estimated: ~400 LOC analytics, ~550 LOC page

Phase 3: FCOST (Funding Cost Monitor)
  - Most "applied" module — maps rates to business use cases
  - Depends on desk definitions that may need customization per deployment
  - Tier definitions should be configurable (DEFAULT_TIERS is just a starting point)
  - Estimated: ~450 LOC analytics, ~600 LOC page

Phase 4: UTIL (Utilization Analytics)
  - Bridges securities lending + benchmark rates — the two data domains
  - Depends on BMRK data layer + existing securitiesLending.ts and squeeze.ts
  - Custom blend builder is the most interactive component — needs localStorage persistence
  - Blend engine is reusable by FCOST (custom funding cost blends)
  - Estimated: ~550 LOC analytics, ~750 LOC page (4 tabs + blend builder UI)
```

### Cross-Module Integration (Post-Build)

After all four are built, these optional enhancements connect them:

| Enhancement | What It Does |
|-------------|-------------|
| BMRK regime → RVOL vol regime | Combine rate level regime + vol regime into a composite "market state" |
| YCURV curve regime → FCOST | Show how curve shape changes affect term funding costs |
| RVOL vol → FCOST stress | Elevated vol triggers wider funding cost estimates (vol-adjusted spreads) |
| UTIL blends → FCOST tiers | Custom blends can serve as tier-specific funding benchmarks |
| UTIL correlation → BMRK status | Flag rates whose moves most affect utilization in BMRK status board |
| UTIL utilization → SQZ squeeze | Feed aggregate utilization trends into squeeze scoring |
| Unified PDF | "Benchmark Rate Analysis" PDF combining highlights from all 5 modules |
| Shared alert rules | BMRK/YCURV/RVOL/FCOST/UTIL each contribute threshold rules to the Alert Center |

### Shared Module Nav Group

All five modules should appear as a visual sub-group in the sidebar. Update `src/lib/nav.ts` ordering so they cluster:

```
ECONOMICS group:
  ...existing econ modules...
  ── Benchmark Rate Analysis ──
  BMRK  — Benchmark Rates
  YCURV — Yield Curve Analytics
  FCOST — Funding Cost Monitor
  RVOL  — Rate Volatility
  UTIL  — Utilization Analytics
```

---

## Database Handoff Notes

The modules share two data domains:

### Benchmark Rates (shared by BMRK, YCURV, FCOST, RVOL, UTIL)

```sql
CREATE TABLE daily_benchmark_rates (
  observation_date DATE        NOT NULL,
  series_id        VARCHAR(30) NOT NULL,
  rate_value       DECIMAL(18,8),
  PRIMARY KEY (observation_date, series_id)
);
```

### Utilization History (UTIL-specific)

```sql
CREATE TABLE daily_utilization (
  observation_date DATE        NOT NULL,
  group_type       VARCHAR(20) NOT NULL,
  group_key        VARCHAR(50) NOT NULL,
  utilization_pct  DECIMAL(8,4),
  avg_fee_bps      DECIMAL(10,4),
  on_loan_mv       DECIMAL(18,2),
  available_mv     DECIMAL(18,2),
  name_count       INTEGER,
  htb_count        INTEGER,
  special_count    INTEGER,
  PRIMARY KEY (observation_date, group_type, group_key)
);
```

### Custom Blend Definitions (UTIL — optional, can use localStorage)

```sql
CREATE TABLE custom_blend_definitions (
  blend_id    VARCHAR(30) PRIMARY KEY,
  name        VARCHAR(100),
  description TEXT,
  spread_bps  DECIMAL(10,2) DEFAULT 0,
  created_by  VARCHAR(100),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE custom_blend_components (
  blend_id   VARCHAR(30) NOT NULL REFERENCES custom_blend_definitions(blend_id),
  series_id  VARCHAR(30) NOT NULL,
  weight     DECIMAL(5,4) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  PRIMARY KEY (blend_id, series_id)
);
```

### Provider Interfaces

The benchmark provider from `docs/BENCHMARK_RATES_DB_HANDOFF.md` applies to BMRK/YCURV/FCOST/RVOL:

```typescript
interface BenchmarkProvider {
  getSeries(id: string, n: number): Promise<Obs[]>;
  getBatch(ids: string[], n: number): Promise<Record<string, Obs[]>>;
  source: string;
}
```

UTIL adds its own provider for utilization data:

```typescript
interface UtilizationProvider {
  getUtilizationHistory(groupType: UtilGroupBy, groupKey: string, n: number): Promise<Obs[]>;
  getUtilizationSnapshot(groupType: UtilGroupBy, date?: string): Promise<UtilizationSnapshot>;
  getCustomBlends(): Promise<CustomBlend[]>;
  saveCustomBlend(blend: CustomBlend): Promise<void>;
  deleteCustomBlend(id: string): Promise<void>;
  source: string;
}
```

Each module calls its provider with relevant IDs. The analytics layer doesn't care where the data came from.

---

## Verification Checklist (Per Module)

- [ ] `npx tsc --noEmit` — no type errors
- [ ] `npx vite build` — successful production build
- [ ] Analytics functions have no side effects and accept `SeriesMap` input
- [ ] Page renders on SIM data without FRED_API_KEY
- [ ] PDF export generates all tabs correctly
- [ ] Nav entry and route registered
- [ ] DataGrid columns are sortable
- [ ] Chart captures work for PDF
- [ ] ProvenanceBadge shows correct source
- [ ] No tight coupling to other modules (imports only from shared data layer and UI components)

### UTIL-Specific Checks

- [ ] Blend builder creates, saves, loads, and deletes blends in localStorage
- [ ] Preset blends compute correct weighted values from SeriesMap
- [ ] Custom blend weights validate (warn if sum ≠ 100%)
- [ ] Dual-axis overlay chart renders both utilization and rate on correct axes
- [ ] Correlation grid shows sensible values (not all zeros or NaN)
- [ ] Rate sensitivity rankings update when utilization group changes
- [ ] Scatter plot renders with correct axis labels and data alignment

---

## Modularity Requirements

Each module must be deployable independently in another application:

1. **Analytics file** (`src/data/*.ts`) — zero UI imports, pure TypeScript, only depends on `SeriesMap`/`Obs` types
2. **Page file** — imports only from `@/components/ui/*`, `@/components/charts/*`, `@/lib/*`, and its own data file
3. **PDF file** — imports only from `@/lib/pdfReport.ts` and its own data file
4. **No cross-module page imports** — YCURV page does not import from FCOST page, etc.
5. **Shared types live in `benchmarkRates.ts`** — `SeriesMap`, `Obs`, `BenchmarkDef`, `TrendMetrics`
6. **UTIL analytics** may import from `securitiesLending.ts` and `squeeze.ts` for types only — the page fetches the data and passes it in as arguments (no direct function calls from the analytics layer to the SL data layer)
