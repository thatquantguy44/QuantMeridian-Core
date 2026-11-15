# Spec026 decision register and proposed architectural records

**Status:** Updated 2026-11-01. The owner accepted an independently installable
model package inside this repository with a separate API service. D02 is accepted
for that placement/boundary; D05 is accepted only for the Python 3.12+/FastAPI
packaging and health scaffold. Numerical dependencies, methods, production locks,
data admission, execution limits and later implementation phases remain proposals.

## Decisions required

| ID | Choice / recommended proposal | Alternatives and cost | Blocks |
| --- | --- | --- | --- |
| D01 | PORA, `/portfolio-regime`, one Optimization workspace; daily liquid equities/ETFs, single-currency, long-only/long-flat. | Existing OPT tab only reduces navigation; direct multi-asset/cross-currency needs additional valuation, cash and FX contracts. | Module registration, live universe selection. |
| D02 | **Accepted 2026-11-01:** `models/portfolio_regime/` in QuantMeridian is the standalone model project, distribution `portfolio-regime-models`, import `portfolio_regime_models`; `services/portfolio_regime_api/` is a separate installable adapter. Both build wheels independently. | Later extraction moves the model project to its own repository without changing imports/native API or terminal HTTP boundary. A separate repository is not required now. External publication/license and first numerical binding remain separate. | Placement is resolved; reviewed source/wheel/lock/installed digests still gate numerical integration. |
| D03 | Explicit synthetic and user-supplied current-vintage local research first; real source/PIT admission separate. Reject incomplete windows. | Admit governed provider snapshots when availability, corporate actions, membership and rights are demonstrated. | Real data connection, point-in-time claims; execution/cash/timing policies. |
| D04 | Annual arithmetic mean-variance/BL, shrinkage candidate, train-only HMM selection, relative-risk-budget objective and explicit tolerances. | Sample covariance only is simpler; alternative risk-parity formulations/estimators require method cards and independent tests. | Numerical objectives, cash/constraint defaults, HMM occupancy/convergence/labels and promotion thresholds. |
| D05 | **Scaffold accepted 2026-11-01:** Python 3.12+, independent setuptools/src-layout wheels, FastAPI health-only adapter. Model has no runtime dependencies yet. NumPy/pandas/SciPy, scikit-learn/hmmlearn, CVXPY/OSQP and exact production locks remain candidates. | PyPortfolioOpt can supply BL/reference calculations but adds a wrapper dependency; full native implementation has a larger validation burden. Framework ranges in scaffold metadata are not production locks. | Numerical dependencies, production lock and executable model runtime remain open; package/health builds are authorized. |
| D06 | Bounded synchronous local child-process runs; larger reproducible experiments via offline CLI/artifacts. Proposed reference host: four CPU cores, 8 GiB host RAM; one 1-GiB child/thread, 20-s interactive and 15-min offline deadline. | Durable asynchronous jobs improve long-run UX but require storage/identity/leases/recovery; no need to duplicate orchestration now. Hardware limits must be measured. | Execution, admission limits, cancellation and benchmark acceptance. |
| D07 | Session-only research preview with explicit replay export; local exception to durable spec015 OC-006; no OPT operational registration initially. | Adopt approved spec015 shared durable registry/worker when available. A new PORA-specific durable store creates competing infrastructure. | Local run lifecycle approval and any operational history/queue. |
| D08 | Fictional fixtures only in repository/tests; no private holdings, raw uploads or LLM context. Local source-use/export rights and retention reviewed before real intake. | Private/shared books require identity, authorization, encrypted retention/export policy and approved operator ownership. | Real/private use and hosted release. |
| D09 | Deterministic explanation first; QuantSmith PM personas and attended LLM only after pin/asset/dispatch/claim-verification review. | Existing direct, gateway or local profiles evaluated on the same fixtures; exact model IDs and budgets selected by operator, no assumed availability. | PORA assistance, external provider calls, new asset pin paths. |
| D10 | Additive OPT adapter only after common run contract, verified model and operational identity/storage evidence. | Dedicated research UI remains usable without OPT. Aggregate monetary benefits across optimizer families remain undefined. | Schedules, durable audit, combined metrics, production operations. |

Acceptance requires a dated owner entry naming the decision ID, exact selected
policy/version, evidence and scope. Open decisions remain explicit refusals or
disabled capabilities in implementation; recommendations do not become defaults.

## Accepted architectural record A — Separate packages, initially co-located

**Context:** Current terminal services separate the app from Python models and do
not call each other. Portfolio/regime calculations share one research workflow.

**Decision (owner, 2026-11-01):** keep `portfolio-regime-models` in
`models/portfolio_regime/` as an independently installable project, with a separate
`portfolio-regime-api` distribution in `services/portfolio_regime_api/`. The model
has no terminal/API dependency. Future native contracts/resources ship with its
wheel; transport contracts and independent adapter checks stay with QuantMeridian.
The service consumes installed model artifacts; terminal assembles snapshots.

**Alternatives:** an external repository now adds ownership/release overhead;
one combined model/API package couples numerical consumers to the service stack.
One microservice per model increases deployment/composition cost. QuantSmith
optimizer adoption would need a separate source/contract decision.

**Consequences:** independent package versions/tests and future artifact bindings.
While co-located, record QuantMeridian's exact commit and package subdirectory plus
source/wheel/lock/installed-content digests. Later extraction changes the source
location/pin without a required import or HTTP rewrite. Installed metadata alone
does not establish readiness. Only package scaffolding/health is implemented now;
numerical D05 and other dependent policy gates remain open.

## Proposed architectural record B — Causal research and explicit invalidity

**Context:** Notebooks mix retrospective estimation, rolling fits and inconsistent
performance conventions. A one-row position shift cannot establish causality.

**Proposal:** dated training/selection folds, causal forward probabilities,
train-only label mapping, next-open execution and independent ledger verification.
Unknown availability remains current-vintage research; fit gaps invalidate the
affected aggregate path instead of manufacturing a position.

**Alternatives:** full-sample retrospective charts may remain descriptive only;
automatic flat/hold fallbacks are separate strategies, not numerical repairs.

**Consequences:** fewer apparent successful results, clearer failure evidence and
greater data requirements. D03/D04 acceptance is required, including the exact
execution convention, cost/cash assumptions and regime confidence policy.

## Proposed architectural record C — Local preview before durable operations

**Context:** spec015 operational storage/identity decisions are open. Current
worker code is ECOIQ-specific; long HMM grids are CPU work, not LLM jobs.

**Proposal:** supervised bounded synchronous attempts plus offline CLI artifacts;
session-only results and explicit exports. Reuse future spec015 operations rather
than create a second durable queue. D06/D07 govern the deliberate local exception.

**Alternatives:** a transient async job server adds handles/recovery ambiguity;
durable queue now forces unresolved product-wide decisions. FastAPI background
callbacks alone do not provide persistence or cancellation guarantees.

**Consequences:** no schedule, history or restart recovery; full experiments may
require CLI until R4. D10 gates shared operations. No 202/polling API is promised.

## Proposed architectural record D — Engineering skills versus domain agents

**Context:** Agent-Skills is an immutable engineering toolkit; QuantSmith is a
separately fingerprinted library whose local copy has drifted.

**Proposal:** use pinned skills to govern delivery and inspected QuantSmith domain
instructions to structure requirements now. Future attended agents receive only
verified facts and cannot mutate models or promote outcomes. Keep numerical
execution independent from the agent worker and LLM provider.

**Alternatives:** treating persona instructions as installed runtime capabilities
or treating generated narrative as numerical evidence hides unsupported authority.

**Consequences:** extra asset/capability/dispatch review for R3, but numerical
research does not depend on LLM availability. D09 acceptance is required.
