# SQZ Data Health Phase 1 runbook

## Authority and scope

- **Metadata version:** `1.0.0`
- **Runbook version:** `1.0.0`
- **Data mode:** `SIM` only
- **Owner role:** `DATA_OPS`
- **Escalation target:** the single Phase 1 `OPERATOR`

These are test-persona roles, not named production owners or a production on-call schedule. A live
deployment must replace them through a separately approved ownership record. The runbook consumes
only the redacted Data Health response; it never requires party names, book identifiers, positions,
prices, fees, rates, quantities, market values, or raw rejected records.

## Dataset evidence to inspect

For each dataset, inspect these fields in order:

1. `disposition` and `issues[].reasonCode` — why the input was accepted, degraded, quarantined, or
   suppressed;
2. `operations.lastSuccessfulAt` and `oldestRequiredInputAt` — the last successful publication and
   the oldest required observation evaluated at the decision clock;
3. `freshness` and `coverage` — the configured budget/deadline and expected-versus-observed cohort;
4. `sourceRefs` and bounded `issues[].recordIds` — safe correlation handles for local diagnosis;
5. `operations.actionCode` — the registered next action below.

Record IDs are bounded deterministic `sqzrec_` correlation handles, not raw source identifiers.
They do not grant access to an underlying restricted row. Correlation back to an input must remain
inside the platform by applying the registered dataset-and-source-ID projection locally; the
handle must not be sent to an external diagnostic or model service.

`sourceRefs` are limited to the registered synthetic source identities for their dataset. An
unregistered value is a contract failure, not a new source that an operator should trust or add
from the Data Health view.

## Registered actions

| Action code | Operator action | Completion evidence |
|---|---|---|
| `NO_ACTION` | No intervention. Continue normal synthetic publication. | Dataset remains accepted on the next capture. |
| `RESTORE_SOURCE_FRESHNESS` | Confirm the expected synthetic source completed, restore the missing/late input, and replay from the affected decision clock. | Freshness is within budget and publication no longer relies on last-good. |
| `RESTORE_SOURCE_COVERAGE` | Compare observed and expected coverage, restore missing cohort rows, and replay. | Coverage meets its registered minimum; security-scoped exclusions or systemic suppression clear as appropriate. |
| `REVIEW_QUARANTINED_RECORDS` | Resolve validation failures using the bounded record IDs, regenerate the affected synthetic input, and replay. | Quarantined count falls to the allowed level and the disposition clears. |
| `RECONCILE_SOURCE_TOTALS` | Reconcile the named synthetic source totals against the registered invariant without copying economics into diagnostics, then replay. | The reconciliation reason code clears. |
| `RESOLVE_IDENTITY_MAPPING` | Repair the effective-dated synthetic identity or event lineage for the bounded IDs, then replay. | Mapping quarantine clears without a future identity leaking into the decision time. |
| `REVIEW_DEGRADED_INPUT` | Review the optional degraded input and decide whether to restore or continue with the documented degradation. | The next capture either accepts the input or preserves an explicit optional degradation. |
| `RESTORE_REQUIRED_INPUT` | Inspect the registered source and requirement, restore the required synthetic input, and replay. | A more specific issue or an accepted disposition is produced. |

## Recovery and escalation

1. Do not bypass a publication gate or edit a retained snapshot.
2. Correct or regenerate only the affected synthetic input, preserving the manifest, seed, decision
   clock, and revision lineage needed for deterministic replay.
3. Replay through the publication boundary and capture the resulting Data Health state.
4. Confirm `lastGood.state=CURRENT` and `recovery.state=RECOVERED` when a prior failure clears.
5. Escalate to the Phase 1 operator when an action cannot be completed from bounded evidence, a
   required source remains unavailable, the same failure persists after replay, or the proposed
   remedy would require restricted fields or a policy change.

The operator may approve a new synthetic policy or ownership version. The operator may not use this
runbook to enable live data, external notifications, automatic outbound transfer, or challenger
promotion.
