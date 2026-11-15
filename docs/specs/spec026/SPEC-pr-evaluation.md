# Capability specification: `pr-evaluation`

**Status:** Proposed; depends on `pr-data`, `pr-portfolio`, `pr-regime` for the
combined workflow. Portfolio-only and regime-only adapters can ship separately.
Parent: [SPEC.md](SPEC.md).

## Research protocol

- **EVAL-01:** freeze hypothesis, universe, benchmark, train/validation/final test
  windows, selection grid, costs and acceptance rule before final holdout. Store
  every attempted candidate, not only the winner. Use chronological folds and
  purge overlapping outcome horizons; embargo/gap is explicit, never randomized CV.
- **EVAL-02:** all transformations, caps/views, feature choices and thresholds must
  be eligible at that fold's decision time. Synthetic tests prove mechanics;
  current-vintage fixed-universe experiments are exploratory and cannot pass a
  point-in-time deployment or historical-alpha gate.
- **EVAL-03:** first timing profile proposes signals after close `t`, execution at
  the next admitted session's open, with explicit overnight old-position exposure
  and open-to-close new-position exposure. Charge rebalance costs at that open.
  Missing/unadjusted-incompatible open makes this strategy profile unavailable;
  do not substitute a shifted close-to-close calculation. Other timing conventions
  require separate method versions and tests.
- **EVAL-04:** weight simulation maintains holdings/cash, price drift, rebalance
  quantities, initial entry and final liquidation policy. No daily constant-weight
  assumption unless daily rebalancing and costs are explicitly selected. Gross
  and net wealth reconcile to the ledger. Splits/dividends cannot be counted twice.
- **EVAL-05:** paired comparisons use the same eligible evaluation sessions,
  initial capital, cash-return convention, bounds and costs. Buy-and-hold,
  equal-weight/rebalanced, minimum-variance, pure momentum/breakout and vol-scaled
  baselines run independently. Show unmatched dates, coverage and reasons; never
  compare an earlier buy-and-hold inception against a later trained strategy.
- **EVAL-06:** mandatory fit/data failures invalidate completed aggregate metrics
  for that strategy/window. Preserve partial diagnostics and failure counts, but
  never turn a gap into zero return, cash or prior position by fallback. A future
  hold/flat safety policy must be approved as a separate explicit experiment.
- **EVAL-07:** transaction-cost rate is decimal cost per traded gross notional.
  Charge `sum(abs(trade_notional))/equity × cost_rate`; half-L1 is a separately
  labeled long-only turnover convention and must not halve costs. Include cash
  residuals, slippage assumptions and initial trades. Shorts/financing/taxes are
  unsupported initially, not assumed free.
- **EVAL-08:** isolate ablations: momentum → HMM filter → volatility sizing;
  breakout → volatility sizing → HMM gate; covariance/mean changes in BL; risk
  parity → relaxed tilt. Same capital/exposure/cost policy is required for an
  incremental model-effect claim. Report volatility/exposure differences otherwise.

## Metric definitions

| Metric | Proposed definition and unavailable state |
| --- | --- |
| Wealth / total return | Compound valid net returns from initial wealth 1; total `W_end − 1`. A gap invalidates the path; wealth ≤0 terminates it. |
| CAGR | `W_end ** (365.2425 / elapsed_calendar_days) − 1` over the actual contiguous evaluated window with positive wealth. |
| Volatility | Sample daily net-return standard deviation (`ddof=1`) × `sqrt(A)`; fewer than two values unavailable. |
| Sharpe | `mean(net_return − matched_cash_return) / sample_std(net_return − matched_cash_return) × sqrt(A)`; zero/unknown denominator or cash series unavailable. Not CAGR/volatility. |
| Sortino | Mean return above recorded daily target divided by `sqrt(mean(min(return − target, 0)^2)) × sqrt(A)`; include all eligible periods in denominator. |
| Drawdown / Calmar | Wealth/current running maximum −1 including initial wealth; Calmar is CAGR/absolute max drawdown when the latter is negative. |
| Turnover | Rebalance trade notional ledger plus declared one-way/half-L1 summary; drifted holdings, entry and cash are explicit. |
| HHI / effective assets | Risky-sleeve normalized long-only weights: sum of squared weights and reciprocal. Zero risky sleeve is unavailable; also display cash allocation. |
| Conditional regime analysis | Occupancy/counts, means, volatility, cost/exposure and transition diagnostics; do not compound disjoint regime observations into a contiguous CAGR or drawdown. |

`A` is the recorded sessions-per-year convention (proposed 252 for daily equity
profiles), not inferred from row count. Store full precision; annotate units.
Report fold dispersion, selection count, cost and window sensitivity, and
dependence-aware block-resampling uncertainty only after its protocol is approved.
No unconditional promise of Sharpe improvement or model superiority is required.

## Acceptance

- **EVAL-AC01:** hand-built overnight/open-to-close/cash/rebalance ledger reconciles
  gross/net wealth, initial-entry costs and drift-aware turnover; a same-close
  execution attempt fails. A missing open/session cannot create an invented fill.
- **EVAL-AC02:** future mutation cannot change earlier allocations/selection;
  final holdout is untouched until the experiment protocol is frozen. Baseline
  output survives HMM failure while paired strategy metrics show unavailable.
- **EVAL-AC03:** independent positive/negative/first-period-loss fixtures reconcile
  all defined metrics; noncontiguous regimes get no CAGR; no NaN or Infinity is
  serialized as a valid number. Every attempted model and failed fold is counted.
- **EVAL-AC04:** identical replay has the same experiment identity within recorded
  tolerances; an exported ledger reproduces displayed metrics. Tampered imported
  batch results fail independent checks and cannot acquire a verified badge.

Model evaluation/CLI and pytest fixtures belong in `models/portfolio_regime/`; terminal
comparison/export adapters and Vitest/Playwright tests remain in this repository.
See [PLAN.md](PLAN.md) commands and [DATA_CONTRACT.md](DATA_CONTRACT.md).
Resolve D03/D04/D06/D07 before the affected runtime; always retain failed trials,
never select on the final test or imply a feasible allocation validates a strategy.
