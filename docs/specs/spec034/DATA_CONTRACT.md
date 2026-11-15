# Trade-flow imbalance data contract

This contract is a design boundary, not an assertion that any provider, database
or stream exists. Exact physical schemas, source permissions and retention remain
to be approved. Null means unknown/unavailable, never an implicit numeric zero.
A fictional test fixture is unmistakably `SIM`; replaying observed history is
`REPLAY`, not a live feed. A live run uses only admitted, authorized observations.

## Input event envelope

| Field / concept | Requirement |
|---|---|
| Source and rights | Provider, dataset/feed, venue or consolidated scope, entitlement and redistribution terms; ingestion/run ID and raw payload reference where retention is permitted. |
| Instrument | Provider symbol and stable venue/contract identifier, asset class, currency, size/price units, expiry and point-in-time mapping version. An explicit effective-time mapping resolves reference legs; no guessing `SFR1`–`SFR10`, roll or cross-provider equivalence. |
| Identity | Event type and stable provider event ID, plus stream partition/channel, sequence and exchange/venue identifiers where supplied. Composite identities must be documented and collision-tested. If source identity or ordering is insufficient for reconciliation, mark ambiguity and do not claim exact parity. |
| Clocks | Exchange/source event timestamp in UTC with original offset/precision retained, source publication time if actually supplied, receipt/ingestion time and available sequence. A date is not an inferred instant; timestamps without offsets are rejected unless a documented source adapter resolves the zone. |
| Trade | Price and size with native scale and unit, trade/condition codes, venue, action and correction/cancellation reference; optional provider aggressor side and the source's documented meaning. Zero, negative, fractional and special-condition handling require source-specific policy rather than silent cleaning. |
| Quote | Bid/ask prices and sizes with scale and unit, quote condition and book/venue scope; sequence and timestamp. Quote-before-trade alignment, cross/locked/stale quotes and permissible feed latency are explicit policy decisions. A quote is not a trade. |
| State/quality | Schema/adapter version, data mode, observed coverage, raw/normalized hashes, completeness, integrity/sequence gaps, revisions, diagnostics and explicit nulls. Deduplicate only by the admitted provider's identity semantics; conflicting duplicates are surfaced. |

Do not assert a globally unique event sequence across feeds unless the provider
supports it. Capture ordering per partition, and define cross-partition event-time
ordering and tie handling. Where two distinct events share a timestamp, retain
both; if their causal ordering is unknown, label it ambiguous and apply the
approved policy rather than silently ordering by ingestion time.

## Derived classification and flow

Each classified trade includes the policy ID/version, side `BUY`, `SELL` or
`UNKNOWN`, source of side (`provider` or named deterministic classifier),
applicable quote identity/time where relevant, classifier confidence/status if
actually defined, and a reason for unknown/ambiguous side. Provider and inferred
sides remain distinguishable. Unknown-side quantity and counts are surfaced;
coverage thresholds and whether a partial output is usable are explicit policy.
No quote inferred after the trade's declared knowledge-time cut may be used.

A **candidate diagnostic**, not the screenshot's undefined factor signal, is
`classified_signed_qty = sum(buy size) - sum(sell size)` for a specified
instrument and window. E.g., fictional buy 5, sell 2 and unknown 3 contracts
have diagnostic +3 contracts, classified quantity 7 and unknown quantity 3.
Unknown is excluded from that diagnostic and remains visible. A window with no
classified trades is unavailable or explicitly policy-defined, not silently
represented as a complete zero. This example does not define `level_flow` or
`slope_flow`, normalization, window endpoints or a provider classifier.

## Versioned signal snapshot

A signal record must carry: signal name and definition/version; calculation and
classifier versions; source/mode/venue; instrument universe and mapping/weight
versions; request/run and parameter hashes; event identity and sequence;
`event_at`, `processed_at` and emitted/revision times; explicit window start and
end, timezone and endpoint inclusion; warm-up and event counts; classified and
unknown volume; missing/late/duplicate/correction diagnostics; status and reason;
value, units and numeric precision; event-time watermark/late policy; and links
or identifiers for retained input evidence where licensed. Named factor outputs
require a decision-approved formula and an actual signal version.

Use distinct `COMPLETE`, `PROVISIONAL`, `PARTIAL`, `UNAVAILABLE` and `ERROR`
states with machine-readable reason codes; define source freshness separately
from window completeness. A genuine numeric zero must have sufficient coverage
and a defined calculation. No invented observation, false publisher timestamp,
synthetic point or placeholder can be promoted under an observed-source label.
Historical revisions and finalized outputs must be distinguishable.

## Batch, live and replay equivalence

- Historical input must be selected by explicit event-time range, source,
  instrument mapping and data-as-known/revision cut. Live input is from the
  admitted streaming source; replay can preserve historical receipt timing or
  use a declared pacing multiplier. Pacing does not change event timestamps.
- Feed both adapters the same normalized event sequence through the shared signal
  kernel. The comparison basis specifies instrument, event/partition identity,
  revision, mapping, parameters, watermark and event-time cut; it explicitly
  decides whether the comparator checks provisional snapshots or final windows.
- Matching is at the finest stable admitted identity, not timestamp alone.
  Report matched, missing-on-either-side, duplicated, ambiguous and value-difference
  records. Compare window boundaries, states and lineage as well as numbers.
  A configured float tolerance (or exact decimal rule) must be documented before
  it is used; include maximum delta and count and do not equate unmatched rows.
- Late data, sequence gaps, correction/cancel messages and backfill can produce
  revised results. Define when a row is provisional/final, which prior revision
  it supersedes, and what qualifies completeness. Do not rewrite an earlier
  knowledge-time view with later corrections while calling it point-in-time.
- Never compare a replay with a different source snapshot, mapping, classifier,
  session convention, warm-up, factor weights or input cut as though it were
  an equivalent live run. Surface that incompatibility.

## Access and operating states

Sources are disabled until approved. Separate `NOT_CONFIGURED`, `NO_DATA`,
`STALE`, `GAP`, `PARTIAL`, `UNAUTHORIZED`, and `ERROR` from valid observed zero.
A replay/test environment must not impersonate live credentials or data. Capture
provider availability and entitlement independently of the last retained tick;
a recent local read does not establish current upstream availability. Persist
raw payloads only under approved retention/rights, restrict access to sensitive
metadata and never log secrets. Define retry/backpressure and bounded queue
behavior before a live connector is enabled.

## Implemented local trade subset

`models/trade_flow` implements `tfi-trade/1`, `tfi-capture/1` and `tfi-replay/1`
for the single-book experimental boundary in [DIAGNOSTIC_POLICY.md](DIAGNOSTIC_POLICY.md).
The frozen `Trade` dataclass is the normalized interface: version, venue, instrument,
per-book event ID, original event and receipt clocks, exact decimal-string quantity
and price, BUY/SELL/UNKNOWN side, explicit side reason, taker order type and source
mode. JSON token validation precedes construction. Generic quote, correction,
observed SOFR mapping and source contracts above remain proposed. The separate
SIM curve contract below implements our approved local research definition.

Captures bind raw message text/receipt clocks, original per-delivery stream
results, source and permission declarations, stopping state, retention and clock
evidence under a content hash. Read/replay revalidates bounds, clocks and scope
and reconstructs events from raw inputs. An observed end-clock discontinuity
produces `ERROR`, preserves `observed_ended_at` and the last valid receipt, and
leaves `ended_at` null; it does not invent an end time. Accepted prefixes can
still reconcile. This is an integrity contract, not origin authentication.

The diagnostic's processing/emission timestamps are explicitly null. No source
publication time, completed warm-up or final venue completeness is inferred.
Private artifact expiry is enforced at read; physical cleanup is the explicit
`prune` command. No scheduled deletion service or observed source admission exists.

## Implemented SIM curve contract

`tfi-curve-input/1` has exactly `schema_version`, `source_mode: SIM`, `mapping`
and `deliveries`; the checked-in example is
[sofr-curve-flow.sim.json](../../../contracts/trade_flow/sofr-curve-flow.sim.json).
Mapping contains `version`, `effective_from`, `effective_until` and `legs`.
Each leg has an explicit `SIM-SR3-*` instrument, offset-aware `reference_start`
and `NEAR`/`FAR` group. Neither labels nor reference dates authenticate exchange
contracts. Every trade has exactly `event_id`, `instrument`, positive integer
contract `quantity`, `side`, `event_at`, `received_at`. Unknown side is explicit
`UNKNOWN`; labels are fictional SIM classifications, not provider evidence.
No price field is needed by this trade-quantity formula; corrections and extra
fields reject. Input files cap at 8 MiB, 10,000 deliveries, 10 legs and 1e12
contracts per trade. Receipt clocks cannot move backwards or precede event time.

`sofr-curve-flow/1` snapshots carry `level_flow`, `slope_flow`, per-leg risk flow,
classified and unknown counts/quantities, missing legs, definition/units, fixed
weight conventions, policy/mapping/prefix hashes, cut/window, identity/cursor,
duplicate/late counts, status/reason, null processing/publication clocks,
revision zero and unverified warm-up/completeness. See
[FORMULA_POLICY.md](FORMULA_POLICY.md) for exact numerical rules and source limits.
`tfi-curve-run/1` adds the full input hash, last snapshot and every-prefix
batch/stream comparison ledger. Empty runs expose null last result and no parity
claim; complete numerical parity still does not establish qualified source data.
