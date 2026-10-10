"""Scheduling — APScheduler jobs with source-specific cadences.

Cadences (all idempotent — reruns upsert, never duplicate):
- market close refresh   : weekdays after the US close (cached Yahoo pulls)
- intraday market refresh : controlled, cached, low frequency (never hammer Yahoo)
- macro refresh           : daily check for new FRED observations
- analytics rebuild       : after each data refresh

Backfills are intentionally NOT scheduled — run them manually / low-frequency
via the CLI or POST /ingestion/backfill.
"""

from __future__ import annotations

from datetime import date, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from market_data_pipeline.src.config.settings import get_settings
from market_data_pipeline.src.ingestion.pipeline import Pipeline


def _market_refresh_start() -> date:
    settings = get_settings()
    return date.today() - timedelta(days=settings.market_refresh_lookback_days)


def refresh_market() -> dict:
    """Daily market close refresh (cached)."""
    p = Pipeline()
    run_id = "sched_market"
    norm = p.ingest_market(run_id, start=_market_refresh_start())
    if not norm.is_empty():
        p.store.upsert("normalized_time_series", norm, ["series_id", "date", "source"])
        p.build_analytics(run_id)
    return {"job": "refresh_market", "rows": norm.height}


def refresh_macro() -> dict:
    """Daily FRED macro refresh — checks for new observations."""
    p = Pipeline()
    run_id = "sched_macro"
    norm = p.ingest_macro(run_id)
    if not norm.is_empty():
        p.store.upsert("normalized_time_series", norm, ["series_id", "date", "source"])
        p.build_analytics(run_id)
    return {"job": "refresh_macro", "rows": norm.height}


def refresh_intraday() -> dict:
    """Controlled, cached intraday market pull (kept infrequent)."""
    return refresh_market()


def build_scheduler() -> BackgroundScheduler:
    """Wire the cadences. Times are UTC; tune to your venue."""
    get_settings()  # ensure dirs
    sched = BackgroundScheduler(timezone="UTC")

    # Daily market close refresh — weekdays ~21:30 UTC (after US close).
    sched.add_job(
        refresh_market, CronTrigger(day_of_week="mon-fri", hour=21, minute=30),
        id="market_close", replace_existing=True, max_instances=1, coalesce=True,
    )
    # Macro refresh — daily 13:00 UTC (most FRED releases land in the US morning).
    sched.add_job(
        refresh_macro, CronTrigger(hour=13, minute=0),
        id="macro_daily", replace_existing=True, max_instances=1, coalesce=True,
    )
    # Controlled intraday refresh — every 2h on weekdays during market hours.
    sched.add_job(
        refresh_intraday, CronTrigger(day_of_week="mon-fri", hour="14-20/2", minute=0),
        id="intraday", replace_existing=True, max_instances=1, coalesce=True,
    )
    return sched


def run_forever() -> None:  # pragma: no cover
    import time

    sched = build_scheduler()
    sched.start()
    try:
        while True:
            time.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        sched.shutdown()
