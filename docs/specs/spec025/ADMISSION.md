# AAII admission evidence and decisions

**Checked:** 2026-10-31. **Branch:** `feat/spec025-aaii-postgres`.
The owner requested preparation, source inspection and offline contract tests.
Private local SENT display is now admitted and implemented. Production/public display remains gated.

**Subsequent owner confirmation (2026-10-31):** authorized private local research
only, with the user as local operating owner. This admits local display through
the dedicated reader; it does not approve public/organizational redistribution,
exports, provider acquisition or a production endpoint. Local API implementation
must still enforce the loopback peer/host/origin and explicit opt-in boundary.

## Confirmed owner choices

- Stale when reported-date age exceeds **10 calendar days**; retain dated stale
  observations. Implementation uses explicit UTC calendar-date arithmetic.
- Source failure/unconfigured access is **unavailable**. The latest owner instruction forbids **all SIM in SENT**, including explicit
  examples/global SIM mode. This supersedes the earlier SIM-opt-in choice.
- The owner supplied local target `127.0.0.1:55438`, database
  `additional_market_data`, schema `aaii`, login `market_data`, effective writer
  `aaii_writer`, and an ignored local secret reference. This is development only.
- That explicit connection reference authorized a **one-off read-only inspection**.
  It does not admit the writer as a runtime consumer. The owner subsequently
  explicitly approved creating the dedicated local reader, as recorded below.

## Evidence collected

| Item | Observed evidence / result | Disposition |
| --- | --- | --- |
| Original target hypothesis | Terminal's configured `macro_medallion` database has no `aaii.aaii_gold_latest`; its current account has admin privileges. Only catalog/session metadata was inspected there. | Rejected as the current AAII consumer target/account. Do not repoint generic GoldStore. |
| Correct local target | Owner confirmation and successful read-only connection to `additional_market_data` on loopback 55438. | Source target verified for local inspection. No production endpoint implied. |
| Reader configuration | New generated reader credential saved in ignored terminal `.env.local`, mode `0600`, under `AAII_POSTGRES_URL` and `AAII_POSTGRES_EXPECTED_ROLE`. Persisted configuration was loaded and used for verification. | Local reader configured; no writer credential copied, secret printed or client configuration exposed. |
| Inspected identity | `market_data` login, `SET LOCAL ROLE aaii_writer`; transaction read-only on, repeatable-read; relation owned by writer and write privileges present. | One-off audit only. Pure reader-admission guard rejects this writer/owner even in a read-only transaction. |
| Relation/schema | Actual `aaii.aaii_gold_latest`, `relkind=r`, 19 columns and type/nullability metadata match source definition. | Ordinary table, not a view. Text date/clock fields; see DATA_CONTRACT.md. |
| Source identity | Actual rows and upstream manifest/promote code use lowercase `aaii`, dataset `aaii-investor-sentiment`. | Validate lowercase raw source; display uppercase AAII. |
| Coverage | 2,046 rows, 2,046 unique reported dates, 1987-07-24–2026-10-22; nine gaps exceed eight days. | No filling, no inferred missing dates or historical knowledge. |
| Value checks | Zero identity/range/spread violations. One literal float total residual `0.0020000000000000018` is within decimal tolerance plus the bounded 8-EPSILON guard; zero beyond it. | Representation boundary, not a repaired source value. Upstream parses totals with Decimal before float storage. |
| Timing | All 2,046 provider publication timestamps null. Latest source age nine UTC calendar days at inspection. | Unknown publications remain null. Ten-day date freshness alone does not certify pipeline health. |
| Bounded sample | Latest 104 rows passed the pure normalizer: 103 within-selection adjacency links, one upstream-only boundary; all 104 publication times null. | No raw sample, survey values, lineage hashes or DSN committed. |
| Source rights | Upstream runbook says routine automation/redistribution remain unverified. Official AAII survey/terms pages were reviewed. | Individual-use wording/download availability do not establish organizational/public terminal rights. Organizational/public rights remain unconfirmed; the owner subsequently confirmed private local research rights. |

Both local audits used repeatable-read **READ ONLY**, five-second statement
timeouts, and ROLLBACK even on success. No DML, DDL, GRANT, volume inspection,
provider download, source refresh or data repair occurred during those audits.
The separately approved provisioning below created only the dedicated role/grants/settings.
The secret stayed within the authorized process; it was neither printed nor tracked.

## Approved local reader provisioning — 2026-10-31

The owner explicitly approved the prepared [reader role](READER_ROLE_REQUEST.sql).
`quantmeridian_aaii_reader` was absent before creation, then created as a fresh login
with no superuser/createdb/createrole/replication/bypass-RLS/inheritance attributes.
Its independent random password was set using a SCRAM verifier and stored only
in ignored server-side `.env.local` with `0600` permissions. Existing configuration
was preserved; the password and verifier were not printed or tracked.

Verification used the persisted consumer connection, not the writer account:

- Actual login/effective role both `quantmeridian_aaii_reader`.
- `default_transaction_read_only=on` and transaction read-only on.
- Statement timeout **5s** and lock timeout **1s**, both asserted.
- CONNECT, schema USAGE and Gold SELECT present; database/schema CREATE absent.
- Gold ownership and table/column-level write privileges absent.
- **Zero** other role memberships, other application-relation privileges or
  executable application security-definer functions in the inspected scope.
- The strict `assertAaiiReaderAdmission` guard passed on actual evidence.
- Gold SELECT saw 2,046 dates; all 104 selected rows passed normalization.

Provisioning changed role/grant/settings metadata only; no survey data was written.
No unrelated role, PUBLIC privilege, schema, provider process, production endpoint
or runtime SENT feature was changed. The inspection is scoped local evidence,
not a universal certification of every possible PostgreSQL function/extension.

## Local admission and remaining expansion decisions

| Decision | Required evidence / proposed rule | Status |
| --- | --- | --- |
| Display/storage entitlement | Explicit owner confirmation of authorized private local research, with user as operating owner; no public deployment/export. No new durable observation storage in this slice. | Confirmed for private local display on 2026-10-31 |
| Dedicated reader | `quantmeridian_aaii_reader`: CONNECT + `aaii` USAGE + SELECT exact Gold; owner/admin/table- or column-write privileges absent. New credential configured privately. | Approved, created and verified locally on 2026-10-31 |
| Local runtime boundary | Explicit loopback/local opt-in and recorded local transport policy; never expose this source just because the terminal route exists. | Implemented and verified: actual loopback peer, local host/same Origin, explicit local flag; no query overrides; production/serverless off |
| Current composite | Latest owner requires no generated input and No data when real connections/observations are absent. Full composite remains unavailable because required sources are missing; no implicit reweighting. | No-data behavior implemented; future complete-source methodology/freshness decisions remain separately scoped |
| Production | Approved endpoint/network/TLS/CA, secret injection/rotation, trusted audience, monitoring/escalation and rights. | Separate, not approved |

The initial connection-location answer did not establish entitlement. The owner
subsequently explicitly confirmed authorized private local research and operating
ownership. That confirmation admits this local display only; it does not establish
organizational/public rights or export/storage expansion.

## Reproducible checks and limits

[INSPECT.sql](INSPECT.sql) reports target metadata and safe counts in a read-only
transaction. Use only approved injected credentials and `ON_ERROR_STOP=1`.
The pure `assertAaiiReaderAdmission` guard requires affirmative Boolean evidence
and rejects missing, privileged, owning or writing identities. Inspect actual
role membership/other application privileges and obtain DBA confirmation before
supplying that evidence; these checks are not a complete database-function audit.
The owner separately approved and verified this local reader; broader public/production
source activation and entitlement do not follow from that approval. Private local
display was separately confirmed and implemented afterward.

Source implementation was read from the local MarketMedallion checkout at
`pipelines/market-medallion`: AAII `io/warehouse.py`, `data/gold.py`, CSV/XLS
Decimal validators and `manifests/aaii-investor-sentiment-xls.yml`. No upstream
source files or survey rows were modified. Only the subsequently approved database
reader metadata was added.

## Primary references

- [AAII survey](https://www.aaii.com/sentimentsurvey), checked 2026-10-31: individual
  use, weekly release and modern Week Ending labels. Do not substitute those
  labels for the pipeline workbook's retained Reported Date convention.
- [AAII terms](https://www.aaii.com/privacy/tos), checked 2026-10-31: this review
  does not establish survey redistribution or organizational terminal permission.
  No unrelated product-specific clause is treated as that authorization.
- [PostgreSQL transaction modes](https://www.postgresql.org/docs/current/sql-set-transaction.html)
  and [privilege inquiries](https://www.postgresql.org/docs/current/functions-info.html):
  read-only transactions and a least-privilege account are separate protections.

## Implemented local read and source-only SENT — 2026-10-31

`/api/sentiment/aaii` enforces the local gate before source access. Runtime verifies
reader identity/privileges in a repeatable-read read-only transaction, selects the
latest 104 observations once and validates them before returning a no-store DTO.
No survey-data changes, new role changes, exports or durable observation store
were added. Ignored `.env.local` now enables the approved private local flag.
Actual API and isolated browser verification passed with 104 observations through
2026-10-22, retrieval 2026-10-27T01:18:06.865440Z and unknown publication. Terminal
read completion is a separate current clock, not historical provider knowledge.

SENT now rejects SIM entirely. Its private AAII source, Gold-only macro reads and
strict observed-post social path do not use seeded helpers/caches/global SIM
flags. Unconnected metrics/views show No data. The broader application's other
modules were not placed under this SENT-only policy.
