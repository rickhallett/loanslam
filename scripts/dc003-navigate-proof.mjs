#!/usr/bin/env node
// dc-003 navigation-offer proof (demo-concierge-001, D045): a live-engine
// apply-intent turn produces the deterministic "take me to the application"
// quick action; clicking it performs SPA navigation to /apply/ with chat
// state intact (the layout-level widget survives the route change).
//
// Usage: with the built site-nuxt server running under secrets:
//   node scripts/dc003-navigate-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [nuxtBase = "http://127.0.0.1:3641", outDir = "artifacts/demo-concierge/dc003-navigate"] =
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

// 1. Arrive at /contact/, panel auto-opens.
await page.goto(`${nuxtBase}/contact/`, { waitUntil: "networkidle" });
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });

// 2. Live-engine apply-intent turn.
const QUESTION = "How do I apply for a loan?";
await page.fill(".composer input", QUESTION);
await page.click(".composer-send");
await page.waitForSelector("#mal-apply-nav", { state: "visible", timeout: 45000 });
check("offer-appears", true, "apply quick action rendered after live engine answer");
const messageCountBefore = await page.locator(".message").count();
check("engine-answered", messageCountBefore >= 3, `${messageCountBefore} messages before nav`);

// 3. Click the offer: SPA navigation to /apply/ with state intact.
await page.click("#mal-apply-nav");
await page.waitForURL("**/apply/", { timeout: 10000 });
check("navigated", page.url().endsWith("/apply/"), page.url());
check("panel-still-open", await page.isVisible("#mal-panel"), "panel survived navigation");
const messageCountAfter = await page.locator(".message").count();
check(
  "state-intact",
  messageCountAfter === messageCountBefore,
  `${messageCountAfter} messages after nav (no reset)`,
);
check(
  "question-retained",
  (await page.locator(".message-user").last().textContent()).includes(QUESTION),
  "customer turn still in the transcript",
);
check(
  "apply-page-rendered",
  await page.isVisible("main#main"),
  "application page content behind the panel",
);
writeFileSync(join(outDir, "apply-after-nav.png"), await page.screenshot());

// 4. No offer on a non-apply turn: account-specific question routes to
//    handoff and must never carry the apply nudge.
await page.click("#mal-launcher"); // close
await page.goto(`${nuxtBase}/contact/`, { waitUntil: "networkidle" });
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
await page.fill(".composer input", "What is my outstanding balance?");
await page.click(".composer-send");
await page.waitForSelector(".message-assistant >> nth=-1", { timeout: 45000 });
await page.waitForFunction(
  () => !document.querySelector(".thinking-bubble"),
  { timeout: 45000 },
);
check(
  "no-offer-on-handoff",
  !(await page.isVisible("#mal-apply-nav")),
  "no apply nudge on an account-specific turn",
);

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
