import type { Browser, Page } from "playwright-core";

import { ArtifactWriter } from "../../artifacts/ArtifactWriter";
import { launchProofBrowser } from "../../browser/launchProofBrowser";
import { newProofPage } from "../../browser/proofPage";
import { CheckRun } from "../../checks/CheckRun";
import { exitCodeForSummary } from "../../checks/exitPolicy";

export interface ProofOptions {
  base: string;
  outDir: string;
  json?: boolean;
}

const availabilityNote =
  "You can also ask me about our loans and how we work. Anything account-specific, I'll route to the right team.";

interface PanelState {
  panelVisible: boolean;
  assistantMessages: string[];
  customerMessages: string[];
  choiceGroups: string[];
  intakeLabels: string[];
  hasCaptureFields: boolean;
  hasOldRouteShortcutMenu: boolean;
  revealed: string | null;
  error: string;
}

export async function runContactAssistantProof(
  options: ProofOptions,
): Promise<number> {
  const writer = new ArtifactWriter(options.outDir);
  const run = new CheckRun("contact-assistant-proof", { base: options.base });
  let browser: Browser | undefined;

  try {
    browser = await launchProofBrowser();

    {
      const page = await newContactPage(browser, options.base);
      run.check(
        "contact-heading",
        await page
          .getByRole("heading", { name: "Start with the MAL Loans assistant" })
          .isVisible(),
        "assistant-first hero is visible",
      );
      run.check(
        "contact-panel-closed",
        !(await page.isVisible("#mal-panel")),
        "widget is opt-in on arrival (panel not mounted until opened)",
      );
      run.check(
        "contact-launcher-visible",
        await page.isVisible("#mal-launcher"),
        "launcher remains available",
      );
      await page.close();
    }

    {
      const page = await newContactPage(browser, options.base);
      await openWithPrimaryCta(page);
      const state = await panelState(page);
      const firstAssistant = state.assistantMessages.at(0) ?? "";
      run.check(
        "primary-opens-panel",
        state.panelVisible,
        "primary CTA opens the widget",
      );
      run.check(
        "primary-no-user-turn",
        state.customerMessages.length === 0,
        `${state.customerMessages.length} customer turns`,
      );
      run.check(
        "primary-availability-copy",
        firstAssistant.includes(availabilityNote),
        firstAssistant.slice(0, 180),
      );
      const badge = await page.evaluate(() => ({
        text:
          document
            .querySelector("#mal-mode-badge")
            ?.textContent?.replace(/\s+/g, " ")
            .trim() ?? "",
        mode:
          document.querySelector("#mal-panel")?.getAttribute("data-mode") ?? "",
      }));
      run.check(
        "primary-engine-mode-badge",
        badge.mode === "engine" && badge.text.includes("Guided support"),
        `${badge.mode}: ${badge.text}`,
      );
      run.check(
        "primary-no-capture",
        !state.hasCaptureFields,
        state.intakeLabels.join(", "),
      );
      run.check(
        "primary-no-route-shortcuts",
        !state.hasOldRouteShortcutMenu,
        state.choiceGroups.join(" | "),
      );
      writer.writeBuffer(
        "primary-open.png",
        await page.screenshot({ fullPage: false }),
      );
      await page.close();
    }

    {
      const page = await newContactPage(browser, options.base);
      await clickTopic(page, "repayment");
      const state = await panelState(page);
      const lastAssistant = state.assistantMessages.at(-1) ?? "";
      run.check(
        "topic-opens-panel",
        state.panelVisible,
        "topic click opens the widget",
      );
      run.check(
        "topic-no-user-turn",
        state.customerMessages.length === 0,
        `${state.customerMessages.length} customer turns`,
      );
      run.check(
        "topic-primes-only",
        /You are struggling with repayments/.test(lastAssistant),
        lastAssistant.slice(0, 180),
      );
      run.check(
        "topic-availability-copy",
        lastAssistant.includes(availabilityNote),
        lastAssistant.slice(0, 180),
      );
      run.check(
        "topic-no-capture",
        !state.hasCaptureFields,
        state.intakeLabels.join(", "),
      );
      run.check(
        "topic-no-route-shortcuts",
        !state.hasOldRouteShortcutMenu,
        state.choiceGroups.join(" | "),
      );
      writer.writeBuffer(
        "repayment-topic.png",
        await page.screenshot({ fullPage: false }),
      );

      await page.click('button[aria-label="Close chat"]');
      await page.waitForSelector("#mal-panel", {
        state: "hidden",
        timeout: 10_000,
      });
      const closedState = await panelState(page);
      run.check(
        "close-keeps-highlight-disabled",
        closedState.revealed === null,
        `data-revealed=${closedState.revealed}`,
      );
      await page.close();
    }

    {
      const page = await newContactPage(browser, options.base);
      await openWithPrimaryCta(page);
      await ask(page, "What documents do I need?");
      const state = await panelState(page);
      const lastAssistant = state.assistantMessages.at(-1) ?? "";
      run.check(
        "engine-general-question-recorded",
        state.customerMessages.at(-1) === "What documents do I need?",
        state.customerMessages.at(-1) ?? "",
      );
      run.check(
        "engine-general-replies",
        lastAssistant.length > 40 && state.error === "",
        state.error || lastAssistant.slice(0, 180),
      );
      run.check(
        "engine-general-availability-copy",
        lastAssistant.includes(availabilityNote),
        lastAssistant.slice(0, 180),
      );
      run.check(
        "engine-general-no-capture",
        !state.hasCaptureFields,
        state.intakeLabels.join(", "),
      );
      writer.writeBuffer(
        "documents-answer.png",
        await page.screenshot({ fullPage: false }),
      );
      await page.close();
    }

    {
      const page = await newContactPage(browser, options.base);
      await openWithPrimaryCta(page);
      await ask(page, "What is my outstanding balance?");
      const state = await panelState(page);
      const lastAssistant = state.assistantMessages.at(-1) ?? "";
      run.check(
        "engine-account-question-recorded",
        state.customerMessages.at(-1) === "What is my outstanding balance?",
        state.customerMessages.at(-1) ?? "",
      );
      run.check(
        "engine-account-handoff-form",
        state.hasCaptureFields,
        state.intakeLabels.join(", "),
      );
      run.check(
        "engine-account-availability-copy",
        lastAssistant.includes(availabilityNote),
        lastAssistant.slice(0, 180),
      );
      writer.writeBuffer(
        "account-handoff.png",
        await page.screenshot({ fullPage: false }),
      );
      await page.close();
    }
  } catch (error) {
    run.infrastructureError("contact-assistant-harness", error);
  } finally {
    await browser?.close();
  }

  const summary = run.summary();
  writer.writeJson("summary.json", summary);
  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    run.printSummary(options.outDir);
  }
  return exitCodeForSummary(summary);
}

async function newContactPage(browser: Browser, base: string): Promise<Page> {
  const page = await newProofPage(browser);
  await page.addInitScript(() => {
    window.sessionStorage.clear();
  });
  await page.goto(`${base}/contact/`, { waitUntil: "networkidle" });
  await page.waitForSelector("#mal-launcher", {
    state: "visible",
    timeout: 10_000,
  });
  return page;
}

async function panelState(page: Page): Promise<PanelState> {
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
    const intakeLabels = [
      ...document.querySelectorAll("#mal-panel .identity-label"),
    ].map((node) => node.textContent?.trim() ?? "");
    const oldRouteLabels = [
      "Apply online",
      "Repayment support",
      "Existing loan",
      "New loan team",
      "Complaints",
    ];
    const panelStyle =
      panel instanceof HTMLElement ? getComputedStyle(panel) : null;
    const panelRect =
      panel instanceof HTMLElement ? panel.getBoundingClientRect() : null;
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
        [
          "Full name",
          "Date of birth",
          "Postcode",
          "Email",
          "Phone number",
        ].some((label) => intakeLabels.includes(label)),
      hasOldRouteShortcutMenu: choiceGroups.some((text) =>
        oldRouteLabels.every((label) => text.includes(label)),
      ),
      revealed: contactSection?.getAttribute("data-revealed") ?? null,
      error:
        document.querySelector("#mal-panel .error")?.textContent?.trim() ?? "",
    };
  });
}

async function openWithPrimaryCta(page: Page): Promise<void> {
  await page.click(".assistant-primary-action");
  await page.waitForSelector("#mal-panel", {
    state: "visible",
    timeout: 10_000,
  });
}

async function clickTopic(page: Page, topicId: string): Promise<void> {
  await page.click(`.assistant-prompt[data-choice="${topicId}"]`);
  await page.waitForSelector("#mal-panel", {
    state: "visible",
    timeout: 10_000,
  });
}

async function ask(page: Page, message: string): Promise<void> {
  await page.fill("#mal-panel .composer input", message);
  await page.click("#mal-panel .composer-send");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#mal-panel .composer")
        ?.getAttribute("data-sending") !== "true",
    undefined,
    { timeout: 90_000 },
  );
}
