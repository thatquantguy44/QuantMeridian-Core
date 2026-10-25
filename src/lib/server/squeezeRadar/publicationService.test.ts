import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { SqueezeCsvBundle } from "../../squeezeRadar/contracts";
import { buildSqueezeBundleAsOf } from "../../squeezeRadar/pointInTime";
import { loadSqueezeCsvBundle, type ValidatedSqueezeCsvBundle } from "./loadCsvBundle";
import { SqueezeSimPublicationService } from "./publicationService";

const FIXTURE_ROOT = resolve(process.cwd(), "data/synthetic/squeeze_radar/v1");
const DECISION_AT = "2026-09-23T20:05:00Z";
const PUBLISHED_AT = "2026-09-23T20:06:00Z";

class TestClock {
  constructor(private current: string) {}
  now(): string { return this.current; }
  set(current: string): void { this.current = current; }
}

function fixtureBundle(): ValidatedSqueezeCsvBundle {
  return loadSqueezeCsvBundle(FIXTURE_ROOT);
}

function mutatedFixture(mutate: (root: string) => void): ValidatedSqueezeCsvBundle {
  const root = mkdtempSync(join(tmpdir(), "squeeze-publication-"));
  try {
    cpSync(FIXTURE_ROOT, root, { recursive: true });
    mutate(root);
    return loadSqueezeCsvBundle(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function mutateCsvCell(path: string, column: string, transform: (value: string) => string): void {
  const lines = readFileSync(path, "utf8").trimEnd().split("\n");
  const headers = lines[0].split(",");
  const columnIndex = headers.indexOf(column);
  if (columnIndex < 0) throw new Error(`missing ${column}`);
  const values = lines[1].split(",");
  values[columnIndex] = transform(values[columnIndex]);
  lines[1] = values.join(",");
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function expectPublished(
  service: SqueezeSimPublicationService,
  bundle: ValidatedSqueezeCsvBundle,
  decisionAt = DECISION_AT,
) {
  const result = service.publish(bundle, { decisionAt });
  expect(result.status).toBe("PUBLISHED");
  if (result.status !== "PUBLISHED") throw new Error("expected publication");
  return result.publication;
}

describe("Squeeze Radar SIM publication contract", () => {
  it("publishes exact point-in-time histories without local paths or truth metadata", () => {
    const bundle = fixtureBundle();
    const publication = expectPublished(
      new SqueezeSimPublicationService(new TestClock(PUBLISHED_AT)),
      bundle,
    );
    const expected = buildSqueezeBundleAsOf(bundle, DECISION_AT);

    expect(publication).toMatchObject({
      contractVersion: "1.0",
      dataMode: "SIM",
      scenarioId: "sqz_base_v1",
      datasetVersion: "1.1",
      decisionAt: DECISION_AT,
      publishedAt: PUBLISHED_AT,
    });
    expect(publication.streamId).toMatch(/^sqzstream_[a-f0-9]{64}$/);
    expect(publication.snapshotId).toMatch(/^sqzsim_[a-f0-9]{64}$/);
    expect(publication.datasets).toEqual(expected.datasets);
    expect(publication.coverage["equity_market_daily.csv"].rowCount)
      .toBe(expected.datasets["equity_market_daily.csv"].length);
    expect(JSON.stringify(publication)).not.toContain(bundle.rootDir);
    expect(JSON.stringify(publication)).not.toContain("truth_path");
    expect(JSON.stringify(publication)).not.toContain("_truth");
  });

  it("reproduces eligible revisions at every fixture knowledge timestamp", () => {
    const bundle = fixtureBundle();
    const timestamps = [...new Set(Object.values(bundle.datasets)
      .flat()
      .map((row) => row.first_knowable_at))]
      .sort();

    for (const decisionAt of timestamps) {
      const publication = expectPublished(
        new SqueezeSimPublicationService(new TestClock(decisionAt)),
        bundle,
        decisionAt,
      );
      const expected = buildSqueezeBundleAsOf(bundle, decisionAt);
      expect(publication.datasets, decisionAt).toEqual(expected.datasets);
      for (const rows of Object.values(publication.datasets)) {
        expect(rows.every((row) => Date.parse(row.first_knowable_at) <= Date.parse(decisionAt)), decisionAt).toBe(true);
      }
    }
  });

  it("derives stable identities and protects the retained snapshot from caller mutation", () => {
    const bundle = fixtureBundle();
    const clock = new TestClock(PUBLISHED_AT);
    const service = new SqueezeSimPublicationService(clock);
    const first = expectPublished(service, bundle);

    clock.set("2026-09-23T20:07:00Z");
    const second = expectPublished(service, bundle);
    expect(second.snapshotId).toBe(first.snapshotId);

    clock.set("2026-09-23T20:08:00.0Z");
    const equivalentClockFormat = expectPublished(service, bundle, "2026-09-23T20:05:00.0Z");
    expect(equivalentClockFormat).toMatchObject({
      snapshotId: first.snapshotId,
      decisionAt: DECISION_AT,
      publishedAt: "2026-09-23T20:08:00Z",
    });

    const reordered = mutatedFixture((root) => {
      const path = join(root, "equity_market_daily.csv");
      const [header, ...rows] = readFileSync(path, "utf8").trimEnd().split("\n");
      writeFileSync(path, `${[header, ...rows.reverse()].join("\n")}\n`, "utf8");
    });
    expect(expectPublished(
      new SqueezeSimPublicationService(new TestClock(PUBLISHED_AT)),
      reordered,
    ).snapshotId).toBe(first.snapshotId);

    equivalentClockFormat.datasets["equity_market_daily.csv"].splice(0);
    clock.set("2026-09-23T20:09:00Z");
    const read = service.readLastGood({ freshnessBudgetMs: 60_000 });
    expect(read.status).toBe("CURRENT");
    if (read.status === "CURRENT" || read.status === "LAST_GOOD") {
      expect(read.publication.datasets["equity_market_daily.csv"].length).toBeGreaterThan(0);
    }
  });

  it("rejects non-SIM input, retains last good, and protects stored failure state", () => {
    const bundle = fixtureBundle();
    const clock = new TestClock(PUBLISHED_AT);
    const service = new SqueezeSimPublicationService(clock);
    const first = expectPublished(service, bundle);

    const nonSim = {
      ...bundle,
      manifest: { ...bundle.manifest, data_mode: "LIVE" },
    } as unknown as ValidatedSqueezeCsvBundle;
    clock.set("2026-09-23T20:07:00Z");
    const failed = service.publish(nonSim, { decisionAt: "2026-09-23T20:06:00Z" });
    expect(failed).toEqual({
      status: "RETAINED_LAST_GOOD",
      error: { code: "NON_SIM_INPUT", message: "Squeeze publication accepts SIM data only" },
      lastGood: {
        streamId: first.streamId,
        snapshotId: first.snapshotId,
        decisionAt: DECISION_AT,
        publishedAt: PUBLISHED_AT,
      },
    });
    if (failed.status !== "RETAINED_LAST_GOOD") throw new Error("expected retained publication");
    failed.error.message = "caller mutation";

    const read = service.readLastGood({ freshnessBudgetMs: 60_000 });
    expect(read).toMatchObject({
      status: "LAST_GOOD",
      ageMs: 60_000,
      publication: { snapshotId: first.snapshotId },
      lastFailure: { code: "NON_SIM_INPUT", message: "Squeeze publication accepts SIM data only" },
    });

    const rowLevelNonSim = structuredClone(bundle) as unknown as SqueezeCsvBundle;
    rowLevelNonSim.datasets["equity_market_daily.csv"][0].data_mode = "LIVE" as "SIM";
    clock.set("2026-09-23T20:08:00Z");
    expect(service.publish(rowLevelNonSim as unknown as ValidatedSqueezeCsvBundle, {
      decisionAt: "2026-09-23T20:07:00Z",
    })).toMatchObject({
      status: "RETAINED_LAST_GOOD",
      error: { code: "NON_SIM_INPUT" },
    });
  });

  it("fails closed before first good and expires by its trusted clock, not caller assertions", () => {
    const clock = new TestClock(PUBLISHED_AT);
    const service = new SqueezeSimPublicationService(clock);
    const invalid = service.publishFromRoot("/path/that/does/not/exist", { decisionAt: DECISION_AT });
    expect(invalid).toMatchObject({
      status: "UNAVAILABLE",
      error: { code: "BUNDLE_INVALID", message: "Squeeze bundle validation failed" },
    });
    expect(JSON.stringify(invalid)).not.toContain("/path/that/does/not/exist");
    expect(service.readLastGood({ freshnessBudgetMs: 60_000 })).toEqual({
      status: "UNAVAILABLE",
      reasonCode: "NO_LAST_GOOD",
      lastGood: null,
    });

    expectPublished(service, fixtureBundle());
    clock.set("2026-09-23T20:07:00.001Z");
    expect(service.readLastGood({ freshnessBudgetMs: 60_000, now: PUBLISHED_AT } as { freshnessBudgetMs: number }))
      .toMatchObject({ status: "UNAVAILABLE", reasonCode: "LAST_GOOD_EXPIRED", ageMs: 60_001 });
  });

  it("rejects invalid clocks and budgets without replacing retained history", () => {
    const bundle = fixtureBundle();
    const clock = new TestClock(PUBLISHED_AT);
    const service = new SqueezeSimPublicationService(clock);

    expect(service.publish(bundle, { decisionAt: "2026-02-30T00:00:00Z" }))
      .toMatchObject({ status: "UNAVAILABLE", error: { code: "CLOCK_INVALID" } });
    clock.set("2026-09-23T20:04:59Z");
    expect(service.publish(bundle, { decisionAt: DECISION_AT }))
      .toMatchObject({ status: "UNAVAILABLE", error: { code: "CLOCK_INVALID" } });

    clock.set("2026-09-24T20:06:00Z");
    const current = expectPublished(service, bundle, "2026-09-24T20:05:00Z");
    clock.set("2026-09-24T20:07:00Z");
    expect(service.publish(bundle, { decisionAt: DECISION_AT })).toMatchObject({
      status: "RETAINED_LAST_GOOD",
      error: { code: "DECISION_TIME_REGRESSION" },
    });

    clock.set("2026-02-30T00:00:00Z");
    expect(() => service.readLastGood({ freshnessBudgetMs: 60_000 })).toThrow(/clock\.now/);
    clock.set("2026-09-24T20:05:59Z");
    expect(() => service.readLastGood({ freshnessBudgetMs: 60_000 })).toThrow(/cannot precede/);
    clock.set("2026-09-24T20:07:00Z");
    for (const freshnessBudgetMs of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => service.readLastGood({ freshnessBudgetMs })).toThrow(/non-negative finite/);
    }
    expect(service.readLastGood({ freshnessBudgetMs: 60_000 })).toMatchObject({
      status: "LAST_GOOD",
      publication: { snapshotId: current.snapshotId },
    });
  });

  it("prevents content, publication-clock, or provenance-stream replacement", () => {
    const bundle = fixtureBundle();
    const clock = new TestClock(PUBLISHED_AT);
    const service = new SqueezeSimPublicationService(clock);
    expectPublished(service, bundle);

    const conflicting = mutatedFixture((root) => {
      mutateCsvCell(join(root, "equity_market_daily.csv"), "close_price", (value) => String(Number(value) + 1));
    });
    clock.set("2026-09-23T20:07:00Z");
    expect(service.publish(conflicting, { decisionAt: DECISION_AT })).toMatchObject({
      status: "RETAINED_LAST_GOOD",
      error: { code: "DECISION_CONTENT_CONFLICT" },
    });

    clock.set("2026-09-23T20:05:30Z");
    expect(service.publish(bundle, { decisionAt: DECISION_AT })).toMatchObject({
      status: "RETAINED_LAST_GOOD",
      error: { code: "PUBLICATION_TIME_REGRESSION" },
    });

    const otherProvenance = mutatedFixture((root) => {
      mutateCsvCell(join(root, "manifest.csv"), "scenario_manifest_sha256", () => "0".repeat(64));
    });
    clock.set("2026-09-24T20:06:00Z");
    expect(service.publish(otherProvenance, { decisionAt: "2026-09-24T20:05:00Z" })).toMatchObject({
      status: "RETAINED_LAST_GOOD",
      error: { code: "PUBLICATION_STREAM_MISMATCH" },
    });
  });

  it("rejects unvalidated casts with injected fields or broken scenario references", () => {
    const bundle = fixtureBundle();
    const service = new SqueezeSimPublicationService(new TestClock(PUBLISHED_AT));

    const injected = structuredClone(bundle) as unknown as SqueezeCsvBundle;
    (injected.datasets["equity_market_daily.csv"][0] as unknown as Record<string, unknown>)._truth = "secret";
    const injectedResult = service.publish(injected as unknown as ValidatedSqueezeCsvBundle, {
      decisionAt: DECISION_AT,
    });
    expect(injectedResult).toMatchObject({ status: "UNAVAILABLE", error: { code: "BUNDLE_INVALID" } });
    expect(JSON.stringify(injectedResult)).not.toContain("secret");

    const mismatched = structuredClone(bundle) as unknown as SqueezeCsvBundle;
    mismatched.datasets["equity_market_daily.csv"][0].scenario_id = "sqz_other_v1";
    expect(service.publish(mismatched as unknown as ValidatedSqueezeCsvBundle, { decisionAt: DECISION_AT }))
      .toMatchObject({ status: "UNAVAILABLE", error: { code: "BUNDLE_INVALID" } });
  });
});
