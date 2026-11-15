import { expect, test } from "@playwright/test";
import { SENT_MACRO_SERIES, emptyMacroSeries } from "../src/lib/sentiment/macro";
import { normalizeSentMacro } from "../src/lib/server/sentMacro";
const at = "2026-10-31T12:00:00.000Z";
function fixture() {
  return normalizeSentMacro(SENT_MACRO_SERIES.flatMap(s => Array.from({ length: 252 }, (_, i) => {
    const date = new Date("2026-10-29"); date.setUTCDate(date.getUTCDate() - (251 - i));
    return { series_id: s.id, source: "fred", frequency: "d", units: s.units, observation_date: date.toISOString().slice(0, 10),
      value: 10 + i * .01, is_missing: i === 250 ? "1" : "0", ingested_at: "2026-10-30T10:00:00.000Z" };
  })), at);
}
test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(at) });
  await page.route("**/api/**", r => r.abort("failed"));
});
for (const width of [320, 768, 1440]) test(`verified Gold macro inputs and history at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.route("**/api/sentiment/macro", r => r.fulfill({ json: fixture() }));
  await page.goto("/sentiment");
  const table = page.getByRole("table", { name: "SENT macro source observations" });
  await expect(table.locator("tbody tr")).toHaveCount(7);
  await expect(table).toContainText("Investment-grade credit spread");
  await expect(table).toContainText("2026-10-29");
  await expect(page.getByTestId("macro-latest-VIXCLS")).toContainText("12.51");
  await expect(page.getByText("The complete set of source-backed components is not connected.", { exact: false })).toBeVisible();
  await page.getByText("Inspect macro history", { exact: true }).click();
  const history = page.getByRole("table", { name: "Macro historical observations" });
  await expect(history.locator("tbody tr")).toHaveCount(25);
  await expect(history.locator("tbody tr").nth(1)).toContainText("No data");
  await page.getByLabel("Macro series").selectOption("T10Y2Y");
  await expect(history).toContainText("pp");
  await page.getByRole("button", { name: "Older macro observations", exact: true }).click();
  await expect(page.getByText("Showing 26–50 of 252", { exact: true })).toBeVisible();
  await page.getByLabel("Macro series").selectOption("DGS3MO");
  await expect(page.getByText("Showing 1–25 of 252", { exact: true })).toBeVisible();
  expect(await page.locator("main").evaluate(e => e.scrollWidth <= e.clientWidth + 1)).toBe(true);
  await table.scrollIntoViewIfNeeded(); await page.screenshot({ path: info.outputPath(`sent-macro-${width}.png`), fullPage: true });
  expect(errors).toEqual([]);
});
test("failed macro refresh clears stored rows; no SIM override is requested", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("qit-sim-mode", "1"));
  let failed = false; const urls: string[] = [];
  await page.route("**/api/sentiment/macro", r => {
    urls.push(r.request().url());
    return r.fulfill({ status: failed ? 503 : 200, json: failed ? { schemaVersion: "sent-macro/1", assessedAt: at,
      series: emptyMacroSeries("SOURCE_UNAVAILABLE"), error: { code: "SOURCE_UNAVAILABLE", message: "Macro Gold source is unavailable." } } : fixture() });
  });
  await page.goto("/sentiment");
  await expect(page.getByRole("table", { name: "SENT macro source observations" })).toBeVisible();
  failed = true; await page.getByRole("button", { name: "Refresh SENT data", exact: true }).click();
  await expect(page.getByRole("table", { name: "SENT macro source observations" })).toHaveCount(0);
  await expect(page.getByText("Macro Gold source is unavailable.", { exact: true })).toBeVisible();
  expect(urls.every(u => !new URL(u).search)).toBe(true);
});
test("one missing latest macro value cannot masquerade as its prior value or remove other series", async ({ page }) => {
  const data = fixture(); const s = data.series[0];
  s.state = "UNAVAILABLE"; s.latest = null; s.reason = "LATEST_MISSING"; s.observations[s.observations.length - 1].value = null;
  await page.route("**/api/sentiment/macro", r => r.fulfill({ json: data }));
  await page.goto("/sentiment");
  await expect(page.getByTestId("macro-latest-VIXCLS")).toHaveText("No data");
  await expect(page.getByTestId("macro-latest-DGS10")).toContainText("12.51");
});
