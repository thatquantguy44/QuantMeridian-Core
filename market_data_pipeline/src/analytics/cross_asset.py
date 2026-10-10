"""Cross-asset dashboard card: mini-cards bucketed by asset class."""

from __future__ import annotations

import polars as pl

from market_data_pipeline.src.analytics import _returns as R

# asset_class -> dashboard bucket key
BUCKETS = {
    "EQUITY": "equities",
    "BOND": "bonds",
    "COMMODITY": "commodities",
    "CREDIT": "credit",
    "VOLATILITY": "volatility",
    "CURRENCY": "currencies",
}


def _empty() -> dict:
    return {
        "equities": [],
        "bonds": [],
        "commodities": [],
        "credit": [],
        "volatility": [],
        "currencies": [],
        "asof": None,
    }


def cross_asset_dashboard(prices_norm: pl.DataFrame) -> dict:
    """Bucket price series into mini-cards by asset class.

    Returns a dict with keys equities/bonds/commodities/credit/volatility/
    currencies (each a list of mini-cards) plus a top-level asof.
    """
    out = _empty()
    if prices_norm is None or prices_norm.height == 0:
        return out

    df = prices_norm.filter(pl.col("asset_class").is_in(list(BUCKETS.keys())))
    if df.height == 0:
        return out

    max_asof = None
    for series_id in sorted(df.get_column("series_id").unique().to_list()):
        sub = df.filter(pl.col("series_id") == series_id)
        asset_class = sub.tail(1).get_column("asset_class").to_list()[0]
        bucket = BUCKETS.get(asset_class)
        if bucket is None:
            continue
        dates, values = R.to_series(df, series_id)
        if not values:
            continue
        display_name = sub.tail(1).get_column("display_name").to_list()[0]
        last_date = dates[-1]
        if max_asof is None or last_date > max_asof:
            max_asof = last_date
        out[bucket].append(
            {
                "series_id": series_id,
                "display_name": display_name,
                "price": R.round_or_none(values[-1], 4),
                "ytd": R.round_or_none(R.ytd(dates, values), 4),
                "ret_1y": R.round_or_none(R.ret_1y(values), 4),
                "asof": last_date.isoformat(),
            }
        )

    out["asof"] = max_asof.isoformat() if max_asof is not None else None
    return out
