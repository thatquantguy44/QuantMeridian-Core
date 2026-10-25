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

This threshold identifies a dataset-wide operational failure. It does not bless missing individual units: affected securities remain missing and cannot be zero-filled. Whether publication is atomic or may continue only for unaffected securities remains a separate owner decision. Expected cohort construction is likewise deferred to the point-in-time adapter; the evaluator requires callers to supply it explicitly.

## Open owner decisions

These values are deliberately absent from runtime defaults:

1. Freshness policy for event-driven feeds, security reference data, and scheduled low-frequency publications such as short interest.
2. The point-in-time expected cohort construction for each approved dataset grain and product.
3. Whether product publication is atomic or may continue for unaffected securities above the systemic-collapse threshold.
4. Holiday, early-close, halt, and source-calendar behavior beyond the approved synthetic weekday calendar.
5. The approved purpose and role vocabulary for the entitlement-purpose slice, including export permissions and retention.

Until those decisions exist in a versioned policy, callers must supply explicit test policy. A missing policy is not permission to guess.

## Remaining T09 work

- Adapt point-in-time CSV histories into current material coverage units and enforce the gate before publication.
- Add entitlement-purpose evaluation with deny-by-default policy injection.
- Add internal inventory/loan reconciliation decisions and the remaining deterministic fault cases.
- Define affected-security/product quarantine and last-good recovery behavior using the approved product dependency matrix.

The quality report contains only bounded operational evidence. It must stay within the SQZ trust boundary under the approved no-automatic-egress policy. Governed user download/export remains the sole authorized outward transfer.
