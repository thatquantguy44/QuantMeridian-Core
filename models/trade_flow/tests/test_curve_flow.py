"""Fictional curve-flow hand calculations and an independent rational oracle."""
import copy
from decimal import Decimal, getcontext
from fractions import Fraction
import random
import unittest

from trade_flow.curve_flow import CurveFlow, curve_batch
from trade_flow.events import ContractError, timestamp_ns


def mapping():
    return {"version": "SIM-strip/1", "effective_from": "2026-11-15T00:00:00Z",
            "effective_until": "2026-11-16T00:00:00Z", "legs": [
                {"instrument": f"SIM-SR3-{month}", "reference_start": f"2027-{month}-17T00:00:00Z",
                 "group": "NEAR" if index < 2 else "FAR"}
                for index, month in enumerate(["03", "06", "09", "12"])]}


def trade(identifier, leg=0, quantity=1, side="BUY", second=300):
    return {"event_id": str(identifier), "instrument": mapping()["legs"][leg]["instrument"],
            "quantity": quantity, "side": side,
            "event_at": f"2026-11-15T10:{second//60:02d}:{second%60:02d}Z",
            "received_at": "2026-11-15T11:00:00Z"}


class CurveFlowTests(unittest.TestCase):
    def test_hand_oracle_preserves_units_orientation_and_provenance(self):
        rows = curve_batch(mapping(), [trade(1, 0, 3), trade(1, 1),
                                      trade(1, 2, 2, "SELL"), trade(1, 3, 4)])
        result = rows[-1]
        self.assertEqual((result["level_flow"], result["slope_flow"]), ("37.5", "-25"))
        self.assertEqual([leg["risk_flow"] for leg in result["legs"]], ["75", "25", "-50", "100"])
        self.assertEqual((result["definition"], result["source_mode"], result["unit"]),
                         ("sofr-curve-flow/1", "SIM", "USD/bp"))
        self.assertEqual(result["status"], "PROVISIONAL")
        self.assertEqual(result["source_completeness"], "UNVERIFIED")
        self.assertNotEqual(rows[0]["prefix_hash"], result["prefix_hash"])
        self.assertIsNone(rows[0]["level_flow"])

    def test_missing_unknown_only_and_balanced_legs_are_distinct(self):
        base = [trade(1, leg) for leg in range(4)]
        missing = curve_batch(mapping(), base[:-1])[-1]
        self.assertEqual(missing["missing_legs"], [base[-1]["instrument"]])
        self.assertIsNone(missing["slope_flow"])
        unknown_only = curve_batch(mapping(), base[:-1]+[trade(1, 3, 8, "UNKNOWN")])[-1]
        self.assertEqual(unknown_only["status"], "UNAVAILABLE")
        partial = curve_batch(mapping(), base+[trade(2, 3, 8, "UNKNOWN")])[-1]
        self.assertEqual((partial["level_flow"], partial["slope_flow"], partial["status"]),
                         ("25", "0", "PARTIAL"))
        self.assertEqual(partial["legs"][-1]["unknown_quantity"], "8")
        balanced = curve_batch(mapping(), base+[trade(2, leg, side="SELL") for leg in range(4)])[-1]
        self.assertEqual((balanced["level_flow"], balanced["slope_flow"]), ("0", "0"))

    def test_common_window_boundaries_late_prefixes_and_no_backwards_cut(self):
        events = [trade(1, leg, quantity=3, second=0) for leg in range(4)]
        events += [trade(2, leg, second=300) for leg in range(4)]
        events += [trade(3, 0, side="SELL", second=100), trade(4, 0, second=0)]
        rows = curve_batch(mapping(), events)
        self.assertEqual(rows[7]["level_flow"], "25")
        self.assertEqual(rows[-1]["level_flow"], "18.75")
        self.assertEqual(rows[-1]["late_events"], 2)
        self.assertEqual(rows[-1]["cut_ns"], timestamp_ns(events[4]["event_at"]))
        self.assertEqual(rows[7]["level_flow"], "25")  # Earlier result remains immutable.

    def test_duplicate_is_idempotent_and_conflicts_reject_atomically(self):
        engine = CurveFlow(mapping())
        first = trade(1)
        engine.push(first)
        duplicate = dict(first, received_at="2026-11-15T11:00:01Z")
        self.assertEqual(engine.push(duplicate)["duplicates"], 1)
        with self.assertRaises(ContractError):
            engine.push(dict(duplicate, quantity=2))
        result = engine.push(dict(trade(2, 1), received_at="2026-11-15T11:00:02Z"))
        self.assertEqual(result["cursor"], 3)
        self.assertEqual(result["legs"][0]["risk_flow"], "25")

    def test_mapping_validity_never_blends_a_roll_window(self):
        config = mapping()
        config["effective_from"] = "2026-11-15T10:01:00Z"
        events = [trade(1, leg) for leg in range(4)]
        result = curve_batch(config, events)[-1]
        self.assertEqual(result["reason"], "MAPPING_WINDOW_UNAVAILABLE")
        self.assertIsNone(result["level_flow"])
        result = curve_batch(config, [trade(1, leg, second=360) for leg in range(4)])[-1]
        self.assertEqual(result["level_flow"], "25")
        config["effective_until"] = "2026-11-15T10:06:00Z"
        self.assertIsNone(curve_batch(config, [trade(1, leg, second=360) for leg in range(4)])[-1]["level_flow"])

    def test_rounding_once_and_caller_precision_independence(self):
        config = mapping()
        config["legs"] = config["legs"][:3]
        events = [trade(1, 0), trade(1, 1), trade(1, 2, side="SELL")]
        precision = getcontext().prec
        try:
            getcontext().prec = 2
            result = curve_batch(config, events)[-1]
            self.assertEqual((result["level_flow"], result["slope_flow"]), ("8.333333333333", "-50"))
        finally:
            getcontext().prec = precision

    def test_slope_rounds_after_subtracting_unrounded_group_means(self):
        config = mapping()
        config["legs"] = [{"instrument": f"SIM-SR3-leg-{i}", "group": "NEAR" if i < 3 else "FAR",
                           "reference_start": f"2027-{i+1:02d}-15T00:00:00Z"} for i in range(6)]
        quantities = [1, 1, -1, 2, 1, -1]
        events = [dict(trade(i), instrument=leg["instrument"], quantity=abs(quantity),
                       side="BUY" if quantity > 0 else "SELL")
                  for i, (leg, quantity) in enumerate(zip(config["legs"], quantities))]
        result = curve_batch(config, events)[-1]
        self.assertEqual((result["level_flow"], result["slope_flow"]), ("12.5", "8.333333333333"))

    def test_receipt_rollback_rejects_without_admitting_future_knowledge(self):
        engine = CurveFlow(mapping())
        engine.push(dict(trade(1), received_at="2026-11-15T11:00:01Z"))
        with self.assertRaises(ContractError):
            engine.push(trade(2, 1))
        result = engine.push(dict(trade(3, 1), received_at="2026-11-15T11:00:02Z"))
        self.assertEqual(result["cursor"], 2)
        self.assertEqual(result["legs"][1]["classified_count"], 1)

    def test_seeded_prefixes_against_independent_fraction_reference(self):
        rng = random.Random(3401)
        events = [trade(i, rng.randrange(4), rng.randrange(1, 20),
                        rng.choice(["BUY", "SELL", "UNKNOWN"]), rng.randrange(1000)) for i in range(1, 81)]
        engine = CurveFlow(mapping())
        rows = [engine.push(event) for event in events]
        self.assertEqual(rows, curve_batch(mapping(), events))
        for cursor, row in enumerate(rows, 1):
            prefix = events[:cursor]
            cut = max(timestamp_ns(event["event_at"]) for event in prefix)
            risks = []
            for leg in mapping()["legs"]:
                eligible = [e for e in prefix if e["instrument"] == leg["instrument"]
                            and cut-300*10**9 < timestamp_ns(e["event_at"]) <= cut and e["side"] != "UNKNOWN"]
                risks.append(25*sum(e["quantity"]*(1 if e["side"] == "BUY" else -1) for e in eligible)
                             if eligible else None)
            if None in risks:
                self.assertIsNone(row["level_flow"])
            else:
                level = Fraction(sum(risks), 4)
                slope = Fraction(sum(risks[2:]), 2)-Fraction(sum(risks[:2]), 2)
                self.assertEqual(Decimal(row["level_flow"]), Decimal(level.numerator)/Decimal(level.denominator))
                self.assertEqual(Decimal(row["slope_flow"]), Decimal(slope.numerator)/Decimal(slope.denominator))

    def test_invalid_mappings_and_events_reject(self):
        configs = []
        for mutation in [lambda c: c["legs"].clear(),
                         lambda c: c["legs"][0].update(group="FAR"),
                         lambda c: c["legs"][2].update(group="NEAR"),
                         lambda c: c["legs"][0].update(instrument="BTC/USD"),
                         lambda c: c["legs"][1].update(instrument=c["legs"][0]["instrument"]),
                         lambda c: c.update(version=[]),
                         lambda c: c.update(effective_until=c["effective_from"])]:
            config = copy.deepcopy(mapping())
            mutation(config)
            configs.append(config)
        # Empty group and interleaved groups, rather than alternate valid partitions.
        configs[1]["legs"][1]["group"] = "FAR"
        configs[2]["legs"][1]["group"] = "FAR"
        for config in configs:
            with self.subTest(config=config), self.assertRaises(ContractError):
                CurveFlow(config)
        for changes in [dict(quantity=True), dict(quantity=1.5), dict(quantity=0), dict(quantity=10**12+1),
                        dict(side=[]), dict(instrument="BTC/USD"), dict(event_id=[]), dict(action="CANCEL"),
                        dict(received_at="2026-11-15T09:00:00Z")]:
            with self.subTest(changes=changes), self.assertRaises(ContractError):
                CurveFlow(mapping()).push(dict(trade(1), **changes))


if __name__ == "__main__":
    unittest.main()
