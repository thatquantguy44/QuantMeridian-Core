// Capture screenshots of the Economics & Macro modules for the summary doc.
// Run: NODE_PATH=/opt/node22/lib/node_modules node scripts/shoot-economics.js
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT = path.join(__dirname, "..", "docs", "economics", "img");
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["economics", "01-macro-dashboard"],
  ["economics/curve", "02-treasury-curve"],
  ["economics/rates", "03-rate-probabilities"],
  ["economics/credit", "04-credit-spreads"],
  ["economics/sec-finance", "05-sec-finance-economics"],
  ["economics/inflation", "06-inflation-explorer"],
  ["economics/policy-rates", "07-global-policy-rates"],
  ["economics/stats", "08-statistical-analysis"],
];

(async () => {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 });
  for (const [route, name] of PAGES) {
    const url = `http://localhost:3000/${route}`;
    process.stdout.write(`→ ${url} ... `);
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1800); // let charts/sim render
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`saved ${path.basename(file)}`);
  }
  await browser.close();
  console.log("DONE");
})();
