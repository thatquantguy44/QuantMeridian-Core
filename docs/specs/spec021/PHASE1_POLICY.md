# SQZ Phase 1 synthetic product and service policy

- **Policy ID:** `sqz-sim-product-service-policy`
- **Version:** `1.0.0`
- **Status:** owner approved
- **Approved:** 2026-10-25
- **Applies to:** SQZ-T09 through SQZ-T16

This policy supplies the owner decisions required to implement the Phase 1 synthetic quality,
feature, baseline, evaluation, registry, Data Health, and API boundaries. It authorizes only SIM
behavior. It does not approve a live source, live entitlement model, real-world efficacy claim,
external notification, or automated action.

## Operator and personas

Phase 1 has one operator and four selectable test personas. Persona selection exercises future
authorization boundaries; it is not a substitute for production identity management. The server
evaluates persona, purpose, scope, field, and action on every request and denies by default.

| Persona | Authorized projection | Restricted projection | Authorized purposes |
|---|---|---|---|
| `TRADER` | Market outputs; assigned-book inventory, loans, owner/counterparty economics; private profiles; re-rate reviews | Other books | `RESEARCH`, `RERATE_REVIEW` |
| `DESK_MANAGER` | Market outputs; all synthetic books and detailed economics; aggregate and review oversight | None inside the approved SIM universe | `RESEARCH`, `RERATE_REVIEW` |
| `DATA_OPS` | Record IDs, lineage, quality failures, quarantine, recovery, and runbooks | Party names and economics | `DATA_OPS` |
| `MODEL_REVIEWER` | Feature/signal evidence, model cards, evaluations, registry, and rollback | Party names and loan economics | `MODEL_REVIEW` |

All personas may read market-only SQZ outputs. Saved views and custom profiles are private to the
persona that created them. Unauthorized resources use the same not-found response shape so IDs,
counts, timing, and error text do not reveal restricted rows or fields.

## Model authority

- Transparent rules-based baselines are the only active Phase 1 models.
- Statistical challengers may run offline and appear in comparison reports.
- Challenger promotion is disabled for all of Phase 1.
- Active Squeeze Risk outputs contain a 0-100 rank and named band, never a probability.
- A displayed probability is a high-priority future improvement. It requires an explicitly
  probabilistic challenger, untouched out-of-time evaluation, calibration evidence, a new owner
  decision, and a new policy version.
- Market Borrow Stress and Internal Borrow Stress remain separate registered products. A composite
  may be researched later but is neither default nor authoritative in v1.

## Borrow Stress v1

Both baselines use transparent monotonic feature transforms and publish a 0-100 score with these
registered bands:

| Score | Band |
|---|---|
| 0-39 | `NORMAL` |
| 40-59 | `TIGHTENING` |
| 60-79 | `SPECIAL` |
| 80-100 | `SEVERE` |

### Market Borrow Stress registered weights

| Feature | Weight | Component |
|---|---:|---|
| Provider utilization | 25% | Current tightness |
| Comparable fee level | 25% | Current tightness |
| Availability scarcity | 10% | Current tightness |
| Fee pressure | 15% | Deterioration |
| Supply contraction | 15% | Deterioration |
| Demand/on-loan expansion | 10% | Deterioration |

### Internal Borrow Stress registered weights

| Feature | Weight | Component |
|---|---:|---|
| Internal utilization | 35% | Current tightness |
| Available-inventory scarcity | 25% | Current tightness |
| Request-to-available pressure | 15% | Deterioration |
| Unfilled-request ratio | 15% | Deterioration |
| Inventory drawdown | 10% | Deterioration |

The registered current-tightness/deterioration split is 60%/40%. A user may change only this
high-level split in a private analysis profile. A custom result is labeled `CUSTOM`; its weights
are included in lineage and saved-view identity. Changing the split proportionally rescales the
registered feature weights inside each component; it does not alter their within-component ratios.
Custom results cannot drive alerts, registry promotion, or official evaluation. Individual feature
weights are not user settings in Phase 1.

Recall and buy-in pressure are excluded from the registered internal score until a later synthetic
contract supplies a sufficiently rich time series. They may appear as clearly labeled context.

## Squeeze Risk v1

### Registered score

| Required block | Weight |
|---|---:|
| Official-style short interest and days-to-cover | 30% |
| Market Borrow Stress | 30% |
| Trailing abnormal price/volume behavior | 25% |
| Float and liquidity fragility | 15% |

Estimated short interest, options, ETF, event, threshold-list, and fails-to-deliver observations
are contextual reason codes only. They cannot alter the v1 numeric score and cannot substitute for
an unavailable required block.

| Score | Band |
|---|---|
| 0-39 | `LOW` |
| 40-59 | `ELEVATED` |
| 60-79 | `HIGH` |
| 80-100 | `EXTREME` |

The headline outcome horizon is user-selectable among 1, 5, and 10 business days. Five business
days is the default, and every result carries its selected horizon.

### Synthetic outcome label

A positive `SQUEEZE_LIKE_EVENT` requires both:

1. sector-adjusted return of at least 10% over 1 business day, 20% over 5 business days, or 25%
   over 10 business days; and
2. volume at least 1.5 times trailing 20-business-day average volume, realized volatility at least
   1.5 times its trailing 20-business-day baseline, or both.

The label describes a price/volume event. It never asserts that forced covering, manipulation, or
any named actor caused the move. Phase 1 uses fixed return thresholds; adaptive cohort-relative
labels are deferred.

## Re-rate Opportunity v1

- Eligible loans are synthetic, settled, open, same-currency, entitled, and supported by a current
  comparable market benchmark.
- A candidate requires a positive market-minus-internal effective-rate gap of at least 25 bps.
- The headline estimate is annualized gross run-rate on current eligible settled quantity. It is
  indicative, not a realized revenue forecast.
- The reviewed outcome window is 10 business days.
- `REALIZED` requires an effective uplift capturing at least 80% of the indicated gap while at
  least 90% of the eligible balance is retained.
- `PARTIAL` requires a positive effective uplift but means the 80% gap-capture threshold, the 90%
  retained-balance threshold, or both were missed.
- `NOT_REALIZED` means no positive effective uplift was recorded by the deadline.
- Rejected and unactioned candidates remain in evaluation populations.
- Capacity, relationship/contract restrictions, owner guidance, demand sustainability, and recall
  risk remain visible constraints; they are not hidden score adjustments.

## Quality and reconciliation policy

- Synthetic integer quantity identities reconcile exactly.
- Provider utilization may differ from `100 * onLoan / lendable` by no more than 0.001 percentage
  points because of serialization rounding.
- Settled loan quantity may not exceed internal on-loan quantity beyond one share of rounding
  tolerance.
- Modeled loan rows must cover at least 70% of internal on-loan quantity. Lower coverage degrades
  the internal projection; it does not manufacture missing loans.
- Failures are security-scoped unless dataset coverage is strictly below the approved 75% systemic
  threshold.
- The SIM expected cohort is derived at `decisionAt` from active, effective-dated, entitled
  manifest securities and the books/providers/sources/venues named by the dataset policy. Future
  identities and future revisions cannot enter the cohort.
- Entitlements are evaluated at `decisionAt` for one explicit authorized purpose from the persona
  matrix above.

## Evaluation and registry policy

- The base fixture supports deterministic hand calculations, not a full performance claim.
- Full evaluation requires held-out manifests with at least 200 business days.
- Use expanding walk-forward folds with at least 120 business days of training, 40 of validation,
  and 20 of untouched test data; advance 20 business days per fold.
- Purge observations whose label windows overlap the next split, then apply a 10-business-day
  embargo. Purging follows the selected 1/5/10-day outcome horizon.
- Select thresholds on training/validation only. Test folds never select thresholds or transforms.
- Retain delisted names and point-in-time corporate-action lineage. Freeze transforms and cohorts
  within a fold.
- Registry history is append-only with one active registered-baseline pointer. A rollback changes
  that pointer without rewriting snapshots, reports, cases, or history.
- A baseline version requires deterministic replay, truth-leakage checks, complete evidence, and
  `MODEL_REVIEWER` approval. A challenger cannot become active during Phase 1.

## Storage, Data Health, and service policy

- Local state uses SQLite under ignored `.data/squeeze_radar/`; raw generated CSV remains under
  ignored `data/synthetic/`.
- Retain Phase 1 synthetic publications, evaluations, registry records, and health events for 400
  days. This is a local SIM policy, not approval for live licensed-data retention.
- Data Health and platform-internal logs store only bounded operational evidence, hashes, opaque
  record IDs, and reason codes. External telemetry receives no ingested or derived SQZ data,
  identifiers, dimensions, economics, or reconstructable derivatives.
- One private TypeScript service, `services/squeeze_radar_api`, hosts the boundary on
  `127.0.0.1:8019`. Ingestion, scoring, evaluation, storage, and query are not separate services.
- The browser calls only authenticated same-origin terminal routes. The terminal-to-service token
  is server-held.
- The maximum Phase 1 synthetic universe is 1,000 securities.
- Board pagination defaults to 50 and is capped at 200 rows.
- Opaque cursors bind to snapshot, persona, purpose, filters, sort, signal/config versions, policy
  projection, and custom-profile version; cursors expire after 30 minutes.
- Each persona may store at most 50 private saved views.
- The local/SIM read objective is p95 under 500 ms for summary, board, detail, model-card, and Data
  Health reads at the approved universe size. It is not production SLO evidence.
- Cache keys include snapshot, persona, purpose, filters/sort, and custom-profile version.
- SQZ processes use deny-by-default outbound networking. No route accepts an external destination
  or proxies SQZ data. An authorized user-initiated governed download/export remains the only
  approved outward transfer.

## Explicitly deferred

- Live sources, vendors, credentials, rights, calendars, retention, and production SLOs.
- Production identity management and confidential-data entitlements.
- Displayed Squeeze Risk probability and promotion of a statistical challenger.
- A default or authoritative composite of Market and Internal Borrow Stress.
- Per-feature user weight editing.
- Cross-currency re-rate comparison.
- External notifications, webhooks, external sharing, or out-of-boundary model execution.
