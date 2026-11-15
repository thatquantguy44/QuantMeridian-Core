import datetime as dt
import importlib.util
import pathlib
import unittest
from unittest.mock import patch
from types import SimpleNamespace

MODULE = pathlib.Path(__file__).resolve().parents[2] / "scripts" / "benchmark_full_rehearsal.py"
spec = importlib.util.spec_from_file_location("benchmark_full_rehearsal", MODULE)
rehearsal = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rehearsal)


class FullRehearsalTests(unittest.TestCase):
    def test_capacity_accounts_for_two_restores_and_archive(self):
        self.assertEqual(rehearsal.required_bytes(100, reserve=50), 350)
        with self.assertRaises(ValueError):
            rehearsal.required_bytes(0, reserve=50)
        with self.assertRaises(ValueError):
            rehearsal.assert_capacity(source_bytes=100, workspace_free=349, reserve=50)
        rehearsal.assert_capacity(source_bytes=100, workspace_free=350, reserve=50)

    def test_board_checks_dates_values_missing_series_and_evidence(self):
        board = [{"series_id": "SOFR", "as_of_date": "2026-11-11", "latest_date": "2026-11-09", "latest_value": 4.2, "latest_revision_start": None, "history_unknown_vintage_count": 0}]
        self.assertEqual(rehearsal.board_issues(board, ["SOFR"], "2026-11-11"), [])
        self.assertIn("missing_series:EFFR", rehearsal.board_issues(board, ["SOFR", "EFFR"], "2026-11-11"))
        future = [{**board[0], "latest_date": "2026-11-12"}]
        self.assertIn("future_observation:SOFR", rehearsal.board_issues(future, ["SOFR"], "2026-11-11"))
        self.assertIn("invalid_value:SOFR", rehearsal.board_issues([{**board[0], "latest_value": float("nan")}], ["SOFR"], "2026-11-11"))
        self.assertIn("invalid_statistic:SOFR:zscore", rehearsal.board_issues([{**board[0], "zscore": float("inf")}], ["SOFR"], "2026-11-11"))
        self.assertIn("future_revision:SOFR", rehearsal.board_issues([{**board[0], "latest_revision_start": "2026-11-12"}], ["SOFR"], "2026-11-11"))
        self.assertIn("wrong_cutoff:SOFR", rehearsal.board_issues([{**board[0], "as_of_date": "2026-11-12"}], ["SOFR"], "2026-11-11"))
        self.assertIn("duplicate_series:SOFR", rehearsal.board_issues(board + board, ["SOFR"], "2026-11-11"))

    def test_delta_reports_modified_added_and_removed_tables(self):
        old = {"unchanged": {"rows": 1, "checksum": "a"}, "changed": {"rows": 2, "checksum": "a"}, "removed": {"rows": 0, "checksum": "0"}}
        new = {"unchanged": {"rows": 1, "checksum": "a"}, "changed": {"rows": 2, "checksum": "b"}, "added": {"rows": 3, "checksum": "c"}}
        self.assertEqual(rehearsal.table_delta(old, new), {"added": ["added"], "removed": ["removed"], "changed": ["changed"], "unchanged": ["unchanged"]})

    def test_board_comparison_distinguishes_absent_columns_from_null(self):
        before = [{"series_id": "SOFR", "latest_value": 4.2}]
        after = [{"series_id": "SOFR", "latest_value": 4.2, "latest_revision_start": None}]
        self.assertEqual(rehearsal.board_changes(before, after)[0]["fields"]["latest_revision_start"], {"change": "added", "after": None})

    def test_evidence_requires_payload_match_and_quarantines_future(self):
        row = {"series_id": "SOFR", "source": "fred", "observation_date": "2026-11-09", "realtime_start": "", "realtime_end": "", "value": 4.2, "raw_value": "4.2", "is_missing": 0, "row_hash": "abc", "run_id": "r", "ingested_at": "2026-11-10T10:00:00Z"}
        receipt = {"series_id": "SOFR", "run_id": "r", "endpoint": "series/observations", "response_payload": '{"observations":[{"date":"2026-11-09","value":"4.2"}]}' }
        result = rehearsal.qualify_evidence([row], [receipt], [], "2026-11-11")
        self.assertEqual(result["receipt"], 1)
        self.assertEqual(result["unverified"], 0)
        self.assertEqual(result["by_series"]["SOFR"]["receipt"], 1)
        self.assertEqual(rehearsal.qualify_evidence([row], [{**receipt, "response_payload": "{}"}], [], "2026-11-11")["unverified"], 1)
        future = {**row, "observation_date": "2026-11-12"}
        self.assertEqual(rehearsal.qualify_evidence([future], [receipt], [], "2026-11-11")["future_input"], 1)
        later = {**row, "ingested_at": "2026-11-12T06:00:00Z"}
        self.assertEqual(rehearsal.qualify_evidence([later], [receipt], [], "2026-11-11")["future_input"], 1)

    def test_independent_latest_reconciliation_excludes_future_rows(self):
        row = {"series_id":"SOFR", "observation_date":"2026-11-09", "realtime_start":"", "ingested_at":"2026-11-10T10:00:00Z", "value":4.2, "is_missing":0}
        board = [{"series_id":"SOFR", "latest_date":"2026-11-09", "latest_value":4.2, "source":"fred", "latest_revision_start":None, "latest_ingested_at":"2026-11-10T10:00:00Z", "history_unknown_vintage_count":1}]
        now = dt.datetime.fromisoformat("2026-11-11T12:00:00+00:00")
        self.assertEqual(rehearsal.independent_latest_issues([row, {**row, "observation_date":"2026-11-12"}], board, ["SOFR"], "2026-11-11", now), [])
        changed = [{**board[0], "latest_value": 4.3}]
        self.assertIn("latest_value_mismatch:SOFR", rehearsal.independent_latest_issues([row], changed, ["SOFR"], "2026-11-11", now))
        missing_value = [{**board[0], "latest_value": None}]
        self.assertIn("latest_value_mismatch:SOFR", rehearsal.independent_latest_issues([row], missing_value, ["SOFR"], "2026-11-11", now))

    def test_cleanup_removes_only_the_container_with_our_label(self):
        with patch.object(rehearsal.subprocess, "run", side_effect=[SimpleNamespace(returncode=0, stdout=b"our-token"), SimpleNamespace(returncode=0)]) as run:
            self.assertEqual(rehearsal.cleanup_container("name", "our-token", False), (True, True))
            self.assertEqual(run.call_count, 2)
        with patch.object(rehearsal.subprocess, "run", return_value=SimpleNamespace(returncode=0, stdout=b"another-token")) as run:
            self.assertEqual(rehearsal.cleanup_container("name", "our-token", True), (True, False))
            self.assertEqual(run.call_count, 1)
        with patch.object(rehearsal.subprocess, "run", side_effect=[SimpleNamespace(returncode=1, stdout=b""), SimpleNamespace(returncode=0, stdout=b"")]):
            self.assertEqual(rehearsal.cleanup_container("name", "our-token", False), (False, False))

    def test_build_target_must_match_fresh_container_identity(self):
        with self.assertRaises(ValueError):
            rehearsal.assert_target_identity("original", "unexpected", "nonce", "nonce")
        with self.assertRaises(ValueError):
            rehearsal.assert_target_identity("original", "original", "nonce", "wrong")
        rehearsal.assert_target_identity("original", "original", "nonce", "nonce")

if __name__ == "__main__":
    unittest.main()
