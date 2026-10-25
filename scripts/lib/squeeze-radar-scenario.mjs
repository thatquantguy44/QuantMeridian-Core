import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

export const GENERATOR_VERSION = "sqz-csv-gen-1.2.0";
export const DEFAULT_SCENARIO_MANIFEST_PATH = resolve(
  MODULE_DIR,
  "../../contracts/squeeze_radar/v1/scenarios/base.json",
);

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/;
const REQUIRED_STREAMS = [
  "equity",
  "market_borrow",
  "inventory",
  "short_interest",
  "short_volume",
  "options",
  "etf",
];
const REQUIRED_INVARIANTS = [
  "MARKET_AVAILABILITY",
  "MARKET_UTILIZATION",
  "INTERNAL_ELIGIBLE",
  "INTERNAL_AVAILABLE",
  "SHORT_INTEREST_FLOAT",
];
const REQUIRED_SCHEDULES = [
  "equity_market_daily.csv",
  "market_borrow_snapshots.csv",
  "inventory_snapshots.csv",
  "loan_snapshots.csv",
  "borrow_events.csv",
  "short_interest.csv",
  "short_sale_volume.csv",
  "options_snapshots.csv",
  "etf_snapshots.csv",
];
const FAULT_TYPES = new Set([
  "STALE_SOURCE",
  "LATE_INGESTION",
  "OUT_OF_ORDER_RECORD",
  "BACKFILL_REVISION",
  "POST_DECISION_REVISION",
  "BAD_UNIT",
]);

function fail(path, message) {
  throw new Error(`scenario manifest ${path} ${message}`);
}

function requireObject(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(path, "must be an object");
  return value;
}

function rejectUnknown(value, path, allowedKeys) {
  for (const key of Object.keys(value)) if (!allowedKeys.includes(key)) fail(path, `contains unknown field ${key}`);
}

function requireString(value, path, pattern) {
  if (typeof value !== "string" || value.length === 0 || (pattern && !pattern.test(value))) {
    fail(path, "must be a valid non-empty string");
  }
}

function requireNumber(value, path, { integer = false, minimum = -Infinity, maximum = Infinity } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || (integer && !Number.isSafeInteger(value)) || value < minimum || value > maximum) {
    fail(path, `must be ${integer ? "an integer" : "a number"} between ${minimum} and ${maximum}`);
  }
}

function requireDate(value, path) {
  requireString(value, path, DATE_PATTERN);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(path, "must be a real calendar date");
}

function requireTimestamp(value, path) {
  requireString(value, path, TIMESTAMP_PATTERN);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value.slice(0, 10)) {
    fail(path, "must be a valid UTC timestamp");
  }
}

function validateTarget(target, path, datasets) {
  requireObject(target, path);
  rejectUnknown(target, path, ["dataset", "security_id", "record_date", "revision"]);
  requireString(target.dataset, `${path}.dataset`);
  if (!datasets.has(target.dataset) || target.dataset === "manifest.csv" || target.dataset.startsWith("_truth/")) {
    fail(`${path}.dataset`, "must name a model-input CSV dataset");
  }
  requireString(target.security_id, `${path}.security_id`, ID_PATTERN);
  requireDate(target.record_date, `${path}.record_date`);
  if (target.revision !== undefined) requireNumber(target.revision, `${path}.revision`, { integer: true, minimum: 1 });
}

function validateManifest(manifest, datasets) {
  requireObject(manifest, "root");
  rejectUnknown(manifest, "root", [
    "$schema", "manifest_version", "manifest_id", "generator_version", "scenario_id", "seed", "generated_at",
    "data_mode", "base_currency", "calendar", "fictional_identity_policy", "fictional_universe", "random_streams",
    "regimes", "events", "publication_schedules", "invariants", "faults", "truth_events",
  ]);
  if (manifest.$schema !== undefined && typeof manifest.$schema !== "string") fail("$schema", "must be a string");
  if (manifest.manifest_version !== "1.0.0") fail("manifest_version", "must equal 1.0.0");
  requireString(manifest.manifest_id, "manifest_id", ID_PATTERN);
  if (manifest.generator_version !== GENERATOR_VERSION) fail("generator_version", `must equal ${GENERATOR_VERSION}`);
  requireString(manifest.scenario_id, "scenario_id", ID_PATTERN);
  requireNumber(manifest.seed, "seed", { integer: true, minimum: 0 });
  requireTimestamp(manifest.generated_at, "generated_at");
  if (manifest.data_mode !== "SIM") fail("data_mode", "must equal SIM");
  requireString(manifest.base_currency, "base_currency", /^[A-Z]{3}$/);

  const calendar = requireObject(manifest.calendar, "calendar");
  rejectUnknown(calendar, "calendar", ["start_date", "business_day_count"]);
  requireDate(calendar.start_date, "calendar.start_date");
  requireNumber(calendar.business_day_count, "calendar.business_day_count", { integer: true, minimum: 5, maximum: 1000 });

  const identityPolicy = requireObject(manifest.fictional_identity_policy, "fictional_identity_policy");
  rejectUnknown(identityPolicy, "fictional_identity_policy", ["fictional_only", "required_name_suffix"]);
  if (identityPolicy.fictional_only !== true || identityPolicy.required_name_suffix !== " Synthetic") {
    fail("fictional_identity_policy", "must enforce fictional-only names ending in ' Synthetic'");
  }
  const universe = requireObject(manifest.fictional_universe, "fictional_universe");
  rejectUnknown(universe, "fictional_universe", ["securities"]);
  if (!Array.isArray(universe.securities) || universe.securities.length === 0) fail("fictional_universe.securities", "must be a non-empty array");
  const securityIds = new Set();
  for (const [index, securityValue] of universe.securities.entries()) {
    const path = `fictional_universe.securities[${index}]`;
    const security = requireObject(securityValue, path);
    rejectUnknown(security, path, [
      "security_id", "issuer_id", "listing_id", "ticker", "security_name", "asset_type", "sector", "shares_outstanding",
      "float_shares", "initial_price", "initial_volume_qty", "initial_lendable_qty", "initial_utilization_pct",
      "initial_fee_bps", "initial_inventory_qty",
    ]);
    for (const field of ["security_id", "issuer_id", "listing_id"]) requireString(security[field], `${path}.${field}`, ID_PATTERN);
    requireString(security.ticker, `${path}.ticker`, /^Q[A-Z0-9]{3,7}$/);
    requireString(security.security_name, `${path}.security_name`);
    if (!security.security_name.endsWith(identityPolicy.required_name_suffix)) fail(`${path}.security_name`, "must be explicitly fictional and end in Synthetic");
    if (!new Set(["EQUITY", "ETF"]).has(security.asset_type)) fail(`${path}.asset_type`, "must be EQUITY or ETF");
    requireString(security.sector, `${path}.sector`);
    for (const field of ["shares_outstanding", "float_shares", "initial_volume_qty", "initial_lendable_qty", "initial_inventory_qty"]) {
      requireNumber(security[field], `${path}.${field}`, { integer: true, minimum: 1 });
    }
    requireNumber(security.initial_price, `${path}.initial_price`, { minimum: 0 });
    if (security.initial_price <= 0) fail(`${path}.initial_price`, "must be greater than 0");
    requireNumber(security.initial_fee_bps, `${path}.initial_fee_bps`, { minimum: 0 });
    requireNumber(security.initial_utilization_pct, `${path}.initial_utilization_pct`, { minimum: 0, maximum: 100 });
    if (security.float_shares > security.shares_outstanding) fail(`${path}.float_shares`, "cannot exceed shares_outstanding");
    if (securityIds.has(security.security_id)) fail(`${path}.security_id`, "must be unique");
    securityIds.add(security.security_id);
  }

  const streams = requireObject(manifest.random_streams, "random_streams");
  rejectUnknown(streams, "random_streams", REQUIRED_STREAMS);
  for (const stream of REQUIRED_STREAMS) requireString(streams[stream], `random_streams.${stream}`, ID_PATTERN);

  if (!Array.isArray(manifest.invariants)) fail("invariants", "must be an array");
  const invariants = new Set(manifest.invariants);
  if (invariants.size !== manifest.invariants.length) fail("invariants", "must contain unique items");
  for (const invariant of REQUIRED_INVARIANTS) if (!invariants.has(invariant)) fail("invariants", `must include ${invariant}`);
  for (const invariant of invariants) if (!REQUIRED_INVARIANTS.includes(invariant)) fail("invariants", `contains unknown invariant ${invariant}`);

  const schedules = requireObject(manifest.publication_schedules, "publication_schedules");
  rejectUnknown(schedules, "publication_schedules", REQUIRED_SCHEDULES);
  for (const dataset of REQUIRED_SCHEDULES) {
    const schedule = requireObject(schedules[dataset], `publication_schedules.${dataset}`);
    rejectUnknown(schedule, `publication_schedules.${dataset}`, ["observed_time_utc", "ingest_delay_seconds", "knowable_delay_seconds", "publication_delay_business_days"]);
    requireString(schedule.observed_time_utc, `publication_schedules.${dataset}.observed_time_utc`, /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/);
    requireNumber(schedule.ingest_delay_seconds, `publication_schedules.${dataset}.ingest_delay_seconds`, { integer: true, minimum: 0 });
    requireNumber(schedule.knowable_delay_seconds, `publication_schedules.${dataset}.knowable_delay_seconds`, { integer: true, minimum: 0 });
    if (schedule.publication_delay_business_days !== undefined) {
      requireNumber(schedule.publication_delay_business_days, `publication_schedules.${dataset}.publication_delay_business_days`, { integer: true, minimum: 0 });
    }
    if (schedule.knowable_delay_seconds < schedule.ingest_delay_seconds) fail(`publication_schedules.${dataset}`, "knowable delay cannot precede ingest delay");
  }

  if (!Array.isArray(manifest.regimes)) fail("regimes", "must be an array");
  for (const [index, regimeValue] of manifest.regimes.entries()) {
    const path = `regimes[${index}]`;
    const regime = requireObject(regimeValue, path);
    rejectUnknown(regime, path, ["regime_id", "security_ids", "start_date", "end_date", "effects"]);
    requireString(regime.regime_id, `${path}.regime_id`, ID_PATTERN);
    requireDate(regime.start_date, `${path}.start_date`);
    requireDate(regime.end_date, `${path}.end_date`);
    if (regime.end_date < regime.start_date) fail(path, "end_date cannot precede start_date");
    if (!Array.isArray(regime.security_ids) || regime.security_ids.length === 0) fail(`${path}.security_ids`, "must be non-empty");
    for (const securityId of regime.security_ids) if (securityId !== "*" && !securityIds.has(securityId)) fail(`${path}.security_ids`, `contains unknown security ${securityId}`);
    const effects = requireObject(regime.effects, `${path}.effects`);
    rejectUnknown(effects, `${path}.effects`, ["price_change_daily_pct", "utilization_change_daily_points", "fee_change_daily_bps", "lendable_change_daily_pct", "volume_multiplier_daily", "call_volume_multiplier"]);
    for (const [field, value] of Object.entries(effects)) requireNumber(value, `${path}.effects.${field}`);
    if (effects.call_volume_multiplier !== undefined && effects.call_volume_multiplier <= 0) {
      fail(`${path}.effects.call_volume_multiplier`, "must be greater than 0");
    }
  }

  for (const collection of ["events", "truth_events", "faults"]) if (!Array.isArray(manifest[collection])) fail(collection, "must be an array");
  for (const [index, event] of manifest.events.entries()) {
    const path = `events[${index}]`;
    requireObject(event, path);
    rejectUnknown(event, path, ["event_id", "security_id", "issuer_id", "event_type", "event_time", "event_importance", "description"]);
    requireString(event.event_id, `${path}.event_id`, ID_PATTERN);
    if (!securityIds.has(event.security_id)) fail(`${path}.security_id`, "must reference the fictional universe");
    requireString(event.issuer_id, `${path}.issuer_id`, ID_PATTERN);
    requireString(event.event_type, `${path}.event_type`, ID_PATTERN);
    requireTimestamp(event.event_time, `${path}.event_time`);
    if (!["LOW", "MEDIUM", "HIGH"].includes(event.event_importance)) fail(`${path}.event_importance`, "must be LOW, MEDIUM, or HIGH");
    requireString(event.description, `${path}.description`);
  }
  for (const [index, truth] of manifest.truth_events.entries()) {
    const path = `truth_events[${index}]`;
    requireObject(truth, path);
    rejectUnknown(truth, path, ["truth_event_id", "security_id", "event_type", "start_time", "end_time", "outcome_horizon_days", "outcome_label", "causal_driver", "notes"]);
    requireString(truth.truth_event_id, `${path}.truth_event_id`, ID_PATTERN);
    if (!securityIds.has(truth.security_id)) fail(`${path}.security_id`, "must reference the fictional universe");
    requireTimestamp(truth.start_time, `${path}.start_time`);
    requireTimestamp(truth.end_time, `${path}.end_time`);
    requireNumber(truth.outcome_horizon_days, `${path}.outcome_horizon_days`, { integer: true, minimum: 1 });
    if (!["POSITIVE", "NEGATIVE", "NEAR_MISS", "CONTEXT_ONLY"].includes(truth.outcome_label)) fail(`${path}.outcome_label`, "is not supported");
    requireString(truth.causal_driver, `${path}.causal_driver`, ID_PATTERN);
    if (typeof truth.notes !== "string") fail(`${path}.notes`, "must be a string");
  }

  const faultIds = new Set();
  const pointTargets = new Map();
  const staleRanges = [];
  for (const [index, faultValue] of manifest.faults.entries()) {
    const path = `faults[${index}]`;
    const fault = requireObject(faultValue, path);
    requireString(fault.fault_id, `${path}.fault_id`, ID_PATTERN);
    if (faultIds.has(fault.fault_id)) fail(`${path}.fault_id`, "must be unique");
    faultIds.add(fault.fault_id);
    if (!FAULT_TYPES.has(fault.type)) fail(`${path}.type`, "is not supported");
    requireString(fault.expected_gate, `${path}.expected_gate`, ID_PATTERN);
    if (fault.type === "STALE_SOURCE") {
      rejectUnknown(fault, path, ["fault_id", "type", "dataset", "security_id", "after_date", "expected_gate"]);
      if (!datasets.has(fault.dataset)) fail(`${path}.dataset`, "must name a generated dataset");
      if (!securityIds.has(fault.security_id)) fail(`${path}.security_id`, "must reference the fictional universe");
      requireDate(fault.after_date, `${path}.after_date`);
      staleRanges.push(fault);
      continue;
    }
    validateTarget(fault.target, `${path}.target`, datasets);
    const targetKey = `${fault.target.dataset}|${fault.target.security_id}|${fault.target.record_date}|${fault.target.revision ?? 1}`;
    if (pointTargets.has(targetKey)) fail(path, `overlaps point target from ${pointTargets.get(targetKey)}`);
    pointTargets.set(targetKey, fault.fault_id);
    if (["LATE_INGESTION", "OUT_OF_ORDER_RECORD"].includes(fault.type)) {
      rejectUnknown(fault, path, ["fault_id", "type", "target", "delay_seconds", "expected_gate"]);
      requireNumber(fault.delay_seconds, `${path}.delay_seconds`, { integer: true, minimum: 1 });
    } else if (["BACKFILL_REVISION", "POST_DECISION_REVISION"].includes(fault.type)) {
      rejectUnknown(fault, path, ["fault_id", "type", "target", "field", "value", "first_knowable_at", "decision_at", "expected_gate"]);
      requireString(fault.field, `${path}.field`);
      requireNumber(fault.value, `${path}.value`);
      requireTimestamp(fault.first_knowable_at, `${path}.first_knowable_at`);
      if (fault.type === "POST_DECISION_REVISION") {
        requireTimestamp(fault.decision_at, `${path}.decision_at`);
        if (Date.parse(fault.first_knowable_at) <= Date.parse(fault.decision_at)) fail(path, "first_knowable_at must be after decision_at");
      }
    } else if (fault.type === "BAD_UNIT") {
      rejectUnknown(fault, path, ["fault_id", "type", "target", "field", "factor", "expected_gate"]);
      requireString(fault.field, `${path}.field`);
      requireNumber(fault.factor, `${path}.factor`);
      if (fault.factor === 1) fail(`${path}.factor`, "must not be 1");
    }
  }
  for (const [targetKey, faultId] of pointTargets) {
    const [dataset, securityId, recordDate] = targetKey.split("|");
    const overlapping = staleRanges.find((fault) => fault.dataset === dataset && fault.security_id === securityId && recordDate > fault.after_date);
    if (overlapping) fail("faults", `${faultId} targets a row removed by ${overlapping.fault_id}`);
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

export function canonicalScenarioManifest(manifest) {
  return `${JSON.stringify(stableValue(manifest), null, 2)}\n`;
}

async function readManifestFile(path, rootPath, stack = []) {
  const resolvedPath = await realpath(resolve(path));
  const root = await realpath(resolve(rootPath));
  if (resolvedPath !== root && !resolvedPath.startsWith(`${root}${sep}`)) throw new Error("scenario manifest extends path escapes its scenario directory");
  if (stack.includes(resolvedPath)) throw new Error("scenario manifest extends cycle detected");
  const parsed = JSON.parse(await readFile(resolvedPath, "utf8"));
  if (!parsed.extends) return parsed;
  requireString(parsed.extends, "extends", /^[A-Za-z0-9._-]+\.json$/);
  const base = await readManifestFile(resolve(dirname(resolvedPath), parsed.extends), root, [...stack, resolvedPath]);
  const { extends: ignored, $schema: ignoredSchema, ...overlay } = parsed;
  return { ...base, ...overlay };
}

export async function loadScenarioConfiguration(options, datasets) {
  if (options.manifestPath && options.scenarioManifest) throw new Error("provide manifestPath or scenarioManifest, not both");
  let manifest;
  if (options.scenarioManifest) {
    manifest = structuredClone(options.scenarioManifest);
    if (manifest.extends) throw new Error("programmatic scenarioManifest cannot use extends; pass manifestPath instead");
  } else {
    const manifestPath = resolve(options.manifestPath ?? DEFAULT_SCENARIO_MANIFEST_PATH);
    manifest = await readManifestFile(manifestPath, dirname(manifestPath));
  }
  if (options.scenarioId !== undefined) manifest.scenario_id = options.scenarioId;
  if (options.seed !== undefined) manifest.seed = options.seed;
  if (options.generatedAt !== undefined) manifest.generated_at = options.generatedAt;
  validateManifest(manifest, datasets);
  const archivedText = canonicalScenarioManifest(manifest);
  return {
    manifest,
    archivedText,
    sha256: createHash("sha256").update(archivedText).digest("hex"),
  };
}

function hashUnit(text) {
  let hash = 2166136261;
  for (const character of text) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  return hash / 0xffffffff;
}

export function namedPhase(manifest, streamName, key) {
  const salt = manifest.random_streams[streamName];
  if (!salt) throw new Error(`unknown random stream ${streamName}`);
  return hashUnit(`${manifest.seed}:${streamName}:${salt}:${key}`) * Math.PI * 2;
}

export function regimeEffects(manifest, securityId, date, dates) {
  const effects = {
    priceChangePct: 0,
    utilizationPoints: 0,
    feeChangeBps: 0,
    lendableChangePct: 0,
    volumeMultiplier: 1,
    callVolumeMultiplier: 1,
  };
  for (const regime of manifest.regimes) {
    if (!(regime.security_ids.includes("*") || regime.security_ids.includes(securityId))) continue;
    if (date < regime.start_date || date > regime.end_date) continue;
    const startIndex = dates.findIndex((candidate) => candidate >= regime.start_date);
    const currentIndex = dates.indexOf(date);
    const elapsed = Math.max(0, currentIndex - startIndex);
    effects.priceChangePct += (regime.effects.price_change_daily_pct ?? 0) * elapsed;
    effects.utilizationPoints += (regime.effects.utilization_change_daily_points ?? 0) * elapsed;
    effects.feeChangeBps += (regime.effects.fee_change_daily_bps ?? 0) * Math.max(1, elapsed);
    effects.lendableChangePct += (regime.effects.lendable_change_daily_pct ?? 0) * elapsed;
    effects.volumeMultiplier *= 1 + (regime.effects.volume_multiplier_daily ?? 0) * Math.max(1, elapsed);
    effects.callVolumeMultiplier *= regime.effects.call_volume_multiplier ?? 1;
  }
  return effects;
}

export function scheduledTimestamps(manifest, dataset, date) {
  const schedule = manifest.publication_schedules[dataset];
  if (!schedule) throw new Error(`missing publication schedule for ${dataset}`);
  const observedDate = new Date(`${date}T${schedule.observed_time_utc}Z`);
  const ingestedDate = new Date(observedDate.getTime() + schedule.ingest_delay_seconds * 1000);
  const knowableDate = new Date(observedDate.getTime() + schedule.knowable_delay_seconds * 1000);
  return {
    observed: observedDate.toISOString().replace(".000Z", "Z"),
    ingested: ingestedDate.toISOString().replace(".000Z", "Z"),
    knowable: knowableDate.toISOString().replace(".000Z", "Z"),
  };
}

function rowObject(headers, row) {
  return Object.fromEntries(headers.map((header, index) => [header, row[index]]));
}

function objectRow(headers, object) {
  return headers.map((header) => object[header] ?? "");
}

function recordDate(record) {
  return record.business_date ?? record.trade_date ?? record.settlement_date ?? record.event_time?.slice(0, 10);
}

function findTarget(rowsByDataset, datasets, fault) {
  const target = fault.target;
  const headers = datasets[target.dataset];
  const matches = rowsByDataset[target.dataset]
    .map((row, index) => ({ index, record: rowObject(headers, row) }))
    .filter(({ record }) => record.security_id === target.security_id
      && recordDate(record) === target.record_date
      && Number(record.revision) === (target.revision ?? 1));
  if (matches.length !== 1) throw new Error(`fault ${fault.fault_id} must match exactly one row; matched ${matches.length}`);
  return { headers, ...matches[0] };
}

function shiftTimestamp(timestamp, seconds) {
  return new Date(Date.parse(timestamp) + seconds * 1000).toISOString().replace(".000Z", "Z");
}

function logicalRecordId(record) {
  return record.observation_id ?? record.report_id ?? record.event_id ?? record.loan_id;
}

export function applyScenarioFaults(rowsByDataset, datasets, faults) {
  for (const fault of faults) {
    if (fault.type === "STALE_SOURCE") {
      const headers = datasets[fault.dataset];
      rowsByDataset[fault.dataset] = rowsByDataset[fault.dataset].filter((row) => {
        const record = rowObject(headers, row);
        return record.security_id !== fault.security_id || recordDate(record) <= fault.after_date;
      });
      continue;
    }

    const target = findTarget(rowsByDataset, datasets, fault);
    const record = target.record;
    if (["LATE_INGESTION", "OUT_OF_ORDER_RECORD"].includes(fault.type)) {
      record.ingested_at = shiftTimestamp(record.ingested_at, fault.delay_seconds);
      record.first_knowable_at = shiftTimestamp(record.first_knowable_at, fault.delay_seconds);
      rowsByDataset[fault.target.dataset][target.index] = objectRow(target.headers, record);
      if (fault.type === "OUT_OF_ORDER_RECORD") {
        const [row] = rowsByDataset[fault.target.dataset].splice(target.index, 1);
        rowsByDataset[fault.target.dataset].push(row);
      }
      continue;
    }

    if (fault.type === "BAD_UNIT") {
      const numeric = Number(record[fault.field]);
      if (!target.headers.includes(fault.field) || !Number.isFinite(numeric) || numeric === 0) {
        throw new Error(`fault ${fault.fault_id} BAD_UNIT field must be a non-zero numeric field`);
      }
      record[fault.field] = numeric * fault.factor;
      rowsByDataset[fault.target.dataset][target.index] = objectRow(target.headers, record);
      continue;
    }

    if (!target.headers.includes(fault.field) || !Number.isFinite(Number(record[fault.field]))) {
      throw new Error(`fault ${fault.fault_id} revision field must be numeric`);
    }
    if (fault.type === "POST_DECISION_REVISION"
      && Date.parse(record.first_knowable_at) > Date.parse(fault.decision_at)) {
      throw new Error(`fault ${fault.fault_id} base revision is not eligible at decision_at`);
    }
    const recordId = logicalRecordId(record);
    const maxRevision = Math.max(...rowsByDataset[fault.target.dataset]
      .map((row) => rowObject(target.headers, row))
      .filter((candidate) => logicalRecordId(candidate) === recordId)
      .map((candidate) => Number(candidate.revision)));
    const revision = {
      ...record,
      [fault.field]: fault.value,
      revision: maxRevision + 1,
      ingested_at: fault.first_knowable_at,
      first_knowable_at: fault.first_knowable_at,
    };
    rowsByDataset[fault.target.dataset].push(objectRow(target.headers, revision));
  }
  return faults.map((fault) => fault.fault_id);
}
