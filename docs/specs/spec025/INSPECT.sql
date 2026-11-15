-- Execute only against the explicitly approved AAII target/identity.
-- psql must run with ON_ERROR_STOP=1. Inject credentials through a secret/passfile.
-- Never place a password or full connection string in this file or a report.
-- This inspection reports evidence; it does not approve a writer as a consumer.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';

SELECT current_database() AS database_name,
       session_user AS login_role, current_user AS effective_role,
       current_setting('transaction_read_only') AS transaction_read_only,
       current_setting('transaction_isolation') AS transaction_isolation,
       current_setting('default_transaction_read_only') AS default_read_only,
       current_setting('statement_timeout') AS statement_timeout,
       current_setting('lock_timeout') AS lock_timeout,
       r.rolsuper, r.rolcreatedb, r.rolcreaterole, r.rolreplication, r.rolbypassrls
FROM pg_catalog.pg_roles r WHERE r.rolname = current_user;

SELECT n.nspname AS schema_name, c.relname, c.relkind,
       pg_catalog.pg_get_userbyid(c.relowner) AS owner,
       has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
       (has_table_privilege(current_user, c.oid,
         'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege(current_user, c.oid, 'INSERT,UPDATE,REFERENCES')) AS has_mutation_privilege
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'aaii' AND c.relname = 'aaii_gold_latest';

SELECT count(*) AS other_application_relation_privileges
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname <> 'information_schema' AND left(n.nspname,3) <> 'pg_'
  AND c.relkind IN ('r','p','v','m','f')
  AND NOT (n.nspname='aaii' AND c.relname='aaii_gold_latest')
  AND (has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'));

-- Privilege metadata only, not reads of other application relations or their data.
-- Reader admission additionally requires an approved-role/membership review.
SELECT r.rolname AS membership
FROM pg_catalog.pg_roles r
WHERE r.rolname <> session_user AND pg_has_role(session_user, r.oid, 'MEMBER');

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'aaii' AND table_name = 'aaii_gold_latest'
ORDER BY ordinal_position;

SELECT count(*) AS row_count, count(DISTINCT survey_date) AS unique_dates,
       min(survey_date) AS first_reported_date, max(survey_date) AS last_reported_date,
       count(*) FILTER (WHERE source IS DISTINCT FROM 'aaii' OR dataset IS DISTINCT FROM 'aaii-investor-sentiment') AS identity_errors,
       count(*) FILTER (WHERE (bullish BETWEEN 0 AND 1 AND neutral BETWEEN 0 AND 1 AND bearish BETWEEN 0 AND 1) IS NOT TRUE) AS share_range_errors,
       count(*) FILTER (WHERE (abs(bullish + neutral + bearish - 1) <= 0.002 + 8 * 2.220446049250313e-16) IS NOT TRUE) AS invalid_totals,
       count(*) FILTER (WHERE bull_bear_spread_pp IS NULL OR abs(bull_bear_spread_pp - (bullish - bearish) * 100) > 1e-8) AS invalid_spreads,
       count(*) FILTER (WHERE provider_published_at IS NULL) AS unknown_publications,
       count(*) FILTER (WHERE gap_days > 8) AS gaps_over_eight_days
FROM aaii.aaii_gold_latest;

-- Safe sample metadata. Validate numeric shares/lineage internally, then record
-- pass/fail counts instead of committing provider observations or raw hashes.
SELECT survey_date, previous_survey_date, gap_days,
       (provider_published_at IS NULL) AS publication_unknown,
       (version_id IS NOT NULL AND version_id <> '') AS version_present,
       (first_seen_at IS NOT NULL AND retrieved_at IS NOT NULL) AS capture_clocks_present
FROM aaii.aaii_gold_latest ORDER BY survey_date DESC LIMIT 3;
ROLLBACK;
