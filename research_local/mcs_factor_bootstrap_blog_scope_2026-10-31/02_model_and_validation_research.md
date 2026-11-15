# MCS model and validation research

Research date: 2026-10-31. Audience: general market readers; equations and validation details are author research, suitable for optional sidebars. Status: implementation research and proposed experiments, with no Gold dataset inspection or measured forecasting results.

This report was produced by a separate worker following the inspected QuantSmith Modeling Agent contract in `agent_inputs/modeling/`. It is not a QuantSmith SDK run. The selected local QuantSmith copy differs from the approved package and assets fingerprints; see `run_manifest.json`. The Research Reporter family is proposed only. Public literature and source verification belong to the coordinating research record.

## Reader decision and plain-language explanation

The practical decision is how to interpret a chart of possible Treasury yields without turning it into a promise about interest rates. MCS starts with three numbers describing the curve's broad height, tilt and bend. It estimates how those numbers tended to evolve together, then repeatedly adds surprises drawn from its historical fitting errors. Repeating this process produces a collection of possible future yields.

A useful analogy is replaying shuffled bundles of historical weather surprises through a simple weather model. The bundles keep three same-day surprises together; shuffling loses their original calendar sequence. Choosing only bundles from a named economic regime changes the scenario's ingredients. It does not simulate the chance of entering or leaving that regime.

The FOMC switch then moves each displayed distribution toward a supplied meeting-date rate at the short end, with progressively smaller moves at longer maturities. It leaves the displayed range's width unchanged. This operation does not establish that the moved range is better calibrated.

Safe public phrasing: **“These are model-generated ranges conditional on a historical sample and settings. They show how the model responds to its assumptions; their real-world reliability needs separate testing.”**

## Evidence map: what the implementation does

All paths below point into the frozen `evidence/` directory in this research folder. Line references are to those snapshots, not to a later working tree.

| Step | Observed implementation | Source |
| --- | --- | --- |
| Retrieve fitting history | Query Gold NS factors, left-join same-date regime labels, order ascending; lower cutoff is calculated from the server's current date. The query shown has no explicit upper date bound or historical origin argument. | `evidence/src/app/api/simulations/mcs/route.ts:46–59` |
| Select valid rows | Keep `fit_valid` equal to numeric `1` or string `"1"`; require at least 30 valid rows. Adjacent retained rows become lag pairs, even if invalid or missing dates leave a gap. | `evidence/src/lib/server/mcsEngine.ts:121–136` |
| Fit dynamics | Three linear equations use an intercept and all three prior factors. Normal equations are solved with partial-pivot elimination; singular directions receive zero contribution. No stability constraint is applied here. | `evidence/src/lib/server/mcsEngine.ts:78–98,138–175` |
| Attach regime | Tag each fitted residual with the regime on the destination date. Count available tagged residuals; missing tags remain null. | `evidence/src/lib/server/mcsEngine.ts:146–150,177–196` |
| Fix curve shape scale | Arithmetic mean of valid rows' lambda values becomes a fixed reconstruction parameter for every future checkpoint and the displayed starting curve. | `evidence/src/lib/server/mcsEngine.ts:177–178,308–312,335–338` |
| Draw shocks | Optional regime filter selects residual indices. Each simulated step draws one whole three-component vector uniformly with replacement. There is no block draw, regime transition model or separate coefficient fit by regime. | `evidence/src/lib/server/mcsEngine.ts:273–305` |
| Enforce pool limits | Fewer than 20 shocks throws; fewer than 100 flags a sparse pool. These are implemented operating thresholds, not demonstrated statistical sufficiency thresholds. | `evidence/src/lib/server/mcsEngine.ts:216–219,279–287,340–346` |
| Summarize outcomes | Collect reconstructed yields at checkpoints, sort each tenor separately, linearly interpolate p5/p25/p50/p75/p95 and compute the mean. Individual paths are not returned. | `evidence/src/lib/server/mcsEngine.ts:258–264,290–347` |
| Default run | Route defaults: ten-year fit, 2,000 paths, checkpoints 21/63/126/252 steps, maturities 0.25/2/5/10/30 years. Paths clamp to 200–10,000 and fit window to 3–30 years. Engine default seed is 20260914; route does not expose it. | `evidence/src/app/api/simulations/mcs/route.ts:9–12,40–44,75–81`; `evidence/src/lib/server/mcsEngine.ts:273–275` |
| FOMC adjustment | Requested by default; apply if DB-sourced spot and helper-returned meetings exist, otherwise report skip reason. At 3M, move median to supplied target; shift all stored summaries by a maturity-dependent amount. | `evidence/src/app/api/simulations/mcs/route.ts:83–115`; `evidence/src/lib/server/mcsEngine.ts:409–454` |
| Anchor data assembly | Helper requires nonempty probability and path tables, intersects meetings by date, uses each matched path's `implied_rate`, and reports the maximum model vintage it encounters. Its constructed outcome probabilities are not sampled by MCS. | `evidence/src/lib/server/goldFomc.ts:51–67,75–123,137–144`; `evidence/src/app/api/simulations/mcs/route.ts:94–101` |

## Interpretation boundaries for every post

**Joint shocks preserve historical combinations, not exact future correlations.** Sampling a residual vector together preserves its within-vector empirical joint distribution as the sampling target, conditional on the selected pool. A finite random draw approximates that distribution; its measured covariance will not generally equal the pool's covariance exactly. This says nothing by itself about future data, correlations after dynamic propagation, or the serial dependence of shocks. The three factors are Nelson–Siegel coefficients, not asserted orthogonal principal components.

**The draws are independent over simulation steps.** The fitted equations carry dependence from yesterday's factors. The residual draws themselves discard the original ordering, including clustered volatility or serial residual patterns if those exist. A block-resampling alternative would be a research extension.

**A regime-conditioned scenario can move the center as well as the tails.** The full-window residual mean may be near zero when a well-conditioned intercept fit satisfies the usual linear least-squares identities; a selected regime's residual mean need not be. The code does not subtract that selected mean. Repeatedly drawing from it adds a conditional mean shock at each step. The article must not describe regime filtering as changing only volatility.

**The model's starting curve is reconstructed.** The latest factor vector is combined with average historical lambda, rather than necessarily its own last-day lambda. Therefore “current yield” in this response is not automatically the observed Treasury quote or even the exact latest daily fitted NS curve. Verify the difference before publishing a spot-versus-forecast comparison. If daily factor fits change lambda, factor movements may also reflect changing parameterization; the fit lineage must be inspected before interpreting coefficients economically.

**The fan chart contains marginal checkpoint ranges.** Its connected median points need not trace one simulated path. A p5–p95 band contains the central 90% of the simulated yield distribution at that checkpoint; it is not proven 90% real-world coverage and does not say that 90% of entire future paths stay inside the band. Smooth chart connections are visual interpolation between checkpoints.

**Marginal summaries cannot recover joint trade outcomes.** The model generates jointly evolving factors internally, but returns per-tenor summaries. A yield-curve spread distribution, probability of inversion, bond portfolio loss, maximum drawdown or path-dependent event needs paired path-level outcomes and an appropriate pricing/exposure model. Subtracting two median yields or two p95 yields does not produce the corresponding spread percentile.

**More simulations reduce sampling noise, not the historical evidence gap.** Ten thousand paths from 25 residuals still reuse 25 residuals. A minimum pool count does not prove diverse economic episodes. No coefficient uncertainty, lambda uncertainty, regime-label uncertainty or future unobserved shock mechanism is resampled in this implementation.

## Implementation versus comments and labels

| Wording to verify or avoid | What evidence permits |
| --- | --- |
| Engine introductory comment calls this a “genuine forecast”; UI ends with “Model output, not a forecast.” | Describe statistical model projections/scenarios. There is no out-of-sample validation in these snapshots establishing reliability or superiority. |
| Introductory anchor comments say “market-implied policy path” and “better-informed central tendency.” | The detailed engine comment says the upstream method uses Treasury CMT points, not a fed funds futures feed. These snapshots show the consumer, not the upstream calculation. Treat specific CMT construction as documented upstream lineage awaiting independent inspection. “Better-informed” is not measured here. |
| “Covariance is preserved.” | Say whole historical factor surprises are kept together when sampled; qualify finite-draw approximation and scope as above. |
| “Reliable” at six months or less. | The implementation sets a horizon label using `monthsOut <= 6`, not an empirical calibration test (`mcsEngine.ts:425–434`). Use “nearer horizon” or explain that this is the module's heuristic label. |
| Regime history examples mention dates, dominance or single historical episodes. | Neither table contents nor label vintage was inspected. Historical claims, label frequencies and episode counts need dataset-backed evidence. A contemporary ten-year window does not include the 1970s. |
| The two-year taper is described as a “half-scale” in the UI. | Engine uses an exponential e-folding scale of two years; half-amplitude occurs after an additional `2 × ln(2)` years. Do not reproduce “half-life = two years.” |
| Anchor preserves “the distribution.” | It preserves the differences between stored quantiles within each tenor/horizon because all get the same additive shift. The function changes marginal summaries, not retained joint paths. No arbitrage-free or dynamic consistency constraint is checked. |
| FOMC probabilities displayed elsewhere imply this simulation samples meeting outcomes. | MCS passes meeting dates and `impliedRate`, not the outcome probabilities, to its adjustment. The helper contains fallback outcome construction; this is not evidence of measured futures probabilities. |

No code change is proposed or made by this research report. These findings define what the blog can safely say.

## Mathematical author appendix

Let `b_t = (beta0_t, beta1_t, beta2_t)'`. The fitted equations are

```text
b_t = c + A b_(t-1) + e_t
```

Each row of the returned coefficient matrix is `[c_i, A_i0, A_i1, A_i2]`. With retained training rows indexed `0,...,n`, the fit has `n` lagged observations. Simulation starts at the last retained vector and updates with `e*_s = e_Js`, where each `Js` is drawn uniformly and independently from eligible residual indices. No parameter is re-estimated within a simulated path.

For a positive reconstruction scale `lambda_bar` and maturity `tau` in matching year units, the code uses

```text
x = tau / lambda_bar
L1 = (1 - exp(-x)) / x
L2 = L1 - exp(-x)
y(tau) = beta0 + beta1 L1 + beta2 L2
```

The small-`x` implementation sets `L1 = 1` below `1e-6`. Other references can parameterize decay as `lambda × tau`; the reciprocal convention must be reconciled before comparing fitted lambda values. Beta1's conventional “slope” name is a shape coefficient: the short-end limit is beta0 + beta1 and the long-end limit is beta0, so a conventional long-minus-short spread has the opposite limiting sign to beta1.

For horizon `h`, the anchor constructs a target calendar date using `round(h/21 × 30.44)` days after the factor endpoint. It carries the last applicable supplied meeting rate forward, or uses supplied spot before any applicable meeting. With anchor maturity `a = 0.25` and scale `k = 2`, define

```text
d_h = targetRate_h - unadjustedMedian_(h,a)
w(tau) = clamp(exp(-(tau-a)/k), 0, 1)
adjustedQuantile_(h,tau,p) = unadjustedQuantile_(h,tau,p) + w(tau) d_h
```

The same shift is added to the stored mean. Hence the p95-minus-p5 width is algebraically unchanged, while the anchor-maturity median equals the target. The code constructs no new factor path from these adjusted summaries and does not refit a Nelson–Siegel curve through them. At longer maturities the additive taper can lie outside the original fixed-lambda three-factor loading span; no claim of adjusted-curve family membership or no-arbitrage follows.

Before any numerical example, independently check the spot and meeting-rate units end to end. `goldFomc.ts:126–134` divides supplied spot by 100 in the helper's returned `path`, while the MCS caller passes spot directly to the separate anchor input and uses only helper `meetings` (`route.ts:98–101`). The helper path is not consumed by MCS. This difference in use and comments calls for inspecting `getMacroInputs` and actual data units; it is not, on its own, evidence of an MCS unit bug.

## Baseline Comparison

These comparisons are proposed research, not findings. Hold date, information set, target definition, maturity, horizon and evaluation sample constant.

| Candidate | Question isolated | Minimum fair comparison |
| --- | --- | --- |
| No-change point forecast | Does the fitted central projection add useful information over today's curve? | Compare mean absolute error (MAE) of the median forecast by maturity and horizon. A deterministic baseline does not supply a meaningful calibrated interval. |
| Factor random walk with joint empirical daily-change draws | Do fitted factor dynamics help beyond shuffled historical changes? | Same training observations, fixed reconstruction convention and simulation count. Compare marginal scores and coverage as well as point error. |
| Same VAR with joint Gaussian residual draws | Does empirical shock shape matter relative to a Gaussian approximation? | Same fitted coefficients and residual mean/covariance convention; only the innovation distribution changes. |
| Same VAR with independent residual-column draws | What information is lost when same-day factor surprises are separated? | Deliberate diagnostic ablation, not a recommended production model. To compare spreads or joint outcomes, retain paired paths in research tooling. |
| Full-pool versus fixed regime-pool draws | How does choosing historical economic conditions affect projected ranges? | Same coefficients, starting factors, lambda, seed protocol and path count. Report pool mean, count, date range and number of distinct episodes. It is a scenario comparison unless regime selection is available in real time. |
| Anchor off versus anchor on | Does shifting the center improve error or calibration? | Identical unanchored run and as-of-consistent spot/meeting input. Separate adjustment arithmetic from predictive validation. |
| Daily versus block residual draws | Does preserving historical shock sequences change uncertainty? | Research extension; choose block lengths before holdout evaluation and disclose all choices tried. |

## Validation Design

This is an executable research specification for future work. It does not approve changes to product behavior. Exact calendar ranges and statistical gates remain pending data inventory.

### 1. Freeze the target and data before choosing a result

Universe: Treasury yield curves; display maturities 3M, 2Y, 5Y, 10Y and 30Y. Forecast checkpoints: 21, 63, 126 and 252 retained daily steps, with an explicit rule mapping them to observed market dates. The route's horizon-to-calendar conversion used by anchoring is approximate, not an exchange holiday calendar (`mcsEngine.ts:392–406`).

Choose a primary target: either a consistently reconstructed NS yield or an observed market yield with documented tenor and quote convention. Report the other as a separate target. Fitted-curve approximation error must not silently become forecast error or disappear from it. Record yield units in percent, changes in percentage points and displayed changes in basis points; one percentage point is 100 basis points.

Acquire read-only snapshots of factor rows, NS fit configuration and curve inputs, regime definitions/history/vintages, spot rate observations/releases, and FOMC path/probability model vintages. Inventory actual first/last dates, duplicates, nonfinite values, missing business dates, fit exclusions, join cardinality, gaps, lambda positivity/units and dataset revision behavior. Source path, extract time, row counts and content hashes belong in the run card. No credentials or private connection strings belong in these artifacts.

If release-time/vintage data do not exist, label the exercise a historical reconstruction. Do not call it a real-time tradable or point-in-time backtest.

### 2. Use time-ordered forecasting origins

Reserve a final chronological holdout untouched by window/model choices. Within an earlier development period, use rolling origins and fit only rows available at each origin. The production route uses today's date and has no historical upper bound, so validation needs a research harness that slices explicitly at origin and invokes frozen pure model functions. Repeatedly calling the live route is not a historical backtest.

For each origin, recompute coefficients, residuals, pool membership and average lambda from the permitted trailing sample. Do not reuse a fit from the complete dataset. Require factor and regime values actually available then. For “current regime,” use only the origin's known label; do not select the regime after seeing the future outcome. The same-day destination tag attached to a training shock is not by itself a leakage guarantee: upstream labels may be revised or depend on later releases.

For anchored runs, use only meetings, spot observations and model vintages available at that origin. Match freshness across inputs; MCS response `asOf` uses the factor endpoint and the route does not surface or validate the helper's vintage. Do not splice the newest policy path into old origins.

When tuning on origin-target pairs, purge training/development evaluation pairs whose outcome windows cross into validation and keep a boundary gap appropriate to the longest evaluated horizon. This separation applies to evaluation labels used for selection; ordinary factor observations known at an origin remain eligible for its fitting window. No random shuffling.

### 3. Separate overlapping outcomes from independent evidence

Daily one-year forecasts share most of their outcome period. Report the number of forecast origins and the number of nonoverlapping outcome periods, not just the larger count. Use nonoverlapping-origin sensitivity checks and dependence-aware uncertainty estimates, such as a predeclared moving-block bootstrap across origins, with block length sensitivity. Do not use an independent-binomial coverage confidence interval on overlapping daily forecasts. For sparse regimes also group by contiguous historical episode, so consecutive days are not presented as independent examples.

### 4. Score distribution quality and useful central estimates

- Point error: MAE for the median, RMSE for the mean where an actual mean forecast is evaluated. Compare by maturity and horizon; never pool levels with different scales without a stated normalization.
- Calibration: realized central 50% and 90% interval coverage; lower and upper exceedance rates separately; interval width and miss magnitude. Wide intervals can achieve coverage without useful precision.
- Quantile accuracy: pinball loss at the five reported quantiles. A weighted interval score can be computed from the median and central 50%/90% intervals with declared weights. The sparse quantile set is insufficient to recover an exact full-distribution continuous ranked probability score (CRPS).
- Full distribution: if research tooling retains draws, use empirical CRPS and probability integral transform/rank diagnostics. Distinguish **probability integral transform** from **point-in-time** data checks. Handle ties and discrete empirical distributions explicitly. Rank uniformity alone does not establish temporal independence or all forms of conditional calibration.
- Segmentation: origin regime known at the time, volatility conditions defined in advance, fitting window, maturity and horizon. State sample and episode counts with every segment.
- Report paired score differences against the prespecified baseline with dependence-aware uncertainty. Show all prespecified comparisons and label exploratory ones; a favorable average does not erase a failure in an important segment.

No superiority threshold is approved. Before opening the final holdout, agree the primary target/horizon/score, smallest meaningful improvement and uncertainty rule. A possible research gate is a positive paired score improvement whose dependence-aware confidence interval excludes zero, together with acceptable interval calibration; this is a proposal, not an existing product standard. If uncertainty is too wide to discriminate, report “inconclusive.”

### 5. Diagnose mechanism before explaining results

For every fit, record lag-matrix eigenvalues/spectral radius, condition number or equivalent solver diagnostics, coefficient movement across windows, residual means and variances, residual and squared-residual serial dependence, cross-factor dependence, outlier contribution and selected-pool means. Near-unit-root or unstable fits make long-horizon results sensitive; the engine does not stabilize coefficients. Compare the normal-equation fit with a numerically robust reference solver in research verification rather than treating a high in-sample R² as proof.

Check the maximum observed gap between successive retained factor dates and rerun after a prespecified gap-handling policy. Confirm that the “daily” step corresponds to the intended business-day interval. Record whether a few observations dominate the tail, and how much regime pools overlap distinct episodes.

Repeat a frozen representative origin across multiple fixed seeds and 2,000/10,000 paths; compare quantile variability. Keep this Monte Carlo sampling assessment separate from uncertainty about estimated parameters or unseen economic regimes. Run lambda convention sensitivities—training-average lambda, last-origin lambda, and a consistently refitted fixed-lambda factor history where feasible—without claiming their factor coefficients are automatically comparable.

### 6. Verify mechanics independently from market reliability

Proposed research checks: recompute one-step factor updates; confirm vector sampling uses one index for all components; independently reproduce quantile interpolation; verify fixed-seed repeatability; verify regime thresholds at 19/20/99/100 shocks; confirm anchoring preserves each reported quantile gap and gives the supplied target at the anchor tenor; verify tenor taper and horizon date conversion. These can use labeled synthetic fixtures and are mathematical/implementation checks, not forecasting evidence.

The frozen `mcsEngine.test.ts:16–43` checks database flag representation equivalence, exclusion of invalid flags, and minimum valid row handling. Its synthetic sequence is not a historical performance test. This report does not claim those tests were run by this worker or that they cover the mechanism checks listed above.

### 7. Store reproducible research artifacts

For an eventual run, save: immutable raw extracts and permitted lineage, run card/configuration, exact code hashes, train and origin dates, selected regime and counts/episodes, seed list, coefficient/residual diagnostics, base and adjusted summaries, paired path draws if joint analysis is requested, actual outcomes, scoring tables and scripts, rejected configurations, and figure-generating inputs. Record package/runtime versions and failed or excluded origins with reasons. A seed alone cannot reproduce changing input data.

## Overfitting Assessment

The supplied snapshots offer a model and several choices—fit window, regime, anchor, maturity, horizon and number of paths—but no out-of-sample comparison establishing their optimality. Selecting whichever setting makes the most appealing chart is another form of data selection.

Preregister a small primary analysis, enumerate every configuration tried, select only on development data, then evaluate once on the locked holdout. Exploratory regime narratives and window choices must remain exploratory. If many comparisons are used to support a formal superiority claim, specify a multiple-comparison adjustment or a selection-aware validation design and disclose the whole search. Do not add holdout periods after seeing failures merely to recover a headline.

Refitting model parameters in each origin accounts for changing estimates operationally; it does not make a single origin's predictive bands include parameter uncertainty. A parameter-resampling extension requires its own specification and validation. Likewise, short fitting windows and thin regime pools reduce independent information even if the simulator generates thousands of outputs.

## Recommended publication gates

| Claim type | Minimum evidence before publication |
| --- | --- |
| How the model and fan chart work | Code-backed explanation, independently checked arithmetic for illustrative examples, explicit synthetic/example labels and clearly stated limits. No live yield claim required. |
| A setting changes the displayed result in a particular way | Frozen paired outputs with all non-target settings held constant; enough seeds to distinguish systematic setting effects from draw noise. Pure additive anchor-width invariance can also be demonstrated algebraically. |
| A regime historically has fatter tails or predicts better | Inspected labels and point-in-time/vintage limits, adequate episode coverage, out-of-sample segmented evaluation and dependence-aware uncertainty. |
| The anchor improves the forecast | Origin-consistent historical anchor inputs and paired out-of-sample scores/calibration versus anchor off. The enforced median alignment alone is insufficient. |
| MCS is more accurate than a simple alternative | Prespecified fair baseline, locked evaluation and uncertainty evidence. A high fitting R² or an attractive fan chart does not meet this gate. |
| Portfolio risk or yield-spread probabilities | Paired path-level output, correctly specified pricing/exposures and independent calculation validation. Marginal percentile subtraction fails this requirement. |

## Stop Conditions

Pause empirical or predictive claims if origin-consistent data cannot be reconstructed, regime labels depend on future information that cannot be removed, duplicated/gapped/nonfinite inputs materially change the fit, units/curve convention cannot be reconciled, anchor vintages cannot be aligned, or important windows generate unstable/numerically unreliable dynamics. An explainer may still describe the mechanism and those limits accurately.

Pause a superiority headline if reasonable baselines perform as well or better, uncertainty is inconclusive, dependence-aware results reverse the naive result, or the favorable finding depends on a post hoc choice of window, regime or target. Preserve the negative result; it can support a useful limitations article.

## Open Questions

1. What are the factor fit's upstream quote/tenor conventions, lambda units and constraints, and revision policy?
2. Which real-time historical vintages exist for factors, regime labels, spot inputs and meeting paths? What calendar span survives those constraints?
3. Is the reader-facing analysis intended to explain scenarios, compare forecast calibration, or eventually assess bond exposures? Each needs different evidence.
4. Are “current curve” reconstruction differences material versus last-day NS fits and observed yields?
5. Which primary maturity/horizon/score and minimum useful improvement should be preregistered before empirical work?
6. How many distinct episodes, rather than days, support each proposed regime comparison?

## Next Actions

1. Draft mechanism explainers using the series scopes and this report's interpretation boundaries; keep equations in optional author notes or sidebars.
2. Inspect permitted Gold lineage and available vintage history before selecting dates or promising a backtest.
3. Agree one primary baseline comparison and a compact run card, then implement a research-only origin-slicing harness if empirical work is authorized.
4. Freeze data, execute checks and preregister gates before final holdout scoring. Publish findings at the strength the evidence supports.
