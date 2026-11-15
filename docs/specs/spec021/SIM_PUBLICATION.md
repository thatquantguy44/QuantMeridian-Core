# Squeeze Radar SIM publication and quality-gate contract

SQZ-T08 exposes a local, server-only publication boundary for point-in-time synthetic histories. SQZ-T09 adds the mandatory persona/purpose, current-cohort, quality, freshness, coverage, identity, and reconciliation gates before a snapshot can replace last-good. The service retains the most recent successful snapshot when a systemic refresh fails and removes only affected coverage grains when the approved security-scoped policy permits degraded publication.

This is not an HTTP route. SQZ-T16 owns authenticated, same-origin endpoints, authorization, bounded pagination, filters, cursors, and typed transport errors. T08 provides the internal contract that those routes may consume without pre-deciding unresolved API policy.

## Contract

`SqueezeSimPublicationService` lives in [`src/lib/server/squeezeRadar/publicationService.ts`](../../../src/lib/server/squeezeRadar/publicationService.ts). Shared types live in [`src/lib/squeezeRadar/publication.ts`](../../../src/lib/squeezeRadar/publication.ts); T09 policy and adapter logic live in [`publicationGate.ts`](../../../src/lib/squeezeRadar/publicationGate.ts) and [`publicationGateAdapter.ts`](../../../src/lib/squeezeRadar/publicationGateAdapter.ts). Construction requires a server-held Phase 1 policy and entitlement context with a canonical UTC `entitlementValidFrom`/`entitlementValidTo` interval. The interval is half-open and must contain each publication's `decisionAt`; an expired, future, malformed, or inverted assignment fails closed. Its `publish` method accepts only the opaque, deep-readonly `ValidatedSqueezeCsvBundle` returned by the strict loader. A cast, clone, spread, or hand-built SIM object does not carry the loader's private runtime brand and fails as `BUNDLE_INVALID`; an object containing non-SIM provenance is rejected earlier as `NON_SIM_INPUT`.

A successful `SqueezeSimPublication` contains:

| Field | Meaning |
|---|---|
| `contractVersion` | Publication envelope version, currently `1.1` |
| `streamId` | Path-free SHA-256 identity of immutable scenario/generator provenance plus policy projection |
| `snapshotId` | `sqzsim_` plus a SHA-256 content identity |
| `dataMode` | Always `SIM` |
| `scenarioId` | Synthetic scenario identity from the validated manifest |
| `datasetVersion` | CSV dataset contract version from the manifest |
| `decisionAt` | UTC cutoff used for point-in-time eligibility |
| `publishedAt` | UTC time this local service accepted the publication |
| `quality` | Persona/purpose projection, per-dataset decisions, reconciliation, and coverage-grain exclusions |
| `coverage` | Per-dataset row count and latest included `first_knowable_at` |
| `datasets` | Latest eligible revision of every logical record as of `decisionAt` |

The publication deliberately excludes the bundle root, data dictionary, raw-source paths, and `_truth` content. Every manifest and record must be `SIM`; a `LIVE` manifest or row is rejected rather than mixed or silently downgraded. The loader enforces exact headers, schemas, cross-file references, revision uniqueness, and clock ordering before it brands and deep-freezes a bundle. Data Ops may evaluate internal reconciliation quality but its publication projection removes raw inventory, loan, and borrow-event rows and redacts internal economics evidence. Model Reviewer projections contain neither those raw rows nor internal reconciliation decisions. Trader projections are limited to their server-supplied assigned books. T16 still owns response-level field redaction and must never expose this internal publication envelope directly.

## T09 gate order

1. Authorize one registered persona/purpose pair at `decisionAt` and resolve its entitled synthetic books.
2. Select only revisions knowable at `decisionAt`.
3. Derive active security/listing identities and policy-named book/provider/source/venue cohorts.
4. Evaluate row quality, freshness, and coverage at the registered dataset grain.
5. Reconcile the current registered cohort for exact market/internal accounting, valid quantity ranges, JSON-safe utilization evidence, 0.001-percentage-point utilization tolerance, one-share loan tolerance, and 70% modeled-loan coverage.
6. Reject required coverage below 75% or an unscoped required failure; otherwise record coverage-key exclusions and publish unaffected data.

The adapter keeps coverage keys—not merely security IDs—through projection. Missing or stale contextual estimated short interest therefore cannot delete a valid official short-interest row for the same security. `short_interest.csv` is publication-optional because it contains both required official-style and contextual estimated observations; T11/T13 must hard-block the Squeeze Risk numeric score when the official-style block is unavailable.

When cohort derivation yields no applicable keys—such as no active ETF or no current positive on-loan inventory—the dataset has no gate report for that cutoff. This means “not applicable,” not zero coverage, and does not create a synthetic row or erase retained history.

## Point-in-time and identity rules

For each logical record, publication admits only revisions where `first_knowable_at <= decisionAt`, then selects the latest eligible revision. The point-in-time selector is tested at every fixture knowledge timestamp; service-level replay begins once the required publication cohort exists.

`streamId` is computed from path-free manifest provenance plus the policy version, persona, purpose, entitled-book projection, and entitlement-validity interval. `snapshotId` is computed from contract version, stream, mode, scenario, dataset version, decision time, quality report, and canonicalized projected dataset contents. It excludes `publishedAt` and coverage, so retrying the same content at a later publication time preserves identity. CSV row order does not change the ID. A decision time older than the highest attempted cutoff for the bound stream cannot replace it. This prevents a retry of an old good cutoff from erasing evidence that a newer refresh failed or from making stale data look freshly published. A rejected foreign stream cannot advance that watermark. The same decision time cannot be rebound to different content.

The caller supplies only `decisionAt` when publishing. The service captures `publishedAt` and read time from its platform-owned clock; production defaults to the system clock and tests may inject a deterministic clock at composition time. Request data cannot assert either wall clock. Decision, publication, and read clocks must be valid UTC timestamps ending in `Z`; accepted clocks are normalized to a stable millisecond representation (with zero milliseconds omitted), publication cannot precede its decision, and a read cannot precede the retained publication.

## Last-good state machine

The in-process service returns one of these outcomes:

| Operation | Status | Meaning |
|---|---|---|
| publish | `PUBLISHED` | Validation and point-in-time projection succeeded; this becomes last good |
| publish | `RETAINED_LAST_GOOD` | Refresh failed and the prior good descriptor was retained |
| publish | `UNAVAILABLE` | Refresh failed before any good publication existed |
| read | `CURRENT` | The retained snapshot is from the latest successful attempt and is within budget |
| read | `LAST_GOOD` | A later refresh failed, but the retained snapshot remains within budget |
| read | `UNAVAILABLE` / `NO_LAST_GOOD` | No successful publication exists in this process |
| read | `UNAVAILABLE` / `LAST_GOOD_EXPIRED` | The retained snapshot exceeds the supplied freshness budget |

The caller must supply a finite, non-negative `freshnessBudgetMs` for every read, but cannot supply `now`. The exact production threshold is still an owner decision, so T08 does not bury a default in code. Age is measured from the service-captured `publishedAt` to the service-captured read time; a snapshot is usable at the exact boundary and unavailable once its age is greater than the budget.

The store is intentionally in memory and retains one last-good snapshot. Its first successful publication binds that service instance to one exact `streamId`; changing the seed, generator version, scenario-manifest digest, scenario, dataset version, currency, or calendar requires a new instance, so a failed refresh cannot expose another provenance stream's last good. Publication clocks cannot move backward. Process restart begins unavailable. This satisfies the Phase 1 no-external-database constraint without pretending to provide durable publication history; durable storage and operational recovery policy require a later approved design.

## Failure and boundary behavior

- Known policy failures use stable codes: `NON_SIM_INPUT`, `CLOCK_INVALID`, `DECISION_TIME_REGRESSION`, `DECISION_CONTENT_CONFLICT`, `PUBLICATION_TIME_REGRESSION`, `PUBLICATION_STREAM_MISMATCH`, `NOT_AUTHORIZED`, and `QUALITY_GATE_REJECTED`. Authorization and quality-gate responses do not reveal restricted cohort contents.
- Loader/schema failures are reduced to `BUNDLE_INVALID` at the publication boundary. Filesystem paths and validator internals are not returned.
- Returned snapshots and failure objects are cloned, so a caller cannot mutate retained service state.
- The service performs local reads only. It has no database, network, model-provider, telemetry, webhook, or notification integration.
- Download/export remains a separately governed user action; this service neither starts nor stages an export.

The broader Squeeze Radar no-egress policy in [`THREAT_MODEL.md`](THREAT_MODEL.md) still applies. Adding an HTTP route, external store, outbound instrumentation, or model call is outside T08 and requires its owning task and controls.

## Verification

Run the focused contract suite with:

```bash
npx vitest run src/lib/server/squeezeRadar/publicationService.test.ts
```

The suites verify eligible fixture knowledge timestamps, stable content and provenance identity, row-order independence, loader branding, injected-field/reference rejection, SIM-only enforcement, decision-time authorization denials, active/policy-named current cohorts, impossible and unavailable quantity states, exact threshold boundaries, identity-cascade and security-scoped exclusions, official/estimated-source isolation, systemic last-good retention, attempted-cutoff preservation, trusted-clock expiry, path-safe failures, immutable snapshots/failures, invalid clocks/budgets, and decision/content/publication-stream regression.
