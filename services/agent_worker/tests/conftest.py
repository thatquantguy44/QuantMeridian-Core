from __future__ import annotations

from pathlib import Path

import pytest

from agent_worker import pin

REPO_ROOT = Path(__file__).resolve().parents[3]


def quantsmith_root() -> Path | None:
    """The owner's local QuantSmith checkout, when one is configured and present."""
    configured = pin.read_pin(REPO_ROOT / "contracts/agent/quantsmith-pin.json")
    value = pin.configured_root(configured)
    if value:
        path = Path(value).expanduser()
        if not path.is_absolute():
            path = (REPO_ROOT / path).resolve()
        return path if (path / "src" / "quantsmith").is_dir() else None
    return None


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if quantsmith_root() is not None:
        return
    skip = pytest.mark.skip(
        reason="needs_quantsmith: set QUANTSMITH_ROOT or pin reviewed.source_path to a local copy"
    )
    for item in items:
        if "needs_quantsmith" in item.keywords:
            item.add_marker(skip)
