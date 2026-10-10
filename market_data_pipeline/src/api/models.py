"""Pydantic API contracts — JSON shapes optimized for the Java front end.

Response models double as documentation; endpoints return plain dicts (already
JSON-clean from the service), so the Java UI gets stable, predictable payloads.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    normalized_rows: int = 0
    tables: dict[str, int] = Field(default_factory=dict)


class Observation(BaseModel):
    date: str
    value: float | None


class SeriesResponse(BaseModel):
    series_id: str
    display_name: str | None = None
    asset_class: str | None = None
    source: str | None = None
    frequency: str | None = None
    unit: str | None = None
    currency: str | None = None
    observations: list[Observation] = Field(default_factory=list)


class SnapshotCard(BaseModel):
    series_id: str
    display_name: str
    asset_class: str
    source: str | None = None
    price: float | None = None
    asof: str | None = None
    ret_1d: float | None = None
    ret_5d: float | None = None
    mtd: float | None = None
    ytd: float | None = None
    ret_1y: float | None = None
    cagr_3y: float | None = None
    cagr_5y: float | None = None
    max_drawdown: float | None = None
    pct_from_52w_high: float | None = None


class MarketSnapshotResponse(BaseModel):
    cards: list[SnapshotCard] = Field(default_factory=list)


class CurvePoint(BaseModel):
    series_id: str
    tenor: str
    label: str
    yield_: float | None = Field(default=None, alias="yield")


class RatesResponse(BaseModel):
    asof: str | None = None
    curve: list[dict] = Field(default_factory=list)
    spreads: dict = Field(default_factory=dict)
    changes: list[dict] = Field(default_factory=list)


class InflationCard(BaseModel):
    series_id: str
    label: str
    yoy: float | None = None
    prior_yoy: float | None = None
    mom: float | None = None
    trend: str | None = None
    asof: str | None = None


class InflationResponse(BaseModel):
    cards: list[InflationCard] = Field(default_factory=list)


class RegimeScore(BaseModel):
    score: float
    label: str


class RegimeResponse(BaseModel):
    asof: str | None = None
    risk_on_off: RegimeScore | None = None
    inflation_pressure: RegimeScore | None = None
    growth_momentum: RegimeScore | None = None
    liquidity: RegimeScore | None = None
    composite: RegimeScore | None = None
    narrative: str | None = None


class RunRequest(BaseModel):
    start: str | None = Field(default=None, description="ISO start date for extraction")
    offline: bool | None = Field(default=None, description="Force synthetic source")


class BackfillRequest(BaseModel):
    start: str = Field(description="ISO start date")
    end: str | None = Field(default=None, description="ISO end date (optional)")


class RunResponse(BaseModel):
    run_id: str
    normalized_rows: int = 0
    macro_rows: int = 0
    market_rows: int = 0
    quality: dict = Field(default_factory=dict)
