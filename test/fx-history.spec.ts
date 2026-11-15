import { expect, test } from "@playwright/test";
import { buildHistory, denyHistoryMetrics, reviewedDates } from "../src/lib/server/fx/history";
import { blockedPairs, captureRows } from "../src/lib/server/fx/snapshot";
import type { FxHistoryResponse } from "../src/lib/fx/historyContracts";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/fx/research/snapshot", r => r.fulfill({ json: { snapshot: null,
    pairs: blockedPairs("SOURCE_UNAVAILABLE", "No current reference snapshot in this fixture."), assessedAt: "2026-10-30T17:00:00.000Z",
    nextCheckAt: null, error: null, retained: null } }));
});

function data(at = "2026-10-30T17:00:00.000Z", gap = false): FxHistoryResponse {
  const dates = reviewedDates("2026-10-30").slice(-90);
  const rows = dates.flatMap((date, i) => ["USD", "JPY", "GBP"].filter(c => !(gap && c === "JPY" && date === dates.at(-3))).map(c => ({
    series_id: `ECB:EXR:D.${c}.EUR.SP00.A`, observation_date: date,
    value: c === "USD" ? 1.1 + .11 * Math.max(0, i - 68) / 21 : c === "JPY" ? 165 : .88,
    is_missing: "0", revision_number: "1", realtime_start: "", realtime_end: "", ingested_at: "2026-10-30T16:00:00Z",
    source: "ecb", frequency: "d", units: `${c} per EUR`,
  })));
  const { history } = buildHistory(captureRows(rows, 320), at, at, at);
  return { history, pairs: history.pairs, assessedAt: at, nextCheckAt: history.freshness.nextCheckAt, error: null, retained: null };
}
for (const width of [320, 768, 1024, 1440]) {
  test(`FX Pair history shows dated chart, changes and evidence at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.install({ time: new Date("2026-10-30T17:00:00Z") });
    const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
    page.on("console", e => { if (e.type() === "error") errors.push(e.text()); });
    const body = data();
    await page.route("**/api/fx/research/snapshot", r => r.fulfill({ json: { snapshot: null,
      pairs: blockedPairs("SOURCE_UNAVAILABLE", "No current reference snapshot in this fixture."), assessedAt: body.assessedAt,
      nextCheckAt: null, error: null, retained: null } }));
    await page.route("**/api/fx/research/history", r => r.fulfill({ json: body }));
    await page.route("**/api/fx/research/histories/**", r => r.fulfill({ json: { history: body.history, historicalReplay: true, currentConsumptionPermitted: false } }));
    await page.goto("/fx/research"); await page.getByRole("tab", { name: "Pair history", exact: true }).click();
    await expect(page.getByRole("heading", { name: "EUR/USD history", exact: true })).toBeVisible();
    await expect(page.getByLabel("21-interval change", { exact: true })).toHaveText("+10%");
    await expect(page.getByText("90 / 90 qualified observations", { exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: /Historical reference levels, USD per 1 EUR/ })).toBeVisible();
    await expect(page.getByRole("table", { name: /EUR\/USD historical observations/ }).getByRole("row")).toHaveCount(91);
    await page.getByRole("combobox", { name: "Currency pair" }).selectOption("USD/EUR");
    await expect(page.getByLabel("21-interval change", { exact: true })).toHaveText("-9.090909%");
    await expect(page.getByRole("tabpanel", { name: "Pair history", exact: true }).getByText(/Terminal-derived inverse/)).toBeVisible();
    await expect(page.getByText(body.history!.historyId, { exact: true })).toBeVisible();
    expect(await page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: info.outputPath("fx-history.png"), fullPage: true });
    const panel = page.getByRole("tabpanel", { name: "Pair history", exact: true });
    await panel.getByText("Observed · source evidence", { exact: true }).first().click();
    await expect(panel.getByText(/Revision: gold-content:/).first()).toBeVisible();
    await expect(panel.getByText(/Gold read:/).first()).toBeVisible();
    expect(await page.locator("main").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.getByRole("button", { name: "Verify history replay", exact: true }).click();
    await expect(page.getByText("Historical replay verified — current metrics unchanged.", { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath("fx-history-evidence.png"), fullPage: true });
    expect(errors).toEqual([]);
  });
}
test("a missing historical leg breaks its chart and blocks affected change windows", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-30T17:00:00Z") });
  await page.route("**/api/fx/research/history", r => r.fulfill({ json: data(undefined, true) }));
  await page.goto("/fx/research"); await page.getByRole("tab", { name: "Pair history", exact: true }).click();
  await page.getByRole("combobox", { name: "Currency pair" }).selectOption("USD/JPY");
  await expect(page.getByText("89 / 90 qualified observations", { exact: true })).toBeVisible();
  await expect(page.getByLabel("21-interval change", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("img", { name: /Historical reference levels, JPY per 1 USD/ }).locator("path")).toHaveCount(2);
  await page.getByRole("combobox", { name: "Currency pair" }).selectOption("EUR/USD");
  await expect(page.getByLabel("21-interval change", { exact: true })).toHaveText("+10%");
});
test("stale and failed refreshes preserve dated history without current change figures", async ({ page }, info) => {
  await page.clock.install({ time: new Date("2026-11-02T16:30:00Z") });
  const stale = data("2026-11-02T16:30:00.000Z"); let failed = false;
  await page.route("**/api/fx/research/histories/**", r => r.fulfill({ json: { history: stale.history, historicalReplay: true, currentConsumptionPermitted: false } }));
  await page.route("**/api/fx/research/history", r => r.fulfill({ json: failed ? { ...stale, history: null,
    pairs: denyHistoryMetrics(stale.pairs, { code: "SOURCE_UNAVAILABLE", message: "Gold history is unavailable." }),
    error: { code: "SOURCE_UNAVAILABLE", message: "Gold history is unavailable." },
    retained: { historyId: stale.history!.historyId, cutoffAt: stale.history!.cutoffAt, schedule: stale.history!.schedule, evidence: stale.history!.evidence } } : stale }));
  await page.goto("/fx/research"); await page.getByRole("tab", { name: "Pair history", exact: true }).click();
  await expect(page.getByText("Stale endpoint — dated history only", { exact: true })).toBeVisible();
  await expect(page.getByLabel("21-interval change", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Verify history replay", exact: true }).click();
  await expect(page.getByText("Historical replay verified — current metrics unchanged.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("21-interval change", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("fx-history-stale.png"), fullPage: true });
  failed = true; await page.getByRole("button", { name: "Refresh pair history", exact: true }).click();
  await expect(page.getByText("Gold history is unavailable.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Retained history — current metrics unavailable", { exact: true })).toBeVisible();
  await expect(page.getByRole("table", { name: /historical observations/ }).getByRole("row")).toHaveCount(91);
  await expect(page.getByLabel("21-interval change", { exact: true })).toHaveCount(0);
});
test("history drops expired current metrics at the exact near deadline", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-02T15:59:58Z") });
  await page.clock.pauseAt(new Date("2026-11-02T15:59:59.900Z"));
  let at = "2026-11-02T15:59:59.900Z";
  await page.route("**/api/fx/research/history", r => r.fulfill({ json: data(at) }));
  await page.goto("/fx/research"); await page.getByRole("tab", { name: "Pair history", exact: true }).click();
  await expect(page.getByLabel("21-interval change", { exact: true })).toBeVisible();
  at = "2026-11-02T16:00:00.000Z"; await page.clock.fastForward(100);
  await expect(page.getByText("Stale endpoint — dated history only", { exact: true })).toBeVisible();
  await expect(page.getByLabel("21-interval change", { exact: true })).toHaveCount(0);
});
test("a delayed pre-deadline history response cannot restore current changes", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-02T15:59:58Z") });
  await page.clock.pauseAt(new Date("2026-11-02T15:59:59Z"));
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let after = false;
  await page.route("**/api/fx/research/history", async route => {
    const body = data(after ? "2026-11-02T16:00:00.000Z" : "2026-11-02T15:59:59.000Z");
    if (!after) await gate;
    await route.fulfill({ json: body });
  });
  await page.goto("/fx/research"); await page.getByRole("tab", { name: "Pair history", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Loading pair history", exact: true })).toBeVisible();
  await page.clock.fastForward(1500); after = true; release();
  await expect(page.getByText("Stale endpoint — dated history only", { exact: true })).toBeVisible();
  await expect(page.getByLabel("21-interval change", { exact: true })).toHaveCount(0);
});
test("empty history explains its blocked calendar instead of hiding the admission failure", async ({ page }) => {
  const at = "2026-01-01T17:00:00.000Z"; await page.clock.install({ time: new Date(at) });
  const { history } = buildHistory([], at, at, at);
  await page.route("**/api/fx/research/history", r => r.fulfill({ json: { history, pairs: history.pairs, assessedAt: at, nextCheckAt: null, error: null, retained: null } }));
  await page.goto("/fx/research"); await page.getByRole("tab", { name: "Pair history", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No pair history", exact: true })).toBeVisible();
  await expect(page.getByText("Current publication-calendar admission is unavailable.", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "History endpoint reasons" })).toContainText("outside reviewed coverage");
});
test("an aborted verification can be retried after a failed refresh restores the same retained identity", async ({ page }) => {
  const body = data(); await page.clock.install({ time: new Date(body.assessedAt) });
  const retained = { ...body, history: null, pairs: denyHistoryMetrics(body.pairs, { code: "SOURCE_UNAVAILABLE", message: "Gold history is unavailable." }),
    error: { code: "SOURCE_UNAVAILABLE", message: "Gold history is unavailable." },
    retained: { historyId: body.history!.historyId, cutoffAt: body.history!.cutoffAt, schedule: body.history!.schedule, evidence: body.history!.evidence } };
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let replays = 0;
  await page.route("**/api/fx/research/history", r => r.fulfill({ json: retained }));
  await page.route("**/api/fx/research/histories/**", async r => {
    if (++replays === 1) await gate;
    await r.fulfill({ json: { history: body.history, historicalReplay: true, currentConsumptionPermitted: false } }).catch(() => {});
  });
  await page.goto("/fx/research"); await page.getByRole("tab", { name: "Pair history", exact: true }).click();
  const verify = page.getByRole("button", { name: "Verify history replay", exact: true });
  await verify.click(); await expect(page.getByText("Verifying retained history…", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Refresh pair history", exact: true }).click();
  await expect(page.getByText("Retained history — current metrics unavailable", { exact: true })).toBeVisible();
  await expect(verify).toBeEnabled(); release();
  await verify.click(); await expect(page.getByText("Historical replay verified — current metrics unchanged.", { exact: true })).toBeVisible();
  await expect(page.getByLabel("21-interval change", { exact: true })).toHaveCount(0);
});
