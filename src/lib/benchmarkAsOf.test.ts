import { expect, it } from "vitest";
import { benchmarkAsOfDate } from "./benchmarkAsOf";

it("uses New York's calendar date across UTC midnight and daylight-saving transitions", () => {
  expect(benchmarkAsOfDate(new Date("2026-11-11T00:30:00Z"))).toBe("2026-11-10");
  expect(benchmarkAsOfDate(new Date("2026-11-11T05:30:00Z"))).toBe("2026-11-11");
  expect(benchmarkAsOfDate(new Date("2026-07-01T04:30:00Z"))).toBe("2026-07-01");
});
