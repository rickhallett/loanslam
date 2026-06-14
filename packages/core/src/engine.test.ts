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
  {
    id: "update-my-bank-details",
    question: "Can I update my bank details?",
    question_variants: ["Update my payment details"],
    serving_mode: "handoff_account_specific",
    route_reason:
      "Updating bank details is an account change requiring account access.",
    tags: ["bank-details", "payment", "account-specific"],
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

  it("requests only handoff fields still missing from collected facts", async () => {
    const planner: TurnPlanner = {
      async planTurn() {
        return {
          action: "request_handoff_intake",
          customerMessage:
            "I can collect a few details and pass this to the Loanslam team.",
          ui: {
            primitive: "intake_form",
            message:
              "I can collect a few details and pass this to the Loanslam team.",
            fields: [...standardHandoffFields],
          },
          reasonCode: "handoff",
          collectedFacts: {
            fullName: "Bob Junior",
            phone: "07845729939",
          },
          requestedFields: [...standardHandoffFields],
          grounding: null,
          safetyFlags: ["account_specific_request"],
          traceSummary: "Collect remaining handoff fields.",
        };
      },
    };
    const initialState: ConversationState = {
      ...state(),
      collectedFacts: {
        email: "bob@example.com",
      },
      requestedFields: [...standardHandoffFields],
      safetyFlags: ["account_specific_request"],
      handoffPending: true,
    };

    const result = await processTurn({
      state: initialState,
      userMessage: "Update my payment details",
      planner,
      corpus,
      now: new Date("2026-06-13T12:06:00.000Z"),
      idFactory: idFactory(),
    });

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.ui).toMatchObject({
      primitive: "intake_form",
      fields: ["dateOfBirth", "address", "situationSummary"],
    });
    expect(result.state.requestedFields).toEqual([
      "dateOfBirth",
      "address",
      "situationSummary",
    ]);
    expect(result.state.collectedFacts).toMatchObject({
      email: "bob@example.com",
      fullName: "Bob Junior",
      phone: "07845729939",
    });
  });

  it("confirms handoff when all standard intake fields are already present", async () => {
    const planner: TurnPlanner = {
      async planTurn() {
        return {
          action: "request_handoff_intake",
          customerMessage:
            "Please complete the short details below so we can route you.",
          ui: {
            primitive: "intake_form",
            message:
              "Please complete the short details below so we can route you.",
            fields: [...standardHandoffFields],
          },
          reasonCode: "handoff",
          collectedFacts: {
            situationSummary: "Needs a loan for a cake as soon as possible.",
          },
          requestedFields: [...standardHandoffFields],
          grounding: null,
          safetyFlags: ["account_specific_request"],
          traceSummary: "Planner repeated the full handoff form.",
        };
      },
    };
    const initialState: ConversationState = {
      ...state(),
      collectedFacts: {
        fullName_candidate: "Bob Junior",
        dateOfBirth_candidate: "7 Dec 1900",
        address_candidate: "Windsor Castle",
        phone: "07845729939",
        email: "bob@example.com",
      },
      requestedFields: [...standardHandoffFields],
      safetyFlags: ["account_specific_request"],
      handoffPending: true,
    };

    const result = await processTurn({
      state: initialState,
      userMessage: "I have told you my details",
      planner,
      corpus,
      now: new Date("2026-06-13T12:07:00.000Z"),
      idFactory: idFactory(),
    });

    expect(result.finalAction).toBe("create_ticket");
    expect(result.customerMessage).not.toMatch(/below|complete/i);
    expect(result.ui).toMatchObject({
      primitive: "handoff_confirmation",
      reference: "conv-1",
    });
    expect(result.state.requestedFields).toEqual([]);
    expect(result.state.lastAction).toBe("create_ticket");
    expect(result.validatorOverrides).toContainEqual(
      expect.objectContaining({
        code: "handoff_intake_complete",
        toAction: "create_ticket",
      }),
    );
  });

  it("records obvious inbound sensitive overshare in state and trace flags", async () => {
    const planner: TurnPlanner = {
      async planTurn() {
        return {
          action: "request_handoff_intake",
          customerMessage:
            "I cannot handle that directly in chat. I can pass this to the Loanslam team.",
          ui: {
            primitive: "intake_form",
            message:
              "I cannot handle that directly in chat. I can pass this to the Loanslam team.",
            fields: [...standardHandoffFields],
          },
          reasonCode: "handoff_sensitive_overshare",
          collectedFacts: {},
          requestedFields: [...standardHandoffFields],
          grounding: null,
          safetyFlags: [],
          traceSummary: "Route sensitive account request to the team.",
        };
      },
    };

    const result = await processTurn({
      state: state(),
      userMessage:
        "Here are my bank details and date of birth, please fix my payment.",
      planner,
      corpus,
      now: new Date("2026-06-13T12:08:00.000Z"),
      idFactory: idFactory(),
    });

    expect(result.finalAction).toBe("request_handoff_intake");
    expect(result.trace.safetyFlags).toEqual(
      expect.arrayContaining(["forbidden_credentials", "sensitive_overshare"]),
    );
    expect(result.state.safetyFlags).toEqual(
      expect.arrayContaining(["forbidden_credentials", "sensitive_overshare"]),
    );
  });

  it("fails closed when the planner throws before returning a valid plan", async () => {
    const planner: TurnPlanner = {
      async planTurn() {
        throw new Error("Too big: expected array to have <=6 items");
      },
    };

    const result = await processTurn({
      state: state(),
      userMessage: "I need help with my loan",
      planner,
      corpus,
      now: new Date("2026-06-13T12:10:00.000Z"),
      idFactory: idFactory(),
      journeyId: "vague-clarification",
      turnIndex: 0,
    });

    expect(result.finalAction).toBe("fallback");
    expect(result.ui.message).not.toContain("Too big");
    expect(result.ui.message).not.toContain("planner");
    expect(result.plan).toMatchObject({
      action: "fallback",
      reasonCode: "planner_malformed_output",
      grounding: null,
    });
    expect(result.validatorOverrides).toEqual([
      expect.objectContaining({
        code: "malformed_plan",
        reason: expect.stringContaining("Too big"),
        toAction: "fallback",
      }),
    ]);
    expect(result.trace).toMatchObject({
      journeyId: "vague-clarification",
      proposedAction: "fallback",
      finalAction: "fallback",
      validatorOverrides: [
        expect.objectContaining({
          code: "malformed_plan",
          toAction: "fallback",
        }),
      ],
    });
    expect(result.state.history).toEqual([
      expect.objectContaining({
        id: "inbound-1",
        role: "customer",
        content: "I need help with my loan",
      }),
      expect.objectContaining({
        id: "outbound-1",
        role: "assistant",
        content: result.customerMessage,
      }),
    ]);
  });

  it("does not classify post-planner validation errors as malformed planner output", async () => {
    const planner: TurnPlanner = {
      async planTurn() {
        return {
          action: "not_allowed",
          customerMessage: "Invalid action.",
          ui: {
            primitive: "message",
            message: "Invalid action.",
            links: [],
          },
          reasonCode: "invalid_action",
          collectedFacts: {},
          requestedFields: [],
          grounding: null,
          safetyFlags: [],
          traceSummary: "This should not validate.",
        } as never;
      },
    };

    await expect(
      processTurn({
        state: state(),
        userMessage: "Where can I apply online?",
        planner,
        corpus,
        now: new Date("2026-06-13T12:15:00.000Z"),
        idFactory: idFactory(),
      }),
    ).rejects.toThrow();
  });
});
