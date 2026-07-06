import { describe, expect, it } from "vitest";

import {
  buildConciergePromptInput,
  conciergeInstructions,
} from "./conciergePrompt.service";

describe("concierge prompt service", () => {
  it("builds model input from conversation and site context", () => {
    const { input, displayOrigin } = buildConciergePromptInput({
      messages: [
        { role: "customer", content: "Can I apply?" },
        { role: "assistant", content: "Yes, use the application form." },
      ],
      publicOrigin: "https://www.loans-by-mal.example/apply",
      pageContext: { route: "/apply", title: "Apply" },
      formState: { step: "loan" },
    });

    expect(displayOrigin).toBe("https://www.loans-by-mal.example");
    expect(input[0]).toEqual({ role: "user", content: "Can I apply?" });
    expect(input[1]).toEqual({
      role: "assistant",
      content: "Yes, use the application form.",
    });
    expect(input.map((entry) => entry.role)).toEqual([
      "user",
      "assistant",
      "developer",
      "developer",
      "developer",
    ]);
    expect(input[2]?.content).toContain("Current public site origin");
    expect(input[3]?.content).toContain("Customer's current page");
    expect(input[4]?.content).toContain("Current application form state");
  });

  it("keeps the site map in the concierge instructions", () => {
    expect(conciergeInstructions).toContain("This is the complete site map");
    expect(conciergeInstructions).toContain("/apply/");
  });
});
