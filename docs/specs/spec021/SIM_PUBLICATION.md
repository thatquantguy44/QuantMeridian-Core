# Squeeze Radar SIM publication contract

SQZ-T08 exposes a local, server-only publication boundary for point-in-time synthetic histories. It converts a validated CSV bundle into a deterministic snapshot, retains the most recent successful snapshot when a refresh fails, and fails closed when no acceptable snapshot is available.

This is not an HTTP route. SQZ-T16 owns authenticated, same-origin endpoints, authorization, bounded pagination, filters, cursors, and typed transport errors. T08 provides the internal contract that those routes may consume without pre-deciding unresolved API policy.

## Contract

`SqueezeSimPublicationService` lives in [`src/lib/server/squeezeRadar/publicationService.ts`](../../../src/lib/server/squeezeRadar/publicationService.ts). Shared types live in [`src/lib/squeezeRadar/publication.ts`](../../../src/lib/squeezeRadar/publication.ts). Its `publish` method accepts only the opaque, deep-readonly `ValidatedSqueezeCsvBundle` returned by the strict loader. A cast, clone, spread, or hand-built SIM object does not carry the loader's private runtime brand and fails as `BUNDLE_INVALID`; an object containing non-SIM provenance is rejected earlier as `NON_SIM_INPUT`.

A successful `SqueezeSimPublication` contains:

| Field | Meaning |
|---|---|
| `contractVersion` | Publication envelope version, currently `1.0` |
| `streamId` | Path-free SHA-256 identity of immutable scenario and generator provenance |
| `snapshotId` | `sqzsim_` plus a SHA-256 content identity |
| `dataMode` | Always `SIM` |
| `scenarioId` | Synthetic scenario identity from the validated manifest |
| `datasetVersion` | CSV dataset contract version from the manifest |
| `decisionAt` | UTC cutoff used for point-in-time eligibility |
| `publishedAt` | UTC time this local service accepted the publication |
| `coverage` | Per-dataset row count and latest included `first_knowable_at` |
| `datasets` | Latest eligible revision of every logical record as of `decisionAt` |

The publication deliberately excludes the bundle root, data dictionary, raw-source paths, and `_truth` content. Every manifest and record must be `SIM`; a `LIVE` manifest or row is rejected rather than mixed or silently downgraded. The loader enforces exact headers, schemas, cross-file references, revision uniqueness, and clock ordering before it brands and deep-freezes a bundle.

## Point-in-time and identity rules

For each logical record, publication admits only revisions where `first_knowable_at <= decisionAt`, then selects the latest eligible revision. Tests reconstruct a publication at every knowledge timestamp present in the base fixture.

`streamId` is computed from path-free manifest provenance: dataset/scenario identity, scenario-manifest identity/version/digest when present, seed, generator version, currency, and calendar bounds. `snapshotId` is computed from contract version, stream, mode, scenario, dataset version, decision time, and canonicalized dataset contents. It excludes `publishedAt` and coverage, so retrying the same content at a later publication time preserves identity. CSV row order does not change the ID. A decision time older than the retained last-good decision cannot replace it, and the same decision time cannot be rebound to different content.

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

- Known policy failures use stable codes: `NON_SIM_INPUT`, `CLOCK_INVALID`, `DECISION_TIME_REGRESSION`, `DECISION_CONTENT_CONFLICT`, `PUBLICATION_TIME_REGRESSION`, and `PUBLICATION_STREAM_MISMATCH`.
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

The suite verifies every fixture knowledge timestamp, stable content and provenance identity, row-order independence, loader branding, injected-field/reference rejection, SIM-only enforcement at both manifest and record level, last-good retention, trusted-clock expiry, path-safe failures, immutable snapshots/failures, invalid clocks/budgets, and decision/content/publication-stream regression.
