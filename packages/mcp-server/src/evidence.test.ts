import { describe, expect, it } from "vitest";

import { assertValidSessionDump, summarizeEvidence } from "./evidence";

describe("evidence summary", () => {
  it("summarizes the current lab session route evidence", () => {
    const session = assertValidSessionDump({
      conversationRef: "session-1",
      state: {
        history: [
          {
            role: "customer",
            content: "What is my balance?",
          },
          {
            role: "assistant",
            content: "I can pass this to the team.",
          },
        ],
        collectedFacts: {
          fullName: "Alex Test",
          email: "alex.test@example.com",
        },
        requestedFields: ["phone"],
        handoffPending: true,
      },
      traces: [
        {
          finalAction: "request_handoff_intake",
          effectiveServingMode: "handoff_account_specific",
          safetyFlags: ["account_specific_request"],
          validatorOverrides: [{ code: "account_specific_boundary" }],
          customerMessage: "I can pass this to the team.",
        },
      ],
    });

    expect(summarizeEvidence({ session })).toEqual({
      conversationRef: "session-1",
      messageCount: 2,
      traceCount: 1,
      collectedFactCount: 2,
      requestedFields: ["phone"],
      handoffPending: true,
      lastAction: "request_handoff_intake",
      selectedServingMode: "handoff_account_specific",
      safetyFlags: ["account_specific_request"],
      validatorOverrideCodes: ["account_specific_boundary"],
      finalCustomerMessage: "I can pass this to the team.",
    });
  });

  it("rejects incomplete dumps", () => {
    expect(() =>
      assertValidSessionDump({
        conversationRef: "session-1",
        state: { history: [] },
      }),
    ).toThrow("traces");
  });
});
