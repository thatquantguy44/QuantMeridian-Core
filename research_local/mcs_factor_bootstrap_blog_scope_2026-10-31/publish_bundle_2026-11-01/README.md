# 10,000 Scenarios. Same Old History.

Publication bundle prepared November 1, 2026. The main experiment uses **10,000 paths** and a real saved MCS factor snapshot dated **October 29, 2026**. A matched 2,000-path comparison and 20 seeds per setting test numerical sampling variability.

## Open the post

- [Final illustrated Markdown article](article.md): two genuine platform screenshots, captions, numerical experiment, optional LaTeX sidebar and source links.
- [Rendered HTML preview](article.html): equations are already rendered; both images link to their full-size files. Keep the `assets/` directory beside this file when copying it.
- [Short LaTeX sidebar](latex_sidebar.md) and [copyable equation source](sidebar.tex).

The native platform figures show the **10-year** and **2-year** maturities from the same unanchored, unconditional 10,000-path run. The two vertical axes scale separately; captions supply comparable numbers. The screenshots' data date differs from their capture date.

## Evidence and independent review

[Experiment notes](experiment_notes.md) document settings, seeds, source files, the research capture proxy, a resolved capture-record overwrite, and interpretation limits. Saved inputs and all simulation summaries are retained under `evidence/`; reproduction scripts are under `scripts/`.

- [Mathematical and numerical review](reviews/math_review.md): independently implemented the simulator in Python, reproduced 40 runs and 4,800 summary statistics within floating-point tolerance, and checked formulas and units.
- [Factual, source and visual review](reviews/fact_visual_review.md): inspected the actual images, verified captions/settings, recomputed the reported seed variability, and reopened both cited primary sources.

These are separate AI reviewer executions against recorded inputs. They establish the checks described in their reports, not human approval or empirical forecasting validation. The core manuscript and figures are identified by hashes in the final manifest and review records.

## What the experiment supports

For the 252-step, 10-year median, sample standard deviation across the 20 seeds was **2.69 basis points at 2,000 paths** and **0.63 at 10,000**. The fitted historical input and shock pool stayed fixed. This is a result about Monte Carlo noise for this sample; no future yields were scored and no forecast-accuracy or coverage claim follows.

The screenshot figures and formulas are ready to accompany the post. Copy the article and upload both JPGs to your publishing platform, preserving captions and the data date. A platform must support math rendering to use the Markdown formulas directly; the HTML preview already contains rendered math. Nothing has been published externally.
