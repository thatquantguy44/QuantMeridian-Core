"""SIM-only research curve flow; definition and sources: spec034/FORMULA_POLICY.md."""
import copy
from decimal import Context, Decimal, ROUND_HALF_EVEN, localcontext
import heapq
import re

from .events import ContractError, MAX_EVENTS, content_hash, timestamp_ns

POLICY = {
    "definition": "sofr-curve-flow/1", "window_ns": 300 * 10**9,
    "endpoints": "(start,end]", "bpv_usd": 25, "unit": "USD/bp",
    "level_weights": "equal_mean_all_configured_legs",
    "slope_weights": "mean_far_minus_mean_near",
    "orientation": "positive_futures_buying",
    "unknown_side": "exclude_and_report_partial", "missing_leg": "both_factors_null",
    "cut": "maximum_event_time_in_received_prefix",
    "late_policy": "future_prefix_only_no_revisions",
    "precision": "12_decimal_places_half_even", "source_mode": "SIM",
    "max_quantity": 10**12, "max_deliveries": MAX_EVENTS,
}
POLICY_HASH = content_hash(POLICY)
ARITHMETIC = Context(prec=80, rounding=ROUND_HALF_EVEN)


def validate_mapping(mapping):
    fields = {"version", "effective_from", "effective_until", "legs"}
    if not isinstance(mapping, dict) or set(mapping) != fields:
        raise ContractError("Expected a versioned explicit SIM strip mapping")
    version = mapping["version"]
    if not isinstance(version, str) or not re.fullmatch(r"[A-Za-z0-9_./:-]{1,64}", version):
        raise ContractError("Invalid mapping version")
    if timestamp_ns(mapping["effective_from"]) >= timestamp_ns(mapping["effective_until"]):
        raise ContractError("Mapping effective interval must be nonempty")
    legs = mapping["legs"]
    if not isinstance(legs, list) or not 2 <= len(legs) <= 10:
        raise ContractError("An explicit strip requires 2 to 10 legs")
    instruments, starts, groups = set(), set(), {"NEAR": [], "FAR": []}
    for leg in legs:
        if not isinstance(leg, dict) or set(leg) != {"instrument", "reference_start", "group"}:
            raise ContractError("Invalid leg definition")
        instrument, group = leg["instrument"], leg["group"]
        if not isinstance(instrument, str) or not re.fullmatch(r"SIM-SR3-[A-Za-z0-9_-]{1,48}", instrument):
            raise ContractError("Only explicit SIM-SR3 leg identifiers are accepted")
        if not isinstance(group, str) or group not in groups or instrument in instruments:
            raise ContractError("Duplicate instrument or invalid maturity group")
        start = timestamp_ns(leg["reference_start"])
        if start in starts:
            raise ContractError("Reference starts must identify distinct expiries")
        instruments.add(instrument)
        starts.add(start)
        groups[group].append(start)
    if not all(groups.values()) or max(groups["NEAR"]) >= min(groups["FAR"]):
        raise ContractError("Nonempty NEAR and FAR groups must be ordered by reference start")
    return copy.deepcopy(mapping)


def validate_trade(event, instruments):
    fields = {"event_id", "instrument", "quantity", "side", "event_at", "received_at"}
    if not isinstance(event, dict) or set(event) != fields:
        raise ContractError("Expected an ordinary SIM trade, without corrections or extra fields")
    identifier, instrument, side = event["event_id"], event["instrument"], event["side"]
    if not isinstance(identifier, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", identifier):
        raise ContractError("Invalid per-contract event identity")
    if not isinstance(instrument, str) or instrument not in instruments:
        raise ContractError("Trade is outside the explicit strip")
    if type(event["quantity"]) is not int or not 1 <= event["quantity"] <= POLICY["max_quantity"]:
        raise ContractError("Contract quantity must be an integer from 1 to 1e12")
    if not isinstance(side, str) or side not in {"BUY", "SELL", "UNKNOWN"}:
        raise ContractError("Explicit SIM side required")
    if timestamp_ns(event["received_at"]) < timestamp_ns(event["event_at"]):
        raise ContractError("SIM receipt cannot precede its event clock")
    return dict(event)


def number_text(value):
    text = format(value, "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


class CurveFlow:
    """Bounded received-prefix kernel. No real feed or continuous-contract mapping."""

    def __init__(self, mapping):
        self.mapping = validate_mapping(mapping)
        self.mapping_hash = content_hash(self.mapping)
        self.instruments = {leg["instrument"] for leg in self.mapping["legs"]}
        self.seen, self.window = {}, []
        self.totals = {instrument: {side: {"quantity": 0, "count": 0} for side in ("BUY", "SELL", "UNKNOWN")}
                       for instrument in self.instruments}
        self.cut = self.last_receipt = None
        self.count = self.duplicates = self.late = 0
        self.prefix_hash = content_hash({"policy": POLICY_HASH, "mapping": self.mapping_hash})

    def push(self, event):
        if self.count >= MAX_EVENTS:
            raise ContractError("Curve delivery bound exceeded")
        event = validate_trade(event, self.instruments)
        receipt, clock = timestamp_ns(event["received_at"]), timestamp_ns(event["event_at"])
        if self.last_receipt is not None and receipt < self.last_receipt:
            raise ContractError("SIM receipt clocks cannot decrease")
        identity = event["instrument"], event["event_id"]
        economics = {key: value for key, value in event.items() if key != "received_at"}
        previous = self.seen.get(identity)
        if previous is not None and previous != economics:
            raise ContractError("Conflicting duplicate curve trade identity")
        # All rejection checks precede admission, preserving the accepted prefix.
        self.last_receipt = receipt
        self.count += 1
        self.prefix_hash = content_hash({"previous": self.prefix_hash, "event": event})
        if previous is not None:
            self.duplicates += 1
        else:
            self.late += int(self.cut is not None and clock < self.cut)
            self.cut = max(self.cut if self.cut is not None else clock, clock)
            self.seen[identity] = economics
            # Cursor breaks heap ties only; sums do not infer provider causal order.
            heapq.heappush(self.window, (clock, self.count, event))
            self._accumulate(event, 1)
        while self.window and self.window[0][0] <= self.cut-POLICY["window_ns"]:
            self._accumulate(heapq.heappop(self.window)[2], -1)
        return self.snapshot(event)

    def _accumulate(self, event, direction):
        bucket = self.totals[event["instrument"]][event["side"]]
        bucket["quantity"] += direction*event["quantity"]
        bucket["count"] += direction

    def snapshot(self, event):
        legs = []
        for leg in self.mapping["legs"]:
            buckets = self.totals[leg["instrument"]]
            buys, sells = buckets["BUY"]["quantity"], buckets["SELL"]["quantity"]
            unknown = buckets["UNKNOWN"]
            classified = buckets["BUY"]["count"]+buckets["SELL"]["count"]
            legs.append({**leg, "risk_flow": str(25*(buys-sells)) if classified else None,
                         "classified_quantity": str(buys+sells), "classified_count": classified,
                         "unknown_quantity": str(unknown["quantity"]),
                         "unknown_count": unknown["count"]})
        missing = [leg["instrument"] for leg in legs if leg["risk_flow"] is None]
        mapping_valid = (self.cut-POLICY["window_ns"] >= timestamp_ns(self.mapping["effective_from"])
                         and self.cut < timestamp_ns(self.mapping["effective_until"]))
        level = slope = None
        status, reason = "UNAVAILABLE", "MAPPING_WINDOW_UNAVAILABLE" if not mapping_valid else "MISSING_CLASSIFIED_LEGS"
        if mapping_valid and not missing:
            # Integer sums are bounded below 2.5e17; 80 digits isolates both
            # division and final 12-place rounding from the caller's context.
            with localcontext(ARITHMETIC):
                risks = [Decimal(leg["risk_flow"]) for leg in legs]
                means = {group: sum((Decimal(leg["risk_flow"]) for leg in legs if leg["group"] == group), Decimal(0))
                         / sum(leg["group"] == group for leg in legs) for group in ("NEAR", "FAR")}
                quantum = Decimal("0.000000000001")
                level = number_text((sum(risks)/len(risks)).quantize(quantum))
                slope = number_text((means["FAR"]-means["NEAR"]).quantize(quantum))
            status = "PARTIAL" if any(leg["unknown_count"] for leg in legs) else "PROVISIONAL"
            reason = "UNKNOWN_SIDE_EXCLUDED" if status == "PARTIAL" else "SOURCE_COMPLETENESS_UNVERIFIED"
        return {**POLICY, "policy_hash": POLICY_HASH, "mapping_hash": self.mapping_hash,
                "mapping_version": self.mapping["version"], "prefix_hash": self.prefix_hash,
                "level_flow": level, "slope_flow": slope, "legs": legs, "missing_legs": missing,
                "status": status, "reason": reason, "cursor": self.count,
                "event_identity": [event["instrument"], event["event_id"]],
                "event_at": event["event_at"], "received_at": event["received_at"],
                "cut_ns": self.cut, "window_start_ns": self.cut-POLICY["window_ns"],
                "duplicates": self.duplicates, "late_events": self.late,
                "processed_at": None, "emitted_at": None, "revision": 0,
                "warmup": "UNVERIFIED", "source_completeness": "UNVERIFIED"}


def curve_batch(mapping, events):
    """Evaluate the same shared kernel at every received prefix, with no lookahead."""
    kernel = CurveFlow(mapping)
    return [kernel.push(event) for event in events]
