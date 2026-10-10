"""Database schema definitions — the 12 pipeline tables + canonical frames.

Two layers of truth:
- ``DDL`` — DuckDB ``CREATE TABLE`` statements (also valid Postgres with minor
  type aliasing) for queryable storage.
- ``NORMALIZED_SCHEMA`` etc. — Polars schemas used by the transform layer so raw
  vendor data is coerced into one canonical shape before it ever hits the DB.
"""

from __future__ import annotations

import polars as pl

# ──────────────────────────────────────────────────────────────────────
# Canonical normalized long-format time-series (the heart of the model)
# ──────────────────────────────────────────────────────────────────────
NORMALIZED_SCHEMA: dict[str, pl.DataType] = {
    "series_id": pl.Utf8,
    "source": pl.Utf8,            # FRED | YAHOO | SYNTHETIC | <vendor>
    "vendor_symbol": pl.Utf8,
    "display_name": pl.Utf8,
    "asset_class": pl.Utf8,
    "frequency": pl.Utf8,         # D | W | M | Q | A
    "date": pl.Date,
    "value": pl.Float64,
    "unit": pl.Utf8,
    "currency": pl.Utf8,
    "adjustment_type": pl.Utf8,   # ADJ_CLOSE | RAW | SA | NSA | NONE
    "revision_timestamp": pl.Datetime,
    "vintage_date": pl.Date,
    "ingested_at": pl.Datetime,
    "ingestion_run_id": pl.Utf8,
}

RAW_MARKET_SCHEMA: dict[str, pl.DataType] = {
    "vendor_symbol": pl.Utf8,
    "date": pl.Date,
    "open": pl.Float64,
    "high": pl.Float64,
    "low": pl.Float64,
    "close": pl.Float64,
    "adj_close": pl.Float64,
    "volume": pl.Int64,
    "source": pl.Utf8,
    "ingestion_run_id": pl.Utf8,
    "ingested_at": pl.Datetime,
}

RAW_MACRO_SCHEMA: dict[str, pl.DataType] = {
    "series_id": pl.Utf8,
    "date": pl.Date,
    "value": pl.Float64,
    "realtime_start": pl.Date,
    "realtime_end": pl.Date,
    "source": pl.Utf8,
    "ingestion_run_id": pl.Utf8,
    "ingested_at": pl.Datetime,
}

# ──────────────────────────────────────────────────────────────────────
# DDL — all 12 tables
# ──────────────────────────────────────────────────────────────────────
DDL: dict[str, str] = {
    # 1. raw landing tables (store raw BEFORE transforming) -------------
    "raw_market_prices": """
        CREATE TABLE IF NOT EXISTS raw_market_prices (
            vendor_symbol     VARCHAR NOT NULL,
            date              DATE NOT NULL,
            open              DOUBLE,
            high              DOUBLE,
            low               DOUBLE,
            close             DOUBLE,
            adj_close         DOUBLE,
            volume            BIGINT,
            source            VARCHAR NOT NULL,
            ingestion_run_id  VARCHAR NOT NULL,
            ingested_at       TIMESTAMP,
            PRIMARY KEY (vendor_symbol, date, source)
        )
    """,
    "raw_macro_observations": """
        CREATE TABLE IF NOT EXISTS raw_macro_observations (
            series_id         VARCHAR NOT NULL,
            date              DATE NOT NULL,
            value             DOUBLE,
            realtime_start    DATE,
            realtime_end      DATE,
            source            VARCHAR NOT NULL,
            ingestion_run_id  VARCHAR NOT NULL,
            ingested_at       TIMESTAMP,
            PRIMARY KEY (series_id, date, source, realtime_start)
        )
    """,
    # 2. canonical normalized series ------------------------------------
    "normalized_time_series": """
        CREATE TABLE IF NOT EXISTS normalized_time_series (
            series_id          VARCHAR NOT NULL,
            source             VARCHAR NOT NULL,
            vendor_symbol      VARCHAR,
            display_name       VARCHAR,
            asset_class        VARCHAR,
            frequency          VARCHAR,
            date               DATE NOT NULL,
            value              DOUBLE,
            unit               VARCHAR,
            currency           VARCHAR,
            adjustment_type    VARCHAR,
            revision_timestamp TIMESTAMP,
            vintage_date       DATE,
            ingested_at        TIMESTAMP,
            ingestion_run_id   VARCHAR NOT NULL,
            PRIMARY KEY (series_id, date, source)
        )
    """,
    # 3. master / reference tables --------------------------------------
    "asset_master": """
        CREATE TABLE IF NOT EXISTS asset_master (
            series_id      VARCHAR PRIMARY KEY,
            vendor_symbol  VARCHAR,
            display_name   VARCHAR,
            asset_class    VARCHAR,
            sub_class      VARCHAR,
            unit           VARCHAR,
            currency       VARCHAR,
            source         VARCHAR,
            frequency      VARCHAR
        )
    """,
    "macro_series_master": """
        CREATE TABLE IF NOT EXISTS macro_series_master (
            series_id    VARCHAR PRIMARY KEY,
            fred_id      VARCHAR,
            display_name VARCHAR,
            asset_class  VARCHAR,
            category     VARCHAR,
            unit         VARCHAR,
            fred_units   VARCHAR,
            frequency    VARCHAR,
            tenor        VARCHAR,
            source       VARCHAR
        )
    """,
    # 4. analytics (gold) tables ----------------------------------------
    "analytics_market_snapshot": """
        CREATE TABLE IF NOT EXISTS analytics_market_snapshot (
            series_id          VARCHAR,
            display_name       VARCHAR,
            asset_class        VARCHAR,
            source             VARCHAR,
            price              DOUBLE,
            as_of              DATE,
            ret_1d             DOUBLE,
            ret_5d             DOUBLE,
            mtd                DOUBLE,
            ytd                DOUBLE,
            ret_1y             DOUBLE,
            cagr_3y            DOUBLE,
            cagr_5y            DOUBLE,
            max_drawdown       DOUBLE,
            pct_from_52w_high  DOUBLE,
            ingestion_run_id   VARCHAR
        )
    """,
    "analytics_cross_asset_returns": """
        CREATE TABLE IF NOT EXISTS analytics_cross_asset_returns (
            bucket           VARCHAR,
            series_id        VARCHAR,
            display_name     VARCHAR,
            price            DOUBLE,
            ytd              DOUBLE,
            ret_1y           DOUBLE,
            as_of            DATE,
            ingestion_run_id VARCHAR
        )
    """,
    "analytics_drawdowns": """
        CREATE TABLE IF NOT EXISTS analytics_drawdowns (
            series_id        VARCHAR,
            display_name     VARCHAR,
            asset_class      VARCHAR,
            price            DOUBLE,
            high_52w         DOUBLE,
            drawdown         DOUBLE,
            as_of            DATE,
            ingestion_run_id VARCHAR
        )
    """,
    "analytics_rate_dashboard": """
        CREATE TABLE IF NOT EXISTS analytics_rate_dashboard (
            series_id        VARCHAR,
            label            VARCHAR,
            tenor            VARCHAR,
            latest           DOUBLE,
            chg_1d_bps       DOUBLE,
            chg_1w_bps       DOUBLE,
            chg_1m_bps       DOUBLE,
            chg_3m_bps       DOUBLE,
            chg_ytd_bps      DOUBLE,
            as_of            DATE,
            ingestion_run_id VARCHAR
        )
    """,
    "analytics_inflation_dashboard": """
        CREATE TABLE IF NOT EXISTS analytics_inflation_dashboard (
            series_id        VARCHAR,
            label            VARCHAR,
            yoy              DOUBLE,
            prior_yoy        DOUBLE,
            mom              DOUBLE,
            trend            VARCHAR,
            as_of            DATE,
            ingestion_run_id VARCHAR
        )
    """,
    # 5. operational tables ---------------------------------------------
    "ingestion_manifest": """
        CREATE TABLE IF NOT EXISTS ingestion_manifest (
            manifest_id          VARCHAR PRIMARY KEY,
            ingestion_run_id     VARCHAR NOT NULL,
            source               VARCHAR,
            dataset              VARCHAR,
            symbol_or_series_id  VARCHAR,
            request_url_or_endpoint VARCHAR,
            parameters           VARCHAR,
            requested_at         TIMESTAMP,
            response_status      VARCHAR,
            row_count            BIGINT,
            min_date             DATE,
            max_date             DATE,
            checksum             VARCHAR,
            version              INTEGER,
            data_quality_status  VARCHAR,
            error_message        VARCHAR,
            latency_ms           BIGINT
        )
    """,
    "data_quality_results": """
        CREATE TABLE IF NOT EXISTS data_quality_results (
            result_id        VARCHAR PRIMARY KEY,
            ingestion_run_id VARCHAR,
            series_id        VARCHAR,
            check_name       VARCHAR,
            passed           BOOLEAN,
            severity         VARCHAR,
            details          VARCHAR,
            rows_affected    BIGINT,
            checked_at       TIMESTAMP
        )
    """,
    # 6. serving table — one row per terminal view (UI reads this directly) -
    "analytics_api_views": """
        CREATE TABLE IF NOT EXISTS analytics_api_views (
            view             VARCHAR PRIMARY KEY,
            payload_json     VARCHAR,
            as_of            DATE,
            ingestion_run_id VARCHAR,
            updated_at       TIMESTAMP
        )
    """,
}

ANALYTICS_TABLES = [
    "analytics_market_snapshot",
    "analytics_cross_asset_returns",
    "analytics_drawdowns",
    "analytics_rate_dashboard",
    "analytics_inflation_dashboard",
]

ALL_TABLES = list(DDL.keys())
