#!/usr/bin/env python3
"""Recompute the VIXR study from user-supplied daily VIX and SPY price CSVs.

The two CSVs must have headers `date,vix` and `date,close`, respectively.
Dates are ISO 8601 trading dates and values are positive finite numbers.
The calculation shares the independent NumPy/SciPy reference methods used
for the repository's committed crisis and calm-market golden fixtures.
"""

import argparse
import csv
import hashlib
import json
import math
from datetime import date
from pathlib import Path

from vixr_reference import NW_DAILY, NW_MONTHLY, monthly, summarize, tidy, walk_forward, windows


def read_series(path: Path, value_column: str, cutoff: str) -> list[tuple[str, float]]:
    records: list[tuple[str, float]] = []
    previous_day: str | None = None
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None or not {"date", value_column}.issubset(reader.fieldnames):
            raise ValueError(f"{path}: expected columns date,{value_column}")
        for line_number, row in enumerate(reader, start=2):
            try:
                day = date.fromisoformat(row["date"])
                value = float(row[value_column])
            except (TypeError, ValueError) as exc:
                raise ValueError(f"{path}:{line_number}: invalid date or {value_column}") from exc
            if not math.isfinite(value) or value <= 0:
                raise ValueError(f"{path}:{line_number}: {value_column} must be positive and finite")
            day_text = day.isoformat()
            if previous_day is not None and day_text <= previous_day:
                raise ValueError(f"{path}:{line_number}: dates must be unique and ascending")
            previous_day = day_text
            if day_text <= cutoff:
                records.append((day_text, value))
    if not records:
        raise ValueError(f"{path}: no observations through {cutoff}")
    return records


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def report(vix_path: Path, spy_path: Path, cutoff: str) -> dict:
    date.fromisoformat(cutoff)
    vix = read_series(vix_path, "vix", cutoff)
    spy = read_series(spy_path, "close", cutoff)
    observations = windows(vix, spy)
    if len(observations) < 10:
        raise ValueError("Fewer than 10 complete 30-day VIX/SPY windows; check coverage and alignment")
    non_overlapping = monthly(observations)
    if len(non_overlapping) < 10:
        raise ValueError("Fewer than 10 non-overlapping windows; provide more history")

    daily = summarize(observations, "daily")
    non = summarize(non_overlapping, "monthly")
    daily["walkForward"] = walk_forward(observations, 504, NW_DAILY)
    non["walkForward"] = walk_forward(non_overlapping, 60, NW_MONTHLY)
    return tidy({
        "inputs": {
            "vix_sha256": sha256(vix_path),
            "spy_sha256": sha256(spy_path),
            "cutoff": cutoff,
            "vix_rows": len(vix),
            "spy_rows": len(spy),
            "vix_first": vix[0][0],
            "vix_last": vix[-1][0],
            "spy_first": spy[0][0],
            "spy_last": spy[-1][0],
            "price_basis": "SPY close, excluding dividends",
            "horizon_calendar_days": 30,
        },
        "daily": daily,
        "non_overlapping": non,
    })


def markdown(result: dict) -> str:
    def fmt(value, digits=1):
        return "n/a" if value is None else f"{value:.{digits}f}"

    columns = [result["non_overlapping"], result["daily"]]
    rows = [
        ("Windows", lambda r: str(r["n"])),
        ("Inside ±1σ", lambda r: fmt(r["within1"]["pct"]) + "%"),
        ("Inside ±2σ", lambda r: fmt(r["within2"]["pct"]) + "%"),
        ("Realized ÷ implied vol", lambda r: fmt(r["volRatio"], 2)),
        ("Mean VIX premium", lambda r: fmt(r["meanPremiumPts"]) + " vol points"),
        ("VIX above realized vol", lambda r: fmt(r["pctVixAboveRealized"], 0) + "%"),
        ("Realized-volatility R²", lambda r: fmt(100 * r["realizedOnVix"]["r2"], 0) + "%"),
        ("Trailing-volatility R²", lambda r: fmt(100 * r["benchmark"]["trailingR2"], 0) + "%"),
        ("Directional return R²", lambda r: fmt(100 * r["returnOnVix"]["r2"], 1) + "%"),
        ("Walk-forward test windows", lambda r: str(r["walkForward"]["n"]) if r["walkForward"] else "n/a"),
        ("Raw VIX OOS skill", lambda r: fmt(100 * r["walkForward"]["vol"]["vix_raw"]["oosR2"], 0) + "%" if r["walkForward"] else "n/a"),
        ("Calibrated VIX OOS skill", lambda r: fmt(100 * r["walkForward"]["vol"]["vix_calibrated"]["oosR2"], 0) + "%" if r["walkForward"] else "n/a"),
        ("Trailing-volatility OOS skill", lambda r: fmt(100 * r["walkForward"]["vol"]["trailing"]["oosR2"], 0) + "%" if r["walkForward"] else "n/a"),
        ("Calibrated VIX RMSE", lambda r: fmt(r["walkForward"]["vol"]["vix_calibrated"]["rmse"], 2) + " vol points" if r["walkForward"] else "n/a"),
        ("Trailing-volatility RMSE", lambda r: fmt(r["walkForward"]["vol"]["trailing"]["rmse"], 2) + " vol points" if r["walkForward"] else "n/a"),
        ("DM t: calibrated vs trailing", lambda r: fmt(r["walkForward"]["vol"]["vix_calibrated"]["dmVsTrailing"]) if r["walkForward"] else "n/a"),
        ("Return-model OOS skill", lambda r: fmt(100 * r["walkForward"]["returns"]["ret_vix"]["oosR2"], 1) + "%" if r["walkForward"] else "n/a"),
    ]
    table = ["| Measure | Non-overlapping | Daily |", "|---|---:|---:|"]
    table.extend(f"| {label} | {render(columns[0])} | {render(columns[1])} |" for label, render in rows)
    return "\n".join(table)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--vix", required=True, type=Path, help="CSV with date,vix columns")
    parser.add_argument("--spy", required=True, type=Path, help="CSV with date,close columns (SPY price, no dividends)")
    parser.add_argument("--cutoff", default="2026-10-06", help="Last input date to include (YYYY-MM-DD)")
    parser.add_argument("--out", type=Path, help="Optional path for full JSON statistics and input hashes")
    args = parser.parse_args()
    result = report(args.vix, args.spy, args.cutoff)
    print(markdown(result))
    if args.out:
        args.out.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n", encoding="utf-8")
        print(f"\nWrote {args.out}")


if __name__ == "__main__":
    main()
