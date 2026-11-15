# MCS 10,000-path experiment and visual provenance

Executed November 1, 2026. Primary experiment: 10,000 paths. Comparison: 2,000 paths. This is a numerical sampling experiment conditional on one fitted model, not an out-of-sample forecasting study.

## Actual source and settings

The running local QuantMeridian MCS API returned `ok: true`, `source: DB` and factor as-of October 29, 2026. The saved requests use a ten-year fit, an unconditional residual pool and `fomcAnchor=0`. The window returned is November 1, 2016 through October 29, 2026. There are 2,497 lagged fitting observations/residual vectors, corresponding to 2,498 retained factor rows. No sample history was fabricated or substituted.

Both runs use the same coefficient matrix, latest factor vector, average lambda, residual vectors and regime tags. The common simulation seed is 20260914. Checkpoints are 21/63/126/252 simulated trading-day steps; tenors are 0.25/2/5/10/30 years. The “12M” label means 252 simulated steps, not an exact calendar-date assertion. Average lambda is 1.766853482786172 years under the implementation's maturity-divided-by-scale convention.

The data are a stored historical factor snapshot retrieved from Gold. No claim is made that the snapshot is point-in-time unrevised, that underlying factor estimation is independently validated, or that October 29 is the latest possible Treasury observation. Actual underlying source-vintage/release history was not inspected. The API data date, rather than the capture date or global ticker date, governs the figures.

## Reproducibility

- [Primary API response](evidence/api-10000.json) and [baseline response](evidence/api-2000.json) retain the full fitted input and output.
- [Frozen engine and route](evidence/source/src/) preserve the executed implementation. `scripts/run-experiment.mjs` transforms the frozen TypeScript engine with the installed esbuild and runs the same pure simulator on the saved fit.
- Both live API outputs were reproduced exactly at their default seed, including all tenor/horizon summaries and reconstructed starting yields.
- [Experiment summary](evidence/experiment-summary.json) records the implementation and fitted-input hashes. [All repeated-seed results](evidence/seed-runs.json) retain every tenor and horizon.
- Run `node research_local/mcs_factor_bootstrap_blog_scope_2026-10-31/publish_bundle_2026-11-01/scripts/run-experiment.mjs` from the repository root. It reads only the saved responses and frozen engine; it does not need a DB connection.

## Seed repetition

The repetition script defines its primary diagnostic as the 252-step, 10-year yield's P5/P50/P95 variability. Seeds are the 20 consecutive integers 20260914 through 20260933; they are arbitrary integer identifiers, not dates. Both path counts use each seed. Because the engine draws path by path, the first 2,000 paths in each 10,000-path run match the 2,000-path comparison at that seed. The paired runs are intentionally dependent; they are not 40 independent economic samples.

Standard deviations below are sample standard deviations across the 20 seed outputs, using denominator 19 and converting percentage points to basis points by multiplying by 100.

| 12-month, 10-year statistic | SD across seeds, 2,000 paths | SD across seeds, 10,000 paths |
| --- | ---: | ---: |
| P5 | 3.773737 bp | 1.558291 bp |
| Median | 2.691797 bp | 0.633906 bp |
| P95 | 4.811820 bp | 1.680015 bp |

This is a scoped numerical check, not a time-stamped preregistered study. These figures describe Monte Carlo sampling variability for this fit and seed set. They are not errors against true yields, coverage estimates, confidence intervals for forecast quality, or a guarantee about another fitted sample. No future outcomes were used or scored. All three scripted diagnostics are shown, including the tails; the article highlights the median for readability.

## Two genuine platform captures

The native MCS screen hard-codes 2,000 paths, but its real API supports 10,000. `scripts/platform-proxy.mjs` is a loopback-only capture proxy forwarding the actual application and requests to the running server. It changes only the MCS request's `paths` parameter to `10000`. It does not fabricate API replies, edit chart geometry, alter percentile values, or modify product source files. The FOMC checkbox was turned off through the actual UI.

The final platform-captured API response matches `api-10000.json` byte for byte. During assembly, a development-server reload issued default anchor-on requests and overwrote an earlier latest-response capture. That later anchor-on response is preserved separately in `evidence/post-capture-anchor-on-response.json`; it is not the experiment's input or the figures' source. The capture proxy was changed to freeze the first anchor-off response, the two native figures were captured again, and the proxy was stopped. The final frozen anchor-off response exactly matches the original primary run, so the numerical experiment and all published values remain unchanged. Complete forwarded-request logs retain both sessions. Forwarded requests are retained in `evidence/platform-requests.jsonl`; the captured response and DOM snapshot are retained alongside them. Selecting 10Y and then 2Y uses the same response and changes the native curve loading displayed.

- [Figure 1: 10Y](assets/mcs-10000-10y.jpg): native browser screenshot, cropped at capture to the MCS title, data date, settings, KPIs, fan chart and table. 12-month P5/P50/P95 are 3.3035069415535547 / 4.63880293101116 / 5.94637931747535 percent.
- [Figure 2: 2Y](assets/mcs-10000-2y.jpg): same capture region and run. 12-month P5/P50/P95 are 3.19667253303102 / 4.59891421061765 / 6.006296017909043 percent.

The two vertical axes autoscale separately. The figure captions explicitly say to compare printed values rather than visual band heights. The UI's “Current” is a reconstructed value, not proof of an exact observed Treasury quote; its “Median path” connects pointwise medians rather than necessarily tracing one simulated path. In-sample R² appears because it is part of the genuine screen and is not used to claim forecasting performance.

## Formula and source scope

The [LaTeX sidebar](latex_sidebar.md) converts the existing three model expressions. Its optional anchor expression is documented for completeness and explicitly off in this experiment. It describes the implemented shift of marginal summary statistics, not a refitted factor path or an arbitrage-free pricing process.

The figure and experiment claims are grounded in saved platform output and the frozen source. Primary literature supplies methodological background. The publication review records identify which remote sources were independently retrieved and any remaining limitations. No proprietary credentials, connection strings, or personal browser metadata are included in the public article or captures.
