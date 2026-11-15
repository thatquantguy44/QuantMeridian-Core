import { expect, test } from "@playwright/test";
import { buildVolatility, assessVolatility, denyVolatilityMetrics, emptyVolatilityPairs } from "../src/lib/server/fx/volatility";
import { captureRows, blockedPairs } from "../src/lib/server/fx/snapshot";
import { volatilityRows, volatilityAt as at } from "./fixtures/fx-volatility";
function data(clock=at,rows=volatilityRows()) {
  const {volatility}=buildVolatility(captureRows(rows,1024),clock,clock,clock);
  return {volatility,pairs:volatility.pairs,assessedAt:clock,nextCheckAt:volatility.freshness.nextCheckAt,error:null,retained:null};
}
test.beforeEach(async({page})=>{
  await page.route("**/api/fx/research/snapshot",r=>r.fulfill({json:{snapshot:null,pairs:blockedPairs("SOURCE_UNAVAILABLE","Fixture"),assessedAt:at,nextCheckAt:null,error:null,retained:null}}));
});
for(const width of [320,768,1024,1440]) test(`volatility windows, scaling, evidence and replay at ${width}px`,async({page},info)=>{
  await page.setViewportSize({width,height:1000});await page.clock.install({time:new Date(at)});
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",e=>{if(e.type()==="error")errors.push(e.text());});
  const d=data();let captures=0;
  await page.route("**/api/fx/research/volatility",r=>{captures++;return r.fulfill({json:d});});
  await page.route("**/api/fx/research/volatilities/**",r=>r.fulfill({json:{volatility:d.volatility,historicalReplay:true,currentConsumptionPermitted:false}}));
  await page.goto("/fx/research");await page.getByRole("tab",{name:"Volatility",exact:true}).click();
  const primary=page.getByTestId("volatility-primary");
  await expect(primary).toHaveText(`${(d.pairs[0].metrics[1].annualizedSigma!*100).toFixed(4)}%`);
  const initialCaptures=captures; // React StrictMode may mount twice; controls must add no reads.
  await page.getByLabel("Annualize",{exact:true}).uncheck();
  for(const [i,n] of [5,21,63,126,252].entries()) {
    await page.getByLabel("Volatility window",{exact:true}).selectOption(String(n));
    await expect(primary).toHaveText(`${(d.pairs[0].metrics[i].dailySigma!*100).toFixed(4)}%`);
  }
  await page.getByLabel("Currency pair",{exact:true}).selectOption("USD/EUR");
  await expect(primary).toHaveText(`${(d.pairs[1].metrics[4].dailySigma!*100).toFixed(4)}%`);
  await expect(page.getByRole("table",{name:"Volatility windows",exact:true})).toBeVisible();
  expect(captures).toBe(initialCaptures);
  await page.getByText("Inspect source records and qualified levels",{exact:true}).click();
  await expect(page.getByRole("table",{name:"Volatility source records",exact:true})).toBeVisible();
  await page.getByRole("table",{name:"Volatility source records",exact:true}).locator("details").first().locator("summary").click();
  await expect(page.getByText(/Recorded upstream ingestion:/).first()).toBeVisible();
  await page.getByRole("button",{name:"Verify volatility replay",exact:true}).click();
  await expect(page.getByText("Verified historical replay; current use remains denied",{exact:true})).toBeVisible();
  expect(await page.locator("main").evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);
  await page.getByText("Inspect source records and qualified levels",{exact:true}).click();
  await page.screenshot({path:info.outputPath(`volatility-${width}.png`),fullPage:true});
  expect(errors).toEqual([]);
});
test("long-window gaps stay unavailable while short windows work; stale/failure estimates stay suppressed",async({page})=>{
  await page.clock.install({time:new Date(at)});
  const rows=volatilityRows();rows.splice(100,1);const d=data(at,rows);let failed=false;
  await page.route("**/api/fx/research/volatility",r=>r.fulfill({json:failed?{
    volatility:null,pairs:denyVolatilityMetrics(d.pairs,{code:"SOURCE_UNAVAILABLE",message:"Gold failed"}),assessedAt:at,nextCheckAt:null,
    retained:{volatilityId:d.volatility.volatilityId,cutoffAt:at,schedule:d.volatility.schedule,evidence:d.volatility.evidence},error:{code:"SOURCE_UNAVAILABLE",message:"Gold failed"}}:d}));
  await page.goto("/fx/research");await page.getByRole("tab",{name:"Volatility",exact:true}).click();
  await page.getByLabel("Currency pair",{exact:true}).selectOption("USD/JPY");
  await page.getByLabel("Volatility window",{exact:true}).selectOption("252");await expect(page.getByTestId("volatility-primary")).toHaveText("Unavailable");
  await page.getByLabel("Volatility window",{exact:true}).selectOption("5");await expect(page.getByTestId("volatility-primary")).not.toHaveText("Unavailable");
  failed=true;await page.getByRole("button",{name:"Refresh volatility",exact:true}).click();await expect(page.getByTestId("volatility-primary")).toHaveText("Unavailable");
  await expect(page.getByText("Gold failed",{exact:true})).toBeVisible();
});
test("deadline and delayed responses cannot keep old current volatility eligible",async({page})=>{
  const before="2026-11-02T15:59:59.900Z";await page.clock.install({time:new Date(before)});const d=data(before);let calls=0;
  await page.route("**/api/fx/research/volatility",async r=>{
    calls++;const after="2026-11-02T16:00:00.000Z";
    if(calls===1) await new Promise(resolve=>setTimeout(resolve,150));
    return r.fulfill({json:calls===1?d:{...d,assessedAt:after,nextCheckAt:"2026-11-03T16:00:00.000Z",pairs:assessVolatility(d.volatility,after)}});
  });
  await page.goto("/fx/research");await page.getByRole("tab",{name:"Volatility",exact:true}).click();await page.clock.runFor(300);
  await expect(page.getByTestId("volatility-primary")).toHaveText("Unavailable");expect(calls).toBeGreaterThanOrEqual(2);
});
test("empty captures expose source failures without inventing volatility",async({page})=>{
  await page.route("**/api/fx/research/volatility",r=>r.fulfill({json:{volatility:null,pairs:emptyVolatilityPairs("SOURCE_UNAVAILABLE","No Gold"),assessedAt:at,nextCheckAt:null,retained:null,error:{code:"SOURCE_UNAVAILABLE",message:"No Gold"}}}));
  await page.goto("/fx/research");await page.getByRole("tab",{name:"Volatility",exact:true}).click();
  await expect(page.getByTestId("volatility-primary")).toHaveText("Unavailable");await expect(page.getByRole("alert")).toHaveText("No Gold");
});
test("stale current volatility exposes a separately labelled historical estimate",async({page})=>{
  const staleAt="2026-11-03T16:00:00.000Z", d=data(), stale={...d,pairs:assessVolatility(d.volatility,staleAt),assessedAt:staleAt};
  await page.clock.install({time:new Date(staleAt)});
  await page.route("**/api/fx/research/volatility",r=>r.fulfill({json:stale}));
  await page.goto("/fx/research");await page.getByRole("tab",{name:"Volatility",exact:true}).click();
  await expect(page.getByTestId("volatility-primary")).toHaveText("Unavailable");
  await expect(page.getByText("Historical volatility · as of 2026-10-30",{exact:true})).toBeVisible();
  await expect(page.getByTestId("volatility-historical-primary")).toHaveText(`${(d.pairs[0].historicalMetrics[1].annualizedSigma!*100).toFixed(4)}%`);
});
