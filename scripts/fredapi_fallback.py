#!/usr/bin/env python3
"""Small local fallback bridge for FRED when Node/undici fetch is blocked.

The TypeScript FRED client invokes this only when ``FRED_PYTHON_FALLBACK=1`` is
set. It intentionally reads ``FRED_API_KEY`` from the environment instead of a
CLI argument, so the key is not exposed in the process list.
"""

from __future__ import annotations

import argparse
import json
import os
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch one FRED series through fredapi and emit JSON observations.")
    parser.add_argument("series_id")
    parser.add_argument("--start", default=None)
    parser.add_argument("--end", default=None)
    args = parser.parse_args()

    key = os.environ.get("FRED_API_KEY", "").strip()
    if not key:
        print("FRED_API_KEY not set", file=sys.stderr)
        return 2

    try:
        from fredapi import Fred  # type: ignore
    except Exception as exc:  # noqa: BLE001
        print(f"fredapi import failed: {exc}", file=sys.stderr)
        return 3

    try:
        fred = Fred(api_key=key)
        series = fred.get_series(args.series_id, observation_start=args.start, observation_end=args.end)
    except Exception as exc:  # noqa: BLE001
        print(f"fredapi fetch failed for {args.series_id}: {exc}", file=sys.stderr)
        return 4

    out = []
    for idx, value in series.items():
        date = idx.date().isoformat() if hasattr(idx, "date") else str(idx)[:10]
        if value is None:
            clean_value = None
        else:
            try:
                clean_value = float(value)
            except (TypeError, ValueError):
                clean_value = None
        out.append({"date": date, "value": clean_value})

    print(json.dumps({"observations": out}, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
