-- REFERENCE: owner approved and local provisioning executed 2026-10-31.
-- Not idempotent: do not rerun against the existing reader. Credentials are private.
-- Run only on the confirmed local additional_market_data development database.
-- Configure the password through the approved secret mechanism, outside this file.
-- Never reuse market_data/aaii_writer or the macro_medallion administrative account.
-- Provisioning changed only the approved reader role/grants/settings, not survey rows.
BEGIN;
CREATE ROLE quantmeridian_aaii_reader LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
GRANT CONNECT ON DATABASE additional_market_data TO quantmeridian_aaii_reader;
GRANT USAGE ON SCHEMA aaii TO quantmeridian_aaii_reader;
GRANT SELECT ON TABLE aaii.aaii_gold_latest TO quantmeridian_aaii_reader;
ALTER ROLE quantmeridian_aaii_reader SET default_transaction_read_only = on;
ALTER ROLE quantmeridian_aaii_reader SET statement_timeout = '5s';
ALTER ROLE quantmeridian_aaii_reader SET lock_timeout = '1s';
COMMIT;

-- Before use, DBA must inspect inherited/PUBLIC and other-schema/function grants,
-- ownership, role membership and pg_hba/TLS policy. This script alone does not
-- revoke global defaults, establish entitlement, set a password or activate SENT.
-- Inject a dedicated approved reader connection reference into the server only.
