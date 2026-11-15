# MCS blog research and scopes

Prepared October 31, 2026 for **general market readers**, as confirmed by the user. MCS means **Monte Carlo Curve Simulation**: it builds possible future yield curves by repeatedly drawing historical surprises. The goal is an approachable series about what those outcomes show, how the model works, and how to interpret its limits.

## Start here

**Latest edition — November 1:** [10,000 Scenarios. Same Old History.](publish_bundle_2026-11-01/article.md) adds two genuine platform visuals, an actual 10,000-path experiment with a matched seed comparison, a rendered LaTeX sidebar, and two independent agent reviews. The [publication bundle](publish_bundle_2026-11-01/README.md) contains the figures, experiment records and review reports. It supersedes the prose-only version below.

**Ready to copy into your editor:** [2,000 Scenarios. Same Old History.](08_ready_to_post.md) is the final version after the voice and formatting pass. It combines the most accessible parts of the first two briefs around one idea: more simulation paths do not add historical evidence. The [earlier manuscript](06_blog_draft.md), [editorial direction](05_publish_today_direction.md), and [draft review](07_draft_review.md) preserve the research and editing trail. No external publication has been performed.

| Artifact | What it provides |
| --- | --- |
| [Blog series scopes](01_blog_series_scope.md) | Prioritized post briefs, reader questions, outlines, proposed analyses, figure plans and drafting gates. |
| [Model and validation research](02_model_and_validation_research.md) | Code-grounded model explanation and a proposed research design for future empirical claims. Technical details are author notes, not required reader prerequisites. |
| [Sources and claims](03_sources_and_claims.md) | Primary-source reading list, claim-level evidence, plain-language glossary, figure requirements and open data questions. |
| [Independent packet review](04_review.md) | A separate worker's technical and editorial findings and their resolution. |
| [Run manifest](run_manifest.json) | Provenance, agent assignments, reviewed input hashes and verification results. |
| [Frozen evidence](evidence/) | Source-code snapshots, observed QuantSmith fingerprints and check logs. No database extracts or credentials. |
| [Agent inputs](agent_inputs/) | The inspected Research Analyst and Modeling contracts and shared task brief. |

## Editorial recommendation

Draft **posts 1, 2 and 4 first**. Develop the data work for 3, 5 and 6 alongside them. Publication can follow numerical order when the evidence is ready.

| Post | Working title | Readiness |
| --- | --- | --- |
| 1 | Reading the Range of Possible Treasury Yields | Explainer ready to draft; recommended first post |
| 2 | Three Moving Parts Behind a Treasury Yield Curve | Explainer ready to draft |
| 3 | What Changes When We Replay a Different Economic Regime? | Empirical comparison needs data |
| 4 | Why a Fed Path Can Move the Middle of the Chart | Transformation explainer ready; live example needs verified inputs |
| 5 | How Much History Should Inform a Rate Scenario? | Empirical comparison needs data |
| 6 | How We Would Check a Rate Model Before Trusting Its Ranges | Validation design ready; performance findings need experiments |

Use plain questions, familiar examples and one main graphic per post. Explain a maturity as “how long until a bond is repaid” and distinguish it from “how far into the future the simulation looks.” Keep equations, solver details and scoring formulas in optional sidebars or the research appendix.

The original explainer scopes are ready to guide further drafting; the follow-up manuscript above is available for the author's publication pass. Live chart captures, numerical market conclusions and a model backtest are outside this packet. Proposed experiments and figure plans are labeled throughout; no historical performance has been invented.

## What the research establishes

The inspected MCS code fits a three-factor model, samples whole historical factor surprises, and summarizes simulated yields at several future horizons. Its regime setting changes which surprises are sampled. Its optional FOMC adjustment shifts reported yield summaries, leaving their within-horizon widths unchanged. These are implementation findings, not validated claims about future accuracy.

Public research provides background for the three-factor approach, while official Treasury documentation explains the distinction between curve maturity points and individual bond quotes. See [S1–S3 in the source record](03_sources_and_claims.md#primary-source-reading-list), including direct links and retrieval limitations.

## Agent execution and pin provenance

The user's `.agents/` reference resolves to the immutable engineering-skill mirror, pinned to `thatquantguy44/agent-skills@f63ec56a3cc9`. Its integrity check passed. QuantSmith is a separate local source selected by `contracts/agent/quantsmith-pin.json` at `../../agentic_workflows/qf_workflow_sdk_public`.

That selected QuantSmith copy **does not match the approved code/assets fingerprints**. The package-version/pin-record consistency check passed, but strict local content verification failed. The Research Analyst and Modeling contract directories are also outside the pin's enumerated asset paths. Accordingly, the two research workers used inspected, hash-recorded prompt contracts from that local copy; this is not a verified pinned QuantSmith SDK execution. No pin was changed. The proposed `research-reporter` specialists were not represented as implemented or executed.

No governed QuantSmith market-research catalog was supplied or retrieved. Public primary documents were used as contextual fallback, with that unmet retrieval step recorded. The research preserves these limits rather than implying completed catalog or SDK execution.

## Verification and next work

The existing MCS unit file passed **4 tests**, covering validity-flag handling and fitting-row limits. These tests do not establish prediction accuracy, interval calibration or the correctness of every simulation feature. Logs are retained under `evidence/`.

Before empirical posts, verify the Gold factors' construction and yield convention, historical regime-label availability, and meeting-path/benchmark units and vintages. Then freeze a dataset, agree evaluation criteria, and run the time-ordered experiments in the modeling brief. The live route alone is insufficient for a historical as-of backtest.

All deliverables from this task are saved in this dedicated folder. Although `research_local/` is normally ignored, this specific folder is explicitly selected for version control on `docs/mcs-bootstrap-blog-research` at the user's request. The broader ignore rule and unrelated application work are unchanged.
