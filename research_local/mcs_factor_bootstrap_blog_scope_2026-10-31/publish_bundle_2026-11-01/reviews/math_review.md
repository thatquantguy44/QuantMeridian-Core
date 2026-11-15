# Independent mathematical and numerical review

Reviewed November 1, 2026. Verdict: **no required mathematical or numerical corrections found in the checked snapshot**. This is a separate AI technical review, not human review and not statistically independent economic evidence. Only review files were written.

## Scope and method

I read `article.md`, `latex_sidebar.md`, `experiment_notes.md`, the frozen engine and route, the relevant frozen chart code, the saved API responses, experiment summary, seed results and experiment script. I treated the prose and author summary as claims to check, not as authority. No author simulation or summary helper was executed.

The supporting `independent_math_check.py` implements Mulberry32's unsigned 32-bit arithmetic, path-major joint residual selection, the three factor recurrences, curve loadings, and linear-interpolated empirical quantiles in Python/NumPy. Its sample-SD calculation uses Python `statistics.stdev`. `independent_math_check.json` retains numerical results and the actual checked artifact hashes.

## Findings by severity

- **Critical / required:** None found for the publication claims and experiment settings.
- **FYI — small-maturity scope:** The displayed Nelson–Siegel formula agrees with every requested tenor. The engine separately substitutes a loading of 1 when `x < 1e-6`; the sidebar shows the usual analytic expression. The smallest experiment `x` is approximately 0.1415, so that safeguard is never used. No fix is needed for these results. If the sidebar is later presented as an exact statement for arbitrary engine inputs, add the implementation's piecewise small-`x` loading.
- **FYI — chronology and provenance:** Saved files support the numerical diagnostic and capture metadata, but cannot independently authenticate the time at which diagnostics were selected, the live database's underlying source vintage, or an absence of later historical revision. The final notes explicitly state this is not a time-stamped preregistered study and acknowledge the source-vintage limitation; no fix remains. No independent forecasting or coverage conclusion follows.

## Formula audit

1. **VAR and residual selection:** `coefficients[eq][0]` is the intercept, followed by coefficients on the previous level, slope and curvature. All next factors use the same previous vector; a single historical residual index supplies all three contemporaneous errors. The sidebar's vector recurrence and sampling-with-replacement description match. Mathematical indices 1…N correspond to array indices 0…N−1. There are exactly 2,497 retained residual vectors and regime tags; the unfiltered shock pool contains all of them. The seedable generator creates pseudorandom independent-with-replacement draws as the simulation's sampling mechanism; it does not preserve serial shock clustering. Fixed coefficients and factor-dependent dynamics are accurately distinguished.
2. **Yield reconstruction:** Code uses `x = tenorYears / avgLambda`, not maturity times the supplied lambda. Its terms are `beta0 + beta1*g + beta2*(g-exp(-x))`, as printed. Lambda is fixed at 1.766853482786172 under this implementation's scale convention. Tenors are years; yields and differences are in percentage points, so multiplication by 100 converts differences to basis points. The current curve uses the latest factor vector with this average scale, matching the caption's reconstructed-start warning.
3. **Anchor:** Code's `max(0,min(1,exp(...)))` equals the sidebar's `min(1,max(0,exp(...)))`. Defaults are `a=0.25` and `k=2` years. At each horizon the anchor-tenor median is subtracted from the supplied horizon rate, then the same tapered delta is added to every percentile (and the mean) at that tenor. Interval widths therefore stay fixed. The horizon rate uses sorted meeting dates and last-observation-carried-forward after an approximate trading-step-to-calendar conversion; this is appropriately abstracted as `r_h`. The anchor is off in both saved experiment runs, so it changes none of the published values.
4. **Indices and bands:** The engine checkpoints are 21, 63, 126 and 252 steps, with the final checkpoint labelled 12M. Maturity and forecast horizon are distinct. Percentiles use index `(n−1)*p` and linear interpolation. Bands are marginal, pointwise P5–P95 summaries; they are neither a simultaneous path envelope nor a calibrated probability statement about observed future rates. The article's median-line explanation and coverage caveats accurately reflect this distinction.

## Independently checked numbers

Both response fits are deeply identical, including the coefficient matrix, residuals, regime tags, latest factors and average scale. The main config is 10,000 paths; the comparison is 2,000, with 252 maximum steps and identical tenors/checkpoints. Both report `ok: true`, `source: DB`, factor as-of 2026-10-29, anchor disabled, and an unconditional residual pool. The implied 2,498 valid factor rows follow from 2,497 lagged observations; the raw row history is not in the bundle, so I did not independently refit the VAR.

At seed 20260914, the Python calculation reproduced all 120 saved horizon/tenor summary values for each path count. Maximum absolute difference was 8.88e-15 percentage points for 2,000 paths and 3.55e-14 for 10,000, attributable to floating-point reduction order. All five reconstructed current yields matched exactly. The Python calculation then independently regenerated all 20 seeds at both path counts: **4,800 summary values** matched within 3.55e-14 percentage points.

| 252-step, 10Y statistic | Sample SD, 2,000 paths (bp) | Sample SD, 10,000 paths (bp) |
| --- | ---: | ---: |
| P5 | 3.773737081660 | 1.558291204524 |
| P50 | 2.691796506708 | 0.633905725090 |
| P95 | 4.811819899059 | 1.680014584986 |

These use denominator 19 over exactly 20 outputs per setting. The article's 2.69 / 0.63 bp and the notes' six-decimal values round correctly. The 2,000-path runs share exactly the first 2,000 full paths of the 10,000-path runs at each seed; this was directly verified by reconstructing both from the same path-major random-index array. They are paired computational runs, not 40 independent economic samples.

| 10,000-path, 252-step output | P5 (%) | P50 (%) | P95 (%) |
| --- | ---: | ---: | ---: |
| 10Y | 3.303506941554 | 4.638802931011 | 5.946379317475 |
| 2Y | 3.196672533031 | 4.598914210618 | 6.006296017909 |

The caption values 3.30 / 4.64 / 5.95 and 3.20 / 4.60 / 6.01 are correct. The frozen chart independently scales its vertical axis from each selected tenor's current and outer-band values, which supports the warning against comparing apparent band heights. The captured response's complete result equals the main API result. The recorded anchor-off request forwards 10,000 paths. I did not perform a separate pixel-by-pixel screenshot audit.

The source-byte hash agrees with `implementationSha256`. A separate standard-library Node SHA256 over `JSON.stringify(savedFit)` also confirms the summary's fitted-input hash `c00ab8b4a690c3ac96086650c36e269b9664fae5d481da04e7d5d31a3b1d2ac5`; Node was used only for the author's serialization convention, not simulation or summary calculations.

## Interpretation and limits

The article appropriately confines the experiment to Monte Carlo variability conditional on a fixed fit and finite shock pool. It does not treat the observed approximately 4.25-fold median-SD reduction as a universal law, claim independent historical episodes from path count, equate in-sample fit with forecast accuracy, or confuse model percentiles with validated coverage. The added warning that combinations of historical shocks can create unfamiliar outcomes is mathematically appropriate.

This review does not establish input-factor accuracy, source-release timing, raw-data VAR fit correctness, economic validity, out-of-sample forecast performance, tail calibration, or whether 20 seeds estimate computational variability precisely. It is independent implementation verification against the same saved inputs, not independent economic data. Remote literature and Treasury pages were not retrieved in this mathematical review. No cross-model review or external CLI was invoked by this subagent; that remains the root session's workflow.

## Final editorial reconciliation

I reread the final article and experiment notes after the maturity clarification, full-size figure links, working-paper source label and scripted-diagnostic clarification. These changes preserve all reviewed formulas, numerical claims and uncertainty qualifications. The standalone sidebar is an exact substring of the final article. The three final document hashes below were verified against the files, not merely copied from the author. No numerical rerun was needed because inputs, code and claimed numbers were unchanged.

## Final capture audit correction

During final assembly, development reload requests overwrote a latest-response capture with anchor-on data. The final bundle now preserves that response separately as `evidence/post-capture-anchor-on-response.json`, and the notes explicitly record the correction. I independently verified the preserved response is anchored, still uses 10,000 paths and has the same fit; it is excluded from the experiment. The final `platform-captured-response.json` is **byte-identical** to unchanged `api-10000.json`, SHA256 `dead271c86a137c4741b94a6507527faaaa5c86bacbfd69b5d3a393501791682`.

The final proxy writes the capture only if `fomcAnchor=0` and no capture file exists, so subsequent anchor-on reloads cannot overwrite it. Its single-process synchronous existence/write sequence supports that freeze behavior. The complete eight-entry request log retains both sessions; its last entry is the successful 17:47:10.335Z anchor-off request forwarded with 10,000 paths. The final DOM shows the 10-year fit, unconditional pool, 10,000 paths, 2,497 shocks and correct 2Y percentile values; `[active]` on the checkbox denotes focus, without `[checked]`. A read-only port check found no listener on loopback proxy port 3011.

I reread the final source-label and notes correction sentences and updated hashes for the proxy, log, DOM, both recaptured assets, final prose and preserved anchored response. Engine, original API responses, experiment summary, seed results and standalone formulas are unchanged. All prior numerical checks continue to apply; numerical simulations were not rerun. I did not independently repeat the browser capture actions or conduct a separate pixel-by-pixel screenshot audit. No new required correction was found.

## SHA256 of actual checked snapshot

Hashes below identify the bytes available during this review. For any later edits, reconcile those exact changes and update the hash record before treating this verdict as covering the revised artifact.

| Artifact | SHA256 |
| --- | --- |
| `article.md` | `39b38a57325637a9524131651c1a171877c4361b1cff3bc1d06fff3c5c19ed87` |
| `latex_sidebar.md` | `467350f82a1028d7512d8b6bf04bf1c6f23b1fb3c56a509a516095bec22c6ab4` |
| `experiment_notes.md` | `dcbfdc121ceaa199554f0a19e35974279c0cb2243c0a18cab757883ae8b2b58a` |
| `scripts/run-experiment.mjs` | `188839c94d17330a85f05243ab769d0b6cbfb751e0c1c84fea2868a17eeae735` |
| `scripts/platform-proxy.mjs` | `836a74157fbf3d63036ae624f414af4be43fc6c2ed6d3401ba9ad395ce2630c9` |
| `evidence/api-10000.json` | `dead271c86a137c4741b94a6507527faaaa5c86bacbfd69b5d3a393501791682` |
| `evidence/api-2000.json` | `91d35868180630c49fedb96b34de64cb35f04fc39b4f89358756bd51ff9d15e9` |
| `evidence/experiment-summary.json` | `bb8948a02142e4af5dc13b383d2bcc23bb88c197ca7cd3b983e09ae3c4cd9b6f` |
| `evidence/seed-runs.json` | `51bf5d5af283734066ffe724499b6dc200373118647dee3647b5f4d10fb7f2d9` |
| `evidence/source/src/lib/server/mcsEngine.ts` | `444f77e5d46420a95d825dfbe7820bc9ec73365495db3ca7ee3f2f730f3ba7ea` |
| `evidence/source/src/app/api/simulations/mcs/route.ts` | `3f0d26397788eeaf21eafb573024e5a2a2afea8f374d1b84358ef0f1533a1b58` |
| `evidence/source/src/app/simulations/mcs/page.tsx` | `2449e5c5df3d1b8ebbe634af9d3e800a077d83da976eecd253ffb1841d879d85` |
| `evidence/platform-captured-response.json` | `dead271c86a137c4741b94a6507527faaaa5c86bacbfd69b5d3a393501791682` |
| `evidence/platform-requests.jsonl` | `2b655adfd3e6398924301f1dd0c3e126f8f3d5c939621165a7e4beac4fe5fe84` |
| `evidence/platform-capture-dom.txt` | `1bdca794706c824ad6919828281d1ef75f20f51f7fa24db1b44b1f70a044bd4a` |
| `assets/mcs-10000-10y.jpg` | `d15c346ce76eed1c2a7852e99ab3ac311ef3970ce9b8a96db7e8a7a9cd68fcf4` |
| `assets/mcs-10000-2y.jpg` | `e05350bd3e2c0045345016e5da914b5750cce1a184707151660c675eb94bdb03` |
| `reviews/independent_math_check.py` | `50e4ea3d7b37547092150f29dbb6fa15fe3f5ab7e96a22ddee1ed22ec70194b8` |
| `evidence/post-capture-anchor-on-response.json` | `3b90a02cd6e17d27e7277361e4182c2114d8d332969856e848404c37bab890e3` |

Supporting calculation output SHA256: `886d136065d2cff505e30a0438847d96bd2b8e72c5cb006eb6873999d1c8615f`.
