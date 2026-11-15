"""Fictional protocol inputs; no observed market data or network access."""
import json
import unittest
from decimal import Decimal

from trade_flow.events import ContractError, normalize_message, timestamp_ns


def message(**changes):
    trade = dict(symbol="BTC/USD", side="buy", qty=Decimal("0.123456789123456789"),
                 price=Decimal("90000.000000001"), ord_type="market", trade_id=7,
                 timestamp="2026-11-14T10:00:00.123456789Z")
    trade.update(changes)
    # Preserve numeric JSON tokens rather than converting them through float.
    row = ','.join(json.dumps(k)+':'+(str(v) if isinstance(v, Decimal) else json.dumps(v))
                   for k, v in trade.items())
    return '{"channel":"trade","type":"update","data":[{'+row+'}]}'


class EventContractTests(unittest.TestCase):
    def parse(self, text):
        return normalize_message(text, received_at="2026-11-14T10:00:01Z", mode="SIM")

    def test_preserves_exact_numeric_tokens_and_source_clock(self):
        event, = self.parse(message())
        self.assertEqual(event.quantity, "0.123456789123456789")
        self.assertEqual(event.price, "90000.000000001")
        self.assertEqual(event.event_at, "2026-11-14T10:00:00.123456789Z")
        self.assertEqual(event.identity, ("KRAKEN_SPOT", "BTC/USD", "7"))
        self.assertEqual(event.side, "BUY")
        self.assertEqual(event.mode, "SIM")

    def test_offset_and_nanosecond_precision(self):
        self.assertEqual(timestamp_ns("2026-11-14T11:00:00.123456789+01:00"),
                         timestamp_ns("2026-11-14T10:00:00.123456789Z"))
        self.assertEqual(timestamp_ns("2026-11-14T10:00:00.123456790Z") -
                         timestamp_ns("2026-11-14T10:00:00.123456789Z"), 1)

    def test_missing_side_is_visible_unknown(self):
        event, = self.parse(message(side=None))
        self.assertEqual((event.side, event.side_reason), ("UNKNOWN", "PROVIDER_SIDE_MISSING"))

    def test_rejects_malformed_and_out_of_scope_events(self):
        for changes in [dict(qty=0), dict(qty=-1), dict(price=0), dict(trade_id=True),
                        dict(trade_id=1.5), dict(symbol="ETH/USD"), dict(side="hold"),
                        dict(timestamp="2026-11-14T10:00:00"),
                        dict(timestamp="2026-11-14T10:00:00.1234567890Z")]:
            with self.subTest(changes=changes), self.assertRaises(ContractError):
                self.parse(message(**changes))

    def test_rejects_nonfinite_duplicate_keys_and_oversize(self):
        for text in [message().replace('"trade_id":7', '"trade_id":7,"trade_id":8'),
                     message().replace('90000.000000001', 'NaN'), ' ' * 262145]:
            with self.assertRaises(ContractError):
                self.parse(text)

    def test_snapshot_cannot_seed_a_live_capture(self):
        with self.assertRaises(ContractError):
            self.parse(message().replace('"update"', '"snapshot"'))

    def test_controls_are_not_trades(self):
        self.assertEqual(self.parse('{"channel":"heartbeat"}'), [])
        self.assertEqual(self.parse('{"method":"subscribe","success":true}'), [])
        with self.assertRaises(ContractError):
            self.parse('{"method":"subscribe","success":false,"error":"denied"}')

    def test_untrusted_types_and_extreme_numbers_are_contract_errors(self):
        for text in ['{"channel":[]}', message(side=[]), message(ord_type={}),
                     message().replace('90000.000000001', '1e999999999999999999999999'), '\ud800']:
            with self.subTest(text=repr(text)), self.assertRaises(ContractError):
                self.parse(text)


if __name__ == "__main__":
    unittest.main()
