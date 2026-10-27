import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";

import {
  evaluateSqueezeDatasetGate,
  type SqueezeDatasetGateInput,
  type SqueezeDatasetGatePolicy,
  type SqueezeFreshnessGatePolicy,
} from "./qualityGates";

const DECISION_AT = "2026-10-23T21:00:00Z";

function input(overrides: Partial<SqueezeDatasetGateInput> = {}): SqueezeDatasetGateInput {
  return {
    dataset: "equity_market_daily.csv",
    decisionAt: DECISION_AT,
    units: [
      {
        coverageKey: "SEC-QAVA",
        recordIds: ["EQ-QAVA-2026-10-23"],
        observedAt: "2026-10-23T20:00:00Z",
        qualityState: "VALID",
      },
      {
        coverageKey: "SEC-QBRI",
        recordIds: ["EQ-QBRI-2026-10-23"],
        observedAt: "2026-10-23T20:00:00Z",
        qualityState: "VALID",
      },
    ],
    ...overrides,
  };
}

function policy(overrides: Partial<SqueezeDatasetGatePolicy> = {}): SqueezeDatasetGatePolicy {
  return {
    policyVersion: "sqz-test-policy-1",
    requirement: "REQUIRED",
    allowDegraded: false,
    freshness: { mode: "ELAPSED", budgetMs: 2 * 60 * 60 * 1_000 },
    coverage: {
      grain: "LISTING_SECURITY",
      expectedKeys: ["SEC-QAVA", "SEC-QBRI"],
      minimumRatio: 1,
    },
    ...overrides,
  };
}

describe("evaluateSqueezeDatasetGate", () => {
  it("accepts valid, fresh units with sufficient coverage", () => {
    const report = evaluateSqueezeDatasetGate(input(), policy());

    expect(report.disposition).toBe("ACCEPT");
    expect(report.decisions.map((decision) => [decision.ruleId, decision.disposition])).toEqual([
      ["ROW_QUALITY", "ACCEPT"],
      ["SOURCE_FRESHNESS", "ACCEPT"],
      ["SOURCE_COVERAGE", "ACCEPT"],
    ]);
    expect(report.decisions[2].evidence).toMatchObject({
      expectedCoverageCount: 2,
      observedCoverageCount: 2,
      coverageRatio: 1,
      coverageGrain: "LISTING_SECURITY",
      minimumCoverageRatio: 1,
    });

    const ajv = new Ajv2020({ strict: true, allErrors: true });
    addFormats(ajv);
    const schema = JSON.parse(readFileSync(resolve(
      process.cwd(),
      "contracts/squeeze_radar/v1/quality-decision-1.0.schema.json",
    ), "utf8"));
    const validate = ajv.compile(schema);
    expect(validate(report), JSON.stringify(validate.errors)).toBe(true);
  });

  it("suppresses a required stale source and names the affected unit", () => {
    const report = evaluateSqueezeDatasetGate(input({
      units: [
        {
          coverageKey: "SEC-QAVA",
          recordIds: ["EQ-QAVA-2026-10-23"],
          observedAt: "2026-10-23T18:59:59Z",
          qualityState: "VALID",
        },
        input().units[1],
      ],
    }), policy());

    expect(report.disposition).toBe("SUPPRESS");
    expect(report.decisions[1]).toMatchObject({
      ruleId: "SOURCE_FRESHNESS",
      severity: "CRITICAL",
      disposition: "SUPPRESS",
      reasonCode: "STALE_REQUIRED_SOURCE",
      affected: { coverageKeys: ["SEC-QAVA"], recordIds: ["EQ-QAVA-2026-10-23"] },
      evidence: { maximumAgeMs: 7_201_000, freshnessBudgetMs: 7_200_000 },
    });
  });

  it("degrades rather than suppresses an optional stale source", () => {
    const report = evaluateSqueezeDatasetGate(input({
      units: [{
        coverageKey: "SEC-QAVA",
        recordIds: ["EQ-QAVA-2026-10-23"],
        observedAt: "2026-10-23T18:00:00Z",
        qualityState: "VALID",
      }],
    }), policy({
      requirement: "OPTIONAL",
      coverage: { grain: "LISTING_SECURITY", expectedKeys: ["SEC-QAVA"], minimumRatio: 1 },
    }));

    expect(report.disposition).toBe("DEGRADE");
    expect(report.decisions[1]).toMatchObject({
      disposition: "DEGRADE",
      reasonCode: "STALE_OPTIONAL_SOURCE",
    });
  });

  it("quarantines explicitly quarantined records and reports degraded data", () => {
    const report = evaluateSqueezeDatasetGate(input({
      units: [
        { ...input().units[0], qualityState: "QUARANTINED" },
        { ...input().units[1], qualityState: "DEGRADED" },
      ],
    }), policy({ allowDegraded: true }));

    expect(report.disposition).toBe("QUARANTINE");
    expect(report.decisions[0]).toMatchObject({
      severity: "ERROR",
      disposition: "QUARANTINE",
      reasonCode: "QUALITY_QUARANTINED",
      affected: {
        coverageKeys: ["SEC-QAVA"],
        recordIds: ["EQ-QAVA-2026-10-23"],
      },
      evidence: { degradedCount: 1, quarantinedCount: 1 },
    });
  });

  it("suppresses required coverage collapse and degrades optional coverage collapse", () => {
    const onlyOneUnit = input({ units: [input().units[0]] });
    const required = evaluateSqueezeDatasetGate(onlyOneUnit, policy({
      coverage: { grain: "LISTING_SECURITY", expectedKeys: ["SEC-QAVA", "SEC-QBRI"], minimumRatio: 0.75 },
    }));
    const optional = evaluateSqueezeDatasetGate(onlyOneUnit, policy({
      requirement: "OPTIONAL",
      coverage: { grain: "LISTING_SECURITY", expectedKeys: ["SEC-QAVA", "SEC-QBRI"], minimumRatio: 0.75 },
    }));

    expect(required.decisions[2]).toMatchObject({
      disposition: "SUPPRESS",
      reasonCode: "REQUIRED_COVERAGE_COLLAPSE",
      affected: { coverageKeys: ["SEC-QBRI"], recordIds: [] },
      evidence: { coverageRatio: 0.5, minimumCoverageRatio: 0.75 },
    });
    expect(optional.decisions[2]).toMatchObject({
      disposition: "DEGRADE",
      reasonCode: "OPTIONAL_COVERAGE_COLLAPSE",
    });
  });

  it("treats coverage below, but not equal to, 75 percent as systemic collapse", () => {
    const expectedKeys = ["SEC-QAVA", "SEC-QBRI", "SEC-QCYR", "SEC-QDYN"];
    const threeUnits = [
      ...input().units,
      {
        coverageKey: "SEC-QCYR",
        recordIds: ["EQ-QCYR-2026-10-23"],
        observedAt: "2026-10-23T20:00:00Z",
        qualityState: "VALID" as const,
      },
    ];
    const atBoundary = evaluateSqueezeDatasetGate(input({ units: threeUnits }), policy({
      coverage: { grain: "LISTING_SECURITY", expectedKeys, minimumRatio: 0.75 },
    }));
    const belowBoundary = evaluateSqueezeDatasetGate(input({ units: input().units }), policy({
      coverage: { grain: "LISTING_SECURITY", expectedKeys, minimumRatio: 0.75 },
    }));

    expect(atBoundary.decisions[2]).toMatchObject({
      disposition: "ACCEPT",
      evidence: { coverageRatio: 0.75, minimumCoverageRatio: 0.75 },
    });
    expect(belowBoundary.decisions[2]).toMatchObject({
      disposition: "SUPPRESS",
      reasonCode: "REQUIRED_COVERAGE_COLLAPSE",
      evidence: { coverageRatio: 0.5, minimumCoverageRatio: 0.75 },
    });
  });

  it("requires explicit, internally consistent policy instead of inventing defaults", () => {
    expect(() => evaluateSqueezeDatasetGate(input(), policy({
      freshness: { mode: "ELAPSED", budgetMs: -1 },
    }))).toThrow(/budgetMs/);
    expect(() => evaluateSqueezeDatasetGate(input(), policy({
      coverage: { grain: "LISTING_SECURITY", expectedKeys: [], minimumRatio: 1 },
    }))).toThrow(/expectedKeys/);
    expect(() => evaluateSqueezeDatasetGate(input(), policy({
      coverage: { grain: "LISTING_SECURITY", expectedKeys: ["SEC-QAVA", "SEC-QAVA"], minimumRatio: 1 },
    }))).toThrow(/unique/);
    expect(() => evaluateSqueezeDatasetGate(input(), policy({
      coverage: { grain: "LISTING_SECURITY", expectedKeys: ["SEC-QAVA"], minimumRatio: 1.01 },
    }))).toThrow(/minimumRatio/);
    expect(() => evaluateSqueezeDatasetGate(input(), policy({
      freshness: {
        mode: "NEXT_BUSINESS_PUBLICATION",
        calendar: "WEEKDAYS_ONLY",
        publicationTimeUtc: "24:00:00",
        gracePeriodMs: 1,
      },
    }))).toThrow(/publicationTimeUtc/);
    expect(() => evaluateSqueezeDatasetGate(input(), policy({
      freshness: {
        mode: "NEXT_BUSINESS_PUBLICATION",
        calendar: "WEEKDAYS_ONLY",
        publicationTimeUtc: "20:00:00",
        gracePeriodMs: -1,
      },
    }))).toThrow(/gracePeriodMs/);
  });

  it("rejects duplicate units and observations after the decision time", () => {
    expect(() => evaluateSqueezeDatasetGate(input({
      units: [input().units[0], input().units[0]],
    }), policy())).toThrow(/coverageKey/);
    expect(() => evaluateSqueezeDatasetGate(input({
      units: [{ ...input().units[0], observedAt: "2026-10-23T21:00:01Z" }],
    }), policy({ coverage: { grain: "LISTING_SECURITY", expectedKeys: ["SEC-QAVA"], minimumRatio: 1 } }))).toThrow(/decisionAt/);
  });

  it("rejects runtime values that bypass TypeScript policy and input types", () => {
    expect(() => evaluateSqueezeDatasetGate(input(), {
      ...policy(),
      requirement: "CONVENIENT" as "REQUIRED",
    })).toThrow(/requirement/);
    expect(() => evaluateSqueezeDatasetGate(input(), {
      ...policy(),
      allowDegraded: "yes" as unknown as boolean,
    })).toThrow(/allowDegraded/);
    expect(() => evaluateSqueezeDatasetGate(input(), policy({
      coverage: {
        ...policy().coverage,
        grain: "WHATEVER_THE_DASHBOARD_FOUND" as "LISTING_SECURITY",
      },
    }))).toThrow(/coverage\.grain/);
    expect(() => evaluateSqueezeDatasetGate(input({
      units: [{ ...input().units[0], qualityState: "MYSTERY" as "VALID" }, input().units[1]],
    }), policy())).toThrow(/qualityState/);
    expect(() => evaluateSqueezeDatasetGate(input(), policy({
      coverage: { grain: "LISTING_SECURITY", expectedKeys: ["SEC-QAVA"], minimumRatio: 1 },
    }))).toThrow(/unexpected coverageKey/);
  });

  it("uses the configured next-business-day publication grace across weekends", () => {
    const scheduledPolicy = policy({
      freshness: {
        mode: "NEXT_BUSINESS_PUBLICATION",
        calendar: "WEEKDAYS_ONLY",
        publicationTimeUtc: "20:00:00",
        gracePeriodMs: 30 * 60 * 1_000,
      },
    });
    const friday = input({
      decisionAt: "2026-10-26T20:30:00Z",
      units: input().units.map((unit) => ({ ...unit, observedAt: "2026-10-23T20:00:00Z" })),
    });

    const atDeadline = evaluateSqueezeDatasetGate(friday, scheduledPolicy);
    const afterDeadline = evaluateSqueezeDatasetGate({
      ...friday,
      decisionAt: "2026-10-26T20:30:00.001Z",
    }, scheduledPolicy);

    expect(atDeadline.decisions[1]).toMatchObject({
      disposition: "ACCEPT",
      evidence: {
        freshnessMode: "NEXT_BUSINESS_PUBLICATION",
        gracePeriodMs: 1_800_000,
        earliestFreshnessDeadlineAt: "2026-10-26T20:30:00Z",
      },
    });
    expect(afterDeadline.decisions[1]).toMatchObject({
      disposition: "SUPPRESS",
      reasonCode: "STALE_REQUIRED_SOURCE",
    });
  });

  it("publishes configurable 30-minute snapshot and two-hour short-volume grace policies", () => {
    const policyDocument = JSON.parse(readFileSync(resolve(
      process.cwd(),
      "contracts/squeeze_radar/v1/policies/synthetic-freshness-1.0.json",
    ), "utf8"));
    const schema = JSON.parse(readFileSync(resolve(
      process.cwd(),
      "contracts/squeeze_radar/v1/synthetic-freshness-policy-1.0.schema.json",
    ), "utf8"));
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    const validate = ajv.compile(schema);
    const scenario = JSON.parse(readFileSync(resolve(
      process.cwd(),
      "contracts/squeeze_radar/v1/scenarios/base.json",
    ), "utf8"));

    expect(validate(policyDocument), JSON.stringify(validate.errors)).toBe(true);
    for (const dataset of [
      "inventory_snapshots.csv",
      "loan_snapshots.csv",
      "market_borrow_snapshots.csv",
      "equity_market_daily.csv",
      "options_snapshots.csv",
      "etf_snapshots.csv",
    ]) {
      expect(policyDocument.datasets[dataset].gracePeriodMs, dataset).toBe(30 * 60 * 1_000);
      expect(policyDocument.datasets[dataset].publicationTimeUtc, dataset)
        .toBe(scenario.publication_schedules[dataset].observed_time_utc);
    }
    expect(policyDocument.datasets["short_sale_volume.csv"].gracePeriodMs).toBe(2 * 60 * 60 * 1_000);
    expect(policyDocument.datasets["short_sale_volume.csv"].publicationTimeUtc)
      .toBe(scenario.publication_schedules["short_sale_volume.csv"].observed_time_utc);

    const shortVolumeInput = input({
      dataset: "short_sale_volume.csv",
      decisionAt: "2026-10-26T22:00:00Z",
      units: input().units.map((unit) => ({ ...unit, observedAt: "2026-10-23T20:00:00Z" })),
    });
    const shortVolumePolicy = policy({
      freshness: policyDocument.datasets["short_sale_volume.csv"] as SqueezeFreshnessGatePolicy,
    });
    expect(evaluateSqueezeDatasetGate(shortVolumeInput, shortVolumePolicy).decisions[1].disposition).toBe("ACCEPT");
    expect(evaluateSqueezeDatasetGate({
      ...shortVolumeInput,
      decisionAt: "2026-10-26T22:00:00.001Z",
    }, shortVolumePolicy).decisions[1]).toMatchObject({
      disposition: "SUPPRESS",
      reasonCode: "STALE_REQUIRED_SOURCE",
    });
  });

  it("publishes the approved synthetic coverage grains and systemic-collapse threshold", () => {
    const policyDocument = JSON.parse(readFileSync(resolve(
      process.cwd(),
      "contracts/squeeze_radar/v1/policies/synthetic-coverage-1.0.json",
    ), "utf8"));
    const schema = JSON.parse(readFileSync(resolve(
      process.cwd(),
      "contracts/squeeze_radar/v1/synthetic-coverage-policy-1.0.schema.json",
    ), "utf8"));
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    const validate = ajv.compile(schema);

    expect(validate(policyDocument), JSON.stringify(validate.errors)).toBe(true);
    expect(policyDocument.systemicCollapseBelowRatio).toBe(0.75);
    expect(Object.fromEntries(Object.entries(policyDocument.datasets).map(([dataset, value]) => [
      dataset,
      (value as { coverageGrain: string }).coverageGrain,
    ]))).toEqual({
      "securities.csv": "SECURITY_LISTING",
      "inventory_snapshots.csv": "BOOK_SECURITY",
      "loan_snapshots.csv": "BOOK_SECURITY_WITH_SOURCE_HEARTBEAT",
      "borrow_events.csv": "BOOK_SOURCE_HEARTBEAT",
      "market_borrow_snapshots.csv": "PROVIDER_SECURITY",
      "short_interest.csv": "SOURCE_SECURITY",
      "short_sale_volume.csv": "VENUE_SCOPE_SECURITY",
      "equity_market_daily.csv": "LISTING_SECURITY",
      "options_snapshots.csv": "PROVIDER_UNDERLYING",
      "etf_snapshots.csv": "ETF_SECURITY",
      "security_events.csv": "SOURCE_HEARTBEAT",
    });
  });
});
