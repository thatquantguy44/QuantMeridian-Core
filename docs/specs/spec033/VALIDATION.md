# BMRK / BRA first-slice validation

Validated on 2026-11-10 (America/New_York) on branch `feat/bmrk-bra-production-readiness`.

- Full Vitest suite: 173 files, 1,759 tests passed with one worker. Focused source-qualification suite: 35 tests passed.
- Playwright: nine checks passed, covering both pages with SIM and snapshot settings enabled, partial results, rejected simulated responses, failed refreshes, narrow screens, the source PDF and the local retained warehouse.
- `npm run typecheck`, `npm run build`, `npm run check:gold-policy` and `git diff --check` passed. The build reported existing bundle-size and unrelated `eval` warnings.
- The local PostgreSQL warehouse snapshot is documented in [SOURCE_INVENTORY.md](SOURCE_INVENTORY.md): 26 of 32 Gold histories qualified, 23 had newer independently verified source records, and six lacked retained Gold observations. IORB had a qualified Gold history but its latest warehouse source record could not be verified. These counts are a dated local snapshot, not a guarantee of current provider availability.

The source boundary reconciles each loaded Gold observation with a Silver record and either its retained FRED receipt payload or an applied, checksummed repair capture and audit ledger. The newest warehouse source record is qualified separately; it is not inserted into the Gold history or historical calculations. This is evidence of consistency with retained captures, not a live provider check or proof of the upstream provider's authenticity. Publication timestamps and the upstream provider's latest observation remain unknown unless separately obtained. FRED is the distributor; its linked series pages identify original providers. Freshness thresholds are calendar-day approximations and discontinued status remains unknown without authoritative metadata.

Deployments must make the relevant Bronze receipts or original audited repair captures accessible alongside their ledger. Missing evidence fails closed per series. The local integration and browser checks used PostgreSQL; equivalent behavior on other warehouse backends has not been integration-tested. No warehouse records were modified by this work.

BRA composite market state, funding-dependent analysis and utilization remain unavailable until actual inputs are qualified. Links to other rate modules do not extend this source boundary to those modules. BMRK's PDF is currently a source-and-coverage report, not the earlier chart and analytics report. Expanded historical analytics and optional classification remain future priorities.


## Board provenance slice, 2026-11-11

The qualified API reads the board cutoff, source claim, revision start, warehouse ingestion timestamp and count of retained values with unknown vintage. Missing columns and null fields remain unknown; malformed fields are withheld and flagged. The board's claims are not provider evidence, and warehouse capture time is not a provider publication timestamp. A future board cutoff is excluded without discarding independently qualified history.

A disposable PostgreSQL database was populated with a read-only copy of retained SOFR and DGS10 Gold, Silver and evidence records and the matching rows from the previously validated upstream as-of board. The running terminal API returned qualified histories and matching board metadata. Dropping a provenance column, moving the board cutoff into the future, and inserting invalid metadata in that disposable database each produced the expected explicit status while retaining qualified histories. The source database was not modified. This is a two-series integration check; it does not establish that the refreshed upstream schema or board has been deployed to the shared warehouse.

The complete Vitest suite passed (176 files, 1,791 tests before the final added provenance cases); focused qualification tests, browser checks of both modules, TypeScript and the production build also passed. Browser fixtures are fictional test inputs, isolated from the source warehouse.
