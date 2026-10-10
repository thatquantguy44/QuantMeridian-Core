import { describe, it, expect } from "vitest";
import { computeIndicator, synthOHLC } from "./indicators";

const ramp = Array.from({ length: 30 }, (_, i) => i + 1); // 1..30

describe("SMA", () => {
  it("is null until the window fills, then equals the trailing mean", () => {
    const { overlays } = computeIndicator({ id: "s", type: "sma", length: 3 }, ramp, 0);
    const v = overlays[0].values;
    expect(v[0]).toBeNull();
    expect(v[1]).toBeNull();
    expect(v[2]).toBeCloseTo(2, 10); // mean(1,2,3)
    expect(v[3]).toBeCloseTo(3, 10); // mean(2,3,4)
  });
});

describe("EMA", () => {
  it("produces a value at the window boundary and tracks the series", () => {
    const { overlays } = computeIndicator({ id: "e", type: "ema", length: 5 }, ramp, 0);
    const v = overlays[0].values;
    expect(v[3]).toBeNull();
    expect(v[4]).not.toBeNull();
    // On a monotonic ramp the EMA sits below the latest value.
    expect(v[v.length - 1] as number).toBeLessThan(ramp[ramp.length - 1]);
  });
});

describe("Bollinger Bands", () => {
  it("emits upper/mid/lower with upper ≥ mid ≥ lower", () => {
    const noisy = [10, 12, 9, 14, 8, 15, 7, 16, 6, 17, 5, 18];
    const { overlays } = computeIndicator({ id: "b", type: "bollinger", length: 4, k: 2 }, noisy, 0);
    expect(overlays).toHaveLength(3);
    const [upper, mid, lower] = overlays.map((o) => o.values);
    const i = noisy.length - 1;
    expect(upper[i] as number).toBeGreaterThanOrEqual(mid[i] as number);
    expect(mid[i] as number).toBeGreaterThanOrEqual(lower[i] as number);
  });
});

describe("RSI", () => {
  it("is 100 for a strictly rising series (no losses)", () => {
    const { oscPanes } = computeIndicator({ id: "r", type: "rsi", length: 14 }, ramp, 0);
    const rsi = oscPanes[0].lines[0].values.filter((v): v is number => v != null);
    expect(rsi[rsi.length - 1]).toBe(100);
  });
  it("stays within [0,100]", () => {
    const wave = Array.from({ length: 40 }, (_, i) => 50 + 10 * Math.sin(i / 2));
    const { oscPanes } = computeIndicator({ id: "r", type: "rsi", length: 14 }, wave, 0);
    for (const v of oscPanes[0].lines[0].values) {
      if (v != null) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });
});

describe("MACD", () => {
  it("produces MACD + signal lines and a histogram", () => {
    const series = Array.from({ length: 60 }, (_, i) => 100 + i + 5 * Math.sin(i / 3));
    const { oscPanes } = computeIndicator({ id: "m", type: "macd", fast: 12, slow: 26, signal: 9 }, series, 0);
    expect(oscPanes).toHaveLength(1);
    expect(oscPanes[0].lines.length).toBeGreaterThanOrEqual(2);
    expect(oscPanes[0].bars).toBeDefined();
  });
});

describe("indicators handle gaps (nulls scattered back to the axis)", () => {
  it("keeps output aligned to input length", () => {
    const withGaps = [1, null, 3, 4, null, 6, 7, 8] as (number | null)[];
    const { overlays } = computeIndicator({ id: "s", type: "sma", length: 2 }, withGaps, 0);
    expect(overlays[0].values).toHaveLength(withGaps.length);
    // positions that were null in the input stay null in the overlay
    expect(overlays[0].values[1]).toBeNull();
    expect(overlays[0].values[4]).toBeNull();
  });
});

describe("synthOHLC", () => {
  it("derives one OHLC bar per input point with high ≥ max(o,c) ≥ min(o,c) ≥ low", () => {
    const bars = synthOHLC([100, 105, 102]);
    expect(bars).toHaveLength(3);
    for (const b of bars) {
      if (b.c == null) continue;
      expect(b.h as number).toBeGreaterThanOrEqual(Math.max(b.o as number, b.c as number));
      expect(b.l as number).toBeLessThanOrEqual(Math.min(b.o as number, b.c as number));
    }
  });
  it("carries nulls through", () => {
    expect(synthOHLC([null])[0]).toEqual({ o: null, h: null, l: null, c: null });
  });
});
