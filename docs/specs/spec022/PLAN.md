# First FX research snapshot slice

**Approved scope:** owner approved ADMISSION_POLICY.md on 2026-10-30 and directed continuation through this complete slice. This approval covers the narrow adapter/replay/overview path, not all of spec022/spec023. Proceed through the tasks below without repeating the policy question.

1. Implement shared explicit snapshot types and pure calendar/admission rules. Prove direct/inverse/cross hand cases, invalid/latest evidence, partial coverage, deadline/DST and unknown clocks first.
2. Read the three allowlisted Gold legs and catalog metadata in one bounded SQL statement through GoldStore.raw (uncached). Support local PostgreSQL/SQLite statement consistency; block unqualified backends. Freeze exact projected inputs and policy contents in bounded immutable local storage; verify replay by digest and deterministic recomputation.
3. Add GET `/api/fx/research/snapshot` for current capture and GET `/api/fx/research/snapshots/[id]` for explicit historical replay. Reject caller parameters and unknown IDs. Require `FX_RESEARCH_LOCAL_ENABLED=1`, a writable persistent `.data/` directory and a non-production local runtime. Return explicit four-pair failure outcomes, no secrets/stack traces. Historical replay never grants current consumption permission.
4. Connect Research overview/evidence and a refresh action; preserve pair navigation, deferred tabs and the untouched exposure shell. Show dated stale/retained evidence separately from current reference levels. Reassess at the next calendar deadline, on focus and refresh; no perpetual eligible cached display.
5. Run focused tests, serial full suite, typecheck/build, policy/pin checks, responsive real-browser flows and a read-only local Gold smoke capture/replay. Independent review and reconciliation precede completion. Update handoff with the next scoped work; commit/push and open a PR.

Threat boundaries: allowlisted warehouse projections only; no query/body/URL controls over series, dates, purposes or filesystem paths. Local artifact IDs are strict hashes, files size-bounded, publication atomic and retention serialized/locked. Immutable snapshots retain original states; current assessment can deny access or show stale without rewriting them. Exports, external acquisition, private inputs and operational deployment remain outside this slice.

## FXR-S02 extension in the same PR

The owner approved HISTORY_POLICY.md and requested completing policy, reader and Pair history in PR #200. Completed in order: hand-oracle/gap/chart tests; bounded latest-guard plus 90-date Gold reader; typed immutable history and shared retention/replay; guarded history API; chart/table/change cards and source-record/replay inspection; independent review and full verification. See [HISTORY_IMPLEMENTATION.md](HISTORY_IMPLEMENTATION.md). No further approval of those bounded choices is pending; broader volatility/brief/exposure defaults remain draft.

## FXR-S03 selectable-window volatility

The owner directed delivery on `feat/fxr-volatility` after selecting 5/21/63/126/252-return windows and optional annualization. Completed increments: independent sample-log arithmetic/state tests; versioned 253-level Gold capture and 2025 historical calendar evidence; shared bounded retention and replay; local API gates; responsive controls/comparison/source evidence; independent core/integration review; full local verification and Gold restart/replay. See [VOLATILITY_IMPLEMENTATION.md](VOLATILITY_IMPLEMENTATION.md). Next is deterministic research-brief policy review; rolling volatility history, broader source/universe and exports remain separate scope.
