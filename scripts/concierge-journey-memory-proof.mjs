#!/usr/bin/env node
// Journey-memory proof: after completing steps 1-3 of the application, the
// concierge can answer "what was my offer?" from step 4, because the form
// snapshot now carries the whole journey (ApplicationJourney's published
// state hook), not just the current step's DOM.
//
// Usage: with the built site-nuxt server running under secrets:
//   node scripts/concierge-journey-memory-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [nuxtBase = "http://127.0.0.1:3641", outDir = "artifacts/demo-concierge/journey-memory"] =
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

// 1. Complete step 1 (details) with synthetic data.
await page.goto(`${nuxtBase}/apply/`, { waitUntil: "networkidle" });
const fill = (name, value) => page.fill(`section.application [name="${name}"]`, value);
await fill("monthlyIncome", "2400");
await page.selectOption('section.application [name="employmentStatus"]', { index: 1 });
await fill("firstName", "Priya");
await fill("lastName", "Demo");
await fill("dob", "08/12/1986");
await fill("mobile", "07700900123");
await fill("email", "priya.demo@example.com");
await fill("postcode", "BH19 1NF");
await fill("addressLine1", "1 Test Street");
await fill("city", "Swanage");
await fill("county", "Dorset");
await page.check('section.application [name="acceptTerms"]');
await page.click("section.application button.primary-action[type='submit']");

// 2. Step 2 (borrow): keep the defaults (2,500 over 24 months), continue.
await page.waitForSelector('section.application [name="loanAmount"]', { timeout: 10000 });
await page.click("section.application button.primary-action[type='submit']");

// 3. Step 3 (offer) renders the figures; continue to step 4 (read and sign).
await page.waitForSelector("section.application dl.summary-list", { timeout: 10000 });
await page.click("section.application button.primary-action[type='submit']");
await page.waitForSelector('section.application [name="signature"]', { timeout: 10000 });
check("reached-step-4", true, "signature field visible");

// 4. Journey hook carries the offer even though step 3's DOM is gone.
const journey = await page.evaluate(() => window.__malJourneyState);
check("journey-published", !!journey && journey.step === 4, `step=${journey?.step}`);
check(
  "journey-has-offer",
  JSON.stringify(journey?.offer ?? {}).includes("2,500"),
  JSON.stringify(journey?.offer ?? {}).slice(0, 120),
);

// 5. Ask the concierge for the offer from step 4.
await page.click("#mal-launcher");
await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
await page.fill(".composer input", "What was my loan offer again?");
await page.click(".composer-send");
await page.waitForFunction(
  () =>
    document.querySelectorAll(".message-assistant .message-text").length >= 2 &&
    !document.querySelector(".thinking-bubble"),
  { timeout: 45000 },
);
await page.waitForTimeout(3000);
const reply = await page.evaluate(
  () => [...document.querySelectorAll(".message-assistant .message-text")].at(-1).textContent,
);
check("offer-recalled", /2,?500/.test(reply), JSON.stringify(reply.slice(0, 200)));
check(
  "no-cannot-see-refusal",
  !/can'?t see|cannot see|not visible|don'?t have/i.test(reply.split(".")[0]),
  "first sentence is an answer, not a refusal",
);
await page.screenshot({ path: join(outDir, "offer-recall.png") });

await browser.close();
const passed = results.filter(Boolean).length;
writeFileSync(
  join(outDir, "results.json"),
  JSON.stringify({ nuxtBase, passed, total: results.length }, null, 2),
);
console.log(`${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
