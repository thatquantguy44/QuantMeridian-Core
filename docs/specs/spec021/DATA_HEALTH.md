# SQZ Data Health contract and service

## Status and scope

This document defines the contract, service, operational-metadata, and restricted-view slices of SQZ-T10 for
synthetic Phase 1:

1. a strict, versioned Data Health response contract; and
2. a Data Ops-only in-process service that projects operational evidence from the T09 publication
   boundary; and
3. versioned dataset ownership, escalation, runbook, recommended-action, and last-success
   metadata; and
4. a Data Ops test-persona view that renders only the redacted contract.

The executable contract is [`dataHealth.ts`](../../../src/lib/squeezeRadar/dataHealth.ts), the
service is [`dataHealthService.ts`](../../../src/lib/server/squeezeRadar/dataHealthService.ts), and
serialized snapshots conform to
[`data-health-1.1.schema.json`](../../../contracts/squeeze_radar/v1/data-health-1.1.schema.json).
Version `1.1` adds required dataset-level `operations` metadata. Locally retained `1.0` snapshots
are upgraded on read without rewriting their append-only event rows; the original `1.0` schema is
retained as the historical contract.

This is not the T16 HTTP API. `SqueezeDataHealthService` is a server-side boundary that receives an
atomic publication health state: the latest attempt plus the current/retained/expired last-good
read. It retains only the redacted projection in local SQLite and returns a defensive copy. T16
will host the same response contract behind authenticated, same-origin terminal routes.

## Authorization boundary

Reads require both persona `DATA_OPS` and purpose `DATA_OPS`, with a valid entitlement interval at
the trusted service time. All other persona, purpose, and expired-entitlement combinations return
the same `NOT_FOUND` response. The response does not disclose whether a current or retained
publication exists.

The service accepts only `SIM` publications. It never exposes the publication's raw datasets,
internal book IDs, security-scoped coverage keys, reconciliation values, party names, positions,
prices, fees, rates, quantities, market values, or unrestricted evidence objects. Safe synthetic
provider/source/venue references are retained only when they match the dataset's registered
synthetic source allow-list, because Data Ops is authorized to see that bounded source lineage.
Source-controlled lookalikes, including a book ID placed in a source field, fail closed. It emits
no logs, telemetry, notifications, webhooks, or external model calls. The broader
Phase 1 no-automatic-egress policy continues to apply; a future governed user download/export is a
separate workflow.

## Response fields

| Field | Operational meaning |
|---|---|
| `contractVersion` | Data Health response version; currently `1.1`. |
| `dataMode` | Always `SIM` in Phase 1. |
| `policyVersion` | Publication policy that produced the evidence. |
| `asOf` | Trusted service time at which the state was captured or read. |
| `status` | `HEALTHY`, `DEGRADED`, `LAST_GOOD`, or `UNAVAILABLE`. |
| `evidenceBasis` | Whether dataset evidence came from the latest attempt, last-good, or neither. |
| `provenance` | Synthetic scenario, dataset/manifest versions, manifest digest, seed, and generator version for `evidenceBasis`. It is `null` only when that evidence has no validated synthetic provenance. |
| `attempt` | Latest publication attempt state, clocks, public failure code, and quality-gate failure reason. |
| `snapshotId` / `decisionAt` | Retained publication identity and latest attempted point-in-time decision clock where available. |
| `lastSuccessfulPublicationAt` | Most recent successful publication time known to the projection. |
| `lastGood` | Whether the current snapshot is current, retained, expired, or absent, plus bounded failure context. |
| `recovery` | Stable, pending, or recovered state and the preceding failure code. |
| `datasets[]` | Dataset-level safe source references, requirement, disposition, oldest required input, counts, freshness, coverage, operations, and issues. |
| `datasets[].operations` | Versioned Phase 1 owner role, escalation target, runbook identity/version, current action code/label, and last successful publication time. |
| `issues[]` | Rule, severity, disposition, reason code, affected policy source references, and bounded opaque record IDs. |

Issue record IDs are deduplicated, sorted, and capped at 50 per issue. `recordIdsTruncated` tells an
operator when additional affected IDs exist without allowing an unbounded diagnostic response.
Every source record ID is projected into the dedicated `sqzrec_<64 lowercase hex characters>`
namespace using HMAC-SHA-256 over the key ID, a separator, the dataset name, a separator, and the
source ID inside the server boundary. Public hashes would allow dictionary matching against
predictable book and source IDs. The service therefore requires a server-only `recordIdHmacKey`
of at least 32 UTF-8 bytes and a safe `recordIdHmacKeyId` of 1–32 characters. The caller must supply
a randomly generated secret through private configuration, retain it across restarts, and keep
it out of payloads and logs. T16 owns that runtime configuration; there is no default secret.
Raw source and book IDs never enter a Data Health snapshot. These deterministic handles support local
correlation within the platform; they are not permission to retrieve an underlying restricted
record through this service. Source identifiers outside the 256-character input limit and source
references outside the 128-character limit or outside the per-dataset registered SIM source set
fail closed instead of producing a schema-invalid response. Legacy `1.0` snapshots receive the
same record-ID projection and source allow-list validation during their upgrade. Unmarked `1.1`
journal payloads have their old public-hash handles keyed again during replay. These replayed
handles correlate within the same legacy dataset/handle namespace, not with newly projected raw
IDs. Newly captured journal rows use the strict storage-only envelope
`{ "recordIdProjection": "HMAC_SHA256_V1", "snapshot": ... }`; their handles replay unchanged.
Historical rows are not rewritten. Changing the configured key or key ID changes newly created
handles and legacy replay handles, while marked historical handles retain their original values;
cross-generation correlation is not promised. The public response contract remains `1.1`.

`oldestRequiredInputAt` is derived from the publication decision clock and the evaluated maximum
age for a required dataset. Freshness deadlines and configured budgets remain separate fields so
operators can distinguish “old data” from “past the approved deadline.” Coverage exposes counts
and ratios but deliberately excludes the underlying book- and security-scoped keys. Source
references are derived only from the point-in-time rows and allow-listed scopes evaluated by the
publication policy. For a multi-source dataset, each issue carries only the affected source(s),
not the entire raw-file source catalog. Issues with the same rule, severity, disposition, and
reason are merged before the 50-ID cap, so a
1,000-security fault does not produce a 1,000-row diagnostic shrug.

Operational actions are deterministic projections of the redacted issue category. Identity,
reconciliation, coverage, freshness, row-quality, and otherwise-unclassified required-input
failures map to separate bounded action codes. Accepted datasets map to `NO_ACTION`. The action
labels are registered application text; source data cannot inject an instruction into the UI.
The complete operator sequence and escalation boundary are in
[`DATA_HEALTH_RUNBOOK.md`](DATA_HEALTH_RUNBOOK.md).

## Lifecycle projection

| Publication read | Data Health result |
|---|---|
| Current accepted publication | `HEALTHY`, `lastGood.state=CURRENT`. |
| Current degraded publication | `DEGRADED`, `lastGood.state=CURRENT`. |
| Failed publication with usable prior snapshot | `LAST_GOOD`, `lastGood.state=RETAINED`, `recovery.state=PENDING`; dataset evidence comes from the rejected attempt when available. |
| Successful publication after retained/expired failure | Current health plus durable `recovery.state=RECOVERED` and the prior failure code. |
| Rejected attempt before any successful publication | `UNAVAILABLE`, `lastGood.state=NONE`; redacted rejected-attempt evidence remains visible. |
| No attempt and no successful publication | `UNAVAILABLE`, `lastGood.state=NONE`, no datasets. |
| Last-good exceeded the caller-supplied budget | `UNAVAILABLE`, `lastGood.state=EXPIRED`; no raw retained publication body is exposed. |

The caller must capture the publication service's atomic health state after each attempt. The
service does not query generators, CSV files, or calculation modules directly, and callers cannot
mutate retained state through a returned object.

Each redacted health snapshot is contract- and semantic-validated, then appended to the configured
SQLite file before it becomes the in-memory current state. Rows expire 400 days after capture and
are purged on service open and append. Restart reloads only a schema-valid snapshot with unique,
ordered dataset identities, registered source references, canonical timestamps, bounded metadata
and record handles, consistent status/last-good/evidence states, and operations metadata
recomputed from its evidence. Retained or expired failures require matching pending recovery
evidence so restart cannot erase the preceding failure. An input rejected before its clocks are
validated may have null attempt timestamps; a published attempt requires both timestamps. The
presentation fixture uses the same semantic validator in tests. T16 will configure the path under ignored
`.data/squeeze_radar/`; tests use either SQLite `:memory:` or an isolated temporary database.

## Phase 1 test view and T16 handoff

The restricted view is hosted in the existing `/dataops` experience. It shows status, SIM
provenance, last-good/recovery state, dataset disposition, freshness, coverage, versioned runbook
action, source lineage, and bounded opaque record handles. Disclosure rows use native keyboard-
operable details controls, and the layout stacks before the terminal sidebar constrains the
content column.

Until T16 supplies the authenticated same-origin transport, the UI controller uses a deterministic
SIM presentation adapter. That adapter returns the same non-enumerating `NOT_FOUND` response for
every non-Data-Ops test persona and provides defensive copies of a schema-valid `1.1` snapshot.
The view itself accepts only `SqueezeDataHealthReadResult`; it imports no generator, publication,
or calculation module. T16 replaces the adapter, not the view contract. The test-persona selector
is an operator test control and is explicitly not production authentication.

## Verification

Focused tests validate schema conformance, `SIM` provenance, rejected-attempt evidence,
policy-filtered issue-level source lineage, evidence-bound provenance, reconciliation aggregation,
enumeration-resistant authorization, opaque record-ID projection, redaction, the 50-ID bound,
semantic replay validation, atomic durable state, last-good expiry, durable recovery, 400-day
SQLite retention, and defensive copies:

```bash
npx vitest run src/lib/server/squeezeRadar/dataHealthService.test.ts --maxWorkers=1 --minWorkers=1
npx vitest run src/lib/squeezeRadar/dataHealthValidation.test.ts src/data/squeezeDataHealth.test.ts src/components/dataops/SqueezeDataHealthPanel.test.ts --maxWorkers=1 --minWorkers=1
npm run typecheck
```
