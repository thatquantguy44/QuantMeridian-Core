"""FastAPI app — serves market/macro snapshots to the Java terminal front end.

Endpoints return JSON-clean dicts (NaN/Inf already coerced to null) optimized for
fast UI rendering. Ingestion endpoints let the UI/ops trigger refreshes and
backfills; every served value is traceable via /manifest/latest.
"""

from __future__ import annotations

from datetime import date

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from market_data_pipeline.src.api.models import (
    BackfillRequest,
    RunRequest,
)
from market_data_pipeline.src.api.service import MarketDataService

app = FastAPI(
    title="Market Data Pipeline API",
    version="0.1.0",
    description="FRED + Yahoo (pluggable vendors) market & macro snapshots for a Bloomberg-style terminal.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

service = MarketDataService()


@app.get("/health", tags=["ops"])
def health() -> dict:
    return service.health()


@app.get("/series/{series_id}", tags=["data"])
def get_series(series_id: str, limit: int = Query(2000, ge=1, le=20000)) -> dict:
    res = service.series(series_id, limit)
    if not res.get("observations"):
        raise HTTPException(status_code=404, detail=f"No data for series '{series_id}'")
    return res


@app.get("/snapshot/market", tags=["snapshot"])
def snapshot_market() -> dict:
    return service.market_snapshot()


@app.get("/snapshot/rates", tags=["snapshot"])
def snapshot_rates() -> dict:
    return service.rates()


@app.get("/snapshot/inflation", tags=["snapshot"])
def snapshot_inflation() -> dict:
    return service.inflation()


@app.get("/snapshot/cross-asset", tags=["snapshot"])
def snapshot_cross_asset() -> dict:
    return service.cross_asset()


@app.get("/dashboard/regime", tags=["dashboard"])
def dashboard_regime() -> dict:
    return service.regime()


@app.get("/dashboard/bilello", tags=["dashboard"])
def dashboard_bilello() -> dict:
    return service.bilello()


@app.get("/manifest/latest", tags=["ops"])
def manifest_latest(limit: int = Query(50, ge=1, le=500)) -> dict:
    return service.manifest_latest(limit)


@app.post("/ingestion/run", tags=["ingestion"])
def ingestion_run(req: RunRequest | None = None) -> dict:
    # Imported lazily so the API process can start without ingestion deps loaded.
    from market_data_pipeline.src.config.settings import get_settings
    from market_data_pipeline.src.ingestion.pipeline import Pipeline

    if req and req.offline is not None:
        get_settings().offline = req.offline
    start = date.fromisoformat(req.start) if (req and req.start) else None
    return Pipeline().run(start=start)


@app.post("/ingestion/backfill", tags=["ingestion"])
def ingestion_backfill(req: BackfillRequest) -> dict:
    from market_data_pipeline.src.ingestion.pipeline import Pipeline

    start = date.fromisoformat(req.start)
    return Pipeline().run(start=start, run_id=f"backfill_{req.start}")
