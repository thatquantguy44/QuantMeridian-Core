# Evidence and publication boundaries

Research cutoff: October 31, 2026. Audience: general market readers. This is a source-backed scoping packet, not an empirical study. No Gold data were queried and no historical forecasting experiment was run.

## How to read the evidence

Implementation references below use repository-relative paths and line spans from the frozen files in [evidence/src](evidence/src/). The snapshots, rather than moving line numbers in the working tree, define the reviewed version. `run_manifest.json` records their hashes. Source comments are context; executed statements establish behavior. Public literature supplies background, not evidence that MCS performs well.

## Primary-source reading list

### S1 — Three ways the curve changes

[Diebold and Li, Forecasting the Term Structure of Government Bond Yields, author-hosted working paper](https://rodneywhitecenter.wharton.upenn.edu/wp-content/uploads/2014/04/0404.pdf). PDF opened on October 31, 2026; document identifies its draft as October 14, 2003. Relevant locations: abstract and methods, PDF pages 2–6. The [NBER bibliographic record](https://www.nber.org/papers/w10048) identifies the subsequent 2006 Journal of Econometrics publication; the NBER page was search-accessible but direct reopening returned 403.

The paper motivates modeling curve movement with level, slope and curvature factors and autoregressive dynamics. Use for the model's intellectual background. Its sample, yield conventions and validation results do not establish MCS accuracy. The paper's decay notation must be reconciled with MCS's `tenor / lambda` convention before copying equations.

### S2 — What a Treasury yield actually measures

[U.S. Treasury, Treasury Yield Curve Methodology](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology). Opened October 31, 2026; page dated February 18, 2025; relevant section: methodology description.

Treasury describes an official par curve built from indicative quotations using a monotone convex method. This is background for explaining a yield curve. It does not verify the source, tenor coverage or construction of the local Gold Nelson–Siegel factors.

### S3 — Maturity points are not individual bonds

[U.S. Treasury, Interest Rates FAQ](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/interest-rates-frequently-asked-questions). Opened October 31, 2026; relevant questions: whether CMT yields equal actual-security yields, and whether the curve is zero-coupon.

Constant-maturity rates are read from a par curve and need not equal a specific bond's yield. This prevents treating a simulated curve point as a tradable bond quote or discount factor. Actual Gold fitting conventions still require upstream inspection.

### S4 — What FedWatch uses

[CME Group, Understanding the FedWatch Tool Methodology](https://www.cmegroup.com/articles/2023/understanding-the-cme-group-fedwatch-tool-methodology.html). Opened October 31, 2026; relevant sections: assumptions and overview. Search metadata displayed January 24, 2025; the extracted open page did not display a date, so verify dating before quoting it in an article.

CME describes probabilities derived from Fed Funds futures under stated assumptions. Use this to explain why MCS's curve-path adjustment should not be described as FedWatch odds. Do not add current meeting probabilities: none were researched for this packet.

### S5 — How to judge an uncertainty range

[Gneiting and Raftery, Strictly Proper Scoring Rules, Prediction, and Estimation](https://doi.org/10.1198/016214506000001437), JASA, 2007. Primary author-hosted [PDF](https://sites.stat.washington.edu/people/raftery/Research/PDF/Gneiting2007jasa.pdf) was returned with indexed text by search, including calibration, sharpness, CRPS and interval scoring. Direct PDF reopening timed out; DOI reopening returned 403. **Partial retrieval: this is a reference lead, not completed full-paper verification.**

The retrieved text motivates assessing distributions using both calibration and concentration, with proper scores. Before publishing a scoring formula or methodological attribution, obtain and inspect the relevant full-paper section. No MCS scoring result is established here.

## Claim ledger

| ID | Candidate claim | Evidence and status | Safe editorial use |
| --- | --- | --- | --- |
| C01 | MCS models the curve with three evolving factors. | `src/lib/server/mcsEngine.ts:121–197,205–209,296–312`; observed implementation. S1 supplies background. | Explain overall height, tilt and bend as a useful simplification; avoid claiming they explain a measured percentage of all rate variation. |
| C02 | The model repeatedly reuses whole historical three-factor surprises. | Engine `279–305`; observed. One residual-vector index is chosen per step. | Say the model keeps each sampled surprise's components together; finite simulated draws do not reproduce sample covariance exactly. |
| C03 | Historical shocks are not replayed in chronological episodes. | Engine `298–305`; methodological inference from independently drawn indices. | Explain that reusing a day's surprise is different from replaying a whole crisis. The fitted VAR still supplies state dynamics. |
| C04 | The displayed ranges are summaries of simulations. | Engine `317–332`; page `81–133`; observed. | P5–P95 is a central model range at each horizon, not a demonstrated 90% real-world success rate or a simultaneous path band. |
| C05 | A regime setting changes the shock pool, retaining the same fitted dynamics. | Engine `229–233,279–281`; route `70–81`; observed. | Describe a scenario using surprises tagged with a selected historical environment. It does not model probabilities of entering, leaving or persisting in that regime. |
| C06 | Very small shock pools are rejected or flagged. | Engine `217–219,283–287,345–346`; observed. Below 20 rejected; below 100 flagged. | State these are software thresholds, not statistical certification. Counts do not reveal independent episode count. |
| C07 | Increasing paths reduces simulation noise but does not add historical episodes. | Engine `279–300`; methodological inference. | A useful explanatory thesis; any numerical convergence or tail comparison requires its own run. |
| C08 | FOMC anchoring moves the displayed distributions without narrowing them. | Engine `425–449`; observed algebra. | Explain that the same tenor/horizon shift is added to every reported percentile and the mean. No evidence here that the adjustment improves accuracy. |
| C09 | The MCS anchor is not a FedWatch probability calculation. | Route `86–101` consumes meeting `impliedRate`; engine `365–374` and page tooltip identify the intended curve-bootstrap origin; S4 describes actual FedWatch. | The local code verifies consumption of a rate path. Upstream Treasury-to-meeting bootstrap details remain unverified comments until pipeline inspection. |
| C10 | The default screen uses 2,000 paths, ten-year fitting, five maturities, four horizons. | Route `9–12,41–42`; page `53–54,143–148`; observed defaults. | Explain these settings as choices. Maturities are 3M/2Y/5Y/10Y/30Y; future horizons approximately 1/3/6/12 months. Keep the two axes distinct. |
| C11 | The current curve is itself reconstructed. | Engine `177–178,335–337`; observed. | It uses the latest factors and the fitting window's average decay parameter; do not call it an exact observed Treasury curve. |
| C12 | Existing fit R² establishes prediction quality. | Unsupported: engine `164–174` is in-sample fit; no out-of-sample evaluation found in inspected module. | Hold. Explain why a good historical fit and useful future ranges are different questions. |
| C13 | Subtracting tenor percentiles gives a spread probability. | Unsupported: engine returns marginal summaries, not paired simulated tenor draws. | Hold. A spread/inversion probability needs paired path values and an explicit research extension. |
| C14 | A particular regime occurred only once or dominates the database. | Engine and UI comments assert historical characterizations; rows and upstream label construction uninspected. | Hold any sample counts, dates, episode uniqueness or named-regime historical claims until data verification. |
| C15 | The anchor's “Reliable” flag is measured accuracy. | Unsupported: engine `428–434` applies a fixed six-month cutoff. | Explain it as a horizon rule tied to intended input granularity, not an evaluated confidence level. |
| C16 | Shifting marginal summaries produces an arbitrage-free, fully reconciled curve process. | Unsupported: engine `437–454` shifts summary statistics after factor simulation. | Hold pricing/coherence claims; describe the adjustment at the level actually returned. |

## Figure production checklist

These are briefs for future figure production; no chart or numerical market exhibit has been produced in this packet.

| Figure | Reader question | Production input | Required labeling |
| --- | --- | --- | --- |
| Fan-chart reading key | What do the shaded areas mean? | Schematic with arbitrary values, or a saved Gold-backed MCS response | “Illustrative” for invented data; for real output show factor as-of, run date, window, regime, anchor status and path count. |
| Three curve movements | How can short and long rates move differently? | Schematic height/tilt/bend curves | “Illustrative”; avoid presenting the slope coefficient as identical to the 10Y–2Y spread. |
| Sampling whole surprises | What is kept together when history is reused? | Toy three-component residual cards | “Illustrative”; contrast joint component sampling with per-component sampling and whole-episode replay. |
| Same history, more simulated paths | Does a larger simulation know more? | Repeated seeds at 200/2,000/10,000 paths with frozen factors and settings | Seed-to-seed variability, fixed pool size, no future-information claim. Requires research harness. |
| Regime-pool inventory | How much history supports the scenario? | Verified tagged residual dates, episode definitions and counts | Residual count, contiguous episode count, missing labels and fitting window. |
| Anchor before/after | Why does the center move without a narrower band? | Paired outputs from a single saved base run and verified rate-path inputs | Anchor tenor, horizon, units and unchanged interval width; no implied “more certain” label. |
| Calibration scorecard | Did the range prove useful? | Frozen walk-forward predictions and realized matching yield targets | Test dates, origins, effective dependence, baseline, target convention and uncertainty; currently held. |

## Editorial vocabulary

| Technical term | Reader-facing explanation | Avoid |
| --- | --- | --- |
| MCS | Monte Carlo Curve Simulation: many possible future curves built by repeatedly sampling historical surprises | Assuming readers know the module's abbreviation |
| Yield curve | Government borrowing rates across different maturities | “One interest rate” |
| Tenor | Time until a security matures | Confusing a 10-year maturity with a ten-year forecast horizon |
| Factor | A simplified way of describing overall height, tilt or bend | “A cause of rate changes” |
| Residual | The daily move left over after the model's usual pattern | “Pure randomness” |
| Bootstrap | Repeatedly sample historical surprises to build possible outcomes | Implying new historical evidence is created |
| Regime | A label attached to a historical economic environment | Claiming a causal state or a forecast of that state's duration |
| Percentile | A cutoff in the model's simulated outcomes | A verified probability of what will happen |
| Basis point | One hundredth of a percentage point | Equating 25 basis points with 25 percentage points |

## Open source and data gaps

1. No governed QuantSmith market-research catalog was supplied or retrieved. The Research Analyst's `dispatch_market_research` step was not executed; no `knowledge://` source is cited. Public primary documents above serve as explicit contextual fallback.
2. Inspect the actual factor-building pipeline before stating fitted yield type, input maturities, yield units, lambda constraints, fit weighting, rejection rule or revision policy.
3. Inspect regime derivation and availability timestamps before historical conditioning experiments. A date join is not proof that the label was known on that date. Also check whether “current” actually resolved to a regime: route `70–73` falls back to an unrestricted pool if the latest factor row has no label.
4. Verify factor, benchmark and meeting-path vintages together. Route `48–58` fits relative to execution time and has no historical origin upper bound; a walk-forward study needs a separate as-of harness. `goldFomc.ts` reads `latest` data, not a forecast-origin-specific vintage.
5. Verify benchmark and meeting-path units end to end before live anchor exhibits. `src/data/macroInputs.ts` passes Gold latest values into benchmarks; comments in `goldFomc.ts` include a conversion in the returned display path, which MCS does not consume. This observation is a verification task, not a diagnosed MCS unit bug.
6. Retrieve and inspect S5's scoring definitions before using a formal score. Obtain data before any claim of accuracy, coverage, comparative performance, or economically useful returns.

## Open Questions

Which real historical snapshots can be shared publicly? Are the Gold factors fitted to CMT par points, a zero curve or another convention? Are point-in-time labels and meeting-path vintages retained? These affect future empirical posts; they do not block the scoped explainers.

## Next Actions

Draft an introductory explainer from accepted implementation claims and clearly labeled schematics. Resolve lineage and freeze a dataset before running the experiments in the modeling brief. Reopen relevant primary sources and verify figure inputs before publication.
