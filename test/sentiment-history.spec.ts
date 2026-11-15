import { expect, test } from "@playwright/test";
import { normalizeAaiiRows } from "../src/lib/aaii/normalize";
import { aaiiFixture } from "../src/lib/aaii/testFixtures";
import { emptyMacroSeries } from "../src/lib/sentiment/macro";
const at = "2026-10-31T12:00:00.000Z";
function response(assessedAt = at) {
  const rows = Array.from({ length: 104 }, (_, i) => {
    const date = new Date("2026-10-22T00:00:00Z"); date.setUTCDate(date.getUTCDate() - (103 - i) * 7);
    const previous = new Date(date); previous.setUTCDate(previous.getUTCDate() - 7);
    return { ...aaiiFixture(), survey_date: date.toISOString().slice(0, 10),
      version_id: (i + 1).toString(16).padStart(64, "0"),
      previous_survey_date: i ? previous.toISOString().slice(0, 10) : null,
      previous_version_id: i ? i.toString(16).padStart(64, "0") : null,
      gap_days: i ? 7 : null, spread_change_pp: i ? 0 : null };
  });
  return { selection: normalizeAaiiRows(rows, assessedAt), readStartedAt: assessedAt, readCompletedAt: assessedAt, error: null };
}
const unavailable = { selection: null, readStartedAt: null, readCompletedAt: null, error: { code: "SOURCE_UNAVAILABLE", message: "AAII source is unavailable." } };
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(at) });
  await page.route("**/api/**", route => route.abort("failed"));
});
for (const width of [320, 768, 1024, 1440]) test(`real-source AAII history and date evidence at ${width}px`, async ({ page }, info) => {
  const data = response();
  await page.setViewportSize({ width, height: 1000 });
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/sentiment/aaii", r => r.fulfill({ json: data }));
  await page.goto("/sentiment");
  await page.getByRole("button", { name: "AAII Survey", exact: true }).click();
  const table = page.getByRole("table", { name: "AAII historical observations" });
  await expect(table.locator("tbody tr")).toHaveCount(25);
  await expect(table.locator("tbody tr").first()).toContainText("2026-10-22");
  await expect(page.getByTestId("aaii-latest-survey-date")).toHaveText("2026-10-22");
  await expect(page.getByTestId("aaii-snapshot-read-at")).toHaveText(at);
  await expect(page.getByTestId("aaii-source-retrieved-at")).toHaveText(data.selection.provenance.retrievedAt);
  await expect(page.getByTestId("aaii-publication-time")).toHaveText("Unknown");
  await expect(page.getByRole("button", { name: "Newer observations", exact: true })).toBeDisabled();
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Older observations", exact: true }).click();
  await expect(table.locator("tbody tr")).toHaveCount(4);
  await expect(table.locator("tbody tr").last()).toContainText(data.selection.observations[0].surveyDate);
  await expect(page.getByRole("button", { name: "Older observations", exact: true })).toBeDisabled();
  await page.getByLabel("AAII rows per page").selectOption("104");
  await expect(table.locator("tbody tr")).toHaveCount(104);
  expect(await page.locator("main").evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: info.outputPath(`aaii-source-${width}.png`), fullPage: true });
  await table.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath(`aaii-source-table-${width}.png`), fullPage: true });
  expect(errors).toEqual([]);
});
test("all SENT views show no data without real feeds even when global SIM is on", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("qit-sim-mode", "1"));
  const simUrls: string[] = []; page.on("request", req => {
    if (new URL(req.url()).pathname.startsWith("/api/sentiment/") && new URL(req.url()).searchParams.get("sim") === "1") simUrls.push(req.url());
  });
  await page.route("**/api/sentiment/aaii", r => r.fulfill({ status: 503, json: unavailable }));
  await page.route("**/api/sentiment/social", r => r.fulfill({ json: { source: "SIM", platforms: [{ name: "FAKE", posts: 123, sentiment: 1 }], tickers: [{ label: "FAKE", mentions: 123, velocity: 99, sentiment: 1 }], sectors: [], themes: [], totalPosts: 123 } }));
  await page.goto("/sentiment");
  for (const name of ["Fear / Greed", "AAII Survey", "Social Mood", "Positioning", "Contrarian", "Divergence", "By Ticker"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator("main")).toContainText("No data");
    await expect(page.locator("main")).not.toContainText(/NaN|FAKE|68\.5%|SIM example|simulated example/);
    await expect(page.locator("main table tbody tr")).toHaveCount(0);
  }
  await expect(page.getByRole("button", { name: /simulated AAII/i })).toHaveCount(0);
  expect(simUrls).toEqual([]);
});
test("stale source history remains dated and labelled; a failed refresh removes it", async ({ page }) => {
  let failed = false;
  await page.route("**/api/sentiment/aaii", r => r.fulfill({ status: failed ? 503 : 200, json: failed ? unavailable : response("2026-11-02T12:00:00.000Z") }));
  await page.goto("/sentiment");
  await page.getByRole("button", { name: "AAII Survey", exact: true }).click();
  await expect(page.getByTestId("aaii-freshness")).toContainText("STALE");
  await expect(page.getByRole("table", { name: "AAII historical observations" })).toBeVisible();
  failed = true; await page.getByRole("button", { name: "Refresh SENT data", exact: true }).click();
  await expect(page.getByRole("table", { name: "AAII historical observations" })).toHaveCount(0);
  await expect(page.getByText("AAII source is unavailable.", { exact: true })).toBeVisible();
});
test("SENT rejects SIM-labelled AAII and macro responses", async ({ page }) => {
  const data = response();
  await page.route("**/api/sentiment/aaii", r => r.fulfill({ json: { ...data, selection: { ...data.selection, provenance: { ...data.selection.provenance, source: "SIM" } } } }));
  await page.route("**/api/sentiment/macro", r => r.fulfill({ json: { schemaVersion: "sent-macro/1", assessedAt: at, error: null,
    series: emptyMacroSeries().map(s => ({ ...s, source: "SIM", observations: [{ date: "2026-10-30", value: 99909 }] })) } }));
  await page.goto("/sentiment");
  await expect(page.locator("main")).not.toContainText("99909");
  await page.getByRole("button", { name: "AAII Survey", exact: true }).click();
  await expect(page.getByRole("table", { name: "AAII historical observations" })).toHaveCount(0);
  await expect(page.getByText("No admitted source data.", { exact: true })).toBeVisible();
});
test("observed social posts appear with missing sectors left empty", async ({ page }) => {
  await page.route("**/api/sentiment/social", r => r.fulfill({ json: { source: "Reddit", totalPosts: 2,
    platforms: [{ name: "Reddit", posts: 2, sentiment: .25 }], tickers: [{ label: "REAL", mentions: 2, velocity: 99, sentiment: .25 }], themes: [], sectors: [] } }));
  await page.goto("/sentiment");
  await page.getByRole("button", { name: "Social Mood", exact: true }).click();
  await expect(page.getByRole("table", { name: "Observed social tickers" })).toContainText("REAL");
  await expect(page.getByText("No data — no observed sectors rows.", { exact: true })).toBeVisible();
  await expect(page.getByText("No data — no observed themes rows.", { exact: true })).toBeVisible();
});
test("a loaded AAII window becomes stale across the UTC calendar boundary", async ({ page }) => {
  await page.clock.setSystemTime(new Date("2026-11-01T23:59:59.000Z"));
  await page.route("**/api/sentiment/aaii", r => r.fulfill({ json: response("2026-11-01T23:59:59.000Z") }));
  await page.goto("/sentiment");
  await page.getByRole("button", { name: "AAII Survey", exact: true }).click();
  await expect(page.getByTestId("aaii-freshness")).toHaveText("CURRENT");
  await page.clock.runFor(61000);
  await expect(page.getByTestId("aaii-freshness")).toHaveText("STALE");
  await expect(page.getByRole("table", { name: "AAII historical observations" })).toBeVisible();
});
