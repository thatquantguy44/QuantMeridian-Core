# Feature Addition — Charting Studios (Macro & Market)

Date: 2026-06-20
Status: Completed — `MGC` and `MKC` are integrated
Module codes: **`MGC`** — Economic & Macro Chart Studio · **`MKC`** — Market Chart Studio
Shared layer: **Charting Engine** (`src/lib/charting` + `src/components/charting`)
Related: `docs/MARKET_TERMINAL_ROADMAP.md`, `docs/features/completed/Feature Addition - Market Lens Studio.md`

---

## 1. Executive Summary

Two new freeform charting workspaces, built on one shared charting engine:

- **`MGC` — Economic & Macro Chart Studio** — chart anything in the macro universe
  (the 72-series FRED catalog: rates, inflation, labor, growth, credit, money, housing,
  FX, activity, consumer) with macro-native tooling: recession shading, YoY/MoM/real
  transforms, curve & spread builders, release markers, percentile bands.
- **`MKC` — Market Chart Studio** — chart any market instrument (equity / ETF / future /
  FX / commodity / crypto proxies) with a full technical toolkit: candles, moving-average
  families, Bollinger, MACD, RSI, VWAP, volume, relative strength, drawing tools.

**Design tension to resolve:** *advanced and technical, yet simple to use.* The answer is a
**declarative chart spec** + **progressive disclosure**: pick a series and it charts instantly
with sensible defaults; everything beyond that — additional series, indicators, transforms,
sub-panes, overlays, layout — is opt-in through a clean toolbar and an "advanced" drawer. Every
chart is a serializable JSON `ChartSpec`, so any configuration can be **saved as a template,
shared, restored, or embedded** into other terminal pages.

**This is high-reuse, low-risk.** The terminal already has the data and the primitives:
- A **data layer with provenance** (`/api/econ/series` FRED-backed, `/api/market/[view]`,
  the Market Lens series engine — now backed by committed snapshots + FRED).
- A **chart-component set** (`LineChart`, `CandleChart`, `ScatterPlot`, `BarChart`, `Sparkline`,
  `YieldCurve`, `Matrix/HeatGrid`, `Treemap`, `Waterfall`, `Sankey`, `Radial`).
- **Hooks** (`useEcon`, `useMarket`, `useStats`) and the `LIVE / DB / FILE / FRED / SIM`
  provenance-badge convention.

The new work is the **interactive charting engine** (multi-pane canvas, indicators, transforms,
crosshair/zoom, spec model) and the two studio shells on top of it.

---

## 2. How these differ from what exists

| Surface | What it does | Relationship |
|---|---|---|
| Fixed econ pages (`INFL`, `CURV`, `CRDT`, `STAT`…) | Curated, opinionated dashboards | `MGC` is the *freeform* counterpart; add an "Open in Chart Studio" drill from these pages. |
| **Market Lens Studio** (`LENS`) | *Pre-canned event studies* — ATH/VIX/drawdown forward-return analytics with a fixed tile set | Studios are *freeform charting*, not preset analytics. They share the series engine; a Lens view can "Send to Chart Studio." |
| `MKT` Live Markets | Multi-asset monitor (quotes, movers, treemap) | `MKC` is the deep single/compare technical chart that `MKT` rows link into. |

One-line positioning: **dashboards answer fixed questions; Lens runs fixed studies; the Studios let the user ask their own question, visually.**

---

## 3. Shared Charting Engine

### 3.1 `ChartSpec` — the declarative model (serializable, shareable)

```ts
interface ChartSpec {
  id: string;
  title?: string;
  range: { preset: "1M"|"3M"|"6M"|"1Y"|"2Y"|"5Y"|"10Y"|"YTD"|"MAX"|"CUSTOM"; from?: string; to?: string };
  panes: Pane[];                       // main pane + sub-panes (volume, oscillators)
  crosshair?: boolean; legend?: boolean;
  compareMode?: "overlay"|"normalize"|"percent"|"ratio"|"zscore";
}
interface Pane {
  id: string; height?: number; scale: "linear"|"log";
  series: SeriesLayer[];               // one or more series in this pane
  yAxis?: { side: "left"|"right"; fmt?: "num"|"pct"|"bps"|"usd"|"index" };
  overlays?: Overlay[];                // hlines, shaded regions, event pins, trendlines
  indicators?: IndicatorSpec[];        // computed studies attached to this pane
}
interface SeriesLayer {
  ref: SeriesRef;                      // {source, id, field?}
  chartType: "line"|"area"|"candles"|"ohlc"|"bars"|"baseline"|"stepped"|"histogram"|"dots";
  transform?: Transform;               // yoy|mom|index100|pct_change|zscore|real_cpi|log|diff
  color?: string; axis?: "left"|"right"; visible?: boolean;
}
interface SeriesRef { source: "fred"|"econ"|"market"|"lens"|"book"|"upload"; id: string; field?: string; }
interface IndicatorSpec { type: string; inputs: Record<string, number|string>; pane?: "same"|"new"; color?: string; }
```

A `ChartSpec` round-trips to a URL param / localStorage / DB row, so charts are **bookmarkable,
shareable, and savable as templates** — and reusable as embeds elsewhere in the terminal.

### 3.2 Components — `src/components/charting/`

- `ChartCanvas` — orchestrates panes, shared x-axis, crosshair, zoom/pan, range selection.
- `Pane` / `Axis` / `Gridlines` / `Crosshair` / `Legend` / `LastValueTag`.
- `SeriesPicker` (searchable, category-filtered, multi-select) · `IndicatorPicker` ·
  `TransformMenu` · `ChartTypeMenu` · `RangeSelector` · `CompareMenu` · `TemplateBar` ·
  `ChartToolbar` (the simple top strip) · `AdvancedDrawer` (progressive disclosure).
- Rendering reuses/extends existing SVG chart primitives; a `CandleSeries`/`OHLCSeries`
  renderer generalizes `CandleChart`, and `LineSeries`/`AreaSeries` generalize `LineChart`.
  (SVG now; switch hot paths to canvas + downsampling when point counts get large — see §9.)

### 3.3 Indicators & transforms — `src/lib/charting/`

- `indicators.ts` — **pure functions** over `number[]` (and OHLC), computed client-side for
  instant interactivity. `transforms.ts` — series transforms. `spec.ts` — types + (de)serialize.
- Statistical-heavy studies (Granger, ADF, OLS) defer to the existing `/api/econ/stats`.

#### Indicator catalog (initial)

| Indicator | Type | Pane | Inputs | Studio |
|---|---|---|---|---|
| SMA / EMA / WMA | overlay | same | length | both |
| Bollinger Bands | overlay | same | length, k | both |
| VWAP / Anchored VWAP | overlay | same | anchor | MKC |
| Envelopes / Keltner | overlay | same | length, mult | MKC |
| Parabolic SAR | overlay | same | step, max | MKC |
| RSI | oscillator | new | length | both |
| MACD | oscillator | new | fast, slow, signal | both |
| Stochastics / StochRSI | oscillator | new | k, d, smooth | MKC |
| ATR / rolling realized vol | oscillator | new | length | both |
| ROC / Momentum | oscillator | new | length | both |
| OBV / volume | oscillator | new | — | MKC |
| ADX / CCI | oscillator | new | length | MKC |
| Rolling correlation / beta vs benchmark | oscillator | new | length, benchmark | both |
| Rolling z-score / percentile rank | oscillator | new | length | MGC |
| Drawdown-from-peak | oscillator | new | — | both |
| Regression channel / linear trend | overlay | same | window | both |
| Seasonality (avg by month) | study | new | — | both |
| **Macro transforms:** YoY, MoM, %chg, index-to-100, log, diff, **real (CPI-adjusted)** | transform | — | — | MGC |
| **Spread / ratio builder** (A−B, A/B) | derived series | same/new | series A, B | both |
| **Recession / NBER shading**, **release markers** (FOMC/CPI) | overlay | all | — | MGC |

### 3.4 Data binding & provenance — `SeriesResolver`

A unified `useChartSeries(refs, range, transform)` hook resolves each `SeriesRef` from the
**existing** sources and returns aligned `{dates, values, source}` with a provenance badge:

| `source` | Backed by | Badge |
|---|---|---|
| `fred` / `econ` | `/api/econ/series` (FRED live, else econ model) | `LIVE·FRED` / `SIM` |
| `market` | `/api/market/[view]` (DB / FILE / pipeline / committed snapshot) | `DB`/`FILE`/`LIVE`/`SNAPSHOT` |
| `lens` | Market Lens series engine (committed snapshots + FRED macro) | `SNAPSHOT` |
| `book` | internal synthetic book series (`src/data/*`) | `SIM` |
| `upload` | user CSV / paste | `USER` |

No new ingestion: the studios sit on top of the feeds already wired. Dates are aligned with the
same LOCF approach used in the Market Lens engine so mixed-frequency series combine safely.

---

## 4. Module `MGC` — Economic & Macro Chart Studio

- **Series catalog:** the 72-series FRED catalog from `src/data/econSeries.ts`, grouped by its
  categories (RATES, INFLATION, LABOR, GROWTH, CREDIT, MONEY, HOUSING, FX, ACTIVITY, CONSUMER),
  plus **calculated series**: curve spreads (2s10s, 3m10y…), real rates (yield − breakeven),
  policy gaps, diffusion indices.
- **Macro-native defaults:** recession shading on by default, monthly series default to a YoY
  view with a one-click toggle to level/MoM, release markers from the econ calendar.
- **Compare & derive:** overlay N series, normalize/index-to-100, build A−B spreads and A/B
  ratios, percentile bands, rolling z-scores.
- **Presets/templates:** "Inflation Monitor", "Policy & Rates", "Financial Conditions",
  "Labor Market", "Growth Nowcast", "Curve & Spreads" — each a saved `ChartSpec`.
- **Drill-in:** every fixed econ page gets an "Open in Chart Studio" affordance that hands its
  series + range to `MGC` as a `ChartSpec`.

## 5. Module `MKC` — Market Chart Studio

- **Series catalog:** market universe (equities/ETFs/futures/FX/commodities/crypto proxies) via
  the market snapshot + Market Lens daily series; intraday candles via `markets.ts` `Candle`.
- **Chart types:** candlestick / OHLC / Heikin-Ashi / line / area / baseline / volume
  (point-and-figure & Renko later).
- **Technical toolkit:** the full overlay + oscillator set above; multi-pane (price + volume +
  oscillator) with synced crosshair.
- **Compare & relative:** multi-symbol overlay, relative strength (A/B rebased), spread charts,
  rolling correlation/beta vs a benchmark (e.g. SPY).
- **Drawing & alerts:** trendlines, horizontal levels, rectangles, Fibonacci retracement;
  "set alert at level/indicator cross" → streams into the **`ALRT`** Alert Center.
- **Presets/templates:** "Trend & Momentum", "Volatility", "Relative Strength", "Mean Reversion".
- **Drill-in:** `MKT` rows and watchlists open directly into `MKC`.

---

## 6. UX principles (advanced but simple)

1. **Instant first chart** — choose a series, it renders with smart defaults (right chart type,
   range, macro transform). Zero config to value.
2. **Progressive disclosure** — a clean toolbar (series · range · chart type · add indicator ·
   compare); everything deep lives behind an **Advanced** drawer.
3. **One-click recall** — presets and saved templates make complex layouts a single click.
4. **Keyboard-driven & dense** — command-palette series search, terminal styling (black canvas,
   amber accent, tabular numerics), multi-pane layouts.
5. **Always provenance-honest** — every series carries its `source` badge; nothing silently fakes
   live data.
6. **Shareable & embeddable** — the `ChartSpec` is the unit of sharing and reuse.

---

## 7. Architecture & files

```
src/lib/charting/
  spec.ts            # ChartSpec types + serialize/deserialize (URL/localStorage/DB)
  indicators.ts      # pure TA/stat indicator fns over number[]/OHLC
  transforms.ts      # yoy, mom, pct, index100, zscore, real_cpi, log, diff, spread, ratio
  resolver.ts        # SeriesRef -> aligned {dates,values,source}; useChartSeries hook
  presets.ts         # built-in ChartSpec templates for MGC & MKC

src/components/charting/
  ChartCanvas.tsx Pane.tsx Axis.tsx Crosshair.tsx Legend.tsx
  SeriesPicker.tsx IndicatorPicker.tsx TransformMenu.tsx ChartTypeMenu.tsx
  RangeSelector.tsx CompareMenu.tsx ChartToolbar.tsx AdvancedDrawer.tsx TemplateBar.tsx

src/app/macro-chart/page.tsx     # MGC
src/app/market-chart/page.tsx    # MKC

API (reuse, no new ingestion):
  /api/econ/series, /api/econ/stats, /api/market/[view], /api/market-lens
  /api/chart/templates  (optional persistence; DB-backed like MARKET_DB_URL, else localStorage)
```

Indicators run client-side (pure TS) for instant pan/zoom; statistical studies reuse `/api/econ/stats`.

---

## 8. Phased delivery

**Phase 0 — Engine core.** `ChartSpec`, `ChartCanvas` with line/area + single pane, range selector,
crosshair/legend, `SeriesResolver` over `/api/econ/series` and `/api/market/[view]`. Stand up
`MGC` and `MKC` shells reading one series each.

**Phase 1 — Multi-series & transforms.** Overlay/compare, normalize/index-to-100/%/ratio/zscore,
macro transforms (YoY/MoM/real), recession shading. `MGC` becomes fully useful.

**Phase 2 — Candles & technical indicators.** Candle/OHLC renderer, sub-panes, the overlay +
oscillator catalog (MA family, Bollinger, VWAP, RSI, MACD, ATR, volume). `MKC` becomes fully useful.

**Phase 3 — Derived series, spreads, rolling corr/beta, seasonality, percentile bands.** Spread/ratio
builder shared by both studios.

**Phase 4 — Templates, sharing, drawing tools, alerts, CSV upload, export PNG/CSV.** Drill-ins from
econ pages, `MKT`, and Market Lens. Optional DB-backed template persistence.

---

## 9. Risks & notes

- **Rendering performance:** existing charts are SVG. For long daily histories (multi-thousand
  points) and many indicators, add point downsampling (LTTB) and move hot panes to a canvas
  renderer; keep the SVG path for small series. Spec/engine API stays identical.
- **Indicator correctness:** ship indicators as pure, unit-tested functions; show indicator params
  inline so the user always knows the inputs.
- **Data licensing/provenance:** Yahoo-derived market data stays research-grade and clearly
  badged; FRED is the macro source of truth. Honor the terminal's `source`-badge convention
  everywhere.
- **Scope discipline:** the engine is shared — resist per-studio forks. Studios differ only in
  default catalog, default chart type/transform, indicator presets, and drill-ins.

---

## 10. Reuse cheat-sheet

| Need | Reuse |
|---|---|
| Macro series + provenance | `src/data/econSeries.ts` (72-series catalog), `/api/econ/series`, `useEcon` |
| Market series + provenance | `/api/market/[view]`, `src/data/marketLens.ts` engine, `useMarket` |
| Statistical studies | `/api/econ/stats`, `useStats` |
| Chart primitives | `LineChart`, `CandleChart`, `ScatterPlot`, `BarChart`, `Sparkline`, `YieldCurve`, `Matrix/HeatGrid` |
| Determinism / fallbacks | `Rng`, the `LIVE/DB/FILE/FRED/SNAPSHOT/SIM` badge pattern |
| Alerts integration | `ALRT` Alert Center (`src/data/alerts.ts`) |
| Date alignment (mixed freq) | LOCF approach from the Market Lens engine |

*Bottom line:* one charting engine, two thin studios. The data and primitives already exist — this
plan adds the interactive, customizable charting surface that lets users chart what they want, how
they want, with indicators and chart types of their choosing.
