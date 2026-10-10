"""Series catalog loader — the master list of assets & macro series.

Backs the ``asset_master`` and ``macro_series_master`` tables and tells the
ingestion layer exactly what to pull from each source.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

from market_data_pipeline.src.config.settings import get_settings


@dataclass(frozen=True)
class AssetDef:
    series_id: str
    vendor_symbol: str
    display_name: str
    asset_class: str
    unit: str
    currency: str
    sub_class: str = ""
    source: str = "YAHOO"
    frequency: str = "D"


@dataclass(frozen=True)
class MacroDef:
    series_id: str
    fred_id: str
    display_name: str
    asset_class: str
    category: str
    unit: str
    fred_units: str
    frequency: str
    tenor: str = ""
    source: str = "FRED"


@dataclass(frozen=True)
class Catalog:
    assets: tuple[AssetDef, ...]
    macro: tuple[MacroDef, ...]

    # -- lookups -------------------------------------------------------
    def asset(self, series_id: str) -> AssetDef | None:
        return next((a for a in self.assets if a.series_id == series_id), None)

    def macro_series(self, series_id: str) -> MacroDef | None:
        return next((m for m in self.macro if m.series_id == series_id), None)

    @property
    def asset_symbols(self) -> list[str]:
        return [a.vendor_symbol for a in self.assets]

    @property
    def macro_ids(self) -> list[str]:
        return [m.fred_id for m in self.macro]

    def meta_for(self, series_id: str) -> dict:
        """Display metadata for any series_id (asset or macro)."""
        a = self.asset(series_id)
        if a:
            return {
                "display_name": a.display_name,
                "asset_class": a.asset_class,
                "unit": a.unit,
                "currency": a.currency,
                "source": a.source,
                "frequency": a.frequency,
                "vendor_symbol": a.vendor_symbol,
            }
        m = self.macro_series(series_id)
        if m:
            return {
                "display_name": m.display_name,
                "asset_class": m.asset_class,
                "unit": m.unit,
                "currency": "USD",
                "source": m.source,
                "frequency": m.frequency,
                "vendor_symbol": m.fred_id,
            }
        return {
            "display_name": series_id,
            "asset_class": "UNKNOWN",
            "unit": "",
            "currency": "USD",
            "source": "UNKNOWN",
            "frequency": "D",
            "vendor_symbol": series_id,
        }


def _load(path: Path) -> Catalog:
    raw = yaml.safe_load(path.read_text()) or {}
    assets = tuple(
        AssetDef(
            series_id=a["series_id"],
            vendor_symbol=a.get("vendor_symbol", a["series_id"]),
            display_name=a["display_name"],
            asset_class=a["asset_class"],
            unit=a.get("unit", "USD"),
            currency=a.get("currency", "USD"),
            sub_class=a.get("sub_class", ""),
            source=a.get("source", "YAHOO"),
            frequency=a.get("frequency", "D"),
        )
        for a in raw.get("assets", [])
    )
    macro = tuple(
        MacroDef(
            series_id=m["series_id"],
            fred_id=m.get("fred_id", m["series_id"]),
            display_name=m["display_name"],
            asset_class=m["asset_class"],
            category=m.get("category", ""),
            unit=m.get("unit", ""),
            fred_units=m.get("fred_units", "lin"),
            frequency=m.get("frequency", "M"),
            tenor=m.get("tenor", ""),
            source=m.get("source", "FRED"),
        )
        for m in raw.get("macro", [])
    )
    return Catalog(assets=assets, macro=macro)


@lru_cache(maxsize=1)
def get_catalog() -> Catalog:
    return _load(get_settings().catalog_path)
