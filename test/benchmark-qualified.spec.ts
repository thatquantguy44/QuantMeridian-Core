import { test, expect, type Route } from "@playwright/test";
import { readFile } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const API = "**/api/econ/benchmark/qualified**";
const PROVIDER_API = "**/api/benchmark-provider-latest**";
const rate = {
  id: "SOFR", label: "Secured Overnight Financing Rate", short: "SOFR", category: "Overnight", displayUnit: "%", nativeUnit: "Percent",
  futureGoldCount: 0, firstFutureGoldDate: null, futureSourceCount: 0, firstFutureSourceDate: null, provider: "FRED", sourceUrl: "https://fred.stlouisfed.org/series/SOFR", frequency: "d", status: "available", reason: null,
  freshness: "stale", latestWarehouseSourceDate: "2026-10-26", latestWarehouseSourceValue: -0.5, latestWarehouseSourceIngestedAt: "2026-10-27T12:00:00Z", latestWarehouseSourceEvidence: ["provider-receipt"], evidenceMethods: ["provider-receipt"], latestWarehouseSourceStatus: "verified", firstRetainedDate: "2018-04-03", latestRetainedDate: "2026-10-23", observationDate: "2026-10-23",
  publishedAt: null, ingestedAt: "2026-10-24T12:00:00Z", providerCheckedAt: null, latestProviderDate: null,
  discontinued: "unknown", boardStatus: "matched", boardMetadata: { status: "available", asOfDate: "2026-11-10", source: "fred", latestRevisionStart: "2026-10-23", latestIngestedAt: "2026-10-24T12:00:00Z", unknownVintageCount: 0 }, observations: [{ date: "2026-10-22", value: 0 }, { date: "2026-10-23", value: -0.25 }],
};
const unavailable = { ...rate, id: "DGS10", label: "10-Year Treasury Yield", short: "10Y", category: "Treasury", status: "unavailable", reason: "Provider evidence unavailable.",
  sourceUrl: "https://fred.stlouisfed.org/series/DGS10", evidenceMethods: [], observationDate: null, latestRetainedDate: "2026-10-23", observations: [] };
const ok = { source: "DB", checkedAt: "2026-11-10T12:00:00Z", asOfDate: "2026-11-10", asOfTimeZone: "America/New_York", series: [rate, unavailable] };
const fulfill = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

for (const path of ["/economics/benchmark", "/economics/rate-analysis"]) {
  test(`${path}: mixed availability and SIM-on preserve the observed series only`, async ({ page }) => {
    await page.addInitScript(() => { localStorage.setItem("qit-sim-mode", "1"); localStorage.setItem("qit-snapshot-fallback", "1"); });
    await page.route(API, (route) => fulfill(route, ok));
    await page.goto(`${BASE}${path}`);
    const sofr = page.getByTestId("benchmark-series-SOFR");
    await expect(sofr).toContainText("-0.25");
    await expect(sofr).toContainText("2026-10-23");
    await expect(sofr).toContainText("2026-10-26");
    await expect(sofr).toContainText("-0.50");
    await expect(sofr).toContainText("Newer source record not yet in Gold");
    await expect(sofr).toContainText("stale");
    await expect(page.getByTestId("benchmark-board-SOFR")).toContainText("Board as of: 2026-11-10");
    await expect(page.getByTestId("benchmark-board-SOFR")).toContainText("Warehouse capture: 2026-10-24T12:00:00Z");
    await expect(page.getByTestId("benchmark-board-SOFR")).toContainText("History with unknown vintage: 0");
    await expect(page.getByTestId("benchmark-series-DGS10")).toContainText("Provider evidence unavailable");
    await expect(page.locator("main")).toContainText("Provider latest: not checked");
    await expect(page.locator("main")).not.toContainText("4.82");
    if (path.endsWith("rate-analysis")) {
      await expect(page.getByTestId("benchmark-composite-unavailable")).toContainText(/unavailable/i);
      await expect(page.getByTestId("benchmark-utilization-unavailable")).toContainText(/unavailable/i);
    }
  });
  test(`${path}: displays the last as-of observation while disclosing excluded future Gold`, async ({ page }) => {
    const iorb = { ...rate, id: "IORB", short: "IORB", label: "Interest on Reserve Balances", sourceUrl: "https://fred.stlouisfed.org/series/IORB",
      futureGoldCount: 1, firstFutureGoldDate: "2026-11-11", futureSourceCount: 1, firstFutureSourceDate: "2026-11-11", boardStatus: "future" };
    await page.route(API, (route) => fulfill(route, { ...ok, series: [iorb] }));
    await page.goto(`${BASE}${path}`);
    const row = page.getByTestId("benchmark-series-IORB");
    await expect(row).toContainText("-0.25");
    await expect(row).toContainText("2026-10-23");
    await expect(row).toContainText("Future-dated Gold excluded: 2026-11-11");
    await expect(row).toContainText("Benchmark board is future-dated and excluded");
    await expect(row).toContainText("Future-dated source records excluded: 2026-11-11");
  });
  test(`${path}: identifies unknown board metadata without inventing values`, async ({ page }) => {
    const partial = { ...rate, boardStatus: "unavailable", boardMetadata: { status: "partial", asOfDate: null, source: null, latestRevisionStart: null, latestIngestedAt: null, unknownVintageCount: null } };
    await page.route(API, (route) => fulfill(route, { ...ok, series: [partial] }));
    await page.goto(`${BASE}${path}`);
    const board = page.getByTestId("benchmark-board-SOFR");
    await expect(board).toContainText("Board as of: unknown");
    await expect(board).toContainText("Revision start: unknown");
    await expect(board).toContainText("History with unknown vintage: unknown");
    await expect(page.getByTestId("benchmark-series-SOFR")).toContainText("-0.25");
  });
  test(`${path}: checks provider dates separately and clears a failed retry`, async ({ page }, testInfo) => {
    let failing = false, checks = 0;
    const checkedAt = "2026-11-10T12:00:00.000Z";
    await page.route(API, (route) => fulfill(route, ok));
    await page.route(PROVIDER_API, (route) => {
      checks++;
      if (failing) return route.abort();
      return fulfill(route, { source: "FRED", startedAt: checkedAt, asOfDate: "2026-11-10", asOfTimeZone: "America/New_York", series: [
        { id: "SOFR", status: "checked", checkedAt, observationDate: "2026-10-27", futureObservationCount: 1, retryAfterSeconds: null },
        { id: "DGS10", status: "unavailable", checkedAt, observationDate: null, futureObservationCount: 0, retryAfterSeconds: null },
      ] });
    });
    await page.goto(`${BASE}${path}`);
    await expect(page.getByLabel("FRED provider check")).toContainText("Provider latest: not checked");
    expect(checks).toBe(0);
    await page.getByRole("button", { name: "Check FRED latest" }).click();
    const sofr = page.getByTestId("provider-latest-SOFR");
    await expect(sofr).toContainText("2026-10-27");
    await expect(sofr).toContainText("Qualified Gold: 2026-10-23 (FRED is later)");
    await expect(sofr).toContainText("Verified warehouse source: 2026-10-26 (FRED is later)");
    await expect(sofr).toContainText("Future-dated FRED records excluded: 1");
    await expect(page.getByTestId("provider-latest-DGS10")).toContainText("FRED check unavailable");
    await page.getByLabel("FRED provider check").screenshot({ path: testInfo.outputPath("provider-check.png") });
    failing = true;
    await page.getByRole("button", { name: "Check FRED latest" }).click();
    await expect(page.getByLabel("FRED provider check")).toContainText("FRED check unavailable or response rejected");
    await expect(page.getByLabel("FRED provider check")).not.toContainText("2026-10-27");
    await expect(page.getByTestId("benchmark-series-SOFR")).toContainText("-0.25");
  });
  test(`${path}: reports provider and limiter failures and recovers without changing Gold`, async ({ page }) => {
    let attempt = 0;
    const startedAt = "2026-11-10T12:00:00.000Z";
    await page.route(API, (route) => fulfill(route, ok));
    await page.route(PROVIDER_API, (route) => {
      attempt++;
      const statuses = attempt === 2 ? ["credential_rejected", "provider_rate_limited"] : attempt === 3 ? ["limiter_unavailable", "limiter_unavailable"] : ["checked", "provider_locked"];
      return fulfill(route, { source: "FRED", startedAt, asOfDate: "2026-11-10", asOfTimeZone: "America/New_York", series: statuses.map((status, index) => ({ id: index ? "DGS10" : "SOFR", status, checkedAt: status === "limiter_unavailable" ? null : startedAt, observationDate: status === "checked" ? "2026-10-27" : null, futureObservationCount: 0, retryAfterSeconds: null })) });
    });
    await page.goto(`${BASE}${path}`);
    const button = page.getByRole("button", { name: "Check FRED latest" });
    await button.click();
    await expect(page.getByTestId("provider-latest-SOFR")).toContainText("2026-10-27");
    await expect(page.getByTestId("provider-latest-DGS10")).toContainText("FRED access is locked");
    await button.click();
    await expect(page.getByTestId("provider-latest-SOFR")).toContainText("FRED rejected the configured API key");
    await expect(page.getByTestId("provider-latest-SOFR")).not.toContainText("2026-10-27");
    await expect(page.getByTestId("provider-latest-DGS10")).toContainText("FRED rate limited this request");
    await button.click();
    await expect(page.getByTestId("provider-latest-SOFR")).toContainText("shared rate limit unavailable");
    await expect(page.getByTestId("provider-latest-SOFR")).not.toContainText("Attempted");
    await button.click();
    await expect(page.getByTestId("provider-latest-SOFR")).toContainText("2026-10-27");
    await expect(page.getByTestId("benchmark-series-SOFR")).toContainText("-0.25");
    await expect(page.getByTestId("benchmark-series-DGS10")).toContainText("Provider evidence unavailable");
  });
  test(`${path}: shows missing provider credentials without a fabricated date`, async ({ page }) => {
    const startedAt = "2026-11-10T12:00:00.000Z";
    await page.route(API, (route) => fulfill(route, ok));
    await page.route(PROVIDER_API, (route) => fulfill(route, { source: "FRED", startedAt, asOfDate: "2026-11-10", asOfTimeZone: "America/New_York", series: ["SOFR", "DGS10"].map((id) => ({ id, status: "not_configured", checkedAt: null, observationDate: null, futureObservationCount: 0, retryAfterSeconds: null })) }));
    await page.goto(`${BASE}${path}`);
    await page.getByRole("button", { name: "Check FRED latest" }).click();
    await expect(page.getByTestId("provider-latest-SOFR")).toContainText("FRED API key not configured");
    await expect(page.getByTestId("provider-latest-SOFR")).not.toContainText("Checked");
  });
  test(`${path}: rejects populated simulation responses`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("qit-sim-mode", "1"));
    await page.route(API, (route) => fulfill(route, { ...ok, source: "SIM" }));
    await page.goto(`${BASE}${path}`);
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByTestId("benchmark-series-SOFR")).not.toContainText("-0.25");
  });
  test(`${path}: failed refresh clears a successful result`, async ({ page }) => {
    let failing = false;
    await page.route(API, (route) => failing ? route.abort() : fulfill(route, ok));
    await page.goto(`${BASE}${path}`);
    await expect(page.getByTestId("benchmark-series-SOFR")).toContainText("-0.25");
    failing = true;
    await page.getByRole("button", { name: "Refresh benchmark data" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByTestId("benchmark-series-SOFR")).not.toContainText("-0.25");
    if (path.endsWith("benchmark")) await expect(page.getByRole("button", { name: "Export benchmark PDF" })).toBeDisabled();
  });
}

test("BMRK exports the qualified source report and disables export after failure", async ({ page }, testInfo) => {
  let failing = false;
  await page.route(API, (route) => failing ? route.abort() : fulfill(route, ok));
  await page.goto(`${BASE}/economics/benchmark`);
  await expect(page.getByTestId("benchmark-series-SOFR")).toContainText("-0.25");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export benchmark PDF" }).click()]);
  expect(download.suggestedFilename()).toBe("BMRK_qualified_2026-11-10.pdf");
  expect(await download.failure()).toBeNull();
  await download.saveAs(testInfo.outputPath("qualified-benchmark.pdf"));
  failing = true;
  await page.getByRole("button", { name: "Refresh benchmark data" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Export benchmark PDF" })).toBeDisabled();
});

test("both pages remain usable on a narrow screen", async ({ page }) => {
  await page.route(API, (route) => fulfill(route, ok));
  await page.setViewportSize({ width: 390, height: 850 });
  for (const path of ["/economics/benchmark", "/economics/rate-analysis"]) {
    await page.goto(`${BASE}${path}`);
    await expect(page.getByTestId("benchmark-series-SOFR")).toContainText("-0.25");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  }
});


test("local retained warehouse: verified history is dated on both pages", async ({ page }, testInfo) => {
  const response = await page.request.get(`${BASE}/api/econ/benchmark/qualified?ids=SOFR`);
  const body = await response.json();
  test.skip(!response.ok() || body.source !== "DB" || body.series[0]?.status !== "available", "A qualified local warehouse is not configured.");
  const actual = body.series[0];
  for (const [index, path] of ["/economics/benchmark", "/economics/rate-analysis"].entries()) {
    await page.goto(`${BASE}${path}`);
    const row = page.getByTestId("benchmark-series-SOFR");
    await expect(row).toContainText(actual.observationDate, { timeout: 30000 });
    await expect(row).toContainText("FRED (distributor)");
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`live-${index}.png`) });
  }
});

test("both pages load older qualified history, keep failed pages out, and export the displayed sample", async ({ page }, testInfo) => {
  let corrupt = true;
  const older = { ...rate, latestRetainedDate: "2026-10-23", observationDate: "2026-10-21", boardStatus: "unavailable",
    observations: [{ date: "2026-10-20", value: 0.5 }, { date: "2026-10-21", value: 0.25 }] };
  await page.route(API, (route) => {
    if (!route.request().url().includes("before=")) return fulfill(route, ok);
    return fulfill(route, { ...ok, source: corrupt ? "SIM" : "DB", checkedAt: "2026-11-10T12:01:00Z", historyBefore: "2026-10-22", series: [older] });
  });
  for (const path of ["/economics/benchmark", "/economics/rate-analysis"]) {
    corrupt = true;
    await page.goto(`${BASE}${path}`);
    if (path.endsWith("benchmark")) await page.getByRole("button", { name: /Trend Analysis/i }).click();
    await expect(page.getByTestId("benchmark-history-coverage")).toContainText("2 observations");
    await page.getByRole("button", { name: "Load older history" }).click();
    await expect(page.getByRole("alert")).toContainText(/unverified or malformed/i);
    await expect(page.getByTestId("benchmark-history-coverage")).toContainText("2 observations");
    corrupt = false;
    await page.getByRole("button", { name: "Load older history" }).click();
    await expect(page.getByTestId("benchmark-history-coverage")).toContainText("4 observations");
    await expect(page.getByTestId("benchmark-history-coverage")).toContainText("2026-10-20");
    await page.getByTestId("benchmark-history-coverage").scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(path.endsWith("benchmark") ? "history-bmrk.png" : "history-bra.png") });
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export loaded CSV" }).click()]);
    expect(download.suggestedFilename()).toBe("BMRK_SOFR_history.csv");
    expect(await download.failure()).toBeNull();
    const csv = await readFile(await download.path(), "utf8");
    expect(csv).toContain("2026-10-20"); expect(csv).toContain("2026-10-23");
    expect(csv).toContain("2026-11-10T12:00:00Z"); expect(csv).toContain("2026-11-10T12:01:00Z");
    expect(csv).toContain("observation_page_as_of_date"); expect(csv).toContain("America/New_York");
  }
});

test("BMRK loads and exports only matched qualified spread history, and rejects an incomplete retry", async ({ page }, testInfo) => {
  const ten = { ...rate, id: "DGS10", label: "10-Year Treasury Yield", short: "10Y", category: "Treasury", sourceUrl: "https://fred.stlouisfed.org/series/DGS10", firstRetainedDate: "2020-01-01", observations: [{ date: "2026-10-22", value: 4 }, { date: "2026-10-23", value: 4.2 }] };
  const two = { ...ten, id: "DGS2", label: "2-Year Treasury Yield", short: "2Y", sourceUrl: "https://fred.stlouisfed.org/series/DGS2", observations: [{ date: "2026-10-22", value: 3 }, { date: "2026-10-23", value: 3.1 }] };
  let corrupt = true;
  await page.route(API, (route) => {
    const url = new URL(route.request().url());
    if (!url.searchParams.has("before")) return fulfill(route, { ...ok, series: [ten, two] });
    const isTen = url.searchParams.get("ids") === "DGS10";
    const item = isTen ? ten : two;
    const older = { ...item, boardStatus: "unavailable", observationDate: "2024-10-22", observations: isTen ? [{ date: "2024-10-20", value: 0 }, { date: "2024-10-21", value: 9 }, { date: "2024-10-22", value: 1 }] : [{ date: "2024-10-20", value: -1 }, { date: "2024-10-22", value: 0.5 }] };
    return fulfill(route, { ...ok, source: corrupt && !isTen ? "SIM" : "DB", checkedAt: "2026-11-10T12:01:00Z", historyBefore: "2026-10-22", series: [older] });
  });
  await page.goto(`${BASE}/economics/benchmark`);
  await page.getByRole("button", { name: "Spread Analysis" }).click();
  const coverage = page.getByTestId("benchmark-spread-history-coverage");
  await page.getByLabel("Spread history window").selectOption("ALL");
  await expect(coverage).toContainText("2 matched observations");
  await page.getByRole("button", { name: "Load older spread history" }).click();
  await expect(page.getByRole("alert")).toContainText(/unverified or malformed/i);
  await expect(coverage).toContainText("2 matched observations");
  corrupt = false;
  await page.getByRole("button", { name: "Load older spread history" }).click();
  await expect(coverage).toContainText("4 matched observations");
  await expect(coverage).toContainText("2024-10-20");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export spread CSV" }).click()]);
  await download.saveAs(testInfo.outputPath("spread-history.csv"));
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain("2024-10-20");
  expect(csv).not.toContain("2024-10-21");
  expect(csv).toContain("2026-11-10T12:01:00Z");
  expect(csv).toContain("2026-11-10T12:00:00Z");
  expect(csv).toContain("100");
  await page.getByLabel("Spread history window").selectOption("12");
  await expect(coverage).toContainText("2 matched observations");
  const [shortDownload] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export spread CSV" }).click()]);
  const shortCsv = await readFile(await shortDownload.path(), "utf8");
  expect(shortCsv).not.toContain("2024-10-20");
  expect(shortCsv).toContain("2026-10-23");
});


test("BMRK spread selection cancels in-flight older pages and shows missing inputs", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 850 });
  const ten = { ...rate, id: "DGS10", label: "10-Year Treasury Yield", short: "10Y", category: "Treasury", sourceUrl: "https://fred.stlouisfed.org/series/DGS10", firstRetainedDate: "2020-01-01" };
  const two = { ...ten, id: "DGS2", label: "2-Year Treasury Yield", short: "2Y", sourceUrl: "https://fred.stlouisfed.org/series/DGS2" };
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(API, async (route) => {
    if (!route.request().url().includes("before=")) return fulfill(route, { ...ok, series: [ten, two] });
    await gate;
    await fulfill(route, { ...ok, source: "SIM" }).catch(() => {});
  });
  await page.goto(`${BASE}/economics/benchmark`);
  await page.getByRole("button", { name: "Spread Analysis" }).click();
  await page.getByRole("button", { name: "Load older spread history" }).click();
  await page.getByLabel("Spread pair").selectOption("t3m10y");
  release();
  await expect(page.getByTestId("benchmark-spread-history-coverage")).toContainText("Unavailable");
  await expect(page.getByRole("button", { name: "Load older spread history" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Export spread CSV" })).toBeDisabled();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});
