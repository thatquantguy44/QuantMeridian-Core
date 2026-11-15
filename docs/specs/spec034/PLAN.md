# Trade-flow imbalance — implementation plan

## Architecture proposal

A source-specific adapter emits a versioned normalized trade/quote stream, with
separate batch and streaming/replay readers. Both hand ordered, qualified input
into one deterministic signal kernel and the same classifier, mapping and
window policy. The kernel produces versioned snapshots; a comparator validates
same-input, same-cut batch/stream results; a bounded API and Markets view show
the source state, charts and comparison ledger. Storage and transport are
selected only after the provider and operational constraints are known.
`TicksPipeline`, `TicksLivePipeline`, `run_signal` and ZeroMQ shown in the image
are illustrative names; they are not asserted dependencies or existing code.

```
Licensed raw trades + quotes
         │
  source adapters → normalized events + lineage
         │                         │
   batch reader               stream / replay reader
         └──────── shared classifier + signal kernel ────────┘
                            │
               versioned snapshots + parity ledger
                            │
                  bounded API / Markets view
```

The logical layers may live in different repositories. Identify EcoMedallion's
actual capabilities and ownership before assigning ingestion, normalization or
warehouse write responsibility; do not assume its existing daily macro tables
contain licensed intraday trade and quote ticks. QuantMeridian is the consuming
application unless an approved architecture says otherwise. Select a runtime,
transport, storage and symbol service from measured needs and source rights,
not from the screenshot alone.

## Ordered slices

1. **Definition and source qualification.** Select Kraken spot as the first
   test integration and verify public-feed access, terms and event semantics.
   Resolve or document the formula,
   aggressor, symbol, quote alignment and window decisions; inventory candidate
   source capabilities, rights, available historical dates, sequence, calendar,
   corrections and live entitlement. Produce reviewed contracts and independent
   expected facts for a bounded sample. This plan does not assert that a feed
   has already been connected or qualified.
2. **Bounded normalization and named diagnostic.** Add validated normalized
   events and explicitly SIM fixtures, unknown-side treatment, ordering and
   corrections. Build a small versioned signed-quantity diagnostic with exact
   hand calculations and tests; it is separate from the SOFR curve definition.
3. **Kraken capture and diagnostic replay.** Implement a bounded Kraken live
   adapter and capture a sample subject to verified terms. Compare batch and
   streaming replay of the same events using the separately named diagnostic;
   reconcile expected facts and record source, hashes, coverage and limitations.
4. **Shared factor kernel and SOFR qualification.** The approved local research
   formula is built as `sofr-curve-flow/1` with explicit SIM mapping, missing-leg
   rules and same-prefix batch/stream comparison. Before observed data, resolve
   provider-specific D02/D04–D07, watermark/revisions, sessions, rolls and recovery.
   Exercise irregular timestamps and restarts. Qualify a separate SOFR futures source
   and sample when available; record rights, evidence and limitations. Do not
   retain raw licensed data without approval.
5. **Workspace and production readiness.** Add source-backed timeline, per-tick
   evidence and exports. Evaluate live connectivity, lag, restart/backfill,
   observability, permissions and deployment against approved SLOs; leave live
   mode disabled if the source or operational gates fail.

## Testing and delivery gates

At each slice, test the numerical rule and wire contract separately, then test
adapter/kernel equivalence using the same event IDs and cut. Fixtures must cover
trade/quote ties, unclassified sides, empty/partial windows, warm-up, price and
size precision, multiple legs, missing legs, crossing session/roll boundaries,
late/out-of-order trades and quotes, duplicate/conflicting IDs, cancellation,
corrections and replay restart. Verify missing-versus-zero and LIVE/REPLAY/SIM
labels, no lookahead, stable versioned hashes, and no use of an unapproved feed.

The UI/API stage adds transport and authorization tests, observable source and
failure states, accessibility and browser-through-service checks. Benchmark
throughput, memory and end-to-end lag on representative **licensed** traffic;
SLOs are proposals until provider limits and user needs are agreed. Cross-run
comparison is only valid under compatible definitions and input coverage.
Record actual results in a future VALIDATION.md; this plan records no tests or
source admission as complete.

## Local checkpoint — 2026-11-15

The bounded trade-only experiment is implemented in `models/trade_flow` with a
repository launcher and npm test command. See [validation](VALIDATION.md) for
actual results and [handoff](HANDOFF.md) for pickup. Source inventory is recorded;
rights/retention/ownership and production source decisions remain open. The
user approved integration of the source-backed research factor proposal;
[FORMULA_POLICY.md](FORMULA_POLICY.md) defines its built SIM-only shared kernel.
The CLI curve fixture and fictional Kraken diagnostic/replay are runnable now.
Real capture and real SOFR admission remain gated. No API/UI or warehouse
integration was added.
