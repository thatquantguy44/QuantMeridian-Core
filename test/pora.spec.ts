import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const API = "**/api/market-volatility/vix-forward?*";
const body = {
  source: "DB", basis: "spy_total", vix: [["2024-01-02", 12]], price: [["2024-01-02", 100], ["2024-01-03", 101], ["2024-01-04", 102]],
  inputs: { vixSeriesId: "VIXCLS", priceSeriesId: "SPY:total_return_index", priceLabel: "SPY total return", vixFirst: "2024-01-02", vixLast: "2024-01-02", priceFirst: "2024-01-02", priceLast: "2024-01-04" },
  provenance: { policy: "observed-inputs-only", verifiedAt: "2024-01-05T16:00:00Z", vix: { provider: "Cboe via FRED", table: "gold.fred_latest_observation", column: "value", kind: "published index", method: "VIX", sourceSeries: ["VIXCLS"], lastIngestedAt: "2024-01-05T15:00:00Z", verifiedRows: 1 }, price: { provider: "Tiingo End-of-Day", table: "gold.equity_total_return_index", column: "total_return_index", kind: "derived total return", method: "Derived from close, dividends and splits", sourceSeries: ["SPY:close", "SPY:divCash", "SPY:splitFactor"], lastIngestedAt: "2024-01-05T15:00:00Z", verifiedRows: 3 } },
  citations: [], warnings: [],
};

test("PORA inspects explicitly selected source evidence and clears a failed refresh", async ({ page }, testInfo) => {
  let calls = 0, failing = false;
  await page.route(API, route => {
    calls++;
    if (failing) return route.abort();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(`${BASE}/portfolio-regime`);
  await expect(page.getByRole("heading", { name: "Portfolio Optimization & Regime Analysis" })).toBeVisible();
  await expect(page.getByText("No source selected")).toBeVisible();
  expect(calls).toBe(0);
  await page.getByLabel("SPY history basis").selectOption("spy_total");
  await page.getByRole("button", { name: "Inspect source history" }).click();
  await expect(page.getByTestId("pora-source-coverage")).toContainText("3 observations");
  await expect(page.getByTestId("pora-source-coverage")).toContainText("2024-01-02");
  await expect(page.getByTestId("pora-source-coverage")).toContainText("2024-01-04");
  await expect(page.getByTestId("pora-source-evidence")).toContainText("derived total return");
  await expect(page.getByTestId("pora-source-evidence")).toContainText("Tiingo End-of-Day");
  await expect(page.getByText(/Current-vintage retained history is not a point-in-time archive/i)).toBeVisible();
  await expect(page.getByText(/optimizer.*not available/i)).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export source CSV" }).click()]);
  await download.saveAs(testInfo.outputPath("pora-source.csv"));
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain("2024-01-04"); expect(csv).toContain("2024-01-05T16:00:00Z");
  failing = true;
  await page.getByRole("button", { name: "Inspect source history" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("pora-source-coverage")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export source CSV" })).toBeDisabled();
});

test("PORA rejects simulated responses even when the global simulation switch is on", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("qit-sim-mode", "1"));
  await page.route(API, route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...body, source: "SIM" }) }));
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto(`${BASE}/portfolio-regime`);
  await page.getByLabel("SPY history basis").selectOption("spy_total");
  await page.getByRole("button", { name: "Inspect source history" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByTestId("pora-source-coverage")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test("PORA discards an in-flight result when the source basis changes", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(API, async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("basis") === "spy_total") {
      await gate;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {});
      return;
    }
    const price = { ...body, basis: "spy_price", inputs: { ...body.inputs, priceSeriesId: "SPY:close" }, provenance: { ...body.provenance, price: { ...body.provenance.price, column: "close", kind: "observed close", sourceSeries: ["SPY:close"] } } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(price) });
  });
  await page.goto(`${BASE}/portfolio-regime`);
  await page.getByLabel("SPY history basis").selectOption("spy_total");
  await page.getByRole("button", { name: "Inspect source history" }).click();
  await page.getByLabel("SPY history basis").selectOption("spy_price");
  release();
  await expect(page.getByTestId("pora-source-coverage")).toHaveCount(0);
  await page.getByRole("button", { name: "Inspect source history" }).click();
  await expect(page.getByTestId("pora-source-evidence")).toContainText("observed close");
  await expect(page.getByTestId("pora-source-evidence")).not.toContainText("derived total return");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
