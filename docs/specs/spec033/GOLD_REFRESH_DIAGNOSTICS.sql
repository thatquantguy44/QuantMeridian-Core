-- Read-only PostgreSQL checks. Bind $1 to the series IDs (text[]) and $2 to
-- the explicit America/New_York as-of calendar date (YYYY-MM-DD).
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '60s';

-- Schema inventory: a missing column is unavailable, not a default value.
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='gold' AND table_name='benchmark_rate_board' ORDER BY ordinal_position;

WITH selected AS (SELECT UNNEST($1::text[]) AS series_id),
gold_summary AS (
  SELECT series_id,
    MAX(observation_date) FILTER (WHERE observation_date <= $2 AND value IS NOT NULL) AS latest_asof,
    COUNT(*) FILTER (WHERE observation_date > $2 AND value IS NOT NULL) AS future_rows
  FROM gold.fred_latest_observation WHERE series_id=ANY($1::text[]) GROUP BY series_id
), source_summary AS (
  SELECT series_id,
    MAX(observation_date) FILTER (WHERE observation_date <= $2 AND value IS NOT NULL AND (realtime_start IS NULL OR realtime_start='' OR realtime_start <= $2)) AS latest_asof,
    COUNT(DISTINCT observation_date) FILTER (WHERE observation_date > $2 AND value IS NOT NULL) AS future_dates
  FROM silver.fred_observation WHERE source='fred' AND series_id=ANY($1::text[]) GROUP BY series_id
)
SELECT selected.series_id, gold_summary.latest_asof AS gold_latest_asof,
  source_summary.latest_asof AS source_latest_asof, gold_summary.future_rows AS gold_future_rows,
  source_summary.future_dates AS source_future_dates, board.latest_date AS board_date, board.latest_value AS board_value,
  to_jsonb(board)->>'as_of_date' AS board_as_of_date,
  to_jsonb(board)->>'source' AS board_source,
  to_jsonb(board)->>'latest_revision_start' AS board_latest_revision_start,
  to_jsonb(board)->>'latest_ingested_at' AS board_latest_ingested_at,
  to_jsonb(board)->>'history_unknown_vintage_count' AS board_history_unknown_vintage_count
FROM selected LEFT JOIN gold_summary USING(series_id) LEFT JOIN source_summary USING(series_id)
LEFT JOIN gold.benchmark_rate_board board USING(series_id) ORDER BY selected.series_id;

-- Grain is (source, series, observation date, real-time start); a later
-- revision is not an independent observation date. Raw rows need evidence.
SELECT series_id, observation_date, realtime_start, realtime_end, value, raw_value, is_missing, run_id, ingested_at
FROM silver.fred_observation WHERE source='fred' AND series_id=ANY($1::text[])
  AND observation_date > $2 ORDER BY series_id, observation_date, realtime_start;

-- Receipt metadata and lineage only; this does not re-validate payload contents.
SELECT series_id, run_id, endpoint, observation_count, payload_bytes, ingested_at
FROM bronze.fred_api_response WHERE source='fred' AND series_id=ANY($1::text[]) ORDER BY ingested_at DESC;

-- Audit status is historical metadata and does not prove a process is active.
SELECT status, started_at, ended_at, triggered_by FROM audit.etl_run
WHERE lower(status) IN ('running', 'started', 'in_progress') ORDER BY started_at DESC;

-- No query text, credentials or session termination; visibility may be limited.
SELECT application_name, state, backend_type, xact_start, query_start FROM pg_stat_activity
WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend';
ROLLBACK;
