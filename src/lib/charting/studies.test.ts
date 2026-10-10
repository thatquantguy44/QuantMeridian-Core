import { describe, it, expect } from "vitest";
import { computeStudy, monthlySeasonality } from "./studies";

describe("computeStudy — pair guards", () => {
  it("returns null for pair studies when only one series is present", () => {
    expect(computeStudy({ id: "s", type: "spread" }, [[1, 2, 3]], ["A"])).toBeNull();
    expect(computeStudy({ id: "r", type: "ratio" }, [[1, 2, 3]], ["A"])).toBeNull();
  });
});

describe("spread", () => {
  it("computes S1 − S2 elementwise", () => {
    const pane = computeStudy({ id: "s", type: "spread" }, [[10, 12, 14], [4, 5, 6]], ["A", "B"]);
    expect(pane?.lines[0].values).toEqual([6, 7, 8]);
  });
});

describe("ratio", () => {
  it("computes S1 ÷ S2 and guards divide-by-zero", () => {
    const pane = computeStudy({ id: "r", type: "ratio" }, [[10, 12], [2, 0]], ["A", "B"]);
    expect(pane?.lines[0].values[0]).toBeCloseTo(5, 10);
    expect(pane?.lines[0].values[1]).toBeNull();
  });
});

describe("rolling correlation", () => {
  it("is ~+1 for perfectly co-moving return series", () => {
    const a = Array.from({ length: 80 }, (_, i) => 100 * 1.01 ** i);
    const b = Array.from({ length: 80 }, (_, i) => 50 * 1.01 ** i);
    const pane = computeStudy({ id: "c", type: "roll_corr", window: 20 }, [a, b], ["A", "B"]);
    const last = pane?.lines[0].values.filter((v): v is number => v != null).at(-1);
    expect(last as number).toBeCloseTo(1, 3);
  });
  it("declares a [-1, 1] domain", () => {
    const a = Array.from({ length: 40 }, (_, i) => i + 1);
    const b = Array.from({ length: 40 }, (_, i) => 40 - i);
    const pane = computeStudy({ id: "c", type: "roll_corr", window: 10 }, [a, b], ["A", "B"]);
    expect(pane?.domain).toEqual([-1, 1]);
  });
});

describe("rolling beta", () => {
  it("is ~1 when A moves identically to benchmark B", () => {
    const b = Array.from({ length: 80 }, (_, i) => 100 * 1.005 ** i);
    const a = [...b];
    const pane = computeStudy({ id: "be", type: "roll_beta", window: 20 }, [a, b], ["A", "B"]);
    const last = pane?.lines[0].values.filter((v): v is number => v != null).at(-1);
    expect(last as number).toBeCloseTo(1, 3);
  });
});

describe("percentile rank", () => {
  it("is a single-series study scaled to [0,100]", () => {
    const v = Array.from({ length: 300 }, (_, i) => i);
    const pane = computeStudy({ id: "p", type: "percentile", window: 252 }, [v], ["A"]);
    expect(pane).not.toBeNull();
    expect(pane?.domain).toEqual([0, 100]);
    const last = pane?.lines[0].values.filter((x): x is number => x != null).at(-1);
    expect(last as number).toBeGreaterThan(90); // newest value is near the top of its window
  });
});

describe("monthlySeasonality", () => {
  it("returns 12 month buckets", () => {
    const axis: string[] = [];
    const values: number[] = [];
    let price = 100;
    for (let y = 2018; y <= 2023; y++) {
      for (let m = 1; m <= 12; m++) {
        axis.push(`${y}-${String(m).padStart(2, "0")}-28`);
        price *= 1.01;
        values.push(price);
      }
    }
    const stats = monthlySeasonality(axis, values);
    expect(stats).toHaveLength(12);
    expect(stats.map((s) => s.month)).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
    // steady +1%/mo growth → each month's mean ≈ +1%
    for (const s of stats) if (s.mean != null) expect(s.mean).toBeCloseTo(1, 1);
  });
});
