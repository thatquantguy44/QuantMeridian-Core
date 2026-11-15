import { createRequire } from "node:module";
import { benchmarkAsOfDate } from "@/lib/benchmarkAsOf";
import { PORA_ASSETS, PoraEvidenceError, verifyMultiAssetEvidence, type MultiAssetEvidence, type MultiAssetPreview, type PoraAsset } from "./multiAssetEvidence";
import { createSourceSnapshot } from "./snapshotBuilder";
import { readCatalogReferences } from "./catalogReferenceReader";
import type { CatalogReference } from "@/lib/portfolioRegime/catalogReference";

const requireFromRuntime = createRequire(import.meta.url);
const SESSIONS = 253;
interface QueryResult { rows: any[] }
interface ReadClient { connect(): Promise<void>; query(sql: string, params?: unknown[]): Promise<QueryResult>; end(): Promise<void> }
type ClientFactory = (options: object) => ReadClient;

interface Capture { preview: MultiAssetPreview; evidence: MultiAssetEvidence; startedAt: string; catalog: Map<PoraAsset, CatalogReference> | null }

/** One bounded, read-only repeatable-read capture; it never changes the warehouse. */
async function readCapture(ids: PoraAsset[], factory?: ClientFactory, withCatalog = false): Promise<Capture> {
  if (ids.length < 2 || ids.length > 4 || new Set(ids).size !== ids.length || ids.some((id) => !PORA_ASSETS.includes(id))) throw new PoraEvidenceError("Select two to four distinct supported assets.");
  const connectionString = (process.env.MACRO_DB_URL ?? "").trim();
  if (!/^postgres(?:ql)?:\/\//i.test(connectionString) || (process.env.MACRO_DB_BACKEND && process.env.MACRO_DB_BACKEND !== "postgres")) throw new PoraEvidenceError("The PostgreSQL warehouse is not configured for this source check.");
  const create = factory ?? ((options: object) => {
    const pg = requireFromRuntime("pg") as { Client: new (options: object) => ReadClient };
    return new pg.Client(options);
  });
  const client = create({ connectionString, connectionTimeoutMillis: 4000, query_timeout: 15000, statement_timeout: 15000, options: "-c default_transaction_read_only=on" });
  let transaction = false;
  const startedAt = new Date().toISOString();
  try {
    await client.connect();
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY"); transaction = true;
    const asOfDate = benchmarkAsOfDate(new Date());
    const latest = (await client.query(`SELECT ticker,
      MAX(observation_date) FILTER (WHERE observation_date <= $2) AS "latestDate",
      COUNT(*) FILTER (WHERE observation_date > $2)::int AS "futureCount",
      COUNT(*) FILTER (WHERE CASE WHEN observation_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN to_char(to_date(observation_date, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> observation_date ELSE true END)::int AS "invalidDateCount"
      FROM gold.equity_total_return_index WHERE ticker = ANY($1::text[]) GROUP BY ticker ORDER BY ticker`, [ids, asOfDate])).rows;
    if (latest.length !== ids.length || latest.some((row) => typeof row.latestDate !== "string" || row.invalidDateCount !== 0)) throw new PoraEvidenceError("A selected asset has no retained observation on or before the as-of date.");
    const anchor = latest.map((row) => row.latestDate as string).sort()[0];
    const calendar = (await client.query(`SELECT calendar_date AS date FROM gold.market_calendar
      WHERE calendar_name = 'NYSE' AND is_business_day = 1 AND calendar_date <= $1 ORDER BY calendar_date DESC LIMIT $2`, [anchor, SESSIONS])).rows;
    if (calendar.length !== SESSIONS) throw new PoraEvidenceError("The exchange calendar does not contain the required 253 sessions.");
    const dates = calendar.map((row) => row.date as string).reverse();
    const series = ids.flatMap((id) => [`${id}:close`, `${id}:divCash`, `${id}:splitFactor`]);
    const offCalendar = (await client.query(`SELECT ticker FROM gold.equity_total_return_index
      WHERE ticker = ANY($1::text[]) AND observation_date BETWEEN $2 AND $3 AND NOT (observation_date = ANY($4::text[]))
      UNION ALL SELECT split_part(series_id, ':', 1) AS ticker FROM silver.fred_observation
      WHERE source = 'tiingo' AND series_id = ANY($5::text[]) AND observation_date BETWEEN $2 AND $3 AND NOT (observation_date = ANY($4::text[])) LIMIT 1`, [ids, dates[0], anchor, dates, series])).rows;
    if (offCalendar.length) throw new PoraEvidenceError("A retained Gold or Tiingo record falls outside the warehouse NYSE calendar in the selected window.");
    const gold = (await client.query(`SELECT ticker, observation_date AS date, close, dividend, split_factor AS split, total_return_index AS index
      FROM gold.equity_total_return_index WHERE ticker = ANY($1::text[]) AND observation_date = ANY($2::text[]) ORDER BY ticker, observation_date LIMIT $3`, [ids, dates, ids.length * SESSIONS + 1])).rows;
    const silver = (await client.query(`SELECT source, series_id AS "seriesId", observation_date AS date, value, raw_value AS "rawValue", is_missing AS missing,
      row_hash AS hash, run_id AS "runId", ingested_at AS "ingestedAt" FROM silver.fred_observation
      WHERE source = 'tiingo' AND series_id = ANY($1::text[]) AND observation_date = ANY($2::text[]) ORDER BY series_id, observation_date LIMIT $3`, [series, dates, ids.length * 3 * SESSIONS + 1])).rows;
    const runIds = [...new Set(silver.map((row) => row.runId).filter((run): run is string => typeof run === "string" && !!run))];
    if (runIds.length > ids.length * 3 * SESSIONS) throw new PoraEvidenceError("Source evidence exceeds the supported query limit.");
    const receipts = runIds.length ? (await client.query(`WITH bounded AS (
      SELECT series_id AS ticker, source, endpoint, run_id AS "runId", response_payload AS payload, ingested_at AS "ingestedAt",
        SUM(LENGTH(response_payload)) OVER (ORDER BY series_id, run_id) AS total_chars
      FROM bronze.fred_api_response WHERE source = 'tiingo' AND series_id = ANY($1::text[]) AND run_id = ANY($2::text[])
        AND LENGTH(response_payload) <= 4000000
    ) SELECT ticker, source, endpoint, "runId", payload, "ingestedAt" FROM bounded WHERE total_chars <= 16000000`, [ids, runIds])).rows : [];
    const catalog = withCatalog ? await readCatalogReferences(client, ids) : null;
    const readCompletedAt = new Date().toISOString();
    const evidence = { asOfDate, checkedAt: readCompletedAt, dates, latest, gold, silver, receipts } as MultiAssetEvidence;
    const preview = verifyMultiAssetEvidence(evidence, ids);
    await client.query("COMMIT"); transaction = false;
    const checkedAt = new Date().toISOString();
    if (benchmarkAsOfDate(new Date(checkedAt)) !== asOfDate || benchmarkAsOfDate(new Date(startedAt)) !== asOfDate) throw new PoraEvidenceError("The New York as-of date changed during the check; retry it.");
    return { preview: { ...preview, checkedAt }, evidence: { ...evidence, checkedAt }, startedAt, catalog };
  } finally {
    if (transaction) await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}

export async function readMultiAssetPreview(ids: PoraAsset[], factory?: ClientFactory): Promise<MultiAssetPreview> {
  return (await readCapture(ids, factory)).preview;
}

/** Explicitly recheck and freeze a single capture; never write a snapshot to the warehouse. */
export async function readMultiAssetSnapshot(ids: PoraAsset[], factory?: ClientFactory) {
  const capture = await readCapture(ids, factory, true);
  if (!capture.catalog) throw new PoraEvidenceError("Catalog evidence could not be captured.");
  return { preview: capture.preview, snapshot: createSourceSnapshot(capture.evidence, ids, capture.startedAt, capture.catalog) };
}
