#!/usr/bin/env python3
"""Repository launcher; the model package is independently installable."""
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "models/trade_flow/src"))
from trade_flow.cli import main

if __name__ == "__main__":
    raise SystemExit(main())
