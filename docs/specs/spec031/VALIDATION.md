# KGR validation record

Status: expanded synthetic prototype implemented; source admission remains gated.

## Planned evidence

- deterministic fixture and scenario unit tests (passing; 18 KGR contract tests, including two-book, restricted-collateral, impact-drillthrough, negative-context and temporal effective-date/drillthrough checks);
- route/nav consistency test (passing);
- typecheck and client build (passing);
- browser verification at 320px, 768px, 1024px and 1440px (passing; no horizontal overflow or page/console errors, compound-stress graph exposes Beta Macro, Fictional CCP 2 and Custodian B, Inventory Explorer exposes the expanded OAT 5Y lot and topology, node selection opens/clears the Impact Path Explorer, and Temporal Graph Mode transitions pre-effective, first-step and current states);
- explicit check that every visible relationship carries units, as-of date and
  synthetic evidence metadata (covered by contract tests and the evidence view).

## Known limits

No live collateral schedule, internal book, graph database, trained model,
external service or execution action is admitted by this slice.

## Repository-level blockers outside KGR

The full `npm test -- --reporter=dot` run is not green on this branch for three
unrelated DataOps health tests. They time out while attempting local service
listeners and emit `listen EPERM` under the sandbox. The full run otherwise
reports 1,674 passing tests; the focused KGR/nav tests, typecheck, client build
and browser smoke checks pass.

## Six-provider source research — 2026-11-05

Research artifacts are linked from [SOURCE_ADMISSION.md](SOURCE_ADMISSION.md).
This adds documentation and static research evidence; the KGR application and
synthetic calculations are unchanged. No source is activated or licensed by this work.

- Six providers assessed; 17 originals captured with byte lengths, retrieval
  timestamps and SHA-256 hashes. Four CME references are web-reviewed only;
  original-file hashes and local paths remain null after failed downloads.
- Five normalized local artifacts contain 17,076 research records: 11,436 Eurex
  securities; 4,710 BoE listings; 555 Fed securities-grid cells; 342 ICE FX history
  rows; and 33 selected CME/LCH/ICE/BoE rule examples. Complete structured-file
  extraction is distinguished from partial PDF examples and unnormalized Fed loans.
- All original/derived hashes and sizes matched their manifests. Cross-file IDs
  were unique, source-document references resolved, dates parsed, and haircut
  fractions were bounded. All 16,146 Eurex/BoE ISINs passed ISO 6166 check digits.
- Independent expected examples passed: Eurex EvalPct 97.714 -> haircut fraction
  0.02286; ICE FX 7.75 -> 0.0775; Fed shortest-duration STRIPS 97/96 -> 0.03/0.04
  across the declared historical versions. Six blank Fed cells remain null;
  BoE eligibility listings do not acquire inferred haircuts.
- LCH/ICE/BoE PDF table pages were rendered and visually inspected. ICE Austria
  examples retain RATB/RAGB ticker scope. LCH `NA`, CME `--`, business-day limits,
  BoE interest-rate/coupon distinctions and differing source-as-of dates remain explicit.
- Independent review identified missing ICE ticker qualifications and a changing
  Fed zero-coupon note. Corrections preserve ticker selectors and version-specific
  adjustment references. Fed cells are labeled base schedule values; the note's
  adjustment arithmetic remains unresolved and unapplied.
- Published terms for all six were reviewed initially and linked in
  [RIGHTS_REVIEW.md](sources/RIGHTS_REVIEW.md). Reuse/automation restrictions remain
  source-admission gates; public downloadability is not recorded as a license.
- Focused KGR/nav tests passed: 22 tests. Typecheck passed. Agent-skills pin passed
  (188 paths / 24 skills). `git diff --check` passed. No UI or client build change
  was introduced, so browser smoke checks and the client build were not rerun.

Offline research checks are included in the local handoff archive. No new package,
production importer, service process, refresh job or database is added.

### Codex CLI review and corrections

The owner-approved read-only Codex CLI review completed on 2026-11-05 with
`gpt-6.1-sol`. The [report](reviews/CODEX_CLI_SOURCE_REVIEW.md) records three
actionable findings and their reconciliation. All twelve LCH Australia examples
now preserve explicit maximum eligible terms and page-4 lineage; all 342 ICE FX
rows preserve initial-margin currency-mismatch scope and landing-page lineage.
Offline checks verify each affected record without changing the base values.

Preparation now consumes the archived manifest and supports the archive's review
directory or an explicit `--review-dir`. A fresh extraction is regenerated from
an unrelated working directory; the normalized files, manifests and selected
examples must reproduce byte-for-byte, then pass the portable validation script.
CME and provider terms remain subject to the offline evidence limits in the report.
No additional CLI review after these corrections is asserted.
