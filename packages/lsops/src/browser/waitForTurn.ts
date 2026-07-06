import type { Page } from "playwright-core";

export async function waitForComposerIdle(
  page: Page,
  timeout = 90_000,
): Promise<void> {
  await page.waitForFunction(
    () =>
      document.querySelector(".composer")?.getAttribute("data-sending") !==
      "true",
    undefined,
    { timeout },
  );
}

export async function sayAndWaitForAssistant(
  page: Page,
  selectorPrefix: string,
  message: string,
  timeout = 90_000,
): Promise<string> {
  const baseline = await page.evaluate(
    (prefix) =>
      document.querySelectorAll(
        `${prefix} .message-assistant:not(.thinking-bubble)`,
      ).length,
    selectorPrefix,
  );
  await page.fill(`${selectorPrefix} .composer input`, message);
  await page.click(`${selectorPrefix} .composer-send`);
  await page.waitForFunction(
    ({ before, prefix }) =>
      document
        .querySelector(`${prefix} .composer`)
        ?.getAttribute("data-sending") !== "true" &&
      document.querySelectorAll(
        `${prefix} .message-assistant:not(.thinking-bubble)`,
      ).length > before,
    { before: baseline, prefix: selectorPrefix },
    { timeout },
  );
  return (
    (await page
      .locator(`${selectorPrefix} .message-assistant .message-text`)
      .last()
      .textContent()) ?? ""
  );
}
