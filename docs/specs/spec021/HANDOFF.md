# SQZ handoff — 2026-10-26

**Open PR:** [#197](https://github.com/thatquantguy44/QuantMeridian/pull/197).
**Feature foundation commit:** `75eb514` (followed by the PR-link documentation checkpoint).

## Read first

**Branch:** `feat/sqz-t11-feature-snapshots`. **Status:** T11 feature foundation verified;
T11 remains in progress. The owner requested this stopping point, documentation, commit/push and
a PR. This branch includes the previously unmerged T10 runbook/view checkpoint and `0ad6da0`
Data Health privacy/recovery hardening. Do not mistake branch implementation for merged main.

Read repository `AGENTS.md`, [`SPEC.md`](SPEC.md), [`PHASE1_POLICY.md`](PHASE1_POLICY.md),
[`TASKS.md`](TASKS.md), and [`FEATURES.md`](FEATURES.md). The master entry point is
[`docs/handoff.md`](../../handoff.md). These documents supersede older SQZ prototype notes and
the master's October 20 work priorities for this workstream.

## Implemented checkpoint

- Existing T06–T10a contracts, generator, point-in-time publication, gates/reconciliation,
  restricted Data Health, and legacy consumer inventory remain the foundation.
- Feature contract `1.0`, definition `sqz-features-1.0.0`: 14 blocks/55 unscaled measurements.
  Includes separate market borrow, internal inventory/demand, official positioning, adjusted
  equity behavior, float/liquidity, per-loan economics, and optional context blocks.
- `buildSqueezeFeatureSnapshot` accepts a loader-branded immutable SIM bundle, explicit
  publication policy/context and decision cutoff. It uses a fresh T08/T09 publication; systemic
  rejection produces no partial feature response. No route, UI consumer or scorer calls it yet.
- Registered source filtering, effective identities, authorized book scope, exact eligible
  revisions, per-input historical validity/accounting, current freshness and full-window
  continuity precede arithmetic. Prices cannot cross effective currency/listing changes.
- Every measurement has units, availability, bounded reason codes and exact record/revision
  references into a deduplicated lineage table. Missing values are null; observed zero remains
  zero. Ambiguous observations are unavailable with stable, complete tied-input evidence.
- Manifest provenance and eligible content determine identity independently of CSV ordering,
  local paths and retry publication time. Reconstructing from the pinned manifest after deleting
  `_truth/` produces identical features. Production feature modules do not import the generator.
- Data Ops cannot receive numerical feature snapshots. Model Reviewer receives market evidence
  without internal rows/lineage. Trader receives only assigned books; Desk Manager receives its
  permitted synthetic scope. Invalid purpose/entitlement combinations share one denial shape.

Important files:

| Purpose | Path |
|---|---|
| Shared types, block/measurement registry | `src/lib/squeezeRadar/features.ts` |
| Strict serialized schema | `contracts/squeeze_radar/v1/feature-snapshot-1.0.schema.json` |
| Server entry point | `src/lib/server/squeezeRadar/featureService.ts` |
| Eligibility, historical integrity, lineage | `src/lib/server/squeezeRadar/featureInputs.ts` |
| Calculations | `featureMarket.ts`, `featureInternal.ts`, `featurePositioning.ts` in that server directory |
| Schema/semantic checks | `src/lib/server/squeezeRadar/featureContract.ts` |
| Hand, replay and fault tests | `featureService.test.ts`, `featureContract.test.ts` in that server directory |

## Start next: SQZ-T11b — gate-decision propagation

**Do this before starting T12.** The current feature response represents measurements,
missingness and record lineage, but does not carry the permitted current T09 reconciliation and
degradation decisions through to its consumers. A downstream scorer must not infer complete
internal readiness just because its inventory measurements are numerically valid.

Keep this next slice confined to the versioned feature contract, its builder and tests:

1. Carry authorized source/security/book-scoped T09 reconciliation/degradation evidence and
   product dependency readiness into feature output. Bind it to the same publication, decision,
   feature/policy version and persona/purpose projection. Assess contract version compatibility.
2. Prove that modeled loan quantity below 70% of internal on-loan retains the approved internal
   degradation state; preserve the one-share excess-loan tolerance and current scoped exclusions.
   Propagate diagnostic reason distinctions without resurrecting blocked records.
3. Add hand/fault cases for each product's required versus contextual inputs, stale official
   positioning versus fresh estimated/short-volume context, source/book isolation, absent demand,
   and historical invalid inputs. Missing context cannot repair a required block or alter a
   registered Squeeze Risk number. T11b defines input readiness; T12–T14 still own all numbers.
4. Prove Trader book scope and Model Reviewer redaction for the added evidence. Never serialize
   raw internal values, book/source coverage keys or counts to a persona not entitled to them.
   Data Ops keeps using the operational Data Health contract.
5. Run the checks below and independent review, then update T11's completion/evidence status.

After T11 is closed, start **SQZ-T12**: separate transparent Market/Internal Borrow Stress
baselines, approved weights/bands, missing-block behavior, custom split boundary and model cards.
Do not jump to T13/T14 scores, T15 evaluation, T16 transport, T17 migration or UI work.

## Explicit limits

- T11 is unexposed and stateless. It is not an authenticated API, durable feature store or
  active model. No live source or automatic egress is approved.
- Loan `comparableGapBps` stays unavailable because CSV v1 lacks the metadata to establish an
  approved comparable benchmark. Rebate conversion lacks its benchmark. Do not invent either.
- Threshold-list/FTD blocks are explicitly unavailable under the current CSV contract.
- Daily changes use the exact synthetic weekday calendar; missing business dates are not
  compressed away. ADV20 and volatility are source-declared measures, not recomputed estimates.
- Data Health now requires a private, stable HMAC key/key ID at service construction. T16 owns
  runtime configuration; test-only literals are not deployment defaults. See [`DATA_HEALTH.md`](DATA_HEALTH.md).
- Generator parameter approval, named owners and later alert/review workflow ownership remain
  open owner decisions. The next slice does not resolve them implicitly.

## Verification at this checkpoint

On 2026-10-26:

- Full Vitest suite: **1,399 tests in 129 files passed**.
- Feature tests: **35 passed** across the two feature suites.
- `npm run typecheck`, client/server build, and `npm run check:agent-skills-pin` passed.
- Independent adversarial/code-quality review completed; the final review found no additional
  substantive issues in this foundation. T11b is explicitly outside its completion scope.
- Builds retain existing bundle-size and `eval` warnings outside these feature modules.

From repository root, generate ignored fixtures if missing, then verify:

```bash
npm run generate:squeeze-csv
npm test -- src/lib/server/squeezeRadar/featureService.test.ts src/lib/server/squeezeRadar/featureContract.test.ts --maxWorkers=1 --minWorkers=1
npm test -- --maxWorkers=1 --minWorkers=1
npm run typecheck
npm run build
npm run check:agent-skills-pin
```

Full-suite IBAL transport tests start loopback servers. A sandbox without `127.0.0.1` listener
permission produces `listen EPERM` and three unrelated timeouts; rerun with local-listener access
instead of weakening those tests. No external network source is needed by the feature suites.
