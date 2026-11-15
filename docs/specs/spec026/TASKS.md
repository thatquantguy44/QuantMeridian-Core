# Spec026 implementation backlog

**Status:** Updated 2026-11-01. Documentation plus the approved co-located model/
separate health-only service scaffold and a source-inspection terminal preview are
delivered. Numerical tasks remain open.
An open decision blocks its
dependent task; it is not permission to adopt the recommendation silently.
Verification keys V1–V6 refer to [PLAN.md](PLAN.md#verification-commands), which
distinguishes existing checks from future test/CLI commands.

Keep each task to one focused session and approximately five implementation files
or fewer. Listed paths are proposed targets; split any slice that exceeds that
budget. Include independent tests in that budget and run each slice before moving
on. Model files live in the independently installable `models/portfolio_regime/`
project in this checkout; service code stays in `services/portfolio_regime_api/`.

## R0 — Design and owner decisions

- [x] **PORA-DOC:** Inspect all four notebook sources; draft parent/capability specs,
  data contract, architecture proposals, tasks, roadmap and agent/source evidence.
  - Acceptance: all requested documents exist and clearly separate proposals from
    current capabilities. Verify: [VALIDATION.md](VALIDATION.md).
- [ ] **PORA-T01 — Record capability/scope acceptance.** Depends: PORA-DOC.
  - The terminal route is registered for the source-inspection preview; research
    universe, admission, and ownership policy remain open.
  - Targets: `CAPABILITY_MAP.md`, `DECISIONS.md`, `SPEC.md`.
  - Acceptance: dated D01/D03/D08 choices identify research universe, knowledge
    modes, permitted inputs and owner. No private/live feed inferred. AC-01–02.
  - Verify: owner review of concrete boundaries and affected capability specs.
- [ ] **PORA-T02 — Complete numerical runtime and first binding selection.** Depends: T01.
  - **Completed sub-slice, owner-directed:** D02 placement/package boundary and
    Python 3.12+/FastAPI health scaffold; independently installable model and service
    wheels, extraction/import test and fail-closed health checks. Numerical D05,
    production locks and first attested binding remain open; T02 is not complete.
  - Targets: `DECISIONS.md`, `PLAN.md`, model/service pyprojects, dependency lock,
    model project `README.md` (split follow-ups to keep the file budget).
  - Acceptance: remaining D05 selects tested numerical dependencies and build/
    native API ownership. Review distribution/license and exact first artifact
    before numerical integration; no placeholder pin. AC-09.
  - Verify: clean wheel/environment build and import in selected runtime; review
    compatibility/license/source evidence and pin scope before installing here.
- [ ] **PORA-T03 — Freeze method and local lifecycle policy.** Depends: T01–T02.
  - Targets: `DECISIONS.md`, `DATA_CONTRACT.md`, portfolio/regime/evaluation specs.
  - Acceptance: D04/D06/D07 choose limits, tolerances, costs/cash/execution,
    incomplete-window handling and session-only exception. Advanced method choices
    can remain disabled, but enabled profiles have no unresolved defaults. AC-03–10.
  - Verify: owner signs each enabled policy and reviews failed/timeout examples.

## R1 — First complete numerical research path

- [ ] **PORA-T04 — Establish canonical transport and conformance cases.** Depends: T03.
  - Targets: request/result schemas, shared fixture file, contract generator,
    generated TS/Pydantic outputs (split generation if file count exceeds five).
  - Acceptance: one source of truth, explicit null/unavailable/units/modes,
    strict semantic fields and compatible-major behavior. AC-02/06/09.
  - Verify: shared accepted/rejected fixtures in V1/V2; generator drift check.
- [ ] **PORA-T05 — Admit one fictional daily snapshot.** Depends: T04.
  - Targets: server `admission.ts`/test, `normalization.ts`/test, shared fixture.
  - Acceptance: stable asset order, currency/calendar/return basis, coverage,
    membership and cutoff checks; no source network. DATA-AC01–04; AC-01–02.
  - Verify: V1, including gaps/revisions/split/dividend/current-vintage fixtures.
- [ ] **PORA-T06 — Build equal-weight/min-variance native model.** Depends: T02/T04.
  - Targets: model-package `contracts.py`, `portfolio.py`, analytic tests, fixture,
    baseline model card.
  - Acceptance: independently derived two-asset result, explicit cash/bounds,
    invalid PSD/budget rejection; no estimated performance claim. PORT-AC01–02.
  - Verify: V3; fail fixture first, then hand calculation and alternate formulation.
- [ ] **PORA-T07 — Attest the first reviewed model build.** Depends: T06.
  - Targets: service `binding-manifest.json`, build script, `binding.py`/test,
    `requirements.lock`.
  - Acceptance: full reviewed revision/source/wheel/lock/installed bytes and schema
    identities; drift prevents readiness. No runtime fetch. AC-09–10.
  - Verify: V2 clean build plus source, wheel and installed-file tampering cases.
- [ ] **PORA-T08 — Independently verify baseline candidates.** Depends: T05–T07.
  - Targets: service `verification.py`/test, `adapter.py`/test.
  - Acceptance: recompute objective/return/variance/constraints from original
    normalized inputs; no solver self-verification; failed result has null weights.
    PORT-AC01–02; AC-03/06.
  - Verify: V2 direct-native equivalence and deliberately corrupted output cases.
- [ ] **PORA-T09 — Supervise bounded model service attempts.** Depends: T08.
  - Targets: service `app.py`, `supervisor.py`, API test, supervisor test, README.
  - Acceptance: health/capabilities/validate/run; one child, preflight caps,
    deadline/disconnect group termination, no late success or orphan. AC-10.
  - Verify: V2 with real child PID/RSS/deadline tests, occupied/restart/abort races.
- [ ] **PORA-T10 — Add same-origin terminal adapter.** Depends: T09.
  - Targets: server proxy/test, API routes/test, actual server route registry.
  - Acceptance: local/origin admission, bounded requests, response validation,
    token stays server-side, upstream abort propagation. AC-02/06/10.
  - Verify: V1 with down/bad-schema/mismatched-binding/deadline/disconnect cases.
- [ ] **PORA-T11 — Deliver empty/demo to baseline UI.** Depends: T10.
  - Targets: page, baseline panel, `src/App.tsx`, `src/lib/nav.ts`, module settings.
  - Acceptance: gated appended nav; explicit synthetic selection; real service
    weights/residuals, empty/down/invalid states; changing controls stales selection.
    AC-01/03/12.
  - Verify: V4 plus V5; inspect actual narrow/desktop results and keyboard flow.
- [ ] **PORA-T12 — Export and replay the baseline run.** Depends: T11.
  - Targets: exports module/test, run-evidence panel, browser test, help guide.
  - Acceptance: full-precision formula-safe CSV and self-contained JSON include
    source/binding/config/verifier identity; session-only limits visible. AC-08–09/12.
  - Verify: V1/V4 downloaded contents and tampered replay rejection; V5.
- [ ] **PORA-T13 — Add mean-variance and supported constraint frontier.** Depends: T12.
  - Targets: model-package portfolio/test/model card; service capabilities; portfolio panel.
  - Acceptance: return-sensitive objective, approved cap/group/turnover capabilities,
    explicit infeasible target points, no fake frontier interpolation. AC-03/06.
  - Verify: V2/V3 analytic and infeasible cases, V4 controls/effective-profile diff.

## R2 — Cover all four notebook families

- [ ] **PORA-T14 — Add BL estimation and identifiable comparison.** Depends: T13.
  - Targets: model-package `black_litterman.py`/test/card; service views validation/test.
  - Acceptance: dated prior/P/Q/Ω/τ/horizon conventions; mean-only versus covariance
    ablation; fixed-Σ minimum-variance control. PORT-AC03; AC-04.
  - Verify: V2/V3 hand-computed small posterior and return-sensitive allocation.
- [ ] **PORA-T15 — Add risk budgeting and relaxed tilt.** Depends: T13.
  - Targets: model-package `risk_budget.py`/test/card; adapter risk-check module/test.
  - Acceptance: RC/RRC reconciliation, equal-budget inverse-vol diagonal case and
    unequal-budget `sqrt(b_i)/sigma_i` oracle, explicit residuals
    under caps, approved dimensionless loss; local result never globally certified.
    PORT-AC01–03; AC-03/06.
  - Verify: V2/V3 negative/zero-risk, infeasible, nonconverged and multi-start cases.
- [ ] **PORA-T16 — Expose allocation model comparisons.** Depends: T14–T15.
  - Targets: portfolio panel, views editor, risk-budget table, client test, browser test.
  - Acceptance: same snapshot/constraints, clear mean/covariance/tilt changes,
    local-candidate qualification and unsupported controls disabled. AC-03–04/12.
  - Verify: V1/V4 export/view/risk-table consistency; V5.
- [ ] **PORA-T17 — Build causal feature and threshold baseline.** Depends: T05/T12.
  - Targets: model-package `features.py`/test, threshold model/test/card.
  - Acceptance: trailing returns/volatility and scalar Kalman init/units, no
    future sensitivity or invented warm-up values. REG-AC03; AC-05.
  - Verify: V3 future-row mutations and small independent Kalman recurrence.
- [ ] **PORA-T18 — Fit HMM and implement sequential filtering.** Depends: T17.
  - Targets: model-package `regime.py`, `filtering.py`, fit test, filter test, HMM card.
  - Acceptance: train-only scaler/selection/labels, refit initialization,
    probability/entropy/occupancy/convergence evidence; no stale fit fill.
    REG-AC01–03; AC-05–06.
  - Verify: V3 brute-force/two-state filter, label permutation and full-pipeline
    future mutation tests, including model selection and failing-fit intervals.
- [ ] **PORA-T19 — Deliver Regime Lab.** Depends: T18/T10.
  - Targets: service regime adapter/test, regime panel, client test, browser test.
  - Acceptance: probability timeline/transition table/refit ledger; retrospective
    versus decision-time states separate; no macro REGIME conflation. AC-05/12.
  - Verify: V1/V2/V4 unknown/tied/degenerate/fit-down states and exports; V5.
- [ ] **PORA-T20 — Establish execution ledger and metric oracle.** Depends: T13/T17.
  - Targets: model-package `backtest.py`, `metrics.py`, ledger test, metrics test, fixture.
  - Acceptance: next-open timing, overnight old holdings, drifted rebalance,
    cash/entry/exit costs and initial-equity drawdown; no gap filling. EVAL-AC01/03.
  - Verify: V3 independent hand ledger, first-period loss, zero-risk, gap/NaN cases.
- [ ] **PORA-T21 — Add strategy ablations and common folds.** Depends: T18/T20.
  - Targets: model-package strategies module/test, folds module/test, protocol profile.
  - Acceptance: Kalman/HMM/vol sizing and Donchian/HMM variants, explicit entry/
    exit rules, shared paired dates/costs, baseline independent of HMM failure;
    training-only selection and retained trial/failure counts. AC-05/07–08.
  - Verify: V3 leakage/overlap, HMM failure and matched-baseline tests.
- [ ] **PORA-T22 — Support full offline research artifacts.** Depends: T21.
  - Targets: model-package `cli.py`/test, artifact schema, service artifact verifier/test.
  - Acceptance: bounded deadline/work, complete folds/inputs/config/trials/pin,
    separate artifact import and trust verification; no unsafe deserialization.
    EVAL-AC04; AC-09–10.
  - Verify: V2/V3 and the two proposed CLI commands in PLAN; corrupted/oversize/
    incomplete result cannot import as verified. Larger-than-UI artifacts stay offline.
- [ ] **PORA-T23 — Deliver strategy/evaluation workspace.** Depends: T16/T19/T22.
  - Targets: strategy panel, comparison panel, export extension/test, browser test.
  - Acceptance: aligned net/gross curves, drawdown/turnover/exposure, fold failures,
    partial-path invalidity, ablation labels and full replay exports. AC-07–09/12.
  - Verify: V1/V4 data-to-chart-to-download reconciliation at four widths; V5.

## R3/R4 — Optional assistance and later operations

- [ ] **PORA-T24 — Review and pin consumed QuantSmith support.** Depends: T23, D09.
  - Targets: reviewed pin JSON/doc, asset review record, pin/conformance tests.
  - Acceptance: selected code/assets truly reviewed, drift resolved intentionally,
    no broad unreviewed persona admission, Agent-Skills mirror unchanged. AC-11.
  - Verify: immutable skill check plus strict local fingerprint/conformance tests;
    advisory pin script alone is insufficient.
- [ ] **PORA-T25 — Add supported PORA agent dispatch.** Depends: T24.
  - Targets: workflow schema/settings, module policy, worker dispatch/test; split
    generation of shared types into a separate mechanical follow-up if needed.
  - Acceptance: tested PORA module/job capability, bounded evidence context,
    identity/profile/data-class checks; no effect on ECOIQ claims. AC-11.
  - Verify: V6 and hosted worker fixtures; local QuantSmith-dependent tests reported
    separately with source fingerprints. Numerical flow makes no LLM call.
- [ ] **PORA-T26 — Deliver evidence-bound attended explanation.** Depends: T25.
  - Targets: deterministic renderer/test, claims verifier/test, assistance panel.
  - Acceptance: cites stable run/row/unit facts; hostile text cannot mutate runs;
    optional exact provider model/budget passes approved fixture evaluation. AC-11.
  - Verify: V1/V4 and local conformance; false facts, bad citations and provider-down.
- [ ] **PORA-T27 — Admit governed real/PIT sources.** Depends: T23, D03/D08.
  - Targets: source contract/card, terminal source assembler/test, admission report.
  - Acceptance: rights, ownership, calendars/actions/membership/revisions,
    availability and exports demonstrated; no service-to-source DB access. AC-02/05.
  - Verify: offline contract fixtures plus separately admitted sanitized real read;
    current-vintage data cannot pass a PIT gate by relabeling.
- [ ] **PORA-T28 — Implement shared durable operations and OPT registration.**
  Depends: T27, accepted spec015 storage/identity contracts and D07/D10.
  - Targets: operational design/task breakdown only initially; decompose queue,
    leases, retry/attempt lineage, audit, retention, recovery and OPT UI into separate
    ≤5-file tasks before code. This row is an epic, not a one-session code task.
  - Acceptance: no operational registration until the shared contract is implemented
    and verified; schedules and private/hosted use remain disabled. AC-12.
  - Verify: spec015 operational conformance, authorization/restart/concurrency tests
    and staged rollback exercise on the selected host.

## Per-slice completion bar

**Repeatable binding-update gate:** every model-package change in T13–T22 must
repeat T07's reviewed-build procedure before a changed capability reaches its
adapter/UI: publish a reviewed exact revision, build the wheel and lock, regenerate
the manifest/installed-file attestation, run native-versus-service equivalence and
tamper tests, and retain the prior exact binding for rollback. Run identities keep
their original manifest. Passing standalone model tests does not enable a stale
service binding. Include these mechanical follow-ups in each slice or split into
an explicit dependent task when the five-file budget would otherwise be exceeded.

Acceptance plus appropriate tests, independent domain/engineering review, source
and binding evidence, updated model/spec cards and actual UI/export verification
where applicable. Run full terminal checks only for affected code slices, not for
the initial documentation checkpoint. Never mark future tasks complete from drafted text,
passing synthetic fixtures, an advisory drift check or a planned service route.
