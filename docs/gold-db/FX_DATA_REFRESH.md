# FX and rates refresh checkpoint

**Status:** Refresh and Gold publication verified; two known unavailable rate identifiers remain explicitly blocked.
**Run date:** 2026-10-30 New York / 2026-10-31 UTC.
**Database:** Local PostgreSQL `macro_medallion`, port 55432.
**Related scope:** [FX capability map](../../FX_CAPABILITY_MAP.md).

## Refresh scope and extraction evidence

The pipeline checkout is `../../pipelines/fred-bronze-to-gold-pipeline` relative to
the terminal repository. This operation used its existing code at `e6cbe64` on
`spec014-run-batched-persistence`; no pipeline code, manifests, source keys,
credentials, schedules or default configuration were changed.

Run `b4502d16295445cf901610cb2b3855fb` attempted 106 existing active series:
37 FRED, 33 ECB and 36 BIS. The selection included 17 ECB FX reference series,
23 FRED bilateral currency series and three FRED dollar indexes. It also covered
ECB policy/EURIBOR/yield-curve series, selected US rates and BIS policy rates.
The earlier Gold catalog inventory contained only 27 FX/index entries; that
catalog was not an exhaustive inventory of active upstream ingestion.

Extraction completed in 210.65 seconds: **104 passed, two failed, none skipped**.
All 43 FX/reference/index series passed. The existing safe `per_series` write
mode was retained. Notifications and the unrelated ECB eligible-assets poller
were disabled for this operation. Raw responses, DQ results and run evidence
were retained through the normal Bronze/Silver/audit path.

The two failures were HTTP 404 responses for known guessed identifiers already
documented in the pipeline's `docs/catalog/ecb.md`:

- `ECB:FM:M.U2.EUR.RT.MM.EURIBOR12MD_.HSTA`
- `ECB:FM:D.U2.EUR.4F.KR.ESTR.LEV`

They remain unavailable. This refresh did not silently substitute another
series or activate the separately deferred €STR candidate. Potential corrected
keys require an explicit source-mapping change with metadata/units, manifest
validation and source evidence; the official ECB portal identifies
[one-year EURIBOR](https://data.ecb.europa.eu/data/datasets/FM/FM.M.U2.EUR.RT.MM.EURIBOR1YD_.HSTA)
and [€STR](https://data.ecb.europa.eu/data/datasets/EST/EST.B.EU000A2X2A25.WT).

## Freshness means source availability

The successful responses contained the following latest source dates/periods.
Post-publication checks confirmed these endpoints in Gold. Source availability
does not itself approve a consumer freshness/admission policy.

| Data | Latest source date/period in the refresh | Interpretation |
| --- | --- | --- |
| All 17 ECB FX reference series | 2026-10-30 | Daily reference data; not executable prices. |
| All 26 FRED currency/index series | 2026-10-23 | Latest business week in the October 26 H.10 release. |
| SOFR, EFFR, DFF, US 2Y/10Y Treasury yields | 2026-10-29 | Observation dates differ from retrieval time. |
| ECB daily policy rates | Through 2026-10-31 UTC | Preserve source calendar dates; do not invent intraday observation times or backdate receipt. |
| Three-month EURIBOR | 2026-09 period | Monthly observation; not a daily quote. |
| BIS policy rates | Country-dependent, up to 2026-09 period | Most refreshed to September; some source histories end earlier, including Argentina at 2025-06. |

The [Federal Reserve H.10 schedule](https://www.federalreserve.gov/releases/h10/)
publishes the previous business week's daily observations on Mondays, with a
holiday adjustment. Its [current-release page](https://www.federalreserve.gov/releases/h10/current/default.htm),
retrieved on 2026-10-30 New York / 2026-10-31 UTC, showed the October 26 release
ending on October 23. That URL changes with each release; the dates here record
what was inspected at this checkpoint. A seven-day-old nominal FX observation at this checkpoint
does not alone demonstrate a failed refresh.

[ECB reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html)
have a different daily publication schedule and informational purpose.
[BIS policy-rate metadata](https://data.bis.org/topics/CBPOL) distinguishes daily
and monthly data; monthly observations describe end-of-period values even when
the pipeline normalizes their dates to the first of the month. Evaluate each
source's latest available period and actual successful retrieval separately.

## Publication path

The October 26 extraction had deliberately used `--no-gold`; its successful
series outcomes were not evidence of a subsequent Gold publication. The
observed Gold watermark before this refresh was October 23.

The pipeline's current `gold --env dev` CLI path incorrectly selects Spark;
its own `docs/handoff.md` records that as pending work. This refresh uses the
existing configured `WarehouseFactory` and transactional
`PostgresWarehouse.build_gold()` method. The destination is checked as local
PostgreSQL port 55432/database `macro_medallion`, with no fallback backend.

That standard method rebuilds the wider Gold warehouse, not only the selected
106 series. Exceptions roll back the transaction. Per-table build outcomes,
selected-universe equality and a nonempty-output smoke check of ten core Gold outputs
must all be inspected after commit; a successful extraction exit code alone
does not establish publication readiness.

Gold committed at **2026-10-31 02:48:44 UTC** (October 30 New York), after
1,842 seconds. All **54 reported build outputs** returned `ok`; the rebuilt
latest-observation layer contains 20,564,977 rows. The watermark advanced to
`2026-10-31T02:16:34.500218+00:00`, reflecting the newest incorporated Silver
ingestion, not the publication instant or source observation date.

## Validation and its limits

- **Completed:** Normalize every successful run response from Bronze and compare
  it with stored Silver. All 9,719 response observations across 104 series had
  matching keys, values, raw values, missing markers, row hashes and vintage
  interval ends. No mismatches or missing keys were found.
- **Passed after publication:** Check every selected series for presence, finite
  values, positive FX levels, timestamps and future dates against a declared UTC
  check date. Across **641,317 selected Gold rows**, no nonfinite values,
  nonpositive FX levels, future observation dates, missing ingestion timestamps
  or duplicate series/date keys were found. Exactly the two known 404 series
  had no history; all 104 successful series were present.
- **Passed after publication:** Rank eligible Silver revisions using the pipeline's
  actual latest-revision ordering and perform bidirectional row equality against
  Gold, including values, missingness, vintage boundaries, revision number and
  ingestion timestamp. Both directional differences contained **zero rows**.
  Derive freshness from those current revisions.
- **Passed after publication:** Recheck the historical payload fingerprints recorded
  for EUR/USD, USD/JPY, ECB USD/EUR and SOFR over their available 2000–2020 slice.
  All four counts/keys/payload fingerprints were unchanged. This is a sampled
  historical-payload check, not proof of all-series lineage. All ten previously
  nonempty core Gold outputs also remained nonempty; this is a smoke check,
  not a complete regression audit of unrelated analytics.

**Catalog gap:** 16 of the 43 stored FX/index series are absent from the curated
`gold.dim_series` discovery catalog (11 FRED series and five ECB crosses).
The observations exist and passed reconciliation, but those additional series
need qualified catalog metadata before module admission. The checked-in SQL
lists their exact identifiers; Gold observation presence is not catalog coverage.

Independent review identified a latent upstream limitation: the Silver upsert
is gated by a row hash that omits `realtime_end`. A source that only closes a
vintage interval can therefore leave an obsolete interval stored. The current
run's raw-response comparison found no such mismatch, but this operation does
not certify historical point-in-time reconstruction or repair that behavior.
An upstream regression test/fix is required before a broader certification.

Working evidence is under `/tmp/fx-refresh-*`, `/tmp/fx-bronze-silver-check.*`
and `/tmp/fx-gold-presence-*` on the operator's machine; these files are not a
durable production evidence store. Source payloads and credentials are not
committed to this repository.

The [read-only SQL checks](FX_DATA_REFRESH_CHECKS.sql) reconstruct the selected
universe from this run's persisted audit records, inspect extraction outcomes
and Gold health, and compare current ranked Silver with Gold in both directions.
Run them against the local `macro_medallion` warehouse after publication. This
rechecks the warehouse's current state; it does not freeze future revisions.

## Next scoped work

Refresh/publication is complete. Review the two invalid rate mappings, the
16 curated-catalog omissions and the interval-only upsert limitation in the
pipeline as separate changes. Record module pickup in the [master handoff](../handoff.md). The FX
specifications must retain source-specific freshness, explicit missingness and
receipt-aware historical limitations; this refresh does not approve either
module's detailed specification or operational hedge use.
