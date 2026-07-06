import { afterEach, describe, expect, it } from "vitest";

import { conciergeModel } from "./conciergeOpenAi.client";

const originalModel = process.env.CONCIERGE_MODEL;

describe("concierge OpenAI client", () => {
  afterEach(() => {
    if (originalModel === undefined) {
      delete process.env.CONCIERGE_MODEL;
    } else {
      process.env.CONCIERGE_MODEL = originalModel;
    }
  });

  it("uses the default concierge model", () => {
    delete process.env.CONCIERGE_MODEL;

    expect(conciergeModel()).toBe("gpt-5.5");
  });

  it("allows the concierge model to be overridden", () => {
    process.env.CONCIERGE_MODEL = "gpt-5.4-mini";

    expect(conciergeModel()).toBe("gpt-5.4-mini");
  });
});
