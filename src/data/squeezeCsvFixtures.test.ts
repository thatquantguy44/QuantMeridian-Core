import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";

const ROOT = resolve(process.cwd(), "data/synthetic/squeeze_radar/v1");

const HEADERS: Record<string, string[]> = {
  "manifest.csv": ["dataset_version", "scenario_id", "scenario_manifest_id", "scenario_manifest_version", "scenario_manifest_sha256", "seed", "generator_version", "data_mode", "base_currency", "calendar_start", "calendar_end", "generated_at", "model_input_path", "truth_path"],
  "securities.csv": ["scenario_id", "security_id", "issuer_id", "listing_id", "ticker", "security_name", "asset_type", "sector", "currency", "primary_exchange", "shares_outstanding", "float_shares", "effective_from", "effective_to", "is_active", "published_at", "observed_at", "ingested_at", "first_knowable_at", "source_id", "quality_state", "revision", "data_mode"],
  "inventory_snapshots.csv": ["scenario_id", "observation_id", "security_id", "book_id", "owner_id", "business_date", "observed_at", "ingested_at", "first_knowable_at", "gross_inventory_qty", "restricted_qty", "eligible_lendable_qty", "reserved_qty", "on_loan_qty", "available_qty", "source_id", "quality_state", "revision", "data_mode"],
  "loan_snapshots.csv": ["scenario_id", "observation_id", "loan_id", "security_id", "book_id", "owner_id", "counterparty_id", "business_date", "observed_at", "ingested_at", "first_knowable_at", "quantity", "fee_bps", "rate_currency", "rate_convention", "collateral_type", "collateral_currency", "term_type", "maturity_date", "trade_date", "settlement_date", "status", "source_id", "quality_state", "revision", "data_mode"],
  "borrow_events.csv": ["scenario_id", "event_id", "security_id", "book_id", "event_type", "event_time", "observed_at", "ingested_at", "first_knowable_at", "requested_qty", "filled_qty", "fee_bps", "reason_code", "source_id", "quality_state", "revision", "data_mode"],
  "market_borrow_snapshots.csv": ["scenario_id", "observation_id", "security_id", "business_date", "observed_at", "ingested_at", "first_knowable_at", "lendable_qty", "on_loan_qty", "available_qty", "utilization_pct", "current_fee_bps", "new_loan_fee_bps", "demand_qty", "supply_change_1d_qty", "loan_change_1d_qty", "contributor_count", "methodology_version", "source_id", "quality_state", "revision", "data_mode"],
  "short_interest.csv": ["scenario_id", "report_id", "security_id", "short_interest_kind", "position_qty", "float_shares", "short_interest_pct", "settlement_date", "published_at", "observed_at", "ingested_at", "first_knowable_at", "basis", "methodology_version", "source_id", "revision", "data_mode"],
  "short_sale_volume.csv": ["scenario_id", "observation_id", "security_id", "trade_date", "published_at", "observed_at", "ingested_at", "first_knowable_at", "short_volume_qty", "short_exempt_volume_qty", "total_reported_volume_qty", "venue_scope", "source_id", "revision", "data_mode"],
  "equity_market_daily.csv": ["scenario_id", "observation_id", "security_id", "trade_date", "published_at", "observed_at", "ingested_at", "first_knowable_at", "open_price", "high_price", "low_price", "close_price", "adjusted_close_price", "volume_qty", "adv20_qty", "realized_vol_20d_pct", "market_cap_usd", "float_shares", "halt_status", "source_id", "quality_state", "revision", "data_mode"],
  "options_snapshots.csv": ["scenario_id", "observation_id", "security_id", "business_date", "observed_at", "ingested_at", "first_knowable_at", "put_volume_qty", "call_volume_qty", "put_call_ratio", "total_open_interest_qty", "open_interest_change_5d_pct", "iv30_pct", "iv_rank_1y_pct", "skew_25d_vol_points", "source_id", "quality_state", "revision", "data_mode"],
  "etf_snapshots.csv": ["scenario_id", "observation_id", "security_id", "business_date", "observed_at", "ingested_at", "first_knowable_at", "aum_usd", "net_flow_1d_usd", "net_flow_5d_usd", "flow_pct_aum", "holdings_count", "estimated_discount_bps", "source_id", "quality_state", "revision", "data_mode"],
  "security_events.csv": ["scenario_id", "event_id", "security_id", "issuer_id", "event_type", "event_time", "published_at", "observed_at", "ingested_at", "first_knowable_at", "event_importance", "description", "source_id", "revision", "data_mode"],
  "_truth/truth_events.csv": ["scenario_id", "truth_event_id", "security_id", "event_type", "start_time", "end_time", "outcome_horizon_days", "outcome_label", "causal_driver", "notes", "data_mode"],
  "data_dictionary.csv": ["dataset", "column_name", "data_type", "required", "unit", "description", "allowed_values", "live_replacement_source"],
};

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (quoted) throw new Error("unclosed quoted field");
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  const [headers, ...body] = rows.filter((candidate) => candidate.some((value) => value !== ""));
  return body.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function load(relativePath: string): { header: string[]; rows: Record<string, string>[] } {
  const text = readFileSync(resolve(ROOT, relativePath), "utf8").replace(/^\uFEFF/, "");
  return { header: text.split(/\r?\n/, 1)[0].split(","), rows: parseCsv(text) };
}

describe("Squeeze Radar CSV contract fixtures", () => {
  beforeAll(() => {
    execFileSync(process.execPath, [resolve(process.cwd(), "scripts/generate-squeeze-radar-csv.mjs")]);
  });

  test("stores generated fixtures under the ignored synthetic-data tree", () => {
    const gitignore = readFileSync(resolve(process.cwd(), ".gitignore"), "utf8");
    expect(gitignore).toMatch(/^\/data\/synthetic\/$/m);
    expect(existsSync(resolve(process.cwd(), "contracts/squeeze_radar/v1/manifest.csv"))).toBe(false);
  });

  test("publish every documented v1 file with exact headers", () => {
    for (const [file, expected] of Object.entries(HEADERS)) {
      expect(load(file).header, file).toEqual(expected);
    }
  });

  test("uses a reproducible fictional SIM universe with enough history", () => {
    const manifest = load("manifest.csv").rows[0];
    expect(manifest).toMatchObject({
      dataset_version: "1.1",
      scenario_id: "sqz_base_v1",
      scenario_manifest_id: "sqz-base",
      scenario_manifest_version: "1.0.0",
      seed: "21021",
      data_mode: "SIM",
    });
    expect(manifest.scenario_manifest_sha256).toMatch(/^[a-f0-9]{64}$/);

    const securities = load("securities.csv").rows;
    expect(securities.length).toBeGreaterThanOrEqual(6);
    expect(securities.every((row) => row.data_mode === "SIM" && row.security_name.includes("Synthetic"))).toBe(true);
    expect(new Set(securities.map((row) => row.security_id)).size).toBe(securities.length);
    expect(securities.some((row) => row.asset_type === "ETF")).toBe(true);

    const market = load("equity_market_daily.csv").rows;
    const datesBySecurity = new Map<string, Set<string>>();
    for (const row of market) {
      const dates = datesBySecurity.get(row.security_id) ?? new Set<string>();
      dates.add(row.trade_date);
      datesBySecurity.set(row.security_id, dates);
    }
    expect([...datesBySecurity.values()].every((dates) => dates.size >= 20)).toBe(true);
  });

  test("reconciles inventory and market-borrow quantities", () => {
    for (const row of load("inventory_snapshots.csv").rows) {
      expect(Number(row.gross_inventory_qty) - Number(row.restricted_qty)).toBe(Number(row.eligible_lendable_qty));
      expect(Number(row.eligible_lendable_qty) - Number(row.reserved_qty) - Number(row.on_loan_qty)).toBe(Number(row.available_qty));
    }
    for (const row of load("market_borrow_snapshots.csv").rows) {
      expect(Number(row.lendable_qty) - Number(row.on_loan_qty)).toBe(Number(row.available_qty));
      expect(Number(row.utilization_pct)).toBeCloseTo(100 * Number(row.on_loan_qty) / Number(row.lendable_qty), 4);
    }
  });

  test("preserves point-in-time clock order and SIM provenance", () => {
    for (const file of Object.keys(HEADERS).filter((candidate) => candidate !== "data_dictionary.csv")) {
      for (const row of load(file).rows) {
        expect(row.data_mode, file).toBe("SIM");
        if (row.observed_at && row.ingested_at) {
          expect(Date.parse(row.ingested_at), `${file} observed -> ingested`).toBeGreaterThanOrEqual(Date.parse(row.observed_at));
        }
        if (row.ingested_at && row.first_knowable_at) {
          expect(Date.parse(row.first_knowable_at), `${file} ingested -> knowable`).toBeGreaterThanOrEqual(Date.parse(row.ingested_at));
        }
        if (row.published_at && row.first_knowable_at) {
          expect(Date.parse(row.first_knowable_at), `${file} published -> knowable`).toBeGreaterThanOrEqual(Date.parse(row.published_at));
        }
      }
    }
  });

  test("keeps positioning types and the hidden truth ledger separate", () => {
    const shortInterest = load("short_interest.csv").rows;
    expect(new Set(shortInterest.map((row) => row.short_interest_kind))).toEqual(new Set(["OFFICIAL", "ESTIMATED"]));
    for (const row of shortInterest) {
      expect(Number(row.short_interest_pct)).toBeCloseTo(100 * Number(row.position_qty) / Number(row.float_shares), 4);
      expect(Date.parse(row.first_knowable_at)).toBeGreaterThanOrEqual(Date.parse(row.published_at));
    }
    const modelFiles = Object.keys(HEADERS).filter((file) => !file.startsWith("_truth/") && !["manifest.csv", "data_dictionary.csv"].includes(file));
    expect(modelFiles.every((file) => !load(file).header.some((field) => field.startsWith("truth_")))).toBe(true);
    expect(load("_truth/truth_events.csv").rows.length).toBeGreaterThan(0);
  });

  test("documents every published field exactly once", () => {
    const dictionary = load("data_dictionary.csv").rows;
    const documented = new Set(dictionary.map((row) => `${row.dataset}.${row.column_name}`));
    expect(documented.size).toBe(dictionary.length);
    for (const [file, headers] of Object.entries(HEADERS)) {
      if (file === "data_dictionary.csv") continue;
      for (const header of headers) expect(documented.has(`${file}.${header}`), `${file}.${header}`).toBe(true);
    }
  });
});
