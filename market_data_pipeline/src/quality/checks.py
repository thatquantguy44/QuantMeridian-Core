"""Data-quality checks over normalized frames.

Produces ``data_quality_results`` rows. Checks (per the spec): missing dates,
duplicate observations, stale series, abnormal price moves, impossible negative
values, unexpected frequency changes, incomplete refreshes, vendor/source
mismatch, and schema drift.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone

import polars as pl

from market_data_pipeline.src.storage.schemas import NORMALIZED_SCHEMA

# asset classes whose value must never be negative
_NON_NEGATIVE = {
    "EQUITY", "BOND", "COMMODITY", "CREDIT", "VOLATILITY", "CURRENCY",
    "MACRO_INFLATION", "MACRO_LIQUIDITY", "MACRO_GROWTH",
}
_PRICE_CLASSES = {"EQUITY", "BOND", "COMMODITY", "CREDIT", "VOLATILITY", "CURRENCY"}
_FREQ_MAX_GAP_DAYS = {"D": 6, "W": 12, "M": 40, "Q": 110, "A": 400}


@dataclass
class QCResult:
    check_name: str
    series_id: str
    passed: bool
    severity: str  # error | warning
    details: str
    rows_affected: int = 0

    def to_row(self, run_id: str) -> dict:
        return {
            "result_id": uuid.uuid4().hex[:16],
            "ingestion_run_id": run_id,
            "series_id": self.series_id,
            "check_name": self.check_name,
            "passed": self.passed,
            "severity": self.severity,
            "details": self.details,
            "rows_affected": self.rows_affected,
            "checked_at": datetime.now(timezone.utc).replace(tzinfo=None),
        }


class QualityChecker:
    def __init__(self, abnormal_move_pct: float = 0.25, stale_days_daily: int = 5,
                 stale_days_monthly: int = 45) -> None:
        self.abnormal_move_pct = abnormal_move_pct
        self.stale_days_daily = stale_days_daily
        self.stale_days_monthly = stale_days_monthly
        self.results: list[QCResult] = []

    def _add(self, r: QCResult) -> QCResult:
        self.results.append(r)
        return r

    # ------------------------------------------------------------------

    def check_schema_drift(self, df: pl.DataFrame) -> QCResult:
        expected = set(NORMALIZED_SCHEMA.keys())
        actual = set(df.columns)
        missing = expected - actual
        passed = not missing
        return self._add(QCResult(
            "schema_drift", "*", passed, "error" if not passed else "info",
            f"missing columns: {sorted(missing)}" if missing else "schema OK",
            len(missing),
        ))

    def check_duplicates(self, df: pl.DataFrame) -> QCResult:
        if df.is_empty():
            return self._add(QCResult("duplicates", "*", True, "info", "no rows", 0))
        keys = ["series_id", "date", "source"]
        dups = df.height - df.unique(subset=keys).height
        return self._add(QCResult(
            "duplicates", "*", dups == 0, "error", f"{dups} duplicate observations", dups,
        ))

    def check_negatives(self, df: pl.DataFrame) -> QCResult:
        if df.is_empty():
            return self._add(QCResult("negative_values", "*", True, "info", "no rows", 0))
        bad = df.filter(pl.col("asset_class").is_in(list(_NON_NEGATIVE)) & (pl.col("value") < 0))
        return self._add(QCResult(
            "negative_values", "*", bad.height == 0, "error",
            f"{bad.height} impossible negative values", bad.height,
        ))

    def per_series(self, df: pl.DataFrame, asof: date | None = None) -> list[QCResult]:
        """Per-series checks: missing dates, stale, abnormal moves, frequency."""
        out: list[QCResult] = []
        if df.is_empty():
            return out
        asof = asof or date.today()
        for sid, sub in df.partition_by("series_id", as_dict=True).items():
            series_id = sid[0] if isinstance(sid, tuple) else sid
            sub = sub.sort("date")
            freq = sub["frequency"][0] if sub.height else "D"
            dates = sub["date"].to_list()
            vals = sub["value"].to_list()

            # stale series
            last = dates[-1]
            stale_limit = self.stale_days_monthly if freq in ("M", "Q", "A") else self.stale_days_daily
            age = (asof - last).days
            out.append(self._add(QCResult(
                "stale_series", series_id, age <= stale_limit,
                "warning", f"last obs {last} ({age}d old, limit {stale_limit}d)", 0,
            )))

            # missing dates / gaps (unexpected frequency change)
            max_gap = _FREQ_MAX_GAP_DAYS.get(freq, 40)
            gaps = sum(
                1 for i in range(1, len(dates)) if (dates[i] - dates[i - 1]).days > max_gap
            )
            out.append(self._add(QCResult(
                "frequency_gaps", series_id, gaps == 0, "warning",
                f"{gaps} gaps exceeding {max_gap}d for freq={freq}", gaps,
            )))

            # abnormal moves (price classes only)
            ac = sub["asset_class"][0] if sub.height else ""
            if ac in _PRICE_CLASSES and len(vals) > 1:
                moves = 0
                for i in range(1, len(vals)):
                    if vals[i - 1]:
                        if abs(vals[i] / vals[i - 1] - 1) > self.abnormal_move_pct:
                            moves += 1
                out.append(self._add(QCResult(
                    "abnormal_move", series_id, moves == 0, "warning",
                    f"{moves} daily moves > {self.abnormal_move_pct:.0%}", moves,
                )))
        return out

    def check_incomplete_refresh(self, df: pl.DataFrame, expected_series: list[str]) -> QCResult:
        present = set(df["series_id"].unique().to_list()) if not df.is_empty() else set()
        missing = [s for s in expected_series if s not in present]
        return self._add(QCResult(
            "incomplete_refresh", "*", not missing, "error",
            f"{len(missing)} expected series absent: {missing[:8]}", len(missing),
        ))

    def check_source_consistency(self, df: pl.DataFrame) -> QCResult:
        """Vendor/source mismatch — a series_id should map to one source."""
        if df.is_empty():
            return self._add(QCResult("source_mismatch", "*", True, "info", "no rows", 0))
        multi = (
            df.group_by("series_id").agg(pl.col("source").n_unique().alias("n"))
            .filter(pl.col("n") > 1)
        )
        return self._add(QCResult(
            "source_mismatch", "*", multi.height == 0, "warning",
            f"{multi.height} series have >1 source", multi.height,
        ))

    # ------------------------------------------------------------------

    def run_all(self, df: pl.DataFrame, expected_series: list[str] | None = None,
                asof: date | None = None) -> list[QCResult]:
        self.check_schema_drift(df)
        self.check_duplicates(df)
        self.check_negatives(df)
        self.check_source_consistency(df)
        if expected_series:
            self.check_incomplete_refresh(df, expected_series)
        self.per_series(df, asof)
        return self.results

    @property
    def passed(self) -> bool:
        return all(r.passed or r.severity != "error" for r in self.results)

    def to_frame(self, run_id: str) -> pl.DataFrame:
        if not self.results:
            return pl.DataFrame()
        return pl.DataFrame([r.to_row(run_id) for r in self.results])

    def summary(self) -> dict:
        errs = sum(1 for r in self.results if not r.passed and r.severity == "error")
        warns = sum(1 for r in self.results if not r.passed and r.severity == "warning")
        return {"checks": len(self.results), "errors": errs, "warnings": warns, "gate": "PASS" if self.passed else "FAIL"}
