# Public collateral source research

Collected and checked on 2026-11-05 for [KGR-T07](../TASKS.md).
All records have `RESEARCH_ONLY` status. Six providers are covered; complete
production ingestion, redistribution rights and live applicability are not established.

## Source register

| Provider | Official source | Collection and normalization coverage |
|---|---|---|
| CME Clearing | [Acceptable collateral](https://www.cmegroup.com/solutions/clearing/financial-and-collateral-management/acceptable-collateral.html), [Base PDF](https://www.cmegroup.com/clearing/financial-and-collateral-management/files/acceptable-collateral-futures-options-select-forwards.pdf), [IRS PDF](https://www.cmegroup.com/clearing/financial-and-collateral-management/files/acceptable-collateral-irs.pdf) | Official PDFs inspected online. Seven Treasury rule examples; original binary transfers failed. No original hashes or inferred effective dates. |
| LCH Ltd | [Acceptable securities](https://www.lseg.com/en/post-trade/clearing/collateral-management/ltd-collateral-management/ltd-acceptable-collateral/ltd-acceptable-securities), [haircut PDF](https://www.lseg.com/content/dam/post-trade/en_us/documents/lch/collateral-management/lch-ltd/lch-ltd-acceptable-collateral-haircuts.pdf) | Landing page and five-page PDF captured. Twelve Australian-government rule examples, including conventional/inflation-linked distinctions and `NA`. Document dated 2026-06-25; effective date unconfirmed. |
| ICE Clear Europe | [Treasury and banking](https://www.ice.com/clear-europe/treasury-and-banking), [permitted-cover PDF](https://www.ice.com/publicdocs/clear_europe/list-of-permitted-covers.pdf), [FX history CSV](https://www.ice.com/publicdocs/iosco_reporting/haircut_history/iceu/ICEU_Currency_Haircuts_History.csv) | Page, eight-page July 2026 PDF and FX history captured. All 342 FX history rows normalized; six Austria maturity-band examples. |
| Eurex Clearing | [Risk parameters](https://www.eurex.com/ec-en/services/risk-parameters), General Parameters downloads | Page, acceptance/haircut PDF and Global Admissible Securities ZIP captured. All 11,436 security records normalized. Page listed the security download on 2026-11-05; records state 2026-11-04. |
| Bank of England | [Eligible collateral](https://www.bankofengland.co.uk/markets/eligible-collateral), [haircut PDF](https://www.bankofengland.co.uk/-/media/boe/files/markets/eligible-collateral/summary-tables-of-haircuts-for-bank-lending-operations.pdf) | Page, two-page haircut PDF and Level A/B/C CSVs captured. All 4,710 listing records normalized, plus eight UK conventional-coupon examples. PDF dated 2026-10-30; A list as of 2026-11-05, B/C lists as of 2026-11-02. |
| Federal Reserve Discount Window | [Collateral valuation](https://www.frbdiscountwindow.org/en/Pages/General-Information/~/link.aspx?_id=BA73CD056C8549BBB63ABB13C091D928&_z=z), [historical schedules](https://www.frbdiscountwindow.org/generalpages/historical_margins/margin_tables) | Current page, archive index and two prior securities tables captured. All 555 securities cells across three versions normalized, including six unavailable cells. Current securities schedule effective 2026-07-01. Loan tables are captured in HTML but not normalized. |

## Files and counts

- [catalog.json](catalog.json) describes all six provider assessments.
- [capture-manifest.json](capture-manifest.json) identifies 17 captured originals,
  four CME web-only references and five normalized research artifacts.
- [sample-rules.json](sample-rules.json) contains 21 review examples spanning all
  six providers. These are selected examples, not the full normalized collection.
- [RIGHTS_REVIEW.md](RIGHTS_REVIEW.md) records an initial review of the six
  providers' published terms, including concrete reuse/automation restrictions.
- [adjustments.json](adjustments.json) preserves the version-specific Fed
  zero-coupon note. Fed grid records link to these notes as base schedule values.
- Local cache: `.data/spec031/collateral-sources/2026-11-05/`.
- Local archive: `.data/spec031/collateral-sources/2026-11-05/all-six-collateral-research.zip`.

| Local normalized file | Records | Extraction scope |
|---|---:|---|
| `normalized/eurex.jsonl` | 11,436 | Complete captured ZIP member; original fixed-width fields retained |
| `normalized/boe-securities.jsonl` | 4,710 | Complete captured Level A/B/C listing files: 1,992 / 2,640 / 78 |
| `normalized/fed-securities.jsonl` | 555 | 37 security rows × five duration buckets × three versions |
| `normalized/ice-fx.jsonl` | 342 | Complete captured currency-pair history, including inactive rows |
| `normalized/pdf-rule-examples.jsonl` | 33 | Selected CME/LCH/ICE/BoE rules, not complete PDF extraction |
| **Total** | **17,076** | Research records of different kinds and versions; not unique eligible assets |

The archive includes originals, derived records, PDF inspection images, metadata,
local preparation tools, validation checks and these review documents. It is a
local handoff artifact; no external publication or raw-document Git commit occurs.
Hashes describe the captured bytes. Re-fetching a mutable provider URL may return
a different document; never overwrite a reviewed version without recording a new hash.

The offline `prepare.py` consumes the captured manifest and defaults to the
extracted archive's `review/` directory. It accepts `--review-dir` for an explicit
destination; repository use passes `--review-dir docs/specs/spec031`. It requires
Python 3 and BeautifulSoup, but neither `downloads.json` nor network access.

## Provider-specific findings

### CME

Base and IRS are different scopes; their account and guaranty-fund columns must
stay distinct. The example Treasury note haircuts are 1%, 2%, 3%, 4.5% and 8%
across the first five maturity bands. The `>30` cell is unavailable in this row.
The IRS Treasury-bill example is 0.5% in the first band. These are research
examples; account restrictions, caps and additional FX haircuts still apply.

The [2026-07-09 review notice](https://www.cmegroup.com/content/dam/cmegroup/notices/clearing/2026/07/chadv26-233.pdf)
provides a dated reference. Its date is not assigned to the separately mutable
Base/IRS PDFs. Network capture attempts failed with HTTP/2/connection errors and
an HTTP/1.1 timeout; the online research reader could inspect all three PDFs.
Re-acquire exact originals and hashes before treating CME as a frozen source.

### LCH Ltd

Preserve tenor labels such as `11 business days <=1yr`; converting that to a
plain 0–1 year band would lose an eligibility boundary. Conventional and
inflation-linked haircuts have separate columns. `NA` is not zero. The PDF also
contains FX haircuts and bilateral/triparty qualifications. Concentration and
legal delivery conditions on the landing page remain part of source context.
The twelve samples cover only the Australia row, not the entire PDF.
Page 4 further limits Australia's maximum eligible term to 30 years, and
Australian inflation-linked bonds to 25 years. These limits are retained in
selectors and `sourceContext`; the wider printed haircut buckets are not narrowed
or interpreted as overriding eligibility limits.

### ICE Clear Europe

Keep F&O Original Margin distinct from cash variation margin and account-specific
permitted-cover rules. The PDF excludes FRNs and requires domestic-currency bond
issuance; other limits live in Finance Procedures. The FX CSV has currency-pair
direction, ACTIVE/INACTIVE status, START_DATE and END_DATE. Preserve every
historical row; confirm endpoint inclusivity and file freshness before replay.
All 342 FX records also retain the captured landing-page condition: collateral
currency differs from the initial-margin liability currency. `sourceContext`
links that scope to the page paragraph rather than silently broadening it to
every kind of liability.
The Austria examples retain `RATB, RAGB` for the shortest band and `RAGB` alone
for longer bands; issuer identity does not replace the instrument restriction.

### Eurex Clearing

`GlobalAdmissibleSecurities.txt` is fixed-width Windows-1252 text inside a ZIP,
not a CSV. Offsets derive from the published header. Preserve deposits, LSOC,
title-transfer, market-price-validity and collateral-expiration fields. Do not
interpret collateral expiration as an issue's maturity or a schedule's effective
end. `EvalPct` is an evaluation percentage: 97.714 means a haircut fraction of
0.02286, not 0.97714. Acceptance/haircut documentation confirms the conversion.
Every captured row states 2026-11-04; the website's later download date is separate.

### Bank of England

The CSVs have preambles before their headers; Level A has settlement-system
columns while B/C are ISIN lists. Blank settlement flags stay blank. A listed
security's level does not by itself determine its facility eligibility or haircut.
The haircut PDF distinguishes floating/fixed, coupon/zero-coupon and indexed
debt, with separate FX/additional conditions. No general ISIN-to-haircut join is
claimed by this collection. The three CSVs do not share one source-as-of date.

### Federal Reserve

Securities margins are percentages of recognized market value. A margin of 99
converts to a 1% haircut. Buckets measure duration, not residual maturity.
The normalized cells are base schedule values. The separate non-STRIPS
zero-coupon note changes between versions: historical schedules state reductions
of 1% for duration 0–10 and 3% above 10, while the current note states 1% without
that split. Records link to the version-specific note in `adjustments.json`;
reduction arithmetic remains unresolved and unapplied.
Two commercial-paper cells per version are blank and remain null.
The prior securities tables explicitly cover 2024-09-03 through 2025-06-30 and
2025-07-01 through 2026-06-30. In the shortest duration bucket, Treasury STRIPS
move from a 97% lending value in the first version to 96% in the next: a 3% to
4% haircut change. This is a bounded real example for later temporal validation.
Loan-table ranges and in-scope/out-of-scope institution distinctions need a
separate contract; no single loan haircut is derived here.

## Admission and service proposal

See [SOURCE_ADMISSION.md](../SOURCE_ADMISSION.md) for the proposed contract,
provider admission criteria and portable-service assessment. All six are research
candidates. Rights are unapproved for product reuse; no live source is activated.
The initial terms review found restrictions on AI use, automated access and/or
commercial reuse. Further automated collection and product activation require
source-specific clearance. The terms review is not a legal opinion or a claim
that a specific reuse license has been granted.

## Verification

Counts were reconciled with raw records, SHA-256 hashes checked, IDs checked for
duplicates, and conversions checked against independent expected examples.
LCH/ICE/BoE table pages were rendered and inspected to verify column/tenor mapping.
The checks distinguish publication/as-of/effective/retrieval dates, preserve
unavailable cells and leave all records in research status. Validation evidence
and repository checks are recorded in [VALIDATION.md](../VALIDATION.md).
The [Codex CLI review](../reviews/CODEX_CLI_SOURCE_REVIEW.md) records three
additional findings, their corrections and remaining offline-validation limits.
