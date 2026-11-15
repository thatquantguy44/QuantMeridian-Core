# FXR-S03: delivered descriptive volatility

**Date:** 2026-10-31. **Branch:** `feat/fxr-volatility`, following merged PR #200.
**Review PR:** [#201](https://github.com/thatquantguy44/QuantMeridian/pull/201).
**Policy:** [VOLATILITY_POLICY.md](VOLATILITY_POLICY.md). The owner selected five
windows and annualization choice, then directed the complete delivery slice.

## User path and calculation

Open `/fx/research` and choose **Volatility**. Select 5, 21, 63, 126 or 252
observed returns and toggle **Annualize**. The default is 21 returns, annualized.
The comparison table uses the same mode for all windows. Pair/window/scaling
changes reuse the captured four-pair universe; they do not reread Gold.

For N returns, require N+1 consecutive qualified daily levels. Daily returns are
`ln(q[i]) − ln(q[i−1])`; mean-centered sample standard deviation uses N−1.
Annualized dispersion multiplies the daily estimate by √252. Calculations use
unrounded decimal values, stable variance accumulation and log differences.
Non-annualized means daily dispersion estimated over the selected window,
not dispersion of the cumulative N-interval move. This is not a forecast.

Gaps/invalid/conflicting observations never get filled, bridged or dropped. A
long window can be unavailable while a shorter complete window works. Counts,
actual first/last level dates and return intervals, elapsed calendar span,
estimator/scaling and reasons are inspectable. Stale endpoints suppress current
figures. Refresh/focus/deadline transitions clear current figures while checking;
expired in-flight responses cannot restore them. Source failure may retain
verified dated points, with every current estimate blocked.

## Capture and replay

`fx-reference-volatility/1` is a separate SHA-256 artifact with a 253-date schedule,
all five daily/annualized estimates, date outcomes, exact projected source rows,
recorded clocks and full method/source/calendar definitions. It uses the same
three ECB Gold legs and four pairs as S01/S02. One bounded, uncached, consistent
statement reads allowlisted data and catalog metadata, preserving actual latest
row guards before window filtering. No warehouse writes or external acquisition.

The 2025 historical TARGET extension is a separate recorded policy. The ECB's
[2025 tender calendar](https://www.ecb.europa.eu/mopo/implement/omo/shared/pdf/ecb.omocc240725.en.pdf?14e414620fdca3a3d2ca87c9a313a034=)
identifies the 18/21 April Easter closures. Current endpoint admission retains
S01's 2026–2028 freshness policy. The historical qualification definition is an
additive registry entry; old policy contents and default selection stay unchanged.

The cap is 1,024 projected rows, including 759 nominal date/leg rows and latest
rows/duplicate allowance; the latest-guard cap remains 32. SQL requests one extra
row to detect overflow. All artifact kinds share the existing 500-artifact /
30-day writer/expiry protocol and 1 MiB per-artifact limit. Overflow fails
explicitly. Compact per-leg evidence stores original value/direction/date,
revision and ingestion identity; repeated capture clocks are stored once in the
artifact header, with full original projections retained in `inputs.rows`.

Replay verifies the whole digest and recomputes the recorded definitions from
retained inputs, without rereading mutable Gold. Captured results remain immutable;
current freshness is assessed separately after awaited retrieval, with a fresh
clock and expiry check. Replay never grants current consumption permission.
Original publication/receipt/first Gold availability remain null. Research only;
FX exports, reporting conversion and hedging remain denied.

## Local API and operation

Use the flags and local persistent directory from the [S01 runbook](IMPLEMENTATION.md).
All endpoints require the same explicit local opt-in, actual loopback socket peer,
matching origin/host and non-production runtime. No caller source/date/window
parameters are accepted. Production/serverless remains disabled.

- GET `/api/fx/research/volatility`: fixed-universe capture and separate current
  assessment. Source/retention/integrity failure is explicit 503 with four pair
  outcomes; a verified retained capture may accompany blocked current estimates.
- GET `/api/fx/research/volatilities/{encoded volatilityId}`: historical verified
  replay, separate current assessment and next freshness check. Bad ID is 400;
  missing/expired is 404; corrupt/unsupported retained content is 409. Encode the
  whole ID as one segment. Responses are no-store.

## Verification and next scope

- **1,555 tests / 148 files** pass serially, seeded with the existing ignored SQZ
  fixtures. **34 browser flows** pass with zero retries: seven new volatility
  flows plus all prior FX/PRES flows at 320/768/1024/1440 widths.
- Typecheck, client/server builds, Gold policy and immutable skills pin pass.
  Existing bundle/eval warnings remain. Browser tests account for React
  StrictMode's development mounts when proving control changes add no reads.
- Hand cases cover centered constant returns, extreme finite levels, inverse
  equality, cross covariance, exact counts, gaps, invalid/latest guards and
  unavailable states. SQL uses real read-only SQLite fixtures. Publication,
  retained failure fallback, replay clocks, shared budget and byte overflow have
  regressions. Independent core/integration reviews were reconciled; empty source
  evidence is no longer mislabeled as calendar truncation.
- Read-only local macro_medallion capture: **253 dates, 759 source evidence records**,
  ending **2026-10-30**, all five windows available for all four pairs. The retained
  volatility artifact measured **720,191 bytes**. Exact level/history/volatility
  replay passed after restarting the server. Pre-S03 retained level/history v1
  payloads also replayed unchanged.
- Live browser verified both scaling modes, the 252 window and replay. Desktop
  and mobile had no horizontal overflow; the desktop had no page errors.
  Screenshots and temporary public responses are untracked. No new dependency.

Use the commands in the policy's delivery section, adding
`npx playwright test test/fx-volatility.spec.ts test/fx-history.spec.ts test/fx-research.spec.ts test/fx-scaffold.spec.ts test/presidential-impact.spec.ts --retries=0 --workers=1`.

Next is **FXR-S04 deterministic research-brief policy**: define allowed findings,
compatible frozen evidence, partial/stale wording and exact claim reconciliation.
Rolling volatility history, other estimators, broader currencies/rates context,
exports and exposure/hedge use remain separate scope.
