import { describe, expect, it } from "vitest";

import {
  CONTACT_AVAILABILITY_NOTE,
  ROUTE_FINDER_WELCOME,
  assistantCopySurfaceForTurn,
  contactTopicPrimerText,
  formatAssistantCopy,
} from "./assistantCopy";

describe("assistant display copy", () => {
  it("keeps broad scope guidance in welcome and topic-primer states", () => {
    expect(ROUTE_FINDER_WELCOME).toContain(CONTACT_AVAILABILITY_NOTE);
    expect(contactTopicPrimerText("Repayments")).toContain(
      CONTACT_AVAILABILITY_NOTE,
    );
  });

  it("uses a compact MAL-branded off-topic refusal without the welcome suffix", () => {
    const text = formatAssistantCopy(
      "This chat can only help with LoanSlam loan questions.",
      { isContactRoute: true, surface: "off_topic_refusal" },
    );

    expect(text).toBe(
      "Sorry, I can only help with Loans by MAL applications, repayments, account support, complaints, or accessibility needs. If your question is about your loan or application, tell me what you need and I'll route you safely.",
    );
    expect(text).not.toContain(CONTACT_AVAILABILITY_NOTE);
  });

  it.each([
    ["grounded_answer", "You can apply online from the application page."],
    [
      "unsupported_financial_promise",
      "I can't promise approval or coach an application outcome.",
    ],
    [
      "unsupported_rate_quote",
      "I can't quote a personal APR, or rate, in chat.",
    ],
    [
      "account_specific_route",
      "I can't view account details in chat. Share the standard handoff details below.",
    ],
    ["safe_human_handoff", "I can pass this complaint to the support team."],
    ["handoff_cancel", "No problem - ask me anything else about your loan."],
  ] as const)(
    "does not append welcome suffix on %s replies",
    (surface, sourceText) => {
      const text = formatAssistantCopy(sourceText, {
        isContactRoute: true,
        surface,
      });

      expect(text).toBe(sourceText);
      expect(text).not.toContain(CONTACT_AVAILABILITY_NOTE);
    },
  );

  it("classifies engine responses into the PRD copy surfaces", () => {
    expect(
      assistantCopySurfaceForTurn({
        finalAction: "fallback",
        safetyFlags: [],
        uiPrimitive: "safe_fallback",
        message: "This chat can only help with LoanSlam loan questions.",
      }),
    ).toBe("off_topic_refusal");

    expect(
      assistantCopySurfaceForTurn({
        finalAction: "refuse",
        safetyFlags: [],
        uiPrimitive: "safe_fallback",
        message:
          "I cannot answer that in chat. I can signpost general information or pass this to the support team.",
      }),
    ).toBe("off_topic_refusal");

    expect(
      assistantCopySurfaceForTurn({
        finalAction: "refuse",
        safetyFlags: [],
        uiPrimitive: "safe_fallback",
        message: "I can't quote a personal APR, or rate, in chat.",
      }),
    ).toBe("unsupported_rate_quote");

    expect(
      assistantCopySurfaceForTurn({
        finalAction: "refuse",
        safetyFlags: [],
        uiPrimitive: "safe_fallback",
        message: "I can't promise approval.",
      }),
    ).toBe("unsupported_financial_promise");

    expect(
      assistantCopySurfaceForTurn({
        finalAction: "request_handoff_intake",
        safetyFlags: ["account_specific_request"],
        uiPrimitive: "intake_form",
        message: "I can't view account details in chat.",
      }),
    ).toBe("account_specific_route");

    expect(
      assistantCopySurfaceForTurn({
        finalAction: "request_handoff_intake",
        safetyFlags: ["complaint"],
        uiPrimitive: "intake_form",
        message: "I can pass this complaint to the support team.",
      }),
    ).toBe("safe_human_handoff");

    expect(
      assistantCopySurfaceForTurn({
        finalAction: "request_handoff_intake",
        safetyFlags: ["accessibility_need"],
        uiPrimitive: "intake_form",
        message: "I can pass this to the support team.",
      }),
    ).toBe("safe_human_handoff");
  });
});
