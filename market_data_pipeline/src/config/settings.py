"""Runtime configuration (env-driven, 12-factor)."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_PKG_ROOT = Path(__file__).resolve().parents[2]  # .../market_data_pipeline


class Settings(BaseSettings):
    """Pipeline settings.

    Sourced from environment variables (and an optional ``.env``). API keys are
    never hardcoded — FRED needs ``FRED_API_KEY`` for live macro data; without
    it the pipeline falls back to the synthetic source.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- credentials ---
    fred_api_key: str = Field(default="", alias="FRED_API_KEY")

    # --- storage ---
    data_dir: Path = Field(default=_PKG_ROOT / "data")
    duckdb_path: Path = Field(default=_PKG_ROOT / "data" / "market.duckdb")
    catalog_path: Path = Field(default=_PKG_ROOT / "config" / "series_catalog.yaml")

    # --- source behaviour ---
    allow_yahoo: bool = Field(default=True, alias="MDP_ALLOW_YAHOO")
    offline: bool = Field(default=False, alias="MDP_OFFLINE")  # force synthetic

    # --- rate limits (requests / second) ---
    fred_rate_limit: float = Field(default=8.0)
    yahoo_rate_limit: float = Field(default=1.0)  # never hammer Yahoo

    # --- cache TTLs (hours) ---
    macro_cache_ttl_h: float = Field(default=6.0)
    market_cache_ttl_h: float = Field(default=1.0)

    # --- scheduled refresh windows ---
    market_refresh_lookback_days: int = Field(
        default=14,
        alias="MDP_MARKET_REFRESH_LOOKBACK_DAYS",
    )

    # --- quality thresholds ---
    stale_days_daily: int = Field(default=5)
    stale_days_monthly: int = Field(default=45)
    abnormal_move_pct: float = Field(default=0.25)  # 25% single-day price move flag

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def bronze_dir(self) -> Path:
        return self.data_dir / "bronze"

    @property
    def silver_dir(self) -> Path:
        return self.data_dir / "silver"

    @property
    def gold_dir(self) -> Path:
        return self.data_dir / "gold"

    def ensure_dirs(self) -> None:
        for d in (self.raw_dir, self.bronze_dir, self.silver_dir, self.gold_dir):
            d.mkdir(parents=True, exist_ok=True)


_settings: Settings | None = None


def get_settings() -> Settings:
    """Process-wide singleton."""
    global _settings
    if _settings is None:
        _settings = Settings()
        _settings.ensure_dirs()
    return _settings
