#!/usr/bin/env node
// Seam walk proof: verifies the two-brain seam is explicit in the widget.
//
// Checks, on a live server:
// 1. Concierge routes badge "Live guide" with the warm header (data-mode).
// 2. The handoff quick-action (forceEngine) announces the brain flip with a
//    transcript seam divider and flips the badge to "Guided support".
// 3. Divider lines are ephemeral across a reload, but the last announced
//    brain persists, so the flip back to the concierge is announced after a
//    full page load (header-link navigation is a full reload).
//
// Usage:
//   node scripts/seam-walk-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [
  nuxtBase = "http://127.0.0.1:4185",
  outDir = "artifacts/seam-walk",
] = process.argv.slice(2);

mkdirSync(outDir, { recursive: true });

const executablePath = join(
  homedir(),
  "Library",
  "Caches",
  "ms-playwright",
  "chromium-1228",
  "chrome-mac-arm64",
  "Google Chrome for Testing.app",
  "Contents",
  "MacOS",
  "Google Chrome for Testing",
);

const SEAM_TO_ENGINE = "Connecting you to Guided support.";
const SEAM_TO_CONCIERGE =
  "Handing you to the Live guide — it can see the page you're on.";

const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

async function widgetState(page) {
  return page.evaluate(() => ({
    mode: document.querySelector("#mal-panel")?.getAttribute("data-mode") ?? "",
    badge:
      document
        .querySelector("#mal-mode-badge")
        ?.textContent?.replace(/\s+/g, " ")
        .trim() ?? "",
    seams: [...document.querySelectorAll("#mal-panel .message-seam")].map(
      (node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "",
    ),
    assistantCount: document.querySelectorAll(
      "#mal-panel .message-assistant:not(.thinking-bubble)",
    ).length,
  }));
}

async function openPanel(page) {
  await page.waitForSelector("#mal-launcher", { state: "visible", timeout: 10000 });
  await page.click("#mal-launcher");
  await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
}

async function ask(page, message) {
  await page.fill("#mal-panel .composer input", message);
  await page.click("#mal-panel .composer-send");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#mal-panel .composer")
        ?.getAttribute("data-sending") !== "true",
    { timeout: 90000 },
  );
}

const browser = await chromium.launch({ executablePath, headless: true });
// Fresh browser context: sessionStorage starts empty, and the reload phase
// below depends on it surviving navigation (no init-script clear here).
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto(`${nuxtBase}/faq/`, { waitUntil: "networkidle" });
  await openPanel(page);
  // The concierge status fetch is async; wait for the mode to settle.
  await page.waitForFunction(
    () =>
      document.querySelector("#mal-panel")?.getAttribute("data-mode") ===
      "concierge",
    { timeout: 10000 },
  );

  {
    const state = await widgetState(page);
    check(
      "concierge-badge",
      state.mode === "concierge" && state.badge.includes("Live guide"),
      `${state.mode}: ${state.badge}`,
    );
    writeFileSync(
      join(outDir, "faq-concierge-header.png"),
      await page.screenshot({ fullPage: false }),
    );
  }

  await ask(page, "Can I speak to a person about my loan, please?");
  {
    const state = await widgetState(page);
    check("no-seam-before-flip", state.seams.length === 0, state.seams.join(" | "));
  }

  // dc-006 difficulty path: the concierge offers the support team and the
  // deterministic quick action routes the next turn to the engine.
  await page.waitForSelector("#mal-handoff-nav", { state: "visible", timeout: 10000 });
  await page.click("#mal-handoff-nav");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#mal-panel .composer")
        ?.getAttribute("data-sending") !== "true",
    { timeout: 90000 },
  );

  {
    const state = await widgetState(page);
    check(
      "seam-on-handoff",
      state.seams.length === 1 && state.seams[0] === SEAM_TO_ENGINE,
      state.seams.join(" | "),
    );
    check(
      "engine-badge-after-handoff",
      state.mode === "engine" && state.badge.includes("Guided support"),
      `${state.mode}: ${state.badge}`,
    );
    await page.waitForTimeout(450);
    writeFileSync(
      join(outDir, "handoff-seam-divider.png"),
      await page.screenshot({ fullPage: false }),
    );
  }

  // Full reload: dividers must not survive, but the persisted brain marker
  // must make the flip back to the concierge announce itself.
  await page.reload({ waitUntil: "networkidle" });
  await openPanel(page);
  await page.waitForFunction(
    () =>
      document.querySelector("#mal-panel")?.getAttribute("data-mode") ===
      "concierge",
    { timeout: 10000 },
  );
  {
    const state = await widgetState(page);
    check(
      "seam-announced-after-reload",
      state.seams.length === 1 && state.seams[0] === SEAM_TO_CONCIERGE,
      state.seams.join(" | "),
    );
    check(
      "concierge-badge-after-reload",
      state.badge.includes("Live guide"),
      state.badge,
    );
    check(
      "transcript-persists-after-reload",
      state.assistantCount >= 2,
      `${state.assistantCount} assistant messages restored`,
    );
    await page.waitForTimeout(450);
    writeFileSync(
      join(outDir, "reload-brain-continuity.png"),
      await page.screenshot({ fullPage: false }),
    );
  }
} finally {
  await browser.close();
}

const passed = results.filter((result) => result.ok).length;
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
