import json
import importlib.util
import unittest
import threading
import time
from unittest.mock import patch

from trade_flow.capture import Capture
from trade_flow.events import ContractError
from trade_flow.live import capture_live, receive_session
from test_capture import NOW, permission
from test_events import message


ACK = '{"method":"subscribe","success":true,"result":{"channel":"trade","symbol":"BTC/USD"}}'


class Socket:
    def __init__(self, messages):
        self.messages = iter(messages)

    def recv(self, timeout):
        value = next(self.messages, TimeoutError())
        if isinstance(value, Exception):
            raise value
        return value


class LiveBoundaryTests(unittest.TestCase):
    def run_socket(self, messages, max_events=1000):
        session = Capture(mode="SIM", started_at=NOW, max_events=max_events)
        return receive_session(Socket(messages), session, deadline=100,
                               monotonic=lambda: 0, wallclock=lambda: NOW)

    def test_idle_timeout_and_partial_capture_are_explicit(self):
        result = self.run_socket([ACK, message(), TimeoutError()])
        self.assertEqual(result["state"], "STALE")
        self.assertEqual(len(result["stream_results"]), 1)
        self.assertEqual(result["source_mode"], "SIM")

    def test_subscription_and_maintenance_fail_closed(self):
        for messages in [[message()], ['{"method":"subscribe","success":false}'],
                         [ACK, '{"channel":"status","data":[{"system":"maintenance"}]}']]:
            result = self.run_socket(messages)
            self.assertEqual(result["state"], "ERROR")
            self.assertEqual(result["stream_results"], [])

    def test_limits_stop_without_partial_message_admission(self):
        result = self.run_socket([ACK, message(), message(trade_id=8)], max_events=1)
        self.assertEqual(result["state"], "LIMIT")
        self.assertEqual(len(result["stream_results"]), 1)

    def test_blocked_or_expired_permission_prevents_connector_import(self):
        with patch("trade_flow.live.utc_now", return_value=NOW):
            with self.assertRaises(ContractError):
                capture_live(dict(permission(), status="BLOCKED"))
            with self.assertRaises(ContractError):
                capture_live(dict(permission(), expires_at="2026-11-14T12:00:00Z"))

    def test_capture_duration_is_bounded_and_not_nan(self):
        with patch("trade_flow.live.utc_now", return_value=NOW):
            for seconds in [0, 61, float("nan"), True]:
                with self.assertRaises(ContractError):
                    capture_live(permission(), seconds=seconds)

    @unittest.skipUnless(importlib.util.find_spec("websockets"), "optional pinned capture dependency absent")
    def test_deadline_aborts_a_blocked_subscription_send(self):
        interrupted = threading.Event()

        class BlockedSocket:
            socket = None
            def __init__(self): self.socket = self
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def send(self, payload):
                if not interrupted.wait(1):
                    self.fail = True
                raise OSError("stalled send interrupted")
            def shutdown(self, how): interrupted.set()

        with patch("trade_flow.live.utc_now", return_value=NOW), patch("websockets.sync.client.connect", return_value=BlockedSocket()):
            started = time.monotonic()
            result = capture_live(permission(), seconds=0.05)
            self.assertLess(time.monotonic() - started, 0.8)
            self.assertTrue(interrupted.is_set())
            self.assertEqual(result["state"], "ERROR")

    def test_clock_rollback_retains_replayable_accepted_prefix(self):
        from trade_flow.capture import replay
        earlier = "2026-11-15T11:59:59Z"
        clocks = iter([NOW, NOW, earlier, earlier])
        session = Capture(mode="SIM", started_at=NOW)
        result = receive_session(Socket([ACK, message(), message(trade_id=8)]), session,
                                 deadline=100, monotonic=lambda: 0, wallclock=lambda: next(clocks))
        self.assertEqual(result["state"], "ERROR")
        self.assertEqual(result["clock_status"], "DISCONTINUITY")
        self.assertEqual(len(result["stream_results"]), 1)
        self.assertTrue(replay(result, now=NOW)["comparison"]["equivalent"])


if __name__ == "__main__":
    unittest.main()
