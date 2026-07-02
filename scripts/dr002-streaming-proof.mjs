#!/usr/bin/env node
// dr-002 streaming proof (demo-resilience-001, D047): a concierge reply
// renders incrementally — the thinking dots yield to a live bubble whose
// text grows while the turn is still in flight, and the finished reply is
// a whole message.
//
// Usage: node scripts/dr002-streaming-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [nuxtBase = "http://127.0.0.1:3641", outDir = "artifacts/demo-resilience/dr002-streaming"] =
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

await page.goto(`${nuxtBase}/faq/`, { waitUntil: "networkidle" });
await page.click("#mal-launcher");
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });

// Send a turn and sample the reply bubble while it is in flight. Only
// bubbles beyond the pre-send count are the streamed reply (the last
// assistant bubble before it appears is WELCOME/history, not this turn).
const baseline = await page.evaluate(
  () => document.querySelectorAll(".message-assistant:not(.thinking-bubble) .message-text").length,
);
await page.fill(
  ".composer input",
  "Could you walk me through what happens after I submit an application, in a bit of detail?",
);
await page.click(".composer-send");

const samples = [];
let midStreamShot = false;
const deadline = Date.now() + 90000;
while (Date.now() < deadline) {
  const state = await page.evaluate((before) => {
    const bubbles = [...document.querySelectorAll(".message-assistant:not(.thinking-bubble) .message-text")];
    return {
      text: bubbles.length > before ? (bubbles.at(-1)?.textContent ?? "") : "",
      thinking: !!document.querySelector(".thinking-bubble"),
      sending: !!document.querySelector(".composer[data-sending]"),
    };
  }, baseline);
  samples.push(state);
  if (!midStreamShot && state.sending && state.text.length > 20 && !state.thinking) {
    midStreamShot = true;
    writeFileSync(join(outDir, "mid-stream.png"), await page.screenshot());
  }
  if (!state.sending && samples.length > 1) break;
  await new Promise((resolve) => setTimeout(resolve, 60));
}

// Partial lengths observed while the turn was still in flight.
const inFlightLengths = [
  ...new Set(samples.filter((s) => s.sending && s.text.length > 0).map((s) => s.text.length)),
];
const growing = inFlightLengths.every((len, i) => i === 0 || len > inFlightLengths[i - 1]);
const finalText = samples.at(-1)?.text ?? "";

check(
  "streamed-incremental",
  inFlightLengths.length >= 3 && growing,
  `${inFlightLengths.length} distinct growing partial lengths in flight (${inFlightLengths.slice(0, 8).join(" -> ")}...)`,
);
check(
  "thinking-yields-to-stream",
  samples.some((s) => s.sending && !s.thinking && s.text.length > 0),
  "partial text visible with dots gone while still sending",
);
check(
  "final-reply-complete",
  finalText.length > 0 && finalText.length >= Math.max(...inFlightLengths, 0) && !samples.at(-1).thinking,
  `${finalText.length} chars: ${finalText.slice(0, 100)}`,
);
writeFileSync(join(outDir, "final.png"), await page.screenshot());

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
