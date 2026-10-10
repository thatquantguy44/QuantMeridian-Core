"""API — FastAPI app + service layer + Pydantic models."""

from market_data_pipeline.src.api.app import app
from market_data_pipeline.src.api.service import MarketDataService

__all__ = ["app", "MarketDataService"]
