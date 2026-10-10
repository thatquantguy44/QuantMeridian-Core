"""CLI for the market data pipeline.

Examples:
    python -m market_data_pipeline.cli run --offline
    python -m market_data_pipeline.cli run --start 2015-01-01
    python -m market_data_pipeline.cli backfill 2000-01-01
    python -m market_data_pipeline.cli rebuild-analytics
    python -m market_data_pipeline.cli status
    python -m market_data_pipeline.cli serve --port 8000
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import date


def _run(args) -> None:
    from market_data_pipeline.src.config.settings import get_settings
    from market_data_pipeline.src.ingestion.pipeline import Pipeline

    if args.offline:
        get_settings().offline = True
    start = date.fromisoformat(args.start) if args.start else None
    print(json.dumps(Pipeline().run(start=start), indent=2, default=str))


def _backfill(args) -> None:
    from market_data_pipeline.src.ingestion.pipeline import Pipeline

    start = date.fromisoformat(args.start)
    print(json.dumps(Pipeline().run(start=start, run_id=f"backfill_{args.start}"), indent=2, default=str))


def _rebuild(args) -> None:
    from market_data_pipeline.src.ingestion.pipeline import Pipeline

    p = Pipeline()
    p.build_analytics("manual_rebuild")
    print(json.dumps(p.store.table_counts(), indent=2))


def _export_views(args) -> None:
    from market_data_pipeline.src.ingestion.pipeline import Pipeline

    paths = Pipeline().export_api_views(args.out)
    print(json.dumps({"written": [str(p) for p in paths], "dir": args.out}, indent=2))


def _publish_views(args) -> None:
    from market_data_pipeline.src.config.settings import get_settings
    from market_data_pipeline.src.storage.duckdb_store import DuckDBStore
    from market_data_pipeline.src.storage.postgres_views import publish_api_views

    db_url = args.db_url or os.environ.get("MARKET_DB_URL")
    if not db_url:
        raise SystemExit("Provide --db-url or set MARKET_DB_URL.")

    s = get_settings()
    with DuckDBStore(s.duckdb_path) as db:
        result = publish_api_views(db_url, db, create_table=not args.no_create_table)
    print(json.dumps(result, indent=2, default=str))


def _status(args) -> None:
    from market_data_pipeline.src.storage.duckdb_store import DuckDBStore
    from market_data_pipeline.src.config.settings import get_settings

    s = get_settings()
    if not s.duckdb_path.exists():
        print("No database yet — run the pipeline first.")
        return
    with DuckDBStore(s.duckdb_path) as db:
        print(json.dumps(db.table_counts(), indent=2))


def _serve(args) -> None:  # pragma: no cover
    import uvicorn

    uvicorn.run("market_data_pipeline.src.api.app:app", host=args.host, port=args.port, reload=args.reload)


def _schedule(args) -> None:  # pragma: no cover
    from market_data_pipeline.src.scheduler.jobs import run_forever

    print("Starting scheduler (Ctrl-C to stop)…")
    run_forever()


def main() -> None:
    parser = argparse.ArgumentParser(prog="mdp", description="Market Data Pipeline")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_run = sub.add_parser("run", help="Full ETL run (extract→transform→quality→load→analytics)")
    p_run.add_argument("--start", default=None, help="ISO start date")
    p_run.add_argument("--offline", action="store_true", help="Force synthetic sources")
    p_run.set_defaults(func=_run)

    p_bf = sub.add_parser("backfill", help="Historical backfill from a start date")
    p_bf.add_argument("start", help="ISO start date")
    p_bf.set_defaults(func=_backfill)

    sub.add_parser("rebuild-analytics", help="Rebuild gold analytics from normalized").set_defaults(func=_rebuild)
    sub.add_parser("status", help="Show table row counts").set_defaults(func=_status)

    p_ev = sub.add_parser("export-views", help="Write the 6 terminal view payloads as JSON files")
    p_ev.add_argument("--out", default="./data/export", help="Output directory")
    p_ev.set_defaults(func=_export_views)

    p_pub = sub.add_parser(
        "publish-views",
        help="Publish analytics_api_views from DuckDB into Postgres for MARKET_DB_URL",
    )
    p_pub.add_argument("--db-url", default=None, help="Postgres URL. Defaults to MARKET_DB_URL.")
    p_pub.add_argument(
        "--no-create-table",
        action="store_true",
        help="Skip CREATE TABLE IF NOT EXISTS before upserting rows",
    )
    p_pub.set_defaults(func=_publish_views)

    p_srv = sub.add_parser("serve", help="Run the FastAPI server")
    p_srv.add_argument("--host", default="0.0.0.0")
    p_srv.add_argument("--port", type=int, default=8000)
    p_srv.add_argument("--reload", action="store_true")
    p_srv.set_defaults(func=_serve)

    sub.add_parser("schedule", help="Run the APScheduler refresh loop").set_defaults(func=_schedule)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
