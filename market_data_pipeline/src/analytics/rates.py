"""Rates dashboard card: yield curve, key spreads, and rate changes."""

from __future__ import annotations

from typing import Optional

import polars as pl

from market_data_pipeline.src.analytics import _returns as R

# series_id -> (tenor label, sort order)
CURVE_TENORS = {
    "DGS3MO": ("3M", 0),
    "DGS2": ("2Y", 1),
    "DGS5": ("5Y", 2),
    "DGS10": ("10Y", 3),
    "DGS30": ("30Y", 4),
}

# Human labels for the change table (includes policy rates).
CHANGE_LABELS = {
    "DGS3MO": "3-Month",
    "DGS2": "2-Year",
    "DGS5": "5-Year",
    "DGS10": "10-Year",
    "DGS30": "30-Year",
    "DFF": "Fed Funds",
    "SOFR": "SOFR",
}


def _latest(df: pl.DataFrame, series_id: str) -> tuple[list, list]:
    return R.to_series(df, series_id)


def _bps_change(values, dates, lookback_label: str) -> Optional[float]:
    """Change in bps over a calendar/index lookback. yields are percent."""
    if not values:
        return None
    last = values[-1]
    base = None
    if lookback_label == "1d":
        if len(values) >= 2:
            base = values[-2]
    elif lookback_label == "1w":
        if len(values) >= 1 + R.TD_1W:
            base = values[-1 - R.TD_1W]
    elif lookback_label == "1m":
        if len(values) >= 1 + R.TD_1M:
            base = values[-1 - R.TD_1M]
    elif lookback_label == "3m":
        if len(values) >= 1 + R.TD_3M:
            base = values[-1 - R.TD_3M]
    elif lookback_label == "ytd":
        last_date = dates[-1]
        from datetime import date as _date

        anchor = _date(last_date.year, 1, 1)
        for d, v in zip(dates, values):
            if d < anchor:
                base = v
            else:
                break
    if base is None or last is None:
        return None
    return R.round_or_none((last - base) * 100.0, 1)


def rates_dashboard(macro_norm: pl.DataFrame) -> dict:
    """Build the rates dashboard: curve, spreads, and change table.

    yields are percent; spreads and changes are in basis points
    (x100 of the percent difference).
    """
    out = {
        "asof": None,
        "curve": [],
        "spreads": {"two_s_ten_s_bps": None, "three_m_ten_y_bps": None},
        "changes": [],
    }
    if macro_norm is None or macro_norm.height == 0:
        return out

    df = macro_norm
    max_asof = None
    latest_yield: dict[str, float] = {}

    # Curve
    curve_rows = []
    for series_id, (label, order) in CURVE_TENORS.items():
        dates, values = _latest(df, series_id)
        if not values:
            continue
        latest_yield[series_id] = values[-1]
        if max_asof is None or dates[-1] > max_asof:
            max_asof = dates[-1]
        curve_rows.append(
            {
                "series_id": series_id,
                "tenor": label,
                "label": label,
                "yield": R.round_or_none(values[-1], 4),
                "_order": order,
            }
        )
    curve_rows.sort(key=lambda r: r["_order"])
    for r in curve_rows:
        r.pop("_order", None)
    out["curve"] = curve_rows

    # Spreads (bps)
    if "DGS2" in latest_yield and "DGS10" in latest_yield:
        out["spreads"]["two_s_ten_s_bps"] = R.round_or_none(
            (latest_yield["DGS10"] - latest_yield["DGS2"]) * 100.0, 1
        )
    if "DGS3MO" in latest_yield and "DGS10" in latest_yield:
        out["spreads"]["three_m_ten_y_bps"] = R.round_or_none(
            (latest_yield["DGS10"] - latest_yield["DGS3MO"]) * 100.0, 1
        )

    # Changes table
    changes = []
    for series_id, label in CHANGE_LABELS.items():
        dates, values = _latest(df, series_id)
        if not values:
            continue
        if max_asof is None or dates[-1] > max_asof:
            max_asof = dates[-1]
        changes.append(
            {
                "series_id": series_id,
                "label": label,
                "latest": R.round_or_none(values[-1], 4),
                "chg_1d_bps": _bps_change(values, dates, "1d"),
                "chg_1w_bps": _bps_change(values, dates, "1w"),
                "chg_1m_bps": _bps_change(values, dates, "1m"),
                "chg_3m_bps": _bps_change(values, dates, "3m"),
                "chg_ytd_bps": _bps_change(values, dates, "ytd"),
            }
        )
    out["changes"] = changes
    out["asof"] = max_asof.isoformat() if max_asof is not None else None
    return out
