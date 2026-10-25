# Market Terminal Model Dictionary

- **Module:** `MDLS`
- **Terminal route:** `/models`
- **Status:** Bootstrap catalog; human-maintained until a versioned machine-readable registry is implemented
- **Last reviewed:** 2026-10-24

## Purpose

This document is the terminal-wide discovery index for quantitative models, statistical estimators, scoring rules, optimizers, simulations, and configured language-model runtimes. It answers four questions:

1. What model or decision rule exists?
2. Where is it used and implemented?
3. Is it implemented, simulated, externally bound, or merely planned?
4. Where can a reviewer find its methodology, validation, and limitations?

This dictionary is not itself a production model registry, an approval record, or evidence that a model is trained on live data. Module-level model cards, pinned service contracts, validation reports, and approval records remain authoritative for execution and promotion decisions.

## Inclusion rules

Include logic that materially transforms inputs into a forecast, classification, score, allocation, risk estimate, scenario distribution, or generated recommendation. This includes transparent rules and optimization solvers; calling something “analytics” does not exempt it from documentation.

Do not catalog simple display formatting, direct arithmetic totals, charts with no decision logic, or raw data retrieval. Surfaces that look like a model but currently contain generated placeholders are included and explicitly marked **Not a model**.

## Status vocabulary

| Status | Meaning |
|---|---|
| **Implemented** | Executable logic exists in this repository and is used by a terminal surface. This does not imply live inputs or production approval. |
| **Service-backed** | The terminal calls a separately running or separately owned model implementation through a contract. |
| **Prototype** | Executable research/demo logic exists, but its validation, governance, scaling, or production binding is incomplete. |
| **Planned** | A specification exists, but the described model is not yet the active implementation. |
| **Not a model** | The UI contains illustrative/generated outputs without a solver, fitted estimator, or governed scoring implementation. |

Data and evidence labels must remain separate from implementation status. `SIM`, `SNAPSHOT`, `FRED`, `GOLD`, `FILE`, or `DB` describe inputs or provenance; they do not certify model quality.

## Market and volatility models

| ID | Module | Model or decision logic | Type | Current state | Implementation | More information |
|---|---|---|---|---|---|---|
| `VIXR-IMPLIED-MOVE` | VIXR | VIX-implied 30-day move and forward S&P 500 outcome measurement | Deterministic transform / statistical study | **Implemented**; source-dependent | [`src/lib/vixImpliedForward.ts`](../src/lib/vixImpliedForward.ts) | [VIXR white paper](guides/markets/vixr-whitepaper.md) · [Help](guides/markets/vixr-help.md) |
| `VIXR-WALK-FORWARD` | VIXR | Expanding-window volatility and return forecast comparison, including calibration and Diebold–Mariano testing | Forecast evaluation | **Implemented**; research evidence, not trading advice | [`src/lib/vixWalkForward.ts`](../src/lib/vixWalkForward.ts) | [VIXR white paper](guides/markets/vixr-whitepaper.md) |
| `MVOL-CLAIM-AUDIT` | MVOL | Reserve-balances-versus-VIX claim audit with regime buckets, base-rate lift, and confidence diagnostics | Statistical claim audit | **Implemented** | [`src/lib/marketVolatility.ts`](../src/lib/marketVolatility.ts) | [Market Volatility page](../src/app/market-volatility/page.tsx) |
| `MCS-CURVE` | MCS | VAR(1) factor bootstrap for forward Treasury-curve distributions | Monte Carlo simulation | **Implemented**; simulation | [`src/app/simulations/mcs/page.tsx`](../src/app/simulations/mcs/page.tsx) | [Module description](../README.md) |
| `VOLF-SPY-RV` | VOLF | Five-session SPY realized-volatility forecast | Forecasting service | **Service-backed** when configured; otherwise unavailable | [`src/lib/server/volatilityForecaster.ts`](../src/lib/server/volatilityForecaster.ts) | [Client contract](../src/lib/volatilityForecaster.ts) |

## Securities-finance and risk models

| ID | Module | Model or decision logic | Type | Current state | Implementation | More information |
|---|---|---|---|---|---|---|
| `SQZ-LEGACY-HEAT` | SQZ | Borrow heat, fee momentum, squeeze score, and `GC/WARM/SPECIAL/HTB` classification | Weighted points and thresholds | **Prototype**, deterministic `SIM`; not trained ML | [`src/data/squeeze.ts`](../src/data/squeeze.ts) | [Spec021](specs/spec021/SPEC.md) · [Production plan](specs/spec021/PLAN.md) |
| `SQZ-BORROW-STRESS` | SQZ | Cohort-relative Borrow Stress score and lifecycle bands | Monotonic rules baseline | **Planned** as SQZ-T12 | Not implemented | [SQZ tasks](specs/spec021/TASKS.md) · [Signal design](specs/spec021/PLAN.md#1-borrow-stress-baseline) |
| `SQZ-SQUEEZE-RISK` | SQZ | Calibrated probability or risk band for a defined forward price/volume event | Interpretable classifier | **Planned** as SQZ-T13; label and horizon require approval | Not implemented | [SQZ tasks](specs/spec021/TASKS.md) · [Signal design](specs/spec021/PLAN.md#2-squeeze-risk-baseline-and-challenger) |
| `SQZ-RERATE` | SQZ | Normalized market-versus-internal rate gap and annualized gross opportunity | Rules / economic calculation | **Planned** as SQZ-T14 | Not implemented | [SQZ tasks](specs/spec021/TASKS.md) · [Signal design](specs/spec021/PLAN.md#3-re-rate-opportunity-baseline) |
| `INDEM-MONTE-CARLO` | INDEM | Borrower-default and market-path simulation with wrong-way risk, closeout loss, PFE, expected shortfall, and capital-cost views | Monte Carlo risk model | **Service-backed**; Phase 1 uses `SIM` and illustrative parameters | [`contracts/indemnification/`](../contracts/indemnification) | [Spec020](specs/spec020/SPEC.md) · [Handoff](specs/spec020/HANDOFF.md) · [Validation](specs/spec020/VALIDATION.md) |
| `PB-MARGIN-PRESSURE` | PB | Composite margin-pressure score and regime | Weighted deterministic score | **Implemented**; internal-book inputs are simulated | [`src/data/primeFinance.ts`](../src/data/primeFinance.ts) | [Prime Finance page](../src/app/prime-finance/page.tsx) |

## Optimization models

| ID | Module | Model or decision logic | Type | Current state | Implementation | More information |
|---|---|---|---|---|---|---|
| `IBAL-ALLOCATION` | IBAL | Securities-lending inventory allocation with constraints, elasticity-adjusted demand, solver diagnostics, and independent verification | LP/MIP optimization | **Service-backed** through a pinned InventoryBallast engine; supports synthetic and validated uploaded data | [`src/app/inventory-optimizer/`](../src/app/inventory-optimizer) | [IBAL white paper](guides/optimization/ibal-whitepaper.md) · [Help](guides/optimization/ibal-help.md) |
| `COLL-ALLOCATION` | COLL | Cheapest eligible collateral allocation subject to coverage, concentration, haircut, liquidity-reserve, and lot constraints | LP optimization | **Service-backed**; `SIM`/uploaded preview paths | [`src/lib/collateralOptimizer.ts`](../src/lib/collateralOptimizer.ts) | [COLL white paper](guides/optimization/coll-whitepaper.md) · [Help](guides/optimization/coll-help.md) |
| `MMKT-TICKETED` | MMKT | Multi-period cash deployment with dated cash continuity, policy constraints, and ticket/lot decisions | MIP with verified LP polish | **Service-backed** locally on illustrative forecasts and `SIM` rates | [`src/app/money-market/`](../src/app/money-market) | [MMKT white paper](guides/optimization/mmkt-whitepaper.md) · [Spec011](specs/spec011/SPEC.md) |
| `SXU-MATCHING` | SXU | Sources-to-uses matching with lexicographic priorities and elastic infeasibility diagnostics | LP optimization | **Prototype** browser solver on a synthetic book; production service not built | [`src/lib/optimization/simplex.ts`](../src/lib/optimization/simplex.ts) | [SXU white paper](guides/optimization/sxu-whitepaper.md) · [Spec012](specs/spec012/SPEC.md) |
| `MMFO-ALLOCATION` | MMFO | Synthetic money-market-fund allocation maximizing a net-yield proxy | Small LP solved by vertex enumeration | **Prototype**; no independent verifier or approved external binding | [`src/lib/mmfo/pocModel.ts`](../src/lib/mmfo/pocModel.ts) | [MMFO white paper](guides/optimization/mmfo-whitepaper.md) |
| `CASH-DASHBOARD` | CASH | “Optimized” funding path and savings display | Not a model | **Not a model**; deterministic illustrative placeholders | [`src/data/cash.ts`](../src/data/cash.ts) | [CASH white paper](guides/optimization/cash-whitepaper.md) |
| `LIQ-FORECAST` | LIQ | Cash forecast bands, breach probability, anomaly detection, and liquidity-lever optimization | Forecasting / anomaly / optimization suite | **Planned**; current LIQ page is not model-backed | Not implemented | [LIQ white paper](guides/optimization/liq-whitepaper.md) · [Spec014](specs/spec014/SPEC.md) |

## Macro, rates, and classification models

| ID | Module | Model or decision logic | Type | Current state | Implementation | More information |
|---|---|---|---|---|---|---|
| `REGIME-NAMED` | REGIME | Growth/inflation/liquidity/credit/policy factor scoring into named macro regimes and desk playbooks | Deterministic classifier | **Implemented**; mixed static/live inputs | [`src/data/macroRegime.ts`](../src/data/macroRegime.ts) | [Readiness assessment](validation/LIVE_DATA_READINESS_ASSESSMENT.md) |
| `BMRK-RATE-REGIME` | BMRK | Benchmark-rate regime classification | Weighted deterministic score | **Implemented**; source-dependent | [`src/data/benchmarkRates.ts`](../src/data/benchmarkRates.ts) | [Benchmark Rates handoff](features/BENCHMARK_RATES_DB_HANDOFF.md) |
| `RVOL-REGIME` | RVOL | Rate-volatility regime classification from level, breadth, z-score, direction, and vol-of-vol inputs | Weighted deterministic score | **Implemented**; source-dependent | [`src/data/rateVolatility.ts`](../src/data/rateVolatility.ts) | [Rate Volatility page](../src/app/economics/rate-vol/page.tsx) |
| `FCOST-REGIME` | FCOST | Funding-cost regime classification by tier, spread, z-score, and momentum | Weighted deterministic score | **Implemented**; modeled book overlays | [`src/data/fundingCost.ts`](../src/data/fundingCost.ts) | [Funding Cost page](../src/app/economics/funding-cost/page.tsx) |
| `FUND-STRESS` | FUND | Funding-stress gauge and desk signal overlays | Weighted deterministic score | **Implemented**; mixed source/fallback inputs | [`src/data/funding.ts`](../src/data/funding.ts) | [Funding page](../src/app/economics/funding/page.tsx) |

### EML research catalog

The EML page describes the following model families. The current implementation produces deterministic local outputs and metadata; the terminal readiness assessment states that these are **not trained/live-scored models** and that a genuine model registry and input-lineage pipeline are still required.

| ID | Displayed model | Type / described algorithm | Current state | Implementation |
|---|---|---|---|---|
| `EML-REC-PROB` | Recession Probability (12M) | Classification; logistic/probit yield-curve description | **Prototype** metadata and deterministic output | [`src/data/econModels.ts`](../src/data/econModels.ts) |
| `EML-INFL-NOW` | Core PCE Inflation Nowcast | Nowcast; XGBoost/ridge description | **Prototype** metadata and deterministic output | [`src/data/econModels.ts`](../src/data/econModels.ts) |
| `EML-RATE-PATH` | Policy-Rate Path Forecast | Time series; Bayesian VAR/LSTM description | **Prototype** metadata and deterministic output | [`src/data/econModels.ts`](../src/data/econModels.ts) |
| `EML-REGIME-HMM` | Macro Regime Classifier | Four-state HMM description | **Prototype** metadata and deterministic output | [`src/data/econModels.ts`](../src/data/econModels.ts) |
| `EML-FCI` | Financial Conditions Index | PCA factor-model description | **Prototype** metadata and deterministic output | [`src/data/econModels.ts`](../src/data/econModels.ts) |
| `EML-LABOR` | Labor Market Momentum | Dynamic-factor/Kalman description | **Prototype** metadata and deterministic output | [`src/data/econModels.ts`](../src/data/econModels.ts) |

See the [live-data readiness assessment](validation/LIVE_DATA_READINESS_ASSESSMENT.md) before relying on any EML status label or performance claim.

## Intelligence and language models

| ID | Module | Model or decision logic | Type | Current state | Implementation | More information |
|---|---|---|---|---|---|---|
| `SENT-COMPOSITE` | SENT | Explainable sentiment index, behavior state, divergence, and contrarian triggers | Weighted rules / classification | **Implemented**; most survey/social inputs remain simulated | [`src/data/sentiment.ts`](../src/data/sentiment.ts) | [Readiness assessment](validation/LIVE_DATA_READINESS_ASSESSMENT.md) |
| `NEWS-NLP` | NEWS | Optional headline sentiment and entity/event enrichment | NLP inference service | **Service-backed** only when the internal NLP service is configured; otherwise unavailable or explicitly simulated | [`src/lib/server/newsProviders.ts`](../src/lib/server/newsProviders.ts) | [News feature documentation](features/completed/Feature%20Addition%20-%20NEWS%20Terminal%20Module%20%28Market%20News%20%26%20Signal%20Intelligence%29.md) |
| `AGENT-LLM-PROFILES` | AI / agent workflows | Versioned provider/model routing profiles used by agent jobs | Language-model configuration | **Implemented contract**; runtime availability depends on configured in-boundary providers | [`contracts/agent/`](../contracts/agent) | [Spec009](specs/spec009/SPEC.md) · [Agent contracts](../contracts/agent/README.md) |

## Required metadata for the future registry

The machine-readable successor to this document should require, at minimum:

| Field | Purpose |
|---|---|
| `model_id`, `name`, `module_code` | Stable identity and ownership surface |
| `model_type`, `purpose`, `target`, `decision_horizon` | What the model does and what it predicts or optimizes |
| `implementation_status`, `data_mode`, `approval_state` | Separate implementation, provenance, and governance facts |
| `version`, `code_location`, `service_binding`, `artifact_digest` | Reproducible implementation identity |
| `input_contracts`, `required_sources`, `feature_version` | Data dependencies and feature lineage |
| `outputs`, `bands`, `reason_codes` | Interpretable result contract |
| `owner`, `reviewers`, `approved_at`, `rollback_version` | Accountability and lifecycle control |
| `validation`, `benchmark`, `limitations`, `monitoring` | Evidence, comparison standard, known failure modes, and drift/health controls |
| `model_card`, `methodology`, `whitepaper`, `runbook`, `ui_route` | Discovery links |

Recommended future source of truth:

```text
contracts/model_registry/model-registry.schema.json
contracts/model_registry/models.json
                 │
                 ├── generates docs/MODEL_DICTIONARY.MD
                 └── serves the MDLS /models page
```

Until that contract exists, edits to this file must be reviewed against the implementation, relevant module specification, and validation evidence. A model should never be marked production-approved merely because it appears in the terminal or has a green badge.

## Known gaps

- The catalog is not yet generated or completeness-checked against source code.
- Ownership and formal approval fields are missing for many legacy scoring rules.
- Model cards use module-specific formats rather than one platform contract.
- Several EML labels describe algorithms that are not backed by trained/scored artifacts.
- Production monitoring, promotion, and rollback are implemented unevenly across modules.
- The `/models` page is initially a placeholder and does not yet render this document or a machine-readable registry.

## Maintenance rule

Any change that adds, removes, materially changes, or promotes a model should update this dictionary in the same change until the generated registry replaces it. The update should link to the model card or specification and state the evidence level plainly.
