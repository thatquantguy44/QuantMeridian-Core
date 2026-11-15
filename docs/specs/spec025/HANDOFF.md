# Spec025 AAII / source-only SENT handoff

**Updated:** 2026-10-31. **Branch:** `feat/spec025-aaii-postgres`.
**Completed:** private local AAII PostgreSQL → API → SENT card/chart/history/KPI
and latest-date evidence. All generated SENT inputs/examples removed. Seven verified macro_medallion Gold
series are now incorporated with explicit dates, units, missingness and history.

Read [SPEC.MD](SPEC.MD), [ADMISSION.md](ADMISSION.md),
[DATA_CONTRACT.md](DATA_CONTRACT.md), [PLAN.md](PLAN.md), [TASKS.md](TASKS.md).

## Crash fix — retained feed state across live updates

The reported `Cannot read properties of undefined (reading 'find')` was reproduced
when a live update changed the third feed from a legacy array to the macro DTO.
React retained the previous hook state for the render before effects cleared it;
the new view accessed `data.series.find` on that old array. Cold-load browser
checks had not exercised this transition.

`useFeed` now stores endpoint, parser identity and refresh generation with each
result and synchronously withholds data if any differs from the current request.
Old callbacks remain abort-guarded. The macro panel also shows No data if the
selected series/history is absent. Two browser regressions reproduce changed-URL
and same-URL/new-parser transitions; four render cases cover obsolete/incomplete
retained shapes. All 16 SENT browser cases pass. If a previously opened tab still
shows MODULE FAULT, click **Retry module** or reload: the existing error boundary
retains its fault until reset. No global error-boundary behavior was changed.

## Confirmed owner direction — do not re-ask

- Actual source: `127.0.0.1:55438`, `additional_market_data`, schema `aaii`, exact
  ordinary table `aaii.aaii_gold_latest`. It is separate from `macro_medallion`.
- Dedicated `quantmeridian_aaii_reader` was explicitly approved, created and
  verified. Ignored `.env.local` mode 0600 holds its server-only URL/expected role.
  Reader defaults read-only, 5s/1s timeouts, exact Gold SELECT only, no owner/admin/
  table/column writes, other role memberships or application relation access.
- User confirmed authorized **private local research only**, with self as local
  operating owner. AAII_RESEARCH_LOCAL_ENABLED=1 is set in ignored local config.
- **NO SIM anywhere in SENT**, including global SIM mode. This supersedes the
  earlier explicit-SIM-opt-in answer and the first UI example commit. No source
  connection/observations means No data. Never restore the example button.
- Stale when reported-date age exceeds ten UTC calendar days. Dated stale history
  remains visible. Failure/unconfigured/malformed source yields No data.

## Delivered behavior

The same validated latest-104 selection supplies the AAII observation card,
chart, historical table, latest survey date and spread KPI. The table is newest
first with 10/25/50/all row sizes, explicit units/coverage and actual gap days.
The chart breaks across gaps. Unknown publication timestamps stay Unknown.

Latest reported date, source first-seen/retrieval and terminal snapshot **read**
time are distinct. The read is not an immutable saved replay snapshot or historical
point-in-time evidence. No payload retention/export was added.

SENT imports no seeded sentiment helpers or shared SIM/fallback hooks. The macro
panel uses `/api/sentiment/macro`: VIXCLS, BAMLH0A0HYM2, BAMLC0A0CM, DGS10, DGS2,
DGS3MO and T10Y2Y, with verified daily FRED catalog units, last 252 stored rows per
series, explicit missing rows and per-series failure isolation. Readable labels,
reported dates/age-at-read/warehouse ingestion and historical pagination are
visible. No freshness threshold or composite score is inferred. See the new
[macro inventory](MACRO_INVENTORY.md) and [read-only SQL](MACRO_INSPECT.sql). The separate SENT social route requests
strict observed Reddit rows with no generated sectors/themes/tickers. StockTwits
trending has no sentiment; empty/unreachable providers and unsupported metrics
remain No data. Shared NEWS enrichment is unchanged outside SENT.

The full index, NAAIM, options/breadth/flows, positioning, contrarian/analog study,
divergence and borrow joins show No data until their required real inputs exist.
No reweighting or replacement score was introduced. Macro inspection found no
NAAIM/put-call/breadth catalog entry or dedicated relation. SP500/NASDAQCOM/DJIA
observations exist without matching catalog metadata and remain unadmitted. Legacy seeded data helpers
remain for other consumers outside SENT; do not call them from SENT again.

## Actual local verification

Approved reader → no-store API returned **104** validated observations; browser
rendered all 104 through the source-only view with zero page errors.

- Latest reported survey: **2026-10-22**.
- Source retrieval: **2026-10-27T01:18:06.865440Z**.
- Example terminal read: **2026-10-31T17:26:06.472Z** (each read has its own clock).
- Provider publication: **unknown/null**.
- Full source inspection: 2,046 dates from 1987-07-24; UI explicitly exposes the
  latest 104, not the full backfill. Actual lineage/values/secrets are not committed.

Local preview: `http://127.0.0.1:5193/sentiment` (session may need restarting).
Fresh checkout: use `.env.example` and the approved reader secret locally, then
`npm run dev -- --host 127.0.0.1`; restart after configuration changes. Production/
serverless AAII stays disabled regardless of flags. API checks actual loopback
peer, local Host, same Origin and rejects query/source/date/SIM overrides.

## Verification and review

78 focused offline tests cover normalizer, admission, AAII/macro readers/APIs and
real-only social boundaries. Sixteen offline Chromium cases cover four widths, pagination/all
rows, separate clocks, global SIM rejection across all views, SIM-labelled payload
rejection, real social rows with empty sectors, stale/failure clearing and UTC date
rollover, plus macro history pagination, missing-latest handling and failure
isolation. No provider or database access occurs in ordinary tests. Actual
macro database-to-browser verification rendered seven source series and a
25-row history page, reconciling displayed VIX to the independent audit.

Independent review found two actionable social issues: unsupported StockTwits
sentiment became neutral zero, and empty Reddit responses looked live. Both were
fixed and regression-tested. Final static review found no required issues. The
owner's earlier choice to skip an additional cross-model review was honored.
The full current-workspace suite, typecheck, client/server builds, Gold policy and
immutable skills pin passed. A scan of 115 emitted client assets found no AAII
credential, reader role, relation SQL or server configuration identifiers.
Run commands in PLAN.md. The separate live read above is evidence beyond fixtures.
Build retains existing bundle/eval warnings; no remote CI/deployment claim is made.
The later macro reader review found and fixed cross-series overflow rejection; a
per-series post-join bound now preserves the six healthy series. Final review
found no required issues. See MACRO_INVENTORY.md for scoped quality evidence.

## Follow-on slice — NAAIM

The separate authorized local NAAIM artifact reader/API/SENT tab is recorded in
[Spec027](../spec027/SPEC.MD). It replaces this handoff's former NAAIM discovery
placeholder. AAII stays unchanged: no shared database/credential path, no SIM,
and no composite or inferred methodology. Production, public reporting,
point-in-time snapshots, percentile/contrarian methods and broader NAAIM terms
remain separate work.

Do not rerun READER_ROLE_REQUEST.sql: it is a non-idempotent record of completed
owner-approved provisioning. Never copy writer credentials or expose local secrets.
