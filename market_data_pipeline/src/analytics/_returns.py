"""Shared return / drawdown math helpers operating on a single series.

All helpers are pure functions over lists of (date, value) so they can be
reused across every terminal card. They never raise on short input -- when
there is not enough data they return ``None`` (or an empty list). No NaN or
Inf is ever emitted; non-finite results are coerced to ``None``.
"""

from __future__ import annotations

import math
from datetime import date
from typing import Optional, Sequence

import polars as pl

# Approximate trading-day lookbacks used for window returns.
TD_1W = 5
TD_1M = 21
TD_3M = 63
TD_1Y = 252


def _finite(x: Optional[float]) -> Optional[float]:
    """Coerce NaN/Inf/None to None, else return a plain float."""
    if x is None:
        return None
    try:
        xf = float(x)
    except (TypeError, ValueError):
        return None
    if math.isnan(xf) or math.isinf(xf):
        return None
    return xf


def to_series(df: pl.DataFrame, series_id: str) -> tuple[list[date], list[float]]:
    """Return (dates, values) for one series_id, sorted ascending, nulls dropped."""
    if df is None or df.height == 0:
        return [], []
    sub = df.filter(pl.col("series_id") == series_id)
    if sub.height == 0:
        return [], []
    sub = (
        sub.select(["date", "value"])
        .drop_nulls()
        .unique(subset=["date"], keep="last")
        .sort("date")
    )
    dates = list(sub.get_column("date").to_list())
    values = [float(v) for v in sub.get_column("value").to_list()]
    return dates, values


def pct_return(values: Sequence[float], lookback_index: int) -> Optional[float]:
    """Simple return from values[-1-lookback_index] to values[-1] (decimal)."""
    if values is None:
        return None
    n = len(values)
    idx = n - 1 - lookback_index
    if idx < 0 or n == 0:
        return None
    base = values[idx]
    last = values[-1]
    if base is None or last is None or base == 0:
        return None
    return _finite(last / base - 1.0)


def ret_1d(values: Sequence[float]) -> Optional[float]:
    return pct_return(values, 1)


def ret_5d(values: Sequence[float]) -> Optional[float]:
    return pct_return(values, TD_1W)


def ret_1y(values: Sequence[float]) -> Optional[float]:
    return pct_return(values, TD_1Y)


def _return_since(dates: Sequence[date], values: Sequence[float], anchor: date) -> Optional[float]:
    """Return from the last observation on-or-before ``anchor`` to the last value."""
    if not dates or not values:
        return None
    base_val = None
    for d, v in zip(dates, values):
        if d <= anchor:
            base_val = v
        else:
            break
    if base_val is None or base_val == 0:
        return None
    last = values[-1]
    if last is None:
        return None
    return _finite(last / base_val - 1.0)


def mtd(dates: Sequence[date], values: Sequence[float]) -> Optional[float]:
    """Month-to-date return (from last close of prior month)."""
    if not dates:
        return None
    last = dates[-1]
    anchor = date(last.year, last.month, 1)
    # base is last observation strictly before the 1st of the current month
    base_val = None
    for d, v in zip(dates, values):
        if d < anchor:
            base_val = v
        else:
            break
    if base_val is None or base_val == 0:
        return None
    if values[-1] is None:
        return None
    return _finite(values[-1] / base_val - 1.0)


def ytd(dates: Sequence[date], values: Sequence[float]) -> Optional[float]:
    """Year-to-date return (from last close of prior year)."""
    if not dates:
        return None
    last = dates[-1]
    anchor = date(last.year, 1, 1)
    base_val = None
    for d, v in zip(dates, values):
        if d < anchor:
            base_val = v
        else:
            break
    if base_val is None or base_val == 0:
        return None
    if values[-1] is None:
        return None
    return _finite(values[-1] / base_val - 1.0)


def cagr(values: Sequence[float], dates: Sequence[date], years: float) -> Optional[float]:
    """Annualized return over the trailing ``years`` window (decimal).

    Uses the last observation on-or-before (last_date - years) as the base.
    Returns None if the window is not covered by the data.
    """
    if not values or not dates or years <= 0:
        return None
    last_date = dates[-1]
    try:
        target = date(last_date.year - int(years), last_date.month, last_date.day)
    except ValueError:
        # e.g. Feb 29 -> fall back to Feb 28
        target = date(last_date.year - int(years), last_date.month, 28)
    if dates[0] > target:
        return None
    base_val = None
    for d, v in zip(dates, values):
        if d <= target:
            base_val = v
        else:
            break
    if base_val is None or base_val <= 0:
        return None
    last = values[-1]
    if last is None or last <= 0:
        return None
    growth = last / base_val
    if growth <= 0:
        return None
    return _finite(growth ** (1.0 / years) - 1.0)


def max_drawdown(values: Sequence[float]) -> Optional[float]:
    """Most negative peak-to-trough drawdown over the path (decimal, <= 0)."""
    if not values:
        return None
    peak = None
    worst = 0.0
    for v in values:
        if v is None:
            continue
        if peak is None or v > peak:
            peak = v
        if peak is not None and peak > 0:
            dd = v / peak - 1.0
            if dd < worst:
                worst = dd
    return _finite(worst)


def current_drawdown(values: Sequence[float]) -> Optional[float]:
    """Drawdown from the running max to the last value (decimal, <= 0)."""
    if not values:
        return None
    clean = [v for v in values if v is not None]
    if not clean:
        return None
    peak = max(clean)
    last = clean[-1]
    if peak <= 0:
        return None
    return _finite(min(0.0, last / peak - 1.0))


def distance_from_52w_high(dates: Sequence[date], values: Sequence[float]) -> Optional[float]:
    """Decimal distance (<= 0) of the last value from the trailing 52-week high."""
    if not dates or not values:
        return None
    last_date = dates[-1]
    try:
        cutoff = date(last_date.year - 1, last_date.month, last_date.day)
    except ValueError:
        cutoff = date(last_date.year - 1, last_date.month, 28)
    window = [v for d, v in zip(dates, values) if d >= cutoff and v is not None]
    if not window:
        return None
    high = max(window)
    last = values[-1]
    if high <= 0 or last is None:
        return None
    return _finite(min(0.0, last / high - 1.0))


def high_52w(dates: Sequence[date], values: Sequence[float]) -> Optional[float]:
    """Trailing 52-week high value."""
    if not dates or not values:
        return None
    last_date = dates[-1]
    try:
        cutoff = date(last_date.year - 1, last_date.month, last_date.day)
    except ValueError:
        cutoff = date(last_date.year - 1, last_date.month, 28)
    window = [v for d, v in zip(dates, values) if d >= cutoff and v is not None]
    if not window:
        return None
    return _finite(max(window))


def rolling_returns(
    dates: Sequence[date], values: Sequence[float], window_days: int
) -> list[float]:
    """Index-based rolling returns over ``window_days`` observations (decimals)."""
    if not values or window_days <= 0:
        return []
    out: list[float] = []
    for i in range(window_days, len(values)):
        base = values[i - window_days]
        cur = values[i]
        if base is None or cur is None or base == 0:
            continue
        r = _finite(cur / base - 1.0)
        if r is not None:
            out.append(r)
    return out


def percentile(sorted_vals: Sequence[float], q: float) -> Optional[float]:
    """Linear-interpolated percentile of an ascending-sorted sequence.

    ``q`` in [0, 1]. Returns None on empty input.
    """
    if not sorted_vals:
        return None
    n = len(sorted_vals)
    if n == 1:
        return _finite(sorted_vals[0])
    q = min(max(q, 0.0), 1.0)
    pos = q * (n - 1)
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return _finite(sorted_vals[lo])
    frac = pos - lo
    return _finite(sorted_vals[lo] * (1 - frac) + sorted_vals[hi] * frac)


def percentile_rank(sorted_vals: Sequence[float], value: float) -> Optional[float]:
    """Fraction of values <= ``value`` (in [0, 1]) given an ascending sequence."""
    if not sorted_vals or value is None:
        return None
    cnt = sum(1 for v in sorted_vals if v <= value)
    return _finite(cnt / len(sorted_vals))


def yoy(values_monthly: Sequence[float]) -> Optional[float]:
    """Year-over-year percent change of a monthly index level series."""
    if not values_monthly or len(values_monthly) < 13:
        return None
    base = values_monthly[-13]
    last = values_monthly[-1]
    if base is None or last is None or base == 0:
        return None
    return _finite((last / base - 1.0) * 100.0)


def yoy_prior(values_monthly: Sequence[float]) -> Optional[float]:
    """Prior-period YoY (one month before the latest)."""
    if not values_monthly or len(values_monthly) < 14:
        return None
    base = values_monthly[-14]
    last = values_monthly[-2]
    if base is None or last is None or base == 0:
        return None
    return _finite((last / base - 1.0) * 100.0)


def mom(values_monthly: Sequence[float]) -> Optional[float]:
    """Month-over-month percent change of a monthly index level series."""
    if not values_monthly or len(values_monthly) < 2:
        return None
    base = values_monthly[-2]
    last = values_monthly[-1]
    if base is None or last is None or base == 0:
        return None
    return _finite((last / base - 1.0) * 100.0)


def round_or_none(x: Optional[float], ndigits: int) -> Optional[float]:
    """Round, coercing non-finite to None."""
    x = _finite(x)
    if x is None:
        return None
    return round(x, ndigits)
