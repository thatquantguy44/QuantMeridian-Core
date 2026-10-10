"""Inflation dashboard card: YoY / MoM and trend per CPI / PCE measure."""

from __future__ import annotations

from typing import Optional

import polars as pl

from market_data_pipeline.src.analytics import _returns as R

INFLATION_SERIES = {
    "CPIAUCSL": "CPI",
    "CPILFESL": "Core CPI",
    "PCEPI": "PCE",
    "PCEPILFE": "Core PCE",
}

TREND_THRESHOLD = 0.05


def _looks_like_percent(values, unit: Optional[str]) -> bool:
    """Heuristic: a series already expressed as YoY percent rather than a level.

    Index levels (CPIAUCSL etc.) sit well above 50; YoY percents are small.
    """
    if unit is not None and unit.strip() in {"%", "percent", "pct"}:
        return True
    if not values:
        return False
    last = values[-1]
    if last is None:
        return False
    return abs(last) < 50.0


def _trend(yoy_now: Optional[float], yoy_prior: Optional[float]) -> str:
    if yoy_now is None or yoy_prior is None:
        return "FLAT"
    diff = yoy_now - yoy_prior
    if diff > TREND_THRESHOLD:
        return "RISING"
    if diff < -TREND_THRESHOLD:
        return "FALLING"
    return "FLAT"


def inflation_dashboard(macro_norm: pl.DataFrame) -> list[dict]:
    """One card per inflation measure with YoY / prior YoY / MoM and trend.

    macro_norm carries monthly index levels (unit 'lin'); YoY and MoM are
    derived. If a series already looks like a YoY percent it is used directly.
    """
    if macro_norm is None or macro_norm.height == 0:
        return []

    cards: list[dict] = []
    for series_id, label in INFLATION_SERIES.items():
        sub = macro_norm.filter(pl.col("series_id") == series_id)
        if sub.height == 0:
            continue
        dates, values = R.to_series(sub, series_id)
        if not values:
            continue
        unit = sub.tail(1).get_column("unit").to_list()[0]

        if _looks_like_percent(values, unit):
            yoy_now = values[-1]
            yoy_prior = values[-2] if len(values) >= 2 else None
            mom_val = R.round_or_none(values[-1] - values[-2], 4) if len(values) >= 2 else None
        else:
            yoy_now = R.yoy(values)
            yoy_prior = R.yoy_prior(values)
            mom_val = R.mom(values)

        cards.append(
            {
                "series_id": series_id,
                "label": label,
                "yoy": R.round_or_none(yoy_now, 4),
                "prior_yoy": R.round_or_none(yoy_prior, 4),
                "mom": R.round_or_none(mom_val, 4),
                "trend": _trend(yoy_now, yoy_prior),
                "asof": dates[-1].isoformat(),
            }
        )
    return cards
