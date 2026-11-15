# Bounded signed-quantity experiment

Version `kraken-btc-diagnostic/1`, implemented 2026-11-15 as a provisional local
research diagnostic. This is the explicit convention for the experiment, not
approval of the unresolved SOFR factor definitions or production policies.

- Name: `classified_signed_qty/1`. Unit: BTC. Venue: Kraken spot; instrument:
  `BTC/USD`. BUY is positive provider taker quantity; SELL is negative. Unknown
  side contributes neither sign and is reported separately by count and quantity.
- Every accepted message retains its original JSON text and one local UTC receipt
  time for the whole message. Numeric JSON tokens decode directly to Decimal;
  normalized quantities/prices are canonical decimal strings. Supported positive
  values are below 1e18 with at most 18 fractional digits. Arithmetic uses an
  isolated 80-digit context with inexact/rounded operations trapped. Source clocks
  preserve their original offset and up to nine fractional digits; unknown
  `-00:00` offsets and unsupported precision reject.
- Event identity is `(KRAKEN_SPOT, BTC/USD, trade_id)`, never timestamp. Preserve
  taker order type in the conflict fingerprint. Exact repeat deliveries change
  duplicate diagnostics but add no quantity; conflicting identities reject.
- A result uses only its received prefix. Its cut is the maximum provider event
  time observed in that prefix. The rolling window is `(cut - 300 seconds, cut]`.
  Distinct trades with equal clocks remain distinct; no causal order is inferred.
- Cuts never decrease. Late arrivals within the current window change future
  prefix outputs; older arrivals are retained in input lineage but excluded from
  the current window. Earlier outputs are immutable. There is no correction,
  backfill, cross-feed sequencing or final watermark implementation.
- No classified trades means `UNAVAILABLE` with null value. Classified buys and
  sells that net to zero produce numeric string `0`. Other numeric outputs remain
  `PROVISIONAL`; source completeness and warm-up are always `UNVERIFIED`. A
  maximum 60-second sample cannot establish a full five-minute window.
- The kernel caps a run at 10,000 deliveries. The first transport experiment is
  stricter: one connection, <=60 seconds plus bounded connection-close time,
  <=1,000 events, <=1,000 messages, <=1 MiB retained raw text, <=256 KiB per
  message, <=8 MiB artifact. Admit whole messages atomically. Oversized batches
  cannot leave raw events retained but omitted from the replay input. A five-second
  receive timeout marks `STALE`; this is an experiment timeout, not a market SLO.
- Subscribe only to public trade updates with `snapshot:false`; do not subscribe
  to heartbeat or book, place orders, use credentials, or reconnect automatically.
  A disconnect, malformed batch, limit or idle timeout preserves an explicitly
  incomplete accepted prefix. A missing provider result has no generated fallback.
- Batch and replay consume the same normalized delivery order and prefix cuts.
  The ledger checks identity/cursor, all economic/status fields, policy and input
  hashes. Pacing is not an input to arithmetic. Exact parity establishes only
  equivalence for that captured prefix; it does not prove venue completeness or
  authenticity. Hashes are integrity checks, not authentication.
- Replay speed is either 0 (immediate) or 1–1000, with at most 60 seconds of
  scheduled delay. A receipt-clock discontinuity stops admission atomically.
  Its artifact preserves the observed end clock and last valid receipt, marks
  `ERROR`, and leaves `ended_at` null rather than inventing a corrected time.
  The accepted prefix remains available for integrity/replay checks.
- Live capture needs a current, scoped permission record as described in
  [SOURCE_REGISTER.md](SOURCE_REGISTER.md). The checked-in record is `BLOCKED`.
  Local artifacts use exclusive creation and mode 0600. Retention is capped at
  24 hours and may be shorter under the permission record. Replay refuses expired
  artifacts. The explicit expiry cleanup command removes only expired recognized
  capture files in the specified local directory; no background service runs.

The separate SIM-only `level_flow` / `slope_flow` research definition is now in
[FORMULA_POLICY.md](FORMULA_POLICY.md). This BTC diagnostic is unchanged and
must not inherit its USD/bp units or maturity weights. Real SOFR mappings/rolls,
quote alignment, corrections, production operation and API/UI integration remain
open; neither experiment silently resolves those capabilities.
