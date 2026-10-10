"""Parquet historical archive — immutable, versioned, partitioned.

Raw and normalized data are archived to Parquet (never overwritten in place):
each write lands a new run-stamped file under a layer/source partition, so full
history and every vintage is recoverable independent of the DuckDB working set.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import polars as pl


class ParquetArchive:
    def __init__(self, base_dir: str | Path = "./data") -> None:
        self.base = Path(base_dir)

    def _stamp(self) -> str:
        return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    def write(
        self,
        df: pl.DataFrame,
        layer: str,          # raw | bronze | silver | gold
        dataset: str,        # e.g. market_prices, macro_observations, normalized
        source: str,
        run_id: str,
    ) -> Path | None:
        """Archive a frame to ``data/<layer>/<dataset>/source=<source>/``."""
        if df.is_empty():
            return None
        out_dir = self.base / layer / dataset / f"source={source}"
        out_dir.mkdir(parents=True, exist_ok=True)
        path = out_dir / f"{dataset}_{run_id}_{self._stamp()}.parquet"
        df.write_parquet(path, compression="zstd")
        return path

    def read_dataset(self, layer: str, dataset: str) -> pl.DataFrame:
        """Read all archived partitions for a dataset back into one frame."""
        root = self.base / layer / dataset
        files = sorted(root.rglob("*.parquet"))
        if not files:
            return pl.DataFrame()
        return pl.concat([pl.read_parquet(f) for f in files], how="vertical_relaxed")
