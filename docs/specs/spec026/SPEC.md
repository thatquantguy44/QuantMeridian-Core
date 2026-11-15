# Spec026 — Portfolio Optimization & Regime Analysis

- **ID:** `spec026-portfolio-optimization-regime-analysis`.
- **Module / route:** `PORA` / `/portfolio-regime`, Optimization group.
- **Status:** Model/package placement and a separate health-only API scaffold
  accepted 2026-11-01. A source-inspection terminal preview was added 2026-11-12.
  Numerical implementation, binding, policy defaults, data admission and deployment remain open.
- **Created:** 2026-11-01. **Owner / approver:** Joshua Lutkemuller.
- **Scope authority:** requested spec, plan, tasks and roadmap, using QuantSmith
  and Agent-Skills, inspired by the four notebooks in `zips/`.

## Objective

Give a portfolio researcher one inspectable workflow to select an eligible
universe, compare allocation models, analyze statistical market regimes, test
regime-aware strategy variants, and export reproducible research evidence.
Success means defensible comparisons, visible constraints and uncertainty, and
traceable calculations. It does not require an advanced model to beat a baseline.

The user asked the references to inform initial scope. Recommend daily liquid
equities and ETFs, single-currency experiments, long-only allocation and long/flat
unlevered overlays first. Include risk parity/relaxed risk parity, Markowitz/BL,
Kalman/HMM momentum and HMM-filtered breakout across staged releases. The
[reference review](REFERENCE_MODELS.md) explains the recommendation and defects
that must not be inherited. Market HMM states are distinct from the existing
`REGIME` macro module and are not economic-cycle truth or a forecast guarantee.

## Suite and authority

| Document | Purpose |
| --- | --- |
| [CAPABILITY_MAP.md](CAPABILITY_MAP.md) | Stable capability boundaries and dependency direction. |
| [SPEC-pr-data.md](SPEC-pr-data.md) | Input admission and point-in-time semantics. |
| [SPEC-pr-portfolio.md](SPEC-pr-portfolio.md) | Portfolio models, constraints and numerical verification. |
| [SPEC-pr-regime.md](SPEC-pr-regime.md) | HMM/Kalman features, filtering and signal semantics. |
| [SPEC-pr-evaluation.md](SPEC-pr-evaluation.md) | Walk-forward evaluation, metrics and experiments. |
| [SPEC-pr-assist.md](SPEC-pr-assist.md) | Attended QuantSmith explanations and review. |
| [DATA_CONTRACT.md](DATA_CONTRACT.md) | Proposed input/result/API/replay contract. |
| [PLAN.md](PLAN.md) | Runtime, model, service and deployment alternatives; build slices. |
| [TASKS.md](TASKS.md) | Dependency-ordered, verifiable implementation backlog. |
| [ROADMAP.md](ROADMAP.md) | Milestones, entry/exit gates and deferred capabilities. |
| [DECISIONS.md](DECISIONS.md) | Proposed architectural records and unresolved owner choices. |
| [AGENT_WORKFLOW.md](AGENT_WORKFLOW.md) | QuantSmith personas and pinned engineering workflows. |
| [REFERENCE_MODELS.md](REFERENCE_MODELS.md) | Notebook inventory, limitations and source evidence. |
| [VALIDATION.md](VALIDATION.md) | Documentation and package/service scaffold verification, with explicit limits. |

Requirements below are a proposed contract. Decisions marked open in
`DECISIONS.md` block the dependent implementation; a recommendation is not an
accepted default. Existing approved decisions in other modules remain authoritative.

## Application, model and service standard

Use the actual React 18 / TypeScript / Vite 5 / React Router application;
`src/app/.../page.tsx` is a repository filename convention, not Next.js routing.
Follow [docs/services.md](../../services.md): browser → same-origin terminal
Node route → module-specific Python service; the terminal composes data and
services do not call each other or query market databases. Follow
[spec016](../spec016/SPEC.md) for reviewed model-artifact and adapter boundaries.

The owner selected `models/portfolio_regime/` inside this repository as the
standalone `portfolio-regime-models` project, import `portfolio_regime_models`.
It has its own pyproject, source, tests and model cards. The separate installable
`services/portfolio_regime_api/` consumes the installed model package. It exposes
health only and reports `UNCONFIGURED`; no numerical methods or run endpoints
exist yet. Package versions do not imply an attested model binding.

The terminal now exposes an explicitly selected SPY source-inspection preview at
`/portfolio-regime`. It reuses VIXR's retained, evidence-reconciled source check;
price and derived total-return bases are distinguished. A bounded multi-asset
comparison checks selected SPY, AGG, ACWI and BIL inputs against retained receipts
and warehouse NYSE sessions in a single read-only transaction. Explicit capture
can freeze and export a session-only, content-hashed research snapshot; imported
artifacts do not recheck origin. The preview does not admit
model inputs or establish historical point-in-time availability, and failure never
substitutes simulated data. Portfolio, regime and evaluation models remain unavailable.

The model owns future estimation, optimization, filtering, evaluation and native
contracts/resources. QuantMeridian owns API transport contracts, source assembly,
UI and independent adapter checks. No terminal/FastAPI/provider imports or runtime
files outside the standalone model project. Extracting that project later changes
the reviewed artifact source/pin, while import names and service boundary remain
stable. No Python math in browser/Node; no runtime Git fetch.

Agent-Skills governs engineering; QuantSmith supplies domain instructions and
future attended assistance. Neither substitutes for a numerical model binding.
The current QuantSmith copy differs from its trust pin; PM agents are outside
the presently listed consumed asset paths. No PORA runtime workflow is registered.

## Requirements

| ID | Proposed requirement |
| --- | --- |
| PORA-001 | Gated workspace using existing `PageHeader`, `Panel`, terminal styling and append-only navigation placement; fresh visit is empty. |
| PORA-002 | Explicit snapshot selection, input validation, source/freshness/knowledge-basis evidence and coverage ledger; no automatic SIM or source fallback. |
| PORA-003 | Equal-weight, buy-and-hold and constrained minimum-variance baselines before advanced models; all four reference families trace to model cards and tests. |
| PORA-004 | Risk budgets, bounds, groups, cash, turnover, expected-return horizon, BL views and costs are explicit effective configuration. Unsupported controls are disabled. |
| PORA-005 | Separate solver termination, independent numerical verification, research validity and deployment approval; never label a local nonlinear solution globally optimal. |
| PORA-006 | Train-only transformations and model selection, causal regime filtering, immutable fold manifests and distinct retrospective diagnostics. |
| PORA-007 | Walk-forward comparisons share evaluation dates, capital/cost assumptions and benchmark evidence; show missing intervals and failed models. |
| PORA-008 | Run manifest binds snapshot/config/method/model/adapter/dependency identities and seeds; replay tolerances and runtime profile are explicit. |
| PORA-009 | App proxy validates both sides, holds secrets server-side, enforces local access, body/work limits and deadlines; model service has no source/network credentials. |
| PORA-010 | Export full-precision data, constraint/verifier reports, probabilities and experiment/run manifests; preserve mode and limitations, protect textual CSV cells. |
| PORA-011 | Attended, evidence-bound assistance is optional and independently gated; LLM outage or refusal cannot change numerical results or mark a model approved. |
| PORA-012 | Future Optimization Center integration uses spec015 contracts only after durable storage, identity and ownership gates; no invented verified totals. |

## User workflow and visible states

1. **Data & Mandate:** choose fictional example or admitted upload; inspect currency,
   calendar, coverage, source rights, knowledge basis, objective and benchmark.
2. **Portfolio Lab:** compare weights/frontier, risk contributions, concentration,
   constraint residuals, turnover and posterior views with changed assumptions.
3. **Regime Lab:** inspect probabilities, entropy, transition matrix, occupancy,
   feature history and refit lineage; labels are model-relative descriptions.
4. **Strategy & Evaluation:** Kalman momentum and Donchian ablations, paired net
   performance, fold ledger, drawdown, exposure, cost sensitivity and failure counts.
5. **Run & Methods:** input/config diffs, binding/verifier evidence, model cards,
   research limitations and explicit export; optional assistance cites these facts.

Shared states: empty, validating, invalid input, unconfigured binding, incompatible
binding, running, unavailable, timed out, failed verification, completed research
preview. An infeasible solve has no valid candidate weights. A numerical preview
is never an investment approval. Old results retain their run identity and cannot
be mistaken for changed controls. Use accessible tables alongside charts,
keyboard controls, status announcements, signed axes and responsive layouts.

## Nonfunctional requirements

| ID | Target / verification contract |
| --- | --- |
| NFR-01 | Deterministic numerical replay on the recorded runtime within per-field tolerances, not assumed cross-platform bit equality. Text narration is separate. |
| NFR-02 | Proposed local profile: ≤50 assets, ≤5,000 sessions, ≤20 frontier points, ≤3 HMM states, ≤100 fits per interactive experiment; reject excess work before allocation. Exact limits require D06 approval and benchmarks. |
| NFR-03 | Benchmark targets, not measured facts: validation ≤1 s p95; snapshot solve ≤5 s p95; bounded interactive run hard deadline 20 s; UI remains responsive. Reference machine and payload must accompany evidence. |
| NFR-04 | One active numerical child per local service, no unbounded queue, bounded threads/memory and process cleanup. Long walk-forward jobs use offline batch artifacts until durable worker approval. |
| NFR-05 | Metadata-only logs: correlation/attempt IDs, hashes, model/status, elapsed time, iteration/failure counts; no raw uploads, holdings, prompts or secrets. |
| NFR-06 | Empty/source-failure behavior and key workflows verified at 390, 768, 1280 and 1536 px with keyboard access and downloadable artifact inspection. |

## Acceptance and traceability

| ID | Observable evidence | Requirement / detailed capability |
| --- | --- | --- |
| AC-01 | Empty startup, explicit fictional mode, invalid intake preserves last valid snapshot; no generated fallback. | 001–002; `pr-data` |
| AC-02 | Bad units, duplicate IDs, mixed currencies, future/unknown required availability and unsupported return basis fail with located reasons. | 002, 009; `pr-data` |
| AC-03 | Hand-calculated baselines reconcile; independent verifier catches altered weights/objectives, bounds, budgets and risk contributions. | 003–005; `pr-portfolio` |
| AC-04 | Return-sensitive BL fixture changes posterior allocation with views; minimum-variance mean-only control remains unchanged. | 003–004; `pr-portfolio` |
| AC-05 | Future-row mutation does not alter earlier features, fitted inputs, selected parameters, labels or decisions; state permutations preserve economics. | 006; `pr-regime` |
| AC-06 | Invalid fit/covariance, infeasible constraints, timeout and NaN produce no verified candidate or fabricated flat return. | 005–007, 009 |
| AC-07 | Each strategy uses aligned holdout dates and the same cost convention; baseline runs independently of HMM success. | 007; `pr-evaluation` |
| AC-08 | Independent wealth/Sharpe/drawdown/turnover fixtures and fold ledger reconcile to full-precision export. | 007, 010; `pr-evaluation` |
| AC-09 | Changed snapshot/config/pin/seed changes relevant identity; tampered batch artifacts fail verification; replay reports tolerance/runtime. | 008–010 |
| AC-10 | Child dies on deadline/disconnect; late results are discarded; binding drift fails readiness; no browser source/service credentials. | 009; NFR-02–05 |
| AC-11 | Missing/stale QuantSmith capability leaves assistance unavailable; hostile text and false numeric claims cannot change model facts. | 011; `pr-assist` |
| AC-12 | UI/export state and provenance agree; OPT remains pending until the common operational contract is satisfied. | 001, 010–012; NFR-06 |

## Commands, style and boundaries

Existing executable checks (run only appropriate checks for the change):

```sh
npm run typecheck
npm test -- --reporter=dot --no-file-parallelism
npm run build
npm run check:gold-policy
npm run check:agent-skills-pin
npm run check:quantsmith-pin
npm run dev
```

PORA-specific commands are future deliverables in [PLAN.md](PLAN.md), not existing
scripts. Use Vitest for Node/contracts, pytest for Python/models and Playwright
for browser flows. Behavioral slices start with independent failing fixtures.
No application build is necessary merely to validate this documentation change.

Match typed, explicit repository contracts. Illustrative future TypeScript style:

```ts
type CandidateState =
  | { status: 'VERIFIED_PREVIEW'; runId: string; weights: number[] }
  | { status: 'UNAVAILABLE'; code: string; weights: null };
```

Always preserve source units, cutoff evidence and failed outcomes; update the
spec before behavior; verify immutable skills and model pins. Resolve open model
ownership, dependency, data, storage and policy choices before their dependent
implementation. Never edit `.agents/`, repin QuantSmith without review, install
notebook dependencies at runtime, mutate Gold, trade, auto-rebalance or represent
synthetic/current-vintage research as observed historical investment skill.
