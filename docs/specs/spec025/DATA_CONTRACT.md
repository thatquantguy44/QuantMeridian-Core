# AAII PostgreSQL and presentation contract

**Verified locally:** 2026-10-31. **Authority:** source implementation plus an
explicitly authorized one-off read-only inspection. This is not consumer-role or
entitlement admission by itself. A dedicated local reader was subsequently approved,
created and verified; see [ADMISSION.md](ADMISSION.md).

## Verified source relation

`additional_market_data`, `aaii.aaii_gold_latest`, ordinary table (`relkind=r`).
It is separate from `macro_medallion`. Owner/effective writer: `aaii_writer`.
The source identity is lowercase `aaii`; UI provenance label is uppercase `AAII`.
Dataset is `aaii-investor-sentiment`.

| Observed PostgreSQL column | Type | Nullable |
| --- | --- | --- |
| version_id | text | No |
| source | text | No |
| dataset | text | No |
| survey_date | text | No |
| bullish | double precision | No |
| neutral | double precision | No |
| bearish | double precision | No |
| provider_published_at | text | Yes |
| first_seen_at | text | No |
| retrieved_at | text | No |
| content_hash | text | No |
| raw_run_id | text | No |
| raw_sha256 | text | No |
| parser_version | text | No |
| bull_bear_spread_pp | double precision | Yes |
| previous_survey_date | text | Yes |
| gap_days | integer | Yes |
| spread_change_pp | double precision | Yes |
| previous_version_id | text | Yes |

Gold stores latest observed versions per unshifted reported date. Database
nullability is weaker than the usable-data contract: a missing spread makes
that selected result invalid even though its column permits NULL. Do not coerce
strings to numbers or convert reported dates into an inferred ending date.

## Pure normalizer and DTO

Authoritative runtime types/functions:
`src/lib/aaii/contracts.ts`, `normalize.ts`; fictional data in `testFixtures.ts`.
No reader, route or SENT consumer imports them yet.

The selection is bounded to 104 rows and sorted chronologically after validating
unique dates. Positive/zero shares are fractions within [0,1]; percentages are
computed by multiplying once by 100, without display rounding. Spread is already
percentage points and must agree with `(bullish-bearish)*100` within `1e-8` pp.

The total tolerance is **inclusive 0.002 in fraction units**. Upstream CSV/XLS
validation uses decimal arithmetic, followed by DOUBLE PRECISION storage. The
prepared validator allows `0.002 + 8*Number.EPSILON` for the sum of three bounded
fractions; this covers representation error only, without renormalizing shares.
Inspection found one full-history residual of `0.0020000000000000018`; none was
outside the bounded guard. All 104 latest selected rows passed.

Dates are strict ISO calendar labels. Source clocks must be UTC ISO strings with
up to six fractional digits; comparisons preserve microseconds. First-seen and
retrieved timestamps are required and must not exceed the inspection cutoff;
first-seen cannot exceed retrieval. A supplied publication time cannot exceed
retrieval; null stays null. No unknown clock is substituted with a reported date,
browser clock or import time. This is current-vintage evidence, not archived PIT.

Each observation exposes percentages/spread, reported/previous dates, gap/change,
opaque version token and safe first-seen/retrieved/publication metadata. Raw run
IDs, raw/content hashes, parser internals and connection details are excluded.
The DTO's `LIVE`/`STALE` is date freshness of validated supplied input; it does not
establish reader admission, entitlement or healthy pipeline operation by itself.

## Adjacency and revisions

For consecutive selected rows, previous date/version, calendar-day gap and spread
change must reconcile to the preceding selected row. Missing dates remain gaps.
The oldest selected row may legitimately refer outside the 104-row window; its
context remains `UPSTREAM_ONLY`, not falsely verified or filled. No prior context
is `NONE`; later reconciled rows are `WITHIN_SELECTION`.

A corrected row carries a different version token and changes the current-vintage
result. Its original returned object is not mutated. The source supplies latest
versions only; no historical system-known cutoff is accepted by this work.

## Owner-confirmed freshness/failure policy

Age uses UTC calendar dates and the unshifted reported label. Age **10** remains
current; age **11** is stale. Stale observations remain dated and visible.
Failures/unconfigured access are unavailable. The latest owner instruction forbids
all SIM in SENT, superseding the earlier explicit-opt-in proposal. Missing required
real sources mean No data; no silent substitution or reweighting. The full
composite is unavailable until its complete real inputs and methodology exist.

## Inspection outcome

- 2,046 rows and 2,046 unique reported dates, 1987-07-24–2026-10-22.
- Zero identity, range, spread or guarded-total violations in the queried checks.
- All 2,046 publication timestamps null; nine recorded gaps exceed eight days.
- Bounded latest selection: 104 rows passed the normalizer; 103 within-selection
  adjacency links and one upstream-only boundary link; 104 null publications.
- At the 2026-10-31 inspection, latest reported date age was nine UTC calendar days.
  This does not certify acquisition health or infer a newer report from the website.
- Inspection used read-only repeatable-read transactions with local timeouts and
  ROLLBACK. No write, DDL/GRANT, provider download or upstream repair occurred.

## Live-read envelope and UI dates

`AaiiReadResponse` carries a validated selection plus `readStartedAt` and
`readCompletedAt`; failures carry no selection or read clocks and a sanitized
error code. The UI calls completion the latest snapshot **read**, explicitly not
a retained immutable artifact. It displays `latestSurveyDate`, source `retrievedAt`,
`firstSeenAt` and nullable publication separately. The table exposes the latest
104 selected observations, newest first, with page controls and actual gap days.
No schema/source/date/SIM override is accepted from the browser.
