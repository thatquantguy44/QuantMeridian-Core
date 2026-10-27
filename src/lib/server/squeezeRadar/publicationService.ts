import { createHash } from "node:crypto";

import {
  type SqueezeCsvBundle,
  type SqueezeManifestRecord,
  type SqueezeModelDatasetFile,
  SQUEEZE_MODEL_DATASET_FILES,
} from "../../squeezeRadar/contracts";
import { buildSqueezeBundleAsOf } from "../../squeezeRadar/pointInTime";
import {
  SQUEEZE_SIM_PUBLICATION_CONTRACT_VERSION,
  type SqueezeDatasetCoverage,
  type SqueezeLastGoodRead,
  type SqueezeLastGoodReadOptions,
  type SqueezePublicationDescriptor,
  type SqueezePublicationClock,
  type SqueezePublicationErrorCode,
  type SqueezePublicationFailure,
  type SqueezePublishOptions,
  type SqueezePublishResult,
  type SqueezeSimPublication,
} from "../../squeezeRadar/publication";
import {
  isValidatedSqueezeCsvBundle,
  loadSqueezeCsvBundle,
  type ValidatedSqueezeCsvBundle,
} from "./loadCsvBundle";

export class SqueezePublicationError extends Error {
  constructor(
    public readonly code: SqueezePublicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SqueezePublicationError";
  }
}

function canonicalUtcTimestamp(value: string, label: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (match === null) {
    throw new SqueezePublicationError("CLOCK_INVALID", `${label} must be a canonical UTC timestamp`);
  }
  const parsed = Date.parse(value);
  const normalized = `${value.slice(0, 19)}.${(match[7] ?? "").padEnd(3, "0")}Z`;
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== normalized) {
    throw new SqueezePublicationError("CLOCK_INVALID", `${label} must be a canonical UTC timestamp`);
  }
  return parsed;
}

function canonicalUtcValue(value: string, label: string): string {
  const iso = new Date(canonicalUtcTimestamp(value, label)).toISOString();
  return iso.endsWith(".000Z") ? `${iso.slice(0, -5)}Z` : iso;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, entry]) => [key, canonicalValue(entry)]));
  }
  return value;
}

function sha256Id(prefix: string, material: unknown): string {
  return `${prefix}_${createHash("sha256").update(JSON.stringify(canonicalValue(material))).digest("hex")}`;
}

function streamId(manifest: SqueezeManifestRecord): string {
  return sha256Id("sqzstream", {
    datasetVersion: manifest.dataset_version,
    scenarioId: manifest.scenario_id,
    scenarioManifestId: "scenario_manifest_id" in manifest ? manifest.scenario_manifest_id : null,
    scenarioManifestVersion: "scenario_manifest_version" in manifest ? manifest.scenario_manifest_version : null,
    scenarioManifestSha256: "scenario_manifest_sha256" in manifest ? manifest.scenario_manifest_sha256 : null,
    seed: manifest.seed,
    generatorVersion: manifest.generator_version,
    baseCurrency: manifest.base_currency,
    calendarStart: manifest.calendar_start,
    calendarEnd: manifest.calendar_end,
  });
}

function snapshotId(publication: Omit<SqueezeSimPublication, "snapshotId" | "publishedAt" | "coverage">): string {
  const datasets = Object.fromEntries(SQUEEZE_MODEL_DATASET_FILES.map((dataset) => [
    dataset,
    publication.datasets[dataset]
      .map((row) => JSON.stringify(canonicalValue(row)))
      .sort(),
  ]));
  const material = canonicalValue({
    contractVersion: publication.contractVersion,
    streamId: publication.streamId,
    dataMode: publication.dataMode,
    scenarioId: publication.scenarioId,
    datasetVersion: publication.datasetVersion,
    decisionAt: publication.decisionAt,
    datasets,
  });
  return sha256Id("sqzsim", material);
}

function datasetCoverage(
  datasets: SqueezeSimPublication["datasets"],
): Record<SqueezeModelDatasetFile, SqueezeDatasetCoverage> {
  return Object.fromEntries(SQUEEZE_MODEL_DATASET_FILES.map((dataset) => {
    const rows = datasets[dataset];
    const latest = rows.reduce<string | null>((current, row) => (
      current === null || Date.parse(row.first_knowable_at) > Date.parse(current)
        ? row.first_knowable_at
        : current
    ), null);
    return [dataset, { rowCount: rows.length, latestFirstKnowableAt: latest }];
  })) as Record<SqueezeModelDatasetFile, SqueezeDatasetCoverage>;
}

function clonePublication(publication: SqueezeSimPublication): SqueezeSimPublication {
  return structuredClone(publication);
}

function descriptor(publication: SqueezeSimPublication): SqueezePublicationDescriptor {
  return {
    streamId: publication.streamId,
    snapshotId: publication.snapshotId,
    decisionAt: publication.decisionAt,
    publishedAt: publication.publishedAt,
  };
}

function publicFailure(error: unknown): SqueezePublicationFailure {
  if (error instanceof SqueezePublicationError) return { code: error.code, message: error.message };
  return { code: "BUNDLE_INVALID", message: "Squeeze bundle validation failed" };
}

function createSqueezeSimPublication(
  bundle: ValidatedSqueezeCsvBundle,
  options: SqueezePublishOptions,
  acceptedAt: string,
): SqueezeSimPublication {
  const decisionAtMs = canonicalUtcTimestamp(options.decisionAt, "decisionAt");
  const publishedAtMs = canonicalUtcTimestamp(acceptedAt, "clock.now");
  if (publishedAtMs < decisionAtMs) {
    throw new SqueezePublicationError("CLOCK_INVALID", "publishedAt cannot precede decisionAt");
  }
  const decisionAt = canonicalUtcValue(options.decisionAt, "decisionAt");
  const publishedAt = canonicalUtcValue(acceptedAt, "clock.now");
  const snapshot = buildSqueezeBundleAsOf(bundle, decisionAt);
  const body = {
    contractVersion: SQUEEZE_SIM_PUBLICATION_CONTRACT_VERSION,
    streamId: streamId(bundle.manifest),
    dataMode: "SIM" as const,
    scenarioId: bundle.manifest.scenario_id,
    datasetVersion: bundle.manifest.dataset_version,
    decisionAt,
    datasets: structuredClone(snapshot.datasets),
  };
  return {
    ...body,
    snapshotId: snapshotId(body),
    publishedAt,
    coverage: datasetCoverage(snapshot.datasets),
  };
}

const SYSTEM_CLOCK: SqueezePublicationClock = {
  now: () => new Date().toISOString(),
};

function assertPublishableBundle(bundle: unknown): asserts bundle is ValidatedSqueezeCsvBundle {
  const candidate = bundle as ValidatedSqueezeCsvBundle;
  const records = Object.values(candidate.datasets).flat();
  if (candidate.manifest.data_mode !== "SIM" || records.some((record) => record.data_mode !== "SIM")) {
    throw new SqueezePublicationError("NON_SIM_INPUT", "Squeeze publication accepts SIM data only");
  }
  if (!isValidatedSqueezeCsvBundle(bundle)) {
    throw new SqueezePublicationError("BUNDLE_INVALID", "Squeeze bundle validation failed");
  }
}

export class SqueezeSimPublicationService {
  private lastGood: SqueezeSimPublication | null = null;
  private lastFailure: SqueezePublicationFailure | null = null;

  constructor(private readonly clock: SqueezePublicationClock = SYSTEM_CLOCK) {}

  publish(bundle: ValidatedSqueezeCsvBundle, options: SqueezePublishOptions): SqueezePublishResult {
    try {
      assertPublishableBundle(bundle);
      const publication = createSqueezeSimPublication(bundle, options, this.clock.now());
      if (this.lastGood !== null) {
        if (publication.streamId !== this.lastGood.streamId) {
          throw new SqueezePublicationError(
            "PUBLICATION_STREAM_MISMATCH",
            "A publication service instance cannot switch provenance stream",
          );
        }
        const decisionAt = canonicalUtcTimestamp(publication.decisionAt, "decisionAt");
        const lastDecisionAt = canonicalUtcTimestamp(this.lastGood.decisionAt, "lastGood.decisionAt");
        if (decisionAt < lastDecisionAt) {
          throw new SqueezePublicationError(
            "DECISION_TIME_REGRESSION",
            "An older decision time cannot replace the last good publication",
          );
        }
        if (decisionAt === lastDecisionAt && publication.snapshotId !== this.lastGood.snapshotId) {
          throw new SqueezePublicationError(
            "DECISION_CONTENT_CONFLICT",
            "A decision time cannot be republished with different content",
          );
        }
        if (canonicalUtcTimestamp(publication.publishedAt, "publishedAt")
          < canonicalUtcTimestamp(this.lastGood.publishedAt, "lastGood.publishedAt")) {
          throw new SqueezePublicationError(
            "PUBLICATION_TIME_REGRESSION",
            "An older publication time cannot replace the last good publication",
          );
        }
      }
      this.lastGood = clonePublication(publication);
      this.lastFailure = null;
      return { status: "PUBLISHED", publication: clonePublication(publication) };
    } catch (error) {
      return this.reject(error);
    }
  }

  publishFromRoot(bundleRoot: string, options: SqueezePublishOptions): SqueezePublishResult {
    try {
      return this.publish(loadSqueezeCsvBundle(bundleRoot), options);
    } catch (error) {
      return this.reject(error);
    }
  }

  readLastGood(options: SqueezeLastGoodReadOptions): SqueezeLastGoodRead {
    const now = canonicalUtcTimestamp(this.clock.now(), "clock.now");
    if (!Number.isFinite(options.freshnessBudgetMs) || options.freshnessBudgetMs < 0) {
      throw new SqueezePublicationError("CLOCK_INVALID", "freshnessBudgetMs must be a non-negative finite number");
    }
    if (this.lastGood === null) return { status: "UNAVAILABLE", reasonCode: "NO_LAST_GOOD", lastGood: null };

    const ageMs = now - canonicalUtcTimestamp(this.lastGood.publishedAt, "lastGood.publishedAt");
    if (ageMs < 0) throw new SqueezePublicationError("CLOCK_INVALID", "now cannot precede last-good publication");
    if (ageMs > options.freshnessBudgetMs) {
      return {
        status: "UNAVAILABLE",
        reasonCode: "LAST_GOOD_EXPIRED",
        ageMs,
        lastGood: descriptor(this.lastGood),
      };
    }
    return {
      status: this.lastFailure === null ? "CURRENT" : "LAST_GOOD",
      ageMs,
      publication: clonePublication(this.lastGood),
      lastFailure: this.lastFailure === null ? null : { ...this.lastFailure },
    };
  }

  private reject(error: unknown): SqueezePublishResult {
    const failure = publicFailure(error);
    this.lastFailure = { ...failure };
    if (this.lastGood === null) return { status: "UNAVAILABLE", error: { ...failure }, lastGood: null };
    return {
      status: "RETAINED_LAST_GOOD",
      error: { ...failure },
      lastGood: descriptor(this.lastGood),
    };
  }
}
