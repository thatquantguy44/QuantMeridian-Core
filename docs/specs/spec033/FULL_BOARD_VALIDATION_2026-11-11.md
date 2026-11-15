# Isolated upstream Gold and benchmark-board validation — 2026-11-11

## Result

The upstream `PostgresWarehouse.build_gold(full=True)` completed in a newly created, isolated PostgreSQL 16 database populated with the complete retained Silver history of all **16 configured benchmark-board series**. The build produced 108,510 latest-observation rows, and all compared fields matched the shared Gold snapshot. Its 16 persisted benchmark-board rows matched the shared board for every field, including latest and prior values, changes, trends, benchmark spreads, z-scores, percentiles, regimes, and staleness. An independent calculation also reproduced every board field for the unfiltered and as-of-filtered scenarios.

**The board is not safe to promote as an as-of-2026-11-11 result.** A retained IORB observation dated 2026-11-12 is included in the upstream build. It moves the shared board `as_of_date` to 2026-11-12 for all 16 rates. The existing downstream as-of guard remains necessary. The as-of experiment below is an isolated input prefilter; it is not an upstream fix.

## Evidence and isolation

- The source was read using a repeatable-read, read-only PostgreSQL transaction at 2026-11-11 05:58:06 UTC (2026-11-11 in America/New_York). All configured series and their benchmark dependencies were included, across the complete retained history. No source-provider collisions or duplicate vintage keys were found.
- All 108,637 Silver records matched retained source evidence: 98,540 matched a retained FRED observations response and 10,097 matched an applied repair batch, its checksummed capture, and the captured response. No records were imputed or simulated for this validation. These checks establish agreement with retained evidence; they do not independently authenticate FRED's current service or establish why the future-dated observation was present.
- PostgreSQL ran in a new temporary container and network, with its port bound to localhost. The source warehouse was never a write target. The container and network were removed after the run. The isolated output is non-promotable and is not a replacement for the warehouse.
- The tested upstream checkout was based on commit `7f83f4b3f367d5f9623eb0526d6a7176b333c3bf`, with uncommitted work present, including `postgres_store.py` and `local_store.py`. A frozen working-tree copy was used; file hashes are in the [machine-readable report](FULL_BOARD_VALIDATION_2026-11-11.json). Results therefore do not claim to test the committed tree alone.
- A second read-only snapshot at 05:56:59 UTC independently recomputed the board from 108,510 Gold observations, and matched the board captured during the initial test. It checked the configured labels, latest/prior values, change, five-observation trend, date-aligned benchmark spread, population z-score, percentile rank, regime, and staleness. See the [independent check](FULL_BOARD_INDEPENDENT_CHECK_2026-11-11.json).

## As-of experiment

The upstream code was run again after excluding records with an observation date or revision start later than 2026-11-11 from the isolated input. The sole excluded row was IORB, observation date 2026-11-12, revision start 2026-11-10, value 3.9 percent. This row matched its retained FRED response. Its presence alone does not establish that it was synthesized.

The prefilter changed 34 board fields: all 16 `as_of_date` fields, 15 staleness values, and IORB's latest date, z-score, and percentile. IORB's value remained 3.9 percent; its latest date became 2026-11-11. The 15 other rates' staleness fell by one day; IORB stayed at zero because its latest date moved back with the board date. The independent calculation matched both versions of the board.

## Limits and follow-up

This is a complete retained-history test for the configured benchmark-board inputs, not a full-warehouse parity test. Other series, metadata, provider feeds, and warehouse-wide Gold outputs were not copied or reconciled; the full build's `ok` results for those other objects do not establish their correctness. The validation did not check FRED's live latest data, prove historical point-in-time receipt availability, or run an incremental refresh against the complete warehouse.

The next upstream change should pass an explicit as-of date through Gold refresh and board construction, exclude future observation dates and future revision starts before selecting a latest revision, and add regression coverage for the shared board date, staleness, spreads, and historical statistics. Missing or unsupported data should remain visibly unavailable rather than being replaced with synthetic values.
