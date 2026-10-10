Prompt: Build Market Lens Studio — A Customizable Charlie Bilello–Inspired Market Analytics Module

Status: Completed — `LENS` is integrated

You are an expert Python market-data engineer, quant researcher, financial dashboard designer, and backend architect.

I am building a Bloomberg-like market terminal with a Java frontend and Python backend. I want to build a modular analytics capability inspired by the recurring public market-chart style of Charlie Bilello: clean, historical, evidence-based, myth-busting, cross-asset, and easy for traders, portfolio managers, analysts, and clients to understand.

Do not copy Charlie Bilello’s exact charts, branding, wording, layouts, or proprietary presentation style. Instead, abstract the analytical patterns behind his most useful public market views and turn them into a configurable internal analytics engine.

The product/module should be called:

Market Lens Studio

Tagline:

Pre-built market intelligence views, customizable by series, regime, horizon, and user workflow.

Market Lens Studio should function as a configurable market-analytics workspace where users can launch pre-canned analytics views or customize those views across different data series, asset classes, benchmarks, horizons, event definitions, and comparison regimes.

The module should feel like a Bloomberg-style analytical command center: fast, clean, chart-driven, historically grounded, and flexible enough for both standard market views and internal proprietary datasets.

Core Objective

Build a Python analytics framework and API layer that can generate reusable market views across arbitrary time series.

The framework should support:

Historical event studies
Forward-return analysis
Drawdown and recovery analysis
All-time-high analysis
Volatility and panic analysis
Largest VIX increase event studies
Largest VIX decrease event studies
Inflation and purchasing-power analysis
Fed/rates/yield-curve analysis
Credit-spread stress analysis
Earnings and valuation analysis
Relative-strength and rotation analysis
Cross-asset performance dashboards
Market myth-buster views
Custom user-defined analytics views
Saved presets and reusable chart layouts
Dropdown-driven frontend customization

The goal is to power a flexible market analytics module inside the terminal that can work with Yahoo Finance, FRED, internal data feeds, optimizer outputs, securities lending data, client-facing analytics, and user-uploaded time series.

Important Data Source Requirement

Leverage the firm’s existing Yahoo Finance and FRED pipelines/feeds wherever possible instead of rebuilding duplicate ingestion logic from scratch.

The system should first check whether a requested series is already available through an existing internal feed, cache, database table, or ETL output.

Only create a new ingestion connector when:

The series is not already available internally
The existing feed lacks required history, frequency, metadata, or adjustment fields
The existing feed cannot support the required analytics reliably
A new source is explicitly approved for coverage expansion

For Yahoo Finance and FRED specifically:

Reuse existing normalized series, ingestion jobs, metadata mappings, and data-quality checks where available.
Do not create parallel versions of the same series unless needed for testing, validation, or vendor comparison.
Add a preferred_source and fallback_source system so analytics can default to existing feeds but gracefully fall back to direct Yahoo Finance or FRED pulls when permitted.
Preserve source lineage so every chart clearly identifies whether the data came from an existing internal pipeline, direct Yahoo Finance pull, FRED API pull, cached table, manually uploaded series, or internal proprietary feed.
Build adapters that sit on top of existing feeds rather than tightly coupling the analytics engine to one vendor.
Make all views configurable so the same analytics can be run on Yahoo Finance market series, FRED macro series, internal securities lending series, optimizer outputs, or custom user-provided time series.

For the time being, ETF proxies are acceptable where needed.

Example ETF proxies:

SPY, VOO, or IVV can proxy for the S&P 500
QQQ can proxy for Nasdaq 100 exposure
IWM can proxy for Russell 2000 exposure
DIA can proxy for the Dow Jones Industrial Average
RSP can proxy for equal-weight S&P 500 exposure
TLT, IEF, SHY, BIL, or SGOV can proxy for Treasury duration/cash exposure
HYG and JNK can proxy for high yield credit
LQD can proxy for investment grade credit
GLD can proxy for gold
USO or DBO can proxy for crude oil exposure
EFA can proxy for developed international equities
EEM can proxy for emerging markets
XLK, XLF, XLE, XLU, XLV, XLI, XLY, XLP, XLB, and XLRE can proxy for sectors

However, every proxy must be clearly labeled as a proxy, not the underlying index or asset itself.

The data model should include:

proxy_policy:
  allow_etf_proxies: true
  require_proxy_labeling: true
  require_underlying_exposure_description: true
  require_proxy_source_lineage: true
  allow_replacement_with_institutional_series_later: true

Example:

series:
  primary:
    id: "SP500_PROXY"
    display_name: "S&P 500 Proxy"
    proxy_ticker: "SPY"
    source: "yahoo_existing_pipeline"
    field: "adjusted_close"
    proxy_for: "S&P 500 Index Total Return / Price Index"
    proxy_note: "ETF proxy used for prototyping until institutional index history is available."
Product Mode

Market Lens Studio should support two major modes.

Mode 1: Pre-Canned Analytics Views

Provide a library of ready-to-use views that users can launch instantly without needing to configure every parameter.

Examples:

Market Lens Studio
├── All-Time Highs: Signal or Noise?
├── Drawdown & Recovery Monitor
├── Panic / Volatility Spike Study
├── Forward Returns After Largest VIX Increases
├── Forward Returns After Largest VIX Decreases
├── Strength Begets Strength
├── Inflation & Purchasing Power Tracker
├── Fed Path & Yield Curve Monitor
├── Credit Spread Stress Dashboard
├── Earnings vs Multiple Expansion
├── Cross-Asset Leaderboard
├── Sector / Country Rotation Map
├── Risk-On / Risk-Off Regime View
├── Recession Signal Dashboard
├── Rate-Cut / Rate-Hike Event Study
├── Dollar Strength Impact View
├── Commodity Shock Monitor
├── ETF Proxy Market Monitor
└── Market Myth-Buster Studio

Each pre-canned view should ship with sensible defaults for:

default_series
default_benchmark
default_frequency
default_lookback
default_forward_windows
default_event_thresholds
default_chart_layout
default_narrative_template
default_proxy_policy

Example:

view_id: panic_volatility_spike
display_name: "Panic / Volatility Spike Study"
description: "Analyze what historically happened after volatility spikes or market stress events."
default_series:
  primary: "SP500_PROXY"
  trigger: "VIX"
default_proxy:
  primary_proxy_ticker: "SPY"
  proxy_for: "S&P 500"
  proxy_allowed: true
default_thresholds:
  trigger_type: "percentile"
  threshold: 95
forward_windows:
  - "1M"
  - "3M"
  - "6M"
  - "1Y"
default_charts:
  - "event_timeline"
  - "forward_return_table"
  - "return_distribution"
  - "historical_event_examples"
  - "narrative_summary"
Mode 2: Custom Analytics Workspace

In addition to pre-canned views, users must be able to customize the module through dropdowns, selectors, toggles, and filters.

The UI should allow the user to select:

Analytic View dropdown:
- All-Time High Analyzer
- Drawdown Analyzer
- Volatility Spike Analyzer
- Forward Returns After Largest VIX Increases
- Forward Returns After Largest VIX Decreases
- Inflation Analyzer
- Yield Curve Analyzer
- Credit Spread Analyzer
- Valuation Analyzer
- Rotation Analyzer
- Cross-Asset Dashboard
- ETF Proxy Dashboard
- Custom Event Study

Primary Series dropdown:
- S&P 500
- S&P 500 Proxy: SPY
- Nasdaq 100 Proxy: QQQ
- Russell 2000 Proxy: IWM
- Dow Jones Proxy: DIA
- Equal Weight S&P 500 Proxy: RSP
- Treasury 10Y Yield
- Treasury Duration Proxy: TLT
- Fed Funds Rate
- CPI
- High Yield OAS
- High Yield Proxy: HYG
- Investment Grade Proxy: LQD
- Gold Proxy: GLD
- Oil Proxy: USO
- Bitcoin
- Sector ETFs
- Custom internal series
- User-uploaded series

Benchmark dropdown:
- None
- S&P 500
- SPY
- Equal-weight S&P 500
- Bloomberg Agg proxy
- Treasury bills
- SGOV
- Cash rate
- Sector ETF
- Custom benchmark

Event Definition dropdown:
- New all-time high
- Drawdown exceeds threshold
- Volatility spike
- Largest VIX increase
- Largest VIX decrease
- Yield curve inversion
- Spread widening
- Inflation surprise
- Rolling return percentile
- Z-score threshold
- Moving-average crossover
- Relative-strength breakout
- Custom rule

VIX Change Period dropdown:
- 1 day
- 1 week
- 2 weeks
- 1 month

Largest Event Count dropdown:
- Top 5
- Top 10
- Top 20
- Top 50
- Custom N

Forward Window dropdown:
- 1 week
- 1 month
- 3 months
- 6 months
- 1 year
- 3 years
- 5 years

Visualization dropdown:
- Price chart
- Drawdown chart
- Event timeline
- Forward-return table
- Percentile card
- Heatmap
- Boxplot
- Scatterplot
- Regime comparison
- Narrative summary

The user should be able to:

Turn individual views on or off
Reorder chart tiles
Save a layout
Create reusable presets
Export chart payloads
Export underlying data
Switch between direct series and ETF proxies
See source lineage for every chart
See warnings when a proxy is being used
Re-run the same analytic across different assets or macro series
Dashboard Layout Requirement

Build the frontend so each analytics page has configurable tiles/cards.

Example layout:

[Market Lens Studio]

View: [Forward Returns After Largest VIX Increases ▼]
VIX Change Period: [1 Week ▼]
Largest Events: [Top 20 ▼]
Forward Return Series: [SPY ▼]
Benchmark: [None ▼]
Forward Windows: [1W] [1M] [3M] [6M] [1Y]
Date Range: [1993 - Present]

Proxy Mode:
[x] Allow ETF proxies where needed
[x] Clearly label proxy series
[x] Show source lineage

Selected Tiles:
[x] Largest VIX Increase Table
[x] Event Timeline
[x] Forward Return Table
[x] Return Distribution
[x] Narrative Summary
[ ] Max Drawdown After Event
[ ] Regime Split
[ ] Benchmark Comparison

[Run Analysis]
[Save Preset]
[Export Chart]

Each tile should be independently configurable and powered by the same backend analytics engine.

View Registry Requirement

Create a backend view registry that defines every pre-canned and custom view.

Example schema:

view_registry:
  - view_id: all_time_high_analyzer
    display_name: "All-Time Highs: Signal or Noise?"
    category: "Market Myth-Buster"
    description: "Studies whether new highs historically led to weakness or further gains."
    compatible_series_types:
      - price
      - total_return
      - index
      - ETF
      - crypto
      - commodity
      - proxy_series
    required_inputs:
      - primary_series
    optional_inputs:
      - benchmark
      - recession_overlay
      - proxy_series
    configurable_fields:
      - primary_series
      - benchmark
      - date_range
      - forward_windows
      - frequency
      - cooldown_days
      - return_type
      - proxy_mode
    default_tiles:
      - price_with_ath_markers
      - ath_count_by_year
      - forward_return_table
      - narrative_summary

  - view_id: vix_largest_increases_forward_returns
    display_name: "Forward Returns After Largest VIX Increases"
    category: "Volatility / Event Study"
    description: "Studies forward returns after the largest VIX increases over configurable change windows."
    compatible_series_types:
      - price
      - total_return
      - index
      - ETF
      - proxy_series
      - internal_series
    required_inputs:
      - trigger_series
      - forward_return_series
    default_series:
      trigger_series: "VIX"
      forward_return_series: "SPY"
    configurable_fields:
      - vix_change_period
      - largest_event_count
      - forward_return_series
      - benchmark
      - date_range
      - forward_windows
      - cooldown_days
      - regime_filter
      - proxy_mode
    default_tiles:
      - largest_vix_increase_table
      - event_timeline
      - forward_return_table
      - return_distribution
      - narrative_summary

  - view_id: vix_largest_decreases_forward_returns
    display_name: "Forward Returns After Largest VIX Decreases"
    category: "Volatility / Event Study"
    description: "Studies forward returns after the largest VIX decreases over configurable change windows."
    compatible_series_types:
      - price
      - total_return
      - index
      - ETF
      - proxy_series
      - internal_series
    required_inputs:
      - trigger_series
      - forward_return_series
    default_series:
      trigger_series: "VIX"
      forward_return_series: "SPY"
    configurable_fields:
      - vix_change_period
      - largest_event_count
      - forward_return_series
      - benchmark
      - date_range
      - forward_windows
      - cooldown_days
      - regime_filter
      - proxy_mode
    default_tiles:
      - largest_vix_decrease_table
      - event_timeline
      - forward_return_table
      - return_distribution
      - narrative_summary
Core Analytics Catalog

Implement the following analytics views.

1. All-Time High Analyzer

Question answered:

Are all-time highs bearish, neutral, or bullish for this series?

Inputs:

Price or total return series
ETF proxy where needed
Optional benchmark
Forward windows: 1M, 3M, 6M, 1Y, 3Y, 5Y
Frequency: daily, weekly, monthly
Return type: price return, total return, excess return, real return

Calculations:

Identify all-time highs
Count all-time highs by year
Days since last all-time high
Forward returns after all-time highs
Forward returns after non-all-time-high days
Hit rate after all-time highs
Median, mean, percentile bands
Maximum adverse excursion after signal
Average drawdown before next new high

Outputs:

Line chart with all-time-high markers
Bar chart of all-time-high count by year
Table comparing forward returns after all-time highs versus normal periods
Narrative summary

Example narrative:

The selected series reached a new all-time high. Historically, new highs by themselves have not necessarily been bearish. In this sample, 12-month forward returns after all-time highs were X%, compared with Y% across all other periods. Sample size: N observations. This is historical context, not a forecast.
2. Drawdown and Comeback Analyzer

Question answered:

How normal is the current drawdown, how long has it lasted, and how does it compare historically?

Inputs:

Price or total return series
ETF proxy where needed
Drawdown thresholds: -5%, -10%, -20%, -30%
Recovery definition: full recovery, partial recovery, new high
Lookback period

Calculations:

Running peak
Current drawdown
Max drawdown by year
Time spent in drawdown
Time to recovery
Drawdown depth/duration scatterplot
Annual return versus max intra-year drawdown
Historical rank of current drawdown

Outputs:

Drawdown chart
Calendar-year table: annual return, max drawdown, recovery status
Histogram of drawdown durations
Narrative summary
3. Panic / Volatility Spike Analyzer

Question answered:

What tends to happen after fear spikes?

Inputs:

Market index or ETF proxy
Volatility series such as VIX, MOVE, realized volatility, credit spread, or custom fear indicator
Optional breadth indicator
Panic definition:
Top 1%, 5%, or 10% volatility readings
VIX threshold
Breadth below threshold
Daily return below threshold
Z-score above threshold

Calculations:

Identify panic events
De-duplicate clustered events using cooldown window
Forward returns after panic
Compare to unconditional returns
Hit rate and drawdown after event
Event table with date, trigger value, and forward returns

Outputs:

Event-study table
Forward-return boxplot
Timeline with panic markers
Historical event examples
Narrative summary
4. Forward Returns After Largest VIX Increases

Question answered:

What tends to happen to a selected asset or index after the largest VIX increases over a chosen period?

This view should analyze whether sharp increases in volatility historically preceded weak returns, strong rebounds, or mixed outcomes for a selected forward-return series.

Default setup:

view_id: vix_largest_increases_forward_returns
display_name: "Forward Returns After Largest VIX Increases"
category: "Volatility / Event Study"
description: "Studies forward returns after the largest VIX increases over configurable change windows."
default_series:
  trigger_series: "VIX"
  forward_return_series: "SPY"
default_change_window: "1D"
default_event_count: 20
default_forward_windows:
  - "1W"
  - "1M"
  - "3M"
  - "6M"
  - "1Y"

Inputs:

VIX series
User-selected VIX change period:
1 day
1 week
2 weeks
1 month
Number of largest VIX increases:
Top 5
Top 10
Top 20
Top 50
Custom N
Forward-return series, defaulting to SPY
User-selectable forward-return series:
SPY
QQQ
IWM
DIA
VOO
IVV
RSP
XLK
XLF
XLE
XLU
XLV
XLI
XLY
XLP
XLB
XLRE
HYG
LQD
TLT
IEF
SHY
GLD
USO
Custom internal series
User-uploaded series
Forward-return windows:
1 week
1 month
3 months
6 months
1 year
Custom horizon
Optional benchmark
Optional regime filter:
Recession / non-recession
Inflation regime
Fed hiking / cutting / pause cycle
Above/below moving average
High/low credit spread regime

Calculations:

Compute VIX percentage change and point change over selected period:
1D VIX change
1W VIX change
2W VIX change
1M VIX change
Rank all historical VIX increases by size
Select largest N VIX increases
De-duplicate clustered events using configurable cooldown window
Compute forward returns for selected asset/index after each VIX spike
Compute unconditional forward returns for comparison
Compute mean, median, min, max, percentile bands, and hit rate
Compute max drawdown after each event
Compute time to recovery where applicable
Compare results across different VIX change windows
Clearly flag whether the forward-return series is an ETF proxy

Outputs:

Table of largest N VIX increases
Event timeline
Forward-return table
Forward-return distribution chart
Boxplot of forward returns by horizon
Comparison versus unconditional baseline
Historical event examples
Narrative summary

Example narrative:

The largest 20 one-week VIX increases were followed by a median 3-month forward return of X% for SPY, compared with Y% across all periods. The hit rate was Z%. SPY is being used as an ETF proxy for broad U.S. equity exposure. This is historical context, not a forecast.

Frontend controls:

View: [Forward Returns After Largest VIX Increases ▼]
VIX Change Period: [1 Week ▼]
Largest Events: [Top 20 ▼]
Forward Return Series: [SPY ▼]
Benchmark: [None ▼]
Forward Windows: [1W] [1M] [3M] [6M] [1Y]
Cooldown Window: [5 Trading Days ▼]
Regime Filter: [None ▼]

Selected Tiles:
[x] Largest VIX Increase Table
[x] Event Timeline
[x] Forward Return Table
[x] Return Distribution
[x] Narrative Summary
[ ] Max Drawdown After Event
[ ] Regime Comparison
5. Forward Returns After Largest VIX Decreases

Question answered:

What tends to happen to a selected asset or index after the largest VIX decreases over a chosen period?

This view should analyze whether sharp volatility collapses historically preceded continued strength, exhaustion, mean reversion, or mixed outcomes for a selected forward-return series.

Default setup:

view_id: vix_largest_decreases_forward_returns
display_name: "Forward Returns After Largest VIX Decreases"
category: "Volatility / Event Study"
description: "Studies forward returns after the largest VIX decreases over configurable change windows."
default_series:
  trigger_series: "VIX"
  forward_return_series: "SPY"
default_change_window: "1D"
default_event_count: 20
default_forward_windows:
  - "1W"
  - "1M"
  - "3M"
  - "6M"
  - "1Y"

Inputs:

VIX series
User-selected VIX change period:
1 day
1 week
2 weeks
1 month
Number of largest VIX decreases:
Top 5
Top 10
Top 20
Top 50
Custom N
Forward-return series, defaulting to SPY
User-selectable forward-return series:
SPY
QQQ
IWM
DIA
VOO
IVV
RSP
XLK
XLF
XLE
XLU
XLV
XLI
XLY
XLP
XLB
XLRE
HYG
LQD
TLT
IEF
SHY
GLD
USO
Custom internal series
User-uploaded series
Forward-return windows:
1 week
1 month
3 months
6 months
1 year
Custom horizon
Optional benchmark
Optional regime filter

Calculations:

Compute VIX percentage change and point change over selected period:
1D VIX change
1W VIX change
2W VIX change
1M VIX change
Rank all historical VIX decreases by size
Select largest N VIX decreases
De-duplicate clustered events using configurable cooldown window
Compute forward returns for selected asset/index after each VIX collapse
Compute unconditional forward returns for comparison
Compute mean, median, min, max, percentile bands, and hit rate
Compute max drawdown after each event
Compare forward returns after large VIX decreases versus large VIX increases
Clearly flag whether the forward-return series is an ETF proxy

Outputs:

Table of largest N VIX decreases
Event timeline
Forward-return table
Forward-return distribution chart
Boxplot of forward returns by horizon
Comparison versus unconditional baseline
Optional comparison against largest VIX increases
Historical event examples
Narrative summary

Example narrative:

The largest 20 one-month VIX decreases were followed by a median 6-month forward return of X% for SPY, compared with Y% across all periods. This helps test whether volatility collapses historically signaled continued risk-on behavior or near-term exhaustion. SPY is being used as an ETF proxy for broad U.S. equity exposure. This is historical context, not a forecast.

Frontend controls:

View: [Forward Returns After Largest VIX Decreases ▼]
VIX Change Period: [1 Month ▼]
Largest Events: [Top 20 ▼]
Forward Return Series: [SPY ▼]
Benchmark: [None ▼]
Forward Windows: [1W] [1M] [3M] [6M] [1Y]
Cooldown Window: [5 Trading Days ▼]
Regime Filter: [None ▼]

Selected Tiles:
[x] Largest VIX Decrease Table
[x] Event Timeline
[x] Forward Return Table
[x] Return Distribution
[x] Narrative Summary
[ ] Compare Against VIX Increases
[ ] Max Drawdown After Event
[ ] Regime Comparison
6. Strength Begets Strength Analyzer

Question answered:

After a large rally or volatility collapse, does momentum continue?

Inputs:

Price series or ETF proxy
Rolling windows: 1W, 2W, 3W, 4W, 8W, 13W, 26W
Event threshold: top N historical rallies or percentile threshold
Optional volatility series

Calculations:

Rolling returns
Rank current rolling return versus history
Identify top historical rallies
Forward returns after top rallies
Volatility compression events
Compare forward returns versus baseline

Outputs:

Top historical rally table
Current-rank card
Forward-return table
Narrative summary
7. Inflation / Purchasing Power Analyzer

Question answered:

How much purchasing power has been lost, and which assets protected against it?

Inputs:

CPI index or inflation series
Wage series
Asset price or total return series
ETF proxy where needed
Optional commodity proxies

Calculations:

Purchasing power of $1 over time
Cumulative inflation
Real returns
Nominal versus real wage growth
Months where wage growth exceeds inflation
Inflation-adjusted asset performance
Rolling inflation rate
Inflation percentile regime

Outputs:

Purchasing power decay chart
Real asset return chart
Wage growth versus CPI chart
Table of best inflation hedges over custom periods
Narrative summary
8. Fed, Rates, and Yield Curve Analyzer

Question answered:

What is the bond market pricing, and how unusual is the rate environment?

Inputs:

Fed funds target rate
Treasury yields: 3M, 2Y, 5Y, 10Y, 30Y
Yield curve spreads: 10Y-2Y, 10Y-3M, 30Y-5Y
Fed funds futures or OIS-implied policy path if available
Inflation/breakeven series
Treasury ETF proxies where needed

Calculations:

Yield curve slope
Inversion duration
Forward returns after inversion
Recession hit rate after inversion
Current yield percentile
Long yields after Fed cuts/hikes
Real yields
Market-implied cuts/hikes
Gap between market-implied policy and Fed guidance

Outputs:

Yield curve panel
Policy path chart
Inversion regime table
Rate-cycle comparison chart
Narrative summary
9. Credit Spread Stress Analyzer

Question answered:

Is credit pricing stress, complacency, or normal conditions?

Inputs:

High yield OAS
Investment grade OAS
Leveraged loan spreads if available
Default rate series
Equity index
Recession dates
ETF proxies such as HYG, JNK, or LQD where needed

Calculations:

Current spread percentile
Distance to recessionary spread levels
Spread widening events
Forward equity/bond returns after spread extremes
Spread z-score
Credit spread versus equity drawdown
ETF proxy drawdown and return analysis when direct spread data is not available

Outputs:

Spread history chart with recession shading
Percentile gauge
Event table of largest spread widenings/tightenings
Proxy-based credit stress dashboard
Narrative summary
10. Earnings, Valuation, and Market Fuel Analyzer

Question answered:

What is driving the market: earnings, multiple expansion, dividends, or inflation?

Inputs:

Index price or ETF proxy
Earnings per share
Forward EPS
P/E ratio
Earnings yield
Treasury yields
Dividend yield
Inflation

Calculations:

Price return decomposition:
EPS growth
Multiple expansion/contraction
Dividend contribution
Inflation adjustment
Earnings at record high
Valuation percentile
Equity risk premium proxy
Price versus earnings divergence
Forward return buckets by valuation percentile

Outputs:

Market decomposition waterfall
EPS versus price chart
Valuation percentile table
Narrative summary
11. Leadership, Rotation, and Relative Strength Analyzer

Question answered:

What is leading, what is lagging, and is leadership changing?

Inputs:

Multiple assets, sectors, countries, factors, or ETF proxies
Benchmark
Return windows: 1M, 3M, 6M, YTD, 1Y, 3Y, 5Y, 10Y
Optional fundamentals: earnings growth, valuation, margins

Calculations:

Relative strength ratio versus benchmark
Rolling excess returns
Rank by window
Leadership persistence
Rotation matrix
Drawdown by asset
Correlation clustering

Outputs:

Return heatmap
Relative strength line charts
Rank table
Rotation matrix
Narrative summary
12. Cross-Asset State of the Markets Dashboard

Question answered:

What changed across markets, and where are the biggest moves?

Inputs:

Equity indexes or ETF proxies
Bond indexes or ETF proxies
Treasury yields
Credit spreads
Commodities or commodity ETFs
FX
Crypto
Housing
Inflation
Labor market
Consumer data

Calculations:

YTD return
1Y return
3Y annualized return
Drawdown
Percentile rank
Z-score
Trend classification
Latest value versus 1Y ago
Correlation versus equities
Volatility

Outputs:

Asset-class leaderboard
Major macro cards
“What changed this week/month” summary
Historical percentile snapshot
Narrative summary
13. Market Myth-Buster Studio

Question answered:

Does the data support or challenge a common market claim?

Examples:

Claim: All-time highs are bearish.
Claim: Inverted yield curves mean recession is immediate.
Claim: Bonds are always safe.
Claim: Credit spreads cannot get tighter.
Claim: Volatility spikes are always bad.
Claim: Largest VIX increases are always bearish.
Claim: Largest VIX decreases always mean the rally is exhausted.
Claim: Markets move in a normal distribution.
Claim: High valuations always imply poor near-term returns.
Claim: International stocks never lead.
Claim: Cash is risk-free after inflation.

Inputs:

User-defined claim
Primary series
Optional ETF proxy
Benchmark
Event rule
Forward windows
Baseline comparison
Regime split

Calculations:

Convert claim into testable event definition
Compute historical outcomes
Compare against unconditional baseline
Display sample size
Highlight caveats
Avoid investment advice

Outputs:

Claim card
Historical test setup
Event-study table
Forward-return distribution
Caveat section
Narrative summary
Technical Architecture

Use the following stack:

Python 3.11+
Polars for transformations
DuckDB or Postgres for storage
Pydantic for schemas/config validation
FastAPI for serving analytics to the Java frontend
Plotly, ECharts-compatible JSON, or Vega-Lite JSON for chart payloads
Existing Yahoo Finance pipeline/feed where available
Existing FRED pipeline/feed where available
Direct Yahoo Finance and FRED access only as fallback/prototyping paths
Treasury, BLS, BEA, SEC, CME, and other official sources where needed
Optional official X API only if legally available and approved

The analytics engine should be source-agnostic and should consume normalized series from existing internal data stores before initiating any new direct pulls.

Direct API access should mainly serve as a fallback, prototype path, or coverage-expansion mechanism.

Package Structure

Create the package structure:

market_lens_studio/
  config/
    schemas.py
    loader.py
    view_registry.yaml
    default_presets.yaml

  data/
    adapters/
      internal_feed_adapter.py
      yahoo_existing_pipeline.py
      fred_existing_pipeline.py
      direct_yahoo_finance.py
      direct_fred.py
      proxy_resolver.py
    sources/
      treasury.py
      bls.py
      bea.py
      cme.py
    ingestion.py
    validation.py
    manifest.py
    lineage.py

  analytics/
    returns.py
    drawdowns.py
    event_study.py
    all_time_highs.py
    volatility.py
    vix_event_studies.py
    inflation.py
    rates.py
    credit.py
    valuation.py
    rotation.py
    cross_asset.py
    myth_buster.py

  narratives/
    templates.py
    generator.py
    caveats.py

  api/
    main.py
    routes.py
    view_routes.py
    preset_routes.py
    metadata_routes.py

  ui_contracts/
    chart_payload_schema.py
    dropdown_schema.py
    tile_schema.py

  tests/
    test_returns.py
    test_drawdowns.py
    test_event_study.py
    test_vix_event_studies.py
    test_proxy_resolver.py
    test_view_registry.py
Data Model

Create normalized tables.

series_master
series_id
ticker
source
preferred_source
fallback_source
name
display_name
asset_class
category
frequency
currency
units
seasonal_adjustment
vendor
license_type
is_proxy
proxy_for
proxy_description
created_at
updated_at
active_flag
observations
series_id
date
value
adjusted_value
vintage_date
source_timestamp
ingestion_run_id
quality_flag
analytics_results
result_id
view_id
series_id
run_timestamp
parameters_hash
start_date
end_date
metric_name
metric_value
metric_unit
metadata_json
event_studies
event_id
view_id
series_id
event_date
event_type
trigger_value
event_rank
change_window
change_value
change_pct
forward_window
forward_return
benchmark_forward_return
excess_forward_return
max_drawdown_after_event
sample_size
notes
data_manifest
ingestion_run_id
source
endpoint
query_params
start_time
end_time
rows_inserted
rows_updated
rows_rejected
checksum
schema_version
code_version
status
error_message
source_lineage
is_proxy
proxy_for
user_presets
preset_id
user_id
preset_name
view_id
selected_series
selected_benchmark
selected_event_rule
selected_forward_windows
selected_tiles
layout_json
created_at
updated_at
Example Source Configuration
data_access:
  source_priority:
    - "internal_existing_feed"
    - "internal_cache"
    - "fred_existing_pipeline"
    - "yahoo_existing_pipeline"
    - "direct_fred_api"
    - "direct_yahoo_finance"
    - "manual_upload"

  fallback_policy:
    allow_direct_api_fallback: true
    require_logging_for_fallback: true
    require_metadata_validation: true

  proxy_policy:
    allow_etf_proxies: true
    require_proxy_labeling: true
    require_underlying_exposure_description: true
    require_proxy_source_lineage: true
    allow_replacement_with_institutional_series_later: true

series:
  primary:
    id: "SP500_PROXY"
    preferred_source: "yahoo_existing_pipeline"
    fallback_source: "direct_yahoo_finance"
    ticker: "SPY"
    field: "adjusted_close"
    is_proxy: true
    proxy_for: "S&P 500"
    proxy_note: "ETF proxy used for prototyping until institutional index history is available."

  macro_overlay:
    id: "FEDFUNDS"
    preferred_source: "fred_existing_pipeline"
    fallback_source: "direct_fred_api"
    fred_series_id: "FEDFUNDS"
    is_proxy: false
Example View Config
view_id: all_time_high_analyzer
title: "All-Time Highs: Signal or Noise?"

series:
  primary:
    id: "SP500_PROXY"
    source: "yahoo_existing_pipeline"
    fallback_source: "direct_yahoo_finance"
    ticker: "SPY"
    field: "adjusted_close"
    is_proxy: true
    proxy_for: "S&P 500"

  benchmark:
    id: "TBILL_PROXY"
    source: "yahoo_existing_pipeline"
    ticker: "SGOV"
    field: "adjusted_close"
    is_proxy: true
    proxy_for: "Short-term Treasury bills"

frequency: "daily"
start_date: "1993-01-01"
return_type: "price_or_total_return_proxy"

forward_windows:
  - "1M"
  - "3M"
  - "6M"
  - "1Y"
  - "3Y"
  - "5Y"

event:
  type: "all_time_high"
  cooldown_days: 5

comparison:
  baseline: "all_other_periods"

outputs:
  charts:
    - "price_with_ath_markers"
    - "forward_return_table"
    - "ath_count_by_year"
    - "narrative_summary"

metadata:
  show_proxy_warning: true
  show_source_lineage: true
Example VIX Event Study Config
view_id: vix_largest_increases_forward_returns
title: "Forward Returns After Largest VIX Increases"

series:
  trigger:
    id: "VIX"
    source: "yahoo_existing_pipeline"
    fallback_source: "direct_yahoo_finance"
    ticker: "^VIX"
    field: "close"
    is_proxy: false

  forward_return_series:
    id: "SP500_PROXY"
    source: "yahoo_existing_pipeline"
    fallback_source: "direct_yahoo_finance"
    ticker: "SPY"
    field: "adjusted_close"
    is_proxy: true
    proxy_for: "S&P 500"

vix_change_period: "1W"
largest_event_count: 20
cooldown_days: 5

forward_windows:
  - "1W"
  - "1M"
  - "3M"
  - "6M"
  - "1Y"

comparison:
  baseline: "unconditional_forward_returns"

outputs:
  charts:
    - "largest_vix_increase_table"
    - "event_timeline"
    - "forward_return_table"
    - "return_distribution"
    - "narrative_summary"

metadata:
  show_proxy_warning: true
  show_source_lineage: true
Saved Presets Requirement

Allow users to save and reload customized views.

Example presets:

saved_presets:
  - preset_name: "Equity Panic Monitor"
    view_id: panic_volatility_spike
    primary_series: "SP500_PROXY"
    primary_proxy_ticker: "SPY"
    trigger_series: "VIX"
    event_rule: "trigger_series_percentile >= 95"
    forward_windows: ["1M", "3M", "6M", "1Y"]
    selected_tiles:
      - event_timeline
      - forward_return_table
      - return_distribution
      - narrative_summary

  - preset_name: "Largest 1W VIX Increases"
    view_id: vix_largest_increases_forward_returns
    trigger_series: "VIX"
    forward_return_series: "SPY"
    vix_change_period: "1W"
    largest_event_count: 20
    forward_windows: ["1W", "1M", "3M", "6M", "1Y"]
    selected_tiles:
      - largest_vix_increase_table
      - event_timeline
      - forward_return_table
      - return_distribution
      - narrative_summary

  - preset_name: "Largest 1M VIX Decreases"
    view_id: vix_largest_decreases_forward_returns
    trigger_series: "VIX"
    forward_return_series: "SPY"
    vix_change_period: "1M"
    largest_event_count: 20
    forward_windows: ["1W", "1M", "3M", "6M", "1Y"]
    selected_tiles:
      - largest_vix_decrease_table
      - event_timeline
      - forward_return_table
      - return_distribution
      - narrative_summary

  - preset_name: "Fed Cuts and Equity Returns"
    view_id: custom_event_study
    primary_series: "SP500_PROXY"
    primary_proxy_ticker: "SPY"
    trigger_series: "FEDFUNDS"
    event_rule: "first_rate_cut_after_hiking_cycle"
    benchmark: "TBILL_PROXY"
    benchmark_proxy_ticker: "SGOV"
    forward_windows: ["3M", "6M", "1Y", "3Y"]
    selected_tiles:
      - rate_cycle_timeline
      - forward_return_table
      - recession_overlay
      - narrative_summary

  - preset_name: "Credit Stress Proxy Monitor"
    view_id: credit_spread_stress_dashboard
    primary_series: "HYG"
    benchmark: "SPY"
    proxy_mode: true
    event_rule: "drawdown_or_spread_proxy_stress"
    forward_windows: ["1M", "3M", "6M", "1Y"]
    selected_tiles:
      - proxy_price_drawdown
      - forward_return_table
      - stress_event_timeline
      - narrative_summary
Narrative Engine Style

For every chart, generate a short explanation using this structure:

1. What changed?
2. Why does it matter?
3. How unusual is it historically?
4. What happened in similar historical periods?
5. What is the caveat?

Example:

SPY, used here as an ETF proxy for the S&P 500, closed near a new high. Historically, new highs by themselves have not necessarily been bearish. In this sample, 12-month forward returns after all-time highs were X%, compared with Y% across all other periods. The caveat is that this proxy has its own expense ratio, dividend treatment, liquidity profile, and history length, so results should be replaced with institutional index data when available.

VIX example:

The largest 20 one-week VIX increases were followed by a median 3-month forward return of X% for SPY, compared with Y% across all periods. The hit rate was Z%, and the average max drawdown after the event was A%. SPY is used here as an ETF proxy for broad U.S. equity exposure. This is historical context, not a forecast.

Narratives must:

Avoid investment advice
Use language like “historically,” “in this sample,” and “not a forecast”
Include sample size
Include source lineage
Clearly flag ETF proxies
Include caveats for short history, stale data, missing data, and small samples
Core Implementation Rules
Do not hard-code S&P 500 logic. Every analytic must work on arbitrary series.
Use total return where available.
Where total return or institutional index data is not available, ETF proxies are acceptable for now.
Clearly label ETF proxies in every output.
Preserve source lineage for every series and chart.
Avoid look-ahead bias in forward-return studies.
Handle missing dates using a market-calendar-aware approach.
De-duplicate clustered events with configurable cooldown windows.
Report sample size for every historical claim.
Show both mean and median forward returns.
Always compare event-conditioned returns to unconditional baseline returns.
Include recession shading where relevant.
Add confidence warnings when sample size is small.
Every chart payload must include metadata, data source, as-of date, transformation notes, and proxy notes where applicable.
Every narrative must avoid investment advice.
Every analytic should be callable from an API endpoint.
Every view should be configurable by frontend dropdowns.
Every tile should be independently enabled, disabled, reordered, and exported.
Existing Yahoo Finance and FRED pipelines should be used first.
Direct Yahoo Finance and FRED API access should be fallback/prototype paths only unless explicitly approved.
For VIX increase/decrease event studies, allow users to select the VIX change period from 1 day, 1 week, 2 weeks, or 1 month.
For VIX event studies, the default forward-return series should be SPY.
Users must be able to choose from major index ETFs, sector ETFs, bond ETFs, credit ETFs, commodity ETFs, internal series, or uploaded custom series.
For VIX event studies, compute both point changes and percentage changes in VIX.
For VIX event studies, always compare event-conditioned forward returns against unconditional baseline returns.
VIX event studies should support top N events, including top 5, top 10, top 20, top 50, and custom N.
VIX event studies should allow cooldown windows to avoid over-counting clustered volatility events.
VIX event studies should include optional regime filters.
API Requirements

Create FastAPI endpoints such as:

GET /market-lens/views
GET /market-lens/views/{view_id}/schema
GET /market-lens/series
GET /market-lens/series/{series_id}/metadata
GET /market-lens/proxies
POST /market-lens/run
POST /market-lens/presets
GET /market-lens/presets/{user_id}
DELETE /market-lens/presets/{preset_id}
GET /market-lens/result/{result_id}

The frontend should be able to dynamically query:

Available views
Compatible series
Compatible benchmarks
Allowed event definitions
Default chart tiles
Optional chart tiles
Proxy availability
Source lineage
Saved presets
VIX change-period options
Largest-event-count options
Forward-return series options
Example API Request: Largest VIX Increase Study
{
  "view_id": "vix_largest_increases_forward_returns",
  "trigger_series": {
    "series_id": "VIX",
    "ticker": "^VIX",
    "preferred_source": "yahoo_existing_pipeline",
    "fallback_source": "direct_yahoo_finance"
  },
  "forward_return_series": {
    "series_id": "SP500_PROXY",
    "ticker": "SPY",
    "is_proxy": true,
    "proxy_for": "S&P 500",
    "preferred_source": "yahoo_existing_pipeline",
    "fallback_source": "direct_yahoo_finance"
  },
  "event_rule": {
    "type": "largest_vix_increase",
    "vix_change_period": "1W",
    "largest_event_count": 20,
    "change_measure": "point_and_percent_change",
    "cooldown_days": 5
  },
  "forward_windows": ["1W", "1M", "3M", "6M", "1Y"],
  "date_range": {
    "start": "1993-01-01",
    "end": "latest"
  },
  "selected_tiles": [
    "largest_vix_increase_table",
    "event_timeline",
    "forward_return_table",
    "return_distribution",
    "historical_event_examples",
    "narrative_summary"
  ],
  "options": {
    "allow_etf_proxies": true,
    "show_proxy_warning": true,
    "show_source_lineage": true,
    "compare_to_unconditional_baseline": true
  }
}
Example API Request: Largest VIX Decrease Study
{
  "view_id": "vix_largest_decreases_forward_returns",
  "trigger_series": {
    "series_id": "VIX",
    "ticker": "^VIX",
    "preferred_source": "yahoo_existing_pipeline",
    "fallback_source": "direct_yahoo_finance"
  },
  "forward_return_series": {
    "series_id": "SP500_PROXY",
    "ticker": "SPY",
    "is_proxy": true,
    "proxy_for": "S&P 500",
    "preferred_source": "yahoo_existing_pipeline",
    "fallback_source": "direct_yahoo_finance"
  },
  "event_rule": {
    "type": "largest_vix_decrease",
    "vix_change_period": "1M",
    "largest_event_count": 20,
    "change_measure": "point_and_percent_change",
    "cooldown_days": 5
  },
  "forward_windows": ["1W", "1M", "3M", "6M", "1Y"],
  "date_range": {
    "start": "1993-01-01",
    "end": "latest"
  },
  "selected_tiles": [
    "largest_vix_decrease_table",
    "event_timeline",
    "forward_return_table",
    "return_distribution",
    "historical_event_examples",
    "narrative_summary"
  ],
  "options": {
    "allow_etf_proxies": true,
    "show_proxy_warning": true,
    "show_source_lineage": true,
    "compare_to_unconditional_baseline": true,
    "compare_against_largest_vix_increases": true
  }
}
Example API Response Shape
{
  "view_id": "vix_largest_increases_forward_returns",
  "run_timestamp": "2026-06-19T12:00:00",
  "as_of_date": "2026-06-18",
  "series_used": [
    {
      "series_id": "VIX",
      "ticker": "^VIX",
      "is_proxy": false,
      "source": "yahoo_existing_pipeline",
      "source_lineage": "internal normalized Yahoo Finance feed"
    },
    {
      "series_id": "SP500_PROXY",
      "ticker": "SPY",
      "is_proxy": true,
      "proxy_for": "S&P 500",
      "source": "yahoo_existing_pipeline",
      "source_lineage": "internal normalized Yahoo Finance feed"
    }
  ],
  "event_definition": {
    "type": "largest_vix_increase",
    "vix_change_period": "1W",
    "largest_event_count": 20,
    "cooldown_days": 5
  },
  "warnings": [
    "SPY is being used as an ETF proxy for the S&P 500. Results may differ from official index or total return data."
  ],
  "tiles": [
    {
      "tile_id": "largest_vix_increase_table",
      "chart_type": "table",
      "payload": {}
    },
    {
      "tile_id": "event_timeline",
      "chart_type": "line_with_markers",
      "payload": {}
    },
    {
      "tile_id": "forward_return_table",
      "chart_type": "table",
      "payload": {}
    },
    {
      "tile_id": "return_distribution",
      "chart_type": "boxplot",
      "payload": {}
    },
    {
      "tile_id": "narrative_summary",
      "chart_type": "text",
      "payload": {
        "summary": "Historically, the largest one-week VIX increases in this sample were followed by..."
      }
    }
  ]
}
Optional X/Twitter Research Module

If official X API access is available and approved, build a module that studies which public chart themes resonate most.

Inputs:

Account handle
Post text
Post date
Likes
Reposts
Replies
Quotes
Views if available
Linked article URL
Image OCR text only if legally permitted

Process:

Classify each post into chart themes:
all-time highs
drawdowns
volatility/panic
VIX increases
VIX decreases
inflation
Fed/rates
credit spreads
valuation
earnings
housing
rotation
cross-asset performance
sentiment
myth-busting
Compute engagement score:
likes + 2×reposts + 2×quotes + replies
Normalize by account follower count if available
Normalize by post age
Rank chart themes by engagement
Identify recurring title formats and narrative hooks
Convert high-performing themes into candidate Market Lens Studio views

Do not scrape X if it violates platform terms. Use official API, user-provided exports, or publicly available newsletter/blog archives.

Deliverables

Produce:

Complete Market Lens Studio design document
Python implementation plan
YAML-driven view registry
Data-source adapter design
Existing Yahoo Finance pipeline integration plan
Existing FRED pipeline integration plan
Direct Yahoo/FRED fallback plan
ETF proxy resolver and mapping layer
Database schema
FastAPI endpoint design
Java frontend API contract
Pre-canned analytics view library
Dropdown customization model
Saved presets model
Configurable chart tile system
Example implementation of at least five views:
All-Time High Analyzer
Drawdown and Recovery Analyzer
Panic / Volatility Spike Analyzer
Forward Returns After Largest VIX Increases
Forward Returns After Largest VIX Decreases
Unit tests
Example chart JSON payloads
Example narratives
Source-lineage and proxy-warning framework
Roadmap for adding rates, credit, inflation, valuation, and cross-asset views
Final Product Framing

Market Lens Studio is not a static dashboard.

It is a configurable market-intelligence studio that turns any approved time series into pre-built or user-configured historical analytics, event studies, market-regime views, and narrative chart packs.

It should ship with high-quality default views but allow power users to change:

Series
ETF proxy
Benchmark
Event definition
VIX change period
Number of largest events
Forward window
Frequency
Date range
Regime filter
Visualization tiles
Saved layout
Data source
Proxy policy

The real edge is not copying any one market commentator’s charts.

The real edge is building a generalized market myth and historical context engine:

Define a claim.
Select a series.
Choose an event condition.
Compute historical outcomes.
Compare against a baseline.
Show the evidence.
Explain the caveat.
Let the user customize everything.

This should allow the terminal to produce clean, historically grounded, Bilello-style market snapshots for public market series, ETF proxies, macroeconomic data, Fed/rates data, credit data, volatility events, internal securities lending metrics, collateral optimizer outputs, cash optimizer inputs, and custom user-defined time series.