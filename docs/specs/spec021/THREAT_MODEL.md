# Squeeze Radar threat model

- **Scope:** Phase 1 synthetic system and future-compatible boundaries
- **Method:** STRIDE plus abuse-case review
- **Data mode:** `SIM` only; live vendors and real internal books are deferred
- **Review state:** Technical controls and test mappings defined; owner approved no automatic external egress and governed user download/export as the sole exception; role names, retention, export limits, and security-owner approval remain decisions where noted

## Security objectives

1. A caller cannot retrieve a row, field, action, or export outside the server-authorized policy projection.
2. A cache, log, metric, URL, saved view, attempted external notification, or export cannot become a side door around the same policy.
3. Browser code never receives credentials, raw vendor payloads, hidden truth, or unrestricted internal-book fields.
4. Phase 1 rejects non-`SIM` data and cannot mix `SIM` and future `LIVE` provenance in one response, case, or export.
5. Every state-changing action is attributable, replay-safe, version-checked, and auditable.
6. Untrusted manifests, CSVs, future vendor responses, filters, cursors, IDs, and filenames fail closed at their boundary.
7. Ingestion begins when the first byte or record is accepted by any Market Terminal-controlled adapter or process, before parsing, validation, quarantine, diagnostics, or persistence. From that instant, raw observations and every derived SQZ artifact remain inside the platform unless an authorized user explicitly downloads or exports a policy-projected artifact.

## Assets

| Asset | Phase 1 classification | Required protection |
|---|---|---|
| Synthetic market observations and derived signals | Internal research, visibly `SIM` | Integrity, provenance, bounded access |
| Synthetic internal inventory, loan economics, owners, and counterparties | Restricted even though fictional | Row/field projection, no URL/log leakage |
| Hidden truth ledger | Generator/test-only | Never available to feature, scoring, API, UI, cache, or export paths |
| Scenario/model/configuration manifests | Privileged configuration | Versioning, digest, promotion audit, rollback |
| Alert/re-rate review state | Restricted workflow | Action authorization, concurrency, immutable audit |
| Export artifacts | Derived restricted data | Reauthorization, expiry, size cap, download audit |
| Future vendor credentials and payloads | Not present in Phase 1 | Server-only secret/payload boundary before live work |

Fictional data is not automatically public data. Using fake client economics as a reason to build a policy-free API would be a remarkably efficient way to rehearse a production breach.

## Trust boundaries

| Boundary | Untrusted input | Boundary control |
|---|---|---|
| Browser → same-origin SQZ API | Identity/session, route IDs, filters, sorts, cursors, saved-view IDs, action payloads | Authenticate; validate typed allow-lists; authorize row, field, and action on every request |
| API → service/cache/store | Caller policy, snapshot/version, query scope | Carry policy context; partition cache by policy projection and snapshot; cap results |
| Generator CLI/module → raw SIM bundle | Paths, JSON manifest, override values | Strict schema/manual validation, safe overlay resolution, bounded calendar, fictional-only policy, canonical digest |
| Raw CSV bundle → loader | Headers, primitive values, IDs, clocks, revisions, paths, provenance | Version dispatch, exact headers, JSON Schema, reference/clock checks, safe relative paths, reject non-`SIM` |
| Future adapter → normalization | Vendor/internal payloads, timestamps, units, methods, revisions | Server-only adapter, source schema, size/time limits, payload hash, quarantine; deferred |
| Service → logs/telemetry | Errors, filters, IDs, policy outcomes | Structured allow-list, opaque correlation IDs, no payloads/economics/credentials |
| Service → external destination | Notifications, webhooks, external APIs/out-of-boundary models, external analytics/telemetry | Deny outbound transmission; no destination configuration or payload-producing adapter; egress canary tests |
| Service → in-platform links/work queues | Evidence summaries and navigation state | Same-origin/internal routes only; opaque IDs; non-sensitive URL state; reauthorize on open |
| Service → export store/download | Visible result set, policy, snapshot, file lifecycle | Reauthorize at create and download; encrypt/expire; audit; no raw payloads or truth |

### Enforceable platform boundary

A component is inside the Market Terminal trust boundary only when all of the following are true:

1. It is named in the approved SQZ component-and-destination registry.
2. It runs under a platform-controlled workload identity and least-privilege authorization policy.
3. It is protected by private, deny-by-default network policy with no unapproved public outbound route.
4. Its storage, encryption, access audit, retention, backup, and deletion controls are platform governed.
5. It cannot relay SQZ payloads, identifiers, dimensions, or reconstructable derivatives to an unregistered destination.

The finite allow-set may include the same-origin SQZ UI/API, specifically registered internal modules, and registered internal databases, caches, queues, object stores, backups, export-staging stores, and model runtimes. A managed service or third-party model is not automatically internal: it qualifies only when deployed in the platform-controlled account/project, satisfies every boundary condition, and has provider telemetry, remote callbacks, update reporting, prompt logging, and external inference disabled. Vendor SaaS, externally hosted models, external observability, CI artifacts, and support tooling are outside the boundary unless a later owner-approved architecture brings a specific component inside all five controls; that architecture cannot create a new egress exception.

Export generation and staging remain inside the boundary. Data crosses the boundary only when an authorized user explicitly downloads the policy-projected artifact. CI, support, and diagnostic tooling must not receive ingested/live SQZ data; synthetic test fixtures remain subject to repository policy. T03/T27 must publish and attest the registry before the boundary is relied on in production.

For a future live feed, source acquisition and the post-acceptance data plane must be isolated. The egress restriction starts at the first byte or record accepted by a Market Terminal-controlled adapter or process, so receipt buffers, parsing failures, rejected rows, quarantine records, and diagnostics cannot be classified as "pre-ingestion" and emitted externally.

## Access model

The final organization-specific role names are unresolved. Implementation must use policy capabilities rather than hard-coded role labels.

| Capability | Market-level SIM | Restricted internal-book SIM | Hidden truth | State changes | Export |
|---|---:|---:|---:|---:|---:|
| Research projection | Allow | Deny | Deny | Deny | Owner decision |
| Internal desk projection | Allow | Scoped rows and fields | Deny | Explicit action capability | Explicit export capability |
| Compliance/risk projection | Allow | Read-only approved fields | Deny | Review/disposition capability only | Owner decision |
| Data operations projection | Operational metadata | Redacted economics | Deny | Quarantine/recovery only | Deny by default |
| Generator/test process | Generated inputs | Generated inputs | Local test access | No workflow action | No user export |

Mandatory rules:

- Server authorization selects rows, fields, actions, and exportability separately; possession of a row ID grants nothing.
- A saved view stores intent, not authority. Loading it re-evaluates current policy.
- Counts, errors, and pagination cannot reveal the existence of unauthorized records.
- Denial is the default for new fields and actions.
- Synthetic mode does not waive authorization architecture; it exercises it without real confidential data.

## STRIDE analysis

| Threat | Abuse case | Required control | Verification ID |
|---|---|---|---|
| Spoofing | Caller reuses or fabricates an identity/session to view a desk projection | Repository-standard authentication; server-derived principal; no caller-supplied role | `SQZ-SEC-001` |
| Spoofing | A future inbound adapter impersonates an approved data source | Workload identity/secret store and inbound-source allow-list; no browser credential | `SQZ-SEC-002` |
| Tampering | Manifest/CSV is edited after generation or a replay claims another configuration | Canonical manifest SHA-256 in bundle manifest; exact schema/version; lineage checks | `SQZ-SEC-003` |
| Tampering | Caller changes hidden sort/filter/cursor fields to query unapproved data | Typed field allow-lists and snapshot-bound signed/opaque cursors | `SQZ-SEC-004` |
| Repudiation | User denies export, case transition, re-rate disposition, or config promotion | Append-only audit ID, actor, effective policy/model version, idempotency key, aggregate version | `SQZ-SEC-005` |
| Information disclosure | Unauthorized row is inferred through 404/403 differences, totals, or cursor behavior | Enumeration-resistant response policy and post-authorization counts | `SQZ-SEC-006` |
| Information disclosure | Internal economics leak through cache reuse | Cache key includes principal/policy projection, snapshot, field set, mode, and contract version; private/no-store where unsafe | `SQZ-SEC-007` |
| Information disclosure | IDs, filters, economics, vendor payloads, or credentials enter logs/traces | Structured redaction allow-list and telemetry audit; generic client errors | `SQZ-SEC-008` |
| Information disclosure | Deep link or browser storage contains owner/counterparty/book filters | URL permits only non-sensitive view/as-of/security state; restricted filters remain owner-scoped server state | `SQZ-SEC-009` |
| Information disclosure | A user download/export contains fields the requester cannot view | Policy projection plus reauthorization at create and download | `SQZ-SEC-010` |
| Information disclosure | Truth labels leak into model inputs and produce suspiciously prophetic scores | Physical `_truth/` separation and model loader that never reads or types truth | `SQZ-SEC-011` |
| Denial of service | Unbounded universe, dates, filters, pages, exports, or malformed CSV exhaust resources | Manifest bounds, page/export caps, timeouts, asynchronous exports, request/body limits | `SQZ-SEC-012` |
| Elevation of privilege | Caller invokes case/export/config action because UI hid the button imperfectly | Server-side action capability and transition/version checks on every command | `SQZ-SEC-013` |
| Elevation of privilege | `SIM` path accepts a future `LIVE` payload or mixes modes | `data_mode` const, mode-specific loaders/configuration, no fallback or mixed response | `SQZ-SEC-014` |
| Elevation of privilege | Manifest `extends` reads an arbitrary local file | Sibling-only safe resolution, cycle detection, JSON-only names | `SQZ-SEC-015` |
| Information disclosure | SQZ inputs, rejected/quarantined records, diagnostics, derivatives, evidence, cases or prompts are sent to email/chat/webhooks, an external API/model, or payload-bearing telemetry | Deny-by-default outbound network policy from first-byte/record acceptance; finite destination allow-set; no external sink interfaces; only governed user download/export is excepted | `SQZ-SEC-016` |

## High-priority abuse cases

### Row and field enumeration

An attacker changes security, owner, counterparty, book, case, review, saved-view, or export IDs and compares status codes, totals, timing, and pagination. The service must authorize before materializing the response and use one non-enumerating not-found policy. Fields are projected from a server allow-list after row authorization.

### Cache-policy collision

Two authenticated users request the same URL but have different book/field scopes. A cache keyed only by URL serves the broader response to the narrower user. Shared caching is prohibited until `SQZ-SEC-007` proves policy-partitioned keys and denial behavior; otherwise restricted routes use private/no-store responses.

### Log and diagnostic exfiltration

Malformed CSV/vendor payloads or rejected filters cause an exception that logs the raw record, query, filesystem path, token, owner, counterparty, or economics. Errors must carry stable codes and opaque correlation IDs. Tests capture logs and assert restricted canaries are absent.

### Unsafe deep links and saved views

A user shares a URL containing a restricted owner/book filter, or an old saved view survives an entitlement change. URLs may contain only the reviewed non-sensitive state. Saved views are owner-scoped, policy-safe intent and must be reauthorized on every load.

### Export time-of-check/time-of-use

Authorization changes after export creation but before download. Both operations must reauthorize; the stored artifact contains only the creation-time visible projection, expires, and cannot be guessed by sequential ID. Cancel, expiry, denial, and failed generation remain audited.

### Notification fan-out

An alert is valid internally but a Slack, email, webhook or other external destination would move SQZ data outside the platform. Such delivery is prohibited, not merely disabled pending configuration. Alerts remain in same-origin UI and internal work queues. A deep link may contain only non-sensitive routing state and must reauthorize the user when opened.

### External model, API and telemetry exfiltration

An external summarizer/model, analytics SDK, error reporter or seemingly harmless webhook receives raw observations, rejected/quarantined records, identifiers, derived signals, evidence text, cases or prompts. From first-byte/record acceptance, SQZ code must have no payload-producing external sink and must operate under a deny-by-default outbound network policy. Third-party model software may be used when its complete runtime is inside the attested boundary and no prompt, feature, output, telemetry, diagnostic, or derived value can reach its provider or another external destination. Operational monitoring may expose only generic counters and status codes that contain no SQZ values, identifiers, dimensions or reconstructable derivatives. Registered in-platform services may receive a least-privilege projection over authenticated internal routes. An authorized user's explicit export/download is handled separately by the governed export lifecycle.

### Screenshot and external-share bypass

A platform screenshot, report-share, or copy-to-external-destination feature would create an ungoverned transfer path, so SQZ must not implement one. Operating-system or browser capture cannot be reliably blocked by this web application; if production policy must prohibit that user behavior, endpoint controls, DLP, and organizational policy are required. This limitation does not authorize an SQZ sharing feature and does not turn capture into a governed export.

### Vendor payload and methodology injection

A future provider returns malformed structure, unexpected units, HTML/instruction-like text, huge payloads, redirects, or changed methodology. Adapters treat every response as untrusted data; validate source-native schema and bounds server-side, encode display text, forbid request-time browser/vendor fan-out, quarantine methodology drift, and never execute payload text. Live implementation remains deferred.

### SIM/LIVE and truth contamination

A malformed manifest declares `LIVE`, an adapter reuses a SIM source ID, or scoring imports `_truth`. Phase 1 schemas constrain `data_mode` to `SIM`, the loader excludes truth, and future live work requires a separately versioned contract and isolated configuration. No fallback crosses modes.

## Control-to-test matrix

| Verification ID | Required evidence | Owning task | Current state |
|---|---|---|---|
| `SQZ-SEC-001` | Unauthenticated, expired-session, and forged-role matrix | T16/T27 | Planned; auth contract unresolved |
| `SQZ-SEC-002` | Server-only credential and approved inbound-source identity tests | T23/T27 | Deferred with live adapters; outbound notification credentials are prohibited |
| `SQZ-SEC-003` | Manifest digest, exact-header, version-dispatch, revision, and lineage tests | T05a/T06/T09 | Implemented for generator/CSV boundary |
| `SQZ-SEC-004` | Filter/sort allow-list and cursor tamper/mismatch tests | T16 | Planned |
| `SQZ-SEC-005` | Idempotency, stale-writer, audit reconstruction tests | T21/T22/T24/T29 | Planned |
| `SQZ-SEC-006` | Cross-owner ID enumeration and count/timing response matrix | T16/T22a/T24/T27 | Planned |
| `SQZ-SEC-007` | Two-principal cache collision and response-header tests | T16/T27 | Planned |
| `SQZ-SEC-008` | Log/trace canary redaction and generic-error tests | T16/T24/T27 | Planned |
| `SQZ-SEC-009` | Sensitive-filter URL/storage and saved-view reauthorization tests | T16/T18/T27 | Planned |
| `SQZ-SEC-010` | Export field projection plus create/download reauthorization tests | T24/T27 | Governed user export planned; external notification path prohibited |
| `SQZ-SEC-011` | Truth-file corruption does not affect loader; no truth fields/types in model inputs | T05a/T06/T11 | Loader isolation implemented; feature-path trap planned |
| `SQZ-SEC-012` | Manifest bound, page cap, export cap, timeout, and load tests | T06/T16/T24/T28 | Calendar/output bounds and constant-time publication-delay guard implemented; service tests planned |
| `SQZ-SEC-013` | Server-side action-role and invalid-transition matrix | T21/T22/T24/T27 | Planned |
| `SQZ-SEC-014` | Non-`SIM` rejection and mixed-provenance response/case/export tests | T06/T17/T22/T24/T27 | Input rejection implemented; downstream tests planned |
| `SQZ-SEC-015` | Overlay traversal, cycle, unknown-field, and unsafe-path tests | T05a/T06 | Canonical containment plus traversal, cycle, symlink-escape, and unknown-field regressions implemented |
| `SQZ-SEC-016` | First-byte/record acceptance tests; registered-destination inventory/attestation; external email/chat/webhook/API/model/telemetry and rejected-row/diagnostic canaries; outbound-network denial; positive same-origin/internal-route and user-export exception tests | T16/T23/T24/T27 | Policy approved; enforcement and end-to-end evidence planned |

## Security decisions still required

The following are deliberately not encoded as defaults:

1. Identity provider/session contract and capability-to-role mapping.
2. Desk/book/owner scoping source and policy administrator.
3. Restricted-field catalog, redaction shape, and enumeration response policy.
4. Cache provider, allowed shared-cache surfaces, TTLs, and invalidation policy.
5. Saved-view store and permitted deep-link state.
6. Audit store, retention, tamper evidence, and correlation-ID policy.
7. Export size/retention/encryption limits and download authorization window. User-initiated governed export is approved in principle; its limits remain open.
8. Live vendor credential, payload-retention, licensing, and deletion controls for inbound ingestion. They cannot authorize outbound transmission after first-byte/record acceptance.
9. Endpoint/DLP policy for OS/browser capture if production policy must prohibit user-created screenshots outside application control. SQZ itself will not provide screenshot or external-share features.

No later task may resolve one of these by quietly inventing a threshold, role, or retention period in code. Record the owner decision first.
