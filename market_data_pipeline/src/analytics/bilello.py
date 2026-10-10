"""Original "interesting tables" -- Charlie-Bilello-style market summaries.

All analytics are derived from public-data fields; no proprietary content is
reproduced. Each function returns JSON-native structures and is robust to
empty / short input.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

import polars as pl

from market_data_pipeline.src.analytics import _returns as R
from market_data_pipeline.src.analytics.snapshot import PRICE_CLASSES


def best_worst_ytd(prices_norm: pl.DataFrame, n: int = 10) -> dict:
    """Top/bottom YTD performers across price series."""
    out = {"best": [], "worst": []}
    if prices_norm is None or prices_norm.height == 0:
        return out
    df = prices_norm.filter(pl.col("asset_class").is_in(list(PRICE_CLASSES)))
    rows = []
    for series_id in df.get_column("series_id").unique().to_list():
        sub = df.filter(pl.col("series_id") == series_id)
        dates, values = R.to_series(df, series_id)
        y = R.ytd(dates, values)
        if y is None:
            continue
        rows.append(
            {
                "series_id": series_id,
                "display_name": sub.tail(1).get_column("display_name").to_list()[0],
                "ytd": R.round_or_none(y, 4),
            }
        )
    if not rows:
        return out
    rows.sort(key=lambda r: r["ytd"], reverse=True)
    out["best"] = rows[:n]
    out["worst"] = list(reversed(rows[-n:]))
    return out


def asset_class_returns_by_year(prices_norm: pl.DataFrame) -> list[dict]:
    """Calendar-year returns per series for the Asset Quilt.

    The historical name is kept for API compatibility, but rows are now direct
    ETF/index proxy series rather than broad equal-weight asset-class buckets.
    """
    if prices_norm is None or prices_norm.height == 0:
        return []
    df = prices_norm.filter(pl.col("asset_class").is_in(list(PRICE_CLASSES)))
    if df.height == 0:
        return []

    rows = []
    for series_id in df.get_column("series_id").unique().to_list():
        sub = df.filter(pl.col("series_id") == series_id)
        asset_class = sub.tail(1).get_column("asset_class").to_list()[0]
        display_name = sub.tail(1).get_column("display_name").to_list()[0]
        dates, values = R.to_series(df, series_id)
        if len(values) < 2:
            continue
        # group last value of each year
        by_year: dict[int, float] = {}
        for d, v in zip(dates, values):
            by_year[d.year] = v  # last seen (sorted asc) is year-end
        years = sorted(by_year.keys())
        for i in range(1, len(years)):
            prev_y, cur_y = years[i - 1], years[i]
            base = by_year[prev_y]
            cur = by_year[cur_y]
            if base and base != 0:
                ret = cur / base - 1.0
                rows.append(
                    {
                        "series_id": series_id,
                        "display_name": display_name,
                        "asset_class": asset_class,
                        "year": cur_y,
                        "total_return": R.round_or_none(ret, 4),
                    }
                )
    rows.sort(key=lambda r: (r["year"], r["series_id"]))
    return rows


def asset_monthly_returns(prices_norm: pl.DataFrame) -> list[dict]:
    """Monthly returns per series for partial-year quilt calculations."""
    if prices_norm is None or prices_norm.height == 0:
        return []
    df = prices_norm.filter(pl.col("asset_class").is_in(list(PRICE_CLASSES)))
    if df.height == 0:
        return []

    rows = []
    for series_id in df.get_column("series_id").unique().to_list():
        sub = df.filter(pl.col("series_id") == series_id)
        asset_class = sub.tail(1).get_column("asset_class").to_list()[0]
        display_name = sub.tail(1).get_column("display_name").to_list()[0]
        dates, values = R.to_series(df, series_id)
        if len(values) < 2:
            continue
        by_month: dict[tuple[int, int], float] = {}
        for d, v in zip(dates, values):
            by_month[(d.year, d.month)] = v
        keys = sorted(by_month.keys())
        for i in range(1, len(keys)):
            prev_k, cur_k = keys[i - 1], keys[i]
            base = by_month[prev_k]
            cur = by_month[cur_k]
            if base and base != 0:
                ret = cur / base - 1.0
                rows.append(
                    {
                        "series_id": series_id,
                        "display_name": display_name,
                        "asset_class": asset_class,
                        "year": cur_k[0],
                        "month": cur_k[1],
                        "monthly_return": R.round_or_none(ret, 6),
                    }
                )
    rows.sort(key=lambda r: (r["year"], r["month"], r["series_id"]))
    return rows


def asset_daily_prices(prices_norm: pl.DataFrame) -> list[dict]:
    """Daily price levels per series for intra-month quilt calculations.

    Stores the normalized price level for each trading day so the frontend
    can compute returns between any two arbitrary dates.
    """
    if prices_norm is None or prices_norm.height == 0:
        return []
    df = prices_norm.filter(pl.col("asset_class").is_in(list(PRICE_CLASSES)))
    if df.height == 0:
        return []

    rows = []
    for series_id in df.get_column("series_id").unique().to_list():
        sub = df.filter(pl.col("series_id") == series_id)
        asset_class = sub.tail(1).get_column("asset_class").to_list()[0]
        display_name = sub.tail(1).get_column("display_name").to_list()[0]
        dates, values = R.to_series(df, series_id)
        for d, v in zip(dates, values):
            rows.append(
                {
                    "series_id": series_id,
                    "display_name": display_name,
                    "asset_class": asset_class,
                    "date": d.isoformat(),
                    "price": R.round_or_none(v, 4),
                }
            )
    rows.sort(key=lambda r: (r["date"], r["series_id"]))
    return rows


def current_drawdowns(prices_norm: pl.DataFrame) -> list[dict]:
    """Current drawdown per series, deepest first."""
    if prices_norm is None or prices_norm.height == 0:
        return []
    df = prices_norm.filter(pl.col("asset_class").is_in(list(PRICE_CLASSES)))
    rows = []
    for series_id in df.get_column("series_id").unique().to_list():
        sub = df.filter(pl.col("series_id") == series_id)
        _, values = R.to_series(df, series_id)
        if not values:
            continue
        rows.append(
            {
                "series_id": series_id,
                "display_name": sub.tail(1).get_column("display_name").to_list()[0],
                "drawdown": R.round_or_none(R.current_drawdown(values), 4),
            }
        )
    rows.sort(key=lambda r: (r["drawdown"] is None, r["drawdown"] if r["drawdown"] is not None else 0.0))
    return rows


def rolling_return_percentiles(
    prices_norm: pl.DataFrame, windows: tuple[int, ...] = (21, 63, 252)
) -> list[dict]:
    """Per series, percentile rank of the latest window return for each window."""
    if prices_norm is None or prices_norm.height == 0:
        return []
    df = prices_norm.filter(pl.col("asset_class").is_in(list(PRICE_CLASSES)))
    rows = []
    for series_id in sorted(df.get_column("series_id").unique().to_list()):
        sub = df.filter(pl.col("series_id") == series_id)
        dates, values = R.to_series(df, series_id)
        if not values:
            continue
        entry = {
            "series_id": series_id,
            "display_name": sub.tail(1).get_column("display_name").to_list()[0],
        }
        any_window = False
        for w in windows:
            rolls = R.rolling_returns(dates, values, w)
            if not rolls:
                entry[f"w{w}_return"] = None
                entry[f"w{w}_pctile"] = None
                continue
            any_window = True
            cur = rolls[-1]
            srt = sorted(rolls)
            entry[f"w{w}_return"] = R.round_or_none(cur, 4)
            entry[f"w{w}_pctile"] = R.round_or_none(R.percentile_rank(srt, cur), 4)
        if any_window:
            rows.append(entry)
    return rows


# Rate series eligible for ranking, with friendly labels.
_RATE_SERIES = {
    "DGS3MO": "3-Month",
    "DGS2": "2-Year",
    "DGS5": "5-Year",
    "DGS10": "10-Year",
    "DGS30": "30-Year",
    "DFF": "Fed Funds",
    "SOFR": "SOFR",
}


def rate_moves_ranked(macro_norm: pl.DataFrame) -> list[dict]:
    """Rank rate series by |1M change in bps| with percentile vs own history."""
    if macro_norm is None or macro_norm.height == 0:
        return []
    rows = []
    for series_id, label in _RATE_SERIES.items():
        dates, values = R.to_series(macro_norm, series_id)
        if len(values) < 1 + R.TD_1M:
            continue
        last = values[-1]
        base = values[-1 - R.TD_1M]
        if last is None or base is None:
            continue
        chg_bps = (last - base) * 100.0
        # historical distribution of 1M changes (bps)
        hist = [
            (values[i] - values[i - R.TD_1M]) * 100.0
            for i in range(R.TD_1M, len(values))
            if values[i] is not None and values[i - R.TD_1M] is not None
        ]
        abs_hist = sorted(abs(x) for x in hist)
        pctile = R.percentile_rank(abs_hist, abs(chg_bps)) if abs_hist else None
        rows.append(
            {
                "series_id": series_id,
                "label": label,
                "chg_1m_bps": R.round_or_none(chg_bps, 1),
                "abs_chg_1m_bps": R.round_or_none(abs(chg_bps), 1),
                "pctile_vs_history": R.round_or_none(pctile, 4),
            }
        )
    rows.sort(key=lambda r: r["abs_chg_1m_bps"] or 0.0, reverse=True)
    return rows


def inflation_vs_policy_gap(macro_norm: pl.DataFrame) -> dict:
    """Real policy rate = policy rate (DFF) - CPI YoY."""
    out = {"cpi_yoy": None, "policy_rate": None, "gap": None}
    if macro_norm is None or macro_norm.height == 0:
        return out
    from market_data_pipeline.src.analytics.inflation import (
        _looks_like_percent,
    )

    sub = macro_norm.filter(pl.col("series_id") == "CPIAUCSL")
    cpi_yoy = None
    if sub.height > 0:
        _, cvals = R.to_series(sub, "CPIAUCSL")
        unit = sub.tail(1).get_column("unit").to_list()[0]
        if cvals:
            cpi_yoy = cvals[-1] if _looks_like_percent(cvals, unit) else R.yoy(cvals)

    _, dff = R.to_series(macro_norm, "DFF")
    policy = dff[-1] if dff else None

    gap = None
    if cpi_yoy is not None and policy is not None:
        gap = policy - cpi_yoy

    out["cpi_yoy"] = R.round_or_none(cpi_yoy, 4)
    out["policy_rate"] = R.round_or_none(policy, 4)
    out["gap"] = R.round_or_none(gap, 4)
    return out


def unemployment_vs_longrun(macro_norm: pl.DataFrame, longrun: float = 4.0) -> dict:
    """Unemployment rate (UNRATE) vs an assumed long-run natural rate."""
    out = {"unrate": None, "longrun": round(float(longrun), 4), "gap": None, "label": "UNKNOWN"}
    if macro_norm is None or macro_norm.height == 0:
        return out
    _, unrate = R.to_series(macro_norm, "UNRATE")
    if not unrate:
        return out
    cur = unrate[-1]
    gap = cur - longrun
    if gap > 0.25:
        label = "ABOVE"  # slack in labor market
    elif gap < -0.25:
        label = "BELOW"  # tight labor market
    else:
        label = "AT"
    out["unrate"] = R.round_or_none(cur, 4)
    out["gap"] = R.round_or_none(gap, 4)
    out["label"] = label
    return out
