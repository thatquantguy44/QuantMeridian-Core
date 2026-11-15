# Independent technical and editorial review

Reviewed October 31, 2026. Scope: `README.md`, `01_blog_series_scope.md`, `02_model_and_validation_research.md`, `03_sources_and_claims.md` and the available `run_manifest.json`, checked against frozen local evidence. This is the separately assigned review of this packet, not an execution of a proposed QuantSmith Research Reporter role.

**Disposition:** No high-severity finding or technical blocker to drafting the scoped mechanism explainers with labeled synthetic figures. Correct the metric terminology before drafting Post 6's evaluation explanation; finalize provenance before handing off the packet. Empirical results remain gated as the packet already states.

## Findings by severity

### Medium — Absolute-error metric names conflict

**Locations:** `02_model_and_validation_research.md:105,143`; `01_blog_series_scope.md:252`.

The baseline table says “median absolute error/MAE,” while the scoring section uses “MAE for the median” and Post 6 requests “Median absolute error.” Mean absolute error and median absolute error are different aggregations across forecast origins. Evaluating a median forecast does not make its MAE a median absolute error. This ambiguity can send the empirical lane toward different scores and leave the reader explanation inconsistent.

**Exact fix:** In the modeling baseline row, replace “median absolute error/MAE” with “mean absolute error (MAE) of the median yield forecast.” Make the same replacement in Post 6's matrix. Keep the scoring section's MAE-for-median/RMSE-for-mean distinction. If median absolute error is also desired, list it separately with its full name and aggregation definition.

**Checked evidence:** The conflicting wording appears in the cited research sections. The engine returns both `p50` and `mean` (`evidence/src/lib/server/mcsEngine.ts:317–332`); neither it nor the existing tests calculates forecast errors. This is a proposed-metric specification issue, not a detected numerical result error.

### Low — Handoff manifest is still an in-progress record

**Locations:** `run_manifest.json:118–135`; `README.md:12`.

Both research assignments still have `status: "running"` despite their completed report files being available for review. The README also says the manifest supplies verification results, but it presently has no structured verification-results entry; those results are instead in README prose and evidence logs. A reader cannot reliably determine completion from the advertised handoff record.

**Exact fix:** At final handoff, set each assignment to its actual completion state; add this review assignment and output; add check command, exit status and evidence-log path for the engineering pin check, QuantSmith record check, strict fingerprint check and four-test MCS run. Preserve the failed strict fingerprint result and the distinction between package-record consistency and content integrity. Add the review disposition or remaining findings without implying SDK execution or empirical validation.

**Checked evidence:** Both report files exist. The retained logs show engineering pin success, QuantSmith record-check success with drift disclosed, strict code/assets mismatch with exit 1, and four passing MCS tests. All 17 snapshot hashes recorded in the available manifest matched their frozen files in this review. Manifest lifecycle status may be updated by the coordinator after this review; this finding describes the version inspected.

### Low — Define MCS before asking general readers to interpret it

**Locations:** `README.md:1–3`; `01_blog_series_scope.md:1–7`; `03_sources_and_claims.md`, Editorial vocabulary.

The packet uses MCS throughout without explicitly expanding its product name in the reader-facing introduction. A general market reader should not need the source-code header or live page to identify the subject.

**Exact fix:** Add at the first introduction: “MCS, short for Monte Carlo Curve Simulation, builds many possible future yield curves by repeatedly drawing historical surprises.” Add an equivalent first-use requirement to Post 1's outline. Keep the distinction between simulation and demonstrated forecasting accuracy already present elsewhere.

**Checked evidence:** The frozen page names the product “Monte Carlo Curve Simulation” (`evidence/src/app/simulations/mcs/page.tsx:166`); the engine header expands MCS and its simulation loop demonstrates repeated residual draws (`evidence/src/lib/server/mcsEngine.ts:2,296–312`).

## Checked implementation and editorial boundaries

The material implementation descriptions agree with the frozen engine, route and page: three lagged-factor equations; whole-vector residual sampling; destination-date regime tags; shared fitted coefficients across regime pools; rejection below 20 and sparsity below 100; fixed average lambda; reconstructed starting curve; interpolated marginal quantiles; default settings; and additive, maturity-tapered shifts to stored summaries. The unchanged within-horizon quantile gaps follow from the displayed addition formula; this review did not run a new numerical example.

The Gold helper, macro-input consumer and store interface support the packet's cautions about spot units, meeting vintages and the meaning of `latest`. They do not establish actual database units, upstream factor lineage or historical availability. The existing test file supports the stated narrow test coverage; its four cases include the two parameterized minimum-row cases. No performance conclusion follows.

The series prioritization is suitable for general market readers: questions and economic intuition lead, with formulas and validation machinery in author notes or optional sidebars. The packet correctly separates explainers from empirical comparisons, median connections from individual paths, marginal ranges from joint outcomes, and rate-path adjustments from FedWatch probabilities. The proposed synthetic figures are sufficient to begin drafting; performance testing is not a prerequisite for those explainers.

## Explicit review limits

This is a separate AI worker's technical/editorial reading of a shared evidence packet. It is **not human review, empirical model validation, or statistically independent evidence** for any market claim. No Gold data, upstream ETL, live chart, runtime SDK, historical backtest, reader comprehension check or new simulation was inspected or executed. I did not browse or independently retrieve the public documents. S1–S5 links, bibliographic descriptions and retrieval statements were checked for appropriate scope within the packet, not independently authenticated against their remote contents; S5 remains explicitly partial. Rechecking relevant primary-source passages before publication remains an existing publication gate, not a blocker to this scoping task.

Only this review file was written. No product code, source snapshots, pinned skills or other packet documents were edited by this reviewer.

## Coordinator resolution — final handoff

All three findings were addressed after the independent review:

- **Metric terminology:** The modeling baseline and Post 6 now specify mean absolute error (MAE) of the median yield forecast. The proposed empirical-range comparator is also defined as median-centered historical changes at a matching horizon, so its central forecast remains the no-change value. This is a future research definition, not an implemented feature.
- **Manifest completion:** Both research runs and this distinct review run are recorded as complete; structured check results retain strict QuantSmith fingerprint failure and the narrow meaning of the four passing MCS tests.
- **Reader introduction:** README, the scope's first introduction and Post 1's outline expand Monte Carlo Curve Simulation; the glossary now includes MCS.

The coordinator also corrected the source-ledger default-settings page reference to lines 143–148 and recorded the missing-current-regime fallback as a data-check item. These are documentation corrections; no product behavior was changed. The coordinator checked final links, frozen-input hashes and the corrected terminology. The reviewer did not conduct a second full review of these final edits.
