#!/usr/bin/env node
// dc-005 form-state + arrival-intro proof (demo-concierge-001, D045):
// chat-driven navigation lands on /apply/ with an arrival introduction, and
// a concierge turn answers a form question with visible awareness of the
// values the customer has entered.
//
// Usage: with the built site-nuxt server running under secrets:
//   node scripts/dc005-form-state-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [nuxtBase = "http://127.0.0.1:3641", outDir = "artifacts/demo-concierge/dc005-form-state"] =
  process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const executablePath = `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const results = [];
const check = (id, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

async function lastAssistantText(page) {
  return (await page.locator(".message-assistant .message-text").last().textContent()) ?? "";
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 1. The full demo path: support chat -> apply intent -> navigate.
await page.goto(`${nuxtBase}/contact/`, { waitUntil: "networkidle" });
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
await page.fill(".composer input", "How do I apply for a loan?");
await page.click(".composer-send");
await page.waitForSelector("#mal-apply-nav", { state: "visible", timeout: 45000 });
await page.click("#mal-apply-nav");
await page.waitForURL("**/apply/", { timeout: 10000 });

// 2. Arrival introduction fires on the open panel reaching /apply/.
await page.waitForFunction(
  () => document.body.innerText.includes("I can see the form as you fill it in"),
  { timeout: 10000 },
);
check("arrival-intro", true, "introduction message rendered on arrival");
check("panel-open-on-arrival", await page.isVisible("#mal-panel"), "panel open on /apply/");

// 3. Enter form values, then ask the concierge about them.
await page.fill('input[name="monthlyIncome"]', "2500");
await page.fill('input[name="firstName"]', "Alex");
await page.fill(".composer input", "What have I filled in so far on this step?");
await page.click(".composer-send");
await page.waitForFunction(
  () => !document.querySelector(".thinking-bubble"),
  { timeout: 60000 },
);
const reply = await lastAssistantText(page);
check(
  "form-awareness",
  /2,?500|alex/i.test(reply),
  reply.slice(0, 160),
);
writeFileSync(join(outDir, "apply-form-awareness.png"), await page.screenshot());

// 4. Direct load: launcher closed by default, intro on first open.
const fresh = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await fresh.goto(`${nuxtBase}/apply/`, { waitUntil: "networkidle" });
check("direct-load-closed", !(await fresh.isVisible("#mal-panel")), "panel closed on direct load");
await fresh.click("#mal-launcher");
await fresh.waitForFunction(
  () => document.body.innerText.includes("I can see the form as you fill it in"),
  { timeout: 10000 },
);
check("direct-open-intro", true, "intro on first manual open");

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\nSample reply: ${reply}`);
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
