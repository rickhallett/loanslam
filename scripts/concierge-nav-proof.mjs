#!/usr/bin/env node
// Concierge navigation-offer proof: a live concierge new-loan turn on the
// homepage names the application form and the panel renders the
// deterministic "Take me to the application" quick action
// (#mal-concierge-nav); clicking it performs SPA navigation to /apply/ with
// chat state intact. Companion to dc003-navigate-proof.mjs, which proves the
// engine-surface offer on /contact/.
//
// Usage: with the built site-nuxt server running under secrets:
//   node scripts/concierge-nav-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [nuxtBase = "http://127.0.0.1:3641", outDir = "artifacts/demo-concierge/nav-offer"] =
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

// 1. Arrive at the homepage, open the assistant.
await page.goto(`${nuxtBase}/`, { waitUntil: "networkidle" });
await page.click("#mal-launcher");
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });

// 2. Live concierge new-loan turn.
const QUESTION = "I want a new loan";
await page.fill(".composer input", QUESTION);
await page.click(".composer-send");
await page.waitForSelector("#mal-concierge-nav", { state: "visible", timeout: 45000 });
check("offer-appears", true, "navigation quick action rendered after concierge reply");
const replyText = await page.locator(".message-assistant .message-text").last().textContent();
check(
  "reply-names-destination",
  /application/i.test(replyText ?? ""),
  "concierge reply names the application form",
);
check(
  "no-guide-only-refusal",
  !/only guide|can't (?:navigate|take you)/i.test(replyText ?? ""),
  "no guide-only refusal in the reply",
);
const messageCountBefore = await page.locator(".message").count();
await page.screenshot({ path: join(outDir, "offer.png") });

// 3. Click the offer: SPA navigation to /apply/ with state intact.
await page.click("#mal-concierge-nav");
await page.waitForURL("**/apply/", { timeout: 10000 });
check("navigated", page.url().endsWith("/apply/"), page.url());
check("panel-still-open", await page.isVisible("#mal-panel"), "panel survived navigation");
const messageCountAfter = await page.locator(".message").count();
check(
  "state-intact",
  messageCountAfter >= messageCountBefore,
  `${messageCountAfter} messages after nav (transcript kept; arrival intro may add one)`,
);
await page.screenshot({ path: join(outDir, "arrival.png") });

await browser.close();

const passed = results.filter(Boolean).length;
writeFileSync(
  join(outDir, "results.json"),
  JSON.stringify({ nuxtBase, passed, total: results.length }, null, 2),
);
console.log(`${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
