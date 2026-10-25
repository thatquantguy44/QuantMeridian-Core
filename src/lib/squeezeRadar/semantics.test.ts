import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import vectorCatalogJson from "../../../contracts/squeeze_radar/v1/semantic-test-vectors-1.0.json";
import {
  evaluateSqueezeSemanticRule,
  type SemanticTestVectorCatalog,
} from "./semantics";

const vectorCatalog = vectorCatalogJson as SemanticTestVectorCatalog;

describe("Squeeze Radar semantic contract", () => {
  it("executes every machine-readable golden vector", () => {
    expect(vectorCatalog.vector_version).toBe("1.0");
    expect(vectorCatalog.data_mode).toBe("SIM");
    expect(new Set(vectorCatalog.cases.map((testCase) => testCase.id)).size).toBe(vectorCatalog.cases.length);

    for (const testCase of vectorCatalog.cases) {
      expect(evaluateSqueezeSemanticRule(testCase.rule, testCase.input), testCase.id)
        .toEqual(testCase.expected);
    }
  });

  it("covers every methodology topic required by SQZ-T04", () => {
    const coveredRules = new Set(vectorCatalog.cases.map((testCase) => testCase.rule));
    expect(coveredRules).toEqual(new Set([
      "MARKET_UTILIZATION_PCT",
      "MARKET_AVAILABLE_QTY",
      "INTERNAL_ELIGIBLE_QTY",
      "INTERNAL_AVAILABLE_QTY",
      "EQUIVALENT_FEE_BPS",
      "LOAN_RATE_COMPARABILITY",
      "SHORT_INTEREST_PCT",
      "SHORT_MEASURE_COMPATIBILITY",
      "SHORT_SALE_VOLUME_PCT",
      "DAYS_TO_COVER",
      "PRICE_RETURN_PCT",
      "PUT_CALL_RATIO",
      "OPEN_INTEREST_CHANGE_PCT",
      "OPTIONS_MEASURE_VALIDITY",
      "PUBLICATION_ELIGIBILITY",
    ]));
  });

  it("documents every executable rule in the methodology dictionary", () => {
    const dictionary = readFileSync(resolve(process.cwd(), "docs/specs/spec021/METHODOLOGY_DICTIONARY.md"), "utf8");
    for (const rule of new Set(vectorCatalog.cases.map((testCase) => testCase.rule))) {
      expect(dictionary, rule).toContain(`\`${rule}\``);
    }
    expect(dictionary).toContain("short-sale volume is not short interest");
    expect(dictionary).toContain("No missing input is converted to zero");
  });
});
