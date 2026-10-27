import {
  type PointInTimeRecord,
  type ReadonlySqueezeCsvBundle,
  type SqueezeBundleSnapshot,
  type SqueezeCsvBundle,
  type SqueezeModelDatasetFile,
  type SqueezeModelRecord,
  SQUEEZE_MODEL_DATASET_FILES,
} from "./contracts";

function timestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a valid ISO-8601 timestamp`);
  return parsed;
}

export function selectLatestRevisionsAsOf<T extends PointInTimeRecord>(
  rows: readonly T[],
  decisionAt: string,
  identityKey: (row: T) => string,
): T[] {
  const cutoff = timestamp(decisionAt, "decisionAt");
  const selected = new Map<string, { row: T; index: number; knowableAt: number }>();

  rows.forEach((row, index) => {
    const knowableAt = timestamp(row.first_knowable_at, "first_knowable_at");
    if (knowableAt > cutoff) return;
    const key = identityKey(row);
    const current = selected.get(key);
    if (!current || row.revision > current.row.revision || (row.revision === current.row.revision && knowableAt > current.knowableAt)) {
      selected.set(key, { row, index, knowableAt });
    }
  });

  return [...selected.values()].sort((left, right) => left.index - right.index).map(({ row }) => row);
}

function recordIdentity(dataset: SqueezeModelDatasetFile, row: SqueezeModelRecord): string {
  if (dataset === "securities.csv") {
    const security = row as SqueezeCsvBundle["datasets"]["securities.csv"][number];
    return `${security.security_id}|${security.effective_from}`;
  }
  if (dataset === "short_interest.csv") return (row as SqueezeCsvBundle["datasets"]["short_interest.csv"][number]).report_id;
  if (dataset === "borrow_events.csv") return (row as SqueezeCsvBundle["datasets"]["borrow_events.csv"][number]).event_id;
  if (dataset === "security_events.csv") return (row as SqueezeCsvBundle["datasets"]["security_events.csv"][number]).event_id;
  return (row as Exclude<SqueezeModelRecord, SqueezeCsvBundle["datasets"]["securities.csv"][number]> & { observation_id: string }).observation_id;
}

export function buildSqueezeBundleAsOf(bundle: ReadonlySqueezeCsvBundle, decisionAt: string): SqueezeBundleSnapshot {
  timestamp(decisionAt, "decisionAt");
  const datasets = Object.fromEntries(SQUEEZE_MODEL_DATASET_FILES.map((dataset) => {
    const rows = bundle.datasets[dataset] as unknown as readonly PointInTimeRecord[];
    const selected = selectLatestRevisionsAsOf(rows, decisionAt, (row) => recordIdentity(dataset, row as SqueezeModelRecord));
    return [dataset, selected];
  })) as SqueezeCsvBundle["datasets"];
  return { ...bundle, decisionAt, datasets };
}
