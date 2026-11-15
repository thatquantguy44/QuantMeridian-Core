"""Hand oracles and independent integer arithmetic on explicitly fictional data."""
from dataclasses import replace
from decimal import getcontext
import random
import unittest

from trade_flow.events import ContractError, Trade, timestamp_ns
from trade_flow.diagnostic import Diagnostic, batch, compare


def trade(identifier, second=0, quantity="1", side="BUY"):
    stamp = f"2026-11-14T10:{second//60:02d}:{second%60:02d}Z"
    return Trade(str(identifier), stamp, "2026-11-14T11:00:00Z", quantity, "90000", side,
                 "PROVIDER_SIDE_MISSING" if side == "UNKNOWN" else "PROVIDER_TAKER_SIDE", "SIM", "market")


class DiagnosticTests(unittest.TestCase):
    def test_hand_worked_classified_and_unknown_quantity(self):
        events = [trade(1, quantity="5"), trade(2, quantity="2", side="SELL"),
                  trade(3, quantity="3", side="UNKNOWN")]
        result = batch(events)[-1]
        self.assertEqual((result["value"], result["classified_quantity"], result["unknown_quantity"]), ("3", "7", "3"))
        self.assertEqual(result["status"], "PROVISIONAL")
        self.assertEqual(result["unit"], "BTC")
        self.assertEqual(result["definition"], "classified_signed_qty/1")

    def test_no_classified_trades_is_unavailable_but_balanced_is_real_zero(self):
        self.assertIsNone(batch([trade(1, side="UNKNOWN")])[-1]["value"])
        self.assertEqual(batch([trade(1, side="UNKNOWN")])[-1]["status"], "UNAVAILABLE")
        self.assertEqual(batch([trade(1), trade(2, side="SELL")])[-1]["value"], "0")
        self.assertEqual(batch([]), [])

    def test_open_start_closed_end_and_late_prefixes(self):
        events = [trade(1, 0, "5"), trade(2, 300, "2", "SELL"), trade(3, 100, "3")]
        results = batch(events)
        self.assertEqual([r["value"] for r in results], ["5", "-2", "1"])
        self.assertEqual(results[-1]["late_events"], 1)
        self.assertEqual(results[-1]["cut_ns"], timestamp_ns(events[1].event_at))
        # A much later cut cannot move backwards and resurrect evicted history.
        later = [trade(1, 300), trade(2, 900), trade(3, 400)]
        self.assertEqual(batch(later)[-1]["value"], "1")

    def test_duplicate_is_idempotent_conflict_is_rejected(self):
        event = trade(1)
        duplicate = replace(event, received_at="2026-11-14T11:00:01Z")
        rows = batch([event, duplicate])
        self.assertEqual(rows[-1]["value"], "1")
        self.assertEqual(rows[-1]["duplicates"], 1)
        with self.assertRaises(ContractError):
            batch([event, replace(event, quantity="2")])
        with self.assertRaises(ContractError):
            batch([event, replace(event, order_type="limit")])

    def test_arithmetic_is_independent_of_callers_decimal_context(self):
        original = getcontext().prec
        try:
            getcontext().prec = 2
            rows = batch([trade(1, quantity="1.000000000000000001"), trade(2, side="SELL")])
            self.assertEqual(rows[-1]["value"], "0.000000000000000001")
        finally:
            getcontext().prec = original

    def test_batch_streaming_and_integer_reference_equivalence(self):
        rng = random.Random(34)
        events = [trade(i+1, rng.randrange(1000), str(rng.randrange(1, 10)),
                        rng.choice(["BUY", "SELL", "UNKNOWN"])) for i in range(100)]
        kernel = Diagnostic()
        streaming = [kernel.push(event) for event in events]
        self.assertEqual(batch(events), streaming)
        for count, row in enumerate(streaming, 1):
            prefix = events[:count]
            cut = max(timestamp_ns(e.event_at) for e in prefix)
            eligible = [e for e in prefix if cut-300*10**9 < timestamp_ns(e.event_at) <= cut]
            classified = [e for e in eligible if e.side != "UNKNOWN"]
            expected = sum(int(e.quantity)*(1 if e.side == "BUY" else -1) for e in classified)
            self.assertEqual(row["value"], str(expected) if classified else None)

    def test_comparator_reports_missing_changed_and_duplicate_rows(self):
        rows = batch([trade(1), trade(2)])
        ledger = compare(rows, [dict(rows[0], value="9")])
        self.assertFalse(ledger["equivalent"])
        self.assertEqual([r["state"] for r in ledger["rows"]], ["DIFFERENT", "MISSING_REPLAY"])
        self.assertFalse(compare(rows, rows+[rows[0]])["equivalent"])


if __name__ == "__main__":
    unittest.main()
