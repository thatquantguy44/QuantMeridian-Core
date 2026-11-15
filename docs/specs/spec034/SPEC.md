# Spec 034 — Trade-flow imbalance data and signal

**Status:** Local research formulas approved for integration on 2026-11-15;
SIM-only SOFR curve kernel, provisional Kraken diagnostic and bounded
capture/replay CLI built. Real-source admission, SOFR provider mapping and
production operation remain open. See [formula policy](FORMULA_POLICY.md) and
[handoff](HANDOFF.md).

**Date:** 2026-11-14.

**Placement:** Markets research capability; module mnemonic and route TBD.

## Outcome

Let a researcher inspect signed aggressive trading flow through time and compare
historical research with a streaming implementation of the *same* signal. The
screenshot's illustrative five-minute view of the SOFR strip, with series labeled
`level_flow` and `slope_flow`, is the intended research direction. First test
the integration with Kraken spot data; support other approved instruments and
definitions without silently changing the meaning of a series.
A shared signal function must be callable by both batch and streaming adapters.
The displayed historical and streaming outputs must have inspectable input
lineage, units, timestamps, parameter versions, coverage and data status.

The supplied image is a **design reference**, not evidence that its code,
SOFR ticks, exchange entitlement, chart points or April 29, 2026 event data are
present here. It depicts a 5-minute window, two flow series, a reference event
marker and a historical/streaming tick comparison; it describes a streaming
run replaying recorded ticks at 4× speed. Such a replay is labeled **REPLAY**,
not live market data. The image does not specify the two formulas, aggressor
classification, leg weights, quote alignment, units, clock or source. Those
are not facts inferred from the chart. Our separately sourced research definition
is recorded in [FORMULA_POLICY.md](FORMULA_POLICY.md); remaining decisions are in
[DECISIONS.md](DECISIONS.md). `SFR1`–`SFR10` are reference labels until mapped to a licensed provider's
actual point-in-time contract identifiers; no continuous-contract mapping or
roll convention is implied.

## First source for testing: Kraken

Use Kraken's production public spot WebSocket as the first source to test and
integrate, initially for `BTC/USD` where available. Its public
[trade channel](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/trade)
provides price, quantity, timestamp, per-book trade ID and the taker-order side;
its [book channel](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/book)
provides order-book snapshots and updates. The
[public endpoint](https://docs.kraken.com/exchange/guides/websockets/introduction)
does not require private API authentication. Confirm access, applicable usage
and retention terms, source semantics, and availability before capturing data.

This is real Kraken crypto spot data, not SOFR futures or a SOFR-strip proxy.
Record exchange, instrument, native units, provider event time, local receipt
time and data quality. Label current observations `LIVE`; label a replay of a
retained real capture `REPLAY`, including at accelerated playback speed. Such a
replay is not synthetic, but must never be presented as live. A missing, stale
or disconnected feed must be explicit and must not trigger generated data.
Compare batch and replay using the same captured events and declared cut; do
not claim a complete capture or exact quote/trade ordering without evidence.
The Kraken test does not define or validate the SOFR factor formulas or mappings.

## Requirements

| ID | Requirement |
|---|---|
| TFI-001 | Register a dataset/source inventory and rights for trade and quote feeds, instrument coverage, venue, native units, retention, historical depth, corrections, entitlements, clock and redistribution. An owner-approved source is required before real data admission. Do not treat a chart, socket URL or daily FRED series as a tick source. |
| TFI-002 | Normalize observed trade and quote events with stable instrument and event identities, event/receipt times, ordering, units and provenance. Retain raw evidence subject to source rights, schema version and ingestion lineage. Preserve corrections and cancellations. See [DATA_CONTRACT.md](DATA_CONTRACT.md). |
| TFI-003 | Version the aggressor-side policy. Admit an authoritative provider side only when its meaning and coverage are documented, or use a separately reviewed deterministic quote/trade classifier. Unclassified, missing or ambiguous trades remain unknown; publish counts, volume and coverage. Never infer actual counterparty identity or intent. |
| TFI-004 | Define the exact `level_flow` and `slope_flow` formulas, sign, scaling, units, leg composition/weights, missing-leg behavior, rounding, window boundaries and warm-up before calling an output that name. Until then, mark those outputs **not defined**, not zero or a substitute metric. |
| TFI-005 | Implement one versioned, deterministic event-time signal kernel for batch, replay and streaming. Adapters may differ in transport, never in signal arithmetic, side policy or instrument mapping. Compute from eligible events available at the declared event-time cut; disclose quote matching and any knowledge-time/revision policy. |
| TFI-006 | Expose five-minute rolling results and individual change/tick outputs only after their window and warm-up conventions are decided. Every output carries event time, processing/publication time, event identity, window bounds, status, input/mapping/policy versions and completeness. Do not label an incomplete or provisional window as final. |
| TFI-007 | Reconcile historical and streaming results at matched event identity and revision under the same admitted input, policy, mapping and event-time cut. Report matched rows, numerical deltas, missing/extra/duplicate rows and provisional/final status; a missing counterpart is not a zero. Timestamp alone is not a unique key. |
| TFI-008 | Handle disconnects, backfills, duplicate messages, out-of-order arrivals, corrections, cancellations, sequence gaps and restarts with explicit, versioned policies. Declare event-time watermark, late-event allowance, revision/supersession and recovery behavior; never assert historical parity while coverage is unverified. |
| TFI-009 | Distinguish `LIVE`, `HISTORICAL`, `REPLAY`, `SIM` and unavailable/error states, with provider, venue, as-of and freshness. Fictional fixtures are explicitly SIM and cannot silently appear as observed or live data. A failed/stale feed cannot silently fall back to generated ticks, a cached result presented as current, or zero. |
| TFI-010 | Provide a readable timeline for both series, an optional explicitly sourced event marker, and an inspectable comparison ledger/export with both values, deltas, match state, window metadata and source status. Plot provisional, missing and non-comparable points distinctly. Responsive and keyboard-accessible views are required. |
| TFI-011 | Bound input ranges, message sizes, per-partition state, replay rate, query result size and output retention; validate timestamp precision, finite numerics, permissions, credentials and license constraints. Surface lag, gaps, input coverage and error diagnostics without leaking secrets or raw licensed data. |
| TFI-012 | Ship testable slices with unit, contract and batch/stream/replay equivalence tests, hand-reconciled cases, adversarial ordering/failure fixtures and real browser/service integration where applicable. Source qualification and independent expected facts are prerequisites for a real-data claim. |

## Meaning and scope

- **Aggressive flow** is a signed, classified trade quantity under the selected
  policy; the classification is derived unless the admitted provider supplies a
  qualified aggressor field. It is not order-book depth, net buying by investor,
  net positions, money flow, or a trading recommendation.
- Research definition `sofr-curve-flow/1` uses mean signed SR3 contract BPV
  across explicit expiries for `level_flow`, and far-expiry mean minus near-expiry
  mean for `slope_flow`. See the formula policy for signs, fixed denominators,
  missing legs, precision and the SIM-only implementation boundary. The image
  does not prescribe this definition; no screenshot replication is claimed.
- Event annotations such as FOMC statements need a separately qualified calendar
  source, event label, effective time and provenance. The image's marker is an
  example, not an admitted event record.
- The first slice is a data/definition and fixture contract, followed by a
  bounded research kernel and replay verification. A real-time service, warehouse
  write, paid feed or automated decision is not authorized by this draft.
- Outputs may be consumed by Markets and, after separate admission, downstream
  analytics; they must not execute trades or trigger autonomous decisions.

## Acceptance

1. A reviewer can reproduce each reported signal from a versioned input slice,
   classifier, instrument mapping, window definition and formula, or sees an
   explicit unavailable/partial reason. No unapproved formula gets the names
   `level_flow` or `slope_flow`.
2. A hand-checked fixture demonstrates signed flow, unknown-side handling,
   equal timestamps, multiple contracts and declared window boundaries. A batch
   run and a streaming replay over the **same event prefix and event-time cut**
   agree under a declared precision rule, with differences individually listed.
3. Duplicate, missing, late, reordered and corrected events cannot silently
   disappear or double count; their policy, sequence gaps and impact are visible.
   Compare provisional results only to the same provisional cut and final results
   only after the selected watermark/completeness condition is met.
4. Stale or unavailable real inputs show the provider/venue, last observed and
   capture times, staleness and error; no SIM or fabricated fallback is promoted.
   Test SIM-on and SIM-off independently, including failed connections.
5. UI, export and API/ledger identities reconcile; matched, unmatched and
   ambiguous events, sample counts, units and provenance are inspectable. At
   least one separately qualified real tick sample with independently checked
   expected facts is needed before a real-data equivalence claim.

See [plan](PLAN.md), [data contract](DATA_CONTRACT.md), [tasks](TASKS.md),
and [open decisions](DECISIONS.md).
