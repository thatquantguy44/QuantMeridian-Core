# PORA Source-Inspection Preview

## Executive summary

PORA is an early portfolio and regime research workspace. Its initial capabilities are explicit review of retained SPY history, a bounded comparison of selected ETF return histories and session-only research snapshot export and replay. Portfolio optimization and statistical regime models are not implemented.

## Business problem

Portfolio research depends on knowing what a price series represents, when it was observed, and which source and revisions support it. An unlabelled price history can lead to misleading comparisons or backtests.

## How it works

The user chooses an SPY price basis and starts a source check. For the single-SPY view, the page uses the existing VIXR endpoint, validates the returned series and provenance, and displays coverage, descriptive changes and recent values. The separate multi-asset check reads one repeatable-read PostgreSQL transaction, matches selected ETF histories to the retained NYSE calendar, and reconciles close, dividend and split fields to retained Tiingo receipt payloads. Explicit snapshot capture repeats that check, freezes the inputs and evidence references, and hashes canonical content. It clears prior results on a failed check or basis change.

## Data and provenance

SPY close and corporate-action inputs come from retained Tiingo records through the warehouse. The observed-close basis excludes dividends. The total-return basis is derived from the close, dividend and split inputs and begins at an index value of 100. The VIXR source check reconciles retained records and requires receipt evidence; it is not a live provider check. The single-SPY view requires both SPY and VIX evidence. The multi-asset comparison checks SPY, AGG, ACWI and BIL without requiring VIX; it does not contact Tiingo live.

## Assumptions

Changes compare retained values without forecasting. The previous-observation change is not necessarily a one-calendar-day return. No investment mandate, model parameters, cash rate, costs or portfolio allocation are assumed.

## Outputs and how to read them

The coverage panel shows the first and last observation dates, count and latest value. The chart shows up to 260 observations and breaks at gaps over five calendar days. The CSV includes the full returned history, selected basis, provider, methodology and check and ingestion timestamps. Snapshot JSON includes the selected observations, source evidence, receipt fingerprints, session dates and capture metadata; raw receipt payloads are excluded. Imported snapshots can be checked and replayed locally but are labeled as having unverified origin.

## Validation

Focused tests cover malformed or simulated responses, inconsistent dates and evidence, failed refresh, basis changes and CSV safety. A read-only check against the local warehouse verified both available SPY bases. Results are descriptive; no portfolio optimization has been validated.

## Limitations

The history is current vintage, not a point-in-time archive. Evidence reconciliation does not prove the original publication time or current provider availability. The multi-asset comparison is restricted to four explicitly selected ETF candidates and a fixed 253-session inspection window. Research snapshots are session-only until exported and are not admitted to a model. A content hash is not a signature, and imported files do not recheck receipt payloads or source authenticity. The preview does not verify historical membership, currency metadata or source-use rights.

## Status and governance

The Python model remains a packaging scaffold and the separate API is health-only. Numerical methods, model binding, data admission and deployment remain open. No model output or allocation is implied by the preview.

## References

- [PORA help](/guides/PORA/help)
- [Tiingo end-of-day documentation](https://www.tiingo.com/documentation/end-of-day)
