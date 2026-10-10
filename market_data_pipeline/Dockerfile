# Market Data Pipeline — API + scheduler image
FROM python:3.11-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONPATH=/app

# deps first for layer caching
COPY pyproject.toml ./
RUN pip install --no-cache-dir \
        polars duckdb pyarrow httpx tenacity pydantic pydantic-settings \
        pyyaml fastapi "uvicorn[standard]" apscheduler structlog

COPY . /app/market_data_pipeline/
WORKDIR /app

EXPOSE 8000
# default: serve the API. Override CMD with `... cli.py schedule` for the worker.
CMD ["python", "-m", "market_data_pipeline.cli", "serve", "--host", "0.0.0.0", "--port", "8000"]
