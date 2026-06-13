import type {
  ConversationState,
  CorpusItem,
  TurnPlanner,
} from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { policyVersion, standardHandoffFields } from "./policy";
import { processTurn } from "./engine";

const corpus: CorpusItem[] = [
  {
    id: "how-do-i-apply",
    question: "How do I apply?",
    question_variants: ["Where can I apply online?"],
    serving_mode: "answer",
    answer_text: "You can apply online.",
    links: [{ label: "Apply", url: "https://www.loanslam.example/apply" }],
  },
  {
    id: "what-is-my-balance",
    question: "What is my balance?",
    serving_mode: "handoff_account_specific",
    route_reason: "A current balance is account-specific.",
    tags: ["balance"],
  },
];

function state(): ConversationState {
  return {
    conversationRef: "conv-1",
    history: [],
    collectedFacts: {},
    requestedFields: [],
    safetyFlags: [],
    handoffPending: false,
  };
}

function idFactory() {
  const ids = ["request-1", "inbound-1", "outbound-1", "trace-1"];

  return () => {
    const id = ids.shift();
    if (!id) {
      throw new Error("unexpected id request");
    }

    return id;
  };
}

describe("processTurn", () => {
  it("retrieves matches, calls the planner with policy boundaries, and records trace IDs", async () => {
    const plannerInputs: Parameters<TurnPlanner["planTurn"]>[0][] = [];
    const planner: TurnPlanner = {
      async planTurn(input) {
        plannerInputs.push(input);

        return {
          action: "answer",
          customerMessage: "You can apply online.",
          ui: {
            primitive: "message",
            message: "You can apply online.",
            links: [],
          },
          reasonCode: "grounded_answer",
          collectedFacts: { topic: "application" },
          requestedFields: [],
          grounding: {
            citedItemIds: ["how-do-i-apply"],
            servingMode: "answer",
            confidence: "supported",
          },
          safetyFlags: [],
          traceSummary: "Answered from retrieved FAQ.",
        };
      },
    };

    const result = await processTurn({
      state: state(),
      userMessage: "Where can I apply online?",
      planner,
      corpus,
      now: new Date("2026-06-13T12:00:00.000Z"),
      idFactory: idFactory(),
      journeyId: "journey-1",
      turnIndex: 3,
    });

    expect(plannerInputs).toHaveLength(1);
    expect(plannerInputs[0]).toMatchObject({
      userMessage: "Where can I apply online?",
      policyVersion,
      retrievedMatches: [
        expect.objectContaining({
          itemId: "how-do-i-apply",
          servingMode: "answer",
        }),
      ],
    });
    expect(plannerInputs[0]?.allowedActions).toContain(
      "request_handoff_intake",
    );
    expect(plannerInputs[0]?.allowedUiPrimitives).toContain("safe_fallback");

    expect(result).toMatchObject({
      conversationRef: "conv-1",
      requestRef: "request-1",
      finalAction: "answer",
      customerMessage: "You can apply online.",
      trace: {
        traceId: "trace-1",
        requestRef: "request-1",
        inboundMessageId: "inbound-1",
        outboundMessageId: "outbound-1",
        journeyId: "journey-1",
        turnIndex: 3,
        selectedServingMode: "answer",
        proposedAction: "answer",
        finalAction: "answer",
        policyVersion,
        createdAt: "2026-06-13T12:00:00.000Z",
      },
    });
    expect(result.state.history).toEqual([
      expect.objectContaining({
        id: "inbound-1",
        role: "customer",
        content: "Where can I apply online?",
      }),
      expect.objectContaining({
        id: "outbound-1",
        role: "assistant",
        content: "You can apply online.",
      }),
    ]);
    expect(result.state.collectedFacts).toEqual({ topic: "application" });
    expect(result.state.lastAction).toBe("answer");
    expect(result.state.handoffPending).toBe(false);
  });

  it("updates state and trace from validator overrides for account-specific routing", async () => {
    const planner: TurnPlanner = {
      async planTurn() {
        return {
          action: "answer",
          customerMessage: "Your balance is GBP 425.",
          ui: {
            primitive: "message",
            message: "Your balance is GBP 425.",
            links: [],
          },
          reasonCode: "bad_balance_answer",
          collectedFacts: { requestedTopic: "balance" },
          requestedFields: [],
          grounding: {
            citedItemIds: ["what-is-my-balance"],
            servingMode: "handoff_account_specific",
            confidence: "supported",
          },
          safetyFlags: ["account_specific_request"],
          traceSummary: "Tried to answer account-specific balance.",
        };
      },
    };

    const result = await processTurn({
      state: state(),
      userMessage: "What is my balance?",
      planner,
      corpus,
      now: new Date("2026-06-13T12:05:00.000Z"),
      idFactory: idFactory(),
    });

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.ui).toMatchObject({
      primitive: "intake_form",
      fields: standardHandoffFields,
    });
    expect(result.state.handoffPending).toBe(true);
    expect(result.state.requestedFields).toEqual(standardHandoffFields);
    expect(result.state.safetyFlags).toContain("account_specific_request");
    expect(result.trace).toMatchObject({
      selectedServingMode: "handoff_account_specific",
      selectedRouteReason: "A current balance is account-specific.",
      proposedAction: "answer",
      finalAction: "request_handoff_intake",
      validatorOverrides: [
        expect.objectContaining({
          code: expect.any(String),
          toAction: "request_handoff_intake",
        }),
      ],
      safetyFlags: expect.arrayContaining(["account_specific_request"]),
    });
    expect(result.customerMessage).not.toContain("GBP 425");
  });
});
