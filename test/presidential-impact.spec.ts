import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("presidential workspace requires explicit inputs and exports inspectable local results", async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (["http:", "https:"].includes(url.protocol) && !["127.0.0.1", "localhost"].includes(url.hostname)) {
      external.push(url.origin); return route.abort();
    }
    return route.continue();
  });
  await page.goto("/presidential-impact");
  await expect(page.getByRole("heading", { name: "Presidential Impact" })).toBeVisible();
  await expect(page.getByText("No research dataset loaded", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Political-control return comparison" })).toHaveCount(0);
  await expect(page.locator("main").getByText("STREAMING", { exact: true })).toHaveCount(0);

  await page.getByLabel("Import research JSON").setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{broken") });
  await expect(page.getByRole("alert")).toContainText("valid JSON");
  await expect(page.getByText("No research dataset loaded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load illustrative dataset", exact: true }).click();
  await expect(page.getByText("DEMO · ILLUSTRATIVE DATA", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Political-control return comparison" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Starting valuation and subsequent return" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Window inclusion and exclusion ledger" })).toBeVisible();
  await page.getByLabel("Your interpretation").fill("Retain my last valid research and notes.");
  for (const rejected of [
    { name: "malformed.json", buffer: Buffer.from("{broken"), message: "valid JSON" },
    { name: "oversized.json", buffer: Buffer.alloc(5 * 1024 * 1024 + 1, " "), message: "5 MiB" },
  ]) {
    await page.getByLabel("Import research JSON").setInputFiles({ name: rejected.name, mimeType: "application/json", buffer: rejected.buffer });
    await expect(page.getByRole("alert")).toContainText(rejected.message);
    await expect(page.getByText("DEMO · ILLUSTRATIVE DATA", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Political-control return comparison" })).toBeVisible();
    await expect(page.getByLabel("Your interpretation")).toHaveValue("Retain my last valid research and notes.");
  }
  const negativeBars = await page.getByRole("img", { name: "Political-control return comparison" }).evaluate(svg => {
    const zero = Number(svg.querySelector('[data-testid="return-zero-axis"]')!.getAttribute("y1"));
    const negative = Array.from(svg.querySelectorAll("rect[data-return]")).filter(rect => Number(rect.getAttribute("data-return")) < 0);
    return negative.length > 0 && negative.every(rect => Number(rect.getAttribute("y")) >= zero && Number(rect.getAttribute("height")) > 0);
  });
  expect(negativeBars).toBe(true);

  await page.getByLabel("Comparison groups").selectOption("PRESIDENT_PARTY");
  await expect(page.getByRole("img", { name: "Political-control return comparison" })).toBeVisible();
  const presidentPartyFigure = page.getByRole("figure", { name: /President party; full-sample arithmetic means/ });
  await expect(presidentPartyFigure).toBeVisible();
  await expect(presidentPartyFigure).toContainText("95% administration-cluster resampling range");
  await expect(page.getByTestId("descriptive-interval")).toHaveCount(2);

  await page.getByLabel("Window type").selectOption("PRESIDENTIAL_PERIOD");
  await page.getByLabel("Return metric").selectOption("ANNUALIZED");
  await page.getByLabel("Include partial windows").check();
  await page.getByLabel("Maximum endpoint gap (days)").fill("3");
  await page.getByLabel("Show sensitivity excluding 2008").check();
  await expect(page.getByRole("heading", { name: "Sensitivity comparison", exact: true })).toBeVisible();
  await expect(page.getByText("Full sample remains the primary comparison.", { exact: true })).toBeVisible();
  await page.getByLabel("Your interpretation").fill("My reading: illustrative arithmetic only, not a party effect.");
  const csvWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download analysis CSV", exact: true }).click();
  const csv = await csvWait;
  expect(csv.suggestedFilename()).toMatch(/\.csv$/);
  const csvPath = await csv.path();
  expect(await readFile(csvPath!, "utf8")).toContain("ILLUSTRATIVE");
  const manifestWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download run manifest", exact: true }).click();
  const manifest = await manifestWait;
  const manifestPath = await manifest.path();
  const manifestText = await readFile(manifestPath!, "utf8");
  expect(manifestText).toContain("My reading: illustrative arithmetic only");
  const figureWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Political-control comparison SVG", exact: true }).click();
  const figure = await figureWait;
  const figurePath = await figure.path();
  const figureText = await readFile(figurePath!, "utf8");
  await figure.saveAs("test-results/presidential-export.svg");
  expect(figureText).toContain("DEMO · ILLUSTRATIVE DATA");
  expect(figureText).toContain("NOMINAL");
  expect(figureText).toContain("partial windows allowed");
  expect(figureText).toContain("previous observation within 3 calendar days");
  expect(figureText).toContain(JSON.parse(manifestText).runId);
  expect(figureText).not.toContain("<script");
  const pngWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Political-control comparison PNG", exact: true }).click();
  const png = await pngWait;
  await png.saveAs("test-results/presidential-export.png");
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  expect((await readFile((await png.path())!)).subarray(1, 4).toString()).toBe("PNG");
  await expect(page.getByRole("button", { name: "Clear dataset", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear dataset", exact: true }).click();
  await expect(page.getByText("No research dataset loaded", { exact: true })).toBeVisible();
  await page.getByLabel("Import saved research run").setInputFiles(manifestPath!);
  await expect(page.getByText("DEMO · ILLUSTRATIVE DATA", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Window type")).toHaveValue("PRESIDENTIAL_PERIOD");
  await expect(page.getByLabel("Return metric")).toHaveValue("ANNUALIZED");
  await expect(page.getByLabel("Your interpretation")).toHaveValue("My reading: illustrative arithmetic only, not a party effect.");
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("imported JSON is labeled unverified and oversized inputs are rejected", async ({ page }) => {
  await page.goto("/presidential-impact");
  await page.getByLabel("Import research JSON").setInputFiles({ name: "too-large.json", mimeType: "application/json", buffer: Buffer.alloc(5 * 1024 * 1024 + 1, " ") });
  await expect(page.getByRole("alert")).toContainText("5 MiB");
  await expect(page.getByText("No research dataset loaded", { exact: true })).toBeVisible();
  await page.getByLabel("Import research JSON").setInputFiles({ name: "empty.json", mimeType: "application/json", buffer: Buffer.from("{}") });
  await expect(page.getByRole("alert")).toContainText("schemaVersion");
  const templateWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON template", exact: true }).click();
  const template = await templateWait;
  const templatePath = await template.path();
  const userData = { ...JSON.parse(await readFile(templatePath!, "utf8")), kind: "USER_SUPPLIED", title: "My local research dataset" };
  await page.getByLabel("Import research JSON").setInputFiles({ name: "research.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(userData)) });
  await expect(page.getByText("USER-SUPPLIED · UNVERIFIED", { exact: true })).toBeVisible();
  await expect(page.getByText("My local research dataset", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);

  const date = (offset: number) => new Date(Date.UTC(2000, 0, 1 + offset)).toISOString().slice(0, 10);
  userData.windows = Array.from({ length: 201 }, (_, i) => ({
    id: `page-${i}`, label: `Pagination window ${i}`, kind: "PRESIDENTIAL_PERIOD",
    startDate: date(i), endDate: date(i + 1), decisionDate: date(i), complete: true,
  }));
  await page.getByLabel("Import research JSON").setInputFiles({ name: "many-windows.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(userData)) });
  const ledger = page.getByRole("table", { name: "Window inclusion and exclusion ledger" });
  await expect(ledger.getByText("Pagination window 0", { exact: false })).toBeVisible();
  await expect(ledger.getByText("Pagination window 200", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "Next windows", exact: true }).click();
  await page.getByRole("button", { name: "Next windows", exact: true }).click();
  await expect(ledger.getByText("Pagination window 200", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Next windows", exact: true })).toBeDisabled();
});

for (const width of [320, 768, 1024, 1440]) {
  test(`presidential research controls and charts fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/presidential-impact");
    await page.getByRole("button", { name: "Load illustrative dataset", exact: true }).click();
    await expect(page.getByRole("img", { name: "Political-control return comparison" })).toBeVisible();
    const overflow = await page.locator("main").evaluate(el => el.scrollWidth > el.clientWidth + 1);
    expect(overflow).toBe(false);
    await page.screenshot({ path: `test-results/presidential-${width}.png`, fullPage: true });
    await page.locator("figure").filter({ has: page.getByRole("img", { name: "Political-control return comparison" }) }).screenshot({ path: `test-results/presidential-chart-${width}.png` });
  });
}

test("pipeline snapshot loads explicitly and preserves work on failure or superseded loads", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/presidential-impact");
  await expect(page.getByText("No research dataset loaded", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Check for pipeline snapshots" }).click();
  await expect(page.getByText(/FICTIONAL FIXTURE — not historical observations/)).toBeVisible();
  await page.getByRole("button", { name: "Load pipeline snapshot" }).click();
  await expect(page.getByLabel("Pipeline snapshot provenance")).toContainText("fixture-v1");
  await expect(page.locator("p").filter({ hasText: "Fictional fixture — Public CRSP-market-proxy annual reconstruction" })).toBeVisible();
  await expect(page.getByText(/Full sample:/)).toContainText("1");
  await page.getByLabel("Your interpretation").fill("Keep these research notes.");
  await page.getByLabel("Comparison groups").selectOption("PRESIDENT_PARTY");

  const csvWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download analysis CSV", exact: true }).click();
  const csv = await csvWait;
  expect(await readFile((await csv.path())!, "utf8")).toContain("SYNTHETIC_FIXTURE");
  const manifestWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download run manifest", exact: true }).click();
  const manifest = await manifestWait;
  expect(await readFile((await manifest.path())!, "utf8")).toContain("Fictional demonstration");
  const figureWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Political-control comparison SVG", exact: true }).click();
  const figure = await figureWait;
  expect(await readFile((await figure.path())!, "utf8")).toContain("DEMO · ILLUSTRATIVE DATA");
  const pngWait = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download Political-control comparison PNG", exact: true }).click();
  const png = await pngWait;
  expect((await readFile((await png.path())!)).subarray(1, 4).toString()).toBe("PNG");
  await page.getByRole("button", { name: "Check for pipeline updates" }).click();
  await expect(page.getByLabel("Your interpretation")).toHaveValue("Keep these research notes.");
  await expect(page.getByLabel("Comparison groups")).toHaveValue("PRESIDENT_PARTY");

  await page.route("**/api/presidential/research/snapshots/*", route => route.fulfill({ status: 503, json: { error: { code: "INTEGRITY_FAILURE" }, selection: null } }));
  await page.getByRole("button", { name: "Load pipeline snapshot" }).click();
  await expect(page.getByRole("alert")).toContainText("failed integrity checks");
  await expect(page.getByLabel("Your interpretation")).toHaveValue("Keep these research notes.");
  await expect(page.getByLabel("Comparison groups")).toHaveValue("PRESIDENT_PARTY");
  await expect(page.getByLabel("Pipeline snapshot provenance")).toBeVisible();
  await page.unroute("**/api/presidential/research/snapshots/*");

  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const began = new Promise<void>(resolve => { started = resolve; });
  await page.route("**/api/presidential/research/snapshots/*", async route => {
    const response = await route.fetch();
    started();
    await gate;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Load pipeline snapshot" }).click();
  await began;
  await page.getByRole("button", { name: "Load illustrative dataset" }).click();
  const late = page.waitForResponse(response => response.url().includes("/api/presidential/research/snapshots/"));
  release();
  await late;
  await expect(page.getByLabel("Pipeline snapshot provenance")).toHaveCount(0);
  await expect(page.getByText("DEMO · ILLUSTRATIVE DATA", { exact: true })).toBeVisible();
  await expect(page.locator("p").filter({ hasText: "Fictional fixture — Public CRSP-market-proxy annual reconstruction" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
