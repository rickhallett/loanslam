#!/usr/bin/env node
// dc2-003 persistence proof (demo-concierge-002, D046): the transcript and
// server session survive a full page load — the concierge remembers the
// conversation after reload because the same server-side session continues.
//
// Usage: node scripts/dc2-003-persistence-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [
  nuxtBase = "http://127.0.0.1:3641",
  outDir = "artifacts/demo-concierge/dc2-003-persistence",
] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const executablePath = `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const results = [];
const check = (id, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

async function say(page, text) {
  await page.fill(".composer input", text);
  await page.click(".composer-send");
  await page.waitForFunction(() => !document.querySelector(".thinking-bubble"), {
    timeout: 90000,
  });
  return (await page.locator(".message-assistant .message-text").last().textContent()) ?? "";
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 1. Establish a concierge conversation with a memorable fact on /faq/.
await page.goto(`${nuxtBase}/faq/`, { waitUntil: "networkidle" });
await page.click("#mal-launcher");
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
await say(page, "My name is Horatio and I'm thinking about a loan for boat repairs.");
const countBefore = await page.locator(".message").count();

// 2. Full page load to a different route (plain anchor navigation).
await page.goto(`${nuxtBase}/instalment-loan/`, { waitUntil: "networkidle" });
await page.click("#mal-launcher");
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
const countAfter = await page.locator(".message").count();
check(
  "transcript-restored",
  countAfter === countBefore,
  `${countAfter} messages after full reload (was ${countBefore})`,
);
check(
  "customer-turn-retained",
  ((await page.locator(".message-user").first().textContent()) ?? "").includes("Horatio"),
  "customer message survived the reload",
);

// 3. Same server session continues: the concierge recalls the fact.
const recall = await say(page, "Remind me — what did I say my name was?");
check("session-continues", /horatio/i.test(recall), recall.slice(0, 120));
writeFileSync(join(outDir, "restored-after-reload.png"), await page.screenshot());

// 4. Reset clears storage: fresh start after reset + reload.
await page.click('button[title="Start over"]');
await page.reload({ waitUntil: "networkidle" });
await page.click("#mal-launcher");
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
const freshCount = await page.locator(".message").count();
check("reset-clears", freshCount === 1, `${freshCount} message(s) after reset + reload`);

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
