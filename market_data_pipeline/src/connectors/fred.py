"""FRED (Federal Reserve Economic Data) macro connector.

Reads ``FRED_API_KEY`` from the environment and pulls observations from the
St. Louis Fed ``series/observations`` endpoint into the canonical raw-macro
frame. The connector is rate-limit-safe, retries transient errors, and caches
responses on disk so it never hammers the API.

Network is best-effort: when there is no API key, or the request fails (e.g. in
an offline environment), the connector logs a warning and returns an
:class:`AdapterResult` with an empty frame and an explanatory status string.
"""

from __future__ import annotations

import logging
import os
from datetime import date
from typing import Any, Optional

import polars as pl

from market_data_pipeline.src.connectors.base import (
    MACRO_SCHEMA,
    AdapterResult,
    MacroDataAdapter,
    ResponseCache,
    ThrottledClient,
    empty_macro_frame,
)

logger = logging.getLogger("market_data_pipeline.connectors.fred")

FRED_ENDPOINT = "https://api.stlouisfed.org/fred/series/observations"
FRED_CACHE_TTL_HOURS = 6.0


def fred_enabled() -> bool:
    """Return True when a non-empty ``FRED_API_KEY`` is present in the env."""
    return bool(os.environ.get("FRED_API_KEY", "").strip())


class FredConnector(MacroDataAdapter):
    """Fetch macro series from FRED, degrading gracefully with no network/key."""

    SOURCE = "FRED"
    DATASET = "series_observations"

    def __init__(
        self,
        api_key: Optional[str] = None,
        client: Optional[ThrottledClient] = None,
        cache: Optional[ResponseCache] = None,
        cache_ttl_hours: float = FRED_CACHE_TTL_HOURS,
    ) -> None:
        self.api_key = api_key if api_key is not None else os.environ.get("FRED_API_KEY", "").strip()
        self._client = client
        self.cache = cache or ResponseCache()
        self.cache_ttl_hours = cache_ttl_hours

    @property
    def enabled(self) -> bool:
        return bool(self.api_key)

    def _get_client(self) -> ThrottledClient:
        if self._client is None:
            # ~5 requests/second keeps us well under FRED limits.
            self._client = ThrottledClient(rate=5.0)
        return self._client

    @staticmethod
    def _parse_observations(payload: dict[str, Any], series_id: str) -> pl.DataFrame:
        """Parse a FRED observations payload into the raw-macro frame.

        Pure and network-free: values of ``"."`` (FRED's missing marker) become
        null floats. Returns a frame matching the canonical macro schema.
        """
        observations = payload.get("observations") or []
        dates: list[Optional[date]] = []
        values: list[Optional[float]] = []
        rt_starts: list[Optional[date]] = []
        rt_ends: list[Optional[date]] = []

        for obs in observations:
            raw_val = obs.get("value")
            if raw_val is None or raw_val == "." or raw_val == "":
                value: Optional[float] = None
            else:
                try:
                    value = float(raw_val)
                except (TypeError, ValueError):
                    value = None

            obs_date = _parse_date(obs.get("date"))
            if obs_date is None:
                continue
            dates.append(obs_date)
            values.append(value)
            rt_starts.append(_parse_date(obs.get("realtime_start")))
            rt_ends.append(_parse_date(obs.get("realtime_end")))

        if not dates:
            return empty_macro_frame()

        return pl.DataFrame(
            {
                "series_id": [series_id] * len(dates),
                "date": dates,
                "value": values,
                "realtime_start": rt_starts,
                "realtime_end": rt_ends,
                "source": ["FRED"] * len(dates),
            },
            schema=MACRO_SCHEMA,
        )

    def fetch_series(self, series_id: str, start: Optional[date] = None) -> AdapterResult:
        params: dict[str, Any] = {
            "series_id": series_id,
            "api_key": self.api_key,
            "file_type": "json",
        }
        if start is not None:
            params["observation_start"] = start.isoformat()

        # Cache key excludes the api_key (secret + identity-irrelevant).
        cache_params = {k: v for k, v in params.items() if k != "api_key"}

        def _result(df: pl.DataFrame, status: str) -> AdapterResult:
            return AdapterResult(
                rows=df,
                source=self.SOURCE,
                dataset=self.DATASET,
                symbol_or_series_id=series_id,
                endpoint=FRED_ENDPOINT,
                params=cache_params,
                response_status=status,
            )

        if not self.enabled:
            logger.warning("FRED disabled: no FRED_API_KEY set; returning empty frame for %s", series_id)
            return _result(empty_macro_frame(), "disabled:no_api_key")

        cache_key = ResponseCache.make_key(self.SOURCE, self.DATASET, series_id, cache_params)
        cached = self.cache.get(cache_key, self.cache_ttl_hours)
        if cached is not None:
            df = self._parse_observations(cached, series_id)
            return _result(df, "ok:cache")

        try:
            client = self._get_client()
            payload = client.get_json(FRED_ENDPOINT, params=params)
        except Exception as exc:  # noqa: BLE001 - degrade gracefully on any failure
            logger.warning("FRED fetch failed for %s: %s", series_id, exc)
            stale = self.cache.get_stale(cache_key)
            if stale is not None:
                logger.warning("Using stale FRED cache for %s after provider failure", series_id)
                return _result(self._parse_observations(stale, series_id), "ok:stale_cache")
            return _result(empty_macro_frame(), f"error:{type(exc).__name__}")

        try:
            self.cache.put(cache_key, payload)
        except Exception as exc:  # noqa: BLE001 - cache write must never break ingest
            logger.warning("FRED cache write failed for %s: %s", series_id, exc)

        df = self._parse_observations(payload, series_id)
        return _result(df, "ok")


def _parse_date(raw: Any) -> Optional[date]:
    if raw is None or raw == "" or raw == ".":
        return None
    if isinstance(raw, date):
        return raw
    try:
        return date.fromisoformat(str(raw)[:10])
    except (ValueError, TypeError):
        return None
