#!/usr/bin/env node
// dc2-002 page-context proof (demo-concierge-002, D046): concierge turns on
// non-apply routes answer with visible awareness of the page the customer
// is on; /contact/ still goes to the validated engine.
//
// Usage: node scripts/dc2-002-page-context-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [
  nuxtBase = "http://127.0.0.1:3641",
  outDir = "artifacts/demo-concierge/dc2-002-page-context",
] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const executablePath = `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const results = [];
const check = (id, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function askOn(route, question) {
  await page.goto(`${nuxtBase}${route}`, { waitUntil: "networkidle" });
  if (!(await page.isVisible("#mal-panel"))) await page.click("#mal-launcher");
  await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
  await page.fill(".composer input", question);
  await page.click(".composer-send");
  await page.waitForFunction(() => !document.querySelector(".thinking-bubble"), {
    timeout: 90000,
  });
  return (await page.locator(".message-assistant .message-text").last().textContent()) ?? "";
}

// Concierge tracks which page the customer is on (fresh page per route =
// fresh widget state, so each is an independent conversation).
const faq = await askOn("/faq/", "What page am I on right now, in one sentence?");
check("faq-aware", /faq|frequently asked|question/i.test(faq), faq.slice(0, 140));

const product = await askOn(
  "/instalment-loan/",
  "Summarise what this page is telling me in one sentence.",
);
check("product-aware", /instalment|loan/i.test(product), product.slice(0, 140));
writeFileSync(join(outDir, "instalment-page-aware.png"), await page.screenshot());

// /contact/ still speaks through the validated engine: an account question
// must produce the safe handoff (intake form), never a concierge answer.
await page.goto(`${nuxtBase}/contact/`, { waitUntil: "networkidle" });
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
await page.fill(".composer input", "What is my outstanding balance?");
await page.click(".composer-send");
await page.waitForFunction(() => !document.querySelector(".thinking-bubble"), {
  timeout: 90000,
});
const contactHandoff = await page.isVisible(".identity-form");
check("contact-still-engine", contactHandoff, "account question -> engine intake form");

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
