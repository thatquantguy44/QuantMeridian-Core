"""Ingestion manifest — full lineage for every extraction.

Each connector call yields an :class:`AdapterResult`; the manifest persists its
metadata to ``ingestion_manifest`` so every value served by the API can be
traced back to source, dataset, series, date range, checksum and run id. Version
increments per (source, series) so history is never silently overwritten.
"""

from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timezone

import polars as pl

from market_data_pipeline.src.storage.duckdb_store import DuckDBStore


class ManifestWriter:
    def __init__(self, store: DuckDBStore) -> None:
        self.store = store

    def _next_version(self, source: str, symbol: str) -> int:
        row = self.store.conn.execute(
            "SELECT COALESCE(MAX(version), 0) FROM ingestion_manifest "
            "WHERE source = ? AND symbol_or_series_id = ?",
            [source, symbol],
        ).fetchone()
        return int(row[0]) + 1

    def record(
        self,
        run_id: str,
        *,
        source: str,
        dataset: str,
        symbol_or_series_id: str,
        endpoint: str,
        parameters: dict,
        requested_at: datetime,
        response_status: str,
        row_count: int,
        min_date,
        max_date,
        checksum: str,
        data_quality_status: str = "pending",
        error_message: str = "",
        latency_ms: int = 0,
    ) -> str:
        manifest_id = uuid.uuid4().hex[:16]
        version = self._next_version(source, symbol_or_series_id)
        # requested_at may arrive as a datetime or an ISO string
        if isinstance(requested_at, str):
            try:
                requested_at = datetime.fromisoformat(requested_at)
            except ValueError:
                requested_at = datetime.now(timezone.utc)
        req_at = requested_at.replace(tzinfo=None) if requested_at.tzinfo else requested_at

        def _as_date(v):
            if v is None or isinstance(v, date):
                return v
            try:
                return date.fromisoformat(str(v)[:10])
            except ValueError:
                return None

        min_date = _as_date(min_date)
        max_date = _as_date(max_date)
        df = pl.DataFrame(
            [
                {
                    "manifest_id": manifest_id,
                    "ingestion_run_id": run_id,
                    "source": source,
                    "dataset": dataset,
                    "symbol_or_series_id": symbol_or_series_id,
                    "request_url_or_endpoint": endpoint,
                    "parameters": json.dumps(parameters, default=str),
                    "requested_at": req_at,
                    "response_status": response_status,
                    "row_count": int(row_count),
                    "min_date": min_date,
                    "max_date": max_date,
                    "checksum": checksum,
                    "version": version,
                    "data_quality_status": data_quality_status,
                    "error_message": error_message,
                    "latency_ms": int(latency_ms),
                }
            ],
            schema_overrides={"min_date": pl.Date, "max_date": pl.Date},
        )
        self.store.append("ingestion_manifest", df)
        return manifest_id

    def record_result(self, run_id: str, result) -> str:
        """Persist a single AdapterResult's manifest metadata."""
        m = result.manifest() if hasattr(result, "manifest") else {}
        return self.record(
            run_id,
            source=m.get("source", getattr(result, "source", "")),
            dataset=m.get("dataset", getattr(result, "dataset", "")),
            symbol_or_series_id=m.get("symbol_or_series_id", getattr(result, "symbol_or_series_id", "")),
            endpoint=m.get("endpoint", getattr(result, "endpoint", "")),
            parameters=m.get("params", getattr(result, "params", {})),
            requested_at=m.get("requested_at", getattr(result, "requested_at", datetime.now(timezone.utc))),
            response_status=m.get("response_status", getattr(result, "response_status", "")),
            row_count=m.get("row_count", getattr(result, "row_count", 0)),
            min_date=m.get("min_date", getattr(result, "min_date", None)),
            max_date=m.get("max_date", getattr(result, "max_date", None)),
            checksum=m.get("checksum", getattr(result, "checksum", "")),
            latency_ms=m.get("latency_ms", getattr(result, "latency_ms", 0)),
        )

    def latest(self, limit: int = 50) -> pl.DataFrame:
        return self.store.query(
            "SELECT * FROM ingestion_manifest ORDER BY requested_at DESC LIMIT ?", [limit]
        )
