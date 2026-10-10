"""Transform layer — raw vendor frames → canonical ``normalized_time_series``.

Polars-only. Both market (OHLCV) and macro (observations) raw frames are mapped
to one long-format canonical schema enriched from the catalog, so every
downstream analytic treats all sources and asset classes identically and every
value remains traceable to source + series + date + run.
"""

from __future__ import annotations

from datetime import datetime, timezone

import polars as pl

from market_data_pipeline.src.config.catalog import Catalog, get_catalog
from market_data_pipeline.src.storage.schemas import NORMALIZED_SCHEMA

_NORM_COLS = list(NORMALIZED_SCHEMA.keys())


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _finalize(df: pl.DataFrame) -> pl.DataFrame:
    """Coerce to the exact canonical column order & dtypes."""
    if df.is_empty():
        return pl.DataFrame(schema=NORMALIZED_SCHEMA)
    return (
        df.select(_NORM_COLS)
        .cast(NORMALIZED_SCHEMA, strict=False)  # type: ignore[arg-type]
        .sort(["series_id", "date"])
    )


def normalize_market(
    raw: pl.DataFrame, run_id: str, catalog: Catalog | None = None
) -> pl.DataFrame:
    """Raw OHLCV → canonical, using adjusted close as the value (total-return)."""
    if raw is None or raw.is_empty():
        return pl.DataFrame(schema=NORMALIZED_SCHEMA)
    cat = catalog or get_catalog()
    sym_to_id = {a.vendor_symbol: a.series_id for a in cat.assets}

    rows = []
    ingested = _now()
    for sym, sub in raw.partition_by("vendor_symbol", as_dict=True).items():
        symbol = sym[0] if isinstance(sym, tuple) else sym
        series_id = sym_to_id.get(symbol, symbol)
        meta = cat.meta_for(series_id)
        source = sub["source"][0] if "source" in sub.columns and sub.height else "YAHOO"
        val_col = "adj_close" if "adj_close" in sub.columns else "close"
        part = sub.select(
            pl.lit(series_id).alias("series_id"),
            pl.lit(source).alias("source"),
            pl.lit(symbol).alias("vendor_symbol"),
            pl.lit(meta["display_name"]).alias("display_name"),
            pl.lit(meta["asset_class"]).alias("asset_class"),
            pl.lit(meta["frequency"]).alias("frequency"),
            pl.col("date"),
            pl.col(val_col).cast(pl.Float64).alias("value"),
            pl.lit(meta["unit"]).alias("unit"),
            pl.lit(meta["currency"]).alias("currency"),
            pl.lit("ADJ_CLOSE").alias("adjustment_type"),
            pl.lit(None, dtype=pl.Datetime).alias("revision_timestamp"),
            pl.lit(None, dtype=pl.Date).alias("vintage_date"),
            pl.lit(ingested).alias("ingested_at"),
            pl.lit(run_id).alias("ingestion_run_id"),
        ).filter(pl.col("value").is_not_null())
        rows.append(part)

    return _finalize(pl.concat(rows, how="vertical_relaxed")) if rows else pl.DataFrame(schema=NORMALIZED_SCHEMA)


def normalize_macro(
    raw: pl.DataFrame, run_id: str, catalog: Catalog | None = None
) -> pl.DataFrame:
    """Raw FRED/synthetic observations → canonical.

    ``vintage_date``/``revision_timestamp`` come from FRED's realtime window when
    present (revision-aware), so a series can be re-pulled without losing prior
    vintages.
    """
    if raw is None or raw.is_empty():
        return pl.DataFrame(schema=NORMALIZED_SCHEMA)
    cat = catalog or get_catalog()
    # macro series_id in the raw frame is the FRED id; map to canonical series_id
    fred_to_id = {m.fred_id: m.series_id for m in cat.macro}

    rows = []
    ingested = _now()
    has_rt_start = "realtime_start" in raw.columns
    for sid, sub in raw.partition_by("series_id", as_dict=True).items():
        fred_id = sid[0] if isinstance(sid, tuple) else sid
        series_id = fred_to_id.get(fred_id, fred_id)
        meta = cat.meta_for(series_id)
        source = sub["source"][0] if "source" in sub.columns and sub.height else "FRED"
        freq = meta["frequency"]
        adj = "SA" if meta["asset_class"] in ("MACRO_INFLATION", "MACRO_GROWTH", "MACRO_LABOR", "MACRO_LIQUIDITY") else "NONE"
        vintage_expr = (
            pl.col("realtime_start").cast(pl.Date)
            if has_rt_start
            else pl.lit(None, dtype=pl.Date)
        )
        part = sub.select(
            pl.lit(series_id).alias("series_id"),
            pl.lit(source).alias("source"),
            pl.lit(fred_id).alias("vendor_symbol"),
            pl.lit(meta["display_name"]).alias("display_name"),
            pl.lit(meta["asset_class"]).alias("asset_class"),
            pl.lit(freq).alias("frequency"),
            pl.col("date"),
            pl.col("value").cast(pl.Float64).alias("value"),
            pl.lit(meta["unit"]).alias("unit"),
            pl.lit("USD").alias("currency"),
            pl.lit(adj).alias("adjustment_type"),
            pl.lit(None, dtype=pl.Datetime).alias("revision_timestamp"),
            vintage_expr.alias("vintage_date"),
            pl.lit(ingested).alias("ingested_at"),
            pl.lit(run_id).alias("ingestion_run_id"),
        ).filter(pl.col("value").is_not_null())
        rows.append(part)

    return _finalize(pl.concat(rows, how="vertical_relaxed")) if rows else pl.DataFrame(schema=NORMALIZED_SCHEMA)
