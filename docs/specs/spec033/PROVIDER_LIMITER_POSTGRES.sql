-- Provision only in a dedicated application-control PostgreSQL database.
-- Do not point this at the EcoMedallion warehouse. The runtime does no DDL.
CREATE SCHEMA IF NOT EXISTS benchmark_provider_control;
CREATE TABLE IF NOT EXISTS benchmark_provider_control.request_gate (
  limiter_key TEXT PRIMARY KEY CHECK (limiter_key = 'fred:benchmark-latest'),
  available_at TIMESTAMPTZ NOT NULL
);
-- Grant the application role USAGE on this schema and SELECT, INSERT and UPDATE
-- on this table using your deployment's role management. No DELETE is required.
