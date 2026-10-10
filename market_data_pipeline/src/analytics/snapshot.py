"""Market snapshot terminal card: one card per price series_id."""

from __future__ import annotations

from datetime import date
from typing import Optional

import polars as pl

from market_data_pipeline.src.analytics import _returns as R

PRICE_CLASSES = {"EQUITY", "BOND", "COMMODITY", "CREDIT", "VOLATILITY", "CURRENCY"}


def _filter_asof(df: pl.DataFrame, asof: Optional[date]) -> pl.DataFrame:
    if asof is None:
        return df
    return df.filter(pl.col("date") <= asof)


def _meta(df: pl.DataFrame, series_id: str) -> dict:
    sub = df.filter(pl.col("series_id") == series_id).sort("date")
    if sub.height == 0:
        return {}
    last = sub.tail(1)
    return {
        "display_name": last.get_column("display_name").to_list()[0],
        "asset_class": last.get_column("asset_class").to_list()[0],
        "source": last.get_column("source").to_list()[0],
    }


def market_snapshot(prices_norm: pl.DataFrame, asof: Optional[date] = None) -> list[dict]:
    """Build one snapshot card per price series_id.

    Keys: series_id, display_name, asset_class, source, price, asof,
    ret_1d, ret_5d, mtd, ytd, ret_1y, cagr_3y, cagr_5y, max_drawdown,
    pct_from_52w_high. Sorted by asset_class then series_id.
    """
    if prices_norm is None or prices_norm.height == 0:
        return []

    df = prices_norm.filter(pl.col("asset_class").is_in(list(PRICE_CLASSES)))
    df = _filter_asof(df, asof)
    if df.height == 0:
        return []

    cards: list[dict] = []
    for series_id in sorted(df.get_column("series_id").unique().to_list()):
        dates, values = R.to_series(df, series_id)
        if not values:
            continue
        meta = _meta(df, series_id)
        cards.append(
            {
                "series_id": series_id,
                "display_name": meta.get("display_name"),
                "asset_class": meta.get("asset_class"),
                "source": meta.get("source"),
                "price": R.round_or_none(values[-1], 4),
                "asof": dates[-1].isoformat(),
                "ret_1d": R.round_or_none(R.ret_1d(values), 4),
                "ret_5d": R.round_or_none(R.ret_5d(values), 4),
                "mtd": R.round_or_none(R.mtd(dates, values), 4),
                "ytd": R.round_or_none(R.ytd(dates, values), 4),
                "ret_1y": R.round_or_none(R.ret_1y(values), 4),
                "cagr_3y": R.round_or_none(R.cagr(values, dates, 3), 4),
                "cagr_5y": R.round_or_none(R.cagr(values, dates, 5), 4),
                "max_drawdown": R.round_or_none(R.max_drawdown(values), 4),
                "pct_from_52w_high": R.round_or_none(
                    R.distance_from_52w_high(dates, values), 4
                ),
            }
        )

    cards.sort(key=lambda c: (c["asset_class"] or "", c["series_id"] or ""))
    return cards
