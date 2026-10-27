# Tasks: Production Squeeze Radar

- **Spec:** [SPEC.md](SPEC.md)
- **Plan:** [PLAN.md](PLAN.md)
- **Status:** Phase 1 synthetic scope approved; generator parameters and remaining product/model/workflow decisions are open; live integration tasks are deferred
- **Last updated:** 2026-10-24

Tasks are ordered risk-first and contract-first. Each slice must remain disabled by default until its own acceptance evidence exists. “Done” below means merged code plus evidence, not merely code written.

## Phase 0 — synthetic decisions and contracts

| ID | Task | Covers | Definition of done | Status |
|---|---|---|---|---|
| SQZ-T01 | Record the synthetic-only Phase 1 decision; resolve users, generator parameters, signal/outcome gates and the single simulated alert/review system of record; name product, model, security and operational owners. | Phase 1 gates | Synthetic scope decision is logged; remaining decisions become versioned records containing exact metrics, thresholds, sample windows, approvers and evidence paths. | in progress — synthetic scope done |
| SQZ-T02 | Inventory candidate real sources and complete a field-level rights matrix for future ingestion, retention, derived use, model training, display, governed export, and the prohibition on platform screenshot/share features. | Future SQZ-003, 011, 017, 020; AC-014 | Legal/data-governance sign-off before any live phase begins; any restriction on OS/browser capture is assigned to endpoint/DLP policy rather than claimed as an application control. | deferred — live phase |
| SQZ-T03 | Define versioned schemas for observation envelopes, identities, source-native market data, internal book/events, features, signals, model cards, the selected alert projection, re-rate reviews/events, saved views, policy projections, errors, and export jobs. | SQZ-001–005, 011, 012 | JSON schemas plus TypeScript/service types; parity and compatibility tests; hand-authored fixtures for every state. | in progress — normalized SIM CSV inputs have generated JSON Schema, TypeScript types and strict loader tests; future real-feed field/envelope requirements are documented but no LIVE schema is approved; feature/API/workflow/output contracts remain |
| SQZ-T04 | Produce a source-methodology dictionary and semantic test vectors for utilization, fees/rebates, availability, short-interest types, short-sale volume, DTC, price adjustments, and options measures. | SQZ-003–006; AC-003 | Data/product owner approval; unit and convention vectors catch the known utilization and short-volume/SI confusions. | in progress — versioned dictionary, executable vectors and evaluator tests implemented; data/product-owner approval remains |
| SQZ-T05 | Threat-model row/field/action/export access, caching, logs, notifications, deep links, vendor payload handling and outbound data egress. | SQZ-011, 019–021; AC-005, 019 | Security review with abuse cases and required controls mapped to tests. | in progress — STRIDE boundaries, abuse cases and control/test IDs documented; owner approved no automatic external egress with governed user download/export as the sole exception; remaining role/retention/security-owner decisions and later-surface evidence remain |
| SQZ-T05a | Define the versioned synthetic scenario manifest, fictional universe, named random streams, latent regimes, event/fault library, publication schedules, cross-domain invariants and hidden truth ledger. | SQZ-001–006, 012–015 | Owner-approved generator contract; small golden manifests and large-demo parameters; explicit prohibition on real identities and truth features. | in progress — schemas, base/fault/large-demo manifests, regimes, schedules, fixed invariants, named streams, fault library and isolated truth complete; owner parameter approval remains |

**Phase gate:** T01 and T03–T05a define an entirely SIM contract before generator or UI work. T02 is not a Phase 1 blocker.

## Phase 1 — realistic synthetic data foundation

| ID | Task | Covers | Definition of done | Status |
|---|---|---|---|---|
| SQZ-T06 | Implement the deterministic scenario engine and domain generators with schema validation, mandatory `firstKnowableAt`, named random streams, revisions, fault injection, lineage and `SIM` provenance. | SQZ-001, 003–006, 012–015 | Same manifest/seed reproduces byte-stable fixtures; optional-domain changes do not perturb other streams; late/out-of-order records, backfills, post-decision revisions, bad units and stale sources are generated on demand. | implementation complete — manifest-driven engine, canonical replay digest, named stateless streams, all required faults, 1.0/1.1 loader dispatch and focused evidence implemented; merge pending |
| SQZ-T07 | Implement effective-dated issuer, security, share-class and listing identities plus event-specific corporate-action lineage. | SQZ-002; AC-002 | Golden fixtures define distinct expected mappings for symbol reuse/change, merger, split, spin, ADR conversion, share-class change, dual listings, ETF, delisting and ambiguous quarantine. | implementation complete — separated point-in-time identity catalog, event-specific lineage reconciliation, ambiguity/invalid/mismatch quarantine and executable golden suite implemented; normalized CSV publication integration completed by T08 |
| SQZ-T08 | Publish point-in-time SIM histories and last-good snapshots through local future-compatible contracts. | SQZ-003, 006, 018 | `firstKnowableAt` queries reproduce the eligible revision at every fixture timestamp; the service rejects non-SIM input and no external database is required. | implementation complete — loader-branded SIM publication contract, deterministic point-in-time/provenance identities, trusted-clock in-memory last-good retention, caller-supplied freshness budget and fail-closed behavior implemented; authenticated HTTP routes remain T16 |
| SQZ-T09 | Implement quality, freshness, entitlement-purpose, and internal inventory/loan reconciliation gates. | SQZ-006, 015; AC-001, 010 | Failure-injection suite catches staleness, mapping break, unit inversion, impossible utilization, coverage collapse, and book breaks before publication. | in progress — schema, provenance, identity, revision and clock gates plus the v1 quality-decision contract, policy-injected quality/freshness/coverage evaluator, configurable synthetic weekday freshness policy, and versioned dataset-grain coverage policy with systemic collapse below 75% are complete; point-in-time cohort adapter/publication enforcement, entitlement-purpose, book reconciliation and remaining fault cases remain |
| SQZ-T10 | Build Data Health service and restricted operational view with ownership/runbook metadata. | SQZ-015, 018 | Data Ops can trace a failed row from source to quarantine and confirm recovery/last-good behavior. | todo |
| SQZ-T10a | Inventory all consumers of `src/data/squeeze.ts` and approve a frozen SIM compatibility or explicit migration path for each. | SQZ-001, 016 | Squeeze, utilization page/analytics, utilization PDF and sentiment/crowding dependencies are mapped; regression snapshots prove untouched consumers remain unchanged. | todo |

**Phase gate:** Golden and large-demo manifests pass identity, accounting, clock, distribution, regime, fault, negative-control and truth-ledger isolation tests with no unresolved severity-1 synthetic-data defects.

## Phase 2 — baseline signals and validation harness

| ID | Task | Covers | Definition of done | Status |
|---|---|---|---|---|
| SQZ-T11 | Implement versioned feature snapshots with source blocks, cohorts, missingness, lineage, reason-code inputs and point-in-time joins; exclude the hidden truth ledger from all feature paths. | SQZ-003–006, 012 | Hand calculations, truth-leakage traps and manifest reconstruction pass; a feature snapshot is reproducible from named SIM observations. | todo |
| SQZ-T12 | Implement the transparent Borrow Stress baseline and lifecycle bands. | SQZ-004, 006, 012; AC-004 | Monotonic/hand-case tests, missing-block gates, transitions, stability report, model card. | todo |
| SQZ-T13 | Implement the transparent Squeeze Risk baseline with owner-approved labels and horizons. | SQZ-004, 005, 012–014 | Held-out-manifest walk-forward report includes calibration, PR/lift, simple baselines, cohort stability and limitations; no truth feature or short-volume substitution. | todo |
| SQZ-T14 | Implement the Re-rate Opportunity baseline and outcome capture contract. | SQZ-004, 011, 014; AC-009 | Hand cases prove rate normalization and gross estimate; restrictions/capacity are visible; realized outcomes require an entitled review record. | todo |
| SQZ-T15 | Build the reusable point-in-time evaluation harness and model registry/promotion/rollback workflow. | SQZ-012–014; AC-007, 008, 012 | Delisting/corporate-action, purging/embargo, revision and threshold-selection traps pass; rejected challenger leaves active version unchanged. | todo |

**Phase gate:** Model/data reviewers approve the three separate SIM baseline cards across held-out manifests, seeds and regimes. Reports explicitly state synthetic performance is not evidence of live efficacy.

## Phase 3 — authorized API and core user journey

| ID | Task | Covers | Definition of done | Status |
|---|---|---|---|---|
| SQZ-T16 | Implement authenticated summary, board, name detail, model-card, data-health and owner-scoped saved-view APIs with snapshot-bound cursors, filter/sort allow-lists and typed errors. | SQZ-007–009, 011, 018, 020, 021 | Contract, authorization, enumeration, cursor mismatch/expiry, saved-view reauthorization, page-cap, cache-partition, no-external-proxy and performance tests pass at approved universe size. | todo |
| SQZ-T17 | Replace direct generator imports on the existing page with the versioned SIM contract client and reserve a disabled, isolated future-live configuration. | SQZ-001, 007; AC-001 | Phase 1 rejects non-SIM responses; future-live mode cannot import SIM; every loading/empty/stale/unavailable/redacted/error state has a test. | todo |
| SQZ-T18 | Deliver the Decision Board, shared evidence drawer, policy-safe saved views and responsive/accessibility behavior. | SQZ-007, 009 | Keyboard/screen-reader, color-independent state, sensitive-filter/deep-link, virtualization and visual-regression checks pass. | todo |
| SQZ-T19 | Deliver Borrow Stress/Specials and Supply & Recall views plus name timeline. | SQZ-008, 009, 016 | Every chart exposes units, clocks, source age, seed and evidence; any SLAB context is generated SIM data through the contract, not a live join. | todo |
| SQZ-T20 | Deliver Squeeze Risk, Events, Sector/Issuer/ETF Network and Model & Backtest views. | SQZ-008, 009, 013, 014, 016 | Claims match approved model cards; lagged/contextual data is unmistakable; no causal/manipulation wording. | todo |
| SQZ-T21 | Deliver Re-rate Opportunity view and append-only, version-checked human disposition/outcome capture without changing loan economics. | SQZ-008, 009, 011, 014, 019 | Same-currency annualized run-rate, eligible loans, capacity, constraints and review events reconcile to APIs; rejected/unactioned outcomes remain measurable; no execution or fee mutation endpoint exists. | todo |

**Phase gate:** Named users complete research-board and desk-shadow UAT; external notifications remain prohibited and governed exports are not enabled yet.

## Phase 4 — alert workflow, governed export, and internal integrations

| ID | Task | Covers | Definition of done | Status |
|---|---|---|---|---|
| SQZ-T22 | Implement or adapt the owner-approved alert episode state machine with hysteresis, dedupe/cooldown, idempotency, optimistic concurrency, rule-version carry-forward, license-aware trigger evidence and audit. | SQZ-010, 019; AC-006 | Deterministic replay, retry, stale-writer, snooze/reopen and rule-promotion tests pass; only the selected workflow store mutates state; revised/expired source data follows evidence policy. | todo |
| SQZ-T22a | Deliver the Alerts & Cases UI against the authoritative workflow projection. | SQZ-008, 010, 011 | Queue, assignment, acknowledgement, snooze, resolution, conflict and redacted states pass role-based UI/E2E tests. | todo |
| SQZ-T23 | Add least-privilege read-only adapters to ALERTS, DATAOPS, NEWS and Market Lens only where those services are named in and satisfy the attested Market Terminal boundary registry. External notifications, webhooks and transmission to external services or out-of-boundary models are prohibited; in-boundary third-party model runtimes are allowed when every external data/telemetry path is disabled. | Future SQZ-016, 020, 021 | Ownership is non-duplicative; internal projection tests pass; registry attestation and outbound egress canaries prove no SQZ payload or derivative reaches an external destination. | deferred — live phase |
| SQZ-T24 | Implement asynchronous SIM export creation/status/download/cancel lifecycle with expiry and audit. | SQZ-011, 017, 019; AC-005 | Export generation and staging remain inside the attested boundary; export revalidates policy at creation and download; contains only visible fields with `SIM`, manifest/seed/version/disclosures and size caps; expiry/cancel/failure/denial tests pass. | todo |
| SQZ-T25 | Run alert-threshold shadow tuning against the approved operating capacity, without changing model weights from reviewer outcomes. | SQZ-010, 014 | Workload, precision, acknowledgement time and missed-event review meet owner-approved gates; changes are versioned and reviewed. | todo |

**Phase gate:** Product owner approves SIM language, workload, evidence retention and escalation behavior. No external notification destination exists; authorized user downloads/exports use only the governed T24 flow.

## Phase 5 — synthetic release hardening

| ID | Task | Covers | Definition of done | Status |
|---|---|---|---|---|
| SQZ-T26 | Instrument service/data/model SLOs, dashboards, alerts and runbooks; complete source-outage, late-batch, cache-loss and replay drills. | SQZ-015, 018 | Measured recovery and last-good behavior meet approved SLO; every page links to current health. | todo |
| SQZ-T27 | Complete Phase 1 policy/security assessment, component-and-destination registry/attestation, log/telemetry/egress audit and least-privilege deployment; prove no real/confidential input is accepted and no SQZ data can leave through an automated external channel from first-byte/record acceptance. | SQZ-011, 019–021 | All critical/high findings closed; SIM-only boundary, finite destination registry, role/action matrix, outbound network deny policy, rejected-row/diagnostic canaries and egress-canary suite pass end to end; only T24 user downloads/exports are allowed. | todo |
| SQZ-T28 | Load/performance/accessibility/resilience test the approved universe and worst authorized views/exports. | SQZ-007–009, 017, 018 | Board/detail/export objectives pass with documented capacity headroom and bounded degradation. | todo |
| SQZ-T29 | Exercise signal/config rollback, data replay, disaster recovery and audit reconstruction. | SQZ-012, 015, 018, 019; AC-012 | Timed game day restores service and reconstructs an alert/export without rewriting history. | todo |
| SQZ-T30 | Write Phase 1 validation, limitations, operations, synthetic data dictionary, model cards and user guide; replace the prototype note's authority with this approved synthetic spec. | All Phase 1 items | Every applicable requirement/AC/synthetic gate maps to evidence; docs state that results are simulated and live claims remain untested. | todo |
| SQZ-T31 | Owner-controlled synthetic release and post-launch review. | All Phase 1 items | Flags enable only SIM mode for approved users; 1/7/30-day reviews cover generator quality, workload, incidents, calibration and rollback readiness. | todo |

## Requirement and acceptance coverage

Each later task references the approved decision IDs produced by T01 and writes its named test/report output into the validation index owned by T30.

| Contract item | Primary tasks | Required evidence |
|---|---|---|
| SQZ-001 | T03, T10a, T17 | Production/SIM isolation tests and consumer regression snapshots |
| SQZ-002 | T07 | Identity and corporate-action golden suite |
| SQZ-003 | T02–T04, T06, T08 | Schema parity, clock/revision and lineage fixture report |
| SQZ-004 | T11–T14 | Three independent signal model cards and hand-case tests |
| SQZ-005 | T04, T06, T11, T13 | Same-source/date collision and no-cross-kind-fallback tests |
| SQZ-006 | T09, T11–T14 | Product/projection dependency-matrix failure-injection suite |
| SQZ-007 | T16, T18 | Board API/UI, cursor and saved-view evidence |
| SQZ-008 | T19–T22a | View-by-view UI/E2E evidence index |
| SQZ-009 | T16, T18–T21 | Point-in-time name-detail reconstruction test |
| SQZ-010 | T01, T22, T22a, T25 | Workflow decision plus replay/concurrency/workload reports |
| SQZ-011 | T02, T05, T14, T16, T21–T24, T27 | End-to-end entitlement and redaction matrix |
| SQZ-012 | T03, T11–T15, T29 | Registry/version/rollback game-day report |
| SQZ-013 | T06–T08, T11, T15 | Leakage, survivorship, purging and embargo report |
| SQZ-014 | T13–T15, T21, T25 | Calibration/baseline/workload/economic outcome reports |
| SQZ-015 | T09, T10, T15, T26 | Data/service/model dashboards and incident drills |
| SQZ-016 | T10, T10a, T19, T20, T23 | SLAB/ALERTS/DATAOPS/NEWS/Market Lens ownership tests |
| SQZ-017 | T02, T24, T28 | Export rights and lifecycle test report |
| SQZ-018 | T01, T08, T16, T26, T28 | Decision-bound SLO/load/resilience reports |
| SQZ-019 | T21–T24, T27, T29 | Audit reconstruction and tamper-evidence report |
| SQZ-020 | T05, T06, T16, T23, T27 | Secrets, same-origin, boundary validation and security report |
| SQZ-021 | T05, T16, T23, T24, T27 | Outbound-network deny policy, external-sink canary matrix and governed-export exception report |
| AC-001 | T09, T17 | Required-source outage E2E test |
| AC-002 | T07 | Event-specific identity golden suite |
| AC-003 | T03, T04, T06, T11, T13 | Official/estimated/volume separation across store/API/UI/export/backtest |
| AC-004 | T11–T14 | Deterministic reconstruction and reason-code test |
| AC-005 | T05, T16, T24, T27 | Unauthorized retrieval/enumeration matrix |
| AC-006 | T22, T22a | Replay, retry, concurrency, promotion and evidence-retention suite |
| AC-007 | T06–T08, T15 | Late-ingest/backfill/revision leakage and cohort report |
| AC-008 | T13, T15 | Calibration, baseline rejection and active-version test |
| AC-009 | T14, T21 | Same-currency run-rate and reviewed-outcome hand cases |
| AC-010 | T09, T10 | Five required data-failure detections |
| AC-011 | T01, T16, T28 | Decision-bound API SLO and pagination/load report |
| AC-012 | T15, T29 | Rollback without history rewrite game day |
| AC-013 | T20, T25, T30 | Compliance copy inventory and alert-language review |
| AC-014 | T02, T06, T22, T24, T27 | Rights, expiry/tombstone, revocation and export review |
| AC-015 | T05a, T06, T11, T22 | Fixed-seed and named-stream replay suite |
| AC-016 | T04, T06–T09 | Cross-domain invariant and quarantine report |
| AC-017 | T05a, T11–T15, T30 | Truth-isolation, held-out-manifest and synthetic-claims report |
| AC-018 | T05a–T08, T17–T24, T27, T30 | Fictional-identity and end-to-end SIM provenance suite |
| AC-019 | T05, T16, T23, T24, T27 | Same-origin/internal-path allow tests, external notification/API/model/telemetry deny tests and authorized export exception audit |

## Definition of done for every slice

- The task changes one reviewable contract or vertical user outcome and remains rollback-friendly.
- Tests fail before behavioral implementation where applicable and cover unhappy paths, authorization and unavailable states.
- No source, threshold, model choice, or operating policy is inferred from this draft when an owner decision is still open.
- Required schema, runbook, model-card, data-dictionary and user-facing disclosure changes ship with the code.
- Existing tests, type checks, lint, production build and task-specific checks pass.
- The diff receives independent technical review and `code-review-and-quality` review before merge.
- Evidence is linked in a validation record; “works on SIM” is not production evidence.
