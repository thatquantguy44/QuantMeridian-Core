"""DuckDB storage — queryable layer for raw, normalized and analytics tables.

Idempotent, revision-aware upserts (delete-then-insert on the table's natural
key) so reruns never duplicate rows. The same Parquet-friendly tables can be
mirrored to Postgres via the optional SQLAlchemy loader.
"""

from __future__ import annotations

from pathlib import Path

import duckdb
import polars as pl

from market_data_pipeline.src.storage.schemas import DDL


class DuckDBStore:
    def __init__(self, db_path: str | Path = "./data/market.duckdb") -> None:
        self.db_path = str(db_path)
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = duckdb.connect(self.db_path)
        self.init_schema()

    def init_schema(self) -> None:
        for ddl in DDL.values():
            self.conn.execute(ddl)
        self._migrate_schema()

    def _migrate_schema(self) -> None:
        """Apply lightweight additive migrations for existing local DuckDB files."""
        self.conn.execute(
            "ALTER TABLE ingestion_manifest ADD COLUMN IF NOT EXISTS latency_ms BIGINT"
        )

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------

    def upsert(self, table: str, df: pl.DataFrame, key_columns: list[str]) -> int:
        """Delete-then-insert upsert keyed on ``key_columns`` (idempotent)."""
        if df.is_empty():
            return 0
        cols = self.conn.execute(
            f"SELECT column_name FROM information_schema.columns WHERE table_name = ?",
            [table],
        ).fetchall()
        table_cols = [c[0] for c in cols]
        # keep only columns the table actually has, in table order
        keep = [c for c in table_cols if c in df.columns]
        df = df.select(keep)

        self.conn.register("_staging", df.to_arrow())
        keys = df.select(key_columns).unique()
        self.conn.register("_keys", keys.to_arrow())
        # remove rows whose keys arrive in this batch, then insert the batch
        join_pred = " AND ".join(f"t.{k} = s.{k}" for k in key_columns)
        self.conn.execute(
            f"DELETE FROM {table} t WHERE EXISTS "
            f"(SELECT 1 FROM _keys s WHERE {join_pred})"
        )
        collist = ", ".join(keep)
        self.conn.execute(f"INSERT INTO {table} ({collist}) SELECT {collist} FROM _staging")
        self.conn.unregister("_staging")
        self.conn.unregister("_keys")
        return df.height

    def replace_table(self, table: str, df: pl.DataFrame) -> int:
        """Overwrite an analytics/gold table entirely (rebuild semantics)."""
        self.conn.execute(f"DELETE FROM {table}")
        if df.is_empty():
            return 0
        table_cols = [
            c[0]
            for c in self.conn.execute(
                "SELECT column_name FROM information_schema.columns WHERE table_name = ?",
                [table],
            ).fetchall()
        ]
        keep = [c for c in table_cols if c in df.columns]
        self.conn.register("_staging", df.select(keep).to_arrow())
        collist = ", ".join(keep)
        self.conn.execute(f"INSERT INTO {table} ({collist}) SELECT {collist} FROM _staging")
        self.conn.unregister("_staging")
        return df.height

    def append(self, table: str, df: pl.DataFrame) -> int:
        if df.is_empty():
            return 0
        self.conn.register("_staging", df.to_arrow())
        self.conn.execute(f"INSERT INTO {table} BY NAME SELECT * FROM _staging")
        self.conn.unregister("_staging")
        return df.height

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    def query(self, sql: str, params: list | None = None) -> pl.DataFrame:
        return self.conn.execute(sql, params or []).pl()

    def normalized(
        self, series_ids: list[str] | None = None, asset_classes: list[str] | None = None
    ) -> pl.DataFrame:
        sql = "SELECT * FROM normalized_time_series"
        where, params = [], []
        if series_ids:
            ph = ", ".join("?" for _ in series_ids)
            where.append(f"series_id IN ({ph})")
            params += series_ids
        if asset_classes:
            ph = ", ".join("?" for _ in asset_classes)
            where.append(f"asset_class IN ({ph})")
            params += asset_classes
        if where:
            sql += " WHERE " + " AND ".join(where)
        return self.conn.execute(sql, params).pl()

    def table_counts(self) -> dict[str, int]:
        out: dict[str, int] = {}
        for (t,) in self.conn.execute("SHOW TABLES").fetchall():
            out[t] = int(self.conn.execute(f'SELECT count(*) FROM "{t}"').fetchone()[0])
        return out

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> DuckDBStore:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()
