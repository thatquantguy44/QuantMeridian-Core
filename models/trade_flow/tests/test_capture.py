import copy
import json
from pathlib import Path
import tempfile
import unittest

from trade_flow.events import ContractError
from trade_flow.capture import Capture, check_permission, prune, read_capture, replay, write_capture
from test_events import message

NOW = "2026-11-15T12:00:00Z"


def permission():
    # Fictional authorization for protocol/gate tests only; never provider permission.
    return dict(schema_version="kraken-source-permission-v1", status="REVIEWED_AUTHORIZATION",
                provider="kraken", venue="spot", endpoint="wss://ws.kraken.com/v2", channel="trade",
                symbols=["BTC/USD"], purpose="local-research-capture-replay", owner="SIM reviewer",
                operator="SIM operator", evidence_ref="SIM evidence, not an actual authorization",
                terms_ref="SIM terms", reviewed_at="2026-11-14T12:00:00Z",
                expires_at="2026-11-16T12:00:00Z", capture=True, retain_raw=True,
                retain_normalized=True, local_replay=True, retention_until="2026-11-16T12:00:00Z",
                storage_scope="private-local", display=False, export=False, redistribute=False)


class CaptureTests(unittest.TestCase):
    def fixture(self):
        capture = Capture(mode="SIM", started_at=NOW)
        capture.add(message(), received_at=NOW)
        capture.add(message(trade_id=8, side="sell"), received_at=NOW)
        return capture.finish("STOPPED", "BOUNDED_TEST_END", ended_at=NOW)

    def test_whole_message_admission_at_event_limit(self):
        capture = Capture(mode="SIM", started_at=NOW, max_events=1)
        two = json.loads(message())
        two["data"].append(dict(two["data"][0], trade_id=8))
        self.assertFalse(capture.add(json.dumps(two), received_at=NOW))
        result = capture.finish("LIMIT", "EVENT_LIMIT", ended_at=NOW)
        self.assertEqual(result["messages"], [])
        self.assertEqual(result["stream_results"], [])

    def test_batch_conflict_never_partially_mutates_capture(self):
        capture = Capture(mode="SIM", started_at=NOW)
        capture.add(message(), received_at=NOW)
        before = capture.finish("STOPPED", "TEST", ended_at=NOW)
        bad = json.loads(message(trade_id=8))
        bad["data"].append(dict(bad["data"][0], trade_id=7, qty=9))
        with self.assertRaises(ContractError):
            capture.add(json.dumps(bad), received_at=NOW)
        self.assertEqual(capture.finish("STOPPED", "TEST", ended_at=NOW), before)

    def test_replay_preserves_all_prefixes_and_declares_sim(self):
        result = replay(self.fixture(), now=NOW)
        self.assertTrue(result["comparison"]["equivalent"])
        self.assertEqual(result["comparison"]["matched"], 2)
        self.assertEqual(result["execution_mode"], "REPLAY")
        self.assertEqual(result["source_mode"], "SIM")
        self.assertEqual(result["origin_authentication"], "UNVERIFIED_CAPTURE")

    def test_tampered_capture_rejected_and_rehashed_output_difference_detected(self):
        from trade_flow.events import content_hash
        artifact = self.fixture()
        artifact["stream_results"][0]["value"] = "7"
        with self.assertRaises(ContractError):
            replay(artifact, now=NOW)
        artifact["content_hash"] = content_hash({k:v for k,v in artifact.items() if k!="content_hash"})
        self.assertFalse(replay(artifact, now=NOW)["comparison"]["equivalent"])

    def test_permission_is_scoped_dated_and_fails_closed(self):
        self.assertTrue(check_permission(permission(), now=NOW))
        for change in [dict(status="BLOCKED"), dict(retain_raw=False), dict(symbols=["*"]),
                       dict(expires_at=NOW), dict(reviewed_at="2026-11-17T12:00:00Z"),
                       dict(evidence_ref=""), dict(storage_scope="public"), dict(capture=1),
                       dict(unexpected_field="not admitted")]:
            with self.subTest(change=change), self.assertRaises(ContractError):
                check_permission(dict(permission(), **change), now=NOW)

    def test_private_exclusive_file_round_trip_and_expiry(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"sim.tfi.json"
            artifact = self.fixture()
            write_capture(path, artifact)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(read_capture(path, now=NOW), artifact)
            with self.assertRaises(FileExistsError):
                write_capture(path, artifact)
            with self.assertRaises(ContractError):
                replay(artifact, now="2026-11-17T12:00:00Z")

    def test_capture_rejects_receipt_regression_atomically(self):
        session = Capture(mode="SIM", started_at=NOW)
        with self.assertRaises(ContractError):
            session.add(message(), received_at="2026-11-15T11:59:59Z")
        session.add(message(), received_at=NOW)
        regressed = session.finish("STOPPED", "TEST", ended_at="2026-11-15T11:59:59Z")
        self.assertEqual(regressed["state"], "ERROR")
        self.assertIsNone(regressed["ended_at"])
        self.assertEqual(regressed["observed_ended_at"], "2026-11-15T11:59:59Z")
        self.assertTrue(replay(regressed, now=NOW)["comparison"]["equivalent"])
        self.assertTrue(replay(session.finish("STOPPED", "TEST", ended_at=NOW), now=NOW)["comparison"]["equivalent"])

    def test_replay_rejects_rehashed_invalid_result_identity_and_extended_retention(self):
        from trade_flow.events import content_hash
        for change in [dict(expires_at="2099-01-01T00:00:00Z"), dict(stream_results=[{"cursor": []}]),
                       dict(source_mode=[]), dict(ended_at="2026-11-15T13:00:00Z")]:
            artifact = dict(self.fixture(), **change)
            artifact["content_hash"] = content_hash({k:v for k,v in artifact.items() if k!="content_hash"})
            with self.subTest(change=change), self.assertRaises(ContractError):
                replay(artifact, now=NOW)

    def test_cleanup_removes_only_expired_recognized_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"expired.tfi.json"
            write_capture(path, self.fixture())
            unrelated = Path(directory)/"unrelated.tfi.json"
            unrelated.write_text('{"keep":"user file"}')
            result = prune(directory, now="2026-11-17T12:00:00Z")
            self.assertEqual(result["removed"], ["expired.tfi.json"])
            self.assertTrue(unrelated.exists())

    def test_pacing_does_not_change_arithmetic_or_clocks(self):
        later = "2026-11-15T12:00:01Z"
        session = Capture(mode="SIM", started_at=NOW)
        session.add(message(), received_at=NOW)
        session.add(message(trade_id=8), received_at=later)
        artifact = session.finish("STOPPED", "TEST", ended_at=later)
        waits = []
        paced = replay(artifact, now=later, speed=4, sleep=waits.append)
        self.assertEqual(waits, [0, 0.25])
        self.assertEqual(paced, replay(artifact, now=later))
        with self.assertRaises(ContractError):
            replay(artifact, now=later, speed=1e-300, sleep=lambda delay: self.fail("must reject before sleeping"))


if __name__ == "__main__":
    unittest.main()
