"""Tests for the analytics terminal-card layer on synthetic frames."""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta

import polars as pl
import pytest

from market_data_pipeline.src.analytics import (
    market_snapshot,
    cross_asset_dashboard,
    rates_dashboard,
    inflation_dashboard,
    drawdown_table,
    rolling_return_percentile_table,
    regime_dashboard,
    best_worst_ytd,
    asset_class_returns_by_year,
    rate_moves_ranked,
    inflation_vs_policy_gap,
    unemployment_vs_longrun,
)
from market_data_pipeline.src.analytics import _returns as R

CANON_COLS = [
    "series_id", "source", "vendor_symbol", "display_name", "asset_class",
    "frequency", "date", "value", "unit", "currency", "adjustment_type",
    "revision_timestamp", "vintage_date", "ingested_at", "ingestion_run_id",
]


def make_frame(records: list[dict]) -> pl.DataFrame:
    """Build a canonical normalized frame from minimal per-row dicts."""
    rows = []
    for r in records:
        rows.append(
            {
                "series_id": r["series_id"],
                "source": r.get("source", "TEST"),
                "vendor_symbol": r.get("vendor_symbol", r["series_id"]),
                "display_name": r.get("display_name", r["series_id"]),
                "asset_class": r["asset_class"],
                "frequency": r.get("frequency", "D"),
                "date": r["date"],
                "value": float(r["value"]),
                "unit": r.get("unit", "lin"),
                "currency": r.get("currency", "USD"),
                "adjustment_type": r.get("adjustment_type", "adjusted_close"),
                "revision_timestamp": None,
                "vintage_date": None,
                "ingested_at": datetime(2026, 6, 18, 0, 0, 0),
                "ingestion_run_id": "run-test",
            }
        )
    schema = {
        "series_id": pl.Utf8, "source": pl.Utf8, "vendor_symbol": pl.Utf8,
        "display_name": pl.Utf8, "asset_class": pl.Utf8, "frequency": pl.Utf8,
        "date": pl.Date, "value": pl.Float64, "unit": pl.Utf8, "currency": pl.Utf8,
        "adjustment_type": pl.Utf8, "revision_timestamp": pl.Datetime,
        "vintage_date": pl.Date, "ingested_at": pl.Datetime, "ingestion_run_id": pl.Utf8,
    }
    return pl.DataFrame(rows, schema=schema)


def daily_series(series_id, asset_class, start: date, values, **kw):
    recs = []
    for i, v in enumerate(values):
        recs.append(
            {"series_id": series_id, "asset_class": asset_class,
             "date": start + timedelta(days=i), "value": v, **kw}
        )
    return recs


def monthly_series(series_id, asset_class, start: date, values, **kw):
    recs = []
    y, m = start.year, start.month
    for v in values:
        recs.append({"series_id": series_id, "asset_class": asset_class,
                     "date": date(y, m, 1), "value": v, **kw})
        m += 1
        if m > 12:
            m = 1
            y += 1
    return recs


# ---- helper for finiteness checks ----

def assert_no_nan_inf(obj):
    if isinstance(obj, dict):
        for v in obj.values():
            assert_no_nan_inf(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            assert_no_nan_inf(v)
    elif isinstance(obj, float):
        assert math.isfinite(obj), f"non-finite float: {obj}"


# ---------------------------------------------------------------------------


def test_ytd_known_value():
    # prior year end = 100 on Dec 31; latest = 110 -> YTD = 0.10
    recs = [
        {"series_id": "SPY", "asset_class": "EQUITY", "date": date(2025, 12, 31), "value": 100.0},
        {"series_id": "SPY", "asset_class": "EQUITY", "date": date(2026, 1, 2), "value": 105.0},
        {"series_id": "SPY", "asset_class": "EQUITY", "date": date(2026, 6, 1), "value": 110.0},
    ]
    cards = market_snapshot(make_frame(recs))
    assert len(cards) == 1
    assert cards[0]["ytd"] == 0.10
    assert cards[0]["price"] == 110.0


def test_1y_return_known_value():
    dates_vals = []
    start = date(2025, 1, 1)
    # 260 daily points, first=100 last=120; ret_1y uses 252 lookback
    vals = [100.0 + i * 0.05 for i in range(260)]
    recs = daily_series("AAA", "EQUITY", start, vals)
    cards = market_snapshot(make_frame(recs))
    c = cards[0]
    expected = vals[-1] / vals[-1 - R.TD_1Y] - 1.0
    assert c["ret_1y"] == round(expected, 4)


def test_cagr_known_value():
    # value doubles over exactly 3 years -> CAGR = 2^(1/3)-1
    recs = [
        {"series_id": "X", "asset_class": "EQUITY", "date": date(2023, 6, 1), "value": 100.0},
        {"series_id": "X", "asset_class": "EQUITY", "date": date(2026, 6, 1), "value": 200.0},
    ]
    dates, values = R.to_series(make_frame(recs), "X")
    cg = R.cagr(values, dates, 3)
    assert cg == pytest.approx(2 ** (1 / 3) - 1, abs=1e-9)


def test_max_drawdown_up_down_up():
    # 100 -> 120 (peak) -> 60 (trough, -50%) -> 90
    values = [100.0, 120.0, 60.0, 90.0]
    md = R.max_drawdown(values)
    assert md == pytest.approx(60.0 / 120.0 - 1.0)  # -0.5
    assert md == pytest.approx(-0.5)


def test_distance_from_52w_high():
    start = date(2025, 7, 1)
    # rise to 200 then fall to 150 within 52w window
    vals = [100.0, 150.0, 200.0, 180.0, 150.0]
    recs = daily_series("Y", "EQUITY", start, vals)
    dates, values = R.to_series(make_frame(recs), "Y")
    dist = R.distance_from_52w_high(dates, values)
    assert dist == pytest.approx(150.0 / 200.0 - 1.0)  # -0.25


def test_inflation_yoy_from_index_levels():
    # 13 monthly index points: base 100, last 106 -> YoY = 6.0%
    vals = [100.0, 100.5, 101.0, 101.5, 102.0, 102.5,
            103.0, 103.5, 104.0, 104.5, 105.0, 105.5, 106.0]
    recs = monthly_series("CPIAUCSL", "MACRO_INFLATION", date(2025, 5, 1), vals,
                          display_name="CPI", unit="lin")
    cards = inflation_dashboard(make_frame(recs))
    assert len(cards) == 1
    assert cards[0]["yoy"] == 6.0
    assert cards[0]["label"] == "CPI"


def test_inflation_trend_label_rising():
    # YoY now > prior YoY by > 0.05 -> RISING
    # craft index so that last YoY = 6.0 and prior YoY = 5.0
    # build 14 points
    vals = [100.0]
    # months 1..11 grow at small rate
    for _ in range(11):
        vals.append(vals[-1] * 1.001)
    # month 12 (prior latest): make prior yoy ~5%
    vals.append(vals[0] * 1.05)        # index[-2] vs index[-14]? approximations
    vals.append(vals[1] * 1.06)        # index[-1]
    recs = monthly_series("PCEPI", "MACRO_INFLATION", date(2025, 4, 1), vals,
                          display_name="PCE", unit="lin")
    cards = inflation_dashboard(make_frame(recs))
    assert cards[0]["trend"] in {"RISING", "FALLING", "FLAT"}
    # explicit constructed rising case
    assert cards[0]["yoy"] is not None and cards[0]["prior_yoy"] is not None


def test_rates_spreads_bps():
    recs = []
    recs += [{"series_id": "DGS2", "asset_class": "MACRO_RATE", "date": date(2026, 6, 1), "value": 4.0, "unit": "%"}]
    recs += [{"series_id": "DGS10", "asset_class": "MACRO_RATE", "date": date(2026, 6, 1), "value": 4.5, "unit": "%"}]
    recs += [{"series_id": "DGS3MO", "asset_class": "MACRO_RATE", "date": date(2026, 6, 1), "value": 5.0, "unit": "%"}]
    dash = rates_dashboard(make_frame(recs))
    # 2s10s = (4.5 - 4.0)*100 = 50 bps
    assert dash["spreads"]["two_s_ten_s_bps"] == 50.0
    # 3m10y = (4.5 - 5.0)*100 = -50 bps
    assert dash["spreads"]["three_m_ten_y_bps"] == -50.0
    # curve sorted by tenor
    tenors = [c["tenor"] for c in dash["curve"]]
    assert tenors == ["3M", "2Y", "10Y"]


def test_rates_changes_1d_bps():
    recs = [
        {"series_id": "DGS10", "asset_class": "MACRO_RATE", "date": date(2026, 6, 1), "value": 4.0, "unit": "%"},
        {"series_id": "DGS10", "asset_class": "MACRO_RATE", "date": date(2026, 6, 2), "value": 4.10, "unit": "%"},
    ]
    dash = rates_dashboard(make_frame(recs))
    chg = [c for c in dash["changes"] if c["series_id"] == "DGS10"][0]
    assert chg["chg_1d_bps"] == pytest.approx(10.0)


def test_regime_scores_bounded_and_labeled():
    # build SPY rising, VIX low, macro inflation
    spy = daily_series("SPY", "EQUITY", date(2025, 1, 1), [100.0 + i * 0.1 for i in range(100)])
    vix = daily_series("VIX", "VOLATILITY", date(2025, 1, 1), [14.0 for _ in range(100)])
    prices = make_frame(spy + vix)
    cpi = monthly_series("CPIAUCSL", "MACRO_INFLATION", date(2024, 6, 1),
                         [100.0 + i for i in range(24)], unit="lin")
    macro = make_frame(cpi)
    dash = regime_dashboard(prices, macro)
    for key in ["risk_on_off", "inflation_pressure", "growth_momentum", "liquidity", "composite"]:
        assert -100.0 <= dash[key]["score"] <= 100.0
        assert isinstance(dash[key]["label"], str)
    assert isinstance(dash["narrative"], str)
    assert_no_nan_inf(dash)


def test_cross_asset_buckets():
    recs = []
    recs += daily_series("SPY", "EQUITY", date(2026, 1, 1), [100.0, 101.0, 102.0])
    recs += daily_series("TLT", "BOND", date(2026, 1, 1), [90.0, 91.0, 92.0])
    recs += daily_series("GLD", "COMMODITY", date(2026, 1, 1), [180.0, 181.0, 182.0])
    recs += daily_series("HYG", "CREDIT", date(2026, 1, 1), [75.0, 76.0, 77.0])
    recs += daily_series("VIX", "VOLATILITY", date(2026, 1, 1), [15.0, 16.0, 14.0])
    recs += daily_series("DXY", "CURRENCY", date(2026, 1, 1), [103.0, 104.0, 105.0])
    dash = cross_asset_dashboard(make_frame(recs))
    assert dash["equities"][0]["series_id"] == "SPY"
    assert dash["bonds"][0]["series_id"] == "TLT"
    assert dash["commodities"][0]["series_id"] == "GLD"
    assert dash["credit"][0]["series_id"] == "HYG"
    assert dash["volatility"][0]["series_id"] == "VIX"
    assert dash["currencies"][0]["series_id"] == "DXY"
    assert dash["asof"] is not None


def test_empty_inputs_no_crash():
    empty = make_frame([])
    assert market_snapshot(empty) == []
    ca = cross_asset_dashboard(empty)
    assert ca["equities"] == [] and ca["asof"] is None
    rd = rates_dashboard(empty)
    assert rd["curve"] == [] and rd["spreads"]["two_s_ten_s_bps"] is None
    assert inflation_dashboard(empty) == []
    assert drawdown_table(empty) == []
    assert rolling_return_percentile_table(empty) == []
    reg = regime_dashboard(empty, empty)
    assert reg["composite"]["score"] == 0.0
    bw = best_worst_ytd(empty)
    assert bw["best"] == [] and bw["worst"] == []
    assert asset_class_returns_by_year(empty) == []
    assert rate_moves_ranked(empty) == []
    assert inflation_vs_policy_gap(empty)["gap"] is None
    uvl = unemployment_vs_longrun(empty)
    assert uvl["unrate"] is None and uvl["label"] == "UNKNOWN"


def test_no_nan_inf_across_outputs():
    spy = daily_series("SPY", "EQUITY", date(2024, 1, 1), [100.0 + (i % 7) for i in range(400)])
    tlt = daily_series("TLT", "BOND", date(2024, 1, 1), [90.0 + (i % 5) for i in range(400)])
    prices = make_frame(spy + tlt)
    cpi = monthly_series("CPIAUCSL", "MACRO_INFLATION", date(2023, 1, 1),
                         [100.0 + i * 0.4 for i in range(36)], unit="lin")
    dgs = daily_series("DGS10", "MACRO_RATE", date(2024, 1, 1),
                       [4.0 + 0.001 * i for i in range(400)], unit="%")
    macro = make_frame(cpi + dgs)

    assert_no_nan_inf(market_snapshot(prices))
    assert_no_nan_inf(cross_asset_dashboard(prices))
    assert_no_nan_inf(rates_dashboard(macro))
    assert_no_nan_inf(inflation_dashboard(macro))
    assert_no_nan_inf(drawdown_table(prices))
    assert_no_nan_inf(rolling_return_percentile_table(prices))
    assert_no_nan_inf(regime_dashboard(prices, macro))
    assert_no_nan_inf(best_worst_ytd(prices))
    assert_no_nan_inf(asset_class_returns_by_year(prices))
    assert_no_nan_inf(rate_moves_ranked(macro))


def test_drawdown_table_sorted_deepest_first():
    a = daily_series("AAA", "EQUITY", date(2026, 1, 1), [100.0, 120.0, 60.0])   # dd -0.5 from peak
    b = daily_series("BBB", "EQUITY", date(2026, 1, 1), [100.0, 105.0, 104.0])  # small dd
    tbl = drawdown_table(make_frame(a + b))
    assert tbl[0]["series_id"] == "AAA"
    assert tbl[0]["drawdown"] <= tbl[1]["drawdown"]


def test_rolling_percentile_table_fields():
    vals = [100.0 + math.sin(i / 5.0) * 5 + i * 0.1 for i in range(300)]
    recs = daily_series("ZZZ", "EQUITY", date(2024, 1, 1), vals)
    tbl = rolling_return_percentile_table(make_frame(recs), window_days=63)
    assert len(tbl) == 1
    row = tbl[0]
    for k in ["current_window_return", "pctile_rank", "min", "p25", "median", "p75", "max"]:
        assert k in row
    assert 0.0 <= row["pctile_rank"] <= 1.0
    assert row["min"] <= row["median"] <= row["max"]


def test_asset_class_returns_by_year():
    # one equity series spanning two year-ends: 2024 end=100, 2025 end=110 -> +10% in 2025
    recs = [
        {"series_id": "SPY", "asset_class": "EQUITY", "date": date(2024, 12, 31), "value": 100.0},
        {"series_id": "SPY", "asset_class": "EQUITY", "date": date(2025, 12, 31), "value": 110.0},
    ]
    rows = asset_class_returns_by_year(make_frame(recs))
    row = [r for r in rows if r["year"] == 2025][0]
    assert row["asset_class"] == "EQUITY"
    assert row["total_return"] == 0.10


def test_inflation_vs_policy_and_unrate():
    cpi = monthly_series("CPIAUCSL", "MACRO_INFLATION", date(2025, 5, 1),
                         [100.0 + i for i in range(13)], unit="lin")  # yoy = 12/100 = 12%
    dff = daily_series("DFF", "MACRO_RATE", date(2026, 1, 1), [5.0, 5.0], unit="%")
    unrate = monthly_series("UNRATE", "MACRO_LABOR", date(2026, 1, 1), [3.5, 3.6], unit="%")
    macro = make_frame(cpi + dff + unrate)
    gap = inflation_vs_policy_gap(macro)
    assert gap["cpi_yoy"] == 12.0
    assert gap["policy_rate"] == 5.0
    assert gap["gap"] == round(5.0 - 12.0, 4)
    uvl = unemployment_vs_longrun(macro, longrun=4.0)
    assert uvl["unrate"] == 3.6
    assert uvl["label"] == "BELOW"  # tight labor market
