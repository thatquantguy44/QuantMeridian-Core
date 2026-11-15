#!/usr/bin/env python3
"""Compare an isolated rehearsal to the upstream benchmark-board calculator.

The input database and pipeline checkout are read only. Results cover only the
staged bounded window and cannot establish full-history board parity.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sqlite3
import subprocess
import sys
from pathlib import Path

sys.dont_write_bytecode = True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("rehearsal_directory", type=Path)
    parser.add_argument("--pipeline-root", required=True, type=Path)
    args = parser.parse_args()
    root = args.pipeline_root.resolve(strict=True)
    directory = args.rehearsal_directory.resolve(strict=True)
    required = ["src/fred_pipeline/writer/terminal_views.py", "src/fred_pipeline/gold_config/rates_complex_config.py", "src/fred_pipeline/writer/features.py", "config/benchmark_rates.yml"]
    hashes = {name: hashlib.sha256((root / name).read_bytes()).hexdigest() for name in required}
    report = json.loads((directory / "report.json").read_text())
    if report.get("schemaVersion") != "benchmark-refresh-rehearsal/1" or report.get("promotable") is not False:
        raise ValueError("Invalid or promotable rehearsal")
    uri = (directory / "rehearsal.sqlite").resolve(strict=True).as_uri() + "?mode=ro"
    with sqlite3.connect(uri, uri=True) as db:
        db.row_factory = sqlite3.Row
        observations = [dict(row) for row in db.execute("SELECT series_id, observation_date, display_value, display_unit, native_unit FROM staged_observation ORDER BY series_id, observation_date")]
        projections = [dict(row) for row in db.execute("SELECT series_id, projected_date, projected_value, display_unit FROM board_projection ORDER BY series_id")]
    if not observations or not projections:
        raise ValueError("No staged observations or board projections")
    sys.path.insert(0, str(root / "src"))
    from fred_pipeline.writer.terminal_views import compute_benchmark_rate_board
    from fred_pipeline.gold_config.rates_complex_config import load_benchmark_board

    native = {}
    for row in observations:
        unit = row["native_unit"].strip().lower()
        factor = 100 if row["display_unit"] == "bps" and unit in {"percent", "percent per annum"} else 1
        native.setdefault(row["series_id"], factor)
        row["value"] = row["display_value"] / factor
        row["is_missing"] = False
    config = load_benchmark_board(str(root / "config/benchmark_rates.yml"))
    board = {row["series_id"]: row for row in compute_benchmark_rate_board(observations, config)}
    configured = {item.series_id for item in config.rates}
    results = []
    for projection in projections:
        series_id = projection["series_id"]
        if series_id not in configured:
            results.append({"series_id": series_id, "status": "not_in_upstream_board"})
            continue
        row = board.get(series_id)
        matches = bool(row and row["latest_date"] == projection["projected_date"] and math.isclose(float(row["latest_value"]) * native[series_id], projection["projected_value"], rel_tol=1e-9, abs_tol=1e-9))
        results.append({"series_id": series_id, "status": "matched" if matches else "mismatch", "latest_date": row["latest_date"] if row else None,
                        "latest_value_native": row["latest_value"] if row else None, "benchmark_series": row["benchmark_series"] if row else None,
                        "spread_to_benchmark_bps": row["spread_to_benchmark_bps"] if row else None})
    try:
        commit = subprocess.check_output(["git", "-C", str(root), "rev-parse", "HEAD"], text=True, stderr=subprocess.DEVNULL).strip()
        changed = subprocess.check_output(["git", "-C", str(root), "status", "--porcelain", "--", *required], text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        commit, changed = None, "unknown"
    ok = any(row["status"] == "matched" for row in results) and all(row["status"] != "mismatch" for row in results)
    print(json.dumps({"ok": ok, "scope": "upstream board calculator on bounded staged rows; not full-history parity", "promotable": False,
                      "pipeline_commit": commit, "inspected_files_modified": bool(changed), "source_sha256": hashes, "series": results}, indent=2))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
