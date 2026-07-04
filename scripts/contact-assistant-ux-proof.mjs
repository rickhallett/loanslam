#!/usr/bin/env node
// Contact assistant UX proof: verifies the assistant-first /contact/ route
// without relying on the older campaign assumption that the widget auto-opens.
//
// Usage:
//   node scripts/contact-assistant-ux-proof.mjs [nuxtBase] [outDir]

import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [
  nuxtBase = "http://127.0.0.1:4185",
  outDir = "artifacts/contact-assistant-ux",
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
const availabilityNote = "You can also ask me any other Loans by MAL question here.";

const results = [];
const check = (id, ok, detail = "") => {
  results.push({ id, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id}  ${detail}`);
};

const browser = await chromium.launch({ executablePath, headless: true });

async function newContactPage() {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => {
    window.sessionStorage.clear();
  });
  await page.goto(`${nuxtBase}/contact/`, { waitUntil: "networkidle" });
  await page.waitForSelector("#mal-panel", { state: "attached", timeout: 10000 });
  await page.waitForSelector("#mal-launcher", { state: "visible", timeout: 10000 });
  return page;
}

async function panelState(page) {
  return page.evaluate(() => {
    const panel = document.querySelector("#mal-panel");
    const contactSection = document.querySelector("#contact-section");
    const assistantMessages = [
      ...document.querySelectorAll(
        "#mal-panel .message-assistant:not(.thinking-bubble) .message-text",
      ),
    ].map((node) => node.textContent?.trim() ?? "");
    const customerMessages = [
      ...document.querySelectorAll("#mal-panel .message-user .message-text"),
    ].map((node) => node.textContent?.trim() ?? "");
    const choiceGroups = [
      ...document.querySelectorAll("#mal-panel .primitive .choices"),
    ].map((node) => node.textContent?.replace(/\s+/g, " ").trim() ?? "");
    const intakeLabels = [...document.querySelectorAll("#mal-panel .identity-label")].map((node) => node.textContent?.trim() ?? "");
    const oldRouteLabels = ["Apply online", "Repayment support", "Existing loan", "New loan team", "Complaints"];
    const panelStyle = panel instanceof HTMLElement ? getComputedStyle(panel) : null;
    const panelRect = panel instanceof HTMLElement ? panel.getBoundingClientRect() : null;
    return {
      panelVisible:
        panelStyle !== null &&
        panelStyle.display !== "none" &&
        panelStyle.visibility !== "hidden" &&
        panelRect !== null &&
        panelRect.width > 0 &&
        panelRect.height > 0,
      assistantMessages,
      customerMessages,
      choiceGroups,
      intakeLabels,
      hasCaptureFields:
        document.querySelector("#mal-panel .identity-form") !== null ||
        ["Full name", "Date of birth", "Postcode", "Email", "Phone number"].some(
          (label) => intakeLabels.includes(label),
        ),
      hasOldRouteShortcutMenu: choiceGroups.some((text) =>
        oldRouteLabels.every((label) => text.includes(label)),
      ),
      revealed: contactSection?.getAttribute("data-revealed") ?? null,
      error: document.querySelector("#mal-panel .error")?.textContent?.trim() ?? "",
    };
  });
}

async function openWithPrimaryCta(page) {
  await page.click(".assistant-primary-action");
  await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
}

async function clickTopic(page, topicId) {
  await page.click(`.assistant-prompt[data-choice="${topicId}"]`);
  await page.waitForSelector("#mal-panel", { state: "visible", timeout: 10000 });
}

async function ask(page, message) {
  await page.fill("#mal-panel .composer input", message);
  await page.click("#mal-panel .composer-send");
  await page.waitForFunction(
    () => document.querySelector("#mal-panel .composer")?.getAttribute("data-sending") !== "true",
    { timeout: 90000 },
  );
}

try {
  {
    const page = await newContactPage();
    check(
      "contact-heading",
      await page.getByRole("heading", { name: "Start with the MAL Loans assistant" }).isVisible(),
      "assistant-first hero is visible",
    );
    check("contact-panel-closed", !(await page.isVisible("#mal-panel")), "widget is opt-in on arrival");
    check("contact-launcher-visible", await page.isVisible("#mal-launcher"), "launcher remains available");
    await page.close();
  }

  {
    const page = await newContactPage();
    await openWithPrimaryCta(page);
    const state = await panelState(page);
    const firstAssistant = state.assistantMessages.at(0) ?? "";
    check("primary-opens-panel", state.panelVisible, "primary CTA opens the widget");
    check(
      "primary-no-user-turn",
      state.customerMessages.length === 0,
      `${state.customerMessages.length} customer turns`,
    );
    check("primary-availability-copy", firstAssistant.includes(availabilityNote), firstAssistant.slice(0, 180));
    check("primary-no-capture", !state.hasCaptureFields, state.intakeLabels.join(", "));
    check("primary-no-route-shortcuts", !state.hasOldRouteShortcutMenu, state.choiceGroups.join(" | "));
    writeFileSync(join(outDir, "primary-open.png"), await page.screenshot({ fullPage: false }));
    await page.close();
  }

  {
    const page = await newContactPage();
    await clickTopic(page, "repayment");
    const state = await panelState(page);
    const lastAssistant = state.assistantMessages.at(-1) ?? "";
    check("topic-opens-panel", state.panelVisible, "topic click opens the widget");
    check(
      "topic-no-user-turn",
      state.customerMessages.length === 0,
      `${state.customerMessages.length} customer turns`,
    );
    check(
      "topic-primes-only",
      /You are struggling with repayments/.test(lastAssistant),
      lastAssistant.slice(0, 180),
    );
    check("topic-availability-copy", lastAssistant.includes(availabilityNote), lastAssistant.slice(0, 180));
    check("topic-no-capture", !state.hasCaptureFields, state.intakeLabels.join(", "));
    check("topic-no-route-shortcuts", !state.hasOldRouteShortcutMenu, state.choiceGroups.join(" | "));
    writeFileSync(join(outDir, "repayment-topic.png"), await page.screenshot({ fullPage: false }));

    await page.click('button[aria-label="Close chat"]');
    await page.waitForSelector("#mal-panel", { state: "hidden", timeout: 10000 });
    const closedState = await panelState(page);
    check("close-keeps-highlight-disabled", closedState.revealed === null, `data-revealed=${closedState.revealed}`);
    await page.close();
  }

  {
    const page = await newContactPage();
    await openWithPrimaryCta(page);
    await ask(page, "What documents do I need?");
    const state = await panelState(page);
    const lastAssistant = state.assistantMessages.at(-1) ?? "";
    check(
      "engine-general-question-recorded",
      state.customerMessages.at(-1) === "What documents do I need?",
      state.customerMessages.at(-1) ?? "",
    );
    check(
      "engine-general-replies",
      lastAssistant.length > 40 && state.error === "",
      state.error || lastAssistant.slice(0, 180),
    );
    check("engine-general-availability-copy", lastAssistant.includes(availabilityNote), lastAssistant.slice(0, 180));
    check("engine-general-no-capture", !state.hasCaptureFields, state.intakeLabels.join(", "));
    writeFileSync(join(outDir, "documents-answer.png"), await page.screenshot({ fullPage: false }));
    await page.close();
  }

  {
    const page = await newContactPage();
    await openWithPrimaryCta(page);
    await ask(page, "What is my outstanding balance?");
    const state = await panelState(page);
    const lastAssistant = state.assistantMessages.at(-1) ?? "";
    check(
      "engine-account-question-recorded",
      state.customerMessages.at(-1) === "What is my outstanding balance?",
      state.customerMessages.at(-1) ?? "",
    );
    check("engine-account-handoff-form", state.hasCaptureFields, state.intakeLabels.join(", "));
    check("engine-account-availability-copy", lastAssistant.includes(availabilityNote), lastAssistant.slice(0, 180));
    writeFileSync(join(outDir, "account-handoff.png"), await page.screenshot({ fullPage: false }));
    await page.close();
  }
} finally {
  await browser.close();
}

const passed = results.filter((result) => result.ok).length;
console.log(`\n${passed}/${results.length} checks passed. Artifacts: ${outDir}`);
if (passed !== results.length) process.exitCode = 1;
