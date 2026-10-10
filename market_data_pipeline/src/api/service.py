"""Service layer — bridges the API to storage + analytics.

Reads the normalized layer from DuckDB and computes terminal cards on demand
(cards are cheap; gold tables are also persisted for batch consumers). Keeps the
API thin and every value traceable to the normalized source.
"""

from __future__ import annotations

import math
from functools import lru_cache

import polars as pl

from market_data_pipeline.src import analytics
from market_data_pipeline.src.config.settings import get_settings
from market_data_pipeline.src.storage.duckdb_store import DuckDBStore

PRICE_CLASSES = ["EQUITY", "BOND", "COMMODITY", "CREDIT", "VOLATILITY", "CURRENCY"]
MACRO_CLASSES = [
    "MACRO_RATE", "MACRO_INFLATION", "MACRO_LABOR",
    "MACRO_GROWTH", "MACRO_LIQUIDITY", "MACRO_CREDIT",
]


def _clean(obj):
    """Recursively coerce NaN/Inf → None for safe JSON."""
    if isinstance(obj, float):
        return obj if math.isfinite(obj) else None
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    return obj


class MarketDataService:
    def __init__(self, db_path: str | None = None) -> None:
        self.db_path = db_path or str(get_settings().duckdb_path)

    def _store(self) -> DuckDBStore:
        return DuckDBStore(self.db_path)

    # ------------------------------------------------------------------

    def health(self) -> dict:
        try:
            with self._store() as db:
                counts = db.table_counts()
            return _clean({
                "status": "ok",
                "normalized_rows": counts.get("normalized_time_series", 0),
                "tables": counts,
            })
        except Exception as e:  # pragma: no cover
            return {"status": "degraded", "error": str(e)}

    def series(self, series_id: str, limit: int = 2000) -> dict:
        with self._store() as db:
            df = db.query(
                "SELECT series_id, source, display_name, asset_class, frequency, unit, "
                "currency, date, value FROM normalized_time_series "
                "WHERE series_id = ? ORDER BY date DESC LIMIT ?",
                [series_id, limit],
            )
        if df.is_empty():
            return {"series_id": series_id, "observations": [], "meta": None}
        meta = df.row(0, named=True)
        obs = (
            df.select("date", "value").sort("date")
            .with_columns(pl.col("date").cast(pl.Utf8))
            .to_dicts()
        )
        return _clean({
            "series_id": series_id,
            "display_name": meta["display_name"],
            "asset_class": meta["asset_class"],
            "source": meta["source"],
            "frequency": meta["frequency"],
            "unit": meta["unit"],
            "currency": meta["currency"],
            "observations": obs,
        })

    def market_snapshot(self) -> dict:
        with self._store() as db:
            prices = db.normalized(asset_classes=PRICE_CLASSES)
        return _clean({"cards": analytics.market_snapshot(prices)})

    def cross_asset(self) -> dict:
        with self._store() as db:
            prices = db.normalized(asset_classes=PRICE_CLASSES)
        return _clean(analytics.cross_asset_dashboard(prices))

    def rates(self) -> dict:
        with self._store() as db:
            macro = db.normalized(asset_classes=MACRO_CLASSES)
        return _clean(analytics.rates_dashboard(macro))

    def inflation(self) -> dict:
        with self._store() as db:
            macro = db.normalized(asset_classes=MACRO_CLASSES)
        return _clean({"cards": analytics.inflation_dashboard(macro)})

    def regime(self) -> dict:
        with self._store() as db:
            prices = db.normalized(asset_classes=PRICE_CLASSES)
            macro = db.normalized(asset_classes=MACRO_CLASSES)
        return _clean(analytics.regime_dashboard(prices, macro))

    def bilello(self) -> dict:
        with self._store() as db:
            prices = db.normalized(asset_classes=PRICE_CLASSES)
            macro = db.normalized(asset_classes=MACRO_CLASSES)
        return _clean({
            "best_worst_ytd": analytics.best_worst_ytd(prices),
            "asset_class_returns_by_year": analytics.asset_class_returns_by_year(prices),
            "current_drawdowns": analytics.current_drawdowns(prices),
            "rate_moves_ranked": analytics.rate_moves_ranked(macro),
            "inflation_vs_policy_gap": analytics.inflation_vs_policy_gap(macro),
            "unemployment_vs_longrun": analytics.unemployment_vs_longrun(macro),
        })

    def manifest_latest(self, limit: int = 50) -> dict:
        with self._store() as db:
            df = db.query(
                "SELECT * FROM ingestion_manifest ORDER BY requested_at DESC LIMIT ?", [limit]
            ).with_columns(
                pl.col("requested_at").cast(pl.Utf8),
                pl.col("min_date").cast(pl.Utf8),
                pl.col("max_date").cast(pl.Utf8),
            )
        return _clean({"manifest": df.to_dicts()})
