import { describe, expect, test } from "vitest";
import { getYahooShortInterest, parseYahooShortInterest } from "./yahooShortInterest";

const reported = Date.UTC(2026, 9, 15) / 1000;
const now = Date.UTC(2026, 9, 23);
const stats = {
  shortPercentOfFloat: { raw: 0.237 },
  shortRatio: { raw: 4.66 },
  dateShortInterest: { raw: reported },
};
const quote = { quoteSummary: { result: [{ defaultKeyStatistics: stats }] } };

describe("Yahoo short interest", () => {
  test("converts a fraction to percent and preserves report date", () => {
    expect(parseYahooShortInterest("GME", quote, now)).toEqual({
      ticker: "GME", shortInterestPct: 23.7, daysToCover: 4.7, asOf: "2026-10-15",
    });
  });

  test("rejects incomplete and old observations", () => {
    expect(parseYahooShortInterest("GME", {}, now)).toBeNull();
    expect(parseYahooShortInterest("GME", {
      quoteSummary: { result: [{ defaultKeyStatistics: { ...stats, shortRatio: { raw: null } } }] },
    }, now)).toBeNull();
    expect(parseYahooShortInterest("GME", quote, Date.UTC(2027, 0, 1))).toBeNull();
    expect(parseYahooShortInterest("GME", quote, Date.UTC(2026, 9, 1))).toBeNull();
  });

  test("returns only observed rows when Yahoo has partial coverage", async () => {
    const requests: string[] = [];
    const fetcher = (async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (url.includes("fc.yahoo.com")) {
        return new Response("", { status: 302, headers: { "set-cookie": "A3=test; Path=/" } });
      }
      if (url.includes("getcrumb")) return new Response("crumb", { status: 200 });
      if (url.includes("/GME?")) return new Response(JSON.stringify(quote), { status: 200 });
      return new Response("", { status: 404 });
    }) as typeof fetch;
    const result = await getYahooShortInterest(["GME", "MISSING"], fetcher);
    expect(result.source).toBe("YAHOO");
    expect(result.requested).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(requests.find((url) => url.includes("/GME?"))).toContain("crumb=crumb");
  });
});
