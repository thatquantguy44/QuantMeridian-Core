import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { afterEach, describe, expect, it } from "vitest";

import scenarioManifestSchema from "../../../../contracts/squeeze_radar/v1/scenario-manifest-1.0.schema.json";
import {
  generateSqueezeRadarCsv,
  parseSqueezeGeneratorArgs,
} from "../../../../scripts/generate-squeeze-radar-csv.mjs";
import { loadSqueezeCsvBundle } from "./loadCsvBundle";
import { buildSqueezeBundleAsOf } from "../../squeezeRadar/pointInTime";

const SCRIPT_PATH = resolve(process.cwd(), "scripts/generate-squeeze-radar-csv.mjs");
const BASE_MANIFEST_PATH = resolve(process.cwd(), "contracts/squeeze_radar/v1/scenarios/base.json");
const FAULT_MANIFEST_PATH = resolve(process.cwd(), "contracts/squeeze_radar/v1/scenarios/fault-suite.json");
const temporaryDirectories: string[] = [];

async function makeTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), "squeeze-radar-generator-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function readScenarioManifest(path = BASE_MANIFEST_PATH): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
}

async function csvRows(directory: string, filename: string): Promise<Record<string, string>[]> {
  const [headerLine, ...lines] = (await readFile(resolve(directory, filename), "utf8")).trim().split("\n");
  const headers = headerLine.split(",");
  return lines.map((line) => Object.fromEntries(headers.map((header, index) => [header, line.split(",")[index]])));
}

describe("portable Squeeze Radar synthetic generator", () => {
  it("generates byte-identical bundles for the same seed and options", async () => {
    const firstDirectory = await makeTemporaryDirectory();
    const secondDirectory = await makeTemporaryDirectory();
    const options = {
      scenarioId: "portable_repeatability",
      seed: 731,
      generatedAt: "2026-10-23T16:00:00Z",
    } as const;

    const first = await generateSqueezeRadarCsv({ ...options, outputDir: firstDirectory });
    const second = await generateSqueezeRadarCsv({ ...options, outputDir: secondDirectory });

    expect(first.fileCount).toBe(14);
    expect(second.rowCounts).toEqual(first.rowCounts);
    const filenames = (await readdir(firstDirectory, { recursive: true })).sort();
    expect(filenames).toEqual((await readdir(secondDirectory, { recursive: true })).sort());
    for (const filename of filenames.filter((name) => name.endsWith(".csv"))) {
      expect(await readFile(resolve(firstDirectory, filename), "utf8"))
        .toBe(await readFile(resolve(secondDirectory, filename), "utf8"));
    }
  });

  it("uses the seed to vary the generated market series", async () => {
    const firstDirectory = await makeTemporaryDirectory();
    const secondDirectory = await makeTemporaryDirectory();

    await generateSqueezeRadarCsv({ outputDir: firstDirectory, seed: 101 });
    await generateSqueezeRadarCsv({ outputDir: secondDirectory, seed: 101 + 2 ** 32 });

    expect(await readFile(resolve(firstDirectory, "equity_market_daily.csv"), "utf8"))
      .not.toBe(await readFile(resolve(secondDirectory, "equity_market_daily.csv"), "utf8"));
    expect((await csvRows(firstDirectory, "manifest.csv"))[0]).toMatchObject({ scenario_id: "sqz_base_v1", seed: "101" });
    expect((await csvRows(secondDirectory, "manifest.csv"))[0]).toMatchObject({ scenario_id: "sqz_base_v1", seed: "4294967397" });
  });

  it("runs from another working directory with an explicit portable output path", async () => {
    const workingDirectory = await makeTemporaryDirectory();
    const outputDirectory = resolve(workingDirectory, "generated", "squeeze");

    execFileSync(process.execPath, [SCRIPT_PATH, "--output-dir", outputDirectory, "--seed", "8675309", "--scenario-id", "other_machine"], {
      cwd: workingDirectory,
      encoding: "utf8",
    });

    expect((await csvRows(outputDirectory, "manifest.csv"))[0])
      .toMatchObject({ scenario_id: "other_machine", seed: "8675309" });
    expect(await readFile(resolve(outputDirectory, "_truth", "truth_events.csv"), "utf8"))
      .toContain("other_machine,TRUTH-001,");
  });

  it("runs from a clean directory with only Node built-ins and the copied generator assets", async () => {
    const portableRoot = await makeTemporaryDirectory();
    await mkdir(resolve(portableRoot, "scripts", "lib"), { recursive: true });
    await cp(SCRIPT_PATH, resolve(portableRoot, "scripts", "generate-squeeze-radar-csv.mjs"));
    await cp(
      resolve(process.cwd(), "scripts/lib/squeeze-radar-scenario.mjs"),
      resolve(portableRoot, "scripts/lib/squeeze-radar-scenario.mjs"),
    );
    await cp(
      resolve(process.cwd(), "contracts/squeeze_radar"),
      resolve(portableRoot, "contracts/squeeze_radar"),
      { recursive: true },
    );

    execFileSync(process.execPath, [
      resolve(portableRoot, "scripts/generate-squeeze-radar-csv.mjs"),
      "--output-dir",
      resolve(portableRoot, "generated"),
    ], { cwd: portableRoot, encoding: "utf8" });

    expect((await csvRows(resolve(portableRoot, "generated"), "manifest.csv"))[0])
      .toMatchObject({ scenario_id: "sqz_base_v1", data_mode: "SIM" });
  });

  it("loads a versioned manifest, records its digest, and preserves an exact replay copy", async () => {
    const outputDirectory = await makeTemporaryDirectory();

    const result = await generateSqueezeRadarCsv({
      manifestPath: BASE_MANIFEST_PATH,
      outputDir: outputDirectory,
    });

    expect(result).toMatchObject({
      scenarioManifestId: "sqz-base",
      scenarioManifestVersion: "1.0.0",
    });
    expect(result.scenarioManifestSha256).toMatch(/^[a-f0-9]{64}$/);
    const outputManifest = (await csvRows(outputDirectory, "manifest.csv"))[0];
    expect(outputManifest).toMatchObject({
      dataset_version: "1.1",
      scenario_manifest_id: "sqz-base",
      scenario_manifest_version: "1.0.0",
      scenario_manifest_sha256: result.scenarioManifestSha256,
    });
    expect(JSON.parse(await readFile(resolve(outputDirectory, "_truth", "scenario-manifest.json"), "utf8")))
      .toEqual(JSON.parse(await readFile(BASE_MANIFEST_PATH, "utf8")));
  });

  it("keeps the committed base manifest valid against its published JSON Schema", async () => {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(scenarioManifestSchema);

    expect(validate(await readScenarioManifest()), JSON.stringify(validate.errors)).toBe(true);
  });

  it("keeps dependency-free runtime checks aligned with published manifest constraints", async () => {
    const outputDirectory = await makeTemporaryDirectory();
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(scenarioManifestSchema);
    const invalidManifests: Record<string, unknown>[] = [];

    const zeroPrice = await readScenarioManifest();
    (zeroPrice.fictional_universe as { securities: Array<Record<string, unknown>> }).securities[0].initial_price = 0;
    invalidManifests.push(zeroPrice);

    const duplicateInvariant = await readScenarioManifest();
    (duplicateInvariant.invariants as string[]).push("MARKET_UTILIZATION");
    invalidManifests.push(duplicateInvariant);

    const impossibleDate = await readScenarioManifest();
    (impossibleDate.calendar as Record<string, unknown>).start_date = "2026-02-30";
    invalidManifests.push(impossibleDate);

    const impossibleTimestamp = await readScenarioManifest();
    impossibleTimestamp.generated_at = "2026-02-30T16:00:00Z";
    invalidManifests.push(impossibleTimestamp);

    const zeroCallMultiplier = await readScenarioManifest();
    const regimes = zeroCallMultiplier.regimes as Array<{ effects: Record<string, unknown> }>;
    regimes[0].effects.call_volume_multiplier = 0;
    invalidManifests.push(zeroCallMultiplier);

    for (const manifest of invalidManifests) {
      expect(validate(manifest), JSON.stringify(validate.errors)).toBe(false);
      await expect(generateSqueezeRadarCsv({ outputDir: outputDirectory, scenarioManifest: manifest })).rejects.toThrow();
    }
  });

  it("keeps domain outputs independent when an unrelated named stream changes", async () => {
    const firstDirectory = await makeTemporaryDirectory();
    const secondDirectory = await makeTemporaryDirectory();
    const base = await readScenarioManifest();
    const changed = structuredClone(base) as {
      random_streams: Record<string, string>;
    } & Record<string, unknown>;
    changed.random_streams.options = "options-alternate-v1";

    await generateSqueezeRadarCsv({ outputDir: firstDirectory, scenarioManifest: base });
    await generateSqueezeRadarCsv({ outputDir: secondDirectory, scenarioManifest: changed });

    expect(await readFile(resolve(secondDirectory, "equity_market_daily.csv"), "utf8"))
      .toBe(await readFile(resolve(firstDirectory, "equity_market_daily.csv"), "utf8"));
    expect(await readFile(resolve(secondDirectory, "market_borrow_snapshots.csv"), "utf8"))
      .toBe(await readFile(resolve(firstDirectory, "market_borrow_snapshots.csv"), "utf8"));
    expect(await readFile(resolve(secondDirectory, "options_snapshots.csv"), "utf8"))
      .not.toBe(await readFile(resolve(firstDirectory, "options_snapshots.csv"), "utf8"));
  });

  it("generates every required clock, revision, unit, and staleness fault on demand", async () => {
    const outputDirectory = await makeTemporaryDirectory();

    const result = await generateSqueezeRadarCsv({
      manifestPath: FAULT_MANIFEST_PATH,
      outputDir: outputDirectory,
    });

    expect(result.appliedFaultIds).toEqual([
      "stale-equity-qava",
      "late-borrow-qbri",
      "out-of-order-options-qcpe",
      "backfill-equity-qdhh",
      "post-decision-borrow-qevc",
      "bad-utilization-unit-qfrg",
    ]);

    const equity = await csvRows(outputDirectory, "equity_market_daily.csv");
    expect(equity.some((row) => row.security_id === "SEC-QAVA" && row.trade_date > "2026-10-09")).toBe(false);
    expect(equity.filter((row) => row.observation_id === "EQ-QDHH-2026-10-08").map((row) => row.revision)).toEqual(["1", "2"]);

    const borrow = await csvRows(outputDirectory, "market_borrow_snapshots.csv");
    const lateBorrow = borrow.find((row) => row.observation_id === "MB-QBRI-2026-10-08");
    expect(lateBorrow?.ingested_at).toBe("2026-10-09T20:04:00Z");
    const postDecision = borrow.filter((row) => row.observation_id === "MB-QEVC-2026-10-08");
    expect(postDecision.map((row) => row.revision)).toEqual(["1", "2"]);
    expect(postDecision[1].first_knowable_at).toBe("2026-10-12T14:00:00Z");
    const badUnit = borrow.find((row) => row.observation_id === "MB-QFRG-2026-10-08");
    expect(Number(badUnit?.utilization_pct)).toBeLessThan(1);

    const options = await csvRows(outputDirectory, "options_snapshots.csv");
    const older = options.find((row) => row.observation_id === "OPT-QCPE-2026-10-07");
    const newer = options.find((row) => row.observation_id === "OPT-QCPE-2026-10-08");
    expect(Date.parse(older?.first_knowable_at ?? "")).toBeGreaterThan(Date.parse(newer?.first_knowable_at ?? ""));
    const bundle = loadSqueezeCsvBundle(outputDirectory);
    const beforeRevision = buildSqueezeBundleAsOf(bundle, "2026-10-09T20:05:00Z")
      .datasets["market_borrow_snapshots.csv"]
      .find((row) => row.observation_id === "MB-QEVC-2026-10-08");
    const afterRevision = buildSqueezeBundleAsOf(bundle, "2026-10-12T14:00:00Z")
      .datasets["market_borrow_snapshots.csv"]
      .find((row) => row.observation_id === "MB-QEVC-2026-10-08");
    expect(beforeRevision?.revision).toBe(1);
    expect(beforeRevision?.current_fee_bps).not.toBe(275);
    expect(afterRevision).toMatchObject({ revision: 2, current_fee_bps: 275 });
  });

  it("expands the committed large-demo overlay without changing the generator interface", async () => {
    const outputDirectory = await makeTemporaryDirectory();
    const result = await generateSqueezeRadarCsv({
      manifestPath: resolve(process.cwd(), "contracts/squeeze_radar/v1/scenarios/large-demo.json"),
      outputDir: outputDirectory,
    });

    expect(result.scenarioManifestId).toBe("sqz-large-demo");
    expect(result.rowCounts["equity_market_daily.csv"]).toBe(1500);
  });

  it("rejects cyclic manifest overlays before generation", async () => {
    const directory = await makeTemporaryDirectory();
    await writeFile(resolve(directory, "a.json"), JSON.stringify({ extends: "b.json" }), "utf8");
    await writeFile(resolve(directory, "b.json"), JSON.stringify({ extends: "a.json" }), "utf8");

    await expect(generateSqueezeRadarCsv({ manifestPath: resolve(directory, "a.json"), outputDir: directory }))
      .rejects.toThrow(/cycle/i);
  });

  it("rejects manifest overlays that escape through a sibling symlink", async () => {
    const directory = await makeTemporaryDirectory();
    const scenarioDirectory = resolve(directory, "scenarios");
    await mkdir(scenarioDirectory);
    const externalManifest = resolve(directory, "external.json");
    await writeFile(externalManifest, JSON.stringify(await readScenarioManifest()), "utf8");
    await symlink(externalManifest, resolve(scenarioDirectory, "linked.json"));
    await writeFile(resolve(scenarioDirectory, "overlay.json"), JSON.stringify({ extends: "linked.json" }), "utf8");

    await expect(generateSqueezeRadarCsv({
      manifestPath: resolve(scenarioDirectory, "overlay.json"),
      outputDir: directory,
    })).rejects.toThrow(/escapes.*scenario directory/i);
  });

  it("uses the declared short-interest publication schedule beyond the observation calendar", async () => {
    const outputDirectory = await makeTemporaryDirectory();
    const manifest = await readScenarioManifest();
    manifest.calendar = { start_date: "2026-09-21", business_day_count: 5 };
    const schedules = manifest.publication_schedules as Record<string, Record<string, unknown>>;
    schedules["short_interest.csv"] = {
      observed_time_utc: "22:15:00",
      ingest_delay_seconds: 600,
      knowable_delay_seconds: 900,
      publication_delay_business_days: 6,
    };

    await generateSqueezeRadarCsv({ outputDir: outputDirectory, scenarioManifest: manifest });

    const official = (await csvRows(outputDirectory, "short_interest.csv"))
      .find((row) => row.report_id === "SI-OFF-QAVA-2026-09-21");
    expect(official).toMatchObject({
      settlement_date: "2026-09-21",
      published_at: "2026-09-29T22:15:00Z",
      observed_at: "2026-09-29T22:15:00Z",
      ingested_at: "2026-09-29T22:25:00Z",
      first_knowable_at: "2026-09-29T22:30:00Z",
    });
  });

  it("rejects fault output that no longer satisfies a typed CSV field contract", async () => {
    const outputDirectory = await makeTemporaryDirectory();
    const manifest = await readScenarioManifest();
    manifest.faults = [{
      fault_id: "fractional-volume",
      type: "BACKFILL_REVISION",
      target: {
        dataset: "equity_market_daily.csv",
        security_id: "SEC-QAVA",
        record_date: "2026-10-08",
        revision: 1,
      },
      field: "volume_qty",
      value: 0.5,
      first_knowable_at: "2026-10-12T12:00:00Z",
      expected_gate: "REVISION_LINEAGE",
    }];

    await expect(generateSqueezeRadarCsv({ outputDir: outputDirectory, scenarioManifest: manifest }))
      .rejects.toThrow(/equity_market_daily\.csv.*volume_qty.*integer/i);
  });

  it("scopes invariant waivers to the exact logical record targeted by a fault", async () => {
    const outputDirectory = await makeTemporaryDirectory();
    const manifest = await readScenarioManifest();
    manifest.faults = [
      {
        fault_id: "declared-bad-unit",
        type: "BAD_UNIT",
        target: {
          dataset: "market_borrow_snapshots.csv",
          security_id: "SEC-QFRG",
          record_date: "2026-10-08",
          revision: 1,
        },
        field: "utilization_pct",
        factor: 0.01,
        expected_gate: "MARKET_UTILIZATION",
      },
      {
        fault_id: "unrelated-bad-utilization",
        type: "BACKFILL_REVISION",
        target: {
          dataset: "market_borrow_snapshots.csv",
          security_id: "SEC-QAVA",
          record_date: "2026-10-08",
          revision: 1,
        },
        field: "utilization_pct",
        value: 0.1,
        first_knowable_at: "2026-10-12T12:00:00Z",
        expected_gate: "REVISION_LINEAGE",
      },
    ];

    await expect(generateSqueezeRadarCsv({ outputDir: outputDirectory, scenarioManifest: manifest }))
      .rejects.toThrow(/undeclared MARKET_UTILIZATION.*MB-QAVA-2026-10-08/i);
  });

  it("rejects unsafe manifests and faults that do not resolve unambiguously", async () => {
    const outputDirectory = await makeTemporaryDirectory();
    const liveManifest = await readScenarioManifest();
    liveManifest.data_mode = "LIVE";
    await expect(generateSqueezeRadarCsv({ outputDir: outputDirectory, scenarioManifest: liveManifest }))
      .rejects.toThrow(/data_mode/i);

    const unknownFieldManifest = await readScenarioManifest();
    unknownFieldManifest.surprise_live_adapter = true;
    await expect(generateSqueezeRadarCsv({ outputDir: outputDirectory, scenarioManifest: unknownFieldManifest }))
      .rejects.toThrow(/unknown field.*surprise_live_adapter/i);

    const fractionalPublicationDelay = await readScenarioManifest();
    const schedules = fractionalPublicationDelay.publication_schedules as Record<string, Record<string, unknown>>;
    schedules["short_interest.csv"].publication_delay_business_days = 0.5;
    await expect(generateSqueezeRadarCsv({ outputDir: outputDirectory, scenarioManifest: fractionalPublicationDelay }))
      .rejects.toThrow(/publication_delay_business_days.*integer/i);

    const impossiblePublicationDelay = await readScenarioManifest();
    const impossibleSchedules = impossiblePublicationDelay.publication_schedules as Record<string, Record<string, unknown>>;
    impossibleSchedules["short_interest.csv"].publication_delay_business_days = Number.MAX_SAFE_INTEGER;
    await expect(generateSqueezeRadarCsv({ outputDir: outputDirectory, scenarioManifest: impossiblePublicationDelay }))
      .rejects.toThrow(/publication delay exceeds.*calendar range/i);

    const realIdentityManifest = await readScenarioManifest();
    const universe = realIdentityManifest.fictional_universe as { securities: Array<Record<string, unknown>> };
    universe.securities[0].security_name = "A Real-Looking Issuer";
    await expect(generateSqueezeRadarCsv({ outputDir: outputDirectory, scenarioManifest: realIdentityManifest }))
      .rejects.toThrow(/fictional|synthetic/i);

    const unmatchedFaultManifest = await readScenarioManifest();
    unmatchedFaultManifest.faults = [{
      fault_id: "no-match",
      type: "LATE_INGESTION",
      target: {
        dataset: "equity_market_daily.csv",
        security_id: "SEC-QAVA",
        record_date: "1999-01-01",
      },
      delay_seconds: 60,
      expected_gate: "INGEST_DELAY",
    }];
    await expect(generateSqueezeRadarCsv({ outputDir: outputDirectory, scenarioManifest: unmatchedFaultManifest }))
      .rejects.toThrow(/no-match.*exactly one/i);
  });

  it("rejects invalid CLI values before writing", () => {
    expect(() => parseSqueezeGeneratorArgs(["--seed", "zero"])).toThrow(/seed/i);
    expect(() => parseSqueezeGeneratorArgs(["--scenario-id", "spaces are not safe"])).toThrow(/scenario/i);
    expect(() => parseSqueezeGeneratorArgs(["--generated-at", "2026-10-23Z"])).toThrow(/generatedAt/i);
    expect(() => parseSqueezeGeneratorArgs(["--generated-at", "2026-10-23T24:00:00Z"])).toThrow(/generatedAt/i);
    expect(() => parseSqueezeGeneratorArgs(["--manifest"])).toThrow(/manifest/i);
    expect(() => parseSqueezeGeneratorArgs(["--mystery"])).toThrow(/unknown/i);
  });
});
