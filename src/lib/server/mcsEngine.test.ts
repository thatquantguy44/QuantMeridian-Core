import { describe, expect, it } from "vitest";
import { fitVar1, simulate, type NsFactorRow } from "./mcsEngine";

function factorHistory(fitValid: number | string = 1): NsFactorRow[] {
  return Array.from({ length: 40 }, (_, i) => ({
    observation_date: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    beta0: 4 + 0.1 * Math.sin(i),
    beta1: -1 + 0.2 * Math.cos(i / 2),
    beta2: 0.3 + 0.1 * Math.sin(i / 3),
    lambda: 1.7,
    fit_valid: fitValid,
    regime_name: "Neutral",
  }));
}

describe("MCS factor history", () => {
  it("produces the same fit and simulation for PostgreSQL bigint strings as SQLite numbers", () => {
    const numericFit = fitVar1(factorHistory(1));
    const postgresFit = fitVar1(factorHistory("1"));

    expect(postgresFit).toEqual(numericFit);
    expect(postgresFit.fitObservations).toBe(39);
    const config = { numPaths: 200, horizonDays: 21, checkpoints: [21], tenors: [0.25, 10], seed: 42 };
    expect(simulate(postgresFit, config)).toEqual(simulate(numericFit, config));
  });

  it("continues to exclude invalid fits in both database representations", () => {
    const validRows = factorHistory();
    const invalidRows = [0, "0", 2, "2"].map((fit_valid) => ({
      ...validRows[0],
      observation_date: "2026-03-01",
      beta0: 1000,
      fit_valid,
    }));

    expect(fitVar1([...validRows, ...invalidRows])).toEqual(fitVar1(validRows));
  });

  it.each([1, "1"])("requires at least 30 valid observations when fit_valid is %j", (flag) => {
    expect(() => fitVar1(factorHistory(flag).slice(0, 29))).toThrow(
      "insufficient fitted NS observations for a VAR(1) (29 rows, need >= 30)"
    );
  });
});
