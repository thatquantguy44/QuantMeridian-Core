"""Real loopback transport with fictional SIM messages, never Kraken market data."""
import importlib.util
import json
import threading
import time
import unittest

from trade_flow.capture import Capture, replay, utc_now
from trade_flow.live import receive_session
from test_events import message
from test_live import ACK


@unittest.skipUnless(importlib.util.find_spec("websockets"), "optional pinned capture dependency absent")
class SocketIntegrationTests(unittest.TestCase):
    def test_fictional_socket_capture_replays_exactly(self):
        from websockets.sync.client import connect
        from websockets.sync.server import serve

        def handler(socket):
            request = json.loads(socket.recv(timeout=2))
            self.assertFalse(request["params"]["snapshot"])
            socket.send(ACK)
            for index, quantity, side in [(1, 5, "buy"), (2, 2, "sell"), (3, 3, None)]:
                socket.send(message(trade_id=index, qty=quantity, side=side))

        with serve(handler, "127.0.0.1", 0) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            port = server.socket.getsockname()[1]
            session = Capture(mode="SIM", started_at=utc_now())
            with connect(f"ws://127.0.0.1:{port}", proxy=None) as socket:
                socket.send('{"method":"subscribe","params":{"snapshot":false}}')
                artifact = receive_session(socket, session, deadline=time.monotonic()+2)
            server.shutdown()
            thread.join(timeout=2)
        result = replay(artifact, now=utc_now())
        self.assertEqual(artifact["state"], "DISCONNECTED")
        self.assertTrue(result["comparison"]["equivalent"])
        self.assertEqual(result["comparison"]["matched"], 3)
        self.assertEqual(result["replay_results"][-1]["value"], "3")
        self.assertEqual(result["source_mode"], "SIM")


if __name__ == "__main__":
    unittest.main()
