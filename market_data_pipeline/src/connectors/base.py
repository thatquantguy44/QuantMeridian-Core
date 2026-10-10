"""Vendor-agnostic connector primitives for the market-data pipeline.

This module defines the shared building blocks every connector relies on:

* :class:`RateLimiter` - deterministic token-bucket throttle.
* :class:`ResponseCache` - on-disk JSON cache so we never hammer a vendor.
* :class:`AdapterResult` - the raw frame plus ingestion manifest metadata.
* :class:`ThrottledClient` - an ``httpx.Client`` wrapper with rate limiting and
  tenacity-based retry.
* :class:`MacroDataAdapter` / :class:`MarketDataAdapter` - the abstract adapter
  interfaces concrete connectors implement.

The adapter interfaces are intentionally vendor-agnostic so a paid data vendor
(Polygon, Tiingo, Nasdaq Data Link, Bloomberg, FactSet, Refinitiv, ...) can drop
in behind the same contract that the free FRED / Yahoo / synthetic connectors
satisfy today.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Optional

import polars as pl

try:  # tenacity is a declared dependency
    from tenacity import (
        retry,
        retry_if_exception,
        stop_after_attempt,
        wait_exponential,
    )

    _TENACITY = True
except ImportError:  # pragma: no cover - tenacity declared dependency
    _TENACITY = False

try:
    import httpx

    _HTTPX = True
except ImportError:  # pragma: no cover - httpx declared dependency
    httpx = None  # type: ignore[assignment]
    _HTTPX = False


logger = logging.getLogger("market_data_pipeline.connectors")
PROXY_ENV_KEYS = ("FRED_PROXY_URL", "HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy")
PROXY_FALLBACK_STATUSES = {403, 407, 429, 502, 503, 504}


# Repo-relative data root: market_data_pipeline/data
_PACKAGE_ROOT = Path(__file__).resolve().parents[2]
DATA_RAW_DIR = _PACKAGE_ROOT / "data" / "raw"
CACHE_DIR = DATA_RAW_DIR / "_cache"


class RateLimiter:
    """Deterministic token-bucket throttle.

    Allows at most ``rate`` operations per second. :meth:`acquire` blocks via
    ``time.sleep`` when the bucket is empty. No threads or background timers are
    used, so behaviour is deterministic and easy to test.
    """

    def __init__(self, rate: float = 5.0, capacity: Optional[float] = None) -> None:
        if rate <= 0:
            raise ValueError("rate must be > 0")
        self.rate = float(rate)
        self.capacity = float(capacity) if capacity is not None else float(rate)
        self._tokens = self.capacity
        self._last = time.monotonic()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last
        if elapsed > 0:
            self._tokens = min(self.capacity, self._tokens + elapsed * self.rate)
            self._last = now

    def acquire(self, tokens: float = 1.0) -> None:
        """Acquire ``tokens``, sleeping until enough are available."""
        self._refill()
        if self._tokens < tokens:
            deficit = tokens - self._tokens
            sleep_for = deficit / self.rate
            if sleep_for > 0:
                time.sleep(sleep_for)
            self._refill()
        self._tokens -= tokens


class ResponseCache:
    """Simple on-disk JSON cache under ``data/raw/_cache/``.

    Entries are keyed by a stable hash of ``(source, dataset, symbol/series,
    params)``. Each cached file stores the raw payload plus a ``cached_at``
    timestamp so :meth:`get` can honour a TTL and avoid hammering vendors.
    """

    def __init__(self, cache_dir: Path | str = CACHE_DIR) -> None:
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def make_key(source: str, dataset: str, symbol_or_series: str, params: dict[str, Any]) -> str:
        """Return a deterministic cache key for the given request identity."""
        stable = json.dumps(
            {
                "source": source,
                "dataset": dataset,
                "id": symbol_or_series,
                "params": params,
            },
            sort_keys=True,
            default=str,
        )
        return hashlib.sha256(stable.encode("utf-8")).hexdigest()

    def _path(self, key: str) -> Path:
        return self.cache_dir / f"{key}.json"

    def get(self, key: str, ttl_hours: float) -> Optional[dict[str, Any]]:
        """Return the cached payload if present and fresher than ``ttl_hours``."""
        path = self._path(key)
        if not path.exists():
            return None
        try:
            envelope = json.loads(path.read_text("utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        cached_at_raw = envelope.get("cached_at")
        if cached_at_raw is None:
            return None
        try:
            cached_at = datetime.fromisoformat(cached_at_raw)
        except (ValueError, TypeError):
            return None
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)
        age_hours = (datetime.now(timezone.utc) - cached_at).total_seconds() / 3600.0
        if age_hours > ttl_hours:
            return None
        return envelope.get("payload")

    def get_stale(self, key: str) -> Optional[dict[str, Any]]:
        """Return a cached payload regardless of age.

        This is used only after a live provider request fails, so stale real
        data can keep local fallback snapshots useful instead of returning an
        empty frame.
        """
        path = self._path(key)
        if not path.exists():
            return None
        try:
            envelope = json.loads(path.read_text("utf-8"))
        except (json.JSONDecodeError, OSError):
            return None
        payload = envelope.get("payload")
        return payload if isinstance(payload, dict) else None

    def put(self, key: str, payload: dict[str, Any]) -> None:
        """Store ``payload`` under ``key`` with a fresh ``cached_at`` stamp."""
        envelope = {
            "cached_at": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }
        tmp = self._path(key).with_suffix(".json.tmp")
        tmp.write_text(json.dumps(envelope, default=str), "utf-8")
        tmp.replace(self._path(key))


@dataclass
class AdapterResult:
    """Raw connector output plus ingestion manifest metadata.

    ``rows`` is the canonical raw Polars frame (macro or market shape). The
    remaining fields form a manifest record so downstream stages can audit when
    and how the data was fetched.
    """

    rows: pl.DataFrame
    source: str
    dataset: str
    symbol_or_series_id: str
    endpoint: str
    params: dict[str, Any] = field(default_factory=dict)
    requested_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    response_status: str = "ok"
    row_count: int = 0
    min_date: Optional[date] = None
    max_date: Optional[date] = None
    checksum: str = ""
    latency_ms: int = 0

    def __post_init__(self) -> None:
        # Auto-derive frame-dependent fields when not explicitly provided.
        if self.rows is not None:
            if not self.row_count:
                self.row_count = self.rows.height
            if not self.checksum:
                self.checksum = self.checksum_of(self.rows)
            if "date" in self.rows.columns and self.rows.height > 0:
                if self.min_date is None:
                    self.min_date = self.rows["date"].min()
                if self.max_date is None:
                    self.max_date = self.rows["date"].max()

    @staticmethod
    def checksum_of(df: pl.DataFrame) -> str:
        """Return a sha256 over a stable serialization of ``df``.

        Uses a column-ordered, row-stable representation so identical data
        yields an identical checksum and any data change shifts the digest.
        """
        h = hashlib.sha256()
        # Hash schema (names + dtypes) first for structural sensitivity.
        for name, dtype in zip(df.columns, df.dtypes):
            h.update(name.encode("utf-8"))
            h.update(str(dtype).encode("utf-8"))
        # Then hash the data column-by-column in declared column order.
        for name in df.columns:
            for value in df[name].to_list():
                h.update(repr(value).encode("utf-8"))
                h.update(b"\x00")
        return h.hexdigest()

    def manifest(self) -> dict[str, Any]:
        """Return the manifest metadata as a JSON-serializable dict."""
        return {
            "source": self.source,
            "dataset": self.dataset,
            "symbol_or_series_id": self.symbol_or_series_id,
            "endpoint": self.endpoint,
            "params": self.params,
            "requested_at": self.requested_at.isoformat(),
            "response_status": self.response_status,
            "row_count": self.row_count,
            "min_date": self.min_date.isoformat() if self.min_date else None,
            "max_date": self.max_date.isoformat() if self.max_date else None,
            "checksum": self.checksum,
            "latency_ms": self.latency_ms,
        }


def _is_retryable(exc: BaseException) -> bool:
    """Return True for transient errors worth retrying."""
    if not _HTTPX:  # pragma: no cover
        return False
    if isinstance(exc, httpx.TransportError):
        return True
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        return status == 429 or 500 <= status < 600
    return False


def _proxy_env_present() -> bool:
    return any(os.environ.get(key, "").strip() for key in PROXY_ENV_KEYS)


class ThrottledClient:
    """``httpx.Client`` wrapper with rate limiting and tenacity retry.

    Every request first passes through a :class:`RateLimiter`, then is issued
    with exponential-backoff retry on transport errors and 5xx/429 responses.
    """

    def __init__(
        self,
        rate: float = 5.0,
        max_attempts: int = 4,
        timeout: float = 15.0,
        rate_limiter: Optional[RateLimiter] = None,
        client: Any = None,
    ) -> None:
        if not _HTTPX:  # pragma: no cover - httpx declared dependency
            raise RuntimeError("httpx is required for ThrottledClient")
        self.limiter = rate_limiter or RateLimiter(rate=rate)
        self.max_attempts = max_attempts
        self.timeout = timeout
        self._proxy_env_present = _proxy_env_present()
        self._client = client or httpx.Client(
            timeout=timeout,
            headers={"User-Agent": "market-data-pipeline/0.1 (+prototype)"},
        )
        self._direct_client = None if client else httpx.Client(
            timeout=timeout,
            headers={"User-Agent": "market-data-pipeline/0.1 (+prototype)"},
            trust_env=False,
        )

    def _do_get(self, url: str, params: Optional[dict[str, Any]]) -> dict[str, Any]:
        self.limiter.acquire()
        try:
            resp = self._client.get(url, params=params)
            if (
                self._proxy_env_present
                and self._direct_client is not None
                and resp.status_code in PROXY_FALLBACK_STATUSES
            ):
                logger.warning(
                    "HTTP %s via proxy-aware environment for %s; retrying direct",
                    resp.status_code,
                    url,
                )
                resp = self._direct_client.get(url, params=params)
        except httpx.TransportError as exc:
            if not self._proxy_env_present or self._direct_client is None:
                raise
            logger.warning("Transport error via proxy-aware environment for %s; retrying direct: %s", url, exc)
            resp = self._direct_client.get(url, params=params)
        resp.raise_for_status()
        return resp.json()

    def get_json(self, url: str, params: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        """GET ``url`` and return parsed JSON, with throttling + retry."""
        if _TENACITY:
            runner = retry(
                reraise=True,
                stop=stop_after_attempt(self.max_attempts),
                wait=wait_exponential(multiplier=0.2, min=0.2, max=5.0),
                retry=retry_if_exception(_is_retryable),
            )(self._do_get)
            return runner(url, params)
        return self._do_get(url, params)  # pragma: no cover

    def close(self) -> None:
        try:
            self._client.close()
        except Exception:  # pragma: no cover - best effort
            pass


class MacroDataAdapter(ABC):
    """Abstract interface for macroeconomic time-series sources.

    The interface is deliberately vendor-agnostic: today FRED and the synthetic
    generator implement it, but a paid vendor (Polygon, Tiingo, Nasdaq Data
    Link, Bloomberg, FactSet, Refinitiv, ...) can implement the exact same
    method to drop in behind the rest of the pipeline.
    """

    @abstractmethod
    def fetch_series(self, series_id: str, start: Optional[date] = None) -> AdapterResult:
        """Fetch one macro series, returning a raw-macro-shaped AdapterResult."""
        raise NotImplementedError


class MarketDataAdapter(ABC):
    """Abstract interface for OHLCV market-data sources.

    The interface is deliberately vendor-agnostic: today Yahoo and the synthetic
    generator implement it, but a paid vendor (Polygon, Tiingo, Nasdaq Data
    Link, Bloomberg, FactSet, Refinitiv, ...) can implement the exact same
    method to drop in behind the rest of the pipeline.
    """

    @abstractmethod
    def fetch_history(self, symbols: list[str], start: Optional[date] = None) -> AdapterResult:
        """Fetch daily history for ``symbols`` as a raw-market AdapterResult."""
        raise NotImplementedError


# Canonical raw frame schemas (shared contract). Connectors emit these exactly.
MACRO_SCHEMA: dict[str, Any] = {
    "series_id": pl.Utf8,
    "date": pl.Date,
    "value": pl.Float64,
    "realtime_start": pl.Date,
    "realtime_end": pl.Date,
    "source": pl.Utf8,
}

MARKET_SCHEMA: dict[str, Any] = {
    "vendor_symbol": pl.Utf8,
    "date": pl.Date,
    "open": pl.Float64,
    "high": pl.Float64,
    "low": pl.Float64,
    "close": pl.Float64,
    "adj_close": pl.Float64,
    "volume": pl.Int64,
    "source": pl.Utf8,
}


def empty_macro_frame() -> pl.DataFrame:
    """Return an empty frame with the canonical macro schema."""
    return pl.DataFrame(schema=MACRO_SCHEMA)


def empty_market_frame() -> pl.DataFrame:
    """Return an empty frame with the canonical market schema."""
    return pl.DataFrame(schema=MARKET_SCHEMA)
