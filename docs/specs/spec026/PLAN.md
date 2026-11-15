# Spec026 implementation and technology proposal

**Status:** Model placement/package separation and health-only scaffold accepted
2026-11-01; numerical and operational implementation remains proposed.
Read [SPEC.md](SPEC.md), the [capability map](CAPABILITY_MAP.md),
[decision register](DECISIONS.md) and [tasks](TASKS.md) together. Keep the existing
uppercase per-spec filenames as this repository's plan/task convention.

## Runtime and service proposals

| Layer | Recommended candidate | Alternatives / trade-off | Gate |
| --- | --- | --- | --- |
| Application | Existing React 18.3.1 / TS 5.6.3 / Vite 5.4.11 / React Router 6.28.0; terminal components and same-origin Node routes. | No Next.js migration or second frontend needed. Architecture docs describing a Next.js target are not the current runtime. | D01 |
| Numerical model | **Accepted placement:** standalone `models/portfolio_regime/`, distribution `portfolio-regime-models`, Python 3.12+, independent wheel. Scaffold has no numerical dependencies. | Later extraction preserves package/import identity. Numerical dependencies/production lock remain open; notebook execution is unsuitable as a service API. | D02 resolved; numerical D05 open |
| Service adapter | `services/portfolio_regime_api`, FastAPI/Pydantic, proposed loopback `8019`, one isolated environment and binding attestation. | Do not split each model into a service. Keep market data and QuantSmith orchestration out of this service. | D05/D06 |
| Linear algebra / data | NumPy/pandas/SciPy; preserve normalized asset/session ordering and float64 numeric policy. | Exact versions/BLAS build chosen after tests; no guessed latest versions or unbounded dependency ranges in production locks. | D05 |
| Convex optimization | CVXPY with explicit OSQP backend for constrained QP, solver settings and residual evidence. | SciPy-only reduces dependencies but adds formulation/diagnostic work. Existing optimization_core is LP-only. Commercial solvers unnecessary for the proposed continuous scope. | D04/D05 |
| Risk budgeting | Reviewed convex positive-budget formulation where its assumptions hold; SLSQP for explicitly experimental relaxed loss with bounded multistart. | One generic local optimizer is simpler but cannot certify global optimality or exact budgets under arbitrary constraints. | D04 |
| Estimation / BL | Sample and Ledoit–Wolf covariance; explicit BL prior/posterior stage; evaluate PyPortfolioOpt as a candidate estimator/reference oracle. | Own BL linear-solve implementation avoids a wrapper but needs stronger independent golden cases. Do not install both paths without a reason. | D04/D05 |
| Regime runtime | hmmlearn for Gaussian fitting; separately tested causal forward filter and train-only sklearn preprocessing. Scalar Kalman filter in model package. | Full-covariance HMM, Markov-switching, change-point and deep models follow evidence; no GPU initially. | D04/D05 |
| Interactive execution | Single supervised child, synchronous response, 20-s total deadline, bounded work; UI abort propagates and reaps children. | Async queue deferred; API callbacks alone do not provide reliable long-running execution. | D06/D07 |
| Long experiments | Model CLI generates a versioned self-contained artifact; independent offline verification, then bounded import/re-verification. Proposed 15-min process deadline and 1,000-fit cap. | If required work exceeds limits, submit a new explicit chunked protocol; never silently truncate folds or grid. | D06 |
| Durable operations | Future common spec015 registry/worker/storage after identity/retention decisions. | Do not create a PORA-only Postgres/Redis/Celery/Dagster installation in the initial release. Existing local tools do not imply approval for a new orchestrator. | D07/D10 |
| Agent runtime / LLM | Deterministic report first; later attended QuantSmith roles via an extended, tested agent dispatch. Reuse schema-governed profiles. | Existing direct Anthropic, gateway or local profiles are candidate transports; current configured model names are unverified availability claims. Evaluate and pin an exact provider model, not an assumed best model. | D09 |
| Hosted deployment | Later separate CPU container/model service, with terminal proxy and trusted identity. | A frontend/serverless process should not absorb CPU-heavy model fits. Host/vendor and spend remain open pending benchmarks and data controls. | D08/D10 |

Technical capabilities were checked against [official sources](REFERENCE_MODELS.md#official-technical-references-checked-2026-11-01).
These are engineering proposals, not installed packages, current service health or
performance measurements. A proposed four-core/8-GiB development host is a
benchmark profile; record the actual machine, OS, CPU, RAM, Python/BLAS and payload.
Measure CPU-seconds, peak RSS, fits/iterations, latency and artifact size. Estimate
hosting from measured CPU-hours/storage; evaluate LLM token costs separately using
operator-approved current prices. No dollar estimate or model-quality ranking is
invented in this plan.

## Accepted package roots and future code ownership

```text
market_terminal/
  models/portfolio_regime/             # standalone model project, extractable later
    pyproject.toml; README.md; tests/; model_cards/
    src/portfolio_regime_models/       # package exists; numerical modules follow
      portfolio/; regime/; evaluation/; contracts.py; cli.py  # future
  contracts/portfolio_regime/v1/        # canonical transport schemas / fixtures
  services/portfolio_regime_api/
    src/portfolio_regime_api/          # app, adapter, validation, verification, supervisor
    tests/; binding-manifest.json; requirements.lock; README.md; Dockerfile
  src/lib/portfolioRegime/             # generated DTOs, client state, exports
  src/lib/server/portfolioRegime/       # source assembly, admission, proxy, response checks
  src/app/api/portfolio-regime/         # same-origin routes, not Next.js runtime
  src/app/portfolio-regime/page.tsx
  src/components/portfolioRegime/      # bounded tables and figures
  test/portfolio-regime.spec.ts
  docs/guides/optimization/pora-{help,whitepaper}.md
  docs/specs/spec026/                 # this suite; no runtime assets here
```

The model/service package roots and health route exist, and the terminal now has a
source-inspection preview. Numerical and model-service routes above remain targets.
Register future server routes through `src/server/registry.ts`; module/nav flags through
`settings/modules.config.json` and `src/lib/nav.ts`. Append entries to preserve
existing shortcuts. Follow generated contract and adapter conventions rather than
building parallel type systems. First numerical binding/versioned native methods
remain unset. No changes to Sources & Uses, MMKT, COLL, INDEM or macro REGIME mathematics.

Build wheels separately and test outside the checkout. The model project must
build from an extracted copy without repository-root schemas/files or API imports.
Future native schemas/resources ship in the model wheel; HTTP transport schemas
remain in `contracts/portfolio_regime/v1/`. Service tests consume installed wheels.
Co-located provenance records repository commit plus `models/portfolio_regime`
and content/artifact digests; later extraction changes only the reviewed source
location/pin. Scaffold versions alone are not production binding attestation.

## Delivery slices and checkpoints

1. **R0 — Reviewable design:** reference fingerprints/defects, capability map,
   acceptance criteria, decisions, runtime alternatives, tasks and roadmap. This
   documentation checkpoint is complete; package/service placement was subsequently
   accepted and scaffolded. Record remaining owner decisions before numerical work.
2. **R1a — Empty to verified baseline:** select approved synthetic contract →
   pinned equal-weight/min-variance model → independent service verifier →
   terminal proxy → one empty/demo/import/results/export view. Start with analytic
   failing tests. Include source states, binding-down errors and child cleanup.
3. **R1b — Useful Portfolio Lab:** mean-variance, constraint controls/frontier,
   covariance sensitivity and profile diff. Add each constraint only when
   capability-reported and independently checked. End with real browser export QA.
4. **R2a — Allocation references:** BL mean/covariance ablation, risk budgeting and
   experimental relaxed risk budgets, each with model card and independent
   fixtures before UI enablement. Keep failed cases visible.
5. **R2b — Regime references:** threshold baseline → train-only HMM and causal
   filter → probabilities/refit diagnostics → Kalman momentum and Donchian
   features. Verify future-mutation invariance before connecting any strategy.
6. **R2c — Research experiments:** next-open ledger, drift/cash/costs, common-fold
   comparison and ablations. Small bounded interactive experiment first; full
   walk-forward CLI/artifact replay next. No false completion from dropped folds.
7. **R3 — Optional attended assistance:** source/asset pin review, PORA worker
   dispatch support and evidence/claims contracts, deterministic explanation,
   then provider fixture evaluation. Numerical flow remains LLM-independent.
8. **R4 — Governed operations:** admitted real sources and point-in-time history,
   approved identity/storage/audit/retention, durable jobs/leases/recovery and OPT
   binding. Do not disguise local session exports as operational history.

Dependencies flow data → numerical provider → independent adapter → same-origin
route → complete UI/export slice. Model and UI tasks may be developed separately
only after their contract is frozen; shared schema/pin changes remain sequential.
This is sequencing guidance, not an instruction to start parallel agents.

## Model validation and release policy

For every model, write a card covering objective, eligible data, horizon,
assumptions, parameters, baseline, fit/convergence/constraint evidence, tests,
limitations, failure handling and owner. Separate construction feasibility from
forecast/strategy validation. Risk budgets can fail exact equality under caps;
HMM state occupancy and likelihood do not establish profitable regimes.

Freeze a research protocol before final holdout. Compare net costs, turnover,
exposure, drawdown and sample coverage, not Sharpe alone. Set economic and risk
promotion thresholds with the owner before testing; absence of thresholds keeps
deployment `NOT_APPROVED`. A model can be available for exploratory research even
when it fails to improve on a baseline, clearly labeled. No LLM approval path.

## Verification commands

Implemented scaffold checks (service tests require both packages installed in the
active environment, following its README):

```sh
python3 -m unittest discover -s models/portfolio_regime/tests -v
python3 -m pytest services/portfolio_regime_api/tests -q
```

The first check builds an extracted wheel and imports it in a fresh isolated
environment without FastAPI. The service artifact is also built/installed outside
the checkout for integration verification. See [VALIDATION.md](VALIDATION.md).

Existing documentation checks:

```sh
git diff --check
npm run check:agent-skills-pin
npm run check:quantsmith-pin
```

Future command contract, **not runnable PORA commands today**. Tasks must create
the named test paths/CLI fixtures before invoking them and document environment
setup in the service/model READMEs; no automatic install/fetch from these examples.

| Key | Command after corresponding scaffolding exists | Coverage |
| --- | --- | --- |
| V1 | `npx vitest run src/lib/portfolioRegime src/lib/server/portfolioRegime src/app/api/portfolio-regime --no-file-parallelism` | DTOs, admission, proxy, exports and tampering. |
| V2 | `python3 -m pytest services/portfolio_regime_api/tests -q` | Installed service/model artifacts; future binding, independent checks and cleanup. |
| V3 | `python3 -m pytest "$PORA_MODEL_ROOT/tests" -q` | Future numerical tests in the model's environment; initially set PORA_MODEL_ROOT to this checkout's models/portfolio_regime directory. |
| V4 | `npx playwright test test/portfolio-regime.spec.ts --workers=1 --retries=0` | Empty/demo/import/error/run/export and four-width visual inspection. |
| V5 | `npm run typecheck` then `npm test -- --reporter=dot --no-file-parallelism` then `npm run build` | Terminal regression/build gates, after actual code changes. |
| V6 | `npm run check:agent-contracts` and `npm run check:agent-metric-registry` | Future agent-contract changes; required generator dependencies must be present. |

Proposed model CLI acceptance invocation after R2c (model environment installed):

```sh
python3 -m portfolio_regime_models.cli evaluate --input "$PORA_MODEL_ROOT/fixtures/synthetic_daily.json" --profile "$PORA_MODEL_ROOT/profiles/walk_forward_smoke.json" --output /tmp/pora-walk-forward.json --deadline-seconds 900
python3 -m portfolio_regime_models.cli verify-artifact --input /tmp/pora-walk-forward.json
```

CI uses invented fixtures only, never notebook downloads or a user's database.
Build/pin/transport tests run without QuantSmith; tests needing its local copy
report `not run` until the approved source exists. A later real-source read is a
separate admitted verification with sanitized evidence, not an ordinary test.

## Failure containment, monitoring and rollback

Binding readiness checks reviewed source/wheel/lock/installed content plus schemas
before claims; each attempt records the exact binding. Parent supervisor owns
deadline/disconnect termination and discards late output. Keep model process
without market/LLM credentials or network clients. No arbitrary path/URL/code in
input; no pickle deserialization. The proxy enforces allowed local origins and
both request/response validation; real private data waits on D08.

Log correlation, method/version, elapsed CPU/wall time, peak RSS, failure code,
fit/iteration counts and verifier residual summaries. Monitor invalid/failed-fit
rate, missing coverage and bound hits. No raw portfolio/prompt logging. Operator
notification destination and on-call ownership are open before hosted operations.

Rollback disables PORA by module flag and restores the prior reviewed model
manifest/image. Keep historical artifacts tied to their original pins; a rollback
must not silently rewrite replay identity. It never edits upstream Agent-Skills,
auto-repins QuantSmith or changes another module's solver. Scheduling and recovery
rollback require the later spec015 operational design.
