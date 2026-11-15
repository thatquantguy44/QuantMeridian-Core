# Capability specification: `pr-portfolio`

**Status:** Proposed; depends on `pr-data`. Provider of portfolio candidates and
numerical diagnostics to `pr-evaluation`. Parent: [SPEC.md](SPEC.md).

## Model ladder and proposed mathematics

All vectors/matrices use the same explicit asset order and annual horizon.
Annualization factor `A` is recorded, proposed 252 sessions for the first daily
equity profiles. Expected returns are arithmetic estimates, not realized CAGR.
Simple-return covariance and log-return HMM features are separate typed inputs.

| Model ID | Purpose / method | Release |
| --- | --- | --- |
| `equal-weight/v1` | Deterministic baseline over the eligible risky sleeve; cash allocation is explicit. | R1 |
| `min-variance/v1` | Minimize `w'Σw` with budget and supported convex constraints. | R1 |
| `mean-variance/v1` | Minimize `(γ/2) w'Σw − μ'w + κ ||w − w_prev||₁`; `γ > 0`, explicit κ, same horizon. Frontier points use explicit target-return constraints. | R1 |
| `black-litterman/v1` | Estimate posterior means and optional posterior covariance from dated prior/views, then use the same return-sensitive allocator. | R2 |
| `risk-budget/v1` | Solve a reviewed positive-risk-budget formulation, normalize to weights, then independently check risk-budget residuals. Constraints that prevent exact budgets produce a qualified result. | R2 |
| `relaxed-risk-budget/v1` | Experimental local optimization of normalized risk-budget dispersion with a scaled expected-return tilt. | R2 |

For portfolio volatility `σ = sqrt(w'Σw)`, marginal contribution is `Σw/σ`,
absolute contribution `RC_i = w_i(Σw)_i/σ`, and relative contribution
`RRC_i = w_i(Σw)_i/(w'Σw)`. Check `sum(RC) = σ` and `sum(RRC) = 1`.
Near-zero variance makes these ratios unavailable; do not add a hidden epsilon.
Negative component contributions are possible even for positive weights; diagnose
them rather than relabeling them as positive risk budgets.

Proposed relaxed objective:
`λ sum_i (RRC_i − b_i)^2 − (1 − λ)(μ'w / s_mu)`.
Here positive risk budgets sum to one, `0 ≤ λ ≤ 1`, and positive annual-return
scale `s_mu` is declared in the method profile. This is a redesigned research
objective, not an exact reproduction of the notebook's dimensioned loss.
Choose scale/λ on training folds only and disclose sensitivity. A bounded seeded
multi-start SLSQP candidate is locally solved; matching risk budgets does not prove
global optimality. Exact budgets must not be promised under arbitrary added caps.

## Requirements and constraints

- **PORT-01:** first profiles are long-only, unlevered, explicit cash plus risky
  weights summing to one. Each allocation profile supplies a fixed cash target
  `c`; risky weights sum to `1 − c`. Risk budgets apply only to risky assets,
  not zero-variance cash. A cash-only profile has no risk-contribution ratios.
  Do not introduce free cash as a hidden minimum-variance escape. Support per-name min/max, disjoint sector/group caps,
  forbidden assets and turnover caps incrementally through capabilities. Current
  holdings are drifted to the actual rebalance time before computing turnover.
- **PORT-02:** sample covariance is a transparent baseline; Ledoit–Wolf shrinkage
  is the proposed stable alternative. Require symmetry, PSD/conditioning checks,
  observation counts and effective window. No automatic matrix repair. An approved
  ridge/shrinkage policy is an explicit changed estimate with its own identity.
- **PORT-03:** BL specifies dated benchmark weights or market caps, risk aversion,
  τ, absolute/relative view matrix `P`, values `Q`, uncertainty `Ω`, confidence
  mapping, annual/excess-versus-total convention and validity horizon. Validate
  dimensions and PSD/positive uncertainty; unknown caps cannot become equal caps.
- **PORT-04:** isolate mean-view and covariance effects. Holding Σ fixed, changing
  only μ leaves minimum-variance weights unchanged; it must affect an appropriate
  mean-variance fixture. Never imply that BL necessarily improves performance.
- **PORT-05:** the adapter recomputes constraints, objective, variance, return,
  costs and risk contributions from normalized input and candidate weights without
  trusting solver summaries or calling the solver to verify itself. Small analytic
  and second-formulation fixtures independently test this verifier.
- **PORT-06:** return solver termination, candidate feasibility and optimality
  evidence separately. Convex accepted status plus residual checks can qualify a
  verified preview; inaccurate, stopped, nonfinite or failed verification suppresses
  consumable weights. Experimental nonlinear results retain `LOCAL_CANDIDATE`.

Proposed numerical tolerances requiring D04 approval: budget/bounds/group residual
`1e-7` absolute in weight units; scalar objective/return/variance reconciliation
`1e-8 + 1e-6 × abs(reference)` in its declared units; relative-risk-contribution
sum `1e-6`. Reject variance ≤`1e-12` for ratio metrics. No clipping or normalization
of returned weights to make a failing candidate pass. Display rounding is separate.

## Acceptance and verification

- **PORT-AC01:** two uncorrelated equal-variance assets have equal min-variance
  weights. For diagonal covariance and positive volatilities, equal risk budgets
  match inverse-volatility weights; unequal budgets match weights proportional to
  `sqrt(b_i) / sigma_i`, scaled to the supplied risky capital `1 − c`. Check both
  independently within approved tolerances, plus a negative risk contribution case.
- **PORT-AC02:** tamper a weight, asset order, objective, cash amount or residual;
  verification fails. Infeasible budgets/caps and indefinite covariance expose no
  verified allocation. Equal-weight violating mandate caps is also not eligible.
- **PORT-AC03:** BL view/covariance controls meet PORT-04; unknown availability or
  inconsistent annual/excess units fails admission. No short weight appears in a
  long-only profile. Relaxed solutions never claim a global optimum.

Proposed numerical code belongs in the standalone `models/portfolio_regime/` project, with a verifier
in `services/portfolio_regime_api/src/portfolio_regime_api/verification.py`.
Tests live beside those owners; see [PLAN.md](PLAN.md) commands. Follow typed
contract style in [DATA_CONTRACT.md](DATA_CONTRACT.md). Resolve D02/D04/D05 before
implementation; never extend the existing LP core silently into a QP/HMM runtime.
