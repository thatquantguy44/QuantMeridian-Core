# BMRK / BRA isolated Gold refresh rehearsal

## Scope and controls

This is an **isolated, non-promotable rehearsal**, not the upstream Gold rebuild and not a production publication. It prepares a display-normalized subset of at most 520 previously qualified Gold observations per selected series, plus at most 1,000 newly selected Silver observations per series. It creates a new SQLite database and JSON report in a fresh private temporary directory. There is no source-database write, overwrite option, or promotion path.

The rehearsal reads the qualified API baseline, then captures Gold, Silver, Bronze and repair-ledger evidence in a single PostgreSQL `REPEATABLE READ READ ONLY` transaction. It compares every baseline date and value to the snapshot, refuses historical Silver revision changes or duplicate keys, and re-verifies every baseline and candidate observation against a matching retained FRED payload or checksummed applied repair capture. The SQLite evidence table records the source run, observation and revision dates, ingestion time, raw value and row hash for each observation. Missing/invalid evidence blocks that series; independent series remain usable. Future observation dates and future provider revision starts are never promoted into current observations. Normal missing FRED observations are counted and excluded.

The report classifies the source board using its snapshot as-of date as well as its latest observation. A future board cutoff is `future` even when its latest value matches; a missing or invalid cutoff is unavailable. Reports made before this correction may have incorrectly labeled a future-cutoff board as matched.

The staged board is **only a latest-date/value projection** in display units. It is checked against staged observations, but does not recompute the upstream board's spreads, trends, staleness or other models. Full-history and cross-module parity, production-backend integration, backup, writer coordination and controlled publication remain necessary before any real refresh. `promotable` is always false.

## Reproduce and independently verify

From the Market Terminal repository, with the local PostgreSQL warehouse and retained evidence accessible:

```sh
npx vite-node scripts/benchmark-refresh-rehearsal.ts
node scripts/verify-benchmark-rehearsal.mjs /absolute/path/printed/by/the/rehearsal
# On this workspace, compare with the local EcoMedallion checkout's calculator:
../../pipelines/fred-bronze-to-gold-pipeline/.venv/bin/python \
  scripts/verify-upstream-benchmark-board.py \
  /absolute/path/printed/by/the/rehearsal \
  --pipeline-root ../../pipelines/fred-bronze-to-gold-pipeline
```

The local EcoMedallion checkout is `../../pipelines/fred-bronze-to-gold-pipeline` relative to the QuantMeridian repository. On November 11, 2026, the read-only calculator check against the bounded rehearsal matched all 11 staged series configured on the upstream board; 15 other staged series were outside the board configuration. The checkout was clean at commit `7b26d1e9d0e27313e7e367e47d59605ce8db6f7d` on `test/pipeline-performance-fixtures`. This identifies the local source used for that check; it does not establish which commit or process wrote the shared warehouse, and the bounded check is not a full-history rebuild.

Use `npm run typecheck:benchmark-refresh` to type-check the operator script. The first command uses the configured `MACRO_DB_URL` for reads. It prints the temporary directory and paths. The second opens the SQLite file read-only and independently compares every observation with the current Silver row, its Bronze receipt or applied checksummed repair capture, the report, and the staged board projection. It also rejects future rows and missing evidence. A source change after the snapshot can make independent verification fail; rerun from a new snapshot. The verifier does not query the upstream provider and cannot establish that a retained payload is authentic beyond the available lineage.

To exercise actual additions when current Gold has already caught up, explicitly truncate **latest-revised** history for a historical rehearsal:

```sh
npx vite-node scripts/benchmark-refresh-rehearsal.ts --series=SOFR,DGS10,IORB --baseline-through=2026-10-29
```

This uses real retained observations but is not a point-in-time reconstruction of what was known on that date. Omitted options explicitly select all configured series and the current baseline. Empty, repeated, malformed or unsupported options are rejected. The same New York calendar date applies across BMRK/BRA, while source retrieval and ingestion remain actual timestamps; this conservative policy does not assert the publication timezone of every provider.

## Evidence collected on November 11, 2026

The local writer configuration selects the pipeline's `PostgresWarehouse` for the normal `run` path. Its `build_gold()` is transactional but replaces the shared latest-observation table and builds other downstream products. The separate `gold` CLI selects SQLite or Spark in the inspected code; it does not itself select the configured Postgres factory. Local process/container and database-session inspection found no active FRED client writer at the time checked. A recent CLI run was recorded as partial (2,860 of 2,896 series succeeded); its status alone does not prove the Gold rebuild outcome or identify the process that later changed Gold.

Between the earlier November 10 inspection and the rehearsal, Gold advanced for SOFR and DGS10 from October 29 to November 9 without action by this work. The current all-series rehearsal contained 26 qualified series and six unavailable series, zero append candidates and one excluded future IORB observation. The independent verifier reconciled **13,520 of 13,520** observations: 2,968 to retained FRED receipts and 10,552 to audited repair captures. Its staged latest-date/value projections matched their staged observations. These are retained warehouse records, not a fresh provider-latest check.

The explicitly truncated three-series rehearsal staged 1,587 observations, including 27 real source-evidenced additions: seven each for SOFR and DGS10 and 13 for IORB. It excluded the November 12 IORB row. The independent verifier matched all 1,587 rows to Silver and their source evidence: 25 to retained FRED receipts and 1,562 to audited repair captures. Of the 27 additions, 25 matched receipts and two matched repair captures. A deliberately altered copy failed the independent verifier. The report's projection for IORB was November 11; the live Gold board was future-dated November 12 and was not treated as current. The upstream pipeline's actual `compute_benchmark_rate_board` calculator, run read-only against the staged rows, independently matched the latest dates and values for all three series. Its SOFR and DGS10 spreads were unavailable because EFFR and DGS2 were not in that staged subset; other board statistics use the bounded window. The calculator inputs were taken from clean copies of the four directly inspected upstream files at pipeline commit `7f83f4b3f367d5f9623eb0526d6a7176b333c3bf`; the wider checkout had unrelated modifications. The truncated baseline is an exercise, not a claim about historical data availability.

## IORB provenance and as-of behavior

The November 12 IORB Silver row was ingested in a CLI run started November 10 at 22:28 Eastern. The retained Bronze `series/observations` payload contains the same `3.9` value, observation date, and `2026-11-10` real-time start. The upstream FRED client and Bronze code describe retaining raw provider responses. This traces the row to a retained response; it does not prove why that response included a future observation or establish current provider availability. [FRED's IORB series](https://fred.stlouisfed.org/series/IORB) identifies the Board of Governors as its source and describes daily, seven-day observations. The [Federal Reserve's September 2026 implementation note](https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a1.htm) states that the 3.90% rate was effective September 17. These facts do not establish the publication or effective status of the November 12 row.

BMRK and BRA now select Gold and latest source observations no later than the response's explicit `America/New_York` as-of date. Future retained Gold and source rows are counted and disclosed, with the source rows labeled unverified for current use. A future-dated board is separately flagged and excluded from current interpretation. Valid earlier history remains available. Invalid or future provider revision dates fail qualification. No synthetic values are substituted.

## Open promotion work

Identify and coordinate the actual writer and its active run, investigate the future-date handling at the upstream Gold boundary, validate source and publication timing, perform a full board and downstream reconciliation against a consistent complete history in an isolated environment, and obtain the required operational backup and change controls. The rehearsal deliberately does not establish that these steps have happened.
