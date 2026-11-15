import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]
COMMAND = [sys.executable, str(ROOT / "scripts/trade-flow.py")]
CURVE_FIXTURE = ROOT/"contracts/trade_flow/sofr-curve-flow.sim.json"


class CliTests(unittest.TestCase):
    def test_curve_fixture_reports_hand_oracle_and_all_prefix_parity(self):
        process = subprocess.run(COMMAND+["curve", str(CURVE_FIXTURE)], capture_output=True, text=True)
        self.assertEqual(process.returncode, 0, process.stderr)
        result = json.loads(process.stdout)
        self.assertEqual(result["source_mode"], "SIM")
        self.assertEqual((result["last"]["level_flow"], result["last"]["slope_flow"]), ("37.5", "-25"))
        self.assertEqual(result["comparison"]["matched"], 4)
        self.assertTrue(result["comparison"]["equivalent"])

    def test_curve_refuses_observed_modes_malformed_and_oversized_inputs(self):
        fixture = json.loads(CURVE_FIXTURE.read_text())
        changes = [{"source_mode": "LIVE"}, {"source_mode": "HISTORICAL"}, {"source_mode": []},
                   {"deliveries": {}}, {"deliveries": [fixture["deliveries"][0]]*10001},
                   {"schema_version": "unknown"}, {"unexpected": "field"}]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"curve.json"
            for change in changes:
                with self.subTest(change=list(change)):
                    path.write_text(json.dumps(dict(fixture, **change)))
                    process = subprocess.run(COMMAND+["curve", str(path)], capture_output=True, text=True)
                    self.assertEqual(process.returncode, 1, process.stderr)
                    self.assertEqual(json.loads(process.stdout)["error_type"], "ContractError")

    def test_curve_empty_or_missing_leg_is_not_successful_numeric_zero(self):
        fixture = json.loads(CURVE_FIXTURE.read_text())
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"curve.json"
            for deliveries in [[], fixture["deliveries"][:-1]]:
                path.write_text(json.dumps(dict(fixture, deliveries=deliveries)))
                process = subprocess.run(COMMAND+["curve", str(path)], capture_output=True, text=True)
                self.assertEqual(process.returncode, 1, process.stderr)
                result = json.loads(process.stdout)
                self.assertTrue(result["last"] is None or result["last"]["level_flow"] is None)

    def test_demo_replay_and_expiry_cleanup(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"fictional.tfi.json"
            demo = subprocess.run(COMMAND+["demo", "--output", str(path)], capture_output=True, text=True)
            self.assertEqual(demo.returncode, 0, demo.stderr)
            self.assertEqual(json.loads(demo.stdout)["source_mode"], "SIM")
            replay = subprocess.run(COMMAND+["replay", str(path), "--speed", "4"], capture_output=True, text=True)
            self.assertEqual(replay.returncode, 0, replay.stderr)
            result = json.loads(replay.stdout)
            self.assertTrue(result["comparison"]["equivalent"])
            self.assertEqual(result["last"]["value"], "3")
            self.assertEqual(result["last"]["unknown_quantity"], "3")
            cleanup = subprocess.run(COMMAND+["prune", directory], capture_output=True, text=True)
            self.assertEqual(json.loads(cleanup.stdout)["removed"], [])

    def test_default_source_record_refuses_real_capture_without_creating_output(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"must-not-exist.tfi.json"
            result = subprocess.run(COMMAND+["capture", "--permission",
                str(ROOT/"contracts/trade_flow/kraken-source-permission.blocked.json"),
                "--output", str(path)], capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse(path.exists())
            self.assertEqual(json.loads(result.stdout)["state"], "ERROR")


if __name__ == "__main__":
    unittest.main()
