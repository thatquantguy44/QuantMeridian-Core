# Capability specification: `pr-regime`

**Status:** Proposed; depends on `pr-data`. Supplies probabilities and lagged
features to `pr-evaluation`. Parent: [SPEC.md](SPEC.md).

## Objective and models

Expose statistical market-state evidence and test whether it helps a specified
decision. It does not replace the terminal's macro `REGIME` model or establish
that a hidden state is a causal economic regime.

Model ladder: a fixed training-calibrated volatility/momentum threshold baseline;
then two- and three-state diagonal Gaussian HMM candidates on log return and
trailing volatility; optional lagged momentum feature. Full-covariance HMM is a
later sensitivity. A scalar random-walk Kalman filter supplies causal price-level
smoothing and trailing momentum; do not use a retrospective smoother for signals.

## Causal inference contract

- **REG-01:** fit/scaler/model selection/label calibration use only admitted
  training observations with availability strictly before the decision cutoff.
  At an end-of-session `t` decision, proposed fit window ends at `t−1`; current
  features through `t` must actually be available before the stated execution.
- **REG-02:** implement log-space forward filtering:
  `p_t(j) ∝ emission_j(x_t) × sum_i p_(t−1)(i) T_ij`.
  Initialize from the recorded start distribution and filter the training prefix
  under the current fitted model before processing new observations. Refit resets
  state using that new model's training prefix; do not reuse an old model's state
  indices/probabilities. No library private API dependency is required by the spec.
- **REG-03:** return normalized probabilities, entropy, numeric state ID, fitted
  state moments, transition matrix, occupancy and model/refit ID. Viterbi/smoothed
  histories may appear only in a separate retrospective diagnostic, never in the
  decision-time strategy path. One-observation `predict` is not this filter.
- **REG-04:** state IDs have no stable economic rank. Proposed label mapping ranks
  train-only means/variances as lower/middle/higher-return states, not literal
  bear/bull economic truth. If ranked moments tie within the approved tolerance,
  economic labels and label-dependent gates are unavailable; state ID may order
  display rows only. Never resolve an economic tie using an arbitrary index.
  Expose moments/ambiguity and visible refit label changes, not historical
  relabeling. Low confidence yields `UNCERTAIN`, not an invented neutral state.
- **REG-05:** proposed training-only candidate grid: 2/3 states, 252/500/756-row
  windows, weekly/monthly refit, explicit seed list. Bound total fits and use nested
  chronological selection; no full grid on the final holdout. Minimum occupancy,
  convergence and covariance-floor policies require D04 approval. Hitting a library
  iteration cap is not sufficient evidence of statistical convergence.
- **REG-06:** warnings, fit failure, degenerate emission variance and empty states
  produce an unavailable fit with reason and affected interval. Never forward-fill
  a prior regime or initialize a failed strategy position to flat. An explicitly
  selected baseline remains a separate model with its own result identity.
- **REG-07:** Kalman process/measurement variances are explicit positive model
  parameters tied to units and calibration window. Scaling absolute price levels
  changes their meaning. Warm-up/init, momentum horizon and zero-volatility
  behavior are recorded. Parameter search stays inside training folds.

## Strategy consumers

`kalman-momentum/v1`: positive trailing filtered momentum → long; otherwise cash.
`hmm-kalman/v1`: apply an explicitly calibrated train-only probability gate.
`donchian/v1`: compare current close with prior-only high/low bands; the proposed
long/flat variant stays long until a defined exit rule, not an unspecified daily
entry flag. `hmm-donchian/v1` gates entries/exits under a versioned policy.
Volatility targeting is a separately labeled ablation, capped at 1× initially;
unknown/near-zero volatility makes sizing unavailable. Target 15%, 20/55-day
windows and 2× notebook cap are reference parameters, not approved defaults.

Signal, rebalance and execution timestamps belong to evaluation. A single-price
signal cannot assume a trade at that already-observed close. Cross-asset portfolio
allocation from per-asset signals needs an explicit aggregation/risk-budget rule;
per-ticker experiments are not automatically a portfolio.

## Acceptance and implementation boundary

- **REG-AC01:** compare forward probabilities with a hand-computed two-state
  sequence; validate sums and underflow handling. A future-observation mutation
  cannot change earlier feature/decision outputs or selected training artifacts.
- **REG-AC02:** permuting state indices and correspondingly permuting all model
  parameters leaves economic labels/probabilities aligned; refit produces no use
  of the previous fit's IDs. Tied ranked moments with different transitions leave
  economic labels/gates unavailable under every index permutation; low confidence
  remains qualified.
- **REG-AC03:** perturb future prices and fit windows; causal Kalman outputs and
  earlier decisions remain unchanged. Failed HMM does not disable pure Kalman or
  invent a successful regime. Leakage tests cover preprocessing and selection too.

Model/filter code and pytest fixtures belong in `models/portfolio_regime/`; adapter
probability/lineage validation belongs in the service. Structure/commands are in
[PLAN.md](PLAN.md); typed boundary is [DATA_CONTRACT.md](DATA_CONTRACT.md).
Resolve D03–D05 before serving this capability. Never share a macro regime badge
or claim market state labels are observed ground truth.
