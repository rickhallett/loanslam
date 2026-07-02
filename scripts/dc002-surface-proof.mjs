#!/usr/bin/env node
// dc-002 surface proof (demo-concierge-001, D045): the chat widget is
// mounted at layout level — auto-open behavior preserved on /contact/,
// launcher present and functional on /apply/, no chrome on other routes.
//
// Usage: node scripts/dc002-surface-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [nuxtBase = "http://127.0.0.1:3641", outDir = "artifacts/demo-concierge/dc002-surface"] =
  process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const executablePath = `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const results = [];
const check = (id, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 1. /contact/ keeps its auto-open loader parity.
await page.goto(`${nuxtBase}/contact/`, { waitUntil: "networkidle" });
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
check("contact-auto-open", await page.isVisible("#mal-panel"), "panel visible on arrival");
check(
  "contact-welcome",
  (await page.textContent(".message-assistant")).includes("LoanSlam assistant"),
  "welcome message rendered",
);

// 2. Non-chat routes carry no chat chrome.
await page.goto(`${nuxtBase}/`, { waitUntil: "networkidle" });
check("home-no-launcher", !(await page.isVisible("#mal-launcher")), "launcher hidden on /");
await page.goto(`${nuxtBase}/faq/`, { waitUntil: "networkidle" });
check("faq-no-launcher", !(await page.isVisible("#mal-launcher")), "launcher hidden on /faq/");

// 3. /apply/ has the launcher, closed by default, and a working panel.
await page.goto(`${nuxtBase}/apply/`, { waitUntil: "networkidle" });
check("apply-launcher-visible", await page.isVisible("#mal-launcher"), "launcher on /apply/");
check("apply-panel-closed", !(await page.isVisible("#mal-panel")), "panel closed by default");
await page.click("#mal-launcher");
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 5000 });
check("apply-panel-opens", await page.isVisible("#mal-panel"), "panel opens from launcher");
check(
  "apply-welcome",
  (await page.textContent(".message-assistant")).includes("LoanSlam assistant"),
  "welcome message rendered on /apply/",
);
const shot = await page.screenshot({ fullPage: false });
writeFileSync(join(outDir, "apply-panel-open.png"), shot);
await page.click("#mal-launcher");
check("apply-panel-closes", !(await page.isVisible("#mal-panel")), "panel closes again");

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
