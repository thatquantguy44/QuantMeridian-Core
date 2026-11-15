"""Opt-in Docker integration. All rates below are fictional, test-only fixtures."""
import datetime as dt
import json
import os
import pathlib
import secrets
import subprocess
import sys
import time
import unittest
from zoneinfo import ZoneInfo
from urllib.parse import urlunsplit

APP = pathlib.Path(__file__).resolve().parents[2]
PIPELINE = (APP / "../../pipelines/fred-bronze-to-gold-pipeline").resolve()


@unittest.skipUnless(os.environ.get("BENCHMARK_FULL_INTEGRATION") == "1", "Opt-in disposable PostgreSQL integration")
class DisposableRehearsalIntegration(unittest.TestCase):
    def test_rebuild_and_recover_fictional_fixture(self):
        import psycopg
        sys.path.insert(0, str(PIPELINE / "src"))
        from fred_pipeline.config import PipelineConfig
        from fred_pipeline.gold_config.rates_complex_config import load_benchmark_board
        from fred_pipeline.io.postgres_store import PostgresWarehouse

        ids = [item.series_id for item in load_benchmark_board(str(PIPELINE / "config/benchmark_rates.yml")).rates]
        name = "bmrk-integration-fixture-" + secrets.token_hex(8)
        password = secrets.token_hex(20)
        try:
            try:
                created = subprocess.run(["docker", "run", "-d", "--pull", "never", "--rm", "-p", "127.0.0.1::5432", "--name", name,
                                          "-e", "POSTGRES_USER=fixture", "-e", "POSTGRES_PASSWORD=" + password,
                                          "-e", "POSTGRES_DB=fictional_test_only", "postgres:16"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
            except subprocess.TimeoutExpired:
                raise AssertionError(f"Disposable fixture startup timed out; check Docker for {name}") from None
            if created.returncode:
                self.fail("Disposable fixture container could not start")
            for _ in range(60):
                try:
                    port = int(subprocess.check_output(["docker", "port", name, "5432/tcp"], text=True, stderr=subprocess.DEVNULL).strip().rsplit(":", 1)[1])
                    dsn = urlunsplit(("postgresql", f"fixture:{password}@127.0.0.1:{port}", "/fictional_test_only", "", ""))
                    check = psycopg.connect(dsn, connect_timeout=1)
                    check.close()
                    break
                except (psycopg.OperationalError, subprocess.CalledProcessError, ValueError):
                    time.sleep(1)
            else:
                self.fail("Disposable fixture database did not start")
            warehouse = PostgresWarehouse(PipelineConfig(), dsn=dsn)
            connection = warehouse._pg_conn
            connection.execute("CREATE TABLE IF NOT EXISTS audit.fred_repair_batch (batch_id text, series_id text, stage_sha256 text, window_start text, window_end text, status text)")
            today = dt.datetime.now(ZoneInfo("America/New_York")).date()
            captured = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=2)).isoformat()
            for index, series in enumerate(ids):
                run = "FICTIONAL_TEST_ONLY_" + series
                observations = []
                for n in range(8, 0, -1):
                    day = (today - dt.timedelta(days=n)).isoformat()
                    value = round(1.25 + index / 100 + n / 1000, 3)
                    raw = str(value)
                    observations.append({"date": day, "value": raw})
                    connection.execute("""INSERT INTO silver.fred_observation
                        (source,series_id,observation_date,realtime_start,realtime_end,value,raw_value,is_missing,row_hash,run_id,ingested_at)
                        VALUES ('fred',%s,%s,'','',%s,%s,0,'FICTIONAL_TEST_ONLY',%s,%s)""", (series, day, value, raw, run, captured))
                connection.execute("INSERT INTO bronze.fred_api_response (source,series_id,run_id,endpoint,response_payload) VALUES ('fred',%s,%s,'series/observations',%s)",
                                   (series, run, json.dumps({"observations": observations})))
            connection.commit()
            connection.close()
            env = {**os.environ, "MACRO_DB_URL": dsn, "PYTHONDONTWRITEBYTECODE": "1"}
            result = subprocess.run([sys.executable, str(APP / "scripts/benchmark_full_rehearsal.py"), "--pipeline-root", str(PIPELINE)],
                                    cwd=APP, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=900)
            summary = json.loads(result.stdout.strip().splitlines()[-1])
            report = json.loads(pathlib.Path(summary["report"]).read_text())
            self.assertEqual(report["stage"], "complete", report.get("error"))
            self.assertTrue(report["snapshot_copy_validation"]["matched"])
            self.assertTrue(report["recovery"]["matched"])
            self.assertEqual(report["board"]["rows_after"], len(ids))
            self.assertEqual(report["board"]["issues"], [])
            self.assertEqual(report["board"]["independent_latest_issues"], [])
            self.assertEqual(report["evidence"]["unverified"], 0)
            self.assertFalse(report["promotable"])
            self.assertEqual(report["cleanup"], {"container_created": True, "container_removed": True, "temporary_database_archive_created": True, "temporary_database_archive_removed": True})
        finally:
            try:
                subprocess.run(["docker", "rm", "-f", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False, timeout=15)
            except (OSError, subprocess.TimeoutExpired):
                pass
