"""Storage + transform + manifest integration tests (no network)."""

from __future__ import annotations

from datetime import date
import sys
import types

import polars as pl
import pytest

from market_data_pipeline.src.storage.duckdb_store import DuckDBStore
from market_data_pipeline.src.storage.parquet_archive import ParquetArchive
from market_data_pipeline.src.storage.postgres_views import DDL, OBS_DDL, publish_api_views


@pytest.fixture()
def store(tmp_path):
    s = DuckDBStore(tmp_path / "t.duckdb")
    yield s
    s.close()


def _norm_row(series_id, d, v, run="r1"):
    return {
        "series_id": series_id, "source": "SYNTHETIC", "vendor_symbol": series_id,
        "display_name": series_id, "asset_class": "EQUITY", "frequency": "D",
        "date": d, "value": float(v), "unit": "USD", "currency": "USD",
        "adjustment_type": "ADJ_CLOSE", "revision_timestamp": None, "vintage_date": None,
        "ingested_at": None, "ingestion_run_id": run,
    }


def test_schema_creates_all_tables(store):
    # 12 core tables + the analytics_api_views serving table
    assert len(store.table_counts()) == 13
    assert "analytics_api_views" in store.table_counts()


def test_upsert_is_idempotent(store):
    df = pl.DataFrame([_norm_row("SPY", date(2026, 1, 1), 100), _norm_row("SPY", date(2026, 1, 2), 101)])
    assert store.upsert("normalized_time_series", df, ["series_id", "date", "source"]) == 2
    store.upsert("normalized_time_series", df, ["series_id", "date", "source"])
    assert store.query("SELECT count(*) c FROM normalized_time_series")["c"][0] == 2


def test_upsert_updates_value_not_duplicate(store):
    store.upsert("normalized_time_series", pl.DataFrame([_norm_row("SPY", date(2026, 1, 1), 100)]),
                 ["series_id", "date", "source"])
    store.upsert("normalized_time_series", pl.DataFrame([_norm_row("SPY", date(2026, 1, 1), 200)]),
                 ["series_id", "date", "source"])
    out = store.query("SELECT value FROM normalized_time_series")
    assert out.height == 1 and out["value"][0] == 200.0


def test_replace_table(store):
    df = pl.DataFrame([_norm_row("SPY", date(2026, 1, 1), 100)])
    store.replace_table("normalized_time_series", df)
    store.replace_table("normalized_time_series", df)
    assert store.query("SELECT count(*) c FROM normalized_time_series")["c"][0] == 1


def test_normalized_filter_by_asset_class(store):
    store.upsert("normalized_time_series", pl.DataFrame([_norm_row("SPY", date(2026, 1, 1), 100)]),
                 ["series_id", "date", "source"])
    assert store.normalized(asset_classes=["EQUITY"]).height == 1
    assert store.normalized(asset_classes=["BOND"]).height == 0


def test_parquet_archive_roundtrip(tmp_path):
    arch = ParquetArchive(tmp_path)
    df = pl.DataFrame([_norm_row("SPY", date(2026, 1, 1), 100)])
    p = arch.write(df, "silver", "normalized", "SYNTHETIC", "r1")
    assert p is not None and p.exists()
    back = arch.read_dataset("silver", "normalized")
    assert back.height == 1
    assert arch.write(pl.DataFrame(), "silver", "normalized", "X", "r2") is None


def test_publish_api_views_upserts_to_postgres(monkeypatch, store):
    executed = []
    batches = []

    frame = pl.DataFrame(
        [
            {
                "view": "market",
                "payload_json": '{"cards":[]}',
                "as_of": date(2026, 1, 5),
                "ingestion_run_id": "r1",
                "updated_at": None,
            }
        ],
        schema_overrides={"as_of": pl.Date},
    )
    store.upsert("analytics_api_views", frame, ["view"])

    class _Cursor:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return None

        def execute(self, sql):
            executed.append(sql)

        def executemany(self, sql, rows):
            executed.append(sql)
            batches.append(rows)

    class _Connection:
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return None

        def cursor(self):
            return _Cursor()

        def commit(self):
            executed.append("COMMIT")

    fake = types.SimpleNamespace(connect=lambda db_url: _Connection())
    monkeypatch.setitem(sys.modules, "psycopg", fake)

    result = publish_api_views("postgres://example", store)

    assert result == {"published": 1, "views": ["market"], "observations": 0}
    assert DDL in executed
    assert OBS_DDL in executed
    assert batches == [[("market", '{"cards":[]}', date(2026, 1, 5), "r1", None)]]
    assert "COMMIT" in executed
