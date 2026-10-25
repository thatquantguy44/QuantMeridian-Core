import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schemaDocumentV10Json from "../../../../contracts/squeeze_radar/v1/csv-records-1.0.schema.json";
import schemaDocumentV11Json from "../../../../contracts/squeeze_radar/v1/csv-records-1.1.schema.json";
import {
  type SqueezeCsvBundle,
  type DeepReadonly,
  type SqueezeManifestRecord,
  type SqueezeModelDatasetFile,
  type SqueezeModelDatasets,
  type SqueezeModelRecord,
  SQUEEZE_MODEL_DATASET_FILES,
} from "../../squeezeRadar/contracts";
import type { DataDictionaryRecord } from "../../squeezeRadar/contracts.generated";

const VALIDATED_SQUEEZE_BUNDLE: unique symbol = Symbol("validated-squeeze-csv-bundle");

export type ValidatedSqueezeCsvBundle = DeepReadonly<SqueezeCsvBundle> & {
  readonly [VALIDATED_SQUEEZE_BUNDLE]: true;
};

export function isValidatedSqueezeCsvBundle(value: unknown): value is ValidatedSqueezeCsvBundle {
  return typeof value === "object"
    && value !== null
    && (value as Record<PropertyKey, unknown>)[VALIDATED_SQUEEZE_BUNDLE] === true;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export type SqueezeCsvContractErrorCode =
  | "FILE_MISSING"
  | "CSV_PARSE_INVALID"
  | "HEADER_MISMATCH"
  | "MANIFEST_INVALID"
  | "RECORD_INVALID"
  | "REFERENCE_INVALID"
  | "DUPLICATE_REVISION"
  | "CLOCK_INVALID";

export class SqueezeCsvContractError extends Error {
  constructor(
    public readonly code: SqueezeCsvContractErrorCode,
    public readonly dataset: string,
    public readonly issues: string[],
  ) {
    super(`${code} in ${dataset}: ${issues.join("; ")}`);
    this.name = "SqueezeCsvContractError";
  }
}

type RecordSchema = {
  properties: Record<string, unknown>;
  required?: string[];
};

type SchemaDocument = {
  $id: string;
  $defs: Record<string, RecordSchema>;
};

const schemaDocuments = {
  "1.0": schemaDocumentV10Json as SchemaDocument,
  "1.1": schemaDocumentV11Json as SchemaDocument,
} as const;

const SCHEMA_NAMES = {
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
  "data_dictionary.csv": "DataDictionaryRecord",
} as const;

type LoadedDataset = keyof typeof SCHEMA_NAMES;

const ajv = new Ajv2020({ strict: true, allErrors: true, coerceTypes: true });
ajv.addKeyword({ keyword: "x-unit", schemaType: "string" });
addFormats(ajv);
for (const schemaDocument of Object.values(schemaDocuments)) ajv.addSchema(schemaDocument);

const validators = new Map<string, ValidateFunction>();

function validatorFor(schemaDocument: SchemaDocument, dataset: LoadedDataset): ValidateFunction {
  const key = `${schemaDocument.$id}|${dataset}`;
  const cached = validators.get(key);
  if (cached) return cached;
  const schemaName = SCHEMA_NAMES[dataset];
  const validator = ajv.compile({ $ref: `${schemaDocument.$id}#/$defs/${schemaName}` });
  validators.set(key, validator);
  return validator;
}

function schemaFor(schemaDocument: SchemaDocument, dataset: LoadedDataset): RecordSchema {
  return schemaDocument.$defs[SCHEMA_NAMES[dataset]];
}

function validationIssues(errors: ErrorObject[] | null | undefined, rowNumber: number): string[] {
  return (errors ?? []).map((error) => `row ${rowNumber}${error.instancePath || "/"} ${error.message ?? "is invalid"}`);
}

function parseCsv(text: string, dataset: string): { header: string[]; rows: string[][] } {
  const parsed: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      if (row.some((value) => value !== "")) parsed.push(row);
      row = [];
      field = "";
    } else field += character;
  }

  if (quoted) throw new SqueezeCsvContractError("CSV_PARSE_INVALID", dataset, ["unclosed quoted field"]);
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    if (row.some((value) => value !== "")) parsed.push(row);
  }
  if (parsed.length === 0) throw new SqueezeCsvContractError("CSV_PARSE_INVALID", dataset, ["file is empty"]);
  return { header: parsed[0], rows: parsed.slice(1) };
}

function readText(rootDir: string, dataset: string): string {
  try {
    return readFileSync(resolve(rootDir, dataset), "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unable to read file";
    throw new SqueezeCsvContractError("FILE_MISSING", dataset, [message]);
  }
}

function readAndValidate(rootDir: string, dataset: LoadedDataset, schemaDocument: SchemaDocument): Record<string, unknown>[] {
  const { header, rows } = parseCsv(readText(rootDir, dataset), dataset);
  const schema = schemaFor(schemaDocument, dataset);
  const expectedHeader = Object.keys(schema.properties);
  if (header.length !== expectedHeader.length || header.some((field, index) => field !== expectedHeader[index])) {
    throw new SqueezeCsvContractError("HEADER_MISMATCH", dataset, [
      `expected ${expectedHeader.join(",")}`,
      `received ${header.join(",")}`,
    ]);
  }

  const required = new Set(schema.required ?? []);
  const validate = validatorFor(schemaDocument, dataset);
  return rows.map((values, index) => {
    if (values.length !== header.length) {
      throw new SqueezeCsvContractError("CSV_PARSE_INVALID", dataset, [`row ${index + 2} has ${values.length} fields; expected ${header.length}`]);
    }
    const record = Object.fromEntries(header.flatMap((field, column) => {
      const value = values[column];
      return value === "" && !required.has(field) ? [] : [[field, value]];
    }));
    if (!validate(record)) {
      const code = dataset === "manifest.csv" ? "MANIFEST_INVALID" : "RECORD_INVALID";
      throw new SqueezeCsvContractError(code, dataset, validationIssues(validate.errors, index + 2));
    }
    return record;
  });
}

function safeRelativePath(rootDir: string, relativePath: string, dataset: string): string {
  const root = resolve(rootDir);
  const candidate = resolve(root, relativePath);
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    throw new SqueezeCsvContractError("MANIFEST_INVALID", dataset, [`path escapes bundle root: ${relativePath}`]);
  }
  return candidate;
}

function recordIdentity(dataset: SqueezeModelDatasetFile, record: SqueezeModelRecord): string {
  if (dataset === "securities.csv") {
    const row = record as SqueezeModelDatasets["securities.csv"][number];
    return `${row.security_id}|${row.effective_from}`;
  }
  if (dataset === "short_interest.csv") return (record as SqueezeModelDatasets["short_interest.csv"][number]).report_id;
  if (dataset === "borrow_events.csv") return (record as SqueezeModelDatasets["borrow_events.csv"][number]).event_id;
  if (dataset === "security_events.csv") return (record as SqueezeModelDatasets["security_events.csv"][number]).event_id;
  return (record as { observation_id: string }).observation_id;
}

function verifyRecordIntegrity(manifest: SqueezeManifestRecord, datasets: SqueezeModelDatasets): void {
  const securities = datasets["securities.csv"];
  const securityIds = new Set(securities.map((row) => row.security_id));
  const issuerIds = new Set(securities.flatMap((row) => row.issuer_id ? [row.issuer_id] : []));
  const securitiesById = new Map(securities.map((row) => [row.security_id, row]));

  for (const dataset of SQUEEZE_MODEL_DATASET_FILES) {
    const seen = new Set<string>();
    for (const record of datasets[dataset] as SqueezeModelRecord[]) {
      if (record.scenario_id !== manifest.scenario_id) {
        throw new SqueezeCsvContractError("REFERENCE_INVALID", dataset, [`scenario_id ${record.scenario_id} does not match manifest ${manifest.scenario_id}`]);
      }
      if (record.security_id && !securityIds.has(record.security_id)) {
        throw new SqueezeCsvContractError("REFERENCE_INVALID", dataset, [`unknown security_id ${record.security_id}`]);
      }
      if ("issuer_id" in record && record.issuer_id && !issuerIds.has(record.issuer_id)) {
        throw new SqueezeCsvContractError("REFERENCE_INVALID", dataset, [`unknown issuer_id ${record.issuer_id}`]);
      }
      const revisionKey = `${recordIdentity(dataset, record)}|${record.revision}`;
      if (seen.has(revisionKey)) {
        throw new SqueezeCsvContractError("DUPLICATE_REVISION", dataset, [`duplicate logical record and revision ${revisionKey}`]);
      }
      seen.add(revisionKey);

      const publishedAt = "published_at" in record ? Date.parse(record.published_at as string) : undefined;
      const observedAt = Date.parse(record.observed_at);
      const ingestedAt = Date.parse(record.ingested_at);
      const firstKnowableAt = Date.parse(record.first_knowable_at);
      const clockIssues = [
        publishedAt !== undefined && publishedAt > firstKnowableAt ? "published_at is after first_knowable_at" : null,
        observedAt > ingestedAt ? "observed_at is after ingested_at" : null,
        ingestedAt > firstKnowableAt ? "ingested_at is after first_knowable_at" : null,
      ].filter((issue): issue is string => issue !== null);
      if (clockIssues.length) throw new SqueezeCsvContractError("CLOCK_INVALID", dataset, [`${recordIdentity(dataset, record)}: ${clockIssues.join(", ")}`]);
    }
  }

  for (const row of datasets["etf_snapshots.csv"]) {
    const security = securitiesById.get(row.security_id);
    if (security?.asset_type !== "ETF") {
      throw new SqueezeCsvContractError("REFERENCE_INVALID", "etf_snapshots.csv", [`security_id ${row.security_id} is not an ETF`]);
    }
  }
}

export function loadSqueezeCsvBundle(bundleRoot: string): ValidatedSqueezeCsvBundle {
  const rootDir = resolve(bundleRoot);
  const parsedManifest = parseCsv(readText(rootDir, "manifest.csv"), "manifest.csv");
  const versionColumn = parsedManifest.header.indexOf("dataset_version");
  const datasetVersion = versionColumn >= 0 ? parsedManifest.rows[0]?.[versionColumn] : undefined;
  const schemaDocument = schemaDocuments[datasetVersion as keyof typeof schemaDocuments];
  if (!schemaDocument) {
    throw new SqueezeCsvContractError("MANIFEST_INVALID", "manifest.csv", [`unsupported dataset_version ${datasetVersion ?? "missing"}`]);
  }
  const manifestRows = readAndValidate(rootDir, "manifest.csv", schemaDocument) as unknown as SqueezeManifestRecord[];
  if (manifestRows.length !== 1) {
    throw new SqueezeCsvContractError("MANIFEST_INVALID", "manifest.csv", [`expected one row; received ${manifestRows.length}`]);
  }
  const manifest = manifestRows[0];
  const modelRoot = safeRelativePath(rootDir, manifest.model_input_path, "manifest.csv");
  const truthRoot = resolve(rootDir, "_truth");
  const truthPath = safeRelativePath(rootDir, manifest.truth_path, "manifest.csv");
  if (modelRoot === truthRoot || modelRoot.startsWith(`${truthRoot}${sep}`)) {
    throw new SqueezeCsvContractError("MANIFEST_INVALID", "manifest.csv", ["model_input_path cannot resolve under _truth/"]);
  }
  if (truthPath !== truthRoot && !truthPath.startsWith(`${truthRoot}${sep}`)) {
    throw new SqueezeCsvContractError("MANIFEST_INVALID", "manifest.csv", ["truth_path must remain under _truth/"]);
  }

  const datasets = Object.fromEntries(SQUEEZE_MODEL_DATASET_FILES.map((dataset) => [
    dataset,
    readAndValidate(modelRoot, dataset, schemaDocument),
  ])) as unknown as SqueezeModelDatasets;
  const dataDictionary = readAndValidate(modelRoot, "data_dictionary.csv", schemaDocument) as unknown as DataDictionaryRecord[];
  verifyRecordIntegrity(manifest, datasets);
  const bundle = { rootDir, manifest, datasets, dataDictionary } as SqueezeCsvBundle;
  Object.defineProperty(bundle, VALIDATED_SQUEEZE_BUNDLE, { value: true });
  return deepFreeze(bundle) as unknown as ValidatedSqueezeCsvBundle;
}
