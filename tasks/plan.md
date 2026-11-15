# Implementation Plan: SQZ T09-T16 Synthetic Model and Service Boundary

## Overview

Complete the approved synthetic-only Squeeze Radar path from quality-gated publication through
versioned feature and signal snapshots, point-in-time evaluation, registry/rollback, Data Health,
and authenticated same-origin APIs. The terminal first consumes a `SqueezeRadarService` interface;
the same implementation contract is then hosted by one private TypeScript service at
`services/squeeze_radar_api`. No live source, displayed probability, promoted challenger, default
composite score, external notification, or automatic outbound data path is introduced.

## Architecture decisions

- Keep pure contracts, feature transforms, rules baselines, and evaluation logic in the existing
  TypeScript boundary under `src/lib/squeezeRadar` through T15.
- Expose one server-only `SqueezeRadarService` interface. Browser-facing code talks only to
  authenticated same-origin terminal routes; those routes may use either the in-process adapter or
  the private HTTP adapter without changing response contracts.
- Host one private Node/TypeScript service on `127.0.0.1:8019`; do not split ingestion, scoring,
  evaluation, and query into independent microservices.
- Persist only local SIM publications, registry state, saved views, and bounded health evidence in
  ignored `.data/squeeze_radar/`. Raw generated CSV remains in ignored `data/synthetic/`.
- Enforce persona and purpose at every server boundary. Cursors and caches bind to snapshot,
  persona, purpose, filters, sort, and custom-profile version.
- Do not add an outbound integration or a dependency that can transmit SQZ data. Governed user
  downloads remain outside this delivery slice.

## Dependency graph

```text
approved policy records
  -> quality/entitlement/reconciliation publication gate
  -> Data Health evidence
  -> point-in-time feature snapshots
  -> Borrow Stress / Squeeze Risk / Re-rate baselines
  -> evaluation harness and registry
  -> SqueezeRadarService contract
  -> authenticated API implementation
  -> private service extraction
  -> terminal client/UI migration and end-to-end verification
```

## Task list

### Phase A: approved policy and publication controls

#### Task 1: Record the approved Phase 1 policy package

**Description:** Update spec021 so every approved persona, score, horizon, outcome, evaluation,
storage, service, and API default is an explicit owner decision before it appears in behavior.

**Acceptance criteria:**
- [x] `SPEC.md`, `PLAN.md`, and `TASKS.md` agree on the approved policy and remaining non-goals.
- [x] Displayed probability is a named high-priority future improvement, not a Phase 1 output.
- [x] T09-T16 definitions of done reference concrete versioned policy artifacts.

**Verification:**
- [x] `git diff --check`
- [x] `npm run check:agent-skills-pin`

**Dependencies:** None

**Files likely touched:** `docs/specs/spec021/SPEC.md`, `PLAN.md`, `TASKS.md`

**Estimated scope:** Medium

#### Task 2: Enforce T09 point-in-time publication policy

**Description:** Add policy-injected current-material cohort construction, persona/purpose
authorization, internal book reconciliation, and security-scoped publication decisions.

**Acceptance criteria:**
- [x] Tests first reproduce stale, unit inversion, impossible utilization, coverage collapse,
      mapping failure, unauthorized purpose, and inventory/loan breaks.
- [x] Publication rejects or degrades only the affected security/product except for approved
      dataset-wide collapse.
- [x] The evaluator never reads truth data or fills a missing observation with zero.

**Verification:**
- [x] `npx vitest run src/lib/squeezeRadar/qualityGates.test.ts src/lib/squeezeRadar/publicationGate.test.ts src/lib/squeezeRadar/publicationGateAdapter.test.ts src/lib/server/squeezeRadar/publicationService.test.ts`
- [x] `npm run typecheck`

**Dependencies:** Task 1

**Files likely touched:** quality/publication contracts, focused tests, publication adapter

**Estimated scope:** Medium

#### Task 3: Add T10 Data Health and T10a consumer inventory

**Description:** Provide bounded, redacted operational evidence and document every current
consumer of the legacy squeeze demo data before changing its path.

**Acceptance criteria:**
- [x] Data Health traces source/record reason codes, quarantine, last-good, and recovery without
      logging book economics or party identifiers.
- [x] Consumer inventory names the squeeze page, utilization analytics/PDF, and sentiment/crowding
      dependencies with frozen or migration disposition.
- [x] Runbook metadata answers last success, oldest required input, coverage, and owner/action.

**Verification:**
- [x] Focused Data Health tests pass.
- [x] Focused consumer-regression tests pass.
- [x] `npm run typecheck`

**Dependencies:** Task 2

**Files likely touched:** Data Health module/tests and spec021 consumer/runbook documentation

**Estimated scope:** Medium

### Checkpoint A

- [x] Quality failures prevent unsafe publication.
- [x] Data Health explains the failure and last-good outcome.
- [x] Full existing test suite remains green.

**Verification:**
- [x] 147 SQZ-focused tests pass across publication, quality, identity, synthetic generation,
      consumer inventory, Data Health service, presentation adapter, and restricted view.
- [x] Full repository suite passes: 1,343 tests across 126 files.
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] `npm run check:agent-skills-pin`
- [x] Browser checks cover authorized and non-enumerating denied personas, native keyboard
      disclosure, opaque evidence, desktop/tablet/narrow layout, and console diagnostics.

### Phase B: point-in-time features and registered baselines

#### Task 4: Build T11 feature snapshots

**Description:** Materialize versioned, reproducible, point-in-time feature snapshots from named
SIM observations with source blocks, missingness, lineage, coverage, and reason-code inputs.

**Acceptance criteria:**
- [ ] Feature construction uses only revisions knowable at `decisionAt`.
- [ ] Hidden truth paths and truth-shaped inputs fail a leakage trap.
- [ ] Hand calculations reconstruct every emitted feature within documented tolerance.

**Verification:**
- [ ] Focused feature snapshot tests pass.
- [ ] `npm run typecheck`

**Dependencies:** Tasks 2-3

**Files likely touched:** feature contracts, feature builder, tests, feature policy JSON

**Estimated scope:** Medium

#### Task 5: Implement T12 Borrow Stress baselines

**Description:** Implement separate registered Market and Internal Borrow Stress rules models,
approved bands, reason codes, and private high-level custom profiles.

**Acceptance criteria:**
- [ ] Registered weights and 0-100 bands match the owner decision.
- [ ] Scores are monotonic in every stress input and unavailable when a hard block is absent.
- [ ] Custom current/deterioration splits are labeled `CUSTOM`, persona-private, lineage-bound, and
      barred from alerts, promotion, and official evaluation.

**Verification:**
- [ ] Focused monotonic, missing-block, transition, and custom-profile tests pass.
- [ ] Model cards reconstruct the registered scores.

**Dependencies:** Task 4

**Files likely touched:** Borrow Stress model/contracts/tests and model card

**Estimated scope:** Medium

#### Task 6: Implement T13 Squeeze Risk baseline and labels

**Description:** Implement the approved four-block rules baseline, 1/5/10-day modes, fixed
sector-adjusted outcome labels, activity confirmation, bands, and contextual reason codes.

**Acceptance criteria:**
- [ ] Default horizon is five days; all outputs carry their selected horizon.
- [ ] Active outputs contain rank and band but no probability.
- [ ] Estimated SI, options, ETF, and events cannot change the numeric v1 score.

**Verification:**
- [ ] Focused scoring, horizon, label, no-substitution, and no-probability tests pass.
- [ ] Model card states limitations and the future probability priority.

**Dependencies:** Tasks 4-5

**Files likely touched:** Squeeze Risk model/contracts/tests and model card

**Estimated scope:** Medium

#### Task 7: Implement T14 Re-rate Opportunity baseline

**Description:** Calculate same-currency opportunity candidates and append-only reviewed outcomes
using approved eligibility, gap, run-rate, and realization rules.

**Acceptance criteria:**
- [ ] Hand cases prove bps normalization and annualized gross run-rate.
- [ ] Currency mismatch or missing hard inputs is unavailable, never converted or zero-filled.
- [ ] Realized/partial/not-realized classifications use effective uplift and retained balance;
      rejected and unactioned candidates remain measurable.

**Verification:**
- [ ] Focused economic, eligibility, and outcome tests pass.
- [ ] Model card and outcome contract match calculations.

**Dependencies:** Task 4

**Files likely touched:** Re-rate model/contracts/tests and model card

**Estimated scope:** Medium

### Checkpoint B

- [ ] Every registered signal is reconstructible from one feature snapshot.
- [ ] Product dependency and missingness tests pass.
- [ ] No truth field is importable by feature or signal modules.

### Phase C: evaluation, registry, and service interface

#### Task 8: Implement T15 evaluation harness and registry

**Description:** Add deterministic expanding walk-forward evaluation, horizon purge and embargo,
baseline/challenger comparison reports, and append-only baseline activation/rollback state.

**Acceptance criteria:**
- [ ] Training/validation/test windows and threshold selection obey the approved policy.
- [ ] Reports retain delistings/corporate actions and expose coverage, lift, stability, workload,
      calibration metrics where applicable, and explicit SIM limitations.
- [ ] Challenger activation is impossible in Phase 1; rejected candidates cannot change the active
      version; rollback never rewrites history.

**Verification:**
- [ ] Focused leakage, survivorship, purge/embargo, rejection, and rollback tests pass.
- [ ] Deterministic rerun produces identical report and registry identities.

**Dependencies:** Tasks 5-7

**Files likely touched:** evaluation module/tests, registry module/tests, report contracts

**Estimated scope:** Medium

#### Task 9: Introduce the `SqueezeRadarService` interface

**Description:** Define typed service operations for publication, summary, board, name detail,
model cards, Data Health, evaluation, and persona-private saved views. Provide an in-process
adapter without exposing generators or calculation modules to consumers.

**Acceptance criteria:**
- [ ] Consumers compile against one interface with typed inputs, outputs, and errors.
- [ ] Boundary validation, pagination, allow-listed filters/sorts, and enumeration-resistant errors
      are contract-tested.
- [ ] Direct generator/model imports are absent from UI and API consumers.

**Verification:**
- [ ] Service contract and in-process adapter tests pass.
- [ ] `npm run typecheck`

**Dependencies:** Tasks 2-8

**Files likely touched:** service contract, in-process adapter, tests, public contract exports

**Estimated scope:** Medium

### Checkpoint C

- [ ] Model and registry suites pass.
- [ ] In-process service fulfills every interface contract.
- [ ] Full suite, typecheck, and production builds pass.

### Phase D: T16 authenticated API and single-service extraction

#### Task 10: Implement authenticated T16 query behavior

**Description:** Add summary, board, name detail, model-card, Data Health, and saved-view behavior
with persona/purpose authorization, stable errors, cursor binding, caps, cache partitioning, and
retention enforcement.

**Acceptance criteria:**
- [ ] Unauthorized, forged-persona, enumeration, cursor tamper/mismatch/expiry, page-cap, and
      saved-view reauthorization tests pass.
- [ ] Responses always include SIM provenance, decision/published times, source ages, versions,
      coverage, and policy projection.
- [ ] No API accepts a URL, external destination, or proxy request.

**Verification:**
- [ ] Focused API behavior and security tests pass.
- [ ] Load fixture meets the local p95 objective at the approved synthetic universe size.

**Dependencies:** Task 9

**Files likely touched:** API service methods, cursor/auth policy, saved-view store, tests

**Estimated scope:** Medium

#### Task 11: Extract one private TypeScript service

**Description:** Host the interface behind a localhost-only token-authenticated Node service at
`services/squeeze_radar_api`, with local SQLite state, structured correlation-safe telemetry, and
no outbound data path.

**Acceptance criteria:**
- [ ] Health/readiness and T16 endpoints run locally on port 8019.
- [ ] Service refuses missing/invalid tokens, non-SIM payloads, oversized inputs, and unsupported
      routes with generic typed errors.
- [ ] Network and destination inventory tests prove the implementation has no outbound SQZ sink.

**Verification:**
- [ ] Service unit and localhost integration tests pass.
- [ ] Service build and start smoke test pass.

**Dependencies:** Task 10

**Files likely touched:** service package entrypoint/config/store/tests and root scripts

**Estimated scope:** Medium

#### Task 12: Add terminal adapter and same-origin routes

**Description:** Implement an HTTP `SqueezeRadarService` adapter and terminal routes that select
in-process or private-service execution without changing contracts. Migrate current SQZ consumers
away from direct generator/calculation imports.

**Acceptance criteria:**
- [ ] Browser calls only same-origin `/api/securities-lending/squeeze/v1/...` routes.
- [ ] Service URL/token remain server-side and errors do not leak configuration or restricted data.
- [ ] Existing squeeze page behavior remains SIM-labelled while consuming the service contract.

**Verification:**
- [ ] Route/proxy/consumer regression tests pass.
- [ ] Browser smoke test shows no console or network errors and no direct service request.

**Dependencies:** Task 11

**Files likely touched:** HTTP adapter, terminal routes/tests, squeeze page/client

**Estimated scope:** Large; split by endpoint group if more than five files change per increment

#### Task 13: Complete documentation and end-to-end evidence

**Description:** Update service docs, model dictionary, handoff, runbooks, task status, and
validation evidence; exercise failure, last-good, rollback, auth, and no-egress paths end to end.

**Acceptance criteria:**
- [ ] `docs/services.md`, service README, model cards, Data Health runbook, spec/task status, and
      handoff describe the current runnable state and exact non-goals.
- [ ] CI runs focused SQZ service/model checks and the pinned-agent-skills check.
- [ ] Review finds no unresolved Critical or Required issue.

**Verification:**
- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run check:agent-skills-pin`
- [ ] `git diff --check`

**Dependencies:** Tasks 1-12

**Files likely touched:** service/spec/model docs, CI, validation index

**Estimated scope:** Medium

### Checkpoint D: complete

- [ ] All focused and full verification commands pass.
- [ ] Runtime smoke test covers in-process and private-service adapters.
- [ ] Independent adversarial and five-axis code reviews have no unresolved blockers.
- [ ] Human reviews the branch before merge or deployment.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Scope becomes one unreviewable PR | High | Commit each numbered task or smaller endpoint slice independently. |
| Synthetic truth leaks into features | High | Keep truth outside loader return types and add import/path trap tests. |
| Persona headers become fake security | High | Treat them as Phase 1 test identities, require server-side policy checks, and document replacement before live mode. |
| Service extraction duplicates model logic | High | Keep pure canonical TypeScript modules shared; adapters contain transport only. |
| SQLite/native build portability | Medium | Reuse the existing pinned root dependency and isolate persistence behind a store interface. |
| Cursor or cache crosses persona scope | High | Bind signatures/cache keys to persona, purpose, snapshot, filters, sort, and profile version. |
| Observability leaks restricted values | High | Allowlist bounded operational fields and test redaction with canaries. |
| Local synthetic SLO is mistaken for production evidence | Medium | Label reports local/SIM and prohibit live-performance claims. |

## Open questions

No product-policy question remains for this scope. Implementation discoveries that would alter an
approved threshold, entitlement, external boundary, or model meaning must return to the owner
rather than being inferred in code.
