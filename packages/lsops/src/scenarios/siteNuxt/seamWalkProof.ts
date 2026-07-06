import type { Browser, Page } from "playwright-core";

import { ArtifactWriter } from "../../artifacts/ArtifactWriter";
import { launchProofBrowser } from "../../browser/launchProofBrowser";
import { newProofPage } from "../../browser/proofPage";
import { CheckRun } from "../../checks/CheckRun";
import { exitCodeForSummary } from "../../checks/exitPolicy";
import type { ProofOptions } from "./contactAssistantProof";

const SEAM_TO_ENGINE = "Connecting you to Guided support.";
const SEAM_TO_CONCIERGE =
  "Handing you to the Live guide — it can see the page you're on.";

interface WidgetState {
  mode: string;
  badge: string;
  seams: string[];
  assistantCount: number;
}

export async function runSeamWalkProof(options: ProofOptions): Promise<number> {
  const writer = new ArtifactWriter(options.outDir);
  const run = new CheckRun("seam-walk-proof", { base: options.base });
  let browser: Browser | undefined;

  try {
    browser = await launchProofBrowser();
    const page = await newProofPage(browser);

    await page.goto(`${options.base}/faq/`, { waitUntil: "networkidle" });
    await openPanel(page);
    await page.waitForFunction(
      () =>
        document.querySelector("#mal-panel")?.getAttribute("data-mode") ===
        "concierge",
      undefined,
      { timeout: 10_000 },
    );

    {
      const state = await widgetState(page);
      run.check(
        "concierge-badge",
        state.mode === "concierge" && state.badge.includes("Live guide"),
        `${state.mode}: ${state.badge}`,
      );
      writer.writeBuffer(
        "faq-concierge-header.png",
        await page.screenshot({ fullPage: false }),
      );
    }

    await ask(page, "Can I speak to a person about my loan, please?");
    {
      const state = await widgetState(page);
      run.check(
        "no-seam-before-flip",
        state.seams.length === 0,
        state.seams.join(" | "),
      );
    }

    await page.waitForSelector("#mal-handoff-nav", {
      state: "visible",
      timeout: 10_000,
    });
    await page.click("#mal-handoff-nav");
    await page.waitForFunction(
      () =>
        document
          .querySelector("#mal-panel .composer")
          ?.getAttribute("data-sending") !== "true",
      undefined,
      { timeout: 90_000 },
    );

    {
      const state = await widgetState(page);
      run.check(
        "seam-on-handoff",
        state.seams.length === 1 && state.seams[0] === SEAM_TO_ENGINE,
        state.seams.join(" | "),
      );
      run.check(
        "engine-badge-after-handoff",
        state.mode === "engine" && state.badge.includes("Guided support"),
        `${state.mode}: ${state.badge}`,
      );
      await page.waitForTimeout(450);
      writer.writeBuffer(
        "handoff-seam-divider.png",
        await page.screenshot({ fullPage: false }),
      );
    }

    await page.reload({ waitUntil: "networkidle" });
    await openPanel(page);
    await page.waitForFunction(
      () =>
        document.querySelector("#mal-panel")?.getAttribute("data-mode") ===
        "concierge",
      undefined,
      { timeout: 10_000 },
    );
    {
      const state = await widgetState(page);
      run.check(
        "seam-announced-after-reload",
        state.seams.length === 1 && state.seams[0] === SEAM_TO_CONCIERGE,
        state.seams.join(" | "),
      );
      run.check(
        "concierge-badge-after-reload",
        state.badge.includes("Live guide"),
        state.badge,
      );
      run.check(
        "transcript-persists-after-reload",
        state.assistantCount >= 2,
        `${state.assistantCount} assistant messages restored`,
      );
      await page.waitForTimeout(450);
      writer.writeBuffer(
        "reload-brain-continuity.png",
        await page.screenshot({ fullPage: false }),
      );
    }

    await page.close();
  } catch (error) {
    run.infrastructureError("seam-walk-harness", error);
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

async function widgetState(page: Page): Promise<WidgetState> {
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

async function openPanel(page: Page): Promise<void> {
  await page.waitForSelector("#mal-launcher", {
    state: "visible",
    timeout: 10_000,
  });
  await page.click("#mal-launcher");
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
