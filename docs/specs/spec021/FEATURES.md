# SQZ point-in-time feature snapshots

## T11 implementation contract

**Checkpoint:** T11 foundation implemented on `feat/sqz-t11-feature-snapshots`, pending review/merge.
T11 remains in progress; **T11b gate-decision propagation is the next scoped work** in
[`HANDOFF.md`](HANDOFF.md).

T11 builds versioned SIM feature evidence for T12–T14. It does not produce scores, bands,
probabilities, outcomes, or loan actions. The approved authority is `PHASE1_POLICY.md`.

Implementation slices:

- [x] Define the typed snapshot, strict JSON schema, feature registry, and hand-case fixtures.
- [x] Build source/book-cohort measurements from the existing T08/T09 publication boundary.
- [x] Verify reconstruction, revision/quality/identity traps, authorization, and truth isolation;
  complete independent review of this foundation and update the task checkpoint.
- [ ] T11b: carry policy-safe current gate decisions and dependency readiness into the feature
  response so downstream baselines preserve reconciliation/degradation policy.

Implementation: [`features.ts`](../../../src/lib/squeezeRadar/features.ts),
[`feature-snapshot-1.0.schema.json`](../../../contracts/squeeze_radar/v1/feature-snapshot-1.0.schema.json),
[`featureService.ts`](../../../src/lib/server/squeezeRadar/featureService.ts), and its focused
input, market, internal, positioning/context and contract modules. The builder is stateless and
performs no filesystem, database or network I/O; its caller supplies an already validated bundle.

## Boundary and reproducibility

The server entry point accepts only a loader-branded immutable CSV bundle and explicit publication
policy, entitlement context, and decision timestamp. It obtains a fresh T08 publication for that
cutoff; systemic publication failure returns a typed unavailable result. T09 controls current
source freshness, identity, coverage, reconciliations, and permitted books. Publication history is
broader than T09's evaluated current cohort. The feature builder therefore filters every candidate
by its registered source and effective identity, checks current-row freshness, and validates
quality and semantic/accounting identities on every consumed historical row. It cannot import or read
the generator, truth ledger, outcome labels, or external services.

Trader and Desk Manager receive only their T09-permitted internal cohorts. Model Reviewer receives
market features without internal quantities, loan economics, party identities, or internal record
lineage. Data Ops receives the existing operational Data Health contract, not feature values.
Invalid persona/purpose/entitlement combinations return the same non-enumerating denial.

Every feature identifies its unit, transformation version, availability/reason codes, exact input
records/revisions, source/methodology, effective date, observed time, first-knowable time, and age
at the decision. The snapshot records path-free manifest provenance and publication identity.
Its content identity excludes wall-clock publication time. Same manifest, cutoff, policy,
projection, and eligible records reproduce the same snapshot regardless of CSV ordering or local
file paths. Missing inputs have null values; observed zero remains distinct.

## Cohorts and transforms

Providers/methodologies, books, and loans remain separate. No cross-provider averaging, implicit
FX conversion, hidden truth, or cross-kind short-interest substitution is allowed. All numeric
features are unscaled measurements, not score components. A block's readiness describes its
registered feature inputs, not availability of a downstream signal. T13 still requires the T12
Market Borrow Stress output independently.

| Block | Registered measurements |
|---|---|
| Market borrow | `100 * onLoan / lendable`, current fee bps, `100 * (1 - available / lendable)`, one-business-day fee change in bps, `100 * (prior lendable - current lendable) / prior lendable`, `100 * (current onLoan - prior onLoan) / prior onLoan`; raw supply/on-loan/available, demand, new-loan fee, contributor count |
| Internal inventory | `100 * onLoan / eligible`, `100 * (1 - available / eligible)`, `100 * (prior eligible - current eligible) / prior eligible`; raw eligible/on-loan/available |
| Internal demand | Same-business-date `BORROW_REQUEST` requested/filled quantities, requested/available ratio and `100 * (requested - filled) / requested`; no event does not imply zero demand |
| Official positioning | Separate official position and basis, recomputed SI percentage, settlement age, `position / adv20` days to cover; denominator source/date/window retained |
| Equity behavior | Adjusted-close returns over 1/5/10/20 business days, current volume / source-declared ADV20, source-declared realized volatility; no raw/adjusted splice |
| Float/liquidity | Effective float, ADV20, `100 * ADV20 / float`, raw close for same-currency loan valuation |
| Loan economics | Per-loan settled/open/same-currency quantity and fee-convention rate; rate comparison remains unavailable because CSV v1 lacks benchmark cohort/convention/collateral metadata and rebate reference rates |
| Context only | Estimated positioning, short-sale volume percentage with venue scope, options put/call/IV/skew/open interest, ETF flow/AUM, known event timing; threshold-list/FTD context explicitly unavailable under CSV v1 |

Daily changes use exact previous weekdays in the manifest's synthetic weekday calendar; a missing
business date is insufficient history, never the previous available row. Multi-day adjusted
returns require the full contiguous window. Cross-window methodology changes and non-valid
historical revisions make the affected features unavailable; a rejected revision cannot resurrect
an older valid revision of the same logical observation. Source-native ADV20/realized-volatility
fields retain that methodology and are not claimed to be recomputed full-window estimates.

No transform chooses a score threshold or model weight. The one-day borrow/inventory changes and
the 1/5/10/20-day price measurements expose named measurement windows for later registered models;
they do not select or promote a model. Zero/invalid denominators and non-finite results are
unavailable. Current hard-block failures cannot be repaired with old rows or contextual inputs.

## Verification

Focused tests must cover hand arithmetic for every registered input family, exact eligible
revisions, post-decision corrections/backfills, unavailable historical dates, effective identities,
same-source/methodology joins, official versus estimated/short-volume isolation, required versus
context missingness, source/book permissions, stable identities, defensive copies, manifest
reconstruction, and truth-ledger mutation/deletion. Full repository tests, typecheck, build, and
`npm run check:agent-skills-pin` close the implementation checkpoint.
