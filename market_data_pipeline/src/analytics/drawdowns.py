"""Drawdown and rolling-return percentile tables."""

from __future__ import annotations

import polars as pl

from market_data_pipeline.src.analytics import _returns as R
from market_data_pipeline.src.analytics.snapshot import PRICE_CLASSES


def drawdown_table(prices_norm: pl.DataFrame) -> list[dict]:
    """Per-series current drawdown vs 52w high, deepest first."""
    if prices_norm is None or prices_norm.height == 0:
        return []
    df = prices_norm.filter(pl.col("asset_class").is_in(list(PRICE_CLASSES)))
    if df.height == 0:
        return []

    rows: list[dict] = []
    for series_id in df.get_column("series_id").unique().to_list():
        sub = df.filter(pl.col("series_id") == series_id)
        dates, values = R.to_series(df, series_id)
        if not values:
            continue
        meta = sub.tail(1)
        dd = R.current_drawdown(values)
        rows.append(
            {
                "series_id": series_id,
                "display_name": meta.get_column("display_name").to_list()[0],
                "asset_class": meta.get_column("asset_class").to_list()[0],
                "price": R.round_or_none(values[-1], 4),
                "high_52w": R.round_or_none(R.high_52w(dates, values), 4),
                "drawdown": R.round_or_none(dd, 4),
                "asof": dates[-1].isoformat(),
            }
        )
    # deepest (most negative) first; None sorted last
    rows.sort(key=lambda r: (r["drawdown"] is None, r["drawdown"] if r["drawdown"] is not None else 0.0))
    return rows


def rolling_return_percentile_table(
    prices_norm: pl.DataFrame, window_days: int = 252
) -> list[dict]:
    """Distribution of rolling window-returns per series with current percentile."""
    if prices_norm is None or prices_norm.height == 0:
        return []
    df = prices_norm.filter(pl.col("asset_class").is_in(list(PRICE_CLASSES)))
    if df.height == 0:
        return []

    rows: list[dict] = []
    for series_id in sorted(df.get_column("series_id").unique().to_list()):
        sub = df.filter(pl.col("series_id") == series_id)
        dates, values = R.to_series(df, series_id)
        rolls = R.rolling_returns(dates, values, window_days)
        if not rolls:
            continue
        current = rolls[-1]
        srt = sorted(rolls)
        rows.append(
            {
                "series_id": series_id,
                "display_name": sub.tail(1).get_column("display_name").to_list()[0],
                "current_window_return": R.round_or_none(current, 4),
                "pctile_rank": R.round_or_none(R.percentile_rank(srt, current), 4),
                "min": R.round_or_none(srt[0], 4),
                "p25": R.round_or_none(R.percentile(srt, 0.25), 4),
                "median": R.round_or_none(R.percentile(srt, 0.5), 4),
                "p75": R.round_or_none(R.percentile(srt, 0.75), 4),
                "max": R.round_or_none(srt[-1], 4),
            }
        )
    return rows
