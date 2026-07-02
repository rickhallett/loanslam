#!/usr/bin/env node
// dc2-001 presence proof (demo-concierge-002, D046): the launcher is on
// every route, closed by default; only /contact/ auto-opens.
//
// Usage: node scripts/dc2-001-presence-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [nuxtBase = "http://127.0.0.1:3641", outDir = "artifacts/demo-concierge/dc2-001-presence"] =
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

// Closed-by-default presence on representative route types.
for (const route of ["/", "/faq/", "/instalment-loan/", "/news/", "/privacy-policy/"]) {
  await page.goto(`${nuxtBase}${route}`, { waitUntil: "networkidle" });
  const launcher = await page.isVisible("#mal-launcher");
  const panelClosed = !(await page.isVisible("#mal-panel"));
  check(`presence${route}`, launcher && panelClosed, "launcher visible, panel closed");
}

// The launcher works where it appears.
await page.goto(`${nuxtBase}/`, { waitUntil: "networkidle" });
await page.click("#mal-launcher");
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 5000 });
check("opens-on-home", true, "panel opens from launcher on /");
writeFileSync(join(outDir, "home-panel-open.png"), await page.screenshot());
await page.click("#mal-launcher");
check("closes-on-home", !(await page.isVisible("#mal-panel")), "panel closes again");

// Contact keeps its auto-open loader parity.
await page.goto(`${nuxtBase}/contact/`, { waitUntil: "networkidle" });
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
check("contact-auto-open", true, "contact still auto-opens");

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
