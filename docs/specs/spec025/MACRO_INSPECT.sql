-- Execute against the existing, authorized macro_medallion configuration only.
-- Inject credentials privately; use ON_ERROR_STOP=1. No values/secrets in reports.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='12s';
SET LOCAL lock_timeout='1s';

SELECT current_database() AS database_name,
       current_setting('transaction_read_only') AS transaction_read_only;

-- Dedicated relation names outside the generic series store, if present.
SELECT n.nspname AS schema_name,c.relname,c.relkind
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname<>'information_schema' AND left(n.nspname,3)<>'pg_'
  AND c.relkind IN ('r','v','m','p')
  AND c.relname ~* 'naaim|sentiment|fear|put.?call|breadth|advanc|declin'
ORDER BY 1,2 LIMIT 100;

SELECT series_id,title,source,frequency,units
FROM gold.dim_series
WHERE series_id IN ('VIXCLS','BAMLH0A0HYM2','BAMLC0A0CM','DGS10','DGS2','DGS3MO','T10Y2Y','SP500','NASDAQCOM','DJIA')
   OR concat_ws(' ',series_id,title,notes) ~* 'naaim|fear.{0,8}greed|put.{0,5}call|call.{0,5}put|advanc.*declin|declin.*advanc|market breadth|advancing issues|declining issues'
ORDER BY series_id LIMIT 100;

-- Check grain, coverage and declared missingness before catalog joins.
SELECT series_id,count(*) AS row_count,count(DISTINCT observation_date) AS unique_dates,
       min(observation_date) AS first_date,max(observation_date) AS last_date,
       count(*) FILTER(WHERE is_missing=1) AS marked_missing,
       count(*) FILTER(WHERE is_missing=0 AND value IS NULL) AS unmarked_nulls,
       count(*) FILTER(WHERE is_missing NOT IN (0,1) OR is_missing IS NULL) AS invalid_missing_flags
FROM gold.fred_latest_observation
WHERE series_id IN ('VIXCLS','BAMLH0A0HYM2','BAMLC0A0CM','DGS10','DGS2','DGS3MO','T10Y2Y','SP500','NASDAQCOM','DJIA')
GROUP BY series_id ORDER BY series_id;

-- Catalog joins must be one-to-one; unregistered observations stay unadmitted.
SELECT series_id,count(*) AS catalog_rows
FROM gold.dim_series
WHERE series_id IN ('VIXCLS','BAMLH0A0HYM2','BAMLC0A0CM','DGS10','DGS2','DGS3MO','T10Y2Y','SP500','NASDAQCOM','DJIA')
GROUP BY series_id ORDER BY series_id;
ROLLBACK;
