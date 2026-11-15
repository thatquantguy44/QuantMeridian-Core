# SQZ quality, freshness, and coverage gates

## Status and scope

This document defines SQZ-T09 slices 1 and 2 for the synthetic Phase 1 boundary:

1. a versioned quality-decision contract; and
2. deterministic quality, freshness, and coverage evaluation.

The implementation is intentionally policy-injected. It does not invent freshness budgets, expected coverage cohorts, user purposes, or product-dependency behavior that the owner has not approved. The owner-approved synthetic coverage grains and systemic-collapse threshold are versioned policy inputs.

The executable TypeScript boundary is [`qualityGates.ts`](../../../src/lib/squeezeRadar/qualityGates.ts). Serialized reports conform to [`quality-decision-1.0.schema.json`](../../../contracts/squeeze_radar/v1/quality-decision-1.0.schema.json).

## Decision contract

Each report and decision names its contract version, policy version, dataset, and decision time. Every rule decision contains:

- `ruleId`: the stable rule that ran;
- `severity`: `INFO`, `WARNING`, `ERROR`, or `CRITICAL`;
- `disposition`: `ACCEPT`, `DEGRADE`, `QUARANTINE`, or `SUPPRESS`;
- `reasonCode`: a machine-readable explanation;
- `affected`: the dataset plus policy-grain coverage keys and stable record IDs; and
- `evidence`: bounded counts, ratios, ages, and thresholds needed to reproduce the decision.

The gate dispositions are control-plane actions, not aliases for every public signal state. Their intended projection is:

| Gate disposition | Meaning | Typical signal projection |
|---|---|---|
| `ACCEPT` | The evaluated rule passed | `AVAILABLE` unless another rule is worse |
| `DEGRADE` | The data may remain visible only under the explicit policy | `DEGRADED` |
| `QUARANTINE` | Named records are ineligible for model publication | `QUARANTINED` at the affected scope |
| `SUPPRESS` | A required dependency failed | `UNAVAILABLE` for the affected product/scope |

Aggregation uses the deterministic precedence `SUPPRESS > QUARANTINE > DEGRADE > ACCEPT`. Severity is mechanically derived from disposition: `INFO`, `WARNING`, `ERROR`, then `CRITICAL`. It is not a model-confidence score, because combining operations, data quality, and model uncertainty into one decorative number would be impressively vague and not especially useful.

## Evaluation boundary

`evaluateSqueezeDatasetGate` consumes **current material coverage units**, not raw undifferentiated history. A unit contains:

- an opaque `coverageKey` at the policy-defined grain, such as security or provider/security;
- the stable IDs of the current material records represented by that unit;
- its observation timestamp; and
- its consolidated row-quality state.

The upstream projection that selects those units must remain point-in-time safe. It must select only revisions satisfying `first_knowable_at <= decision_at`, then produce one unique unit per expected coverage key. The gate rejects duplicate keys, future observations, malformed UTC timestamps, and invalid policy values. This separation prevents an old historical quarantine from poisoning a later clean observation and avoids pretending every dataset shares one natural coverage grain.

## Rules

### `ROW_QUALITY`

- Any current `QUARANTINED` unit yields `QUARANTINE` and names its coverage key and record IDs.
- `DEGRADED` data yields `DEGRADE` only when the injected policy explicitly allows it.
- Disallowed degraded data yields `SUPPRESS` for a required dataset and `DEGRADE` for an optional dataset.
- No quality state is silently treated as valid.

### `SOURCE_FRESHNESS`

Freshness is always policy-injected and supports two modes:

- `ELAPSED`: an explicit elapsed-time budget from `observedAt`; and
- `NEXT_BUSINESS_PUBLICATION`: the next configured weekday publication time plus a configured grace period.

A unit is stale only when `decisionAt` is strictly later than its calculated deadline; equality remains within budget.

- Stale required data yields `SUPPRESS` / `STALE_REQUIRED_SOURCE`.
- Stale optional data yields `DEGRADE` / `STALE_OPTIONAL_SOURCE`.
- Evidence records the mode, maximum unit age, earliest deadline, and exact elapsed budget or grace period used.

The approved Phase 1 synthetic policy is versioned in [`synthetic-freshness-1.0.json`](../../../contracts/squeeze_radar/v1/policies/synthetic-freshness-1.0.json). Inventory, loan, market-borrow, equity, options, and ETF daily snapshots use their next `20:00:00Z` weekday publication plus 30 minutes. Daily short-sale volume uses its next `20:00:00Z` weekday publication plus two hours. These are configuration values, not evaluator constants.

Phase 1 uses a deterministic `WEEKDAYS_ONLY` calendar. A future LIVE policy must introduce an approved exchange/source calendar for holidays, early closes, and source-specific schedules rather than silently inheriting the synthetic calendar.

### `SOURCE_COVERAGE`

Coverage is the number of expected policy keys present divided by the number expected. The policy must provide a non-empty, unique expected cohort, the approved dataset grain, and a minimum ratio from zero through one.

- Phase 1 defines systemic collapse as coverage **strictly below 75%**. Exactly 75% is not a systemic collapse.
- Systemic collapse yields `SUPPRESS` for a required dataset.
- The same failure yields `DEGRADE` for an optional dataset.
- At or above 75% but below complete coverage, security-scoped publication yields `DEGRADE` / `SECURITY_SCOPED_COVERAGE_GAP`: unaffected securities may continue, while missing securities are named and remain unavailable.
- Complete coverage yields `ACCEPT` / `COVERAGE_WITHIN_MINIMUM`.
- Missing keys are named in `affected.coverageKeys`; missing observations are never zero-filled.
- Decision evidence records the grain and threshold used, so ratios from unlike units cannot masquerade as comparable measurements.

Freshness and coverage remain separate. A key can be present but stale, and calling that “covered” must not perform the ancient dashboard ritual of painting missing usability green.

The approved Phase 1 synthetic policy is versioned in [`synthetic-coverage-1.0.json`](../../../contracts/squeeze_radar/v1/policies/synthetic-coverage-1.0.json):

| Dataset | Coverage grain |
|---|---|
| `securities.csv` | security/listing |
| `inventory_snapshots.csv` | book/security |
| `loan_snapshots.csv` | book/security plus source heartbeat |
| `borrow_events.csv` | book/source heartbeat |
| `market_borrow_snapshots.csv` | provider/security |
| `short_interest.csv` | source/security |
| `short_sale_volume.csv` | venue-scope/security |
| `equity_market_daily.csv` | listing/security |
| `options_snapshots.csv` | provider/underlying |
| `etf_snapshots.csv` | ETF security |
| `security_events.csv` | source heartbeat |

This threshold identifies a dataset-wide operational failure. Phase 1 uses `SECURITY_SCOPED` publication: affected securities remain missing and unavailable, while unaffected securities may continue with an explicit degraded coverage decision. Dataset-wide aggregates that cannot be computed honestly from the available cohort must remain unavailable; partial data is never zero-filled into a pretend total. The point-in-time adapter implements the approved SIM expected-cohort rule and supplies the resulting current-material cohort to the evaluator.

## Remaining owner decisions

These values are deliberately absent from runtime defaults:

1. Freshness policy for event-driven feeds, security reference data, and scheduled low-frequency publications such as short interest.
2. Future LIVE expected-cohort construction. Phase 1 SIM derives its expected cohort at `decisionAt` from active, effective-dated, entitled manifest securities and the books/providers/sources/venues named by the dataset policy.
3. Holiday, early-close, halt, and source-calendar behavior beyond the approved synthetic weekday calendar.
4. Future LIVE role mapping, export permissions and licensed-data retention. Phase 1 uses the four personas, four purposes and 400-day local SIM retention in [PHASE1_POLICY.md](PHASE1_POLICY.md).

Until remaining LIVE decisions exist in a versioned policy, LIVE callers must supply explicit test policy. A missing policy is not permission to guess or to inherit the SIM values.

## Implemented T09 publication boundary

- Point-in-time histories are reduced to current material coverage units using active identities and
  policy-named synthetic books, providers, sources, and venues.
- The four persona/purpose combinations fail closed. Entitlement validity is a required half-open
  UTC interval evaluated at `decisionAt`, and the resulting book/time projection is bound into the
  publication stream identity.
- Market availability/utilization and internal inventory/loan reconciliations enforce the approved
  exact, 0.001-percentage-point, one-share, and 70% tolerances. Negative, overallocated, above-100%
  utilization, and zero-lendable/unavailable states cannot pass merely because their arithmetic is
  internally consistent; reconciliation evidence remains finite and JSON-safe.
- Reconciliation uses the same active-identity and registered-source cohort as quality evaluation.
  Retained history and non-policy sources do not poison the current decision.
- A derived cohort with no applicable keys at `decisionAt` (for example, no active ETF or no
  positive on-loan inventory) is omitted as not applicable. It is not converted into a coverage
  failure and does not manufacture a placeholder observation.
- Coverage-key exclusions preserve source granularity, so one unavailable contextual source cannot
  erase a valid required source for the same security.
- Required coverage below 75% or an unscoped required failure retains last-good. At or above 75%,
  affected grains remain unavailable while unaffected observations may publish as `DEGRADED`.
- T11 owns product-level dependency projection from these dataset/security/source decisions; it may
  not reinterpret a missing required block as zero or allow contextual evidence to rescue it.

The quality report contains only bounded operational evidence. It must stay within the SQZ trust boundary under the approved no-automatic-egress policy. Governed user download/export remains the sole authorized outward transfer.
