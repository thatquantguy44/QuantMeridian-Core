-- Read-only checks for the 2026-10-30 New York / 2026-10-31 UTC refresh.
-- Scope comes from the persisted run, including its two failed rate entries.
-- Run after Gold publication. These are diagnostics, not a freshness policy
-- or historical point-in-time certification. See FX_DATA_REFRESH.md.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '60000ms';

SELECT run_id, status, started_at, ended_at, series_total,
       series_succeeded, series_failed, series_skipped_not_due
FROM audit.etl_run
WHERE run_id = 'b4502d16295445cf901610cb2b3855fb';

SELECT series_id, status, observations_extracted, dq_passed
FROM audit.etl_series_run
WHERE run_id = 'b4502d16295445cf901610cb2b3855fb'
ORDER BY series_id;

WITH wanted AS (
    SELECT DISTINCT series_id FROM audit.etl_series_run
    WHERE run_id = 'b4502d16295445cf901610cb2b3855fb'
)
SELECT w.series_id, count(g.observation_date) AS history_rows,
       min(g.observation_date) FILTER (WHERE g.is_missing = 0 AND g.value IS NOT NULL) AS first_valid,
       max(g.observation_date) FILTER (WHERE g.is_missing = 0 AND g.value IS NOT NULL) AS latest_valid,
       count(*) FILTER (WHERE (g.value IS NULL AND g.observation_date IS NOT NULL) OR g.is_missing = 1) AS missing_rows,
       count(*) FILTER (WHERE g.value::text IN ('NaN', 'Infinity', '-Infinity')) AS nonfinite_values,
       count(*) FILTER (WHERE w.series_id ~ '^(DEX|DTWEX|ECB:EXR:)' AND g.is_missing = 0 AND g.value <= 0) AS nonpositive_fx,
       count(*) FILTER (WHERE g.observation_date > ((now() AT TIME ZONE 'UTC')::date)::text) AS future_observation_rows,
       count(*) FILTER (WHERE g.observation_date IS NOT NULL AND (g.ingested_at IS NULL OR g.ingested_at = '')) AS missing_ingested
FROM wanted w LEFT JOIN gold.fred_latest_observation g USING (series_id)
GROUP BY w.series_id ORDER BY w.series_id;

WITH wanted AS (
    SELECT DISTINCT series_id FROM audit.etl_series_run
    WHERE run_id = 'b4502d16295445cf901610cb2b3855fb'
)
SELECT g.series_id, g.observation_date, count(*) AS rows
FROM gold.fred_latest_observation g JOIN wanted USING (series_id)
GROUP BY g.series_id, g.observation_date HAVING count(*) > 1;

-- Mirror the current pipeline's canonical latest-revision ordering.
-- Comparison includes missing markers and interval/ingestion evidence.
WITH wanted AS (
    SELECT DISTINCT series_id FROM audit.etl_series_run
    WHERE run_id = 'b4502d16295445cf901610cb2b3855fb'
), ranked AS (
    SELECT s.*, row_number() OVER (
        PARTITION BY s.series_id, s.observation_date
        ORDER BY coalesce(s.realtime_start, '') DESC, s.ctid DESC
    ) AS rn
    FROM silver.fred_observation s JOIN wanted USING (series_id)
), expected AS (
    SELECT series_id, observation_date, value, realtime_start, realtime_end,
           is_missing, revision_number, ingested_at
    FROM ranked WHERE rn = 1
), actual AS (
    SELECT g.series_id, g.observation_date, g.value, g.realtime_start,
           g.realtime_end, g.is_missing, g.revision_number, g.ingested_at
    FROM gold.fred_latest_observation g JOIN wanted USING (series_id)
), missing_or_different AS (
    SELECT * FROM expected EXCEPT ALL SELECT * FROM actual
), unexpected AS (
    SELECT * FROM actual EXCEPT ALL SELECT * FROM expected
)
SELECT 'expected_not_in_gold' AS mismatch, count(*) AS rows FROM missing_or_different
UNION ALL
SELECT 'gold_not_in_expected', count(*) FROM unexpected;

-- Stored observations and inclusion in the curated discovery catalog differ.
-- Missing catalog rows require metadata qualification before module admission.
SELECT s.series_id
FROM audit.etl_series_run s
LEFT JOIN gold.dim_series d USING (series_id)
WHERE s.run_id = 'b4502d16295445cf901610cb2b3855fb'
  AND s.series_id ~ '^(DEX|DTWEX|ECB:EXR:)'
  AND d.series_id IS NULL
ORDER BY s.series_id;

SELECT max_ingested_at FROM gold.build_watermark;
ROLLBACK;
