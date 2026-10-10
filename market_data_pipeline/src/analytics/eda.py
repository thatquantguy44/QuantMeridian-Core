"""Exploratory Data Analysis (EDA) analytics module.

Cross-correlation, lagged OLS, Granger causality, Pearson heatmap,
CUSUM changepoint detection, and simplified PELT changepoint detection
for economically meaningful pairs.

All functions return JSON-native structures and are robust to empty/short
input -- they never raise on missing data.
"""

from __future__ import annotations

import math
from datetime import date
from typing import Optional, Sequence

import numpy as np
import polars as pl

from market_data_pipeline.src.analytics import _returns as R
from market_data_pipeline.src.analytics.snapshot import PRICE_CLASSES

# ---------------------------------------------------------------------------
# Economically meaningful pairs  (leader, follower)
# ---------------------------------------------------------------------------

PAIR_LIST: list[tuple[str, str]] = [
    ("DGS2", "SPY"),            # short rates leading equities
    ("CPIAUCSL", "GLD"),        # inflation leading gold
    ("T10Y2Y", "HYG"),          # yield curve leading credit
    ("BAMLH0A0HYM2", "SPY"),   # credit spreads leading equities
    ("FEDFUNDS", "TLT"),        # fed funds leading long bonds
    ("DGS10", "VNQ"),           # 10Y rates leading REITs
    ("UNRATE", "IWM"),          # unemployment leading small caps
    ("USO", "CPIAUCSL"),        # oil leading CPI
    ("VIXY", "HYG"),            # vol leading credit
    ("EEM", "UUP"),             # EM equities vs dollar
    ("DGS10", "AGG"),           # 10Y rates leading agg bonds
    ("T10Y2Y", "SPY"),          # yield curve leading equities
    ("SOFR", "SHY"),            # overnight rate leading short bonds
    ("DGS2", "DGS10"),          # short vs long rates
    ("FEDFUNDS", "IEF"),        # fed funds leading intermediate bonds
    ("UNRATE", "SPY"),          # unemployment leading equities
    ("DGS10", "GLD"),           # 10Y rates leading gold
    ("BAMLH0A0HYM2", "HYG"),   # credit spreads leading HY bonds
]

# Series to run changepoint detection on
CHANGEPOINT_SERIES = [
    "SPY", "QQQ", "AGG", "TLT", "HYG", "GLD",
    "DGS10", "CPIAUCSL", "UNRATE", "FEDFUNDS",
]

# Friendly display names for series not easily derived
_DISPLAY_NAMES: dict[str, str] = {
    "SPY": "S&P 500", "QQQ": "Nasdaq 100", "DIA": "Dow Jones",
    "IWM": "Russell 2000", "EFA": "EAFE", "EEM": "Emerging Markets",
    "AGG": "US Agg Bonds", "TLT": "20+ Year Treasuries",
    "IEF": "7-10Y Treasuries", "SHY": "1-3Y Treasuries",
    "HYG": "High Yield", "LQD": "Inv Grade Corp", "GLD": "Gold",
    "SLV": "Silver", "USO": "Crude Oil", "DBC": "Broad Commodities",
    "VNQ": "REITs", "VIXY": "VIX Futures", "UUP": "US Dollar",
    "TIP": "TIPS",
    "DGS2": "2-Year Treasury", "DGS10": "10-Year Treasury",
    "T10Y2Y": "10Y-2Y Spread", "FEDFUNDS": "Fed Funds Rate",
    "SOFR": "SOFR Rate", "BAMLH0A0HYM2": "HY OAS Spread",
    "CPIAUCSL": "CPI", "UNRATE": "Unemployment Rate",
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_display_name(df: pl.DataFrame, series_id: str) -> str:
    """Look up display_name from the dataframe, fall back to constant map."""
    if df is not None and df.height > 0 and "display_name" in df.columns:
        sub = df.filter(pl.col("series_id") == series_id)
        if sub.height > 0:
            name = sub.tail(1).get_column("display_name").to_list()[0]
            if name:
                return name
    return _DISPLAY_NAMES.get(series_id, series_id)


def _extract_series(prices_norm: pl.DataFrame, macro_norm: pl.DataFrame,
                    series_id: str) -> tuple[list[date], list[float]]:
    """Try to extract a series from prices first, then macro."""
    dates, values = R.to_series(prices_norm, series_id)
    if not values:
        dates, values = R.to_series(macro_norm, series_id)
    return dates, values


def _to_monthly_returns(dates: list[date], values: list[float]
                        ) -> tuple[list[date], list[float]]:
    """Convert daily observations to monthly returns (end-of-month).

    Returns (month_end_dates, pct_changes) where pct_changes are simple
    decimal returns.
    """
    if len(dates) < 2 or len(values) < 2:
        return [], []

    # Group by (year, month) and take the last value
    by_month: dict[tuple[int, int], tuple[date, float]] = {}
    for d, v in zip(dates, values):
        by_month[(d.year, d.month)] = (d, v)

    sorted_keys = sorted(by_month.keys())
    if len(sorted_keys) < 2:
        return [], []

    month_dates: list[date] = []
    month_returns: list[float] = []
    for i in range(1, len(sorted_keys)):
        prev_val = by_month[sorted_keys[i - 1]][1]
        cur_date, cur_val = by_month[sorted_keys[i]]
        if prev_val is None or cur_val is None or prev_val == 0:
            continue
        ret = cur_val / prev_val - 1.0
        if math.isfinite(ret):
            month_dates.append(cur_date)
            month_returns.append(ret)

    return month_dates, month_returns


def _aligned_monthly_returns(
    d1_dates: list[date], d1_values: list[float],
    d2_dates: list[date], d2_values: list[float],
) -> tuple[list[float], list[float]]:
    """Convert daily series to monthly returns and align by month.

    Returns two lists of equal length containing aligned monthly returns.
    """
    dates1, rets1 = _to_monthly_returns(d1_dates, d1_values)
    dates2, rets2 = _to_monthly_returns(d2_dates, d2_values)

    if not rets1 or not rets2:
        return [], []

    # Build lookup by (year, month)
    lookup1: dict[tuple[int, int], float] = {
        (d.year, d.month): r for d, r in zip(dates1, rets1)
    }
    lookup2: dict[tuple[int, int], float] = {
        (d.year, d.month): r for d, r in zip(dates2, rets2)
    }

    common = sorted(set(lookup1.keys()) & set(lookup2.keys()))
    if not common:
        return [], []

    aligned1 = [lookup1[k] for k in common]
    aligned2 = [lookup2[k] for k in common]
    return aligned1, aligned2


def _rnd(x: Optional[float], ndigits: int = 4) -> Optional[float]:
    """Round with non-finite guard."""
    return R.round_or_none(x, ndigits)


# ---------------------------------------------------------------------------
# 1. Cross-correlation
# ---------------------------------------------------------------------------


def cross_correlation(
    prices_norm: pl.DataFrame,
    macro_norm: pl.DataFrame,
    max_lag: int = 12,
) -> list[dict]:
    """Compute CCF at lags -max_lag to +max_lag for each pair."""
    if prices_norm is None or macro_norm is None:
        return []

    results: list[dict] = []
    for leader_id, follower_id in PAIR_LIST:
        d1, v1 = _extract_series(prices_norm, macro_norm, leader_id)
        d2, v2 = _extract_series(prices_norm, macro_norm, follower_id)
        a1, a2 = _aligned_monthly_returns(d1, v1, d2, v2)
        if len(a1) < max_lag + 2:
            continue

        x = np.array(a1, dtype=np.float64)
        y = np.array(a2, dtype=np.float64)
        x = (x - x.mean()) / (x.std() + 1e-12)
        y = (y - y.mean()) / (y.std() + 1e-12)
        n = len(x)

        ccf_values: list[dict] = []
        best_lag = 0
        best_corr = 0.0

        for lag in range(-max_lag, max_lag + 1):
            if lag >= 0:
                corr = np.dot(x[:n - lag], y[lag:]) / n if n - lag > 0 else 0.0
            else:
                corr = np.dot(x[-lag:], y[:n + lag]) / n if n + lag > 0 else 0.0
            corr_val = float(corr) if math.isfinite(float(corr)) else 0.0
            ccf_values.append({"lag": lag, "corr": _rnd(corr_val)})
            if abs(corr_val) > abs(best_corr):
                best_corr = corr_val
                best_lag = lag

        leader_name = _get_display_name(
            macro_norm if R.to_series(macro_norm, leader_id)[1] else prices_norm,
            leader_id,
        )
        follower_name = _get_display_name(
            macro_norm if R.to_series(macro_norm, follower_id)[1] else prices_norm,
            follower_id,
        )

        results.append({
            "leader": leader_id,
            "follower": follower_id,
            "leader_name": leader_name,
            "follower_name": follower_name,
            "best_lag": best_lag,
            "best_corr": _rnd(best_corr),
            "ccf": ccf_values,
        })

    return results


# ---------------------------------------------------------------------------
# 2. Lagged OLS
# ---------------------------------------------------------------------------


def lagged_ols(
    prices_norm: pl.DataFrame,
    macro_norm: pl.DataFrame,
    max_lag: int = 6,
) -> list[dict]:
    """OLS regression of follower returns on leader returns at each lag."""
    if prices_norm is None or macro_norm is None:
        return []

    results: list[dict] = []
    for leader_id, follower_id in PAIR_LIST:
        d1, v1 = _extract_series(prices_norm, macro_norm, leader_id)
        d2, v2 = _extract_series(prices_norm, macro_norm, follower_id)
        a_leader, a_follower = _aligned_monthly_returns(d1, v1, d2, v2)
        if len(a_leader) < max_lag + 3:
            continue

        x_full = np.array(a_leader, dtype=np.float64)
        y_full = np.array(a_follower, dtype=np.float64)

        lags_out: list[dict] = []
        best_lag = 0
        best_r2 = -1.0
        best_beta = 0.0
        best_pvalue = 1.0

        for lag in range(0, max_lag + 1):
            if lag == 0:
                x = x_full
                y = y_full
            else:
                x = x_full[:-lag]
                y = y_full[lag:]

            if len(x) < 3:
                continue

            # Simple OLS: y = alpha + beta * x
            n = len(x)
            x_mean = x.mean()
            y_mean = y.mean()
            ss_xx = np.sum((x - x_mean) ** 2)
            if ss_xx < 1e-15:
                lags_out.append({"lag": lag, "r2": 0.0, "beta": 0.0, "pvalue": 1.0})
                continue

            beta = float(np.sum((x - x_mean) * (y - y_mean)) / ss_xx)
            alpha = float(y_mean - beta * x_mean)
            y_pred = alpha + beta * x
            ss_res = float(np.sum((y - y_pred) ** 2))
            ss_tot = float(np.sum((y - y_mean) ** 2))
            r2 = 1.0 - ss_res / ss_tot if ss_tot > 1e-15 else 0.0

            # t-test for beta
            if n > 2 and ss_res > 0:
                se_beta = math.sqrt(ss_res / (n - 2) / ss_xx)
                if se_beta > 1e-15:
                    t_stat = beta / se_beta
                    # Two-sided p-value from t-distribution
                    try:
                        from scipy.stats import t as t_dist
                        pvalue = float(2.0 * t_dist.sf(abs(t_stat), n - 2))
                    except ImportError:
                        pvalue = 1.0
                else:
                    pvalue = 1.0
            else:
                pvalue = 1.0

            r2 = max(0.0, min(1.0, r2))
            lags_out.append({
                "lag": lag,
                "r2": _rnd(r2),
                "beta": _rnd(beta),
                "pvalue": _rnd(pvalue, 6),
            })

            if r2 > best_r2:
                best_r2 = r2
                best_lag = lag
                best_beta = beta
                best_pvalue = pvalue

        leader_name = _get_display_name(
            macro_norm if R.to_series(macro_norm, leader_id)[1] else prices_norm,
            leader_id,
        )
        follower_name = _get_display_name(
            macro_norm if R.to_series(macro_norm, follower_id)[1] else prices_norm,
            follower_id,
        )

        results.append({
            "leader": leader_id,
            "follower": follower_id,
            "leader_name": leader_name,
            "follower_name": follower_name,
            "best_lag": best_lag,
            "best_r2": _rnd(best_r2),
            "best_beta": _rnd(best_beta),
            "best_pvalue": _rnd(best_pvalue, 6),
            "lags": lags_out,
        })

    return results


# ---------------------------------------------------------------------------
# 3. Granger causality
# ---------------------------------------------------------------------------


def granger_causality(
    prices_norm: pl.DataFrame,
    macro_norm: pl.DataFrame,
    max_lag: int = 6,
) -> list[dict]:
    """Granger causality test for each pair."""
    if prices_norm is None or macro_norm is None:
        return []

    try:
        from statsmodels.tsa.stattools import grangercausalitytests
    except ImportError:
        return []

    results: list[dict] = []
    for leader_id, follower_id in PAIR_LIST:
        d1, v1 = _extract_series(prices_norm, macro_norm, leader_id)
        d2, v2 = _extract_series(prices_norm, macro_norm, follower_id)
        a_leader, a_follower = _aligned_monthly_returns(d1, v1, d2, v2)

        # Granger requires at least max_lag + a few observations
        if len(a_leader) < max_lag + 5:
            continue

        # statsmodels expects (y, x) as columns -- test if x Granger-causes y
        data = np.column_stack([
            np.array(a_follower, dtype=np.float64),
            np.array(a_leader, dtype=np.float64),
        ])

        try:
            gc_result = grangercausalitytests(data, maxlag=max_lag, verbose=False)
        except Exception:
            continue

        lags_out: list[dict] = []
        best_lag = 1
        best_f = 0.0
        best_p = 1.0

        for lag in range(1, max_lag + 1):
            try:
                test_res = gc_result[lag][0]
                f_stat = float(test_res["ssr_ftest"][0])
                p_value = float(test_res["ssr_ftest"][1])
            except (KeyError, IndexError, TypeError):
                f_stat = 0.0
                p_value = 1.0

            if not math.isfinite(f_stat):
                f_stat = 0.0
            if not math.isfinite(p_value):
                p_value = 1.0

            lags_out.append({
                "lag": lag,
                "f_stat": _rnd(f_stat),
                "p_value": _rnd(p_value, 6),
            })

            if f_stat > best_f:
                best_f = f_stat
                best_lag = lag
                best_p = p_value

        leader_name = _get_display_name(
            macro_norm if R.to_series(macro_norm, leader_id)[1] else prices_norm,
            leader_id,
        )
        follower_name = _get_display_name(
            macro_norm if R.to_series(macro_norm, follower_id)[1] else prices_norm,
            follower_id,
        )

        results.append({
            "leader": leader_id,
            "follower": follower_id,
            "leader_name": leader_name,
            "follower_name": follower_name,
            "best_lag": best_lag,
            "f_stat": _rnd(best_f),
            "p_value": _rnd(best_p, 6),
            "lags": lags_out,
        })

    return results


# ---------------------------------------------------------------------------
# 4. Pearson heatmap
# ---------------------------------------------------------------------------


def pearson_heatmap(prices_norm: pl.DataFrame) -> dict:
    """Pairwise Pearson correlation of monthly returns across price series."""
    empty = {"labels": [], "display_names": [], "matrix": []}
    if prices_norm is None or prices_norm.height == 0:
        return empty

    df = prices_norm.filter(pl.col("asset_class").is_in(list(PRICE_CLASSES)))
    if df.height == 0:
        return empty

    series_ids = sorted(df.get_column("series_id").unique().to_list())
    if not series_ids:
        return empty

    # Compute monthly returns for each series
    monthly_data: dict[str, dict[tuple[int, int], float]] = {}
    display_names: list[str] = []

    for sid in series_ids:
        dates, values = R.to_series(df, sid)
        m_dates, m_rets = _to_monthly_returns(dates, values)
        if not m_rets:
            continue
        monthly_data[sid] = {
            (d.year, d.month): r for d, r in zip(m_dates, m_rets)
        }
        display_names.append(_get_display_name(prices_norm, sid))

    valid_ids = list(monthly_data.keys())
    if len(valid_ids) < 2:
        return empty

    # Align all series by common months
    common_months = set.intersection(*(set(v.keys()) for v in monthly_data.values()))
    if len(common_months) < 3:
        # Fallback: use pairwise common months
        pass

    n = len(valid_ids)
    matrix: list[list[Optional[float]]] = [[0.0] * n for _ in range(n)]

    for i in range(n):
        matrix[i][i] = 1.0
        for j in range(i + 1, n):
            data_i = monthly_data[valid_ids[i]]
            data_j = monthly_data[valid_ids[j]]
            common = sorted(set(data_i.keys()) & set(data_j.keys()))
            if len(common) < 3:
                matrix[i][j] = None
                matrix[j][i] = None
                continue
            arr_i = np.array([data_i[k] for k in common])
            arr_j = np.array([data_j[k] for k in common])
            corr = float(np.corrcoef(arr_i, arr_j)[0, 1])
            corr = corr if math.isfinite(corr) else None
            matrix[i][j] = _rnd(corr)
            matrix[j][i] = _rnd(corr)

    return {
        "labels": valid_ids,
        "display_names": [_get_display_name(prices_norm, s) for s in valid_ids],
        "matrix": matrix,
    }


# ---------------------------------------------------------------------------
# 5. CUSUM changepoints
# ---------------------------------------------------------------------------


def cusum_changepoints(
    prices_norm: pl.DataFrame,
    macro_norm: pl.DataFrame,
    threshold: float = 4.0,
) -> list[dict]:
    """CUSUM control chart changepoint detection on key series."""
    _prices = prices_norm if prices_norm is not None else pl.DataFrame()
    _macro = macro_norm if macro_norm is not None else pl.DataFrame()
    if _prices.is_empty() and _macro.is_empty():
        return []

    results: list[dict] = []
    for series_id in CHANGEPOINT_SERIES:
        dates, values = _extract_series(_prices, _macro, series_id)
        if len(values) < 10:
            continue

        # Compute daily returns
        returns: list[float] = []
        return_dates: list[date] = []
        for i in range(1, len(values)):
            if values[i - 1] is None or values[i] is None or values[i - 1] == 0:
                continue
            r = values[i] / values[i - 1] - 1.0
            if math.isfinite(r):
                returns.append(r)
                return_dates.append(dates[i])

        if len(returns) < 10:
            continue

        arr = np.array(returns, dtype=np.float64)
        mu = float(arr.mean())
        sigma = float(arr.std())
        if sigma < 1e-15:
            continue

        standardized = (arr - mu) / sigma

        # CUSUM: cumulative sum of positive and negative deviations
        cusum_pos = np.zeros(len(standardized))
        cusum_neg = np.zeros(len(standardized))
        changepoints: list[str] = []

        for i in range(1, len(standardized)):
            cusum_pos[i] = max(0.0, cusum_pos[i - 1] + standardized[i])
            cusum_neg[i] = min(0.0, cusum_neg[i - 1] + standardized[i])
            if cusum_pos[i] > threshold or cusum_neg[i] < -threshold:
                changepoints.append(return_dates[i].isoformat())
                cusum_pos[i] = 0.0
                cusum_neg[i] = 0.0

        # Limit cusum_path to last 252 points
        tail = min(252, len(return_dates))
        cusum_path = [
            {
                "date": return_dates[-tail + k].isoformat(),
                "cusum_pos": _rnd(float(cusum_pos[-tail + k])),
                "cusum_neg": _rnd(float(cusum_neg[-tail + k])),
            }
            for k in range(tail)
        ]

        display_name = _get_display_name(_prices, series_id)
        if display_name == series_id:
            display_name = _get_display_name(_macro, series_id)

        results.append({
            "series_id": series_id,
            "display_name": display_name,
            "changepoints": changepoints,
            "cusum_path": cusum_path,
        })

    return results


# ---------------------------------------------------------------------------
# 6. PELT changepoints (simplified mean-shift)
# ---------------------------------------------------------------------------


def pelt_changepoints(
    prices_norm: pl.DataFrame,
    macro_norm: pl.DataFrame,
    min_size: int = 21,
) -> list[dict]:
    """Simplified PELT mean-shift changepoint detection.

    Uses a binary-segmentation approach with BIC penalty to detect
    structural breaks in the mean of returns.
    """
    _prices = prices_norm if prices_norm is not None else pl.DataFrame()
    _macro = macro_norm if macro_norm is not None else pl.DataFrame()
    if _prices.is_empty() and _macro.is_empty():
        return []

    results: list[dict] = []
    for series_id in CHANGEPOINT_SERIES:
        dates, values = _extract_series(_prices, _macro, series_id)
        if len(values) < min_size * 2:
            continue

        # Compute daily returns
        returns: list[float] = []
        return_dates: list[date] = []
        for i in range(1, len(values)):
            if values[i - 1] is None or values[i] is None or values[i - 1] == 0:
                continue
            r = values[i] / values[i - 1] - 1.0
            if math.isfinite(r):
                returns.append(r)
                return_dates.append(dates[i])

        if len(returns) < min_size * 2:
            continue

        arr = np.array(returns, dtype=np.float64)
        n = len(arr)

        # Binary segmentation with BIC penalty
        penalty = np.log(n)
        breakpoints = _binary_segmentation(arr, min_size, penalty)
        breakpoints = sorted(set(breakpoints))

        # Build segments
        changepoint_dates = [return_dates[bp].isoformat() for bp in breakpoints if bp < n]
        bounds = [0] + breakpoints + [n]
        segments: list[dict] = []
        for i in range(len(bounds) - 1):
            start_idx = bounds[i]
            end_idx = bounds[i + 1]
            seg = arr[start_idx:end_idx]
            if len(seg) == 0:
                continue
            segments.append({
                "start": return_dates[start_idx].isoformat(),
                "end": return_dates[min(end_idx - 1, n - 1)].isoformat(),
                "mean_return": _rnd(float(seg.mean()), 6),
                "volatility": _rnd(float(seg.std()), 6),
            })

        display_name = _get_display_name(_prices, series_id)
        if display_name == series_id:
            display_name = _get_display_name(_macro, series_id)

        results.append({
            "series_id": series_id,
            "display_name": display_name,
            "changepoints": changepoint_dates,
            "segments": segments,
        })

    return results


def _binary_segmentation(
    data: np.ndarray,
    min_size: int,
    penalty: float,
    max_breakpoints: int = 10,
) -> list[int]:
    """Recursive binary segmentation for mean-shift detection.

    Returns a list of breakpoint indices in the data array.
    """
    n = len(data)
    if n < 2 * min_size:
        return []

    # Cost of the whole segment (Gaussian log-likelihood)
    total_cost = _segment_cost(data)

    best_cost = total_cost
    best_split = -1

    for t in range(min_size, n - min_size + 1):
        cost = _segment_cost(data[:t]) + _segment_cost(data[t:])
        if cost < best_cost:
            best_cost = cost
            best_split = t

    # Accept split only if improvement exceeds penalty
    if best_split < 0 or (total_cost - best_cost) < penalty:
        return []

    if max_breakpoints <= 1:
        return [best_split]

    # Recurse on both sides
    left_bps = _binary_segmentation(
        data[:best_split], min_size, penalty, max_breakpoints - 1
    )
    right_bps = _binary_segmentation(
        data[best_split:], min_size, penalty, max_breakpoints - 1
    )

    return left_bps + [best_split] + [best_split + bp for bp in right_bps]


def _segment_cost(data: np.ndarray) -> float:
    """Gaussian cost (negative log-likelihood) for a segment."""
    n = len(data)
    if n < 2:
        return 0.0
    var = float(data.var())
    if var < 1e-20:
        return 0.0
    return n * math.log(var + 1e-20)


# ---------------------------------------------------------------------------
# Main view builder
# ---------------------------------------------------------------------------


def eda_dashboard(prices_norm: pl.DataFrame, macro_norm: pl.DataFrame) -> dict:
    """Build all EDA analytics views."""
    return {
        "cross_correlation": cross_correlation(prices_norm, macro_norm),
        "lagged_ols": lagged_ols(prices_norm, macro_norm),
        "granger_causality": granger_causality(prices_norm, macro_norm),
        "pearson_heatmap": pearson_heatmap(prices_norm),
        "cusum": cusum_changepoints(prices_norm, macro_norm),
        "pelt": pelt_changepoints(prices_norm, macro_norm),
    }


# ---------------------------------------------------------------------------
# CLI entry point -- generate snapshot data
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    import json
    import sys
    from pathlib import Path

    project_root = Path(__file__).resolve().parents[3]  # market_terminal/
    bilello_path = project_root / "src" / "data" / "market" / "bilello.json"
    econ_path = project_root / "src" / "data" / "econSnapshot.json"
    out_path = project_root / "src" / "data" / "market" / "eda.json"

    def _build_prices_frame(bilello_path: Path) -> pl.DataFrame:
        """Load bilello.json daily prices into a normalized-like DataFrame."""
        if not bilello_path.exists():
            return pl.DataFrame()
        raw = json.loads(bilello_path.read_text())
        rows = raw.get("asset_daily_prices", [])
        if not rows:
            return pl.DataFrame()
        df = pl.DataFrame(rows)
        # Ensure required columns
        if "price" in df.columns and "value" not in df.columns:
            df = df.rename({"price": "value"})
        if "date" in df.columns:
            df = df.with_columns(pl.col("date").cast(pl.Date))
        for col in ["series_id", "display_name", "asset_class"]:
            if col not in df.columns:
                df = df.with_columns(pl.lit("").alias(col))
        if "source" not in df.columns:
            df = df.with_columns(pl.lit("BILELLO").alias("source"))
        return df

    def _build_macro_frame(econ_path: Path) -> pl.DataFrame:
        """Load econSnapshot.json into a normalized-like DataFrame."""
        if not econ_path.exists():
            return pl.DataFrame()
        raw = json.loads(econ_path.read_text())
        series_data = raw.get("series", {})
        all_rows: list[dict] = []
        for series_id, info in series_data.items():
            observations = info.get("observations", [])
            for obs in observations:
                all_rows.append({
                    "series_id": series_id,
                    "date": obs.get("date"),
                    "value": obs.get("value"),
                    "display_name": series_id,
                    "asset_class": "MACRO",
                    "source": "FRED",
                })
        if not all_rows:
            return pl.DataFrame()
        df = pl.DataFrame(all_rows)
        df = df.with_columns(
            pl.col("date").cast(pl.Date),
            pl.col("value").cast(pl.Float64),
        )
        return df

    print("Loading bilello daily prices...", file=sys.stderr)
    prices = _build_prices_frame(bilello_path)
    print(f"  -> {prices.height} price rows", file=sys.stderr)

    print("Loading econ snapshot...", file=sys.stderr)
    macro = _build_macro_frame(econ_path)
    print(f"  -> {macro.height} macro rows", file=sys.stderr)

    if prices.height == 0 and macro.height == 0:
        print("No data available, generating synthetic output...", file=sys.stderr)
        # Generate minimal valid structure
        result = {
            "cross_correlation": [],
            "lagged_ols": [],
            "granger_causality": [],
            "pearson_heatmap": {"labels": [], "display_names": [], "matrix": []},
            "cusum": [],
            "pelt": [],
        }
    else:
        print("Computing EDA dashboard...", file=sys.stderr)
        result = eda_dashboard(prices, macro)

    # JSON-clean: replace NaN/Inf with None
    def json_clean(obj):
        if isinstance(obj, float):
            return obj if math.isfinite(obj) else None
        if isinstance(obj, dict):
            return {k: json_clean(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [json_clean(v) for v in obj]
        return obj

    result = json_clean(result)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, default=str, indent=2))
    print(f"Wrote {out_path}", file=sys.stderr)
