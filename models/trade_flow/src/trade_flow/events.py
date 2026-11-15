"""Kraken v2 boundary. Numeric JSON tokens never pass through binary float.

Sources: https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/trade
https://docs.kraken.com/exchange/guides/websockets/introduction
"""
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from decimal import Decimal, DecimalException, InvalidOperation
import hashlib
import json
import re

EVENT_VERSION = "tfi-trade/1"
MAX_MESSAGE_BYTES = 262144
MAX_EVENTS = 10000
MODES = {"SIM", "LIVE", "HISTORICAL", "REPLAY"}
STAMP = re.compile(r"^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?(Z|[+-]\d\d:\d\d)$")


class ContractError(ValueError):
    """Invalid, ambiguous or unsupported input; never a substituted observation."""


def timestamp_ns(value):
    match = STAMP.fullmatch(value) if isinstance(value, str) else None
    if not match:
        raise ContractError("Expected an offset-aware RFC3339 clock with at most nine fractional digits")
    base, fraction, offset = match.groups()
    if offset == "-00:00" or (offset != "Z" and (int(offset[1:3]) > 23 or int(offset[4:]) > 59)):
        raise ContractError("Invalid clock offset")
    try:
        date = datetime.fromisoformat(base + offset.replace("Z", "+00:00"))
        delta = date.astimezone(timezone.utc) - datetime(1970, 1, 1, tzinfo=timezone.utc)
    except (ValueError, OverflowError) as error:
        raise ContractError("Invalid source clock") from error
    return (delta.days * 86400 + delta.seconds) * 10**9 + int((fraction or "").ljust(9, "0"))


def decimal_text(value):
    if isinstance(value, bool) or not isinstance(value, (str, int, Decimal)):
        raise ContractError("Expected an exact decimal, not a binary float")
    if isinstance(value, str) and (len(value) > 64 or not re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", value)):
        raise ContractError("Invalid decimal representation")
    try:
        number = Decimal(value)
        if not number.is_finite() or number <= 0 or number >= Decimal("1e18") or number.as_tuple().exponent < -18:
            raise ContractError("Positive finite decimal below 1e18 with at most 18 fractional digits required")
        return format(number, "f").rstrip("0").rstrip(".") if number.as_tuple().exponent < 0 else format(number, "f")
    except InvalidOperation as error:
        raise ContractError("Invalid decimal") from error


def strict_json(text, *, max_bytes=MAX_MESSAGE_BYTES):
    try:
        length = len(text.encode("utf-8")) if isinstance(text, str) else max_bytes + 1
    except UnicodeError as error:
        raise ContractError("Invalid Unicode message") from error
    if length > max_bytes:
        raise ContractError("Message exceeds the bounded text contract")

    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ContractError("Duplicate JSON key")
            result[key] = value
        return result

    def nonfinite(value):
        raise ContractError("Non-finite JSON number")

    try:
        return json.loads(text, parse_float=Decimal, parse_constant=nonfinite, object_pairs_hook=pairs)
    except (ValueError, RecursionError, OverflowError, DecimalException) as error:
        raise ContractError("Invalid JSON message") from error


def content_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True,
                                     allow_nan=False).encode()).hexdigest()


@dataclass(frozen=True, slots=True)
class Trade:
    event_id: str
    event_at: str
    received_at: str
    quantity: str
    price: str
    side: str
    side_reason: str
    mode: str
    order_type: str
    instrument: str = "BTC/USD"
    venue: str = "KRAKEN_SPOT"
    schema_version: str = EVENT_VERSION

    def __post_init__(self):
        if self.schema_version != EVENT_VERSION or self.venue != "KRAKEN_SPOT" or self.instrument != "BTC/USD":
            raise ContractError("Unsupported event contract or instrument")
        if not isinstance(self.event_id, str) or not re.fullmatch(r"[1-9][0-9]{0,19}", self.event_id):
            raise ContractError("Expected positive per-book trade ID")
        timestamp_ns(self.event_at)
        timestamp_ns(self.received_at)
        if self.quantity != decimal_text(self.quantity) or self.price != decimal_text(self.price):
            raise ContractError("Event decimals must be canonical")
        if not isinstance(self.side, str) or not isinstance(self.mode, str) or self.side not in {"BUY", "SELL", "UNKNOWN"} or self.mode not in MODES:
            raise ContractError("Unknown side or data mode")
        if not isinstance(self.order_type, str) or self.order_type not in {"market", "limit"}:
            raise ContractError("Unsupported taker order type")
        expected = "PROVIDER_SIDE_MISSING" if self.side == "UNKNOWN" else "PROVIDER_TAKER_SIDE"
        if self.side_reason != expected:
            raise ContractError("Side provenance contradicts classification")

    @property
    def identity(self):
        return self.venue, self.instrument, self.event_id

    def to_dict(self):
        return asdict(self)

    def economics(self):
        # Receipt time is not provider event identity; a repeated delivery may differ.
        return {key: value for key, value in asdict(self).items() if key not in {"received_at", "mode"}}


def normalize_message(text, *, received_at, mode):
    timestamp_ns(received_at)
    if not isinstance(mode, str) or mode not in MODES:
        raise ContractError("Explicit data mode required")
    payload = strict_json(text)
    if not isinstance(payload, dict):
        raise ContractError("Expected a Kraken object")
    if payload.get("method") == "subscribe":
        if payload.get("success") is not True:
            raise ContractError("Subscription refused")
        return []
    channel = payload.get("channel")
    if not isinstance(channel, str):
        raise ContractError("Invalid channel")
    if channel in {"heartbeat", "status"}:
        return []
    if payload.get("channel") != "trade" or payload.get("type") != "update":
        raise ContractError("Only trade updates supported; historical snapshots are excluded")
    rows = payload.get("data")
    if not isinstance(rows, list) or not 1 <= len(rows) <= 1000:
        raise ContractError("Invalid trade batch size")
    events = []
    for row in rows:
        if not isinstance(row, dict) or row.get("symbol") != "BTC/USD":
            raise ContractError("Unexpected instrument")
        identifier = row.get("trade_id")
        if type(identifier) is not int or not 0 < identifier < 10**20:
            raise ContractError("Invalid provider trade ID")
        side = row.get("side")
        if side is not None and (not isinstance(side, str) or side not in {"buy", "sell"}):
            raise ContractError("Invalid provider side")
        if not isinstance(row.get("ord_type"), str) or row.get("ord_type") not in {"market", "limit"}:
            raise ContractError("Unsupported taker order type")
        events.append(Trade(str(identifier), row.get("timestamp"), received_at,
                            decimal_text(row.get("qty")), decimal_text(row.get("price")),
                            side.upper() if side else "UNKNOWN",
                            "PROVIDER_TAKER_SIDE" if side else "PROVIDER_SIDE_MISSING", mode, row["ord_type"]))
    return events
