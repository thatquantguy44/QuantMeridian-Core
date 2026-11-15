"""Health-only scaffold; numerical routes require a later reviewed model binding."""

from importlib.metadata import version

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from portfolio_regime_models import __version__ as model_version

app = FastAPI(
    title="Portfolio Optimization & Regime Analysis",
    version=version("portfolio-regime-api"),
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "status": "UNCONFIGURED",
            "ready": False,
            "bindingStatus": "UNCONFIGURED",
            "modelVersion": model_version,
            "serviceVersion": app.version,
            "implementedMethods": [],
        },
    )
