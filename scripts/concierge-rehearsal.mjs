#!/usr/bin/env node
// Demo rehearsal battery (demo-concierge-001, D045): the exact stakeholder
// demo choreography, end to end, in one browser session — support chat ->
// apply intent -> navigation -> arrival intro -> form-aware concierge turns
// -> difficulty -> engine handoff -> ticket captured. Run it against the
// live URL before every demo.
//
// Usage: node scripts/concierge-rehearsal.mjs [base] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [
  base = "https://loanslam-site-nuxt-production.up.railway.app",
  outDir = "artifacts/demo-concierge/rehearsal",
] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });

const executablePath = `${homedir()}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const results = [];
const check = (id, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

async function waitForReply(page, baseline) {
  // Turn-complete = a new assistant bubble exists and the composer's
  // data-sending flag has cleared. Works on both the pre-streaming build
  // (no data-sending attribute; bubble lands whole) and the dr-002
  // streaming build (dots yield at the first delta while text still grows).
  await page.waitForFunction(
    (before) =>
      !document.querySelector(".composer[data-sending]") &&
      !document.querySelector(".thinking-bubble") &&
      document.querySelectorAll(".message-assistant:not(.thinking-bubble)").length > before,
    baseline,
    { timeout: 90000 },
  );
  return (await page.locator(".message-assistant .message-text").last().textContent()) ?? "";
}

async function say(page, text) {
  const baseline = await page.evaluate(
    () => document.querySelectorAll(".message-assistant:not(.thinking-bubble)").length,
  );
  await page.fill(".composer input", text);
  await page.click(".composer-send");
  return waitForReply(page, baseline);
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

let intakeResponse = null;
page.on("response", async (response) => {
  if (response.url().includes("/intake") && response.request().method() === "POST") {
    try {
      intakeResponse = await response.json();
    } catch {
      /* non-JSON */
    }
  }
});

// Beat 1: support chat answers the apply question and offers the journey.
await page.goto(`${base}/contact/`, { waitUntil: "networkidle" });
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 15000 });
await say(page, "How do I apply for a loan?");
await page.waitForSelector("#mal-apply-nav", { state: "visible", timeout: 15000 });
check("beat1-offer", true, "apply quick action after grounded answer");
writeFileSync(join(outDir, "beat1-offer.png"), await page.screenshot());

// Beat 2: navigation with the arrival introduction.
await page.click("#mal-apply-nav");
await page.waitForURL("**/apply/", { timeout: 15000 });
await page.waitForFunction(
  () => document.body.innerText.includes("I can see the form as you fill it in"),
  { timeout: 15000 },
);
check("beat2-arrival", true, "landed on /apply/ with intro, transcript intact");
writeFileSync(join(outDir, "beat2-arrival.png"), await page.screenshot());

// Beat 3: form-aware concierge turns.
await page.fill('input[name="monthlyIncome"]', "2500");
await page.fill('input[name="firstName"]', "Alex");
const aware = await say(page, "What have I filled in so far on this step?");
check("beat3-form-aware", /2,?500|alex/i.test(aware), aware.slice(0, 120));
const fieldHelp = await say(page, "What does the employment status field want from me?");
check("beat3-field-help", /employ/i.test(fieldHelp), fieldHelp.slice(0, 120));
writeFileSync(join(outDir, "beat3-form-aware.png"), await page.screenshot());

// Beat 4: difficulty -> support team -> existing engine handoff to ticket.
const difficult = await say(
  page,
  "Honestly I'm finding this all a bit much. Can I just talk to a person?",
);
await page.waitForSelector("#mal-handoff-nav", { state: "visible", timeout: 15000 });
check("beat4-support-offer", true, difficult.slice(0, 100));
await page.click("#mal-handoff-nav");
await page.waitForSelector(".identity-form", { state: "visible", timeout: 90000 });
const FIELD_VALUES = [
  [/name/i, "Demo Applicant"],
  [/birth/i, "1990-01-01"],
  [/postcode/i, "AB12 3CD"],
  [/email/i, "demo.applicant@example.invalid"],
  [/phone|mobile/i, "07000000000"],
];
for (const row of await page.locator(".identity-field").all()) {
  const label = (await row.locator(".identity-label").textContent()) ?? "";
  const value = FIELD_VALUES.find(([pattern]) => pattern.test(label))?.[1];
  if (value) await row.locator("input").fill(value);
}
await page.click(".identity-submit");
await page.waitForFunction(
  () => !document.querySelector(".thinking-bubble") && !document.querySelector(".identity-form"),
  { timeout: 90000 },
);
await page.waitForTimeout(500);
check(
  "beat4-ticket",
  intakeResponse?.ticket?.status === "intake_captured",
  `ticket ${intakeResponse?.ticket?.id ?? "none"} (${intakeResponse?.ticket?.status ?? "no status"})`,
);
writeFileSync(join(outDir, "beat4-handoff-complete.png"), await page.screenshot());

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} rehearsal beats passed against ${base}`);
if (passed !== results.length) process.exitCode = 1;
