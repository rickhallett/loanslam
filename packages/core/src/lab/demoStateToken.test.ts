import type { ConversationState } from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { sealDemoStateToken, unsealDemoStateToken } from "./demoStateToken";

describe("demo state token", () => {
  it("keeps conversation state opaque and rejects tampering", () => {
    const state: ConversationState = {
      conversationRef: "conv-1",
      history: [
        {
          id: "msg-1",
          role: "customer",
          content: "Do not expose this message.",
          createdAt: "2026-06-16T12:00:00.000Z",
        },
      ],
      collectedFacts: {
        email: "customer@example.test",
      },
      requestedFields: ["email"],
      safetyFlags: ["account_specific_request"],
      handoffPending: true,
      lastAction: "request_handoff_intake",
    };

    const token = sealDemoStateToken({ state, secret: "test-secret" });

    expect(token).not.toContain("conv-1");
    expect(token).not.toContain("customer@example.test");
    expect(token).not.toContain("Do not expose this message.");
    expect(unsealDemoStateToken({ token, secret: "test-secret" })).toEqual(
      state,
    );

    const tampered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;
    expect(
      unsealDemoStateToken({ token: tampered, secret: "test-secret" }),
    ).toBeNull();
    expect(
      unsealDemoStateToken({ token, secret: "different-secret" }),
    ).toBeNull();
  });
});
