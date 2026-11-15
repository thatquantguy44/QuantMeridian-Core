"""Bounded local evidence artifacts. Hashes detect changes, not source authenticity."""
import copy
from datetime import datetime, timedelta, timezone
import json
import math
import os
from pathlib import Path
import stat
import time

from .diagnostic import Diagnostic, batch, compare
from .events import ContractError, content_hash, normalize_message, strict_json, timestamp_ns

CAPTURE_VERSION = "tfi-capture/1"
ENDPOINT = "wss://ws.kraken.com/v2"
MAX_FILE_BYTES = 8 * 1024 * 1024
SOURCE = {"provider": "kraken", "venue": "spot", "endpoint": ENDPOINT,
          "channel": "trade", "symbols": ["BTC/USD"], "adapter_version": "kraken-trade/1"}
STATES = {"STOPPED", "LIMIT", "DISCONNECTED", "STALE", "NO_DATA", "ERROR"}


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def check_permission(record, *, now):
    if not isinstance(record, dict) or record.get("schema_version") != "kraken-source-permission-v1":
        raise ContractError("Missing recognized source permission record")
    expected = dict(status="REVIEWED_AUTHORIZATION", provider="kraken", venue="spot", endpoint=ENDPOINT,
                    channel="trade", symbols=["BTC/USD"], purpose="local-research-capture-replay",
                    storage_scope="private-local")
    allowed = set(expected) | {"schema_version", "owner", "operator", "evidence_ref", "terms_ref",
        "reviewed_at", "expires_at", "capture", "retain_raw", "retain_normalized", "local_replay",
        "retention_until", "display", "export", "redistribute"}
    if set(record) != allowed:
        raise ContractError("Permission record has missing or unsupported fields")
    if any(record.get(key) != value for key, value in expected.items()):
        raise ContractError("Real capture blocked: source scope/authorization unresolved")
    if any(record.get(key) is not True for key in ("capture", "retain_raw", "retain_normalized", "local_replay")):
        raise ContractError("Capture, retention and replay scopes are required")
    if any(record.get(key) is not False for key in ("display", "export", "redistribute")):
        raise ContractError("This experiment admits no display/export/redistribution")
    for key in ("owner", "operator", "evidence_ref", "terms_ref"):
        if not isinstance(record.get(key), str) or not 1 <= len(record[key].strip()) <= 2048:
            raise ContractError("Missing accountable owner or scoped permission evidence")
    current = timestamp_ns(now)
    if not timestamp_ns(record.get("reviewed_at")) <= current < timestamp_ns(record.get("expires_at")):
        raise ContractError("Permission is future-dated or expired")
    retention = timestamp_ns(record.get("retention_until"))
    if not current < retention <= current + 86400 * 10**9:
        raise ContractError("Experiment retention must end within the next 24 hours")
    return True


class Capture:
    def __init__(self, *, mode, started_at, max_events=1000, permission=None):
        if mode not in {"SIM", "LIVE"} or type(max_events) is not int or not 1 <= max_events <= 1000:
            raise ContractError("Invalid capture mode or bound")
        timestamp_ns(started_at)
        if mode == "LIVE":
            check_permission(permission, now=started_at)
        self.mode, self.started_at, self.permission = mode, started_at, copy.deepcopy(permission)
        self.max_events = max_events
        self.messages, self.results = [], []
        self.kernel = Diagnostic()
        self.bytes = 0
        self.limit_reason = None

    def add(self, raw, *, received_at):
        previous_receipt = self.messages[-1]["received_at"] if self.messages else self.started_at
        if not timestamp_ns(previous_receipt) <= timestamp_ns(received_at) <= timestamp_ns(self.started_at) + 65 * 10**9:
            raise ContractError("Receipt clock discontinuity")
        events = normalize_message(raw, received_at=received_at, mode=self.mode)
        size = len(raw.encode("utf-8"))
        if self.kernel.count + len(events) > self.max_events:
            self.limit_reason = "EVENT_LIMIT"
            return False
        if len(self.messages) >= 1000 or self.bytes + size > 1024 * 1024:
            self.limit_reason = "MESSAGE_OR_BYTE_LIMIT"
            return False
        candidate = copy.deepcopy(self.kernel)
        rows = [candidate.push(event) for event in events]
        self.kernel = candidate
        self.messages.append({"raw": raw, "received_at": received_at})
        self.results.extend(rows)
        self.bytes += size
        return True

    def finish(self, state, reason, *, ended_at):
        last_receipt = self.messages[-1]["received_at"] if self.messages else self.started_at
        if state not in STATES:
            raise ContractError("Invalid capture stopping state")
        discontinuity = not timestamp_ns(last_receipt) <= timestamp_ns(ended_at) <= timestamp_ns(self.started_at) + 65 * 10**9
        if discontinuity:
            state, reason = "ERROR", "RECEIPT_CLOCK_DISCONTINUITY"
        expiry = (datetime.fromisoformat(self.started_at.replace("Z", "+00:00")) + timedelta(days=1)).isoformat()
        if self.mode == "LIVE":
            expiry = self.permission["retention_until"]
        body = {"schema_version": CAPTURE_VERSION, "source": SOURCE, "source_mode": self.mode,
                "started_at": self.started_at, "ended_at": None if discontinuity else ended_at,
                "observed_ended_at": ended_at, "last_valid_receipt_at": last_receipt,
                "clock_status": "DISCONTINUITY" if discontinuity else "ORDERED", "expires_at": expiry,
                "messages": copy.deepcopy(self.messages), "stream_results": copy.deepcopy(self.results),
                "state": state, "reason": reason, "source_completeness": "UNVERIFIED",
                "permission": self.permission,
                "origin_authentication": "UNVERIFIED_CAPTURE"}
        body["source"] = copy.deepcopy(SOURCE)
        return {**body, "content_hash": content_hash(body)}


def replay(artifact, *, now, speed=0, sleep=time.sleep):
    if not isinstance(artifact, dict) or artifact.get("schema_version") != CAPTURE_VERSION:
        raise ContractError("Unsupported capture contract")
    body = {key: value for key, value in artifact.items() if key != "content_hash"}
    try:
        digest = content_hash(body)
    except (TypeError, ValueError, OverflowError) as error:
        raise ContractError("Invalid artifact representation") from error
    if digest != artifact.get("content_hash") or artifact.get("source") != SOURCE:
        raise ContractError("Capture content/source mismatch")
    start = timestamp_ns(artifact.get("started_at"))
    observed_end = timestamp_ns(artifact.get("observed_ended_at"))
    last_receipt = timestamp_ns(artifact.get("last_valid_receipt_at"))
    if artifact.get("clock_status") == "DISCONTINUITY":
        if artifact.get("ended_at") is not None or artifact.get("state") != "ERROR" or artifact.get("reason") != "RECEIPT_CLOCK_DISCONTINUITY" or last_receipt <= observed_end <= start + 65 * 10**9:
            raise ContractError("Invalid clock-discontinuity evidence")
        end = last_receipt
    elif artifact.get("clock_status") == "ORDERED":
        end = timestamp_ns(artifact.get("ended_at"))
        if end != observed_end or end < last_receipt:
            raise ContractError("Capture end disagrees with observed clock")
    else:
        raise ContractError("Missing capture clock status")
    expiry = timestamp_ns(artifact.get("expires_at"))
    if not start <= end <= start + 65 * 10**9 or not end < expiry <= start + 86400 * 10**9:
        raise ContractError("Unsupported capture clocks or retention")
    if expiry <= timestamp_ns(now):
        raise ContractError("Capture retention expired")
    mode = artifact.get("source_mode")
    if not isinstance(mode, str) or mode not in {"SIM", "LIVE"} or not isinstance(artifact.get("state"), str) or artifact["state"] not in STATES:
        raise ContractError("Invalid capture mode or stopping state")
    if artifact.get("source_completeness") != "UNVERIFIED":
        raise ContractError("Capture cannot assert venue completeness")
    messages = artifact.get("messages")
    results = artifact.get("stream_results")
    if not isinstance(messages, list) or len(messages) > 1000 or not isinstance(results, list) or len(results) > 1000:
        raise ContractError("Invalid capture bounds")
    if not all(isinstance(row, dict) and type(row.get("cursor")) is int and 1 <= row["cursor"] <= 1000 for row in results):
        raise ContractError("Invalid recorded result identity")
    if type(speed) not in {int, float} or not math.isfinite(speed) or not (speed == 0 or 1 <= speed <= 1000):
        raise ContractError("Replay speed must be 0 (immediate) or between 1 and 1000")
    if speed and (end - start) / 10**9 / speed > 60:
        raise ContractError("Paced replay exceeds 60 seconds")
    if mode == "LIVE":
        check_permission(artifact.get("permission"), now=now)
        if artifact["expires_at"] != artifact["permission"]["retention_until"]:
            raise ContractError("Capture retention disagrees with permission")
    session = Capture(mode=mode, started_at=artifact.get("started_at"), permission=artifact.get("permission"))
    previous_receipt = start
    for message in messages:
        if not isinstance(message, dict) or set(message) != {"raw", "received_at"}:
            raise ContractError("Invalid retained message")
        receipt = timestamp_ns(message["received_at"])
        if not previous_receipt <= receipt <= end:
            raise ContractError("Receipt clock outside capture order/bounds")
        if speed:
            sleep((receipt - previous_receipt) / 10**9 / speed)
        previous_receipt = receipt
        if not session.add(message["raw"], received_at=message["received_at"]):
            raise ContractError("Retained input exceeds bounds")
    if previous_receipt != last_receipt:
        raise ContractError("Last receipt does not match accepted prefix")
    # Independently rebuild the event list from retained raw inputs for the batch adapter.
    events = [event for message in messages for event in normalize_message(
        message["raw"], received_at=message["received_at"], mode=mode)]
    expected = batch(events)
    return {"schema_version": "tfi-replay/1", "execution_mode": "REPLAY", "source_mode": mode,
            "origin_authentication": "UNVERIFIED_CAPTURE", "capture_hash": digest,
            "capture_state": artifact["state"], "comparison": compare(expected, results),
            "replay_results": session.results, "source_completeness": "UNVERIFIED"}


def write_capture(path, artifact):
    payload = json.dumps(artifact, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    if len(payload) > MAX_FILE_BYTES:
        raise ContractError("Artifact exceeds file bound")
    path = Path(path)
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "wb") as stream:
        stream.write(payload)


def read_document(path):
    path = Path(path)
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, "rb") as stream:
        metadata = os.fstat(stream.fileno())
        if not stat.S_ISREG(metadata.st_mode) or metadata.st_size > MAX_FILE_BYTES:
            raise ContractError("Unsupported capture path or file bound")
        raw = stream.read(MAX_FILE_BYTES + 1)
    try:
        artifact = strict_json(raw.decode("utf-8"), max_bytes=MAX_FILE_BYTES)
    except UnicodeError as error:
        raise ContractError("Invalid artifact text") from error
    return artifact


def read_capture(path, *, now):
    artifact = read_document(path)
    replay(artifact, now=now)
    return artifact


def prune(directory, *, now):
    removed = []
    for path in sorted(Path(directory).glob("*.tfi.json")):
        if path.is_symlink():
            continue
        try:
            artifact = read_document(path)
            if not isinstance(artifact, dict) or artifact.get("schema_version") != CAPTURE_VERSION:
                continue
            body = {k:v for k,v in artifact.items() if k != "content_hash"}
            if content_hash(body) != artifact.get("content_hash"):
                continue
            if timestamp_ns(artifact.get("expires_at")) <= timestamp_ns(now):
                path.unlink()
                removed.append(path.name)
        except (OSError, ContractError, TypeError, ValueError):
            continue
    return {"removed": removed}
