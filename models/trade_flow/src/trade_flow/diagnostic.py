"""Provisional, receipt-prefix signed BTC quantity. No factor formulas or forecasts."""
from decimal import Context, Decimal, Inexact, InvalidOperation, Overflow, Rounded, localcontext

from .events import ContractError, MAX_EVENTS, Trade, content_hash, timestamp_ns

POLICY = {
    "definition": "classified_signed_qty/1",
    "policy_version": "kraken-btc-diagnostic/1",
    "window_ns": 300 * 10**9,
    "endpoints": "(start,end]",
    "cut": "maximum_event_time_in_received_prefix",
    "unknown_side": "exclude_and_report",
    "late_policy": "future_prefix_only_no_revisions",
    "finality": "never_assert_source_completeness",
    "unit": "BTC",
}
POLICY_HASH = content_hash(POLICY)
ARITHMETIC = Context(prec=80, traps=[Inexact, Rounded, InvalidOperation, Overflow])


def number_text(value):
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def summarize(window):
    with localcontext(ARITHMETIC):
        buy = sum((Decimal(e.quantity) for e in window if e.side == "BUY"), Decimal(0))
        sell = sum((Decimal(e.quantity) for e in window if e.side == "SELL"), Decimal(0))
        unknown = sum((Decimal(e.quantity) for e in window if e.side == "UNKNOWN"), Decimal(0))
        classified = sum(e.side != "UNKNOWN" for e in window)
        return {
            "value": number_text(buy - sell) if classified else None,
            "classified_quantity": number_text(buy + sell),
            "unknown_quantity": number_text(unknown),
            "classified_count": classified,
            "unknown_count": len(window) - classified,
            "status": "PROVISIONAL" if classified else "UNAVAILABLE",
            "reason": "SOURCE_COMPLETENESS_UNVERIFIED" if classified else "NO_CLASSIFIED_TRADES",
        }


class Diagnostic:
    """Bounded single-book state. Never assumes IDs are contiguous or cuts decrease."""

    def __init__(self):
        self.seen = {}
        self.window = []
        self.cut = None
        self.count = self.duplicates = self.late = 0
        self.prefix_hash = content_hash({"policy": POLICY_HASH})
        self.mode = None

    def push(self, event):
        if not isinstance(event, Trade) or self.count >= MAX_EVENTS:
            raise ContractError("Unsupported event or event bound exceeded")
        if self.mode is not None and self.mode != event.mode:
            raise ContractError("Mixed source modes cannot share a diagnostic")
        previous = self.seen.get(event.identity)
        if previous is not None and previous.economics() != event.economics():
            raise ContractError("Conflicting duplicate trade identity")
        event_ns = timestamp_ns(event.event_at)
        self.mode = event.mode
        self.count += 1
        self.prefix_hash = content_hash({"previous": self.prefix_hash, "event": event.to_dict()})
        if previous is not None:
            self.duplicates += 1
        else:
            self.late += int(self.cut is not None and event_ns < self.cut)
            self.cut = max(self.cut if self.cut is not None else event_ns, event_ns)
            self.seen[event.identity] = event
            self.window.append(event)
        self.window = [e for e in self.window if self.cut - POLICY["window_ns"] < timestamp_ns(e.event_at) <= self.cut]
        return self.snapshot(event)

    def snapshot(self, event):
        return {
            **POLICY, **summarize(self.window),
            "policy_hash": POLICY_HASH, "source_mode": self.mode,
            "cursor": self.count, "event_identity": list(event.identity),
            "event_at": event.event_at, "received_at": event.received_at,
            "processed_at": None, "emitted_at": None, "revision": 0,
            "cut_ns": self.cut, "window_start_ns": self.cut - POLICY["window_ns"],
            "prefix_hash": self.prefix_hash, "duplicates": self.duplicates, "late_events": self.late,
            "warmup": "UNVERIFIED", "source_completeness": "UNVERIFIED",
        }


def batch(events):
    """Batch adapter uses the same kernel, one result per observed delivery prefix."""
    kernel = Diagnostic()
    return [kernel.push(event) for event in events]


def compare(historical, replay):
    """Compare all economic/status/lineage fields, with missing and duplicate rows explicit."""
    def index(rows):
        result = {}
        duplicates = set()
        for row in rows:
            key = row["cursor"]
            if key in result:
                duplicates.add(key)
            result[key] = row
        return result, duplicates

    left, left_duplicates = index(historical)
    right, right_duplicates = index(replay)
    ledger = []
    for key in sorted(left.keys() | right.keys()):
        a, b = left.get(key), right.get(key)
        if key in left_duplicates or key in right_duplicates:
            state = "DUPLICATE_IDENTITY"
        elif a is None:
            state = "MISSING_BATCH"
        elif b is None:
            state = "MISSING_REPLAY"
        else:
            state = "MATCHED" if a == b else "DIFFERENT"
        ledger.append({"cursor": key, "state": state,
                       "different_fields": sorted(k for k in (a or {}).keys() | (b or {}).keys()
                                                  if (a or {}).get(k) != (b or {}).get(k))})
    return {"equivalent": bool(ledger) and all(row["state"] == "MATCHED" for row in ledger),
            "matched": sum(row["state"] == "MATCHED" for row in ledger), "rows": ledger,
            "comparison_basis": "same event deliveries, prefix, cut, policy, units and exact values"}
