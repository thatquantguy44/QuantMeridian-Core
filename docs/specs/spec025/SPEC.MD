# Spec025 — AAII PostgreSQL integration and source-only SENT

- **ID:** `spec025-aaii-postgres-sentiment`
- **Status:** Private local reader/API/SENT history slice implemented and verified.
- **Updated:** 2026-10-31. Branch `feat/spec025-aaii-postgres`.
- **Module:** Existing `SENT` screen, with the AAII Survey tab.
- **Pipeline owner:** MarketMedallion; QuantMeridian is a read-only consumer.

## Approved scope and latest direction

The owner requested historical-table and latest-snapshot-date visibility, then
confirmed authorized **private local research only**, with the user as local
operating owner. The latest explicit direction is **NO SIM anywhere in SENT**:
without a source connection/observations, show **No data**. This supersedes the
earlier explicit-SIM-opt-in proposal. Global SIM mode cannot enable SENT examples,
seeded components, generated enrichment or a simulated composite.

Display the latest bounded AAII selection in a table, chart, observation card and
KPI. Preserve real Gold macro observations and observed social posts where
available. NAAIM, positioning, signals, analogs, historical social divergence,
borrow joins and the complete composite have missing required real inputs and
show No data. No silent reweighting, invented neutral values, generated history,
forward returns or real-current/SIM-prior comparisons are permitted.

Public/production use, exports, new durable observation retention and licensing
beyond the confirmed private local use remain outside this approval.

## Source and ownership boundary

Read exact ordinary table `aaii.aaii_gold_latest` in `additional_market_data` at
`127.0.0.1:55438`, using only `quantmeridian_aaii_reader`. This is separate from
`macro_medallion`. Do not widen generic GoldStore or reuse pipeline writer/admin
credentials. Owner-approved reader provisioning is complete; do not rerun it.

[DATA_CONTRACT.md](DATA_CONTRACT.md) records the verified 19 columns, fractional
share units, reported-date semantics, tolerance/adjacency checks and safe lineage.
[ADMISSION.md](ADMISSION.md) records actual reader, source and local-use evidence.
The pipeline owns acquisition, parsing, validation, revisions and backfill. The
terminal must not scrape AAII, refresh the pipeline, repair values or write survey
records. The earlier role creation was an explicit separate metadata approval.

Gold contains the latest observed version per reported date. This is current
vintage, not historical point-in-time knowledge. No cutoff/replay endpoint or
archived snapshot is claimed. The new macro_medallion inventory and integration
are recorded in [MACRO_INVENTORY.md](MACRO_INVENTORY.md).

## Runtime architecture

`aaii.aaii_gold_latest` → server-only `src/lib/server/aaii/reader.ts` → pure
normalizer → `GET /api/sentiment/aaii` → existing SENT AAII card/chart/table/KPI.
The repository's shared Vite/Node route registry serves the API.

- Server-only `AAII_RESEARCH_LOCAL_ENABLED=1`, `AAII_POSTGRES_URL` and
  `AAII_POSTGRES_EXPECTED_ROLE=quantmeridian_aaii_reader`. No `VITE_` secrets.
- Exact approved loopback target/role; DSN query options/remote targets rejected.
  Development loopback transport only; production/serverless AAII is always off.
- Verify actual loopback socket peer, local URL host and same-origin requests.
  Reject query/source/date/SIM overrides before reading the source.
- Dedicated short-lived client; coalesce concurrent reads only. No prior-result
  cache. Four-second connect timeout, six-second driver query timeout and
  read-only repeatable-read transaction with five-second statement/one-second lock
  timeout and `pg_catalog` search path.
- Verify read-only defaults, exact login/effective role, SELECT, absence of
  ownership/admin/table/column writes, memberships, other application relation
  access, schema/database CREATE and executable application security definers
  before Gold data. Admission failures are distinct from source/validation failures.
- One ordered data statement, latest 104 observations; latest comes from that same
  selection. Raw source lineage and driver errors never enter the presentation DTO.
- No-store responses; empty/invalid/failed results yield no selection. The client
  clears previous values on refresh/failure and rejects unadmitted/SIM source labels.
  Retained client state is usable only for the current endpoint, parser identity
  and refresh generation; schema changes must withhold old data before effects run.

SENT macro observations use the dedicated no-store `/api/sentiment/macro` reader
over the existing GoldStore configuration. Seven inspected catalog-backed daily
FRED series are admitted: VIXCLS, BAMLH0A0HYM2, BAMLC0A0CM, DGS10, DGS2, DGS3MO
and T10Y2Y. One bounded parameterized statement joins catalog/history, returns up
to 252 stored dates per series and detects post-join overflow per series. Exact
source/unit/frequency, value/date/clock/missing-flag and duplicate checks apply.
History preserves missing rows; a missing latest value never borrows a prior
value. UI exposes labels, units, dates, age-at-read and warehouse ingestion. Age
is not a new freshness policy; no composite is derived from a subset. See
[MACRO_INVENTORY.md](MACRO_INVENTORY.md) for actual evidence/exclusions.
SENT social uses `/api/sentiment/social` with strict `realOnly` provider behavior:
no generated sectors/themes/tickers. Currently only observed Reddit posts support
sentiment. StockTwits trending supplies no sentiment and is omitted rather than
inventing neutral scores. Empty/unreachable providers yield No data. Shared NEWS
behavior is outside this SENT slice.

## History and clocks

The full **104-observation window** is inspectable newest first, with page sizes
10/25/50/all, coverage dates and bullish/neutral/bearish percentages, spread in pp,
and actual recorded gap days. The warehouse's full 2,046-date backfill is not
silently advertised as exposed. Gaps remain explicit; the chart breaks across gaps.

Keep these distinct and visible:

1. Latest unshifted reported survey date (`latestSurveyDate`).
2. Latest snapshot **read** time (`readCompletedAt`, UTC); a current live read, not
   an immutable saved/replay artifact or provider publication.
3. Source retrieval and first-seen clocks, including available microseconds.
4. Provider publication timestamp, visibly Unknown when null.

Stale when reported-date age exceeds **10 UTC calendar days**. Age ten is current;
age eleven is stale. Dated stale history remains visible, with current AAII KPI
unavailable. Client freshness also advances across the UTC date boundary. No
current composite is calculated while its required source inputs are missing.

## Functional requirements

| ID | Requirement |
| --- | --- |
| AAII-01 | Dedicated server-only, read-only reader of the exact approved relation/target. |
| AAII-02 | One bounded deterministic history selection; latest and all displayed AAII values share it. |
| AAII-03 | Validate identity, units, totals, spread, dates/clocks, adjacency, duplicates and ordering. |
| AAII-04 | Versioned narrow DTO with safe source/freshness/clock evidence and no raw operational lineage. |
| AAII-05 | Distinguish reported date, source first-seen/retrieval, null publication and terminal read clocks. |
| AAII-06 | Wire real AAII card/history/KPI; missing aggregate inputs remain No data. |
| AAII-07 | Distinguish stale dated history from no-data/source/access/integrity failures; never invent rows/zeros. |
| AAII-08 | Enforce local access, reader admission, bounded timeouts and sanitized errors. |
| AAII-09 | Current-vintage revisions only; no inferred historical system-known cutoff or saved replay. |
| AAII-10 | Offline invented fixtures for gaps, revisions, clocks, bad units/totals and source failures. |
| AAII-11 | NO SIM in any SENT view or input path, including global SIM mode and mixed provider enrichment. |
| AAII-12 | Record private local use, safe configuration, actual evidence and next scoped source work. |

## Acceptance criteria

| ID | Independent check |
| --- | --- |
| AC-01 | Fractional .4/.2/.4 becomes 40/20/40 percent and zero pp spread. |
| AC-02 | Reported labels/gaps persist, chronological source selection and newest-first table agree, all 104 rows reachable. |
| AC-03 | Revision changes current-vintage evidence without claiming earlier knowledge. |
| AC-04 | Null publication stays Unknown; snapshot read and source dates are separate. |
| AC-05 | Malformed/duplicate/non-finite/future/inconsistent source data is rejected, never repaired. |
| AC-06 | Stale history stays visible; refresh failure removes current selection rather than substituting old/examples. |
| AC-07 | Browser uses same-origin API only; client assets contain no credential, source SQL or database driver. |
| AC-08 | Privileged/missing readers and nonlocal/cross-origin/query overrides fail before reading Gold. |
| AC-09 | Every SENT view shows No data when required real inputs are absent, even with global SIM enabled. |
| AC-10 | Ordinary tests use invented fixtures/mocks only; real DB verification is a separate authorized local check. |
| AC-11 | Focused/full tests, browser at four widths, typecheck/build, Gold policy and immutable skill pin pass. |

## Next scoped work

Inventory and admit a real **NAAIM source contract** before adding its connector:
find upstream storage/coverage, ownership, rights, units, dates, clocks, revisions
and reader boundaries. Do not implement a replacement series or composite score
from invented values. Complete composite/contrarian/percentile methodology and
freshness decisions remain separate until all required source inputs exist.
Full warehouse history paging, point-in-time research, exports, saved snapshots
and production access also require separately scoped work.

See [HANDOFF.md](HANDOFF.md), [PLAN.md](PLAN.md) and [TASKS.md](TASKS.md).
