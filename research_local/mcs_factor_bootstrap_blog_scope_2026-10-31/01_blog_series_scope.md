# MCS blog series: six scoped posts for general market readers

Research date: 2026-10-31. Status: editorial and research scope, with no live market results. Prepared by a separate worker using the inspected QuantSmith Research Analyst prompt contract; this is not a QuantSmith SDK execution or a verified pinned-runtime result.

## Research question

Can a short series help a general market reader understand the ranges shown in MCS (Monte Carlo Curve Simulation), connect the model's assumptions to economic intuition, and recognize which questions require more evidence?

The testable editorial hypothesis is that a reader can explain the difference between a model-generated range, a historical scenario and an evaluated forecasting result after reading the series. A proposed reader check is to ask them to interpret one fan chart, identify what changes under the regime and anchor controls, and name one limitation. This check has not been run.

## Audience and assumptions

- The user selected **general market readers**. Explain why an output matters before introducing its construction. Assume familiarity with Treasury yields and the Fed; introduce the yield curve, percentiles and simulated scenarios in everyday language.
- Each post should take roughly 5–8 minutes to read, with one main question, two or three figures and an optional technical sidebar. Length estimates below are planning estimates.
- The intended subject is the existing MCS module and its factor bootstrap. No trading recommendation, valuation call or claim of forecast superiority is in scope.
- The frozen working-tree implementation is the source for current behavior. Gold data, vintages, upstream factor fitting and regime classification have not been inspected. Implementation facts do not establish empirical accuracy.
- This plan uses Research Analyst themes—testable questions, explicit assumptions, baselines, falsifiers and handoff gates. Its governed `knowledge://market_research` retrieval step could not be executed because no connected catalog was supplied; the coordinating worker is gathering public primary-source context separately.
- Proposed experiments, thresholds, staffing and dates below are research suggestions, not accepted product decisions or measured findings.

## Recommended portfolio and drafting order

Draft posts **1, 2 and 4** first as code-grounded explainers. Develop the data work for **3, 5 and 6** as a second lane. Readers can encounter them in numerical order once evidence is ready; publication does not need to wait on a blocked empirical post.

| Post | Reader's question | Distinct payoff | Current disposition | Estimated work after this scope |
| --- | --- | --- | --- | --- |
| 1 | How should I read the shaded range of future yields? | Interpret the chart without turning its median into a promise | Ready to draft as an explainer | 1 drafting day plus figure/review time |
| 2 | How can three moving parts describe a whole curve? | Understand why several maturities move together | Ready to draft as an explainer | 1–2 drafting days plus checked illustrative figures |
| 3 | What changes when I select a different economic regime? | Recognize the selected scenario and its historical sample | Empirical comparison on hold; method explainer possible | 2–4 analysis days after lineage audit, then draft |
| 4 | Why does the Fed anchor move the middle of the chart? | Separate a change in the chart's center from a change in its width | Ready to draft the transformation; live example on hold | 1–2 days plus input provenance and unit checks |
| 5 | How much history should inform a rate scenario? | See how historical sample choice can affect a result | Empirical findings on hold | 2–4 analysis days after data snapshot, then draft |
| 6 | How would we check whether these ranges are useful? | Understand what evidence earns trust in a model | Validation design ready; performance findings on hold | At least 3–5 analysis days after point-in-time data readiness |

These effort ranges are editorial estimates, exclude data-access and remediation delays, and are not delivery commitments.

**First draft recommendation:** Start with Post 1, “Reading the Range of Possible Treasury Yields.” Open with the reader asking where a 10-year yield might be in a few months; use one clearly illustrative annotated chart; explain its middle and two shaded ranges; finish with the three-question reading checklist. Keep the first draft near 1,000 words and introduce the three-factor machinery only as a one-paragraph bridge to Post 2. This gives readers an immediately useful way to interpret the module without depending on unavailable historical performance evidence.

The coordinating worker's [primary-source reading list and claim ledger](03_sources_and_claims.md) supplies contextual references. Use S2–S3 for Post 1's curve/maturity definitions; S1 for Post 2's factor-model background, after reconciling decay notation; S4 for Post 4's explanation of what actual FedWatch probabilities use. S5 is a **partially retrieved lead** for Post 6: obtain and inspect the full scoring definitions before quoting a formula or making a formal methodological attribution. These sources do not validate local MCS performance.

## Evidence map used by these briefs

All paths below are frozen copies inside this research folder. Line spans refer to those copies. Each brief's source references use these keys.

| Key | Frozen source and inspected lines | Supported observation |
| --- | --- | --- |
| E1 | [mcsEngine.ts](evidence/src/lib/server/mcsEngine.ts), lines 121–197 | Valid factor rows are used to estimate three one-lag equations. The most recent valid factor vector starts the simulation; decay is averaged over valid rows. |
| E2 | [mcsEngine.ts](evidence/src/lib/server/mcsEngine.ts), lines 204–209 and 273–347 | A smooth curve maps three factors to yields. Each simulation step draws one complete three-component residual vector; output summarizes yields separately by maturity and horizon. |
| E3 | [mcsEngine.ts](evidence/src/lib/server/mcsEngine.ts), lines 148–150, 177–193, 216–219 and 279–287 | A residual receives its realization-date regime label. A regime choice filters the shock pool; fewer than 20 shocks is rejected and fewer than 100 is flagged sparse. These counts are implementation safeguards, not evidence of statistical adequacy. |
| E4 | [mcsEngine.ts](evidence/src/lib/server/mcsEngine.ts), lines 383–454 | The anchor applies a maturity-dependent shift to each stored percentile and mean; the anchor maturity defaults to 3M and taper scale to 2 years. |
| E5 | [MCS route](evidence/src/app/api/simulations/mcs/route.ts), lines 9–12, 35–81 and 83–117 | Default request: 10-year fit and 2,000 paths; checkpoints 21/63/126/252 observations and maturities 3M/2Y/5Y/10Y/30Y. Gold supplies the factor/regime join and optional anchor inputs. |
| E6 | [MCS page](evidence/src/app/simulations/mcs/page.tsx), lines 81–139, 143–148, 173–229 and 244–269 | UI offers 5/10/15/20-year fits, starts at 10Y maturity, shows P25–P75 and P5–P95 bands, and defaults the anchor on. |
| E7 | [goldFomc.ts](evidence/src/lib/server/goldFomc.ts), lines 51–67, 84–123 and 137–144; [MCS route](evidence/src/app/api/simulations/mcs/route.ts), lines 86–101 | Anchor meetings are constructed by joining meeting-path/probability rows. MCS consumes meeting dates and implied rates, with a Gold SOFR/EFFR spot input. Upstream methodology and vintages still require source inspection. |
| E8 | [mcsEngine.ts](evidence/src/lib/server/mcsEngine.ts), lines 258–264, 317–347 and 392–405 | Quantiles are interpolated from sorted simulated outcomes; no individual simulated paths or spread probabilities are retained in the returned result. Horizon calendar dates use an approximation. |

The comments describe Treasury-derived anchor inputs and named historical regimes. Those descriptions are leads for upstream verification, not a substitute for inspecting the pipeline and actual dataset. In particular, a current 5–20-year UI fit window cannot be assumed to include 1970s observations.

## Post 1 — Reading the Range of Possible Treasury Yields

**Reader decision:** Decide which parts of a displayed rate scenario are useful context for a market discussion.

**Proposed headline:** “Reading the Range of Possible Treasury Yields”

**Standfirst:** A shaded chart organizes possible outcomes under a model. Here is how to read its middle, its edges and the assumptions that sit behind them.

**Scope and thesis:** In MCS, the outer shaded region spans the model's fifth to ninety-fifth percentiles at each displayed horizon. Its center line connects separate median outcomes. This is an implementation-backed description, not evidence that realized yields fall inside the range 90% of the time. Proposed editorial test: a reader should distinguish a pointwise model range from a guaranteed future range after seeing the annotated chart.

**Outline (about 900–1,200 words):**

1. Start with a familiar question: where might a 10-year Treasury yield be in several months? Introduce MCS as Monte Carlo Curve Simulation, which builds possible future curves by repeatedly drawing historical surprises. Explain why a range can organize uncertainty better than a single displayed number.
2. Read one chart from left to right: today's reconstructed curve value, separate future checkpoints, middle line and two shaded bands. Define a percentile in one sentence.
3. Explain that the middle line joins medians from different collections of outcomes; it need not describe one simulated journey.
4. Walk through the controls using one unchanged dataset: maturity, history window, regime, anchor status. State that changing assumptions can change the picture.
5. End with a three-question reading checklist: what data date is shown, what scenario settings are active, and what kind of uncertainty has the model left outside the chart?

**Proposed analysis matrix:**

| Hold fixed | Compare | Record | Baseline/control |
| --- | --- | --- | --- |
| Dataset, fit window, regime and anchor-off setting | 3M, 2Y, 5Y, 10Y and 30Y at 21/63/126/252 checkpoints | P5/P25/P50/P75/P95, current curve and fit dates | A horizontal line at the initial reconstructed yield, used as a visual reference only |
| One maturity and setting | Annotated percentiles versus a few labeled illustrative paths | Which objects are pointwise summaries and which are complete paths | A hand-checked toy example, explicitly labeled illustrative |

**Figure specifications:** (1) Annotated 10Y fan chart, yield in percent on the vertical axis and approximate months on the horizontal axis; distinguish the model date from the publication date. (2) A small toy diagram showing three full journeys and medians calculated separately at two checkpoints. Do not imply toy values are live Gold output.

**Data and evidence:** E2, E5, E6, E8. A live example needs a dated, reproducible response plus a data-publication check. The explainer can use a checked, clearly synthetic figure before a live snapshot exists.

**Falsifiers and acceptance criteria:** Hold if any caption describes the band as a confidence interval for a parameter, promises 90% future coverage, calls the joined medians one most-likely path, or presents the reconstructed “current” value as a verified market quote. Draft passes when every chart label is traceable to the response/schema and a nontechnical reader can answer the three reading questions. No predictive-performance claim is needed.

**Dependencies and boundary:** Can draft now. No rate outlook, policy prediction, bond-return inference or hedge recommendation.

## Post 2 — Three Moving Parts Behind a Treasury Yield Curve

**Reader decision:** Understand why a rate model treats short and long maturities as related outcomes.

**Proposed headline:** “Three Moving Parts Behind a Treasury Yield Curve”

**Standfirst:** Level, slope and curvature provide a compact way to describe the shape of rates—and to build scenarios that move across maturities together.

**Scope and thesis:** MCS evolves three estimated curve factors using their previous values, adds a sampled historical three-factor shock, then reconstructs yields. Drawing the three shock components together retains their empirical joint combinations in the chosen pool. It does not guarantee that a finite simulated sample exactly reproduces the pool's covariance, or that the future behaves like that sample. Proposed experiment: isolate the effect of drawing shocks together by comparing it with drawing each component separately.

**Outline (about 1,100–1,400 words):**

1. Introduce a curve as yields arranged by maturity. Show a general upward/downward shift, a tilt, and a middle-of-curve bend.
2. Name the three model factors only after the shapes are familiar. Explain that these are fitted descriptions rather than separate observed market instruments.
3. Follow one model step: yesterday's three values inform today's values; a historical surprise is added; the resulting curve is drawn again.
4. Explain why a historical surprise is sampled as a bundle. Use a three-column “one day's surprise” card and compare with breaking cards apart.
5. Describe what remains assumed: fixed fitted equations, repeated independent draws through time and a fixed reconstruction decay value.
6. Optional technical box: the factor evolution equation and curve-loading formula, including this implementation's `tenor/lambda` convention. Keep equations out of the main narrative.

**Proposed analysis matrix:**

| Question | Treatment | Control | Measure |
| --- | --- | --- | --- |
| Does breaking shock bundles alter relationships? | Joint historical residual draws | Independent draws by factor from the same pool | Pairwise residual dependence and resulting cross-maturity dependence; repeat across seeds |
| What does each factor do to curve shape? | Change one factor at a time with a fixed positive decay | Unchanged starting factors | Yield change by maturity |
| How does reconstruction choice affect the present-day reference? | Window-average decay used by MCS | Last-row decay, as a sensitivity study | Difference from the latest fitted curve across maturities |

**Figure specifications:** (1) Three small curve panels with a fixed factor perturbation, same axes and clearly illustrative units. (2) A “sample one row together” diagram. (3) Optional scatterplots comparing joint and independent shock draws; use empirical values only after analysis and show sample size.

**Data and evidence:** E1, E2. For the conceptual figures, hand-check formulas and label all inputs synthetic. The empirical dependence comparison requires the frozen residual pool, seed schedule, factor units and independent resampling implementation outside product code.

**Falsifiers and acceptance criteria:** Hold empirical conclusions if measured differences do not support the proposed contrast; report that outcome rather than selecting a more favorable maturity. Hold the main explainer if it says the factors are literally the 30Y yield, 10Y–2Y spread and a quoted butterfly. Draft passes when the three shapes, joint draw and limits are correct and no superiority claim is attached to the design choice.

**Dependencies and boundary:** Can draft now with illustrative figures. The independent-component comparison is a proposed ablation, not a current MCS option. More paths create more simulated draws, not more historical evidence.

## Post 3 — What Changes When We Replay a Different Economic Regime?

**Reader decision:** Interpret the regime selector as a particular historical-shock scenario.

**Proposed headline:** “What Changes When We Replay a Different Economic Regime?”

**Standfirst:** A regime label changes which historical surprises the model samples. The strength of that comparison depends on the history behind the label.

**Scope and thesis:** MCS estimates its factor dynamics on the full selected fit window. Selecting a regime narrows the historical residual pool; it does not estimate a new regime-specific model or simulate future regime transitions. Hypothesis for analysis: narrowing the shock pool can alter the outcome's location or width. Whether it does so materially, and in which direction, remains unknown.

**Outline (about 1,000–1,300 words):**

1. Start with a conditional question: how does this model behave when it repeatedly draws surprises from days carrying one economic label?
2. Explain the fixed equations and the changed sample in a simple before/after diagram.
3. Show the sample behind each eligible label: residual count, dates, distinct stretches of time and missing labels.
4. Compare unconditional and selected-regime results with the anchor off, using identical starting factors and fit coefficients.
5. Explain why many days from one episode do not provide the breadth of several independent episodes. Describe the built-in minimum and sparse warnings as safeguards.
6. Close with the difference between a historical conditional scenario and a prediction that a regime will persist or cause a particular yield move.

**Proposed analysis matrix:**

| Fixed settings | Comparison | Outputs | Baseline |
| --- | --- | --- | --- |
| Same snapshot, fit window, factor fit, start and seed schedule; anchor off | Unconditional pool versus every eligible regime | P50 change, P5–P95 width, shock count, residual mean and covariance | Unconditional joint bootstrap |
| Same label and full-window fit | All episodes versus leave-one-contiguous-episode-out, if multiple episodes exist | Sensitivity of center and width | All available episodes |
| Same settings | Pools below 20; pools 20–99; pools at least 100 | Rejection/warning behavior and observed episode breadth | Product safeguard behavior |

**Figure specifications:** (1) Timeline of regime labels and gaps, with count of contiguous episodes. (2) Matched-axis fan-chart small multiples with sample counts in titles. (3) A center-versus-width comparison with uncertainty from repeated Monte Carlo seeds, distinguished from historical sampling uncertainty.

**Data and evidence:** E1, E3, E5. Need the regime-generation rules, source inputs, label vintages and a point-in-time availability audit before describing a label as contemporaneously knowable. Request exact dates from the earliest qualifying factor row through the latest available observation no later than the research cutoff; do not prestate what regimes are present.

**Falsifiers and acceptance criteria:** The contrast is unsupported if differences disappear under seed checks or depend on one episode; that is a publishable limitation if accurately reported. Stop a predictive interpretation if labels use future information. A historical explainer can still describe a retrospectively classified sample when clearly labeled. A label meeting the 100-shock threshold does not automatically pass an adequacy gate.

**Dependencies and boundary:** Empirical post on hold pending data/lineage checks. Current implementation has no regime-transition probabilities, causal identification or regime-specific coefficient fitting. Do not repeat the source comments' 1970s historical examples as dataset facts.

## Post 4 — Why a Fed Path Can Move the Middle of the Chart

**Reader decision:** Understand what selecting the anchor adds to the displayed scenario.

**Proposed headline:** “Why a Fed Path Can Move the Middle of the Chart”

**Standfirst:** The anchor adjusts the central level of the displayed yield ranges. Its arithmetic and its source assumptions deserve separate attention.

**Scope and thesis:** At a given horizon, the anchor calculates the gap between the supplied meeting-path rate and the unanchored 3M median. It adds that gap, tapered by maturity, to every stored percentile and mean. Therefore the stored P5–P95 width for each maturity/horizon is unchanged by this transformation. This is a code/algebra claim; it does not establish better forecasts or a calibrated policy probability.

**Outline (about 900–1,200 words):**

1. Begin with two identical-width shaded bands at different vertical positions. Explain that a shifted center and a wider range answer different questions.
2. Trace the input as it actually reaches MCS: a spot SOFR/EFFR value and meeting dates/rates supplied by Gold.
3. Show the three-month median aligned with the supplied path rate, then explain the smaller shift at longer maturities.
4. Read an anchor diagnostic row: pre-anchor median, target rate, shift in basis points and horizon flag.
5. Explain the meaning and limit of the beyond-six-month flag. The code's “reliable” label is a rule based on horizon, not an evaluated confidence score.
6. Optional sidebar: one additive-shift equation and the taper formula. Specify that two years is an exponential scale, not a two-year half-life.

**Proposed analysis matrix:**

| Hold fixed | Compare | Required check | Control |
| --- | --- | --- | --- |
| Same simulated result and anchor inputs | Before and after applying anchor | Every stored quantile and mean receives the same tenor/horizon delta; band widths match within numerical tolerance | Anchor off |
| Same horizon and assumed input gap | 3M/2Y/5Y/10Y/30Y | Tapered shift follows the code formula | Full shift at 3M |
| Same fit end date and input vintage | Checkpoints on either side of six-month rule | Calendar mapping and `reliable` flag are explained correctly | Explicit calendar calculation |

**Figure specifications:** (1) Overlaid before/after fan charts for 3M with matching y-axis scale and equal-width annotation. (2) Shift size by maturity for one clearly illustrative gap, labeled as an arithmetic demonstration. (3) Optional input timeline showing model date, input vintage and meeting date separately.

**Data and evidence:** E4, E5, E7. The engine comments and UI describe a Treasury-curve-derived input rather than a Fed-funds-futures feed. The full upstream generation path must be inspected before publishing that derivation as an independently verified fact. The current output does not expose the consumed input vintages together, so a live example needs a separately captured lineage record and unit confirmation.

**Falsifiers and acceptance criteria:** Hold if arithmetic checks fail, a live input's units or vintages are unresolved, or a figure compares two independently rerun simulations and attributes all differences to the anchor. Draft passes as a transformation explainer when the exact same result is shifted in both panels and unchanged width is demonstrated. Any claim of improved predictive accuracy waits for Post 6's evaluation.

**Dependencies and boundary:** Can draft the transformation now. Do not describe the anchor as a CME FedWatch probability, a newly estimated factor path, an arbitrage-free recalibration or a proof of improved policy expectations. Postprocessing occurs on summaries; the current code does not regenerate anchored factor paths.

## Post 5 — How Much History Should Inform a Rate Scenario?

**Reader decision:** Understand why changing the history window may change the result, and why a more attractive chart is not a model-selection rule.

**Proposed headline:** “How Much History Should Inform a Rate Scenario?”

**Standfirst:** A recent sample may capture today's setting; a longer sample may include more kinds of surprises. MCS lets us inspect that tradeoff.

**Scope and thesis:** The UI offers four history windows. Changing the window can change the fitted equations, residual pool and average decay together. Hypothesis: some displayed outcomes may be sensitive to this combined choice. Neither the existence nor direction of material sensitivity has been measured here.

**Outline (about 1,000–1,300 words):**

1. Explain the recent-history versus broad-history tradeoff through an economic example framed as a hypothesis.
2. Show exactly what gets re-estimated when the window changes; retain one common observation cutoff.
3. Compare the 5/10/15/20-year choices across the same maturities and horizons, anchor off.
4. Separate sources of change with research-only ablations: fitted dynamics, shock sample and reconstruction decay.
5. Contrast having many simulated paths with having more historical periods.
6. End with a recordable rule: disclose the window and sensitivity rather than choosing the chart that supports the desired narrative.

**Proposed analysis matrix:**

| Axis | Levels | Controls | Measures |
| --- | --- | --- | --- |
| User-facing history | 5/10/15/20 years, conditional on actual availability | Common last eligible observation, anchor off, regime pooled, seed schedule | P50, P5–P95 width, valid-row count, gap pattern, decay and residual diagnostics |
| Simulation count | 2,000 and 10,000 paths, plus repeated seeds | Same fitted model and pool | Monte Carlo variability of displayed quantiles |
| Attribution | Change equations only; pool only; decay only | Common reference fit and frozen start | Change relative to full re-fit; label hybrids as research-only |

**Figure specifications:** (1) Four matched-axis fan charts at one maturity; caption records actual fit dates and observations. (2) A maturity-by-window heatmap of median changes at one preregistered horizon. (3) A table contrasting historical-data uncertainty, parameter uncertainty and simulation noise; do not imply MCS currently integrates all three.

**Data and evidence:** E1, E2, E5, E6. Need a common snapshot with enough valid daily factor rows for each window and a documented gap/duplicate audit. The API chooses a trailing cutoff relative to request time; a retrospective experiment must construct windows relative to its historical origin rather than calling today's route unchanged.

**Falsifiers and acceptance criteria:** A conclusion of “material window sensitivity” fails if differences are small relative to declared publication materiality and simulation variability. Publish a stability result if that is what the evidence shows. Materiality must be chosen before viewing results and stated in yield units. Hold comparisons if the windows end on different dates or if available coverage is mislabeled as a complete 20-year history.

**Dependencies and boundary:** Empirical post on hold pending snapshot. Do not declare one window best without held-out evaluation, or describe more paths as a cure for omitted regimes. Hybrid attribution experiments are not supported UI settings.

## Post 6 — How We Would Check a Rate Model Before Trusting Its Ranges

**Reader decision:** Recognize the difference between an attractive model chart and evidence of useful performance.

**Proposed headline:** “How We Would Check a Rate Model Before Trusting Its Ranges”

**Standfirst:** The useful test is what a model would have shown before the outcome was known, compared with simple alternatives.

**Scope and thesis:** The fitted equations' displayed R² describes in-sample factor fit; it does not establish future yield accuracy or calibrated ranges. The empirical hypothesis is that MCS may provide useful pointwise yield distributions relative to simple baselines. That hypothesis remains untested. A successful post can report a failure to improve, provided the evaluation is honest and reproducible.

**Outline (about 1,100–1,500 words):**

1. Begin with a test anyone can understand: freeze what was known on a past date, generate the chart, then compare it with the later outcome.
2. Introduce two different questions: was the middle close, and did the range give a useful account of uncertainty?
3. Explain the simplest alternative: tomorrow's central estimate starts at today's fitted yield, with an empirical range based only on past changes. Describe an additional historical-factor-shock baseline if space allows.
4. Walk through time-ordered evaluation, separating model selection from final testing; explain why revised inputs and hindsight labels can flatter results.
5. Show performance by horizon, maturity and time period. Explain why long-horizon comparisons reuse overlapping market episodes.
6. End with a transparent verdict: useful under specified conditions, inconclusive, or weaker than a baseline. The outcome is not predetermined.

**Proposed analysis matrix:**

| Model lane | What stays identical | Evaluation |
| --- | --- | --- |
| No-change yield center plus a trailing empirical-change range | Origins, as-of data availability, horizons and target definition | Mean absolute error (MAE) of the median yield forecast; coverage and width of 50%/90% pointwise intervals; interval score |
| Historical factor-shock random walk, clearly defined | Starting factors, maturity mapping and available history | Same metrics; comparison isolates fitted dynamics |
| Unconditional MCS, anchor off | Same eligible origin/date grid | Same metrics, reported by maturity/horizon and subperiod |
| MCS with regime restriction or anchor | Only add after point-in-time regime and anchor inputs exist | Incremental result against unconditional MCS; report missing-input origins and no silent substitutions |

For the proposed empirical-range baseline, form historical changes at the matching horizon using only training data, subtract their training-sample median, then add them to the origin yield. This keeps the baseline median at the no-change value. Its empirical intervals are a research comparator, not an existing MCS feature; dependence between historical changes must be handled in evaluation.

**Figure specifications:** (1) A freeze–simulate–observe timeline without equations. (2) Coverage versus average range width by horizon, including uncertainty and sample counts. (3) Baseline-versus-MCS loss difference across chronological subperiods; include inconclusive intervals rather than a winner badge.

**Data and evidence:** E1, E5, E7, E8. Need historical factor vintages, yield targets and their basis, observation availability times, regime vintages, historical meeting-path vintages if tested, and a reproducible origin schedule. A proposed target is the later reconstructed yield on the same factor/decay basis; a separate observed Treasury quote target would also include curve-fit error and must be named separately. Verify this choice before analysis.

**Validation design and gates:** Use only inputs available by each origin. Fit windows, any hyperparameter selection and diagnostic thresholds belong inside the training period; reserve a later chronological period for final evaluation. With 252-observation outcomes, purge/embargo overlapping outcome periods across selection/test boundaries, and use dependence-aware uncertainty or non-overlapping origins. Count all tried configurations. Exact dates, minimum eligible origins and a material improvement threshold must be preregistered after auditing coverage and before inspecting test outcomes. This scope deliberately does not invent success thresholds or sample sizes without the data audit.

**Falsifiers and acceptance criteria:** A superiority claim fails if improvement is not material against the declared baseline, if coverage is poor despite wide bands, if results collapse across periods, or if uncertainty is too large. Hold a genuinely point-in-time claim if only revised history exists; permit a carefully labeled retrospective exercise instead. Publication requires a reproducible data/config manifest, code and metric outputs, all tried configurations, missing-origin accounting and an independent check of the calculations.

**Dependencies and boundary:** Validation-plan explainer can draft now; measured-results article remains on hold. No trading alpha, portfolio return or hedging conclusion follows from yield-distribution scores. Such work would additionally need instruments, valuation, costs, financing and risk constraints.

## Shared publication gates

| Gate | Required evidence | Permitted result at this stage |
| --- | --- | --- |
| G1: Source fidelity | Every implementation claim maps to frozen code; comments and behavior are distinguished | Code-grounded explainers can proceed |
| G2: Figure fidelity | Illustrative figures are labeled; live figures have date, configuration, data hash and recomputation | Figure plans are scoped; no figures or live data have been produced by this worker |
| G3: Data lineage | Validity flags, units, duplicate dates, gaps, revisions, label timing and anchor vintages are audited | Empirical posts remain on hold |
| G4: Claim strength | Each conclusion is classified as implementation fact, mathematical consequence, measured result or proposed hypothesis | No unmeasured result is promoted into a finding |
| G5: Reader fit | One main question, plain-language definitions, economic intuition first, optional math | Drafts should be checked with general market readers |
| G6: External context | Original methodological and data-provider sources are inspected and cited adjacent to supported claims | Coordinating worker supplies the primary-source literature layer |

## Proposed handoff artifacts for the empirical lane

Request an analysis snapshot covering the earliest qualifying date through the latest available observation no later than 2026-10-31. A practical study may use a later, preregistered subperiod after data quality and historical availability are established. Do not assume the configured 5/10/15/20-year windows are fully populated.

For every analysis, retain: origin date and available-at timestamp; exact query/export; table and vintage identifiers; data hash; factor/regime/anchor units; valid-row, missing-label and gap counts; model and baseline definitions; all fit and shock-window dates; seed(s), path counts and configuration; all attempted variants; calculation code; tidy metric/figure inputs; findings and counterevidence. Refreshing any source invalidates its dependent figures and claims until recomputed.

Spread probabilities, curve-steepening odds, joint tail events and portfolio losses are attractive follow-up topics. They require paired path-level maturity outcomes or a suitably extended simulator. Subtracting marginal P95 values does not produce a spread P95, and the current returned summaries do not support such joint calculations. Keep these out of the initial six-post series unless the separate extension is implemented and validated.

## Stop Conditions

- Stop any live-market example when units, input dates, allowed publication status or source lineage are unresolved. Continue with explicitly illustrative examples where useful.
- Stop predictive-performance claims when historical availability cannot be reconstructed, configurations were selected on the final test set, or outcomes leak across boundaries.
- Stop a regime comparison when the pool is rejected by the existing guard; treat thin or episode-concentrated pools as limitations even if the request runs.
- Stop probability language derived from the anchor unless the underlying probability model and inputs have actually been inspected. MCS itself consumes rates and dates for this transformation.
- Stop a joint-event or portfolio claim based only on marginal percentile summaries.
- Stop representing these prompt-based workers as verified pinned QuantSmith runtime execution: the configured checkout has known pin drift and the proposed Research Reporter family is not implemented.

## Open Questions

1. Where will the series be published, and what house style and figure dimensions should drafts use?
2. Can a frozen, publishable Gold dataset and upstream factor/regime/anchor definitions be supplied for the empirical lane?
3. Are point-in-time factor and regime vintages retained, and are historical anchor vintages recoverable?
4. Should evaluation target the model's reconstructed yields, independent observed Treasury yields, or both as explicitly different tasks?
5. What study cutoff, baseline specification and publication materiality should be registered after the data audit?

## Next Actions

1. Draft Posts 1 and 2 for general market readers, using checked illustrative figures and the coordinating worker's primary-source bibliography.
2. Draft Post 4's additive-shift explanation; inspect upstream inputs and confirm units/vintages before choosing a live example.
3. Obtain and audit the research snapshot; freeze dates/configurations and finalize the proposed experiment thresholds before viewing comparison results.
4. Run the regime and history-window analyses for Posts 3 and 5; publish null or fragile results transparently.
5. Execute the preregistered evaluation for Post 6 and independently check derived numbers before making any usefulness or superiority claim.
