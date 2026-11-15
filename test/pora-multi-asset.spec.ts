import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const API = "**/api/portfolio-regime/source-check?*";
const dates = Array.from({ length: 253 }, (_, i) => new Date(Date.UTC(2024, 0, 2 + i)).toISOString().slice(0, 10));
const make = () => ({ source: "DB", asOfDate: "2026-11-12", checkedAt: "2026-11-12T16:00:00.000Z", firstDate: dates[0], lastDate: dates.at(-1), sessionCount: 253, returnCount: 252,
  assets: ["SPY", "AGG"].map((id) => ({ id, latestDate: dates.at(-1), futureCount: 0, lastIngestedAt: "2026-11-11T00:00:00Z", totalChange: Math.pow(1.001, 252) - 1, returns: dates.slice(1).map((date) => ({ date, value: 0.001 })) })) });

test("PORA compares explicitly selected observed assets and exports aligned returns", async ({ page }, testInfo) => {
  let calls = 0;
  await page.route(API, route => { calls++; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(make()) }); });
  await page.goto(`${BASE}/portfolio-regime`);
  const panel = page.getByLabel("Multi-asset source comparison");
  await expect(panel.getByRole("button", { name: "Check multi-asset history" })).toBeDisabled();
  expect(calls).toBe(0);
  await panel.getByLabel("SPY").check(); await panel.getByLabel("AGG").check();
  await panel.getByRole("button", { name: "Check multi-asset history" }).click();
  await expect(panel.getByTestId("pora-multi-coverage")).toContainText("253 sessions");
  await expect(panel.getByTestId("pora-multi-coverage")).toContainText("252 aligned returns");
  await expect(panel.getByTestId("pora-multi-asset-SPY")).toContainText("28.64%");
  await expect(panel.getByText(/not a point-in-time/i)).toBeVisible();
  const [download] = await Promise.all([page.waitForEvent("download"), panel.getByRole("button", { name: "Export aligned returns CSV" }).click()]);
  await download.saveAs(testInfo.outputPath("pora-multi.csv"));
  const csv = await readFile(await download.path(), "utf8");
  expect(csv).toContain("total_return_fraction"); expect(csv).toContain("2026-11-12T16:00:00.000Z");
  expect(csv.trim().split("\r\n")).toHaveLength(505);
  await panel.getByLabel("AGG").uncheck();
  await expect(panel.getByTestId("pora-multi-coverage")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Export aligned returns CSV" })).toBeDisabled();
});

test("PORA clears a comparison if the next source check fails or returns simulation", async ({ page }) => {
  let mode = "DB";
  await page.addInitScript(() => localStorage.setItem("qit-sim-mode", "1"));
  await page.route(API, route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...make(), source: mode }) }));
  await page.setViewportSize({ width: 390, height: 850 });
  await page.goto(`${BASE}/portfolio-regime`);
  const panel = page.getByLabel("Multi-asset source comparison");
  await panel.getByLabel("SPY").check(); await panel.getByLabel("AGG").check();
  await panel.getByRole("button", { name: "Check multi-asset history" }).click();
  await expect(panel.getByTestId("pora-multi-coverage")).toBeVisible();
  mode = "SIM";
  await panel.getByRole("button", { name: "Check multi-asset history" }).click();
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(panel.getByTestId("pora-multi-coverage")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Export aligned returns CSV" })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test("PORA cancels an in-flight comparison when the asset selection changes", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(API, async route => { await gate; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(make()) }).catch(() => {}); });
  await page.goto(`${BASE}/portfolio-regime`);
  const panel = page.getByLabel("Multi-asset source comparison");
  await panel.getByLabel("SPY").check(); await panel.getByLabel("AGG").check();
  await panel.getByRole("button", { name: "Check multi-asset history" }).click();
  await panel.getByLabel("ACWI").check(); release();
  await expect(panel.getByTestId("pora-multi-coverage")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Export aligned returns CSV" })).toBeDisabled();
  await expect(panel.getByRole("alert")).toHaveCount(0);
});
