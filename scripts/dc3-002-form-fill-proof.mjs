#!/usr/bin/env node
// dc3-002 form-fill proof (demo-concierge-003, D046): the concierge
// proposes values the customer stated in conversation; nothing applies
// until the user clicks; applying updates Vue state (a visible validation
// error clears), not just DOM attributes. The shared ApplicationJourney.vue
// stays untouched.
//
// Usage: node scripts/dc3-002-form-fill-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [nuxtBase = "http://127.0.0.1:3641", outDir = "artifacts/demo-concierge/dc3-002-form-fill"] =
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

await page.goto(`${nuxtBase}/apply/`, { waitUntil: "networkidle" });

// Trigger visible validation errors first (Vue-state probe).
await page.click(".application-panel button[type=submit]");
const incomeErrorBefore = await page
  .locator("section.application em")
  .count();
check("errors-visible", incomeErrorBefore > 0, `${incomeErrorBefore} validation errors shown`);

// Tell the concierge the details in conversation and ask for a fill.
await page.click("#mal-launcher");
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
await page.fill(
  ".composer input",
  "I'm Alex Smith, employed full time, my monthly income is 2500, born 14/02/1990, mobile 07700900123, email alex.smith@example.invalid. Can you fill in what you can for me?",
);
await page.click(".composer-send");
await page.waitForSelector("#mal-form-fill", { state: "visible", timeout: 90000 });
const chipLabel = (await page.locator("#mal-form-fill").textContent()) ?? "";
check("fill-proposed", /\(\d+\)/.test(chipLabel), chipLabel.trim());

// Nothing applies before the click.
const incomeBefore = await page.inputValue('input[name="monthlyIncome"]');
check("nothing-before-click", incomeBefore === "", `monthlyIncome before click: "${incomeBefore}"`);
writeFileSync(join(outDir, "fill-proposal.png"), await page.screenshot());

// Confirm: values land, and the Vue-rendered validation errors clear.
await page.click("#mal-form-fill");
await page.waitForTimeout(400);
const income = await page.inputValue('input[name="monthlyIncome"]');
const firstName = await page.inputValue('input[name="firstName"]');
const employment = await page.inputValue('select[name="employmentStatus"]');
check(
  "values-applied",
  income === "2500" && firstName === "Alex" && /full time/i.test(employment),
  `income=${income}, firstName=${firstName}, employment=${employment}`,
);
const errorsAfter = await page.locator("section.application em").count();
check(
  "vue-state-updated",
  errorsAfter < incomeErrorBefore,
  `validation errors ${incomeErrorBefore} -> ${errorsAfter} (v-model reacted to the fill)`,
);
writeFileSync(join(outDir, "fill-applied.png"), await page.screenshot());

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
