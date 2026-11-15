"""One bounded public session; no reconnection, recovery or completeness claim.

Transport API: https://websockets.readthedocs.io/en/16.0/reference/sync/client.html
Source protocol: https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/trade
"""
import json
import math
import socket as network_socket
import threading
import time

from .capture import Capture, ENDPOINT, check_permission, utc_now
from .events import ContractError, MAX_MESSAGE_BYTES, strict_json, timestamp_ns


def receive_session(socket, session, *, deadline, monotonic=time.monotonic, wallclock=utc_now):
    subscribed = False
    state, reason = "STOPPED", "DEADLINE"
    while (remaining := deadline - monotonic()) > 0:
        try:
            raw = socket.recv(timeout=min(remaining, 5))
            received_at = wallclock()
            payload = strict_json(raw)
            if not isinstance(payload, dict):
                raise ContractError("Invalid message shape")
            if payload.get("method") == "subscribe":
                result = payload.get("result")
                if payload.get("success") is not True or not isinstance(result, dict) or result.get("channel") != "trade" or result.get("symbol") != "BTC/USD":
                    raise ContractError("Subscription mismatch")
                subscribed = True
            elif payload.get("channel") == "status":
                status = payload.get("data")
                if not isinstance(status, list) or not status or not all(isinstance(r, dict) and r.get("system") == "online" for r in status):
                    raise ContractError("Market unavailable")
            elif payload.get("channel") == "trade" and not subscribed:
                raise ContractError("Trade before subscription acknowledgement")
            if not session.add(raw, received_at=received_at):
                state, reason = "LIMIT", session.limit_reason
                break
        except TimeoutError:
            state, reason = ("STOPPED", "DEADLINE") if monotonic() >= deadline else ("STALE", "RECEIVE_TIMEOUT")
            break
        except ContractError:
            state, reason = "ERROR", "SOURCE_CONTRACT_ERROR"
            break
        except Exception:
            # Raw transport exceptions may include infrastructure details. Persist only a reason code.
            state, reason = "DISCONNECTED", "TRANSPORT_CLOSED"
            break
    if state == "STOPPED" and not session.results:
        state, reason = "NO_DATA", "NO_OBSERVED_TRADES"
    return session.finish(state, reason, ended_at=wallclock())


def capture_live(permission, *, seconds=10, max_events=1000):
    if type(seconds) not in {int, float} or not math.isfinite(seconds) or not 0 < seconds <= 60:
        raise ContractError("Capture duration must be positive and at most 60 seconds")
    started_at = utc_now()
    check_permission(permission, now=started_at)
    required_until = timestamp_ns(started_at) + math.ceil(seconds * 10**9)
    if any(timestamp_ns(permission[key]) <= required_until for key in ("expires_at", "retention_until")):
        raise ContractError("Permission/retention must cover the entire requested capture")
    session = Capture(mode="LIVE", started_at=started_at, max_events=max_events, permission=permission)
    # Permission and bounds are validated before importing or opening a connector.
    from websockets.sync.client import connect

    deadline = time.monotonic() + seconds
    try:
        with connect(ENDPOINT, open_timeout=min(10, seconds), close_timeout=1,
                     max_size=MAX_MESSAGE_BYTES, max_queue=4, compression=None) as socket:
            # sync sendall has no deadline. Interrupt this session's underlying
            # socket even if subscription send blocks. Verified against the pinned
            # websockets.sync.connection.Connection.socket implementation.
            def abort_transport():
                try:
                    socket.socket.shutdown(network_socket.SHUT_RDWR)
                except OSError:
                    pass

            watchdog = threading.Timer(max(0, deadline - time.monotonic()), abort_transport)
            watchdog.daemon = True
            watchdog.start()
            try:
                socket.send(json.dumps({"method": "subscribe", "params": {
                    "channel": "trade", "symbol": ["BTC/USD"], "snapshot": False}, "req_id": 34}))
                return receive_session(socket, session, deadline=deadline)
            finally:
                watchdog.cancel()
    except Exception:
        return session.finish("ERROR", "CONNECTION_UNAVAILABLE", ended_at=utc_now())
