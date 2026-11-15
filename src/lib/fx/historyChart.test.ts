import { describe, expect, it } from "vitest";
import { historyGeometry } from "./historyChart";

describe("FX dated history geometry", () => {
  it("breaks the line at missing observations without compressing calendar spacing", () => {
    const g = historyGeometry([
      { observationDate: "2026-10-23", displayLevel: 1.1 },
      { observationDate: "2026-10-26", displayLevel: 1.2 },
      { observationDate: "2026-10-27", displayLevel: null },
      { observationDate: "2026-10-28", displayLevel: 1.3 },
    ]);
    expect(g.segments.map(s => s.length)).toEqual([2, 1]);
    const [first, second] = g.segments[0];
    expect(second.x - first.x).toBeCloseTo(3 / 5, 10);
    expect(g.gapCount).toBe(1);
    expect(g.firstDate).toBe("2026-10-23");
    expect(g.lastDate).toBe("2026-10-28");
  });
  it("places flat/single observations finitely and shows no invented levels for an empty series", () => {
    const g = historyGeometry([{ observationDate: "2026-10-30", displayLevel: 1.1 }]);
    expect(g.segments[0][0]).toMatchObject({ value: 1.1, y: .5 });
    expect(Number.isFinite(g.segments[0][0].x)).toBe(true);
    expect(historyGeometry([]).segments).toEqual([]);
  });
  it("does not draw invalid date, zero or nonfinite input as observed evidence", () => {
    const g = historyGeometry([
      { observationDate: "bad", displayLevel: 1.1 },
      { observationDate: "2026-10-26", displayLevel: NaN },
      { observationDate: "2026-10-27", displayLevel: 0 },
      { observationDate: "2026-10-28", displayLevel: 1.3 },
    ]);
    expect(g.segments).toHaveLength(1);
    expect(g.segments[0]).toHaveLength(1);
    expect(g.segments[0][0].value).toBe(1.3);
    expect(g.gapCount).toBe(3);
  });
});
