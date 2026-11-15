import { expect, test } from "@playwright/test";

for (const sameUrl of [false, true]) test(`SENT discards the old feed before rendering a new contract, same URL=${sameUrl}`, async ({ page }) => {
  let modern = false;
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/sent-test/**", async route => {
    if (!modern) return route.fulfill({ json: ["Legacy loaded"] });
    await hold;
    return route.fulfill({ json: { series: [{ id: "VIXCLS" }] } });
  });
  await page.goto(`/test/fixtures/sent-feed-transition.html${sameUrl ? "?sameUrl=1" : ""}`);
  await expect(page.locator("output")).toHaveText("Legacy loaded");
  modern = true;
  try {
    await page.getByRole("button", { name: "Switch to macro contract" }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.locator("output")).toHaveText("Loading");
  } finally { release(); }
  await expect(page.locator("output")).toHaveText("VIXCLS");
});
