import { expect, test } from "@playwright/test";
import { buildSnapshot, captureRows, blockedPairs } from "../src/lib/server/fx/snapshot";
import type { FxResearchResponse } from "../src/lib/fx/contracts";

function response(at: string): FxResearchResponse {
  const rows = ["USD", "JPY", "GBP"].map((c, i) => ({
    series_id: `ECB:EXR:D.${c}.EUR.SP00.A`, observation_date: "2026-10-30", value: [1.1, 165, .88][i],
    is_missing: "0", revision_number: "1", realtime_start: "", realtime_end: "", ingested_at: "2026-10-30T16:30:00Z",
    source: "ecb", frequency: "d", units: `${c} per EUR`,
  }));
  const { snapshot } = buildSnapshot(captureRows(rows), at, at, at);
  return { snapshot, pairs: snapshot.pairs, assessedAt: at, nextCheckAt: snapshot.freshness.nextCheckAt, error: null, retained: null };
}
for (const width of [320, 768, 1024, 1440]) {
  test(`FX reference coverage, direction and evidence at ${width}px`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", e => { if (e.type() === "error") errors.push(e.text()); });
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date("2026-10-30T17:00:00Z") });
    const data = response("2026-10-30T17:00:00.000Z");
    await page.route("**/api/fx/research/snapshot", route => route.fulfill({ json: data }));
    await page.goto("/fx/research");
    await expect(page.getByLabel("Selected reference level", { exact: true })).toHaveText("1.1");
    await expect(page.getByText("4 / 4 research-eligible", { exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Currency pair" }).selectOption("USD/JPY");
    await expect(page.getByLabel("Selected reference level", { exact: true })).toHaveText("150");
    await expect(page.getByText("Terminal-derived cross", { exact: true })).toBeVisible();
    await expect(page.getByRole("definition").filter({ hasText: /^JPY per 1 USD$/ })).toBeVisible();
    await expect(page.getByText("Reporting conversion and hedge calculations are disabled.", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("fx-reference-overview.png"), fullPage: true });
    await page.getByRole("tab", { name: "Evidence", exact: true }).click();
    await expect(page.getByText(data.snapshot!.snapshotId, { exact: true })).toBeVisible();
    await expect(page.getByText("Original receipt and first Gold publication times are unknown.", { exact: true })).toBeVisible();
    expect(await page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath("fx-reference-evidence.png"), fullPage: true });
    expect(errors).toEqual([]);
  });
}
test("stale rates remain display-only and a failed refresh cannot reuse an eligible value", async ({ page }, info) => {
  await page.clock.install({ time: new Date("2026-11-02T16:30:00Z") });
  const data = response("2026-11-02T16:30:00.000Z");
  let failed = false;
  await page.route("**/api/fx/research/snapshot", route => {
    if (!failed) return route.fulfill({ json: data });
    const pairs = blockedPairs("SOURCE_UNAVAILABLE", "Gold is unavailable.");
    pairs.forEach((p, i) => { p.lastObserved = data.pairs[i].lastObserved; });
    return route.fulfill({ json: { ...data, snapshot: null, pairs,
      retained: { snapshotId: data.snapshot!.snapshotId, cutoffAt: data.snapshot!.cutoffAt },
      error: { code: "SOURCE_UNAVAILABLE", message: "Gold is unavailable." } } });
  });
  await page.goto("/fx/research");
  await expect(page.getByText("Stale — display only", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Last observed level", { exact: true })).toHaveText("1.1");
  await expect(page.getByLabel("Selected reference level", { exact: true })).toHaveCount(0);
  await expect(page.getByText("0 / 4 research-eligible", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("fx-stale.png"), fullPage: true });
  failed = true;
  await page.getByRole("button", { name: "Refresh reference snapshot" }).click();
  await expect(page.getByRole("alert")).toContainText("Gold is unavailable.");
  await expect(page.getByLabel("Selected reference level", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Unverified — retained evidence", { exact: true }).first()).toBeVisible();
});
test("a delayed pre-deadline response cannot restore eligibility after expiry", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-02T15:59:58Z") });
  await page.clock.pauseAt(new Date("2026-11-02T15:59:59Z"));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let after = false;
  await page.route("**/api/fx/research/snapshot", async route => {
    const body = response(after ? "2026-11-02T16:00:00.000Z" : "2026-11-02T15:59:59.000Z");
    if (!after) await gate;
    await route.fulfill({ json: body });
  });
  await page.goto("/fx/research");
  await expect(page.getByRole("heading", { name: "Loading reference snapshot" })).toBeVisible();
  await page.clock.fastForward(1500); after = true; release();
  // No additional clock advance: accepting then scheduling a later timer fails this case.
  await expect(page.getByText("Stale — display only", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Selected reference level", { exact: true })).toHaveCount(0);
});
test("rechecks at the exact next publication deadline instead of leaving old eligibility visible", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-02T15:59:58Z") });
  await page.clock.pauseAt(new Date("2026-11-02T15:59:59.900Z"));
  let reads = 0;
  let at = "2026-11-02T15:59:59.900Z";
  await page.route("**/api/fx/research/snapshot", route => { reads++; return route.fulfill({ json: response(at) }); });
  await page.goto("/fx/research");
  await expect(page.getByLabel("Selected reference level", { exact: true })).toBeVisible();
  at = "2026-11-02T16:00:00.000Z";
  await page.clock.fastForward(100);
  await expect(page.getByText("Stale — display only", { exact: true }).first()).toBeVisible();
  await expect(page.getByLabel("Selected reference level", { exact: true })).toHaveCount(0);
  expect(reads).toBeGreaterThanOrEqual(2);
});
