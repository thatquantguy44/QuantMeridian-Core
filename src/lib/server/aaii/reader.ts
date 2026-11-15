import { createRequire } from "node:module";
import { normalizeAaiiRows } from "@/lib/aaii/normalize";
import { assertAaiiReaderAdmission } from "./admission";

export interface AaiiClient {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
}
const role = "quantmeridian_aaii_reader";
const requireFromRuntime = createRequire(import.meta.url);

/** Local/private admission only. URL options cannot override the inspected target. */
export function localAaiiConfigured(): boolean {
  if (process.env.AAII_RESEARCH_LOCAL_ENABLED !== "1" || process.env.NODE_ENV === "production" ||
      process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AAII_POSTGRES_EXPECTED_ROLE !== role) return false;
  try {
    const url = new URL(process.env.AAII_POSTGRES_URL ?? "");
    return ["postgres:", "postgresql:"].includes(url.protocol) && url.hostname === "127.0.0.1" &&
      url.port === "55438" && url.pathname === "/additional_market_data" &&
      decodeURIComponent(url.username) === role && !!url.password && !url.search && !url.hash;
  } catch { return false; }
}

// Affirm privilege evidence before touching survey values, on every transaction.
const admissionSql = `SELECT
  current_setting('transaction_read_only')='on' AS "transactionReadOnly",
  has_table_privilege(current_user,'aaii.aaii_gold_latest','SELECT') AS "canSelectGold",
  (current_user=$1 AND session_user=$1 AND current_database()='additional_market_data') AS "roleMatchesApprovedReader",
  (SELECT pg_get_userbyid(c.relowner)=current_user FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='aaii' AND c.relname='aaii_gold_latest') AS "ownsGold",
  (has_table_privilege(current_user,'aaii.aaii_gold_latest','INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege(current_user,'aaii.aaii_gold_latest','INSERT,UPDATE,REFERENCES')) AS "hasGoldWritePrivileges",
  r.rolsuper AS "isSuperuser", r.rolcreatedb AS "canCreateDatabases", r.rolcreaterole AS "canCreateRoles",
  r.rolreplication AS "canReplicate", r.rolbypassrls AS "bypassesRls",
  EXISTS (SELECT 1 FROM pg_roles m WHERE m.rolname<>session_user AND pg_has_role(session_user,m.oid,'MEMBER')) AS "hasUnapprovedRoleMembership",
  EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname<>'information_schema' AND left(n.nspname,3)<>'pg_' AND c.relkind IN ('r','p','v','m','f')
    AND NOT(n.nspname='aaii' AND c.relname='aaii_gold_latest')
    AND (has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) AS "hasOtherApplicationRelationPrivileges",
  (NOT r.rolinherit AND current_setting('default_transaction_read_only')='on'
    AND current_setting('statement_timeout')='5s' AND current_setting('lock_timeout')='1s'
    AND NOT has_database_privilege(current_user,current_database(),'CREATE')
    AND NOT has_schema_privilege(current_user,'aaii','CREATE')
    AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname<>'information_schema' AND left(n.nspname,3)<>'pg_'
      AND p.prosecdef AND has_function_privilege(current_user,p.oid,'EXECUTE'))) AS "scopeRestricted"
  FROM pg_roles r WHERE r.rolname=current_user`;

const historySql = `SELECT source,dataset,survey_date,bullish,neutral,bearish,bull_bear_spread_pp,
  previous_survey_date,gap_days,spread_change_pp,version_id,previous_version_id,first_seen_at,
  retrieved_at,provider_published_at,content_hash,raw_run_id,raw_sha256,parser_version
  FROM aaii.aaii_gold_latest ORDER BY survey_date DESC NULLS FIRST LIMIT 104`;

export async function readAaiiSelection(client: AaiiClient, now = () => new Date().toISOString()) {
  let connected = false;
  let code = "SOURCE_UNAVAILABLE";
  try {
    await client.connect(); connected = true;
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout='5s'");
    await client.query("SET LOCAL lock_timeout='1s'");
    await client.query("SET LOCAL search_path=pg_catalog");
    const { rows: [evidence] } = await client.query(admissionSql, [role]);
    code = "READER_NOT_ADMITTED";
    assertAaiiReaderAdmission(evidence);
    if ((evidence as unknown as { scopeRestricted?: unknown }).scopeRestricted !== true) throw new Error(code);
    code = "SOURCE_UNAVAILABLE";
    const { rows } = await client.query(historySql);
    code = "INTEGRITY_FAILURE";
    return normalizeAaiiRows(rows, now());
  } catch { throw new Error(code); }
  finally {
    if (connected) await client.query("ROLLBACK").catch(() => {});
    await client.end().catch(() => {});
  }
}

let active: ReturnType<typeof capture> | undefined;
async function capture() {
  const pg = requireFromRuntime("pg") as { Client: new (options: Record<string, unknown>) => AaiiClient };
  const readStartedAt = new Date().toISOString();
  const client = new pg.Client({ connectionString: process.env.AAII_POSTGRES_URL,
    connectionTimeoutMillis: 4000, query_timeout: 6000, application_name: "quantmeridian-aaii-private-research" });
  const selection = await readAaiiSelection(client);
  return { selection, readStartedAt, readCompletedAt: new Date().toISOString() };
}
export function readLocalAaii() {
  if (!localAaiiConfigured()) throw new Error("LOCAL_NOT_CONFIGURED");
  // Coalesce concurrent local reads only; never cache a previous survey selection.
  if (!active) active = capture().finally(() => { active = undefined; });
  return active;
}
