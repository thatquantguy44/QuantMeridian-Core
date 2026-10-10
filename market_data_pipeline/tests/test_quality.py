"""Data-quality check tests."""

from __future__ import annotations

from datetime import date, datetime

import polars as pl

from market_data_pipeline.src.quality.checks import QualityChecker


def _row(series_id, d, v, ac="EQUITY", freq="D", source="SYNTHETIC"):
    return {
        "series_id": series_id, "source": source, "vendor_symbol": series_id,
        "display_name": series_id, "asset_class": ac, "frequency": freq,
        "date": d, "value": float(v), "unit": "USD", "currency": "USD",
        "adjustment_type": "ADJ_CLOSE", "revision_timestamp": None, "vintage_date": None,
        "ingested_at": datetime(2026, 6, 18), "ingestion_run_id": "r1",
    }


def test_duplicates_detected():
    df = pl.DataFrame([_row("SPY", date(2026, 1, 1), 1), _row("SPY", date(2026, 1, 1), 1)])
    qc = QualityChecker()
    r = qc.check_duplicates(df)
    assert not r.passed and r.rows_affected == 1


def test_negative_values_flagged():
    df = pl.DataFrame([_row("SPY", date(2026, 1, 1), -5)])
    qc = QualityChecker()
    assert not qc.check_negatives(df).passed


def test_schema_drift():
    df = pl.DataFrame({"series_id": ["SPY"], "value": [1.0]})
    qc = QualityChecker()
    assert not qc.check_schema_drift(df).passed


def test_abnormal_move_flagged():
    rows = [_row("SPY", date(2026, 1, 1), 100), _row("SPY", date(2026, 1, 2), 200)]  # +100%
    qc = QualityChecker(abnormal_move_pct=0.25)
    qc.per_series(pl.DataFrame(rows), asof=date(2026, 1, 3))
    moves = [r for r in qc.results if r.check_name == "abnormal_move"]
    assert moves and not moves[0].passed


def test_stale_series_flagged():
    df = pl.DataFrame([_row("SPY", date(2020, 1, 1), 100)])
    qc = QualityChecker(stale_days_daily=5)
    qc.per_series(df, asof=date(2026, 6, 18))
    stale = [r for r in qc.results if r.check_name == "stale_series"]
    assert stale and not stale[0].passed


def test_incomplete_refresh():
    df = pl.DataFrame([_row("SPY", date(2026, 1, 1), 100)])
    qc = QualityChecker()
    r = qc.check_incomplete_refresh(df, ["SPY", "QQQ", "TLT"])
    assert not r.passed and r.rows_affected == 2


def test_clean_frame_passes_gate():
    rows = [_row("SPY", date(2026, 6, 17), 100), _row("SPY", date(2026, 6, 18), 101)]
    qc = QualityChecker()
    qc.run_all(pl.DataFrame(rows), expected_series=["SPY"], asof=date(2026, 6, 18))
    assert qc.passed
    assert qc.summary()["errors"] == 0
