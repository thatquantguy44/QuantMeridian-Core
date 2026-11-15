"""Explicit local experiments; no terminal module or production activation."""
import argparse
import json
from pathlib import Path

from .capture import Capture, prune, read_capture, read_document, replay, utc_now, write_capture
from .curve_flow import CurveFlow, curve_batch
from .diagnostic import compare
from .events import ContractError, MAX_EVENTS, content_hash
from .live import capture_live


def demo():
    """Fictional SIM protocol fixture, never an automatic data-source fallback."""
    now = utc_now()
    session = Capture(mode="SIM", started_at=now)
    for identifier, quantity, side in [(1, 5, "buy"), (2, 2, "sell"), (3, 3, None)]:
        raw = json.dumps({"channel": "trade", "type": "update", "data": [{
            "symbol": "BTC/USD", "trade_id": identifier, "qty": quantity,
            "price": 90000, "side": side, "ord_type": "market", "timestamp": now}]})
        session.add(raw, received_at=now)
    return session.finish("STOPPED", "FICTIONAL_SIM_EXAMPLE", ended_at=now)


def curve(document):
    """Evaluate an explicit bounded SIM input, comparing every received prefix."""
    fields = {"schema_version", "source_mode", "mapping", "deliveries"}
    if (not isinstance(document, dict) or set(document) != fields
            or document["schema_version"] != "tfi-curve-input/1" or document["source_mode"] != "SIM"):
        raise ContractError("Only the explicit SIM tfi-curve-input/1 contract is accepted")
    events = document["deliveries"]
    if not isinstance(events, list) or len(events) > MAX_EVENTS:
        raise ContractError("Curve input must contain at most 10000 deliveries")
    historical = curve_batch(document["mapping"], events)
    kernel = CurveFlow(document["mapping"])
    streaming = [kernel.push(event) for event in events]
    return {"schema_version": "tfi-curve-run/1", "source_mode": "SIM",
            "state": "EVALUATED" if historical else "NO_DATA", "input_hash": content_hash(document),
            "comparison": compare(historical, streaming), "last": historical[-1] if historical else None}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Spec034 local trade-flow research")
    commands = parser.add_subparsers(dest="command", required=True)
    demonstration = commands.add_parser("demo", help="Write a clearly fictional SIM capture")
    demonstration.add_argument("--output", required=True, type=Path)
    capture = commands.add_parser("capture", help="Bounded public Kraken capture; reviewed permission required")
    capture.add_argument("--permission", required=True, type=Path)
    capture.add_argument("--output", required=True, type=Path)
    capture.add_argument("--seconds", type=float, default=10)
    capture.add_argument("--max-events", type=int, default=1000)
    playback = commands.add_parser("replay", help="Verify and replay the same retained input prefixes")
    playback.add_argument("path", type=Path)
    playback.add_argument("--speed", type=float, default=0, help="0 = immediate; 4 = receipt-time replay at 4x")
    strip = commands.add_parser("curve", help="Evaluate explicit SIM SOFR strip level/slope flows")
    strip.add_argument("path", type=Path, help="Bounded tfi-curve-input/1 JSON, source_mode SIM")
    cleanup = commands.add_parser("prune", help="Delete expired recognized *.tfi.json captures in this directory")
    cleanup.add_argument("directory", type=Path)
    args = parser.parse_args(argv)
    try:
        if args.command == "curve":
            result = curve(read_document(args.path))
        elif args.command == "replay":
            now = utc_now()
            result = replay(read_capture(args.path, now=now), now=now, speed=args.speed)
            rows = result.pop("replay_results")
            result["last"] = rows[-1] if rows else None
        elif args.command == "prune":
            result = prune(args.directory, now=utc_now())
        else:
            if args.output.exists() or args.output.is_symlink():
                raise ContractError("Output already exists")
            artifact = demo() if args.command == "demo" else capture_live(
                read_document(args.permission), seconds=args.seconds, max_events=args.max_events)
            write_capture(args.output, artifact)
            result = {key:artifact[key] for key in ("source_mode", "state", "reason", "content_hash", "expires_at")}
            result["events"] = len(artifact["stream_results"])
        print(json.dumps(result, sort_keys=True, allow_nan=False))
        if args.command == "curve":
            return 0 if (result["comparison"]["equivalent"] and result["last"] is not None
                         and result["last"]["level_flow"] is not None) else 1
        if args.command == "replay":
            return 0 if result["comparison"]["equivalent"] else 1
        return 1 if result.get("state") in {"ERROR", "DISCONNECTED", "STALE"} else 0
    except (ContractError, OSError, ImportError) as error:
        # No raw source payload, permission contents, credentials or transport detail.
        result = {"state": "ERROR", "reason": "LOCAL_RESEARCH_UNAVAILABLE", "error_type": type(error).__name__}
        if isinstance(error, ContractError):
            result["message"] = str(error)
        print(json.dumps(result))
        return 1
