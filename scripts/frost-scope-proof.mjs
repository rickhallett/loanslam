#!/usr/bin/env node
// Frost scope proof: the background frost appears only on /contact/ (where
// it obscures the phone numbers); the open panel leaves every other page
// readable.
//
// Usage: node scripts/frost-scope-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [nuxtBase = "http://127.0.0.1:3641", outDir = "artifacts/demo-concierge/frost-scope"] =
  process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const executablePath = `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const results = [];
const check = (id, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

const frostVisible = (page) =>
  page.evaluate(() => document.querySelector("#mal-frost")?.classList.contains("is-visible"));

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// Contact keeps the frost (panel auto-opens there).
await page.goto(`${nuxtBase}/contact/`, { waitUntil: "networkidle" });
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
check("contact-frosted", await frostVisible(page), "frost visible with open panel on /contact/");

// Every other route: open panel, no frost.
for (const route of ["/", "/faq/", "/apply/"]) {
  await page.goto(`${nuxtBase}${route}`, { waitUntil: "networkidle" });
  if (!(await page.isVisible("#mal-panel"))) await page.click("#mal-launcher");
  await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
  check(`no-frost${route}`, !(await frostVisible(page)), "panel open, page unfrosted");
}
writeFileSync(join(outDir, "faq-open-unfrosted.png"), await page.screenshot());

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
