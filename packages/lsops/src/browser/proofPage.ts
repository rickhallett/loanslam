import type { Browser, Page } from "playwright-core";

import { DEFAULT_PROOF_VIEWPORT } from "./launchProofBrowser";

export async function newProofPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage({ viewport: DEFAULT_PROOF_VIEWPORT });
  await page
    .addStyleTag({
      content: `
      *, *::before, *::after {
        animation-duration: 0.001s !important;
        animation-delay: 0s !important;
        transition-duration: 0.001s !important;
        transition-delay: 0s !important;
      }
    `,
    })
    .catch(() => undefined);
  return page;
}

export async function settleFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts?.ready;
  });
}
