import { expect, test } from "@playwright/test";
import { blockedPairs } from "../src/lib/server/fx/snapshot";
import { emptyHistoryPairs } from "../src/lib/server/fx/history";

for (const width of [320, 768, 1024, 1440]) {
  test(`FX workspaces remain navigable without market or book data at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    const writes: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("request", request => {
      if (request.method() !== "GET" && request.method() !== "HEAD") writes.push(request.url());
    });
    await page.route("**/api/fx/research/snapshot", route => route.fulfill({ json: {
      snapshot: null, pairs: blockedPairs("SOURCE_UNAVAILABLE", "Gold is unavailable."), assessedAt: new Date().toISOString(),
      nextCheckAt: null, retained: null, error: { code: "SOURCE_UNAVAILABLE", message: "Gold is unavailable." },
    } }));
    await page.route("**/api/fx/research/history", route => route.fulfill({ json: {
      history: null, pairs: emptyHistoryPairs("SOURCE_UNAVAILABLE", "Gold history is unavailable."), assessedAt: new Date().toISOString(),
      nextCheckAt: null, retained: null, error: { code: "SOURCE_UNAVAILABLE", message: "Gold history is unavailable." },
    } }));

    await page.goto("/fx/research");
    await expect(page.getByRole("heading", { name: "FX Research", exact: true })).toBeVisible();
    await expect(page.getByText("No reference level", { exact: true })).toBeVisible();
    expect(await page.locator("main").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("fx-research.png"), fullPage: true });
    await page.getByRole("combobox", { name: "Currency pair" }).selectOption({ label: "USD/EUR" });
    await expect(page.getByRole("definition").filter({ hasText: /^EUR per 1 USD$/ })).toBeVisible();
    await page.getByRole("tab", { name: "Pair history", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Pair history", exact: true })).toHaveAttribute("aria-selected", "true");

    // Roving keyboard focus also selects the workspace without a mouse.
    await page.getByRole("tab", { name: "Pair history", exact: true }).press("End");
    await expect(page.getByRole("tab", { name: "Evidence", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("link", { name: "Open FX Exposure & Hedging", exact: true }).click();
    await expect(page).toHaveURL(/\/fx\/exposure-hedging$/);
    await expect(page.getByRole("heading", { name: "FX Exposure & Hedging", exact: true })).toBeVisible();
    await expect(page.getByText("No book", { exact: true })).toBeVisible();
    await expect(page.getByText("No eligible snapshot", { exact: true })).toBeVisible();
    for (const tab of ["Portfolio", "Existing hedges", "Scenarios", "Proposals", "Reconciliation"]) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
    }
    expect(await page.locator("main").evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("fx-exposure.png"), fullPage: true });
    await page.getByRole("link", { name: "Open FX Research", exact: true }).click();
    await expect(page).toHaveURL(/\/fx\/research$/);
    expect(errors).toEqual([]);
    expect(writes).toEqual([]);
  });
}
