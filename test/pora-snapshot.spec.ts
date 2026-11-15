import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SOURCE_API = "**/api/portfolio-regime/source-check?*";
const SNAPSHOT_API = "**/api/portfolio-regime/snapshot?*";
function canonical(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}
function fixture() {
  const sessions = Array.from({ length: 253 }, (_, i) => new Date(Date.UTC(2024, 0, 2 + i)).toISOString().slice(0, 10));
  const ids = ["SPY", "AGG"] as const;
  const content = { version: "pora-research-snapshot/1", sourceMode: "WAREHOUSE_RECEIPT_RECONCILED", knowledgeBasis: "CURRENT_VINTAGE", modelAdmission: "NOT_ADMITTED", sourceRights: "UNKNOWN", currency: null, provider: "Tiingo End-of-Day", returnBasis: "DERIVED_TOTAL_RETURN", returnFormula: "((close + dividend) / previous_close) * split_factor - 1", calendar: "WAREHOUSE_NYSE", calendarTimeZone: "America/New_York", assetIdentity: "TICKER_ONLY", membership: "FIXED_SELECTION_NOT_PIT", receiptPayloads: "NOT_INCLUDED", asOfDate: "2026-11-12", captureStartedAt: "2026-11-12T15:59:00.000Z", captureCompletedAt: "2026-11-12T16:00:00.000Z", assetOrder: [...ids], sessions,
    receipts: ids.map((id) => ({ id, runId: `run-${id}`, endpoint: `tiingo/daily/${id.toLowerCase()}/prices`, ingestedAt: "2026-11-11T00:00:00Z", payloadSha256: "a".repeat(64) })),
    assets: ids.map((id) => ({ id, latestDate: sessions.at(-1), futureGoldCount: 0, observations: sessions.map((date, i) => { const close = 100 + i; return { date, close, dividend: 0, splitFactor: 1, totalReturnIndex: close, evidence: (["close", "divCash", "splitFactor"] as const).map((field) => ({ field, rawValue: String(field === "close" ? close : field === "divCash" ? 0 : 1), runId: `run-${id}`, rowHash: "fictional-test-row", ingestedAt: "2026-11-11T00:00:00Z" })) }; }) })) };
  const snapshot = { snapshotId: `sha256:${createHash("sha256").update(canonical(content)).digest("hex")}`, content };
  const preview = { source: "DB", asOfDate: content.asOfDate, checkedAt: content.captureCompletedAt, firstDate: sessions[0], lastDate: sessions.at(-1), sessionCount: 253, returnCount: 252,
    assets: content.assets.map((asset) => ({ id: asset.id, latestDate: asset.latestDate, futureCount: 0, lastIngestedAt: "2026-11-11T00:00:00Z", totalChange: 2.52,
      returns: asset.observations.slice(1).map((row, i) => ({ date: row.date, value: row.close / asset.observations[i].close - 1 })) })) };
  return { snapshot, preview };
}

test("PORA freezes, exports and replays a snapshot without claiming imported provenance", async ({ page }) => {
  const body = fixture(); let snapshotRequests = 0;
  await page.route(SOURCE_API, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body.preview) }));
  await page.route(SNAPSHOT_API, (route) => { snapshotRequests++; return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }); });
  await page.goto(`${BASE}/portfolio-regime`); const panel = page.getByLabel("Multi-asset source comparison");
  await panel.getByLabel("SPY").check(); await panel.getByLabel("AGG").check();
  await panel.getByRole("button", { name: "Check multi-asset history" }).click();
  await expect(panel.getByTestId("pora-multi-coverage")).toBeVisible();
  await panel.getByRole("button", { name: "Capture research snapshot" }).click();
  await expect(panel.getByTestId("pora-snapshot-id")).toContainText(body.snapshot.snapshotId);
  await expect(panel.getByText(/receipt evidence checked at capture/i)).toBeVisible();
  const report = panel.getByRole("region", { name: "Snapshot qualification report" });
  await expect(report.getByText("Model admission blocked")).toBeVisible();
  await expect(report.getByRole("row", { name: /SPY/ })).toContainText("253 sessions / 252 returns");
  await expect(report.getByRole("row", { name: /AGG/ })).toContainText("Currency unknown");
  await expect(report).toContainText("Source rights unknown");
  await expect(report).toContainText("not independently verified");
  await expect(report).toContainText("not bound to this snapshot");
  await expect(report).toContainText("2025-01-09");
  await expect(report).toContainText("refreshed locally");
  await expect(report).toContainText("local EcoMedallion runtime was updated to the merged fix");
  await expect(report.getByRole("link", { name: "Merged EcoMedallion fix" })).toHaveAttribute("href", "https://github.com/thatquantguy44/EcoMedallion/pull/101");
  await expect(report).toContainText("account entitlement remains unknown");
  const [reportDownload] = await Promise.all([page.waitForEvent("download"), panel.getByRole("button", { name: "Export qualification report JSON" }).click()]);
  const reportBytes = await (await reportDownload.createReadStream()).toArray();
  const reportJson = JSON.parse(Buffer.concat(reportBytes as Buffer[]).toString());
  expect(reportJson.snapshotId).toBe(body.snapshot.snapshotId);
  expect(reportJson.modelAdmission).toBe("BLOCKED");
  expect(reportJson.context.scope).toBe("HISTORICAL_LOCAL_REVIEW_NOT_SNAPSHOT_EVIDENCE");
  expect(reportJson.sourceEvidence).toBe("RECEIPTS_CHECKED_AT_CAPTURE");
  const [download] = await Promise.all([page.waitForEvent("download"), panel.getByRole("button", { name: "Export snapshot JSON" }).click()]);
  const bytes = await (await download.createReadStream()).toArray();
  const exported = Buffer.concat(bytes as Buffer[]); expect(JSON.parse(exported.toString()).snapshotId).toBe(body.snapshot.snapshotId);
  expect(exported.toString()).not.toContain('"payload":');
  await panel.getByLabel("Import snapshot JSON").setInputFiles({ name: "snapshot.json", mimeType: "application/json", buffer: exported });
  await expect(panel.getByText("Imported file: origin and retained receipt contents not rechecked.", { exact: true })).toBeVisible();
  await expect(report).toContainText("Origin and receipt contents not rechecked");
  await expect(report).toContainText("not rechecked for this snapshot");
  await expect(report.getByText("Model admission blocked")).toBeVisible();
  const [importedReport] = await Promise.all([page.waitForEvent("download"), panel.getByRole("button", { name: "Export qualification report JSON" }).click()]);
  const importedReportBytes = await (await importedReport.createReadStream()).toArray();
  expect(JSON.parse(Buffer.concat(importedReportBytes as Buffer[]).toString()).sourceEvidence).toBe("IMPORTED_ORIGIN_NOT_RECHECKED");
  await expect(panel.getByTestId("pora-snapshot-id")).toContainText(body.snapshot.snapshotId);
  expect(snapshotRequests).toBe(1);
  const [csv] = await Promise.all([page.waitForEvent("download"), panel.getByRole("button", { name: "Export replayed returns CSV" }).click()]);
  const csvBytes = await (await csv.createReadStream()).toArray();
  expect(Buffer.concat(csvBytes as Buffer[]).toString()).toContain("IMPORTED_ORIGIN_NOT_RECHECKED");
  const altered = JSON.parse(exported.toString()); altered.content.assets[0].observations[0].close = 999;
  await panel.getByLabel("Import snapshot JSON").setInputFiles({ name: "altered.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(altered)) });
  await expect(panel.getByRole("alert")).toContainText(/hash/i);
  await expect(panel.getByTestId("pora-snapshot-id")).toHaveCount(0);
  await expect(panel.getByRole("region", { name: "Snapshot qualification report" })).toHaveCount(0);
});

test("PORA cancels an in-flight capture when the selected assets change", async ({ page }) => {
  const body = fixture(); let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(SOURCE_API, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body.preview) }));
  await page.route(SNAPSHOT_API, async (route) => { await gate; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) }).catch(() => {}); });
  await page.goto(`${BASE}/portfolio-regime`); const panel = page.getByLabel("Multi-asset source comparison");
  await panel.getByLabel("SPY").check(); await panel.getByLabel("AGG").check();
  await panel.getByRole("button", { name: "Check multi-asset history" }).click();
  await expect(panel.getByTestId("pora-multi-coverage")).toBeVisible();
  await panel.getByRole("button", { name: "Capture research snapshot" }).click();
  await panel.getByLabel("AGG").uncheck(); release();
  await expect(panel.getByTestId("pora-snapshot-id")).toHaveCount(0);
  await expect(panel.getByTestId("pora-multi-coverage")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Export snapshot JSON" })).toBeDisabled();
  await expect(panel.getByRole("alert")).toHaveCount(0);
});

test("PORA clears the comparison when a fresh snapshot capture fails", async ({ page }) => {
  const body = fixture();
  await page.route(SOURCE_API, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body.preview) }));
  await page.route(SNAPSHOT_API, (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ snapshot: null, preview: null, error: "Retained evidence unavailable." }) }));
  await page.goto(`${BASE}/portfolio-regime`); const panel = page.getByLabel("Multi-asset source comparison");
  await panel.getByLabel("SPY").check(); await panel.getByLabel("AGG").check();
  await panel.getByRole("button", { name: "Check multi-asset history" }).click();
  await expect(panel.getByTestId("pora-multi-coverage")).toBeVisible();
  await panel.getByRole("button", { name: "Capture research snapshot" }).click();
  await expect(panel.getByRole("alert")).toContainText("Retained evidence unavailable");
  await expect(panel.getByTestId("pora-multi-coverage")).toHaveCount(0);
  await expect(panel.getByTestId("pora-snapshot-id")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Export snapshot JSON" })).toBeDisabled();
});

test("PORA snapshot import remains usable on a narrow screen", async ({ page }) => {
  const body = fixture(); await page.setViewportSize({ width: 390, height: 850 });
  await page.goto(`${BASE}/portfolio-regime`); const panel = page.getByLabel("Multi-asset source comparison");
  await panel.getByLabel("Import snapshot JSON").setInputFiles({ name: "snapshot.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(body.snapshot)) });
  await expect(panel.getByText("Imported file: origin and retained receipt contents not rechecked.", { exact: true })).toBeVisible();
  await expect(panel.getByTestId("pora-snapshot-id")).toContainText(body.snapshot.snapshotId);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});


test("PORA shows bound catalog labels while retaining identity and currency blockers", async ({ page }) => {
  const body = fixture();
  const content = { ...body.snapshot.content, version: "pora-research-snapshot/2", assets: body.snapshot.content.assets.map((asset) => ({ ...asset, reference: {
    status: "REPORTED", source: "ECOMEDALLION_META_CATALOG", seriesId: asset.id, title: `Fictional ${asset.id} fixture`, unitLabel: "USD", category: "equity", frequency: "d", active: true, downstreamUseCase: "equity_total_return", seriesUpdatedAt: "2026-11-11T03:54:32Z", manifestName: "equity_tiingo", manifestUpdatedAt: "2026-11-11T03:54:32Z", stableId: null, tradingCurrency: null, reason: null,
  } })) };
  const snapshot = { content, snapshotId: `sha256:${createHash("sha256").update(canonical(content)).digest("hex")}` };
  await page.goto(`${BASE}/portfolio-regime`); const panel = page.getByLabel("Multi-asset source comparison");
  await panel.getByLabel("Import snapshot JSON").setInputFiles({ name: "snapshot.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(snapshot)) });
  const report = panel.getByRole("region", { name: "Snapshot qualification report" });
  await expect(report).toContainText("Catalog unit labels match");
  await expect(report).toContainText("Imported catalog evidence and its origin have not been rechecked");
  await expect(report.getByRole("row", { name: /SPY/ })).toContainText("Unit label: USD");
  await expect(report.getByRole("row", { name: /SPY/ })).toContainText("2026-11-11T03:54:32Z");
  await expect(report.getByRole("row", { name: /SPY/ })).toContainText("Currency unknown");
  await expect(report).toContainText("Model admission blocked");
  const [download] = await Promise.all([page.waitForEvent("download"), panel.getByRole("button", { name: "Export qualification report JSON" }).click()]);
  const reportJson = JSON.parse(Buffer.concat(await (await download.createReadStream()).toArray() as Buffer[]).toString());
  expect(reportJson.catalogLabels).toBe("MATCHING_UNVERIFIED_LABELS");
  expect(reportJson.assets[0].reference.tradingCurrency).toBeNull();
  expect(reportJson.assets[0].reference.stableId).toBeNull();
});
