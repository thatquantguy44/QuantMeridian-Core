# market_data_pipeline

A production-grade **market + macro data pipeline** for a Bloomberg-style
terminal. Ingests from **FRED** (official macro) and **Yahoo/yfinance**
(prototype-grade market), lands it through a raw → bronze → silver → gold
medallion, validates it, and serves **fast, digestible market snapshots** to a
Java front end over a FastAPI service.

Design stance (per the brief): FRED is the official macro source; Yahoo is
best-effort/unofficial and the vendor layer is **replaceable** (Polygon, Tiingo,
Nasdaq Data Link, Bloomberg, FactSet, Refinitiv, internal feeds) behind one
adapter interface. Cache aggressively, store raw before transforming, never
overwrite history without versioning, keep a full ingestion manifest, and make
every dashboard value traceable to source · series · date · run.

> Analytics are **original** (clean tables, rankings, rolling returns,
> drawdowns, rate/inflation context, cross-asset & regime views) built from
> public data — inspired by the Bilello-style "state of the market" format, not
> copied from any proprietary content.

---

## Architecture (text)

```
                        ┌──────────────────────────────────────────────┐
                        │              CONFIG / CATALOG                  │
                        │  series_catalog.yaml → asset_master +          │
                        │  macro_series_master (what to pull, metadata)  │
                        └───────────────────────┬──────────────────────┘
                                                │
   ┌───────────── INGESTION (rate-limit-safe, cached, retried) ─────────────┐
   │  connectors/                                                            │
   │   ├─ FredConnector   (MacroDataAdapter)   official · FRED_API_KEY       │
   │   ├─ YahooConnector  (MarketDataAdapter)  best-effort · aggressive cache│
   │   ├─ SyntheticConn.  (both)               deterministic offline source  │
   │   └─ base: RateLimiter · ResponseCache · ThrottledClient · AdapterResult│
   └───────────────────────────────┬───────────────────────────────────────┘
            raw frames + AdapterResult metadata │ (→ ingestion_manifest)
                                                ▼
   RAW (store before transform)   raw_market_prices · raw_macro_observations
            + Parquet archive (data/raw/…, immutable, run-stamped, versioned)
                                                │
                       transforms/normalize.py  ▼ (Polars)
   SILVER  ── canonical long-format ── normalized_time_series
            (series_id, source, vendor_symbol, display_name, asset_class,
             frequency, date, value, unit, currency, adjustment_type,
             revision_timestamp, vintage_date, ingested_at, ingestion_run_id)
                                                │
                       quality/checks.py        ▼  → data_quality_results
            (missing dates · dups · stale · abnormal moves · negatives ·
             frequency drift · incomplete refresh · source mismatch · schema)
                                                │
                       analytics/ (cards)       ▼
   GOLD   analytics_market_snapshot · analytics_cross_asset_returns ·
          analytics_drawdowns · analytics_rate_dashboard ·
          analytics_inflation_dashboard   (+ regime / bilello on demand)
                                                │
                       api/ (FastAPI)           ▼
   SERVE  /health /series/{id} /snapshot/{market,rates,inflation,cross-asset}
          /dashboard/{regime,bilello} /manifest/latest
          /ingestion/{run,backfill}            →  JSON for the Java terminal
                                                ▲
                       scheduler/ (APScheduler) │  market-close · macro-daily ·
                                                   controlled intraday refresh
```

Storage: **DuckDB** for queryable tables, **Parquet** for the immutable archive,
**Polars** for all transforms. (Postgres is a drop-in for DuckDB via the
optional SQLAlchemy loader.)

---

## Tables (13)

| Layer | Table | Purpose |
|-------|-------|---------|
| raw | `raw_market_prices` | landed OHLCV before transform |
| raw | `raw_macro_observations` | landed FRED observations (revision-aware) |
| silver | `normalized_time_series` | **canonical** long-format series (the model) |
| ref | `asset_master` | market asset catalog |
| ref | `macro_series_master` | macro series catalog |
| gold | `analytics_market_snapshot` | price/return/drawdown cards |
| gold | `analytics_cross_asset_returns` | bucketed cross-asset table |
| gold | `analytics_drawdowns` | current drawdowns |
| gold | `analytics_rate_dashboard` | curve + rate-change table |
| gold | `analytics_inflation_dashboard` | CPI/PCE YoY + trend |
| serve | `analytics_api_views` | **one row per terminal view** holding the full JSON payload — the UI reads this directly from the DB file (or via the API) |
| ops | `ingestion_manifest` | full lineage per extraction (source, params, rows, dates, checksum, version, status) |
| ops | `data_quality_results` | per-check pass/fail with severity |

Canonical schemas live in `src/storage/schemas.py` (DuckDB DDL + Polars schemas).

### Serving the terminal without the API

The pipeline materializes every terminal view into `analytics_api_views` and can
export them to JSON, so the **terminal can read a local cached database or file
directly** — no FastAPI process required:

```bash
mdp run --offline                       # populates analytics_api_views in DuckDB
mdp export-views --out ./data/export    # writes market_snapshot.json, regime.json, …

# terminal then reads either:
MARKET_DB_URL=$PWD/data/market.duckdb   ...   # DuckDB file (or postgres://…)
MARKET_DATA_DIR=$PWD/data/export        ...   # exported-file cache
```

---

## Run locally

Requirements: **Python 3.11+**.

```bash
cd market_data_pipeline
pip install -e .            # or: pip install polars duckdb pyarrow httpx tenacity \
                           #     pydantic pydantic-settings pyyaml fastapi uvicorn apscheduler

# 1) Run the full ETL. Offline = deterministic synthetic sources (no network/keys):
python -m market_data_pipeline.cli run --offline

# With live data: set FRED_API_KEY (official macro) and leave Yahoo enabled.
# This pulls ~10y of daily history per symbol from Yahoo (yfinance if installed,
# else the public chart endpoint) + FRED macro, and upserts/refreshes the DuckDB:
FRED_API_KEY=your_key python -m market_data_pipeline.cli run --start 2010-01-01
pip install -e ".[yahoo]"        # optional: the yfinance library (more robust than the raw endpoint)

# 2) Serve the API:
python -m market_data_pipeline.cli serve --port 8000      # http://localhost:8000/docs

# Other commands:
python -m market_data_pipeline.cli status                 # table row counts
python -m market_data_pipeline.cli backfill 2000-01-01    # historical backfill
python -m market_data_pipeline.cli rebuild-analytics      # gold rebuild from silver
python -m market_data_pipeline.cli export-views --out DIR  # write view JSON for the terminal file-cache
python -m market_data_pipeline.cli publish-views          # upsert analytics_api_views to MARKET_DB_URL
python -m market_data_pipeline.cli schedule               # APScheduler refresh loop

pytest                                                     # 61 tests, no network needed
```

Scheduled market refreshes are intentionally small-window jobs: by default they
ask Yahoo for the latest 14 days (`MDP_MARKET_REFRESH_LOOKBACK_DAYS`) and use a
1 request/sec throttle (`yahoo_rate_limit`) plus the on-disk response cache.
Use explicit `run --start YYYY-MM-DD` / `backfill` for larger historical loads.
For Vercel, set `MARKET_DB_URL=postgres://...` in both Vercel and your refresh
runner, then run `publish-views` after each pipeline refresh. The command creates
the Postgres `analytics_api_views` table if needed and upserts the six view
payloads that `/api/market/[view]` reads.

### Docker

```bash
cp .env.example .env        # add FRED_API_KEY (optional)
docker compose up --build   # api on :8000  +  scheduler worker
```

---

## API endpoints

| Method | Path | Returns |
|--------|------|---------|
| GET | `/health` | status + table counts |
| GET | `/series/{series_id}` | full observation history for one series |
| GET | `/snapshot/market` | per-asset cards: price, 1D/5D/MTD/YTD/1Y, 3Y/5Y CAGR, max DD, dist-from-52w-high |
| GET | `/snapshot/rates` | yield curve, 2s10s & 3m10y spreads, rate changes (1D…YTD, bps) |
| GET | `/snapshot/inflation` | CPI / Core CPI / PCE / Core PCE YoY + MoM + trend |
| GET | `/snapshot/cross-asset` | equities/bonds/commodities/credit/volatility/currencies buckets |
| GET | `/dashboard/regime` | risk-on/off · inflation-pressure · growth-momentum · liquidity scores + narrative |
| GET | `/dashboard/bilello` | best/worst YTD, returns-by-year, drawdowns, rate moves, real-rate gap, unemployment vs long-run |
| GET | `/manifest/latest` | recent ingestion lineage |
| POST | `/ingestion/run` | trigger a refresh (`{start?, offline?}`) |
| POST | `/ingestion/backfill` | historical backfill (`{start, end?}`) |

Example payloads for the Java UI: **`docs/example_payloads.json`**.

---

## Data sourcing & terms

- **FRED** — official API, requires `FRED_API_KEY`; governed by the St. Louis
  Fed API terms of use. Preferred for all macro series.
- **Yahoo/yfinance** — unofficial/best-effort, governed by Yahoo's terms; used
  for prototyping market prices only, pulled on a controlled schedule and cached
  aggressively (never hammered). The `MarketDataAdapter` interface lets a paid
  vendor replace it without touching transforms, analytics, or the API.
- **Synthetic** — deterministic offline source so the whole pipeline (and test
  suite) runs with no network and no keys.

---

## Project layout

```
market_data_pipeline/
├── pyproject.toml · Dockerfile · docker-compose.yml · .env.example · cli.py
├── config/series_catalog.yaml          # assets + macro series master
├── src/
│   ├── config/                         # settings (env) + catalog loader
│   ├── connectors/                     # base adapters, fred, yahoo, synthetic
│   ├── storage/                        # schemas (13 tables), duckdb_store, parquet_archive
│   ├── transforms/                     # normalize raw → canonical (Polars)
│   ├── analytics/                      # snapshot, cross_asset, rates, inflation, drawdowns, regime, bilello
│   ├── quality/                        # checks → data_quality_results
│   ├── ingestion/                      # manifest + pipeline orchestration
│   ├── api/                            # FastAPI app, service, Pydantic models
│   └── scheduler/                      # APScheduler cadences
├── tests/                              # 59 tests (connectors, analytics, storage, transforms, quality, api)
├── notebooks/prototypes/
├── docs/example_payloads.json
└── data/ raw/ bronze/ silver/ gold/    # parquet archive + duckdb
```
