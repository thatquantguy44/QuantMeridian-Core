import { mkdir, realpath, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  DEFAULT_SCENARIO_MANIFEST_PATH,
  GENERATOR_VERSION,
  applyScenarioFaults,
  loadScenarioConfiguration,
  namedPhase,
  regimeEffects,
  scheduledTimestamps,
} from "./lib/squeeze-radar-scenario.mjs";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_OUTPUT_DIR = resolve(SCRIPT_DIR, "../data/synthetic/squeeze_radar/v1");
const CONTRACT_SCHEMA_PATH = resolve(SCRIPT_DIR, "../contracts/squeeze_radar/v1/csv-records-1.1.schema.json");

export const DEFAULT_SYNTHETIC_GENERATOR_OPTIONS = Object.freeze({
  outputDir: DEFAULT_OUTPUT_DIR,
  manifestPath: DEFAULT_SCENARIO_MANIFEST_PATH,
  writeContracts: false,
});

const DATASETS = {
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
};

const DATASET_SCHEMA_NAMES = {
  "manifest.csv": "ManifestRecord",
  "securities.csv": "SecurityRecord",
  "inventory_snapshots.csv": "InventorySnapshotRecord",
  "loan_snapshots.csv": "LoanSnapshotRecord",
  "borrow_events.csv": "BorrowEventRecord",
  "market_borrow_snapshots.csv": "MarketBorrowSnapshotRecord",
  "short_interest.csv": "ShortInterestRecord",
  "short_sale_volume.csv": "ShortSaleVolumeRecord",
  "equity_market_daily.csv": "EquityMarketDailyRecord",
  "options_snapshots.csv": "OptionsSnapshotRecord",
  "etf_snapshots.csv": "EtfSnapshotRecord",
  "security_events.csv": "SecurityEventRecord",
  "_truth/truth_events.csv": "TruthEventRecord",
};

const DATA_DICTIONARY_HEADERS = ["dataset", "column_name", "data_type", "required", "unit", "description", "allowed_values", "live_replacement_source"];

function businessDates(start, count) {
  const dates = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  while (dates.length < count) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function addBusinessDays(start, count) {
  const cursor = new Date(`${start}T00:00:00Z`);
  const wholeWeeks = Math.floor(count / 5);
  cursor.setUTCDate(cursor.getUTCDate() + wholeWeeks * 7);
  if (Number.isNaN(cursor.getTime())) throw new Error("publication delay exceeds the supported calendar range");
  let remaining = count % 5;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) remaining -= 1;
  }
  return cursor.toISOString().slice(0, 10);
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return `${[headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function runtimeSecurity(security) {
  return {
    securityId: security.security_id,
    issuerId: security.issuer_id,
    listingId: security.listing_id,
    ticker: security.ticker,
    name: security.security_name,
    assetType: security.asset_type,
    sector: security.sector,
    shares: security.shares_outstanding,
    float: security.float_shares,
    price: security.initial_price,
    volume: security.initial_volume_qty,
    lendable: security.initial_lendable_qty,
    util: security.initial_utilization_pct,
    fee: security.initial_fee_bps,
    inventory: security.initial_inventory_qty,
  };
}

function priceFor(security, index, phase, effects) {
  return Math.max(2, security.price * (1 + effects.priceChangePct / 100 + 0.018 * Math.sin(index * 0.73 + phase)));
}

function utilizationFor(security, index, phase, effects) {
  return Math.min(98, Math.max(5, security.util + effects.utilizationPoints + 1.8 * Math.sin(index * 0.41 + phase)));
}

function feeFor(security, index, utilization, effects) {
  const scarcity = Math.max(0, utilization - 70);
  return Math.max(5, security.fee * (1 + 0.006 * index) + scarcity ** 2 * 1.8 + effects.feeChangeBps);
}

function buildRows(manifest, scenarioManifestSha256) {
  const scenarioId = manifest.scenario_id;
  const dates = businessDates(manifest.calendar.start_date, manifest.calendar.business_day_count);
  const rows = Object.fromEntries(Object.keys(DATASETS).map((name) => [name, []]));
  rows["manifest.csv"].push(["1.1", scenarioId, manifest.manifest_id, manifest.manifest_version, scenarioManifestSha256, manifest.seed, GENERATOR_VERSION, "SIM", manifest.base_currency, dates[0], dates.at(-1), manifest.generated_at, ".", "_truth/truth_events.csv"]);
  for (const sourceSecurity of manifest.fictional_universe.securities) {
    const security = runtimeSecurity(sourceSecurity);
    const identityObserved = `${dates[0]}T00:00:00Z`;
    rows["securities.csv"].push([scenarioId, security.securityId, security.issuerId, security.listingId, security.ticker, security.name, security.assetType, security.sector, manifest.base_currency, "XNAS", security.shares, security.float, dates[0], "", true, identityObserved, identityObserved, identityObserved, identityObserved, "SIM_SECURITY_MASTER", "VALID", 1, "SIM"]);
    const equityPhase = namedPhase(manifest, "equity", security.securityId);
    const borrowPhase = namedPhase(manifest, "market_borrow", security.securityId);
    const inventoryPhase = namedPhase(manifest, "inventory", security.securityId);
    const shortInterestPhase = namedPhase(manifest, "short_interest", security.securityId);
    const shortVolumePhase = namedPhase(manifest, "short_volume", security.securityId);
    const optionsPhase = namedPhase(manifest, "options", security.securityId);
    const etfPhase = namedPhase(manifest, "etf", security.securityId);
    let previousLendable = security.lendable;
    let previousOnLoan = Math.round(security.lendable * security.util / 100);
    const closes = [];
    const volumes = [];
    for (let index = 0; index < dates.length; index += 1) {
      const date = dates[index];
      const effects = regimeEffects(manifest, security.securityId, date, dates);
      const equityClock = scheduledTimestamps(manifest, "equity_market_daily.csv", date);
      const close = round(priceFor(security, index, equityPhase, effects));
      const open = round(close * (1 - 0.006 * Math.sin(index + 1 + equityPhase)));
      const high = round(Math.max(open, close) * 1.018);
      const low = round(Math.min(open, close) * 0.982);
      const volume = Math.round(security.volume * (0.82 + 0.28 * Math.abs(Math.sin(index * 0.91 + equityPhase))) * effects.volumeMultiplier);
      closes.push(close);
      volumes.push(volume);
      const adv20 = Math.round(volumes.slice(-20).reduce((sum, item) => sum + item, 0) / Math.min(20, volumes.length));
      const returns = closes.slice(-20).map((item, itemIndex, values) => itemIndex === 0 ? 0 : Math.log(item / values[itemIndex - 1]));
      const mean = returns.reduce((sum, item) => sum + item, 0) / returns.length;
      const variance = returns.reduce((sum, item) => sum + (item - mean) ** 2, 0) / Math.max(1, returns.length - 1);
      const realizedVol = round(100 * Math.sqrt(252 * variance), 4);
      rows["equity_market_daily.csv"].push([scenarioId, `EQ-${security.ticker}-${date}`, security.securityId, date, equityClock.observed, equityClock.observed, equityClock.ingested, equityClock.knowable, open, high, low, close, close, volume, adv20, realizedVol, Math.round(close * security.shares), security.float, "OPEN", "SIM_EQUITY", "VALID", 1, "SIM"]);

      const borrowClock = scheduledTimestamps(manifest, "market_borrow_snapshots.csv", date);
      const utilization = utilizationFor(security, index, borrowPhase, effects);
      const lendable = Math.max(1, Math.round(security.lendable * (1 + effects.lendableChangePct / 100)));
      const onLoan = Math.round(lendable * utilization / 100);
      const available = lendable - onLoan;
      const fee = round(feeFor(security, index, utilization, effects));
      rows["market_borrow_snapshots.csv"].push([scenarioId, `MB-${security.ticker}-${date}`, security.securityId, date, borrowClock.observed, borrowClock.ingested, borrowClock.knowable, lendable, onLoan, available, round(100 * onLoan / lendable, 6), fee, round(fee * 1.035), Math.round(onLoan * (0.035 + 0.01 * Math.abs(Math.sin(index + borrowPhase)))), lendable - previousLendable, onLoan - previousOnLoan, 14 + (index % 4), "SIM_PROVIDER_V1", "SIM_BORROW", "VALID", 1, "SIM"]);
      previousLendable = lendable;
      previousOnLoan = onLoan;

      const inventoryClock = scheduledTimestamps(manifest, "inventory_snapshots.csv", date);
      const loanClock = scheduledTimestamps(manifest, "loan_snapshots.csv", date);
      const gross = Math.round(security.inventory * (1 + 0.01 * Math.sin(index * 0.37 + inventoryPhase)));
      const restricted = Math.round(gross * 0.05);
      const eligible = gross - restricted;
      const reserved = Math.round(eligible * 0.03);
      const internalOnLoan = Math.min(eligible - reserved, Math.round(eligible * utilization / 100 * 0.88));
      const internalAvailable = eligible - reserved - internalOnLoan;
      rows["inventory_snapshots.csv"].push([scenarioId, `INV-${security.ticker}-${date}`, security.securityId, "BOOK-SL-01", "OWNER-SIM-01", date, inventoryClock.observed, inventoryClock.ingested, inventoryClock.knowable, gross, restricted, eligible, reserved, internalOnLoan, internalAvailable, "SIM_INTERNAL", "VALID", 1, "SIM"]);
      rows["loan_snapshots.csv"].push([scenarioId, `LOBS-${security.ticker}-${date}`, `LOAN-${security.ticker}-01`, security.securityId, "BOOK-SL-01", "OWNER-SIM-01", "CP-SIM-01", date, loanClock.observed, loanClock.ingested, loanClock.knowable, Math.round(internalOnLoan * 0.72), round(fee * 0.82), manifest.base_currency, "FEE", "CASH", manifest.base_currency, "OPEN", "", dates[0], dates[0], "SETTLED", "SIM_INTERNAL", "VALID", 1, "SIM"]);

      if (index % 5 === 0 || utilization >= 85) {
        const eventClock = scheduledTimestamps(manifest, "borrow_events.csv", date);
        const requested = Math.round(lendable * (utilization >= 85 ? 0.055 : 0.012));
        const fillRate = Math.max(0.2, 1 - utilization / 120);
        rows["borrow_events.csv"].push([scenarioId, `BE-${security.ticker}-${date}`, security.securityId, "BOOK-SL-01", index % 10 === 0 ? "BORROW_REQUEST" : "LOCATE_REQUEST", `${date}T15:00:00Z`, eventClock.observed, eventClock.ingested, eventClock.knowable, requested, Math.round(requested * fillRate), fee, utilization > 85 ? "LIMITED_SUPPLY" : "NORMAL_DEMAND", "SIM_INTERNAL", "VALID", 1, "SIM"]);
      }

      const shortInterestClock = scheduledTimestamps(manifest, "short_interest.csv", date);
      const shortShare = Math.min(0.44, 0.08 + utilization / 340);
      const estimatedPosition = Math.round(security.float * shortShare * (1 + 0.018 * Math.sin(index * 0.56 + shortInterestPhase)));
      rows["short_interest.csv"].push([scenarioId, `SI-EST-${security.ticker}-${date}`, security.securityId, "ESTIMATED", estimatedPosition, security.float, round(100 * estimatedPosition / security.float, 6), date, shortInterestClock.observed, shortInterestClock.observed, shortInterestClock.ingested, shortInterestClock.knowable, "FLOAT", "SIM_ESTIMATE_V1", "SIM_SHORT_EST", 1, "SIM"]);
      if (index % 10 === 0) {
        const publicationDelay = manifest.publication_schedules["short_interest.csv"].publication_delay_business_days ?? 0;
        const publicationDate = addBusinessDays(date, publicationDelay);
        const publicationClock = scheduledTimestamps(manifest, "short_interest.csv", publicationDate);
        const officialPosition = Math.round(estimatedPosition * (0.97 + 0.02 * Math.sin(index)));
        rows["short_interest.csv"].push([scenarioId, `SI-OFF-${security.ticker}-${date}`, security.securityId, "OFFICIAL", officialPosition, security.float, round(100 * officialPosition / security.float, 6), date, publicationClock.observed, publicationClock.observed, publicationClock.ingested, publicationClock.knowable, "FLOAT", "SIM_OFFICIAL_STYLE_V1", "SIM_SHORT_OFFICIAL", 1, "SIM"]);
      }

      const shortVolumeClock = scheduledTimestamps(manifest, "short_sale_volume.csv", date);
      const shortVolume = Math.round(volume * (0.32 + 0.08 * Math.sin(index * 0.44 + shortVolumePhase)));
      const shortExempt = Math.max(0, Math.round(volume * 0.004));
      rows["short_sale_volume.csv"].push([scenarioId, `SSV-${security.ticker}-${date}`, security.securityId, date, shortVolumeClock.observed, shortVolumeClock.observed, shortVolumeClock.ingested, shortVolumeClock.knowable, shortVolume, shortExempt, volume, "SIM_CONSOLIDATED", "SIM_SHORT_VOLUME", 1, "SIM"]);

      const optionsClock = scheduledTimestamps(manifest, "options_snapshots.csv", date);
      const callVolume = Math.max(100, Math.round(volume * 0.018 * effects.callVolumeMultiplier * (0.96 + 0.08 * Math.abs(Math.sin(optionsPhase)))));
      const putVolume = Math.max(100, Math.round(volume * 0.016 * (1 + 0.18 * Math.sin(index * 0.38 + optionsPhase))));
      const iv30 = round(Math.max(12, realizedVol * 1.18 + utilization * 0.16), 4);
      rows["options_snapshots.csv"].push([scenarioId, `OPT-${security.ticker}-${date}`, security.securityId, date, optionsClock.observed, optionsClock.ingested, optionsClock.knowable, putVolume, callVolume, round(putVolume / callVolume, 6), Math.round((putVolume + callVolume) * 7.5), round(2.5 * Math.sin(index * 0.51 + optionsPhase), 4), iv30, round(Math.min(99, 25 + iv30 * 0.9), 4), round(4 + utilization * 0.055, 4), "SIM_OPTIONS", "VALID", 1, "SIM"]);

      if (security.assetType === "ETF") {
        const etfClock = scheduledTimestamps(manifest, "etf_snapshots.csv", date);
        const aum = Math.round(close * security.shares);
        const flow1d = Math.round(aum * 0.0018 * Math.sin(index * 0.67 + etfPhase));
        const recentFlows = Array.from({ length: Math.min(5, index + 1) }, (_, offset) => Math.round(aum * 0.0018 * Math.sin((index - offset) * 0.67 + etfPhase)));
        const flow5d = recentFlows.reduce((sum, item) => sum + item, 0);
        rows["etf_snapshots.csv"].push([scenarioId, `ETF-${security.ticker}-${date}`, security.securityId, date, etfClock.observed, etfClock.ingested, etfClock.knowable, aum, flow1d, flow5d, round(100 * flow5d / aum, 6), 42, round(3.5 * Math.sin(index * 0.42 + etfPhase), 4), "SIM_ETF", "VALID", 1, "SIM"]);
      }
    }
  }

  for (const event of manifest.events) {
    rows["security_events.csv"].push([scenarioId, event.event_id, event.security_id, event.issuer_id, event.event_type, event.event_time, event.event_time, event.event_time, event.event_time, event.event_time, event.event_importance, event.description, "SIM_EVENTS", 1, "SIM"]);
  }

  for (const truth of manifest.truth_events) {
    rows["_truth/truth_events.csv"].push([scenarioId, truth.truth_event_id, truth.security_id, truth.event_type, truth.start_time, truth.end_time, truth.outcome_horizon_days, truth.outcome_label, truth.causal_driver, truth.notes, "SIM"]);
  }
  return rows;
}

const FIELD_META = {
  dataset_version: ["string", true, "", "Contract version for the CSV bundle", "1.1"],
  scenario_id: ["string", true, "", "Stable scenario identifier shared by every file", ""],
  scenario_manifest_id: ["string", true, "", "Stable identifier of the resolved generator scenario manifest", ""],
  scenario_manifest_version: ["string", true, "", "Version of the resolved generator scenario manifest contract", "1.0.0"],
  scenario_manifest_sha256: ["string", true, "hex SHA-256", "Digest of the archived resolved scenario manifest bytes", ""],
  seed: ["integer", true, "", "Deterministic generator seed", ""],
  generator_version: ["string", true, "", "Version of the synthetic generator", ""],
  data_mode: ["enum", true, "", "Provenance mode; Phase 1 accepts SIM only", "SIM"],
  base_currency: ["string", true, "ISO 4217", "Scenario reporting currency", "USD"],
  calendar_start: ["date", true, "YYYY-MM-DD", "First business date in the bundle", ""],
  calendar_end: ["date", true, "YYYY-MM-DD", "Last business date in the bundle", ""],
  generated_at: ["timestamp", true, "UTC ISO-8601", "Bundle generation timestamp", ""],
  model_input_path: ["string", true, "", "Relative directory containing model-input CSVs", ""],
  truth_path: ["string", true, "", "Relative test-only truth-ledger path", ""],
  security_id: ["string", true, "", "Stable security identifier used for joins", ""],
  issuer_id: ["string", false, "", "Stable issuer identifier", ""],
  listing_id: ["string", false, "", "Stable listing identifier", ""],
  ticker: ["string", true, "", "Effective display ticker", ""],
  security_name: ["string", true, "", "Fictional security name", ""],
  asset_type: ["enum", true, "", "Security type", "EQUITY|ETF"],
  sector: ["string", true, "", "Sector classification", ""],
  currency: ["string", true, "ISO 4217", "Security trading currency", ""],
  primary_exchange: ["string", true, "MIC-like code", "Synthetic primary listing venue", ""],
  shares_outstanding: ["integer", true, "shares", "Shares outstanding at the effective date", ""],
  float_shares: ["integer", true, "shares", "Tradable float used by positioning ratios", ""],
  effective_from: ["date", true, "YYYY-MM-DD", "Identity-record effective start", ""],
  effective_to: ["date", false, "YYYY-MM-DD", "Identity-record exclusive end; blank means open", ""],
  is_active: ["boolean", true, "", "Whether the identity record is active", "true|false"],
  observation_id: ["string", true, "", "Immutable observation identifier", ""],
  business_date: ["date", true, "YYYY-MM-DD", "Business date represented by the record", ""],
  observed_at: ["timestamp", true, "UTC ISO-8601", "Time the mock source observed the value", ""],
  ingested_at: ["timestamp", true, "UTC ISO-8601", "Time the platform persisted this exact source revision", ""],
  first_knowable_at: ["timestamp", true, "UTC ISO-8601", "Earliest time this exact revision may enter features", ""],
  source_id: ["string", true, "", "Named mock source; later maps to a real adapter", ""],
  quality_state: ["enum", true, "", "Publication quality state", "VALID|DEGRADED|QUARANTINED"],
  revision: ["integer", true, "", "Source-record revision number starting at 1", ""],
  book_id: ["string", true, "", "Internal lending-book identifier", ""],
  owner_id: ["string", true, "", "Synthetic beneficial-owner identifier", ""],
  gross_inventory_qty: ["integer", true, "shares", "Gross custody inventory before restrictions", ""],
  restricted_qty: ["integer", true, "shares", "Inventory unavailable because of restrictions", ""],
  eligible_lendable_qty: ["integer", true, "shares", "Gross inventory less restricted quantity", ""],
  reserved_qty: ["integer", true, "shares", "Eligible inventory held out from lending", ""],
  on_loan_qty: ["integer", true, "shares", "Quantity currently on loan under the dataset methodology", ""],
  available_qty: ["integer", true, "shares", "Quantity available after on-loan and reserved amounts", ""],
  loan_id: ["string", true, "", "Stable loan identifier", ""],
  counterparty_id: ["string", true, "", "Synthetic borrower/counterparty identifier", ""],
  quantity: ["integer", true, "shares", "Settled loan quantity", ""],
  fee_bps: ["number", true, "annualized basis points", "Loan or event fee under the named convention", ""],
  rate_currency: ["string", true, "ISO 4217", "Currency of loan economics", ""],
  rate_convention: ["enum", true, "", "How loan economics are quoted", "FEE|REBATE"],
  collateral_type: ["enum", true, "", "Collateral type", "CASH|NON_CASH"],
  collateral_currency: ["string", true, "ISO 4217", "Collateral currency", ""],
  term_type: ["enum", true, "", "Open or term loan", "OPEN|TERM"],
  maturity_date: ["date", false, "YYYY-MM-DD", "Contractual maturity for term loans", ""],
  trade_date: ["date", true, "YYYY-MM-DD", "Loan trade date or equity trading date", ""],
  settlement_date: ["date", true, "YYYY-MM-DD", "Loan settlement date", ""],
  status: ["enum", true, "", "Loan lifecycle status", "PENDING|SETTLED|RETURNED|RECALLED"],
  event_id: ["string", true, "", "Stable event identifier", ""],
  event_type: ["enum", true, "", "Domain-specific event classification", ""],
  event_time: ["timestamp", true, "UTC ISO-8601", "Effective event time", ""],
  requested_qty: ["integer", true, "shares", "Requested locate or borrow quantity", ""],
  filled_qty: ["integer", true, "shares", "Quantity filled against the request", ""],
  reason_code: ["string", true, "", "Machine-readable event explanation", ""],
  lendable_qty: ["integer", true, "shares", "Provider-reported lendable supply", ""],
  utilization_pct: ["number", true, "percent 0-100", "One hundred times on-loan divided by lendable", ""],
  current_fee_bps: ["number", true, "annualized basis points", "Current provider borrow fee", ""],
  new_loan_fee_bps: ["number", true, "annualized basis points", "Provider fee for newly opened loans", ""],
  demand_qty: ["integer", true, "shares", "Provider-observed borrow demand quantity", ""],
  supply_change_1d_qty: ["integer", true, "shares", "One-business-day lendable change", ""],
  loan_change_1d_qty: ["integer", true, "shares", "One-business-day on-loan change", ""],
  contributor_count: ["integer", true, "contributors", "Number of observations contributing to the benchmark", ""],
  methodology_version: ["string", true, "", "Version of the source calculation methodology", ""],
  report_id: ["string", true, "", "Immutable short-position report identifier", ""],
  short_interest_kind: ["enum", true, "", "Official-style report or provider estimate", "OFFICIAL|ESTIMATED"],
  position_qty: ["integer", true, "shares", "Reported or estimated short position", ""],
  short_interest_pct: ["number", true, "percent 0-100", "One hundred times position divided by the stated basis", ""],
  published_at: ["timestamp", true, "UTC ISO-8601", "Source publication timestamp", ""],
  basis: ["enum", true, "", "Denominator used by the positioning percentage", "FLOAT|SHARES_OUTSTANDING"],
  short_volume_qty: ["integer", true, "shares", "Reported short-sale transaction volume", ""],
  short_exempt_volume_qty: ["integer", true, "shares", "Reported short-exempt transaction volume", ""],
  total_reported_volume_qty: ["integer", true, "shares", "Total volume in the same venue scope", ""],
  venue_scope: ["string", true, "", "Venues represented by the short-volume record", ""],
  open_price: ["number", true, "currency per share", "Unadjusted opening price", ""],
  high_price: ["number", true, "currency per share", "Unadjusted daily high", ""],
  low_price: ["number", true, "currency per share", "Unadjusted daily low", ""],
  close_price: ["number", true, "currency per share", "Unadjusted closing price", ""],
  adjusted_close_price: ["number", true, "currency per share", "Corporate-action-adjusted close", ""],
  volume_qty: ["integer", true, "shares", "Daily consolidated trading volume", ""],
  adv20_qty: ["integer", true, "shares per day", "Trailing twenty-business-day average volume", ""],
  realized_vol_20d_pct: ["number", true, "annualized percent", "Trailing realized volatility", ""],
  market_cap_usd: ["number", true, "USD", "Close price times shares outstanding", ""],
  halt_status: ["enum", true, "", "End-of-day halt status", "OPEN|HALTED"],
  put_volume_qty: ["integer", true, "contracts", "Daily put-contract volume", ""],
  call_volume_qty: ["integer", true, "contracts", "Daily call-contract volume", ""],
  put_call_ratio: ["number", true, "ratio", "Put volume divided by call volume", ""],
  total_open_interest_qty: ["integer", true, "contracts", "Total listed option open interest", ""],
  open_interest_change_5d_pct: ["number", true, "percent", "Five-business-day open-interest change", ""],
  iv30_pct: ["number", true, "annualized percent", "Thirty-day at-the-money implied volatility", ""],
  iv_rank_1y_pct: ["number", true, "percentile 0-100", "One-year implied-volatility rank", ""],
  skew_25d_vol_points: ["number", true, "volatility points", "Twenty-five-delta put IV less call IV", ""],
  aum_usd: ["number", true, "USD", "ETF assets under management", ""],
  net_flow_1d_usd: ["number", true, "USD", "Estimated one-day net creation/redemption flow", ""],
  net_flow_5d_usd: ["number", true, "USD", "Estimated five-day net creation/redemption flow", ""],
  flow_pct_aum: ["number", true, "percent", "Five-day net flow divided by AUM", ""],
  holdings_count: ["integer", true, "securities", "Number of ETF holdings", ""],
  estimated_discount_bps: ["number", true, "basis points", "Estimated NAV discount; negative denotes premium", ""],
  event_importance: ["enum", true, "", "Event materiality tier", "LOW|MEDIUM|HIGH"],
  description: ["string", true, "", "Plain-language fictional event description", ""],
  truth_event_id: ["string", true, "", "Test-only truth-event identifier", ""],
  start_time: ["timestamp", true, "UTC ISO-8601", "Truth-event start", ""],
  end_time: ["timestamp", true, "UTC ISO-8601", "Truth-event end", ""],
  outcome_horizon_days: ["integer", true, "business days", "Evaluation horizon", ""],
  outcome_label: ["enum", true, "", "Hidden evaluation outcome", "POSITIVE|NEGATIVE|NEAR_MISS|CONTEXT_ONLY"],
  causal_driver: ["string", true, "", "Hidden simulated causal driver", ""],
  notes: ["string", false, "", "Test-only scenario note", ""],
};

function liveSourceFor(dataset) {
  if (dataset === "securities.csv") return "security master and corporate actions";
  if (dataset.startsWith("inventory") || dataset.startsWith("loan") || dataset.startsWith("borrow_events")) return "internal stock-loan platform";
  if (dataset.startsWith("market_borrow")) return "licensed securities-finance provider";
  if (dataset.startsWith("short_interest")) return "official publication and optional estimate provider";
  if (dataset.startsWith("short_sale")) return "FINRA/exchange short-sale volume";
  if (dataset.startsWith("equity_market")) return "licensed equity market-data provider";
  if (dataset.startsWith("options")) return "licensed OPRA/options analytics provider";
  if (dataset.startsWith("etf")) return "licensed ETF reference/flow provider";
  if (dataset.startsWith("security_events")) return "approved event and corporate-actions provider";
  if (dataset.startsWith("_truth")) return "none; test-only synthetic labels";
  return "deployment configuration";
}

function dictionaryRows() {
  const rows = [];
  for (const [dataset, headers] of Object.entries(DATASETS)) {
    for (const field of headers) {
      const meta = FIELD_META[field];
      if (!meta) throw new Error(`Missing field metadata for ${dataset}.${field}`);
      rows.push([dataset, field, meta[0], meta[1], meta[2], meta[3], meta[4], liveSourceFor(dataset)]);
    }
  }
  return rows;
}

function jsonSchemaForField(field) {
  const [dataType, required, unit, description, allowedValues] = FIELD_META[field];
  const schema = { description };
  if (dataType === "integer") schema.type = "integer";
  else if (dataType === "number") schema.type = "number";
  else if (dataType === "boolean") schema.type = "boolean";
  else {
    schema.type = "string";
    if (dataType === "date") schema.format = "date";
    if (dataType === "timestamp") {
      schema.format = "date-time";
      schema.pattern = "Z$";
    }
    if (required && dataType !== "enum") schema.minLength = 1;
  }
  if (field.endsWith("_id")) schema.pattern = "^[A-Za-z0-9][A-Za-z0-9._:-]*$";
  if (field === "scenario_manifest_sha256") schema.pattern = "^[a-f0-9]{64}$";
  if (allowedValues) schema.enum = allowedValues.split("|").map((value) => {
    if (dataType === "boolean") return value === "true";
    return value;
  });
  if (field === "data_mode") schema.const = "SIM";
  if (field === "revision") schema.minimum = 1;
  if (unit) schema["x-unit"] = unit;
  return schema;
}

function recordSchema(headers) {
  return {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(headers.map((field) => [field, jsonSchemaForField(field)])),
    required: headers.filter((field) => FIELD_META[field][1]),
  };
}

function dataDictionaryRecordSchema() {
  const nonEmptyString = (description) => ({ type: "string", minLength: 1, description });
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      dataset: nonEmptyString("Relative CSV dataset path"),
      column_name: nonEmptyString("Exact case-sensitive CSV header"),
      data_type: { type: "string", enum: ["string", "integer", "number", "boolean", "date", "timestamp", "enum"] },
      required: { type: "boolean" },
      unit: { type: "string" },
      description: nonEmptyString("Business meaning of the field"),
      allowed_values: { type: "string" },
      live_replacement_source: nonEmptyString("Expected future source category"),
    },
    required: DATA_DICTIONARY_HEADERS,
  };
}

function contractSchema() {
  const definitions = Object.fromEntries(Object.entries(DATASET_SCHEMA_NAMES).map(([dataset, name]) => [name, recordSchema(DATASETS[dataset])]));
  definitions.DataDictionaryRecord = dataDictionaryRecordSchema();
  const catalogProperties = Object.fromEntries(Object.entries(DATASET_SCHEMA_NAMES).map(([dataset, name]) => [dataset, {
    type: "array",
    items: { $ref: `#/$defs/${name}` },
  }]));
  catalogProperties["data_dictionary.csv"] = { type: "array", items: { $ref: "#/$defs/DataDictionaryRecord" } };
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://quant-sandbox.local/contracts/squeeze-radar/csv-records-1.1.schema.json",
    title: "Squeeze Radar CSV record contracts",
    description: "Typed record schemas for the normalized synthetic CSV boundary. TruthEventRecord is evaluation-only and is not exposed by the model-input loader.",
    type: "object",
    additionalProperties: false,
    properties: catalogProperties,
    required: Object.keys(catalogProperties),
    $defs: definitions,
  };
}

function rowObject(dataset, row) {
  return Object.fromEntries(DATASETS[dataset].map((header, index) => [header, row[index]]));
}

function logicalRecordId(dataset, record) {
  if (dataset === "securities.csv") return `${record.security_id}|${record.effective_from}`;
  return record.observation_id ?? record.report_id ?? record.event_id ?? record.loan_id;
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateGeneratedContract(rowsByDataset) {
  for (const [dataset, rows] of Object.entries(rowsByDataset)) {
    const headers = DATASETS[dataset];
    for (const [rowIndex, row] of rows.entries()) {
      if (row.length !== headers.length) throw new Error(`${dataset} row ${rowIndex + 1} has ${row.length} fields; expected ${headers.length}`);
      for (const [fieldIndex, field] of headers.entries()) {
        const value = row[fieldIndex];
        const [dataType, required, , , allowedValues] = FIELD_META[field];
        const empty = value === "" || value === null || value === undefined;
        if (empty) {
          if (required) throw new Error(`${dataset} row ${rowIndex + 1} field ${field} is required`);
          continue;
        }
        if (dataType === "integer" && !Number.isSafeInteger(value)) {
          throw new Error(`${dataset} row ${rowIndex + 1} field ${field} must be an integer`);
        }
        if (dataType === "number" && (typeof value !== "number" || !Number.isFinite(value))) {
          throw new Error(`${dataset} row ${rowIndex + 1} field ${field} must be a finite number`);
        }
        if (dataType === "boolean" && typeof value !== "boolean") {
          throw new Error(`${dataset} row ${rowIndex + 1} field ${field} must be a boolean`);
        }
        if (["string", "enum", "date", "timestamp"].includes(dataType) && typeof value !== "string") {
          throw new Error(`${dataset} row ${rowIndex + 1} field ${field} must be a string`);
        }
        if (dataType === "date" && !isRealDate(value)) {
          throw new Error(`${dataset} row ${rowIndex + 1} field ${field} must be a real YYYY-MM-DD date`);
        }
        if (dataType === "timestamp" && (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(value) || !isRealDate(value.slice(0, 10)) || Number.isNaN(Date.parse(value)))) {
          throw new Error(`${dataset} row ${rowIndex + 1} field ${field} must be a valid UTC timestamp`);
        }
        if (allowedValues && !allowedValues.split("|").some((allowed) => String(value) === allowed)) {
          throw new Error(`${dataset} row ${rowIndex + 1} field ${field} must be one of ${allowedValues}`);
        }
        if (field.endsWith("_id") && !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) {
          throw new Error(`${dataset} row ${rowIndex + 1} field ${field} must be a stable identifier`);
        }
        if (field === "scenario_manifest_sha256" && !/^[a-f0-9]{64}$/.test(value)) {
          throw new Error(`${dataset} row ${rowIndex + 1} field ${field} must be a SHA-256 digest`);
        }
        if (field === "revision" && value < 1) throw new Error(`${dataset} row ${rowIndex + 1} field revision must be at least 1`);
        if (field === "data_mode" && value !== "SIM") throw new Error(`${dataset} row ${rowIndex + 1} field data_mode must equal SIM`);
      }
    }
  }
}

function validateGeneratedStructure(rowsByDataset, scenarioId) {
  for (const [dataset, rows] of Object.entries(rowsByDataset)) {
    if (dataset === "manifest.csv" || dataset.startsWith("_truth/")) continue;
    const revisions = new Set();
    for (const row of rows) {
      const record = rowObject(dataset, row);
      if (record.scenario_id !== scenarioId || record.data_mode !== "SIM") throw new Error(`${dataset} lost SIM scenario provenance`);
      const revisionKey = `${logicalRecordId(dataset, record)}|${record.revision}`;
      if (revisions.has(revisionKey)) throw new Error(`${dataset} contains duplicate revision ${revisionKey}`);
      revisions.add(revisionKey);
      const observed = Date.parse(record.observed_at);
      const ingested = Date.parse(record.ingested_at);
      const knowable = Date.parse(record.first_knowable_at);
      if (!(observed <= ingested && ingested <= knowable)) throw new Error(`${dataset} contains invalid clock order for ${logicalRecordId(dataset, record)}`);
      if (record.published_at && Date.parse(record.published_at) > knowable) throw new Error(`${dataset} publishes after first_knowable_at`);
    }
  }
}

function invariantViolations(rowsByDataset) {
  const violations = [];
  for (const row of rowsByDataset["market_borrow_snapshots.csv"]) {
    const record = rowObject("market_borrow_snapshots.csv", row);
    if (Number(record.lendable_qty) - Number(record.on_loan_qty) !== Number(record.available_qty)) {
      violations.push({ gate: "MARKET_AVAILABILITY", dataset: "market_borrow_snapshots.csv", record: record.observation_id, revision: Number(record.revision) });
    }
    const expected = 100 * Number(record.on_loan_qty) / Number(record.lendable_qty);
    if (Math.abs(expected - Number(record.utilization_pct)) > 0.000001) {
      violations.push({ gate: "MARKET_UTILIZATION", dataset: "market_borrow_snapshots.csv", record: record.observation_id, revision: Number(record.revision) });
    }
  }
  for (const row of rowsByDataset["inventory_snapshots.csv"]) {
    const record = rowObject("inventory_snapshots.csv", row);
    if (Number(record.gross_inventory_qty) - Number(record.restricted_qty) !== Number(record.eligible_lendable_qty)) {
      violations.push({ gate: "INTERNAL_ELIGIBLE", dataset: "inventory_snapshots.csv", record: record.observation_id, revision: Number(record.revision) });
    }
    if (Number(record.eligible_lendable_qty) - Number(record.reserved_qty) - Number(record.on_loan_qty) !== Number(record.available_qty)) {
      violations.push({ gate: "INTERNAL_AVAILABLE", dataset: "inventory_snapshots.csv", record: record.observation_id, revision: Number(record.revision) });
    }
  }
  for (const row of rowsByDataset["short_interest.csv"]) {
    const record = rowObject("short_interest.csv", row);
    const expected = 100 * Number(record.position_qty) / Number(record.float_shares);
    if (Math.abs(expected - Number(record.short_interest_pct)) > 0.000001) {
      violations.push({ gate: "SHORT_INTEREST_FLOAT", dataset: "short_interest.csv", record: record.report_id, revision: Number(record.revision) });
    }
  }
  return violations;
}

function violationKey(violation) {
  return `${violation.gate}|${violation.dataset}|${violation.record}|${violation.revision}`;
}

function allowedInvariantViolationKey(rowsByDataset, fault) {
  const invariantGates = new Set(["MARKET_AVAILABILITY", "MARKET_UTILIZATION", "INTERNAL_ELIGIBLE", "INTERNAL_AVAILABLE", "SHORT_INTEREST_FLOAT"]);
  if (!fault.target || !invariantGates.has(fault.expected_gate)) return undefined;
  const dataset = fault.target.dataset;
  const matching = rowsByDataset[dataset].map((row) => rowObject(dataset, row)).filter((record) => {
    const date = record.business_date ?? record.trade_date ?? record.settlement_date ?? record.event_time?.slice(0, 10);
    return record.security_id === fault.target.security_id && date === fault.target.record_date;
  });
  const record = ["BACKFILL_REVISION", "POST_DECISION_REVISION"].includes(fault.type)
    ? matching.find((candidate) => candidate.first_knowable_at === fault.first_knowable_at && candidate[fault.field] === fault.value)
    : matching.find((candidate) => Number(candidate.revision) === (fault.target.revision ?? 1));
  if (!record) return undefined;
  return violationKey({
    gate: fault.expected_gate,
    dataset,
    record: logicalRecordId(dataset, record),
    revision: Number(record.revision),
  });
}

function normalizeGeneratorOptions(options = {}) {
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new Error("generator options must be an object");
  }
  const normalized = {
    outputDir: resolve(options.outputDir ?? DEFAULT_SYNTHETIC_GENERATOR_OPTIONS.outputDir),
    writeContracts: options.writeContracts ?? false,
  };
  if (options.manifestPath !== undefined) {
    if (typeof options.manifestPath !== "string" || options.manifestPath.length === 0) throw new Error("manifestPath must be a non-empty path");
    normalized.manifestPath = resolve(options.manifestPath);
  }
  if (options.scenarioManifest !== undefined) normalized.scenarioManifest = options.scenarioManifest;
  if (options.scenarioId !== undefined) normalized.scenarioId = options.scenarioId;
  if (options.seed !== undefined) normalized.seed = options.seed;
  if (options.generatedAt !== undefined) normalized.generatedAt = options.generatedAt;
  if (normalized.scenarioId !== undefined && !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(normalized.scenarioId)) {
    throw new Error("scenarioId must be a non-empty stable identifier containing only letters, numbers, dot, underscore, colon, or hyphen");
  }
  if (normalized.seed !== undefined && (!Number.isSafeInteger(normalized.seed) || normalized.seed < 0)) {
    throw new Error("seed must be a non-negative safe integer");
  }
  if (typeof normalized.outputDir !== "string" || normalized.outputDir.length === 0) {
    throw new Error("outputDir must be a non-empty path");
  }
  if (typeof normalized.writeContracts !== "boolean") {
    throw new Error("writeContracts must be a boolean");
  }
  const utcTimestamp = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/;
  if (normalized.generatedAt !== undefined && (typeof normalized.generatedAt !== "string" || !utcTimestamp.test(normalized.generatedAt) || !isRealDate(normalized.generatedAt.slice(0, 10)) || Number.isNaN(Date.parse(normalized.generatedAt)))) {
    throw new Error("generatedAt must be a valid UTC ISO-8601 timestamp ending in Z");
  }
  return normalized;
}

export async function generateSqueezeRadarCsv(options = {}) {
  const normalized = normalizeGeneratorOptions(options);
  const scenario = await loadScenarioConfiguration(normalized, new Set(Object.keys(DATASETS)));
  const rowsByDataset = buildRows(scenario.manifest, scenario.sha256);
  const dictionary = dictionaryRows();
  validateGeneratedContract(rowsByDataset);
  validateGeneratedStructure(rowsByDataset, scenario.manifest.scenario_id);
  const baseViolations = invariantViolations(rowsByDataset);
  if (baseViolations.length) throw new Error(`base scenario violates ${baseViolations[0].gate} at ${baseViolations[0].record}`);
  const appliedFaultIds = applyScenarioFaults(rowsByDataset, DATASETS, scenario.manifest.faults);
  validateGeneratedContract(rowsByDataset);
  validateGeneratedStructure(rowsByDataset, scenario.manifest.scenario_id);
  const allowedViolationKeys = new Set(scenario.manifest.faults
    .map((fault) => allowedInvariantViolationKey(rowsByDataset, fault))
    .filter(Boolean));
  const finalViolations = invariantViolations(rowsByDataset);
  const unexpected = finalViolations.find((violation) => !allowedViolationKeys.has(violationKey(violation)));
  if (unexpected) throw new Error(`fault suite caused undeclared ${unexpected.gate} violation at ${unexpected.record}`);
  for (const fault of scenario.manifest.faults.filter((candidate) => candidate.type === "BAD_UNIT")) {
    const expectedKey = allowedInvariantViolationKey(rowsByDataset, fault);
    if (!expectedKey || !finalViolations.some((violation) => violationKey(violation) === expectedKey)) {
      throw new Error(`fault ${fault.fault_id} did not trigger declared exact gate ${fault.expected_gate}`);
    }
  }
  await mkdir(resolve(normalized.outputDir, "_truth"), { recursive: true });
  for (const [dataset, headers] of Object.entries(DATASETS)) {
    await writeFile(resolve(normalized.outputDir, dataset), toCsv(headers, rowsByDataset[dataset]), "utf8");
  }
  await writeFile(resolve(normalized.outputDir, "data_dictionary.csv"), toCsv(DATA_DICTIONARY_HEADERS, dictionary), "utf8");
  await writeFile(resolve(normalized.outputDir, "_truth", "scenario-manifest.json"), scenario.archivedText, "utf8");
  if (normalized.writeContracts) {
    await writeFile(CONTRACT_SCHEMA_PATH, `${JSON.stringify(contractSchema(), null, 2)}\n`, "utf8");
  }
  return {
    outputDir: normalized.outputDir,
    scenarioId: scenario.manifest.scenario_id,
    seed: scenario.manifest.seed,
    generatedAt: scenario.manifest.generated_at,
    generatorVersion: GENERATOR_VERSION,
    scenarioManifestId: scenario.manifest.manifest_id,
    scenarioManifestVersion: scenario.manifest.manifest_version,
    scenarioManifestSha256: scenario.sha256,
    appliedFaultIds,
    fileCount: Object.keys(DATASETS).length + 1,
    metadataFileCount: 1,
    rowCounts: {
      ...Object.fromEntries(Object.entries(rowsByDataset).map(([dataset, rows]) => [dataset, rows.length])),
      "data_dictionary.csv": dictionary.length,
    },
  };
}

function requireOptionValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

export function parseSqueezeGeneratorArgs(args, cwd = process.cwd()) {
  const options = {};
  let help = false;
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (option === "--help" || option === "-h") {
      help = true;
    } else if (option === "--write-contracts") {
      options.writeContracts = true;
    } else if (option === "--manifest") {
      options.manifestPath = resolve(cwd, requireOptionValue(args, index, option));
      index += 1;
    } else if (option === "--output-dir") {
      options.outputDir = resolve(cwd, requireOptionValue(args, index, option));
      index += 1;
    } else if (option === "--seed") {
      const value = requireOptionValue(args, index, option);
      if (!/^\d+$/.test(value)) throw new Error("--seed must be a non-negative integer");
      options.seed = Number(value);
      index += 1;
    } else if (option === "--scenario-id") {
      options.scenarioId = requireOptionValue(args, index, option);
      index += 1;
    } else if (option === "--generated-at") {
      options.generatedAt = requireOptionValue(args, index, option);
      index += 1;
    } else {
      throw new Error(`Unknown option: ${option}`);
    }
  }
  return { help, options: normalizeGeneratorOptions(options) };
}

const HELP = `Generate the Squeeze Radar synthetic CSV bundle.

Usage:
  node scripts/generate-squeeze-radar-csv.mjs [options]

Options:
  --output-dir <path>      Output directory (default: data/synthetic/squeeze_radar/v1)
  --manifest <path>        Scenario manifest or overlay (default: contracts/.../scenarios/base.json)
  --seed <integer>         Deterministic series seed (default: 21021)
  --scenario-id <id>       Stable scenario identifier (default: sqz_base_v1)
  --generated-at <UTC>     Reproducible manifest timestamp ending in Z
  --write-contracts        Also refresh the committed JSON Schema
  --help, -h               Show this help
`;

let isDirectInvocation = false;
if (process.argv[1]) {
  try {
    isDirectInvocation = pathToFileURL(await realpath(resolve(process.argv[1]))).href === import.meta.url;
  } catch {
    isDirectInvocation = false;
  }
}

if (isDirectInvocation) {
  try {
    const { help, options } = parseSqueezeGeneratorArgs(process.argv.slice(2));
    if (help) {
      process.stdout.write(HELP);
    } else {
      const summary = await generateSqueezeRadarCsv(options);
      process.stdout.write(`Generated ${summary.fileCount} CSV files in ${summary.outputDir} (scenario=${summary.scenarioId}, seed=${summary.seed})\n`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Squeeze Radar generator failed: ${message}\n`);
    process.exitCode = 1;
  }
}
