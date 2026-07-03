#!/usr/bin/env node
// dr-003 live restart-recovery proof (demo-resilience-001, D047): against
// the LIVE production service, a real `railway redeploy` mid-conversation
// wipes the in-memory sessions; the open browser session recovers on its
// next turn via dr-001 resurrection, with the earlier fact recalled.
//
// Usage: node scripts/dr003-live-restart-proof.mjs [base] [outDir]
// The restart command can be overridden via DR003_RESTART_CMD.

import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [
  base = "https://loanslam-site-nuxt-production.up.railway.app",
  outDir = "artifacts/demo-resilience/dr003-live-restart",
] = process.argv.slice(2);
const restartCmd =
  process.env.DR003_RESTART_CMD ??
  "railway redeploy -p 0eb02bd3-37ac-4ac7-be33-53f7bfda764f -s loanslam-site-nuxt -e production -y";
mkdirSync(outDir, { recursive: true });

const executablePath = `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const results = [];
const check = (id, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

async function say(page, text) {
  const baseline = await page.evaluate(
    () => document.querySelectorAll(".message-assistant:not(.thinking-bubble)").length,
  );
  await page.fill(".composer input", text);
  await page.click(".composer-send");
  await page.waitForFunction(
    (before) =>
      !document.querySelector(".composer[data-sending]") &&
      document.querySelectorAll(".message-assistant:not(.thinking-bubble)").length > before,
    baseline,
    { timeout: 120000 },
  );
  return (await page.locator(".message-assistant .message-text").last().textContent()) ?? "";
}

// Probe whether the server still knows a session, without spending a model
// turn: an invalid body returns 400 when the session exists (session lookup
// precedes body validation, so a missing session 404s first).
async function sessionStatus(page, ref) {
  return page.evaluate(async (r) => {
    try {
      const res = await fetch(`/api/concierge/sessions/${r}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      return res.status;
    } catch {
      return 0; // service briefly unreachable mid-restart
    }
  }, ref);
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 1. A real conversation with a memorable fact, on the live service.
await page.goto(`${base}/faq/`, { waitUntil: "networkidle" });
await page.click("#mal-launcher");
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
await say(page, "My name is Orsino and I'm curious about a loan for a cello.");
const ref = await page.evaluate(() => {
  const raw = sessionStorage.getItem("mal-chat-state-v1");
  return raw ? JSON.parse(raw).conciergeSessionRef : null;
});
check("session-established", !!ref, `live concierge session ${ref}`);
const before = await sessionStatus(page, ref);
check("session-known-before-restart", before === 400, `invalid-body probe returns ${before}`);

// 2. A REAL redeploy of the production service, page left open throughout.
console.log(`  restarting service: ${restartCmd}`);
execSync(restartCmd, { stdio: "inherit", timeout: 300000 });
let after = before;
const deadline = Date.now() + 240000;
while (Date.now() < deadline) {
  after = await sessionStatus(page, ref);
  if (after === 404) break;
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
check("restart-wiped-session", after === 404, `invalid-body probe returns ${after} post-restart`);

// 3. The same open browser session sends again; dr-001 resurrection must
//    recover the conversation without the customer noticing.
const recall = await say(page, "What did I say my name was, and what was the loan for?");
check("resurrected-recall", /orsino/i.test(recall) && /cello/i.test(recall), recall.slice(0, 140));
const turns = await page.locator(".message-user").count();
check("no-duplicate-turns", turns === 2, `${turns} customer turns (expected 2)`);
writeFileSync(join(outDir, "recovered-after-redeploy.png"), await page.screenshot());

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
