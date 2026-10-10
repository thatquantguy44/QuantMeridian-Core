import { describe, it, expect } from "vitest";
import {
  pctChange,
  logTransform,
  vsLag,
  index100,
  zscore,
  applyPointTransform,
  applyWindowTransform,
  transformFmt,
} from "./transforms";

describe("pctChange", () => {
  it("computes period-over-period percent change, null at the first point", () => {
    const out = pctChange([100, 110, 99]);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeCloseTo(10, 10);
    expect(out[2]).toBeCloseTo(-10, 10);
  });
  it("returns null when the prior value is 0 (avoids divide-by-zero)", () => {
    expect(pctChange([0, 5])).toEqual([null, null]);
  });
});

describe("logTransform", () => {
  it("takes the natural log of positive values", () => {
    expect(logTransform([1, Math.E])[0]).toBeCloseTo(0, 10);
    expect(logTransform([1, Math.E])[1]).toBeCloseTo(1, 10);
  });
  it("returns null for non-positive values", () => {
    expect(logTransform([0, -3])).toEqual([null, null]);
  });
});

describe("vsLag (calendar-accurate YoY/MoM)", () => {
  it("compares against the observation ~365 days earlier", () => {
    const dates = ["2022-01-01", "2022-07-01", "2023-01-01"];
    const values = [100, 120, 110];
    const out = vsLag(dates, values, 365);
    expect(out[0]).toBeNull(); // nothing a year before the first point
    expect(out[2]).toBeCloseTo(10, 6); // 110 vs 100 a year prior
  });
});

describe("index100", () => {
  it("rebases the first non-null value to 100", () => {
    expect(index100([50, 75, 100])).toEqual([100, 150, 200]);
  });
  it("skips leading nulls when choosing the base", () => {
    const out = index100([null, 40, 60]);
    expect(out[0]).toBeNull();
    expect(out[1]).toBe(100);
    expect(out[2]).toBe(150);
  });
});

describe("zscore", () => {
  it("standardizes to mean 0", () => {
    const out = zscore([1, 2, 3, 4, 5]).filter((v): v is number => v != null);
    const mean = out.reduce((a, b) => a + b, 0) / out.length;
    expect(mean).toBeCloseTo(0, 10);
  });
  it("returns all-null for fewer than two points", () => {
    expect(zscore([5])).toEqual([null]);
  });
});

describe("applyPointTransform dispatch", () => {
  it("passes values through unchanged for 'none'", () => {
    expect(applyPointTransform("none", ["2020-01-01"], [42])).toEqual([42]);
  });
  it("routes 'pct_change' to pctChange", () => {
    const out = applyPointTransform("pct_change", ["a", "b"], [100, 110]);
    expect(out[0]).toBeNull();
    expect(out[1]).toBeCloseTo(10, 10);
  });
});

describe("applyWindowTransform dispatch", () => {
  it("rebases for index100 and is identity for none", () => {
    expect(applyWindowTransform("index100", [20, 40])).toEqual([100, 200]);
    expect(applyWindowTransform("none", [20, 40])).toEqual([20, 40]);
  });
});

describe("transformFmt", () => {
  it("formats percentages with a sign", () => {
    expect(transformFmt("yoy")(3.2)).toBe("+3.2%");
    expect(transformFmt("yoy")(-1)).toBe("-1.0%");
  });
  it("formats z-scores with sigma", () => {
    expect(transformFmt("zscore")(1.5)).toBe("+1.50σ");
  });
});
