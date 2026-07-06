import { describe, expect, it } from "vitest";

import { resolveChromiumExecutablePath } from "./launchProofBrowser";

describe("proof browser launch config", () => {
  it("prefers the lsops-specific chromium override", () => {
    expect(
      resolveChromiumExecutablePath({
        LSOPS_CHROMIUM_PATH: "/tmp/lsops",
        PLAYWRIGHT_CHROMIUM_PATH: "/tmp/playwright",
      }),
    ).toBe("/tmp/lsops");
  });

  it("lets Playwright resolve the executable when no override is set", () => {
    expect(resolveChromiumExecutablePath({})).toBeUndefined();
  });
});
