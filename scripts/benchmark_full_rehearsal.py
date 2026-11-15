#!/usr/bin/env python3
"""Rebuild a read-only PostgreSQL snapshot in a tool-created disposable container.

No target DSN is accepted. The archive and reports are private, non-promotable
artifacts; a database restore is not proof that external capture files can be
restored. Requires psycopg and the candidate EcoMedallion checkout's dependencies.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import hashlib
import importlib.metadata
import json
import math
import os
import pathlib
import secrets
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
from zoneinfo import ZoneInfo

sys.dont_write_bytecode = True


class RehearsalError(ValueError):
    """Expected failure with a safe, non-sensitive explanation."""



def required_bytes(source_bytes: int, reserve: int = 2 * 1024**3) -> int:
    if source_bytes <= 0 or reserve < 0:
        raise RehearsalError("Invalid database size or reserve")
    # Two restored databases plus a conservatively uncompressed archive.
    return 3 * source_bytes + reserve


def assert_capacity(source_bytes: int, workspace_free: int, reserve: int = 2 * 1024**3) -> None:
    if workspace_free < required_bytes(source_bytes, reserve):
        raise RehearsalError("Insufficient local free space for two restores, archive, and reserve")


def assert_target_identity(expected_database: str, actual_database: str, expected_nonce: str, actual_nonce: str) -> None:
    if not expected_database or not expected_nonce or actual_database != expected_database or actual_nonce != expected_nonce:
        raise RehearsalError("Disposable database identity check failed")


def valid_date(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        return dt.date.fromisoformat(value).isoformat() == value
    except ValueError:
        return False


def board_issues(board: list[dict], configured: list[str], cutoff: str) -> list[str]:
    issues: list[str] = []
    counts = collections.Counter(str(row.get("series_id")) for row in board)
    for series in configured:
        if counts[series] == 0:
            issues.append(f"missing_series:{series}")
        if counts[series] > 1:
            issues.append(f"duplicate_series:{series}")
    for row in board:
        series = str(row.get("series_id"))
        if series not in configured:
            issues.append(f"unexpected_series:{series}")
        if row.get("as_of_date") != cutoff:
            issues.append(f"wrong_cutoff:{series}")
        date = row.get("latest_date")
        if not valid_date(date):
            issues.append(f"invalid_date:{series}")
        elif date > cutoff:
            issues.append(f"future_observation:{series}")
        revision = row.get("latest_revision_start")
        if revision is not None and (not valid_date(revision) or revision > cutoff):
            issues.append(f"future_revision:{series}")
        value = row.get("latest_value")
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
            issues.append(f"invalid_value:{series}")
        for field in ("prior_value", "change_bps", "spread_to_benchmark_bps", "zscore", "percentile"):
            statistic = row.get(field)
            if statistic is not None and (isinstance(statistic, bool) or not isinstance(statistic, (int, float)) or not math.isfinite(statistic)):
                issues.append(f"invalid_statistic:{series}:{field}")
        count = row.get("history_unknown_vintage_count")
        if not isinstance(count, int) or isinstance(count, bool) or count < 0:
            issues.append(f"invalid_unknown_vintage_count:{series}")
    return issues


def table_delta(before: dict, after: dict) -> dict:
    a, b = set(before), set(after)
    return {"added": sorted(b - a), "removed": sorted(a - b),
            "changed": sorted(k for k in a & b if before[k] != after[k]),
            "unchanged": sorted(k for k in a & b if before[k] == after[k])}


def private_report(directory: pathlib.Path, report: dict) -> None:
    path = directory / "report.json"
    temp = directory / "report.json.tmp"
    with temp.open("w", encoding="utf-8") as handle:
        os.chmod(temp, 0o600)
        json.dump(report, handle, indent=2, sort_keys=True, default=str, allow_nan=False)
        handle.write("\n")
    temp.replace(path)


def command(args: list[str], *, stdin=None, stdout=None, env=None, timeout=900) -> str:
    result = subprocess.run(args, input=stdin, stdout=stdout if stdout is not None else subprocess.PIPE,
                            stderr=subprocess.PIPE, env=env, timeout=timeout, check=False)
    if result.returncode:
        # Command arguments and subprocess stderr can contain credentials.
        raise RehearsalError(f"{pathlib.Path(args[0]).name} failed (exit {result.returncode}); details withheld")
    return "" if stdout is not None else result.stdout.decode("utf-8").strip()


def cleanup_container(container: str, token: str, acknowledged: bool) -> tuple[bool, bool]:
    """Remove only the specifically labeled container; timeouts remain uncertain."""
    try:
        inspected = subprocess.run(["docker", "inspect", "--format", '{{ index .Config.Labels "com.quantmeridian.rehearsal" }}', container], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False, timeout=15)
        if inspected.returncode == 0 and inspected.stdout.decode().strip() == token:
            removed = subprocess.run(["docker", "rm", "-f", container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False, timeout=30).returncode == 0
            return True, removed
        if inspected.returncode == 0:
            return acknowledged, False
        listing = subprocess.run(["docker", "ps", "-a", "--filter", "name=^/" + container + "$", "--format", "{{.Names}}"], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=False, timeout=15)
        # A timed-out create could still be completed asynchronously.
        return acknowledged, acknowledged and listing.returncode == 0 and not listing.stdout.strip()
    except (OSError, UnicodeError, subprocess.TimeoutExpired):
        return acknowledged, False


def table_inventory(connection) -> dict:
    from psycopg import sql
    relations = connection.execute("""SELECT n.nspname AS schema, c.relname AS name
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE c.relkind IN ('r','p','m') AND n.nspname NOT IN ('pg_catalog','information_schema','_rehearsal')
          AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp_%'
        ORDER BY n.nspname,c.relname""").fetchall()
    result = {}
    for rel in relations:
        query = sql.SQL("SELECT COUNT(*) AS n, COALESCE(SUM(hashtextextended(t::text, 0)::numeric),0)::text AS h1, "
                        "COALESCE(SUM(hashtextextended(t::text, 271)::numeric),0)::text AS h2 FROM ONLY {}.{} AS t").format(
                            sql.Identifier(rel["schema"]), sql.Identifier(rel["name"]))
        row = connection.execute(query).fetchone()
        key = f'{rel["schema"]}.{rel["name"]}'
        if key in result:
            raise RehearsalError("Ambiguous qualified relation names")
        result[key] = {"schema": rel["schema"], "table": rel["name"], "rows": row["n"], "checksum": [row["h1"], row["h2"]]}
    return result


def board_rows(connection) -> list[dict]:
    return [row["row"] for row in connection.execute("SELECT to_jsonb(b) AS row FROM gold.benchmark_rate_board b ORDER BY b.series_id").fetchall()]


def board_changes(before: list[dict], after: list[dict]) -> list[dict]:
    a = {row["series_id"]: row for row in before}
    b = {row["series_id"]: row for row in after}
    result = []
    for key in sorted(set(a) | set(b)):
        old, new = a.get(key), b.get(key)
        if old is None or new is None:
            result.append({"series_id": key, "presence": "added" if old is None else "removed"})
            continue
        fields = {}
        for field in sorted(set(old) | set(new)):
            if field not in old:
                fields[field] = {"change": "added", "after": new[field]}
                continue
            if field not in new:
                fields[field] = {"change": "removed", "before": old[field]}
                continue
            left, right = old[field], new[field]
            equal = (math.isclose(left, right, rel_tol=1e-10, abs_tol=1e-10)
                     if isinstance(left, (int, float)) and not isinstance(left, bool) and isinstance(right, (int, float)) and not isinstance(right, bool)
                     else left == right)
            if not equal:
                fields[field] = {"before": left, "after": right}
        if fields:
            result.append({"series_id": key, "fields": fields})
    return result


def qualify_evidence(rows: list[dict], receipts: list[dict], batches: list[dict], cutoff: str, snapshot_at: dt.datetime | None = None) -> dict:
    """Reconcile full configured Silver history to retained payloads or audited captures."""
    by_receipt = collections.defaultdict(list)
    for receipt in receipts:
        try:
            payload = receipt["response_payload"]
            if receipt["endpoint"] != "series/observations" or len(payload.encode()) > 25 * 1024**2:
                continue
            for observation in json.loads(payload).get("observations", []):
                by_receipt[(receipt["series_id"], receipt["run_id"], observation.get("date"))].append(observation)
        except (ValueError, TypeError, KeyError, AttributeError):
            continue
    captures = {}
    for batch in batches:
        try:
            manifest_path = pathlib.Path(batch["manifest_path"])
            if batch["status"] != "applied" or not manifest_path.is_absolute() or manifest_path.name != "manifest.json" or manifest_path.stat().st_size > 25 * 1024**2:
                continue
            manifest = json.loads(manifest_path.read_bytes())
            series = batch["series_id"]
            if not isinstance(series, str) or not series.replace("_", "").isalnum():
                continue
            entry = manifest["series"][series]
            if manifest["source"] != "fred" or entry["file"] != series + ".json" or entry["sha256"] != batch["stage_sha256"]:
                continue
            file = manifest_path.parent / entry["file"]
            if file.stat().st_size > 25 * 1024**2:
                continue
            content = file.read_bytes()
            if hashlib.sha256(content).hexdigest() != batch["stage_sha256"]:
                continue
            capture = json.loads(content)
            if capture["series_id"] != series or capture["start"] != batch["window_start"] or capture["end"] != batch["window_end"]:
                continue
            staged = {(item["observation_date"], item.get("realtime_start") or ""): item for item in capture["rows"]}
            if len(staged) != len(capture["rows"]):
                continue
            observations = collections.defaultdict(list)
            for item in capture["payload"]["observations"]:
                observations[item["date"]].append(item)
            captures[(series, batch["batch_id"])] = (staged, observations)
        except (OSError, ValueError, KeyError, TypeError, AttributeError):
            continue
    end = dt.datetime.combine(dt.date.fromisoformat(cutoff) + dt.timedelta(days=1), dt.time.min, ZoneInfo("America/New_York")).astimezone(dt.timezone.utc)
    capture_limit = min(end, snapshot_at.astimezone(dt.timezone.utc)) if snapshot_at else end
    counts = {"rows": len(rows), "receipt": 0, "audited_repair": 0, "unverified": 0, "invalid": 0, "future_input": 0, "future_capture": 0, "ambiguous_vintages": 0}
    per_series = collections.defaultdict(collections.Counter)
    keys = collections.Counter((r.get("series_id"), r.get("observation_date"), r.get("realtime_start") or "") for r in rows)
    counts["ambiguous_vintages"] = sum(n - 1 for n in keys.values() if n > 1)
    for (series, _, _), amount in keys.items():
        if amount > 1:
            per_series[str(series)]["ambiguous_vintages"] += amount - 1
    for row in rows:
        series_counts = per_series[str(row.get("series_id"))]
        series_counts["rows"] += 1
        date, revision = row.get("observation_date"), row.get("realtime_start") or ""
        future = bool((valid_date(date) and date > cutoff) or (revision and valid_date(revision) and revision > cutoff))
        valid = bool(row.get("source") == "fred" and valid_date(date) and (not revision or valid_date(revision)) and row.get("run_id") and row.get("row_hash"))
        try:
            captured = dt.datetime.fromisoformat(str(row["ingested_at"]).replace("Z", "+00:00"))
            valid = valid and captured.tzinfo is not None and captured.utcoffset() is not None
            if captured.tzinfo is not None and captured.utcoffset() is not None and captured.astimezone(dt.timezone.utc) >= capture_limit:
                counts["future_capture"] += 1
                series_counts["future_capture"] += 1
                future = True
            if int(row["is_missing"]) == 1:
                valid = valid and row.get("value") is None and row.get("raw_value") == "."
            else:
                valid = valid and int(row["is_missing"]) == 0 and row.get("value") is not None and math.isfinite(float(row["value"])) and math.isclose(float(row["raw_value"]), float(row["value"]), rel_tol=1e-12, abs_tol=1e-12)
        except (KeyError, ValueError, TypeError, OverflowError):
            valid = False
        if future:
            counts["future_input"] += 1
            series_counts["future_input"] += 1
        if not valid:
            counts["invalid"] += 1
            series_counts["invalid"] += 1
            continue
        def matches(item):
            return str(item.get("value")) == row.get("raw_value") and (not revision or (item.get("realtime_start") == revision and item.get("realtime_end") == row.get("realtime_end")))
        evidence_key = (row["series_id"], row["run_id"], date)
        if any(matches(item) for item in by_receipt.get(evidence_key, [])):
            counts["receipt"] += 1
            series_counts["receipt"] += 1
            continue
        capture = captures.get((row["series_id"], row["run_id"]))
        item = capture[0].get((date, revision)) if capture else None
        if item and all(item.get(k) == row.get(k) for k in ("source", "series_id", "realtime_end", "value", "raw_value", "row_hash", "ingested_at")) and int(item.get("is_missing", -1)) == int(row["is_missing"]) and any(matches(o) for o in capture[1].get(date, [])):
            counts["audited_repair"] += 1
            series_counts["audited_repair"] += 1
        else:
            counts["unverified"] += 1
            series_counts["unverified"] += 1
    counts["by_series"] = {series: {key: values[key] for key in ("rows", "receipt", "audited_repair", "unverified", "invalid", "future_input", "future_capture", "ambiguous_vintages")} for series, values in sorted(per_series.items())}
    return counts


def independent_latest_issues(rows: list[dict], board: list[dict], configured: list[str], cutoff: str, snapshot_at: dt.datetime) -> list[str]:
    """Independently select dated revisions and compare latest board metadata."""
    end = dt.datetime.combine(dt.date.fromisoformat(cutoff) + dt.timedelta(days=1), dt.time.min, ZoneInfo("America/New_York")).astimezone(dt.timezone.utc)
    limit = min(end, snapshot_at.astimezone(dt.timezone.utc))
    selected = {}
    issues = []
    for row in rows:
        series, date, revision = row["series_id"], row["observation_date"], row.get("realtime_start") or ""
        try:
            capture = dt.datetime.fromisoformat(str(row["ingested_at"]).replace("Z", "+00:00"))
            if not capture.tzinfo or not valid_date(date) or (revision and not valid_date(revision)):
                raise ValueError()
            if date > cutoff or (revision and revision > cutoff) or capture.astimezone(dt.timezone.utc) >= limit:
                continue
        except (KeyError, ValueError, TypeError):
            issues.append(f"invalid_source_date:{series}")
            continue
        key = (series, date)
        if key not in selected or revision > (selected[key].get("realtime_start") or ""):
            selected[key] = row
        elif revision == (selected[key].get("realtime_start") or ""):
            issues.append(f"ambiguous_vintage:{series}")
    board_by_id = {r["series_id"]: r for r in board}
    for series in configured:
        history = sorted((r for (sid, _), r in selected.items() if sid == series and int(r["is_missing"]) == 0 and r["value"] is not None), key=lambda r: r["observation_date"])
        observed, actual = (history[-1] if history else None), board_by_id.get(series)
        if not observed or not actual:
            issues.append(f"missing_evidenced_history:{series}")
            continue
        actual_value = actual.get("latest_value")
        if (actual.get("latest_date") != observed["observation_date"] or isinstance(actual_value, bool)
                or not isinstance(actual_value, (int, float)) or not math.isfinite(actual_value)
                or not math.isclose(actual_value, float(observed["value"]), rel_tol=1e-10, abs_tol=1e-10)):
            issues.append(f"latest_value_mismatch:{series}")
        if actual.get("source") != "fred" or (actual.get("latest_revision_start") or "") != (observed.get("realtime_start") or ""):
            issues.append(f"latest_lineage_mismatch:{series}")
        if actual.get("history_unknown_vintage_count") != sum(not r.get("realtime_start") for r in history):
            issues.append(f"unknown_vintage_count_mismatch:{series}")
        try:
            board_time = dt.datetime.fromisoformat(str(actual.get("latest_ingested_at")).replace("Z", "+00:00"))
            observed_time = dt.datetime.fromisoformat(str(observed.get("ingested_at")).replace("Z", "+00:00"))
            if not board_time.tzinfo or board_time != observed_time:
                issues.append(f"capture_mismatch:{series}")
        except (ValueError, TypeError):
            issues.append(f"capture_mismatch:{series}")
    return sorted(set(issues))


def snapshot_evidence(connection, ids: list[str], cutoff: str, snapshot_at: dt.datetime) -> tuple[list[dict], dict]:
    rows = connection.execute("""SELECT source,series_id,observation_date,realtime_start,realtime_end,value,raw_value,
        is_missing,row_hash,revision_number,ingested_at,run_id FROM silver.fred_observation
        WHERE source='fred' AND series_id=ANY(%s) ORDER BY series_id,observation_date,COALESCE(realtime_start,'')""", (ids,)).fetchall()
    runs = sorted({r["run_id"] for r in rows if r["run_id"]})
    if len(runs) > 2000:
        raise RehearsalError("Benchmark evidence run limit exceeded")
    receipts = connection.execute("""WITH bounded AS (SELECT series_id,run_id,endpoint,response_payload,
        SUM(octet_length(response_payload)) OVER (ORDER BY series_id,run_id ROWS UNBOUNDED PRECEDING) AS total
        FROM bronze.fred_api_response WHERE source='fred' AND series_id=ANY(%s) AND run_id=ANY(%s)
          AND octet_length(response_payload)<=26214400)
        SELECT series_id,run_id,endpoint,response_payload FROM bounded WHERE total<=67108864""", (ids, runs)).fetchall()
    batches = connection.execute("""SELECT b.batch_id,b.series_id,b.stage_sha256,b.window_start,b.window_end,b.status,r.manifest_path
        FROM audit.fred_repair_batch b JOIN audit.etl_run r ON r.run_id=b.batch_id
        WHERE b.series_id=ANY(%s) AND b.batch_id=ANY(%s) AND b.status='applied' AND r.status='succeeded'""", (ids, runs)).fetchall()
    return rows, qualify_evidence(rows, receipts, batches, cutoff, snapshot_at)


def verify_identity(connection, database: str, nonce: str) -> None:
    actual = connection.execute("SELECT current_database() AS database, token FROM _rehearsal.identity").fetchone()
    assert_target_identity(database, actual["database"], nonce, actual["token"])


def git_snapshot(root: pathlib.Path, directory: pathlib.Path) -> dict:
    root = root.resolve(strict=True)
    if command(["git", "-C", str(root), "status", "--porcelain", "--untracked-files=normal", "--", "src", "config"]):
        raise RehearsalError("Candidate src/config contain uncommitted changes")
    commit = command(["git", "-C", str(root), "rev-parse", "HEAD"])
    archive = directory / "candidate.tar"
    with archive.open("wb") as handle:
        command(["git", "-C", str(root), "archive", commit, "src", "config"], stdout=handle)
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    frozen = directory / "candidate-code"
    frozen.mkdir(mode=0o700)
    with tarfile.open(archive) as tar:
        tar.extractall(frozen, filter="data")
    return {"commit": commit, "archive_sha256": digest, "source": str(root), "frozen_root": str(frozen)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pipeline-root", required=True, type=pathlib.Path)
    parser.add_argument("--workspace", type=pathlib.Path, default=pathlib.Path(tempfile.gettempdir()))
    parser.add_argument("--image", default="postgres:16", help="Already-local PostgreSQL Docker image matching the source major version")
    args = parser.parse_args()
    import psycopg
    from psycopg import sql
    from psycopg.conninfo import conninfo_to_dict, make_conninfo
    from psycopg.rows import dict_row
    root = args.workspace.resolve(strict=True)
    run_dir = pathlib.Path(tempfile.mkdtemp(prefix="bmrk-full-rehearsal-", dir=root))
    os.chmod(run_dir, 0o700)
    report = {"schema": "benchmark-full-rehearsal/1", "status": "incomplete", "promotable": False,
              "stage": "initialization", "limitations": ["No production changes or promotion path.",
              "Full snapshot contains latest retained records, not a point-in-time provider archive.",
              "A retained receipt is not an independent live provider check.",
              "Recovery validates a database-only restore; external repair captures are checked in place and are not included in the database archive.",
              "Table fingerprints are order-independent non-cryptographic checks, not proofs of exact equality.",
              "The writer runs as a local Python process against isolated PostgreSQL; its CPU, memory and network are not container-sandboxed." ]}
    def mark(stage: str) -> None:
        report["stage"] = stage
        private_report(run_dir, report)
        print(json.dumps({"stage": stage, "promotable": False}), flush=True)

    archive = run_dir / "warehouse.dump"
    container = "bmrk-rehearsal-" + secrets.token_hex(12)
    started = False
    attempted = False
    container_token = secrets.token_hex(32)
    source = None
    candidate = None
    recovery = None
    wh = None
    exit_code = 1
    try:
        dsn = os.environ.get("MACRO_DB_URL", "")
        if not dsn.startswith(("postgres://", "postgresql://")) or "\n" in dsn or "\r" in dsn:
            raise RehearsalError("MACRO_DB_URL must be a PostgreSQL URL")
        candidate_root = args.pipeline_root.resolve(strict=True)
        candidate_commit = command(["git", "-C", str(candidate_root), "rev-parse", "HEAD"])
        candidate_tree = command(["git", "-C", str(candidate_root), "rev-parse", "HEAD^{tree}"])
        dirty = bool(command(["git", "-C", str(candidate_root), "status", "--porcelain", "--untracked-files=normal", "--", "src", "config"]))
        report["candidate"] = {"source": str(candidate_root), "commit": candidate_commit, "git_tree": candidate_tree, "source_config_clean": not dirty}
        if dirty:
            raise RehearsalError("Candidate src/config contain uncommitted changes")
        mark("source_snapshot")
        source = psycopg.connect(dsn, row_factory=dict_row, connect_timeout=10)
        source.execute("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY")
        source.execute("SET LOCAL statement_timeout='1800s'")
        source.execute("SET LOCAL lock_timeout='15s'")
        identity = source.execute("SELECT current_database() AS database, transaction_timestamp() AS snapshot_at, current_setting('transaction_read_only') AS read_only, pg_database_size(current_database()) AS bytes, current_setting('server_version_num')::integer AS version").fetchone()
        if identity["read_only"] != "on":
            raise RehearsalError("Source transaction is not read-only")
        asof = identity["snapshot_at"].astimezone(ZoneInfo("America/New_York")).date()
        report["source"] = {"database": identity["database"], "snapshot_at": identity["snapshot_at"].isoformat(),
                            "transaction": "repeatable read, read only", "size_bytes": identity["bytes"],
                            "server_major": identity["version"] // 10000, "as_of_date": asof.isoformat(), "as_of_timezone": "America/New_York"}
        free = shutil.disk_usage(run_dir).free
        report["capacity"] = {"workspace_available_bytes": free, "required_bytes": required_bytes(identity["bytes"]), "formula": "three times database size plus 2 GiB"}
        mark("capacity_preflight")
        try:
            assert_capacity(identity["bytes"], free)
        except ValueError:
            report["status"] = "blocked"
            report["reason"] = "Insufficient workspace space for the snapshot archive and two disposable restores."
            return 2
        mark("freeze_candidate")
        code = git_snapshot(args.pipeline_root, run_dir)
        if code["commit"] != candidate_commit:
            raise RehearsalError("Candidate revision changed during preflight")
        report["candidate"].update({k: v for k, v in code.items() if k != "frozen_root"})
        report["candidate"]["python_version"] = sys.version.split()[0]
        report["candidate"]["dependency_versions"] = {}
        for package in ("psycopg", "PyYAML", "numpy", "polars"):
            try:
                report["candidate"]["dependency_versions"][package] = importlib.metadata.version(package)
            except importlib.metadata.PackageNotFoundError:
                report["candidate"]["dependency_versions"][package] = None
        frozen = pathlib.Path(code["frozen_root"])
        # The candidate writer needs only the generated target DSN. Do not pass
        # source URLs, provider keys, or operator FRED overrides into its code.
        for key in list(os.environ):
            if key.startswith("FRED_") or key in {"MACRO_DB_URL", "DATABASE_URL"}:
                os.environ.pop(key, None)
        report["candidate"]["configuration"] = "PipelineConfig defaults and frozen src/config; source URL and FRED environment overrides removed"
        os.chdir(frozen)
        sys.path.insert(0, str(frozen / "src"))
        from fred_pipeline.gold_config.rates_complex_config import load_benchmark_board
        from fred_pipeline.config import PipelineConfig
        from fred_pipeline.io.postgres_store import PostgresWarehouse
        config = load_benchmark_board(str(frozen / "config/benchmark_rates.yml"))
        ids = [item.series_id for item in config.rates]
        if len(ids) != len(set(ids)) or not ids or any(item.benchmark and item.benchmark not in ids for item in config.rates):
            raise RehearsalError("Invalid configured board or missing benchmark dependency")
        report["configured_series"] = ids
        mark("create_disposable_container")
        image_id = command(["docker", "image", "inspect", "--format", "{{.Id}}", args.image])
        report["candidate"]["postgres_image_id"] = image_id
        password = secrets.token_urlsafe(30)
        dbname = "candidate_" + secrets.token_hex(8)
        recovery_name = "recovery_" + secrets.token_hex(8)
        nonce = secrets.token_hex(32)
        attempted = True
        command(["docker", "run", "-d", "--pull", "never", "--rm", "-p", "127.0.0.1::5432", "--name", container,
                 "--label", "com.quantmeridian.rehearsal=" + container_token,
                 "-e", "POSTGRES_USER=benchmark_rehearsal", "-e", "POSTGRES_PASSWORD=" + password,
                 "-e", "POSTGRES_DB=" + dbname, image_id], timeout=90)
        started = True
        target = None
        for _ in range(60):
            try:
                port = int(command(["docker", "port", container, "5432/tcp"]).rsplit(":", 1)[1])
                target_dsn = make_conninfo(host="127.0.0.1", port=port, dbname=dbname, user="benchmark_rehearsal", password=password, connect_timeout=2, options="-c lock_timeout=15000")
                target = psycopg.connect(target_dsn, row_factory=dict_row)
                break
            except (psycopg.OperationalError, ValueError, RuntimeError):
                time.sleep(1)
        if target is None:
            raise RuntimeError("Disposable PostgreSQL did not become ready")
        version = int(target.execute("SHOW server_version_num").fetchone()["server_version_num"])
        if version // 10000 != identity["version"] // 10000:
            raise RehearsalError("Disposable PostgreSQL major version differs from source")
        target.close()
        free_target = int(command(["docker", "exec", container, "sh", "-c", "df -Pk /var/lib/postgresql/data | tail -1 | awk '{print $4}'"]).strip()) * 1024
        report["capacity"]["container_available_bytes"] = free_target
        if free_target < 2 * identity["bytes"] + 2 * 1024**3:
            raise RehearsalError("Insufficient disposable database storage for two restores")
        mark("source_snapshot_inventory")
        foreign = source.execute("SELECT count(*) AS n FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='f' AND n.nspname NOT LIKE 'pg_%' AND n.nspname <> 'information_schema'").fetchone()["n"]
        if foreign or source.execute("SELECT to_regnamespace('_rehearsal') AS value").fetchone()["value"] is not None:
            raise RehearsalError("Foreign tables or reserved rehearsal schema prevent a complete snapshot")
        source_inventory = table_inventory(source)
        report["source"]["tables_in_snapshot"] = len(source_inventory)
        mark("export_read_only_snapshot")
        snapshot = source.execute("SELECT pg_export_snapshot() AS snapshot").fetchone()["snapshot"]
        params = conninfo_to_dict(dsn)
        if params.get("host") in ("localhost", "127.0.0.1", "::1"):
            params["host"] = "host.docker.internal"
        if not params.get("host") or any("\n" in str(v) or "\r" in str(v) for v in params.values()):
            raise RehearsalError("Source host must be reachable from the disposable container")
        params["options"] = "-c default_transaction_read_only=on"
        container_source = make_conninfo(**params)
        dump_command = ["docker", "exec", "-i", container, "sh", "-c",
                        "IFS= read -r PGDATABASE; export PGDATABASE; export PGOPTIONS='-c default_transaction_read_only=on'; exec pg_dump --format=custom --no-owner --no-acl --dbname \"$PGDATABASE\" --snapshot \"$1\"", "sh", snapshot]
        with archive.open("wb") as handle:
            os.chmod(archive, 0o600)
            command(dump_command, stdin=(container_source + "\n").encode(), stdout=handle, timeout=14400)
        source.rollback()
        source.close()
        source = None
        with archive.open("rb") as handle:
            archive_digest = hashlib.file_digest(handle, "sha256").hexdigest()
        report["backup"] = {"size_bytes": archive.stat().st_size, "sha256": archive_digest, "scope": "PostgreSQL database only; roles, ACLs and external capture files are not backed up", "retained": False}
        mark("restore_candidate")
        def restore(database: str) -> None:
            with archive.open("rb") as handle:
                result = subprocess.run(["docker", "exec", "-i", "-e", "PGPASSWORD=" + password, container, "pg_restore", "--exit-on-error", "--no-owner", "--no-acl", "-h", "127.0.0.1", "-U", "benchmark_rehearsal", "-d", database], stdin=handle, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=14400)
            if result.returncode:
                raise RehearsalError(f"pg_restore failed (exit {result.returncode}); details withheld")
        restore(dbname)
        candidate = psycopg.connect(target_dsn, row_factory=dict_row)
        candidate.execute("CREATE SCHEMA _rehearsal")
        candidate.execute("CREATE TABLE _rehearsal.identity (token text NOT NULL)")
        candidate.execute("INSERT INTO _rehearsal.identity VALUES (%s)", (nonce,))
        candidate.commit()
        verify_identity(candidate, dbname, nonce)
        mark("baseline_inventory_and_evidence")
        before = table_inventory(candidate)
        snapshot_delta = table_delta(source_inventory, before)
        report["snapshot_copy_validation"] = {"tables_compared": len(source_inventory), "differences": snapshot_delta,
            "matched": not any(snapshot_delta[k] for k in ("added", "removed", "changed"))}
        if not report["snapshot_copy_validation"]["matched"]:
            raise RehearsalError("Restored snapshot does not match source table fingerprints")
        before_board = board_rows(candidate)
        source_rows, evidence = snapshot_evidence(candidate, ids, asof.isoformat(), identity["snapshot_at"])
        report["evidence"] = evidence
        evidence["missing_series"] = sorted(set(ids) - {row["series_id"] for row in source_rows})
        if evidence["missing_series"] or not source_rows or evidence["invalid"] or evidence["unverified"] or evidence["ambiguous_vintages"]:
            raise RehearsalError("Missing, invalid, unverified, or ambiguous benchmark source evidence")
        # Release inventory/evidence read locks before bootstrap performs DDL.
        candidate.rollback()
        mark("build_candidate")
        wh = PostgresWarehouse(PipelineConfig(), dsn=target_dsn, initialize=False)
        verify_identity(wh._pg_conn, dbname, nonce)
        wh._pg_conn.rollback()
        wh._bootstrap_schema()
        report["build_result"] = wh.build_gold(full=True, benchmark_as_of=asof)
        wh._pg_conn.close()
        wh = None
        candidate.rollback()
        after_board = board_rows(candidate)
        after = table_inventory(candidate)
        report["board"] = {"rows_before": len(before_board), "rows_after": len(after_board), "before": before_board, "after": after_board,
                           "changes": board_changes(before_board, after_board),
                           "issues": board_issues(after_board, ids, asof.isoformat()),
                           "independent_latest_issues": independent_latest_issues(source_rows, after_board, ids, asof.isoformat(), identity["snapshot_at"])}
        report["gold_tables"] = table_delta({k:v for k,v in before.items() if v["schema"] == "gold"}, {k:v for k,v in after.items() if v["schema"] == "gold"})
        report["gold_table_fingerprints"] = {"before": {k:v for k,v in before.items() if v["schema"] == "gold"}, "after": {k:v for k,v in after.items() if v["schema"] == "gold"}}
        mark("restore_recovery_copy")
        admin = psycopg.connect(make_conninfo(host="127.0.0.1", port=port, dbname="postgres", user="benchmark_rehearsal", password=password), autocommit=True)
        admin.execute(sql.SQL("CREATE DATABASE {} ").format(sql.Identifier(recovery_name)))
        admin.close()
        restore(recovery_name)
        recovery = psycopg.connect(make_conninfo(host="127.0.0.1", port=port, dbname=recovery_name, user="benchmark_rehearsal", password=password), row_factory=dict_row)
        restored = table_inventory(recovery)
        differences = table_delta(before, restored)
        report["recovery"] = {"scope": "table contents only, excluding DDL parity, roles, ACLs and external files", "tables_compared": len(before), "differences": differences, "matched": not any(differences[k] for k in ("added", "removed", "changed"))}
        failed_models = [name for name, state in report["build_result"].items() if state != "ok"]
        report["issues"] = (["future_source_inputs_excluded"] if evidence["future_input"] else []) + report["board"]["issues"] + report["board"]["independent_latest_issues"] + (["recovery_mismatch"] if not report["recovery"]["matched"] else []) + (["external_repair_capture_recovery_not_tested"] if evidence["audited_repair"] else []) + ["build_failed:" + name for name in failed_models]
        report["status"] = "attention" if report["issues"] else "passed"
        mark("complete")
        exit_code = 1 if report["issues"] else 0
    except Exception as error:
        report["status"] = "failed"
        report["error"] = {"type": type(error).__name__, "message": str(error) if isinstance(error, RehearsalError) else "Details withheld to avoid exposing credentials or source data."}
    finally:
        for conn in (source, candidate, recovery, getattr(wh, "_pg_conn", None)):
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass
        removed = True
        if attempted:
            started, removed = cleanup_container(container, container_token, started)
        archive_created = archive.exists()
        try:
            archive.unlink(missing_ok=True)
            archive_removed = True
        except OSError:
            archive_removed = False
        report["cleanup"] = {"container_created": started, "container_removed": removed, "temporary_database_archive_created": archive_created, "temporary_database_archive_removed": archive_removed}
        if not removed or not archive_removed:
            report["cleanup"]["container"] = container if not removed else None
            report["cleanup"]["container_label"] = container_token if not removed else None
            report["status"] = "failed"
            report["reason"] = "Disposable resource cleanup could not be confirmed; inspect the recorded container name and label."
            exit_code = 1
        private_report(run_dir, report)
        print(json.dumps({"report": str(run_dir / "report.json"), "status": report["status"], "stage": report["stage"], "promotable": False}))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
