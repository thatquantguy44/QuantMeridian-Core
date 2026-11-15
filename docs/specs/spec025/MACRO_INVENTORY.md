# SENT macro_medallion inventory and integration

**Checked:** 2026-10-31. User requested inspection of `macro_medallion` and
incorporation of the real inputs it already holds. Latest NO-SIM rule remains.

## Observed source evidence

The actual configured PostgreSQL database is `macro_medallion`. Inspection used
read-only repeatable-read transactions, bounded statements, 12s statement/1s lock
timeouts and ROLLBACK. No configuration/credential, role, warehouse record or
pipeline source was changed. [MACRO_INSPECT.sql](MACRO_INSPECT.sql) reproduces the
metadata/coverage checks without printing credentials or raw observation payloads.

The catalog identifies these seven series as daily (`d`) and source `fred`:

| Series | Meaning | Raw catalog units | Latest stored reported date |
| --- | --- | --- | --- |
| VIXCLS | Market volatility, VIX | Index | 2026-10-29 |
| BAMLH0A0HYM2 | High-yield OAS | Percent | 2026-10-29 |
| BAMLC0A0CM | Investment-grade OAS | Percent | 2026-10-29 |
| DGS10 | 10-year Treasury yield | Percent | 2026-10-29 |
| DGS2 | 2-year Treasury yield | Percent | 2026-10-29 |
| DGS3MO | 3-month Treasury yield | Percent | 2026-10-29 |
| T10Y2Y | Published 10Y–2Y spread | Percent | 2026-10-30 |

No NAAIM, put/call, breadth or finished fear/greed index entry was found by the
documented catalog search; no dedicated relation matching those names was found.
This is an inventory of the inspected catalog/relations, not a claim about every
unpromoted/raw field or another database. Existing equity return/index tables do
not by themselves establish a governed market-breadth measure.

`SP500`, `NASDAQCOM` and `DJIA` observations exist, with latest dates October 21,
23 and 23 respectively, but have no matching `gold.dim_series` entries. They are
not admitted by this slice: source/units metadata must be reconciled upstream
before consumption. No catalog row was fabricated or written to work around it.

## Integrated reader/API/UI

`src/lib/server/sentMacro.ts` reads only the seven allowlisted series from
`gold.fred_latest_observation` joined to `gold.dim_series`, using the existing
server-only GoldStore configuration. The shared GoldStore policy is unchanged.
There is one bounded parameterized data statement with consistent catalog/history.
No SIM or fallback file is queried, and no provider request is made.

Each series exposes at most **252 stored dates**, ascending in the DTO and newest
first in the UI. A post-join bound of 253 rows per series detects duplicates/join
expansion without truncating another series' evidence. Overflow/metadata/unit/
date/value errors fail only the affected series; unknown IDs/global envelope
violations fail closed. Driver failures produce sanitized no-data responses.

PostgreSQL bigint missing flags arrive as strings; only exact 0/1 or `"0"`/`"1"`
are accepted. Flagged missing values remain null even if a numeric payload exists.
The latest marked-missing observation yields No data; an older value is never
substituted. Reported dates and missing rows are not filled or interpolated.

The actual seven 252-row windows passed normalization: **1,764 rows**, including
47 declared missing values (VIX 3, HY OAS 2, IG OAS 2, each Treasury series 10).
The saved inspection also verified unique reported dates, valid 0/1 missing flags
and no unmarked null values across the ten inspected series. Full historical
value/date validation and pipeline health are not implied by those key/flag checks.
Window row counts and coverage are distinct from valid readings.

`GET /api/sentiment/macro` accepts no source/date/SIM parameters and returns
no-store responses. SENT replaces its old four-ID raw list with readable input
labels, explicit units, reported dates, age at the read, warehouse ingestion
clocks and a paginated per-series historical table. Refresh failures clear data.
The frontend rejects SIM or unrecognized contracts. Global SIM has no effect.

Treasury yields display in percent, OAS/curve spreads in percentage points and
VIX in index points; underlying values are not rescaled. The published `T10Y2Y`
series is shown directly; different-date yield legs are never subtracted.
Age is a UTC calendar-day fact, **not an approved freshness verdict**. Original
provider publication clocks remain unknown; warehouse ingestion is labelled
separately. No new macro stale threshold, index normalization, weights, proxy
substitution or composite calculation was introduced.

## Verification and next work

The actual macro_medallion → API → browser path rendered all seven source series
and a paginated 25-row history; displayed VIX reconciled to the independent
read-only inventory. No page errors occurred. Source rows remain in ignored local
working evidence, not tracked files. The full current-workspace suite, typecheck,
client/server build, Gold policy and immutable skills pin passed. Existing
bundle/eval warnings remain. Fourteen offline SENT browser cases passed. Client
asset inspection found no full macro connection string or macro-reader SQL.

Twenty focused unit/API cases cover metadata/units, missing flags, nulls, dates,
duplicates, per-series overflow/failure isolation, bounds and sanitized failures.
Five macro browser cases supplement the existing nine AAII/source-only cases:
three widths, historical pagination/units, missing rows, global-SIM behavior and
failure clearing. Ordinary tests use invented fixtures only.

Independent review found that a global overflow sentinel could discard healthy
series. It was reproduced and fixed with per-series post-join bounds and a
six-valid/one-overflow regression; final static review found no required issues.

Next remains **AAII-T08**, real NAAIM source admission, followed by genuine
put/call/breadth inputs and separately agreed composite methodology/freshness.
Do not enable a full fear/greed/sentiment score from a subset of inputs. Separately
reconcile the three uncatalogued equity-index series upstream before admitting
their price history or defining any derived breadth/momentum measure.
