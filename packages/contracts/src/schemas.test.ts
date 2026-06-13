import { describe, expect, it } from "vitest";

import {
  corpusItemSchema,
  intakeFieldSchema,
  turnPlanSchema,
  turnTraceSchema,
} from "./schemas";

const baseUi = {
  primitive: "message",
  message: "You can apply online and we will explain the next steps.",
  links: [
    {
      label: "Apply online",
      url: "https://www.loanslam.example/apply",
    },
  ],
};

describe("TurnPlanner contract schemas", () => {
  it("parses a valid TurnPlan", () => {
    expect(() =>
      turnPlanSchema.parse({
        action: "answer",
        customerMessage:
          "You can apply online. The application form explains what happens next.",
        ui: baseUi,
        reasonCode: "grounded_application_process_answer",
        collectedFacts: {
          topic: "application",
        },
        requestedFields: [],
        grounding: {
          citedItemIds: ["faq-application-process"],
          servingMode: "answer",
          confidence: "supported",
        },
        safetyFlags: [],
        traceSummary: "Answered from the application process FAQ.",
      }),
    ).not.toThrow();
  });

  it("rejects an invalid action", () => {
    const result = turnPlanSchema.safeParse({
      action: "refund",
      customerMessage: "I can refund that now.",
      ui: baseUi,
      reasonCode: "invalid_refund",
      collectedFacts: {},
      requestedFields: [],
      grounding: null,
      safetyFlags: [],
      traceSummary: "Invalid action should not be accepted.",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid UI primitive", () => {
    const result = turnPlanSchema.safeParse({
      action: "fallback",
      customerMessage: "I need to pass this to the team.",
      ui: {
        primitive: "modal",
        message: "Unsupported frontend instruction",
      },
      reasonCode: "unsupported_ui",
      collectedFacts: {},
      requestedFields: [],
      grounding: null,
      safetyFlags: [],
      traceSummary: "Arbitrary UI primitives are not allowed.",
    });

    expect(result.success).toBe(false);
  });

  it("requires answer_text on answer corpus items", () => {
    const result = corpusItemSchema.safeParse({
      id: "faq-missing-answer",
      title: "Missing answer text",
      serving_mode: "answer",
      question: "How do I apply?",
      tags: [],
    });

    expect(result.success).toBe(false);
  });

  it("allows non-answer corpus items to omit answer_text", () => {
    expect(() =>
      corpusItemSchema.parse({
        id: "settlement-figure",
        title: "Settlement figure requests",
        serving_mode: "handoff_account_specific",
        question: "Can I get my settlement figure?",
        route_reason:
          "Settlement figures are account-specific and need a human handoff.",
        tags: ["settlement"],
      }),
    ).not.toThrow();
  });

  it("requires route_reason on policy-routing corpus items", () => {
    const result = corpusItemSchema.safeParse({
      id: "excluded-no-reason",
      title: "Personal APR",
      serving_mode: "excluded",
      question: "What APR will I get?",
      tags: ["apr"],
    });

    expect(result.success).toBe(false);
  });

  it("keeps handoff fields as exact enum values", () => {
    expect(intakeFieldSchema.options).toEqual([
      "fullName",
      "dateOfBirth",
      "address",
      "phone",
      "email",
      "situationSummary",
    ]);
  });

  it("preserves validator override reasons in traces", () => {
    const trace = turnTraceSchema.parse({
      traceId: "trace-1",
      journeyId: "application-status",
      turnIndex: 2,
      conversationRef: "conv-1",
      requestRef: "req-1",
      inboundMessageId: "in-1",
      outboundMessageId: "out-1",
      planner: {
        provider: "openai",
        model: "gpt-test",
        promptVersion: "phase0-test",
      },
      policyVersion: "phase0-contracts",
      retrievedMatches: [],
      selectedServingMode: "handoff_account_specific",
      selectedRouteReason:
        "The anonymous chat cannot access account-specific status.",
      proposedAction: "answer",
      finalAction: "request_handoff_intake",
      validatorOverrides: [
        {
          code: "account_specific_answer_blocked",
          reason:
            "Account-specific status cannot be answered from anonymous chat.",
          fromAction: "answer",
          toAction: "request_handoff_intake",
        },
      ],
      safetyFlags: [],
      customerMessage: "I can help the team look into your application status.",
      createdAt: "2026-06-13T12:00:00.000Z",
    });

    expect(trace.validatorOverrides).toEqual([
      expect.objectContaining({
        code: "account_specific_answer_blocked",
        reason:
          "Account-specific status cannot be answered from anonymous chat.",
      }),
    ]);
    expect(trace.selectedRouteReason).toBe(
      "The anonymous chat cannot access account-specific status.",
    );
  });
});
