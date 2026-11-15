# Trade-flow local validation — 2026-11-15

This evidence covers the bounded provisional diagnostic/protocol experiment and
the SIM-only SOFR curve research kernel. It does not establish admitted sources,
real-feed completeness, observed SOFR correctness or production readiness.

## SOFR formula integration

After the user requested integration of the source-backed research proposal,
`sofr-curve-flow/1` and the `curve` CLI were built using the explicit conventions
in [FORMULA_POLICY.md](FORMULA_POLICY.md). **48 package tests pass**, including
the existing fictional loopback WebSocket test and 13 new curve/CLI cases.
New behavior used fail-then-pass checks before implementation.

- Hand oracle: per-expiry signed contracts `3, 1, -2, 4` give level `37.5`
  and FAR-minus-NEAR slope `-25` USD/bp. Four batch/stream prefixes match.
- A seeded independent Fraction/integer reference checks all 80 received
  prefixes, including irregular event times and UNKNOWN sides. Tests cover
  common cuts, open-start/closed-end windows, late trades and immutable earlier
  outputs; missing/UNKNOWN-only legs versus balanced zero; duplicate/conflicting
  identities; receipt rollback; invalid mappings; and caller Decimal precision.
- A six-leg case detects rounding group means before subtraction: slope is
  `8.333333333333`, not `8.333333333334`. Mapping-boundary windows are unavailable.
- CLI rejects observed modes, malformed/extra fields, excessive delivery counts,
  and unsupported contracts. Empty/missing-leg runs return nonzero without a
  numerical zero fallback. The checked-in fixture is clearly fictional SIM.
- A bounded maximum-size probe processes 10,000 deliveries of 1e12 contracts,
  gives exact level `62500000000000000` and zero slope, and rejects delivery
  10,001. Local measured kernel time was 0.148 seconds; this is a fictional
  local arithmetic probe, not a licensed-feed performance SLO.
- A fresh dependency-free wheel builds/installs offline and its installed
  `trade-flow curve` entry point reproduces the hand oracle and all four matched
  prefixes. Skill pin check passes, unchanged at 188 paths / 24 skills.

Fresh-context adversarial review identified quantity bounds, duplicate receipt
semantics, exact mapping-window containment and quadratic timestamp rescanning.
These were actionable and addressed in the contract, validation, and a timestamp
heap with per-leg running totals. The final review found no substantive issues.
Its loopback test was sandbox-blocked; the orchestrator's authorized loopback
run passed all 48 tests. The prior choice to skip a second model was preserved.
Terminal JavaScript code and dependencies are unchanged; the earlier terminal
checks below were not repeated for this independent Python/docs/fixture change.

## Initial Kraken diagnostic checkpoint

At the earlier diagnostic checkpoint, `npm run test:trade-flow` passed **35 tests**, including the optional pinned
transport. Implementation slices and reviewer regressions used fail-then-pass checks. All protocol/event inputs are fictional and explicitly SIM.

- Exact JSON numeric tokens; canonical decimal strings; original RFC3339 clocks
  and nanoseconds; side/identity/order-type provenance; malformed types, duplicate
  keys, non-finite/extreme values, Unicode and unsupported snapshots reject.
- Hand oracle: buy 5, sell 2, UNKNOWN 3 gives signed +3 BTC, classified 7 and
  unknown 3. No classified trades returns null; a classified net zero is `0`.
- A seeded 100-event independent integer oracle checks every received prefix,
  including out-of-order events, open-start/closed-end windows and equal clocks.
  Decimal results remain exact under a deliberately changed caller precision.
- Duplicate deliveries add no quantity; conflicting quantities or taker order
  types reject. Late inputs cannot move the cut backwards or revise old outputs.
- Whole-message event/byte bounds and invalid batches are atomic. Rebuilt batch,
  recorded stream and replay prefixes reconcile. The ledger identifies missing,
  duplicate and changed rows; tampered hashes reject, and rehashed changed outputs
  produce a numerical/metadata mismatch rather than a false match.
- 4x receipt pacing preserves arithmetic, source clocks and input hashes.
  Arbitrarily small rates and replay delays over 60 seconds reject before sleep.
- The one-session connector has explicit failed-subscription, maintenance,
  disconnect, idle, limit and unavailable states. A watchdog interrupts blocked
  subscription send. Clock discontinuity retains the accepted prefix with honest
  clock evidence and a null qualified end instant; its replay remains possible.
- Permission failure/expiry is checked before connector import or networking.
  Artifact expiry is enforced; private files use 0600 and exclusive creation.
  Explicit cleanup deletes expired recognized captures and preserves unrelated
  files. Ordinary import/replay does not authenticate provider origin.

The integration test uses a real WebSocket server/client on an ephemeral
`127.0.0.1` port with invented messages. Three accepted trades reconcile exactly,
and deliberate connection close stays `DISCONNECTED`. It does **not** contact
Kraken or establish provider TLS, entitlements, timestamps or market facts.

## Package and terminal integration

- A dependency-free model wheel builds with `pip wheel --no-deps
  --no-build-isolation`, installs with `--no-index --no-deps` into a fresh virtual
  environment, and runs the installed `trade-flow demo` and `trade-flow replay`.
  The installed package passes the same 35 cases with two optional transport
  cases skipped because `websockets` is absent; the normal environment passes
  all 35 with `websockets==16.1.1`.
- Terminal typecheck and client/server production builds pass. Existing large
  bundle, mixed static/dynamic import and eval warnings remain unrelated.
- Immutable Agent Skills pin passes at `f63ec56a3cc9`, 188 paths / 24 skills.
- The initial full terminal test run passed 2,211 cases and failed five existing
  local-server tests with `listen EPERM` under the sandbox. The qualified rerun
  with loopback permission passed **2,216 tests**, 11 skipped, across 228 passing
  files and three skipped files. CI's documented ignored SQZ synthetic-fixture
  generation was run first. No terminal source files changed.

## Independent review reconciliation

Fresh-context source review produced SOURCE_REGISTER.md. Independent adversarial
design/code reviews found actionable issues: Decimal context dependence, empty
window semantics, backward cuts, generic rights acknowledgements, atomic batch
limits, malformed-type exception leaks, dropped order-type conflicts, unbounded
subscription send, receipt rollback and slow replay pacing. Each was reconciled
against the contract and addressed in the diagnostic, admission gate, artifact
validation, transport watchdog or tests. The final independent review found no remaining substantive blockers in the
clock and pacing remedies; its regression tests and additional no-network probes
passed. Single-model review was used. The owner explicitly declined the optional
cross-model review on 2026-11-15; no external review CLI was invoked.

## Unqualified / unbuilt

No real capture, historical sample, Kraken connectivity probe, real-trade oracle,
venue-wide completeness, source consent or retention grant is claimed. No database
was accessed. No quote classifier, correction/backfill/reconnection engine,
observed SOFR roll/mapping or factor adapters, terminal UI/API or production
deployment exists. The SIM research formula kernel above is implemented;
accountable source/retention ownership and production source-specific decisions
remain open. See TASKS.md. The checked-in permission record remains `BLOCKED`.
