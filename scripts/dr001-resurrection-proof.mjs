#!/usr/bin/env node
// dr-001 resurrection proof (demo-resilience-001, D047): when the server
// loses the concierge session mid-conversation, the widget opens a fresh
// session, replays its transcript, and the concierge continues without the
// customer noticing — proven by the assistant recalling an earlier fact
// after the session is destroyed.
//
// Usage: node scripts/dr001-resurrection-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [nuxtBase = "http://127.0.0.1:3641", outDir = "artifacts/demo-resilience/dr001-resurrection"] =
  process.argv.slice(2);
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
  await page.waitForFunction(() => !document.querySelector(".thinking-bubble"), { timeout: 90000 });
  return (await page.locator(".message-assistant .message-text").last().textContent()) ?? "";
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

// 1. Start a concierge conversation with a memorable fact on /faq/.
await page.goto(`${nuxtBase}/faq/`, { waitUntil: "networkidle" });
await page.click("#mal-launcher");
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
await say(page, "My name is Perdita and I'm curious about a small loan for a piano.");
const ref = await page.evaluate(() => {
  const raw = sessionStorage.getItem("mal-chat-state-v1");
  return raw ? JSON.parse(raw).conciergeSessionRef : null;
});
check("session-established", !!ref, `concierge session ${ref}`);

// 2. Destroy that server session out-of-band (simulates a restart/redeploy:
//    the in-memory session is gone but the client transcript survives).
const killStatus = await page.evaluate(async (r) => {
  // No admin delete route by design; simulate loss by pointing the client at
  // a guaranteed-missing session and confirming the route 404s, then clear
  // the stored ref so the next turn must resurrect.
  const res = await fetch(`/api/concierge/sessions/${r}-destroyed/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "ping" }),
  });
  const saved = JSON.parse(sessionStorage.getItem("mal-chat-state-v1"));
  saved.conciergeSessionRef = `${r}-destroyed`;
  sessionStorage.setItem("mal-chat-state-v1", JSON.stringify(saved));
  return res.status;
}, ref);
check("lost-session-404s", killStatus === 404, `missing session returns ${killStatus}`);

// 3. Reload so the widget restores state (with the now-dead session ref),
//    then send a turn that depends on the earlier fact.
await page.reload({ waitUntil: "networkidle" });
await page.click("#mal-launcher");
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
const recall = await say(page, "What did I say my name was, and what was the loan for?");
check("resurrected-recall", /perdita/i.test(recall) && /piano/i.test(recall), recall.slice(0, 140));
const messageCount = await page.locator(".message-user").count();
check("no-duplicate-turns", messageCount === 2, `${messageCount} customer turns (expected 2)`);
writeFileSync(join(outDir, "resurrected.png"), await page.screenshot());

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
