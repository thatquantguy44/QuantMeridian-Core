# Trade-flow imbalance — tasks and pickup order

**Status:** Local experimental implementation started 2026-11-15 on
`feat/trade-flow-kraken-diagnostic`. Source protocol and companion inventory,
normalized trades, the provisional diagnostic, bounded capture/replay CLI and
SIM SOFR mean-level / far-minus-near curve research are built. Real capture is
blocked by unresolved rights and ownership. See
[validation](VALIDATION.md) and [handoff](HANDOFF.md).

| ID | Task | Completion evidence | Current checkpoint |
|---|---|---|---|
| TFI-T01 | Qualify Kraken spot as the first test source: inventory its public trades and book, rights, capture/retention terms, source clock, event IDs, ordering, recovery and known gaps; inspect EcoMedallion ownership/capability. | Reviewed source register, access/retention permissions and explicit known gaps; Kraken distinguished from SOFR futures. | Protocol and EcoMedallion inventory recorded in SOURCE_REGISTER.md; rights/retention and accountable ingestion ownership remain open. |
| TFI-T02 | Resolve the exact factor definitions, side rules, strip mapping, rolling-window endpoints and clock/session semantics. | Owner-reviewed decision record, mathematical contract, units and hand-worked examples. | Research D03 resolved in FORMULA_POLICY.md by user-directed integration; explicit SIM conventions built. Real provider mapping and production D02/D04–D07 remain open. |
| TFI-T03 | Define versioned normalized events and SIM fixtures, including identity, exact numeric representation, source timestamps, conditions and corrections. | Contract validation and malformed/ambiguous input tests; no unlabelled fabricated source. | Built for tfi-trade/1 and SIM protocol fixtures; strict exact numeric/time/identity validation. Quote and correction contracts remain future scope. |
| TFI-T04 | Implement a separately named signed-quantity diagnostic with explicit unknown-side treatment. | Hand-reconciled unit tests and missing-versus-zero / no-lookahead cases. | Built as classified_signed_qty/1; exact hand oracles, UNKNOWN/null handling, receipt-prefix windows and integer-reference equivalence. |
| TFI-T05 | Implement the approved shared kernel and historical/replay adapters. | Unit and independent reference equivalence; provisional/final and precision policy. | Built for SIM curve research: versioned common kernel, exact bounded contract sums, fixed-denominator means, missing/UNKNOWN handling, per-prefix comparison and hand/rational oracles. Observed-source adapters and finality remain unstarted. |
| TFI-T06 | Implement streaming ordering, watermark, late data/correction and recovery, with bounded state. | Replay equivalence on identical event prefix and cut; gaps, duplicates, ties, restart and backpressure tests. | Unstarted for production streaming, recovery and finality; bounded diagnostic stops on disconnect and never claims completeness. |
| TFI-T07 | Qualify an approved real historical sample and independently check expected facts. | Dated source/rights witness, coverage, exact query and comparisons; raw evidence retained only if permitted. | Blocked: no qualified real sample or retention authorization. |
| TFI-T08 | Implement bounded API and Markets view, event marker, comparison ledger and export. | Observable data mode/freshness/coverage, accessibility, responsive and browser/service tests; no synthetic fallback. | Unstarted; no API, route or chart added. |
| TFI-T09 | Qualify a licensed live feed and production operation. | Explicit approval; entitlement, observability, alerting, restart/backfill, security and latency/SLO evidence. | Unstarted; no production admission. |
| TFI-T10 | Integrate a bounded Kraken `BTC/USD` public live test, retain a real capture where permitted, and replay that same capture through the shared diagnostic. | Unit/contract tests and same-input batch/replay equivalence; provenance, `LIVE`/`REPLAY`, disconnects, gaps and unavailable states verified; no synthetic fallback. | Bounded adapter, artifacts, CLI and same-input replay built/tested with fictional loopback messages; real capture/qualification remains blocked. |

**Next pickup:** Resolve the real-source authorization/retention and ownership
record (TFI-T01), then execute a bounded real capture and independently reconcile
its facts (TFI-T10/TFI-T07). Separately qualify a SOFR futures source and effective
contract mapping, side/condition semantics, sessions/rolls, corrections and
finality before observed factor adapters (TFI-T02/TFI-T05/TFI-T06). The SIM curve
command implements the approved research formula now; the Kraken diagnostic
retains its separate name and units. See FORMULA_POLICY.md and the README.
