# FXR-S02: pair history and observed changes

**Completed:** 2026-10-31. **PR:** [#200](https://github.com/thatquantguy44/QuantMeridian/pull/200), extending the S01 snapshot slice in the same PR.
**Policy:** the owner approved [HISTORY_POLICY.md](HISTORY_POLICY.md), including the 90-date window, 1/5/21 interval methods, gap/stale behavior and shared retention budget. Do not ask these choices again.

## Delivered path

The Pair history tab now reads the existing three ECB Gold legs and their catalog metadata in one consistent, uncached SQL statement. It preserves S01's actual latest-row guards before selecting the common maximum qualified date. The result contains the most recent 90 TARGET operating dates ending at that date, or explicitly truncated coverage at the reviewed 2026 calendar boundary. Unsupported current freshness coverage still blocks admission; truncation does not waive it.

The four pairs remain EUR/USD, USD/EUR, USD/JPY and GBP/USD. Each date is independently qualified using same-date source legs; missing/invalid/conflicting observations break the chart and remain unavailable in the table. Direct, inverse and cross directions are identified. Simple percentage changes use `100 × (qEnd/qStart − 1)` over 1, 5 and 21 observed intervals, requiring 2, 6 and 22 consecutive qualified observations. Actual endpoint dates, elapsed calendar days and observation counts accompany the figures. Inverse changes are recomputed from inverted endpoints.

A stale endpoint suppresses current change figures while leaving dated history visible. Insufficient leading source history, an interior gap, a present invalid observation and a blocked current endpoint have distinct reasons. A historical conflict cluster blocks affected date/pair results while preserving unrelated pair outcomes. Original source rows are retained; the daily validator only needs two distinct rows per leg to prove conflict. The latest-guard cap remains 32 rows, total history capture is capped at 320 projected rows, SQL requests one extra row to detect overflow, and stored artifacts remain capped at 1 MiB.

The responsive view includes a calendar-spaced chart, keyboard-accessible scrollable table, change cards, coverage counts and expandable source evidence. Evidence resolves to original source direction/level/date, revision identity, read clocks and recorded ingestion metadata. Original receipt/first Gold availability remain unknown. Empty captures show their actual admission/calendar reasons. The Verify history replay action verifies retained history and updates verification status; it never replaces current metric eligibility with a historical assessment.

## History contract and replay

The separate `fx-reference-history/1` artifact is `CURRENT_VINTAGE` / `DESCRIPTIVE_HISTORY`, permits research only and denies export. It is not a current conversion-rate contract. `src/lib/fx/historyContracts.ts` defines the public shape. History IDs have prefix `fx-reference-history/1:sha256:` and hash the canonical full manifest excluding its own identity field.

The manifest retains exact projected/typed source rows, latest guards, capture clocks, all expected-date outcomes, source-leg evidence and immutable source/history/method/calendar definitions. Replay verifies the digest and recomputes the recorded result using the supported recorded definitions; it never rereads today's Gold. S01 v1 level manifests and their identities remain supported unchanged.

Level and history manifests share one configured local directory, writer protocol and 500-artifact / 30-day budget. Publication is durable and atomic. Expired/corrupt/unsupported/missing replay fails explicitly. Orphaned unpublished staging files are removed only under an exclusive writer claim. Expired replay is denied immediately; physical expiry cleanup runs on access/startup and minutely while the application runs, resuming after a stopped application restarts.

The immutable capture assessment is separate from access-time current pairs. Both level and history replay now assess current freshness with a fresh clock after awaited verification and recheck expiry at completion. Original captured figures are never mutated by that later assessment. All replay responses explicitly deny current consumption permission.

## API and local operation

Use the S01 local configuration/run command in [IMPLEMENTATION.md](IMPLEMENTATION.md); no new flag, source, service, dependency or database migration was added. Local socket/origin/production gates apply to both endpoints:

- GET `/api/fx/research/history` captures the fixed universe/window; caller source/date/window/purpose overrides are rejected. Partial coverage has four explicit pair results. Source/retention failure returns 503 and no newly admitted history/current figures; verified retained history may be shown separately with original identity/cutoff/evidence.
- GET `/api/fx/research/histories/{encoded historyId}` returns verified historical replay plus a separate current assessment and next calendar check. Encode the complete ID as one path segment. Bad ID is 400; absent/expired replay is 404; corrupted or unsupported retained version is 409. Responses are no-store.

History is fetched only while its tab is mounted. Pair changes reuse the same four-pair capture. Deadline, focus/visibility and manual refresh rechecks clear current figures while checking; a response that expired in transit cannot restore eligibility. An aborted replay verification can be retried even when a failed refresh restores the same retained identity.

## Verification

From a fresh checkout, seed the existing ignored SQZ fixtures before the serial full suite. This is test setup, not a change to SQZ behavior:

```bash
npm run generate:squeeze-csv
npm test -- --reporter=dot --no-file-parallelism
npm run typecheck
npm run build
npm run check:gold-policy
npm run check:agent-skills-pin
npx playwright test test/fx-history.spec.ts test/fx-research.spec.ts test/fx-scaffold.spec.ts --retries=0 --workers=1
```

Independent reviews covered the history policy, core/SQL/shared retention and integration/UI. Corrections have reproductions for historical conflict clusters, invalid leading observations, replay crossing a release deadline, empty admission reasons, source-record inspection and aborted replay verification. Additional cross-model review was skipped per the owner's existing preference.

Validation passed: 1,466 tests across 139 files, all 21 browser flows, typecheck, client/server build, Gold policy and the immutable skills pin. The four scaffold flows also passed with FX disabled and no Gold connection configured.

The Gold smoke check used a read-only local macro_medallion source: 90 qualified dates per pair, 270 source-leg records and all three interval changes per pair, dated 2026-10-30. Both level and history retained payloads matched exactly after restarting the isolated local server; replay responses denied current consumption permission. The actual browser rendered the history, source evidence and verified replay without page errors or horizontal overflow. Temporary responses/screenshots, environment links and generated fixtures are untracked.

Verification was isolated from concurrent unrelated Presidential Impact work in the shared checkout. Those changes are excluded from this PR. Existing bundle/eval warnings, SQZ generated-fixture setup and parallel fixture contention remain separate maintenance concerns. No QuantSmith reuse or historical point-in-time certification is claimed.

## Next scoped research work

FXR-S03 should begin by reviewing descriptive volatility policy: window, log-return convention, annualization, minimum coverage and gap behavior. The broader spec's proposed 21-return / √252 convention is not adopted by S02. Deterministic briefs, broader currencies, interest-rate context, exports and exposure/hedge calculations remain separate approved-scope decisions.
