# Publish-today draft review

Reviewed October 31, 2026 by a separate AI worker reading `05_publish_today_direction.md` and `06_blog_draft.md` against the frozen implementation and claim ledger. This is technical/editorial review, not human review, empirical validation, or statistically independent market evidence. No browsing, database query, new simulation or backtest was performed.

**Disposition:** No substantive factual overclaim or tone issue found in the article. It is suitable for the requested broad-reader mechanism explainer. One low-severity handoff-reference correction is needed in the direction document.

## Findings

### Low — Review reference points to the wrong filename

**Location:** `05_publish_today_direction.md:37`.

The direction document says the separate reading is recorded in `08_draft_review.md`. The assigned and actual artifact is `07_draft_review.md`.

**Precise fix:** Replace `08_draft_review.md` with `[07_draft_review.md](07_draft_review.md)`. This affects packet navigation, not the article's claims.

## Material claims checked

| Draft claim | Evidence and assessment |
| --- | --- |
| MCS defaults to 2,000 paths | Frozen route `evidence/src/app/api/simulations/mcs/route.ts:9–12` and claim C10 support it. The article identifies this as a default, not a historical sample count. |
| Three curve factors evolve together; one surprise's three components are sampled together | Engine `121–175,296–312`; C01–C02. Correct description without implying orthogonality, causes, or exact realized covariance preservation. |
| More paths reuse the same pool and do not create independent economic episodes | Engine `279–305`; C07. Correct. The article explicitly separates computational noise from historical evidence and model uncertainty. It does not treat daily observations as independent crisis examples. |
| Simulations can produce unfamiliar outcomes from familiar shocks | Engine `298–312`; C03. Correct and useful qualification: repeated draws and fitted dynamics generate new sequences and factor states; the draft does not falsely restrict yields to historical realized values. |
| More paths generally reduce computational noise | Appropriate qualified methodological inference. No numerical convergence claim is asserted. |
| P5–P95 is a central model range at each checkpoint, distinct from measured future coverage | Engine `317–332`, frozen page `81–139`; C04. Correct for a broad-reader account. The draft does not promise real-world 90% coverage or imply a simultaneous whole-path band. |
| Connected checkpoint medians need not be any single path | Same engine/page evidence. Correct; avoids the misleading “most likely journey” interpretation. |
| Parameters may be held fixed and shock clustering may be lost | Engine `273–312`. Correct. The draft appropriately frames these as model-construction questions rather than measured MCS performance failures. |

The draft does not describe today's reconstructed starting curve as a verified market quote, assign historical sample counts or regime episodes, claim forecasting superiority, or infer joint-event probabilities from marginal summaries. Omitting the detailed FOMC adjustment is acceptable for this narrowly scoped article: it makes no claim about anchoring, policy probabilities or improved accuracy.

## Audience and tone

The opening, card-deck analogy, three questions and final checklist make the central distinction accessible without equations. The jokes target false confidence and presentation conventions, then the article gives simulations a concrete legitimate use. No unsupported autobiographical story or empirical discovery is attributed to the author. Keep the paragraph acknowledging new combinations of historical shocks: it prevents the headline from suggesting that simulated outcomes are merely copies of the past.

No additional data collection or performance testing is required to publish this mechanism explanation at its present claim strength. The linked literature was not independently retrieved in this review; its use remains background under the packet's existing source-verification limits. Only this review file was written by this reviewer.

## Coordinator resolution

The review-reference typo had already been corrected during parallel review: `05_publish_today_direction.md` points to `07_draft_review.md`. The coordinator confirmed the final reference and local links. No substantive manuscript revision was requested.
