# Full-warehouse benchmark refresh rehearsal

This operator tool snapshots a PostgreSQL warehouse in a read-only transaction, restores the snapshot into tool-created disposable PostgreSQL databases, and runs a frozen EcoMedallion checkout's actual PostgreSQL Gold writer. It has **no promotion path** and does not accept a target database URL. Every report is marked `promotable: false`.

## Run

From the QuantMeridian repository, with the local EcoMedallion checkout, its Python environment, Docker, a local PostgreSQL image matching the source major version, and the configured `MACRO_DB_URL`:

```sh
npm run rehearse:benchmark-full
# Optional: choose a workspace and a locally available matching PostgreSQL image.
npm run rehearse:benchmark-full -- --workspace /path/with/sufficient/free/space --image postgres:16
```

The wrapper uses the existing local checkout at `../../pipelines/fred-bronze-to-gold-pipeline`, unless `--pipeline-root PATH` is supplied. `ECOMEDALLION_PYTHON` can select its compatible Python interpreter. The workspace must already exist. The tool prints progress and the path to a private `report.json`; it never prints the source URL. Source credentials are passed to a `pg_dump` process inside the disposable container, not in the host command arguments or report. Container creation uses an already-local image and does not pull one.

The capacity gate requires free workspace space of at least **three times** `pg_database_size` plus 2 GiB: one conservatively sized archive and two restored databases. It separately checks the container filesystem for two restores plus 2 GiB. This is conservative and does not reserve disk space; available space can change during a run. Docker's storage and the workspace may be on different filesystems. A large snapshot, checksums, and full rebuild can take considerable time and impose read load and a long-lived snapshot on the source. The writer runs as a local Python process against isolated PostgreSQL; its CPU, memory, and network access are not container-sandboxed or capped by this tool. Foreign tables and a pre-existing `_rehearsal` schema fail closed. Use a workspace and Docker storage with sufficient space before attempting a full run.

The source is read in a `REPEATABLE READ READ ONLY` transaction. `pg_dump` uses its exported snapshot and is forced read-only. The container name, credentials, port, database names, and marker are generated for this run; the writer is connected with initialization disabled and the database name and marker are checked before schema initialization or rebuild. The checkout's committed `src` and `config` are frozen with `git archive`; uncommitted changes there block the run. The Git commit and tree are recorded even when capacity preflight blocks the run. The report identifies the commit, source archive hash, Python/dependency versions and local PostgreSQL image ID. The writer uses `PipelineConfig` defaults and frozen `src/config`; source URLs and `FRED_*` environment overrides are removed from its process. The temporary database archive and container are removed after the run, including failure paths where possible; cleanup status is recorded in the report. A failed cleanup requires manual intervention. An abrupt process kill or host failure may prevent cleanup.

## What is checked

- The restored candidate is compared with the same source snapshot using table row counts and two order-independent, non-cryptographic row fingerprints. A mismatch blocks the writer.
- The configured benchmark inputs are checked against retained FRED observation receipts or applied, checksummed repair captures. Missing, invalid, ambiguous, or unverified evidence blocks the build. This establishes consistency with retained records, not live provider authenticity or current provider availability.
- The actual `PostgresWarehouse.build_gold(full=True, benchmark_as_of=...)` rebuild runs only in the verified disposable database. The report includes before/after board rows and field differences, validates the cutoff and 16 configured series, independently reselects eligible dated Silver revisions for latest-value and provenance checks, and lists added, removed, changed and unchanged Gold tables with row counts and fingerprints. The exact number of configured series comes from the frozen candidate configuration.
- The original database archive is restored into a second disposable database and compared with the original restored snapshot. This exercises database table-content recovery; it does **not** verify equivalent DDL, roles, privileges, schedules, external files or live application behavior. External audited repair captures are checked in place for evidence but are not included or restored by the database archive. A result requiring those captures is explicitly marked for attention.
- Future observation dates, revision dates and capture timestamps are counted and reported. The rebuilt board is checked against the explicit cutoff; the run is marked for attention if future inputs existed, even when they were correctly excluded. No missing value is filled with a synthetic one.

The status is `passed` only when all checks complete without flagged findings; `attention` means the process completed but has findings; `blocked` means a prerequisite such as storage capacity prevented execution; and `failed` means an operation or integrity check failed. Nonzero exits are intentional for `attention`, `blocked`, and `failed`. Even a `passed` report is non-promotable and is not approval to refresh the shared warehouse.

## Validation on November 11, 2026

The configured source warehouse reported approximately **92.4 GB** and the local workspace had approximately **40.7 GB** free at the final check. The conservative gate required approximately **279.4 GB**. The tool stopped at capacity preflight before creating a target or copying source data. A full-warehouse rehearsal and restore therefore remain **unvalidated in this environment**.

An end-to-end test instead copied 240 retained Silver records for all 16 configured board series, their relevant receipts and audit ledger records, and board rows into a separate disposable source fixture. Using EcoMedallion commit `7b26d1e9d0e27313e7e367e47d59605ce8db6f7d`, the rehearsal matched 86 source tables to the restored fixture, rebuilt 16 board rows, independently reconciled their latest evidence-qualified values and metadata, and matched 86 tables after the second restore. The evidence check matched 115 rows to receipts and 125 to audited repair captures. It flagged one future input and the lack of external capture-file recovery testing. This is a small fixture test, not whole-warehouse parity. Its report was private and non-promotable.

The opt-in fictional-fixture integration passed before the final cleanup hardening. A later repeat timed out starting Docker; its orphaned fixture was removed. On November 12, the final integration passed, including the owned-container cleanup checks, using a clean temporary clone of EcoMedallion commit `7b26d1e9d0e27313e7e367e47d59605ce8db6f7d`. The original local EcoMedallion checkout contained untracked source files, so the rehearsal correctly refused to freeze it; the temporary clone preserved those local files. Ownership and uncertain-cleanup behavior are also covered by focused unit tests.

Focused safety tests and a separate opt-in end-to-end integration use explicitly fictional observations in tool-created disposable databases only:

```sh
../../pipelines/fred-bronze-to-gold-pipeline/.venv/bin/python -m unittest discover -s test/tests -p test_benchmark_full_rehearsal.py
BENCHMARK_FULL_INTEGRATION=1 ../../pipelines/fred-bronze-to-gold-pipeline/.venv/bin/python -m unittest discover -s test/tests -p test_benchmark_full_rehearsal_integration.py
```
