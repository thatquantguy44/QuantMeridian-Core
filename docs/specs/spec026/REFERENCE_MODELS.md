# Spec026 reference-model and source review

**Inspected:** 2026-11-01, without executing notebooks, installing their packages,
downloading market data or treating saved outputs as verified findings.

## Archive identity

Input: `zips/Regime & Portfolio Optimization.zip`. SHA-256:
`c38f7b09a09ab0ea39612b7739e9e3a00f93cd95a8a241112905457d863abdb3`.
Ignore the four `__MACOSX/` sidecars. The four notebooks contain twelve code cells:

| Notebook, exact archive member | Cells | SHA-256 of notebook bytes |
| --- | --- | --- |
| `Risk parity vs relaxed risk.ipynb` | 2 | `93f5f86fc27308c34b929d319e2f870e61e5d62f89393196ea9dcc9bace3ed8c` |
| `Markowitz vs black litter man.ipynb` | 7 | `e4800d5c9c6be8030582e0fd38094c4a7fd628d4558f718daf227e6ce13786a8` |
| `HMM momentum.ipynb` | 2 | `237b4a41d755635f1b5a0c6e4215d77cbb8efc49b19b363131fa73c06aace59e` |
| `HMM market regime.ipynb` | 1 | `cf0f2ea5fe3dfc82d9afb546bea0e5abc5993f506788e0f9260f65c1a951d6d1` |

Cell references below are zero-based. Notebook possession does not establish
authorship, redistribution rights or permission to ship copied source. Reimplement
reviewed methods against independent tests; resolve source licensing before reuse.

## What to retain and what to correct

| Reference / location | Observed design | Proposed module treatment |
| --- | --- | --- |
| Risk parity, cells 0–1 | Five Indian equities (`RELIANCE.NS`, `TCS.NS`, `INFY.NS`, `HDFCBANK.NS`, `ICICIBANK.NS`), 2020–2024 data; long-only SLSQP; equal risk contribution versus a return tilt with `lam = 0.40`. | Retain the risk-budget and allocation comparison. Use admitted asset IDs and actual returned columns; the supplied cells rely on imports not shown, silently drop incomplete rows, and do not check solver success before reading `.x`. |
| Risk parity, cell 1, `relaxed_risk_parity` / `portfolio_stats` | Squared absolute risk-contribution dispersion is combined directly with daily expected return; weights are fitted and reported on the same history. | Specify a dimensionless relative-risk-budget loss and versioned return scaling. Treat original statistics as in-sample descriptions, not a backtest. Report convergence and independent residual checks; never promise global optimality for SLSQP. |
| Markowitz / BL, cells 2–4 | Five Indian equities, 252-row estimation windows and 21-row steps. Static market caps and an undated 15% annual Reliance view. Both branches call `min_volatility()`; BL uses posterior covariance. | Retain rolling allocation, views, stability and diversification diagnostics. A covariance change can change minimum-variance weights; this experiment does not isolate the effect of posterior expected returns. Compare prior versus posterior means under the same return-sensitive objective, then run a separately labeled covariance sensitivity. Date all caps/views and align horizons. |
| Markowitz / BL, cells 5–6 | Average weight differences, half-L1 target-to-target turnover, HHI and effective number of assets. No realized wealth simulation. | Retain descriptive target stability, but distinguish it from executed turnover versus drifted holdings. Compare on matched windows, costs and constraints before making performance claims. |
| HMM momentum, cell 0 | Seven US technology/growth stocks, 2015–2025; scalar causal Kalman filter; full-sample scaling, HMM fitting, state decoding and return-ranked labels. Signals are shifted one row. | Retain Kalman/momentum and HMM ablation ideas. Shifting positions does not repair full-sample training leakage. This cell is retrospective exploratory analysis only. |
| HMM momentum, cell 1, `fit_hmm` / `predict_regime` | A second experiment uses 3 × 252-row rolling training, train-only scaling/labels, daily refits and one-row `model.predict`. Buy-and-hold starts earlier than the trained strategies; fit failures continue with initialized zero positions. | Credit the walk-forward improvement. Replace isolated one-row decoding with explicit sequential filtering, preserve training/filter identity across refits, align evaluation starts, and expose failed intervals instead of inventing flat positions. Pure Kalman baselines must not depend on successful HMM fits. |
| HMM market regime, cell 0 | SPY, 2010–2025; 500-row rolling diagonal HMM on return/volatility/momentum; 55-day lagged Donchian bands; 14-day ATR calculated but not used in sizing; 15% volatility target, 2× cap and 5 bp position-change cost. | Retain breakout/regime/volatility ablations and explicit lagged bands. Do not present unused ATR as an active model feature. First supported strategy is long/flat and unlevered; short/leveraged notebook variants need borrow, financing and permission contracts. |
| HMM market regime, cell 0, fit exception / comparison / metrics | Fit failures are forward-filled. Exact sign splits leave almost no genuine neutral band. Only the HMM branch deducts costs in the comparison. Several Sharpe calculations use CAGR/volatility; regime subsets are treated as contiguous return histories. | No hidden state carry after failure, no arbitrary neutral label, common cost treatment, standard excess arithmetic-return Sharpe, and no contiguous CAGR/drawdown on disjoint regime subsets. Show occupancy, state moments and conditional statistics instead. |

All examples use Yahoo downloads and mutable adjusted histories. They do not
establish point-in-time universe membership, corporate-action knowledge, a licensed
production feed, or model superiority. No reported notebook performance is adopted.

## Recommended first-release scope

Daily liquid listed equities and ETFs, single currency and exchange calendar per
experiment, long-only portfolios and long/flat strategy overlays. This spans the
Indian-equity construction examples and US-equity/SPY regime examples without
mixing INR and USD returns. US and India are candidate separate universes, not
approved source feeds. ETF total returns can represent broader asset exposure;
direct bonds, derivatives, FX conversion, tax lots, intraday data, shorts and
leveraged financing follow later contracts. The seven-stock technology basket
is a reference case, not a universal or survivorship-free investment universe.

## Repository and upstream evidence

- [docs/services.md](../../services.md) is the current service ownership standard.
  [Spec016](../spec016/SPEC.md) and the [collateral adapter](../../../services/collateral_optimizer_api/README.md)
  establish immutable external model, adapter, independent verifier and drift gates.
- [Spec015](../spec015/SPEC.md) owns proposed durable optimization operations;
  its history/storage/identity choices are not assumed complete.
- `services/optimization_core` is continuous LP-only today. It is not a portfolio
  QP, risk-parity or HMM engine. No extension of its solver scope is implied.
- `services/agent_worker/src/agent_worker/worker.py` currently claims ECOIQ jobs;
  it is not a generic PORA or numerical-job executor. Some older runbooks call it
  scaffolding; current code and `docs/services.md` take precedence for this claim.
- QuantSmith local source inspected at
  `../../agentic_workflows/qf_workflow_sdk_public`, distribution version `0.1.0`.
  `src/quantsmith/pipelines/portfolio_construction.py` offers projected-gradient
  mean-variance reference logic; its final gross-cap scaling can violate the
  budget for an inconsistent constraint set. `quant/mean_variance.py` is an
  unconstrained-short closed-form helper with covariance inversion. Neither is
  adopted as the constrained production engine or a verified solver binding.
- QuantSmith PM, optimization, data-quality and backtest instructions inform the
  requirements. Its model-risk persona reports governance evidence and explicitly
  does not validate or approve a model. See [agent mapping](AGENT_WORKFLOW.md).

Inspected upstream SHA-256 evidence, **not a new trust pin**:

| QuantSmith relative path | SHA-256 |
| --- | --- |
| `instructions/portfolio_management.md` | `c56c119e942586273762d7c69f1520e1188fe2394b52f2eb8fbd9761668abf03` |
| `agents/portfolio_management/README.md` | `0eb15c68396c2e44e0e90774c248a0c24efe920c4099413f5a10fa507e332ed0` |
| `agents/optimization/portfolio_construction/instructions.md` | `01d2579b3679e344bd72fbe10678c04035acc8f02810354774e63f86a4a1ae31` |
| `agents/backtest_review/instructions.md` | `aacb7e245489952c1e58922ce5c8930c074bd51d1f4955885de61f88b836c34d` |
| `agents/data_quality/instructions.md` | `934ac84a8a793845cba9e48ddad44879464910740a93023c744aca3ea6045e35` |
| `agents/enterprise_risk/model_risk_management/instructions.md` | `ed2e517b00442a91fdcfdc7722bbd09f3f2d784c8ad7930761ae3b29341a237c` |
| `src/quantsmith/pipelines/portfolio_construction.py` | `4a616a8f170c0fae345cef054d0f0053eb0becc32263e19e28caa10eff7af12f` |
| `src/quantsmith/quant/mean_variance.py` | `5bf3b4bc60bb435a173d71b1baa231606fb54fc1208fcae3ea644c2907dc973a` |

## Official technical references checked 2026-11-01

These establish API/method capabilities, not selected dependency versions or
empirical effectiveness. Recheck against the exact approved lock at implementation.

- [PyPortfolioOpt Black–Litterman](https://pyportfolioopt.readthedocs.io/en/latest/BlackLitterman.html): prior/views and posterior estimates; separate estimation from the optimization objective.
- [hmmlearn API](https://hmmlearn.readthedocs.io/en/stable/api.html): sequence decoding, smoothing and convergence interfaces; decision-time filtering requires an explicitly tested causal contract.
- [scikit-learn TimeSeriesSplit](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html): ordered splits and configurable gaps; financial availability and overlapping labels require additional controls.
- [LedoitWolf](https://scikit-learn.org/stable/modules/generated/sklearn.covariance.LedoitWolf.html): shrinkage covariance candidate, to compare with sample covariance.
- [CVXPY solvers](https://www.cvxpy.org/tutorial/solvers/index.html): solver/problem compatibility and solver statistics; explicit QP backend selection proposed.
- [SciPy SLSQP](https://docs.scipy.org/doc/scipy/reference/optimize.minimize-slsqp.html): constrained local solve and termination controls; independent feasibility checks remain required.
- [FastAPI background tasks](https://fastapi.tiangolo.com/tutorial/background-tasks/): heavy computation needs a suitable execution boundary; API background callbacks alone are not a durable research scheduler.
