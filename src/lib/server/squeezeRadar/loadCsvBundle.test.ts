import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { buildSqueezeBundleAsOf, selectLatestRevisionsAsOf } from "../../squeezeRadar/pointInTime";
import {
  isValidatedSqueezeCsvBundle,
  SqueezeCsvContractError,
  loadSqueezeCsvBundle,
} from "./loadCsvBundle";

const REPO_ROOT = process.cwd();
const FIXTURE_ROOT = resolve(REPO_ROOT, "data/synthetic/squeeze_radar/v1");

function withFixture(run: (root: string) => void): void {
  const tempRoot = mkdtempSync(join(tmpdir(), "squeeze-csv-"));
  const bundleRoot = join(tempRoot, "v1");
  cpSync(FIXTURE_ROOT, bundleRoot, { recursive: true });
  try {
    run(bundleRoot);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function mutate(root: string, file: string, replacement: (text: string) => string): void {
  const path = join(root, file);
  writeFileSync(path, replacement(readFileSync(path, "utf8")), "utf8");
}

function expectContractError(run: () => unknown, code: string, dataset: string): void {
  try {
    run();
    throw new Error("expected contract error");
  } catch (error) {
    expect(error).toBeInstanceOf(SqueezeCsvContractError);
    expect(error).toMatchObject({ code, dataset });
  }
}

describe("loadSqueezeCsvBundle", () => {
  beforeAll(() => {
    execFileSync(process.execPath, [resolve(REPO_ROOT, "scripts/generate-squeeze-radar-csv.mjs")]);
  });

  test("loads the normalized SIM inputs without exposing the truth ledger", () => {
    const bundle = loadSqueezeCsvBundle(FIXTURE_ROOT);

    expect(bundle.manifest).toMatchObject({
      dataset_version: "1.1",
      data_mode: "SIM",
      scenario_id: "sqz_base_v1",
      scenario_manifest_id: "sqz-base",
      scenario_manifest_version: "1.0.0",
    });
    expect(bundle.datasets["securities.csv"]).toHaveLength(6);
    expect(bundle.datasets["equity_market_daily.csv"]).toHaveLength(150);
    expect(bundle.dataDictionary.length).toBeGreaterThan(200);
    expect(bundle).not.toHaveProperty("truthEvents");
    expect(bundle.datasets).not.toHaveProperty("_truth/truth_events.csv");
    expect(isValidatedSqueezeCsvBundle(bundle)).toBe(true);
    expect(Object.isFrozen(bundle)).toBe(true);
    expect(Object.isFrozen(bundle.manifest)).toBe(true);
    expect(Object.isFrozen(bundle.datasets["equity_market_daily.csv"][0])).toBe(true);
  });

  test("validates the manifest before attempting model-input files", () => withFixture((root) => {
    mutate(root, "manifest.csv", (text) => text.replace(",SIM,", ",LIVE,"));
    mutate(root, "securities.csv", (text) => text.replace("security_id", "broken_security_id"));

    expectContractError(() => loadSqueezeCsvBundle(root), "MANIFEST_INVALID", "manifest.csv");
  }));

  test("dispatches the retained 1.0 manifest contract without accepting a 1.1 header as 1.0", () => withFixture((root) => {
    mutate(root, "manifest.csv", (text) => {
      const [headerLine, rowLine] = text.trim().split("\n");
      const headers = headerLine.split(",");
      const values = rowLine.split(",");
      const retained = headers
        .map((header, index) => ({ header, value: values[index] }))
        .filter(({ header }) => !["scenario_manifest_id", "scenario_manifest_version", "scenario_manifest_sha256"].includes(header));
      retained.find(({ header }) => header === "dataset_version")!.value = "1.0";
      return `${retained.map(({ header }) => header).join(",")}\n${retained.map(({ value }) => value).join(",")}\n`;
    });

    const legacy = loadSqueezeCsvBundle(root);
    expect(legacy.manifest).toMatchObject({ dataset_version: "1.0", scenario_id: "sqz_base_v1" });
    expect(legacy.manifest).not.toHaveProperty("scenario_manifest_sha256");
  }));

  test("keeps model inputs and truth paths in separate bundle locations", () => {
    withFixture((root) => {
      mutate(root, "manifest.csv", (text) => text.replace(",.,_truth/truth_events.csv", ",_truth,_truth/truth_events.csv"));
      expectContractError(() => loadSqueezeCsvBundle(root), "MANIFEST_INVALID", "manifest.csv");
    });
    withFixture((root) => {
      mutate(root, "manifest.csv", (text) => text.replace("_truth/truth_events.csv", "../truth_events.csv"));
      expectContractError(() => loadSqueezeCsvBundle(root), "MANIFEST_INVALID", "manifest.csv");
    });
  });

  test("rejects header drift, invalid primitive values, and invalid enums", () => {
    withFixture((root) => {
      mutate(root, "inventory_snapshots.csv", (text) => text.replace("gross_inventory_qty", "gross_inventory_shares"));
      expectContractError(() => loadSqueezeCsvBundle(root), "HEADER_MISMATCH", "inventory_snapshots.csv");
    });
    withFixture((root) => {
      mutate(root, "market_borrow_snapshots.csv", (text) => text.replace(",VALID,1,SIM", ",VALID,not-an-integer,SIM"));
      expectContractError(() => loadSqueezeCsvBundle(root), "RECORD_INVALID", "market_borrow_snapshots.csv");
    });
    withFixture((root) => {
      mutate(root, "options_snapshots.csv", (text) => text.replace(",VALID,1,SIM", ",MAGIC,1,SIM"));
      expectContractError(() => loadSqueezeCsvBundle(root), "RECORD_INVALID", "options_snapshots.csv");
    });
  });

  test("rejects non-SIM records and unknown cross-file security references", () => {
    withFixture((root) => {
      mutate(root, "equity_market_daily.csv", (text) => text.replace(",SIM\n", ",LIVE\n"));
      expectContractError(() => loadSqueezeCsvBundle(root), "RECORD_INVALID", "equity_market_daily.csv");
    });
    withFixture((root) => {
      mutate(root, "market_borrow_snapshots.csv", (text) => text.replace("SEC-QAVA", "SEC-UNKNOWN"));
      expectContractError(() => loadSqueezeCsvBundle(root), "REFERENCE_INVALID", "market_borrow_snapshots.csv");
    });
  });

  test("rejects duplicate revisions and time-travel clock order", () => {
    withFixture((root) => {
      const path = join(root, "security_events.csv");
      const lines = readFileSync(path, "utf8").trimEnd().split("\n");
      writeFileSync(path, `${lines.join("\n")}\n${lines[1]}\n`, "utf8");
      expectContractError(() => loadSqueezeCsvBundle(root), "DUPLICATE_REVISION", "security_events.csv");
    });
    withFixture((root) => {
      mutate(root, "short_interest.csv", (text) => text.replace("2026-09-21T20:05:00Z", "2026-09-21T19:59:00Z"));
      expectContractError(() => loadSqueezeCsvBundle(root), "CLOCK_INVALID", "short_interest.csv");
    });
  });

  test("does not read the truth ledger through the model-input loader", () => withFixture((root) => {
    writeFileSync(join(root, "_truth/truth_events.csv"), "this,is,intentionally,invalid\n", "utf8");
    expect(() => loadSqueezeCsvBundle(root)).not.toThrow();
  }));
});

describe("point-in-time selection", () => {
  test("selects the latest eligible revision without admitting a future revision", () => {
    const rows = [
      { observation_id: "OBS-1", revision: 1, first_knowable_at: "2026-10-20T10:00:00Z", value: 10 },
      { observation_id: "OBS-1", revision: 2, first_knowable_at: "2026-10-20T12:00:00Z", value: 20 },
      { observation_id: "OBS-2", revision: 1, first_knowable_at: "2026-10-20T11:00:00Z", value: 30 },
    ];

    expect(selectLatestRevisionsAsOf(rows, "2026-10-20T11:30:00Z", (row) => row.observation_id)).toEqual([
      rows[0],
      rows[2],
    ]);
    expect(selectLatestRevisionsAsOf(rows, "2026-10-20T12:00:00Z", (row) => row.observation_id)).toEqual([
      rows[1],
      rows[2],
    ]);
  });

  test("builds a bundle whose model rows were knowable by the decision time", () => {
    const bundle = loadSqueezeCsvBundle(FIXTURE_ROOT);
    const decisionAt = "2026-09-23T20:05:00Z";
    const snapshot = buildSqueezeBundleAsOf(bundle, decisionAt);

    expect(snapshot.decisionAt).toBe(decisionAt);
    expect(snapshot.datasets["equity_market_daily.csv"]).toHaveLength(18);
    for (const rows of Object.values(snapshot.datasets)) {
      expect(rows.every((row) => Date.parse(row.first_knowable_at) <= Date.parse(decisionAt))).toBe(true);
    }
  });
});
