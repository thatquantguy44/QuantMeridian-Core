import {
  NAAIM_ATTRIBUTION,
  NAAIM_DATASET,
  NAAIM_DELAY_NOTICE,
  NAAIM_SCHEMA_VERSION,
  type NaaimSelection,
} from "./contracts";

const fail = (code: string): never => { throw new Error(code); };
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail("INVALID_ARTIFACT");
  return value as Record<string, unknown>;
};
const text = (value: unknown, code = "INVALID_ARTIFACT"): string => {
  if (typeof value !== "string" || !value.trim() || value.length > 512) return fail(code);
  return value;
};
function date(value: unknown): string {
  const result = text(value, "INVALID_DATE");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) return fail("INVALID_DATE");
  const parsed = Date.parse(`${result}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== result) return fail("INVALID_DATE");
  return result;
}
function timestamp(value: unknown): string {
  const result = text(value, "INVALID_TIMESTAMP");
  if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?Z$/.test(result)) return fail("INVALID_TIMESTAMP");
  if (!Number.isFinite(Date.parse(result))) return fail("INVALID_TIMESTAMP");
  return result;
}
function decimal(value: unknown): number {
  if (typeof value !== "string" || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(value)) return fail("INVALID_VALUE");
  const result = Number(value);
  if (!Number.isFinite(result)) return fail("INVALID_VALUE");
  return result;
}

/** Validates a source-owned exchange artifact without retaining provider payloads. */
export function normalizeNaaimArtifact(value: unknown): NaaimSelection {
  const artifact = object(value);
  if (artifact.schema_version !== NAAIM_SCHEMA_VERSION) return fail("SCHEMA_VERSION");
  const artifactGeneratedAt = timestamp(artifact.generated_at);
  const provenance = object(artifact.provenance);
  if (provenance.source !== "NAAIM Exposure Index®" || provenance.dataset !== NAAIM_DATASET ||
      provenance.attribution !== NAAIM_ATTRIBUTION || provenance.knowledge_basis !== "CURRENT_VINTAGE" ||
      provenance.display_name !== "NAAIM Exposure Index — 3-month-delayed public data" ||
      provenance.delayed_public_display !== true || provenance.provider_delay_months !== 3 ||
      provenance.delay_notice !== NAAIM_DELAY_NOTICE || !text(provenance.authorized_research_use_reference, "UNAUTHORIZED_ARTIFACT")) {
    return fail("SOURCE_IDENTITY");
  }
  if (!Array.isArray(artifact.observations) || !artifact.observations.length || artifact.observations.length > 500) return fail("HISTORY_LIMIT");
  const observations = artifact.observations.map(raw => {
    const row = object(raw), asOfDate = date(row.as_of_date), firstSeenAt = timestamp(row.first_seen_at);
    const captureId = text(row.capture_id, "INVALID_LINEAGE");
    if (!/^[a-f0-9]{64}$/.test(captureId)) return fail("INVALID_LINEAGE");
    return { asOfDate, exposure: decimal(row.value), firstSeenAt, versionToken: `naaim-capture:${captureId}` };
  }).sort((a, b) => a.asOfDate.localeCompare(b.asOfDate));
  for (let index = 1; index < observations.length; index++) {
    if (observations[index - 1].asOfDate === observations[index].asOfDate) return fail("DUPLICATE_DATE");
  }
  const latest = observations.at(-1)!;
  return {
    schemaVersion: NAAIM_SCHEMA_VERSION,
    artifactGeneratedAt,
    observations,
    provenance: {
      source: "NAAIM Exposure Index®",
      dataset: NAAIM_DATASET,
      attribution: NAAIM_ATTRIBUTION,
      displayName: "NAAIM Exposure Index — 3-month-delayed public data",
      delayedPublicDisplay: true,
      providerDelayMonths: 3,
      delayNotice: NAAIM_DELAY_NOTICE,
      knowledgeBasis: "CURRENT_VINTAGE",
      latestAsOfDate: latest.asOfDate,
    },
  };
}
