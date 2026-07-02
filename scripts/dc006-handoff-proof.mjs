#!/usr/bin/env node
// dc-006 handoff proof (demo-concierge-001, D045): a struggling customer in
// concierge mode is offered the support team; the quick action routes the
// turn to the validated engine, whose existing intake flow captures a ticket
// server-side (asserted from the live intake response).
//
// Usage: with the built site-nuxt server running under secrets:
//   node scripts/dc006-handoff-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [nuxtBase = "http://127.0.0.1:3641", outDir = "artifacts/demo-concierge/dc006-handoff"] =
  process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const executablePath = `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const results = [];
const check = (id, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

const FIELD_VALUES = [
  [/name/i, "Demo Applicant"],
  [/birth/i, "1990-01-01"],
  [/postcode/i, "AB12 3CD"],
  [/email/i, "demo.applicant@example.invalid"],
  [/phone|mobile/i, "07000000000"],
];

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let intakeResponse = null;
page.on("response", async (response) => {
  if (response.url().includes("/intake") && response.request().method() === "POST") {
    try {
      intakeResponse = await response.json();
    } catch {
      // ignore non-JSON
    }
  }
});

// 1. Concierge difficulty turn on /apply/.
await page.goto(`${nuxtBase}/apply/`, { waitUntil: "networkidle" });
await page.click("#mal-launcher");
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
await page.fill(
  ".composer input",
  "I'm finding this form really difficult. Can I just talk to someone instead?",
);
await page.click(".composer-send");
await page.waitForSelector("#mal-handoff-nav", { state: "visible", timeout: 60000 });
check("support-offer", true, "concierge offered the support team with a quick action");

// 2. Quick action routes to the validated engine's intake flow.
await page.click("#mal-handoff-nav");
await page.waitForSelector(".identity-form", { state: "visible", timeout: 60000 });
check("intake-form", true, "engine returned the existing intake form");

// 3. Fill and share; the live intake response is the server readback.
for (const row of await page.locator(".identity-field").all()) {
  const label = (await row.locator(".identity-label").textContent()) ?? "";
  const value = FIELD_VALUES.find(([pattern]) => pattern.test(label))?.[1];
  if (value) await row.locator("input").fill(value);
}
writeFileSync(join(outDir, "apply-handoff-intake.png"), await page.screenshot());
await page.click(".identity-submit");
await page.waitForFunction(
  () => !document.querySelector(".thinking-bubble") && !document.querySelector(".identity-form"),
  { timeout: 60000 },
);
await page.waitForTimeout(500);
check(
  "ticket-captured",
  intakeResponse?.ticket?.status === "intake_captured",
  `intake response ticket status: ${intakeResponse?.ticket?.status ?? "none"} (${intakeResponse?.ticket?.id ?? "no id"})`,
);
check(
  "terminal-confirmation",
  (await page.locator(".message-assistant .message-text").last().textContent()).length > 0,
  "assistant confirmation rendered",
);
writeFileSync(join(outDir, "apply-handoff-complete.png"), await page.screenshot());

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
