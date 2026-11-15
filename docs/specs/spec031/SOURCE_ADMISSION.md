# KGR source-admission proposal — six public providers

Status: research collection prepared on 2026-11-05. Product admission remains
gated. This proposal does not change the synthetic KGR runtime or resolve D05/D06.

The owner requested collection of all six providers identified during T07
research: CME Clearing, LCH Ltd, ICE Clear Europe, Eurex Clearing, Bank of England
and the Federal Reserve Discount Window.

## Reviewable package

- [Source register and findings](sources/README.md).
- [Provider catalog](sources/catalog.json): scope, dates, access and outstanding gates.
- [Capture manifest](sources/capture-manifest.json): exact URLs, retrieval times,
  byte lengths and SHA-256 hashes for captured originals and normalized artifacts.
- [Normalized examples](sources/sample-rules.json): factual research examples for
  all six providers, including unavailable values and dated historical versions.
- [Initial terms review](sources/RIGHTS_REVIEW.md): published restrictions requiring
  source-specific clearance before further automation or product reuse.

Full originals and normalized research records are stored locally under
`.data/spec031/collateral-sources/2026-11-05/`, which is already ignored by Git.
Provider documents and complete security lists are not added to repository history.
CME originals could not be downloaded; its examples were checked through online
PDF extraction and have no original-file hash. This gap is explicit in the manifest.

## Proposed source boundary

Keep the original document and normalized record together. The research envelope
is `kgr-source-research/1`, separate from `relationship-intelligence-demo/1`:

| Field | Meaning |
|---|---|
| `id`, `sourceId`, `documentId` | Stable research identity and original-document linkage |
| `recordStatus` | `RESEARCH_ONLY`; no source is declared admitted |
| `subject`, `ruleType`, `selectors` | Security/class, haircut or listing, and applicable scope |
| `sourceValue`, `sourceUnit` | Original value and its meaning before conversion |
| `haircutFraction` | Haircut in [0, 1], or null for unavailable values/listings |
| `sourceAsOf` | A date stated by the source, never the retrieval date substituted |
| `validFrom`, `validTo`, `validToInclusive` | Explicit published validity; unknowns remain null |
| `sourceLocator`, `qualification` | Page/table/line and limitations needed to interpret the row |
| `sourceFields` | Preserved structured fields where a machine-readable original exists |
| `adjustmentRefs` | References to version-specific conditional notes; base values are not final adjusted haircuts |
| `sourceContext` | Conditions from another page/section with their document, locator, original value and units |

Document publication date, website download date, file row date, contractual
effective date and retrieval time are distinct. Unknown effective dates exclude
a rule from automatic effective-date replay. Null `validTo` means the source has
not supplied an end date; it does not authorize indefinite future validity.
Null end-date inclusivity is unresolved and must not be silently assigned a rule.

Decimal conversions retain their source units: ordinary haircut percentages are
divided by 100; lending/evaluation percentages use `(100 - sourceValue) / 100`.
Blank cells, `NA` and `--` stay unavailable. Listings do not acquire a haircut or
an unconditional eligibility decision. Free-text conditions are preserved for
research, not represented as machine-enforced legal eligibility.
Fed grid records explicitly identify the base schedule and reference
[adjustments.json](sources/adjustments.json); the zero-coupon adjustment's
arithmetic remains unresolved and is not applied.
LCH's maximum eligible term remains separate from the wider haircut bucket:
Australian inflation-linked bonds have a 25-year limit, while conventional
Australian government securities have a 30-year limit. ICE's FX records retain
the landing-page scope of a currency mismatch against an initial-margin liability.

## Proposed first admitted slice

After rights and semantic review, admit one frozen, hashed document version per
provider with an independently checked scope. Use a separate source-research
surface and immutable evidence snapshot before considering any joins to a book.
Keep a source-backed rule distinct from a fictional exposure or stress scenario.
Matching a security identifier does not establish an agreement, counterparty,
inventory holding, approved pledge or observed exposure relationship.

Acceptance before activating any provider:

1. Confirm permitted storage, processing, refresh and redistribution uses, with
   owner, evidence and any provider terms; public access alone is insufficient.
2. Resolve row scope, temporal boundaries, missing-value semantics and
   provider-specific limits/add-ons; attach exact document/clause lineage.
3. Reconcile a complete declared extraction scope against its original, test
   changed/unchanged/unavailable rules, and record a freshness policy with an owner.

The current PDF examples are deliberately partial research extracts, so they
cannot pass the complete-extraction gate by themselves. Refresh jobs and runtime
adapters are separate implementation work after these conditions are satisfied.

## Portable-service proposal

The research does not establish a need for a new service. Retain the browser's
existing deterministic fixture boundary during review. If an admitted adapter is
later approved, its output should be a versioned, read-only evidence snapshot
carrying document hashes, scope and temporal metadata; KGR can consume that
contract without deciding how it is hosted. Python/FastAPI, a graph database,
ML, live book adapters and execution remain separate decisions. No new package,
service process, module setting or production refresh is introduced here.
