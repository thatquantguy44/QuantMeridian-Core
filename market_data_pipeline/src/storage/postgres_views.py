"""Publish terminal view payloads from DuckDB to Postgres.

The Next.js app reads ``analytics_api_views`` directly when ``MARKET_DB_URL`` is
set to a Postgres URL. The pipeline's canonical writer is DuckDB, so this module
copies the compact serving table into Postgres after each refresh.
"""

from __future__ import annotations

from typing import Any

from market_data_pipeline.src.storage.duckdb_store import DuckDBStore


DDL = """
CREATE TABLE IF NOT EXISTS analytics_api_views (
  view TEXT PRIMARY KEY,
  payload_json TEXT,
  as_of DATE,
  ingestion_run_id TEXT,
  updated_at TIMESTAMP
)
"""

OBS_DDL = """
CREATE TABLE IF NOT EXISTS market_series_observations (
  series_id TEXT NOT NULL,
  basis TEXT NOT NULL,
  date DATE NOT NULL,
  value DOUBLE PRECISION,
  display_name TEXT,
  asset_class TEXT,
  source TEXT,
  PRIMARY KEY (series_id, basis, date)
)
"""


UPSERT = """
INSERT INTO analytics_api_views (view, payload_json, as_of, ingestion_run_id, updated_at)
VALUES (%s, %s, %s, %s, %s)
ON CONFLICT (view) DO UPDATE SET
  payload_json = EXCLUDED.payload_json,
  as_of = EXCLUDED.as_of,
  ingestion_run_id = EXCLUDED.ingestion_run_id,
  updated_at = EXCLUDED.updated_at
"""

OBS_UPSERT = """
INSERT INTO market_series_observations
  (series_id, basis, date, value, display_name, asset_class, source)
VALUES (%s, %s, %s, %s, %s, %s, %s)
ON CONFLICT (series_id, basis, date) DO UPDATE SET
  value = EXCLUDED.value,
  display_name = EXCLUDED.display_name,
  asset_class = EXCLUDED.asset_class,
  source = EXCLUDED.source
"""


def _load_psycopg() -> Any:
    try:
        import psycopg  # type: ignore

        return psycopg
    except Exception as exc:  # noqa: BLE001 - provide a clearer optional-dep error
        raise RuntimeError(
            "psycopg is required to publish views to Postgres. "
            "Install with: pip install psycopg[binary]"
        ) from exc


def publish_api_views(db_url: str, source: DuckDBStore, create_table: bool = True) -> dict[str, Any]:
    """Upsert DuckDB serving views and market observations into Postgres."""
    rows = source.query(
        """
        SELECT view, payload_json, as_of, ingestion_run_id, updated_at
        FROM analytics_api_views
        ORDER BY view
        """
    ).to_dicts()
    obs_rows = _market_observation_rows(source)

    if not rows and not obs_rows:
        return {"published": 0, "views": [], "observations": 0}

    psycopg = _load_psycopg()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            if create_table:
                cur.execute(DDL)
                cur.execute(OBS_DDL)
            if rows:
                cur.executemany(
                    UPSERT,
                    [
                        (
                            row["view"],
                            row["payload_json"],
                            row["as_of"],
                            row["ingestion_run_id"],
                            row["updated_at"],
                        )
                        for row in rows
                    ],
                )
            if obs_rows:
                cur.executemany(OBS_UPSERT, obs_rows)
        conn.commit()

    return {"published": len(rows), "views": [row["view"] for row in rows], "observations": len(obs_rows)}


def _market_observation_rows(source: DuckDBStore) -> list[tuple[Any, ...]]:
    total = source.query(
        """
        SELECT series_id, 'total' AS basis, date, value, display_name, asset_class, source
        FROM normalized_time_series
        WHERE asset_class IN ('EQUITY', 'BOND', 'COMMODITY', 'CREDIT', 'VOLATILITY', 'CURRENCY')
          AND adjustment_type = 'ADJ_CLOSE'
          AND value IS NOT NULL
        """
    ).to_dicts()
    price = source.query(
        """
        SELECT
          a.series_id,
          'price' AS basis,
          r.date,
          r.close AS value,
          a.display_name,
          a.asset_class,
          r.source
        FROM raw_market_prices r
        JOIN asset_master a ON a.vendor_symbol = r.vendor_symbol
        WHERE r.close IS NOT NULL
        """
    ).to_dicts()
    rows = []
    for row in [*total, *price]:
        rows.append((
            row["series_id"],
            row["basis"],
            row["date"],
            row["value"],
            row["display_name"],
            row["asset_class"],
            row["source"],
        ))
    return rows
