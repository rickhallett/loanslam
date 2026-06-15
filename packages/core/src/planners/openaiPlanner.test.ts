import { describe, expect, it, vi } from "vitest";

import {
  turnPlanSchema,
  type TurnPlan,
  type TurnPlannerInput,
} from "@loanslam/contracts";

import {
  defaultOpenAiPlannerModel,
  loadOpenAiPlannerConfig,
  PlannerConfigurationError,
} from "./config";
import {
  OpenAiTurnPlanner,
  type OpenAiPlannerClient,
  type OpenAiPlannerRequest,
} from "./openaiPlanner";

const validPlan: TurnPlan = {
  action: "answer",
  customerMessage: "You can apply online and review the next steps there.",
  ui: {
    primitive: "message",
    message: "You can apply online and review the next steps there.",
    links: [
      { label: "Apply online", url: "https://www.loanslam.example/apply" },
    ],
  },
  reasonCode: "grounded_application_answer",
  collectedFacts: {},
  requestedFields: [],
  grounding: {
    citedItemIds: ["faq-apply"],
    servingMode: "answer",
    confidence: "supported",
  },
  safetyFlags: [],
  traceSummary: "Answered from an answer-mode corpus item.",
};

const plannerInput: TurnPlannerInput = {
  conversationState: {
    conversationRef: "conv-1",
    history: [
      {
        id: "msg-1",
        role: "customer",
        content: "I need help with my application.",
        createdAt: "2026-06-13T12:00:00.000Z",
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "I can help with general application questions.",
        createdAt: "2026-06-13T12:00:10.000Z",
      },
    ],
    collectedFacts: { topic: "application" },
    requestedFields: [],
    safetyFlags: ["hardship"],
    handoffPending: false,
  },
  userMessage: "Can you tell me whether debt write off is an option?",
  retrievedMatches: [
    {
      itemId: "faq-apply",
      score: 12,
      servingMode: "answer",
      matchedTerms: ["apply"],
      item: {
        id: "faq-apply",
        title: "Applying for a LoanSlam loan",
        question: "How do I apply?",
        serving_mode: "answer",
        answer_text:
          "Applications are made online through the approved application form.",
        links: [
          { label: "Apply online", url: "https://www.loanslam.example/apply" },
        ],
        tags: ["application"],
      },
    },
    {
      itemId: "excluded-writeoff",
      score: 9,
      servingMode: "excluded",
      matchedTerms: ["write", "off"],
      item: {
        id: "excluded-writeoff",
        title: "Debt write off advice",
        question: "Can LoanSlam write off my debt?",
        serving_mode: "excluded",
        route_reason:
          "Debt write-off advice is recognised but excluded from automated answers.",
        links: [
          { label: "MoneyHelper", url: "https://www.moneyhelper.org.uk/" },
        ],
        tags: ["debt", "excluded"],
      },
    },
  ],
  allowedActions: ["answer", "request_handoff_intake", "refuse", "fallback"],
  allowedUiPrimitives: ["message", "intake_form", "safe_fallback"],
  policyVersion: "phase0-test-policy",
};

describe("OpenAI TurnPlanner config", () => {
  it("throws an explicit configuration error when OPENAI_API_KEY is missing", () => {
    expect(() => loadOpenAiPlannerConfig({})).toThrow(
      PlannerConfigurationError,
    );
    expect(() => loadOpenAiPlannerConfig({})).toThrow("OPENAI_API_KEY");
  });

  it("uses OPENAI_MODEL when provided", () => {
    expect(
      loadOpenAiPlannerConfig({
        OPENAI_API_KEY: "test-key",
        OPENAI_MODEL: "gpt-test-model",
      }),
    ).toEqual({
      provider: "openai",
      apiKey: "test-key",
      model: "gpt-test-model",
      promptVersion: expect.any(String),
    });
  });

  it("uses the default OpenAI model without an env override", () => {
    expect(loadOpenAiPlannerConfig({ OPENAI_API_KEY: "test-key" }).model).toBe(
      defaultOpenAiPlannerModel,
    );
  });

  it("defaults to the nano planner model used for Phase 0 runs", () => {
    expect(defaultOpenAiPlannerModel).toBe("gpt-5.4-nano");
  });
});

describe("OpenAiTurnPlanner", () => {
  it("calls the client with structured output intent and parses a valid plan", async () => {
    const parse = vi
      .fn<OpenAiPlannerClient["responses"]["parse"]>()
      .mockResolvedValue({
        output_parsed: validPlan,
      });
    const client: OpenAiPlannerClient = { responses: { parse } };
    const planner = new OpenAiTurnPlanner({
      client,
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test-model",
        promptVersion: "phase0-test-prompt",
      },
    });

    await expect(planner.planTurn(plannerInput)).resolves.toEqual(validPlan);

    expect(planner.metadata).toEqual({
      provider: "openai",
      model: "gpt-test-model",
      promptVersion: "phase0-test-prompt",
    });
    expect(parse).toHaveBeenCalledTimes(1);

    const request = parse.mock.calls[0]?.[0] as OpenAiPlannerRequest;
    expect(request.model).toBe("gpt-test-model");
    expect(request.instructions).toContain("Output exactly one TurnPlan");
    expect(request.input).toContain("Retrieved matches");
    expect(request.text?.format).toMatchObject({
      type: "json_schema",
      name: "turn_plan",
      strict: true,
    });
    const schemaText = JSON.stringify(request.text?.format);
    expect(schemaText).not.toContain("oneOf");
    expect(schemaText).not.toContain('"format":"uri"');
    expect(schemaText).not.toContain("minLength");
    expect(schemaText).not.toContain("propertyNames");
  });

  it("rejects malformed parsed output with the TurnPlan schema", async () => {
    const parse = vi
      .fn<OpenAiPlannerClient["responses"]["parse"]>()
      .mockResolvedValue({
        output_parsed: {
          ...validPlan,
          action: "refund",
        },
      });
    const client: OpenAiPlannerClient = { responses: { parse } };
    const planner = new OpenAiTurnPlanner({
      client,
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test-model",
        promptVersion: "phase0-test-prompt",
      },
    });

    await expect(planner.planTurn(plannerInput)).rejects.toThrow();
    expect(
      turnPlanSchema.safeParse({ ...validPlan, action: "refund" }).success,
    ).toBe(false);
  });

  it("normalizes oversized choice lists to the allowed UI limit", async () => {
    const choices = Array.from({ length: 7 }, (_, index) => ({
      id: `choice-${index + 1}`,
      label: `Choice ${index + 1}`,
    }));
    const parse = vi
      .fn<OpenAiPlannerClient["responses"]["parse"]>()
      .mockResolvedValue({
        output_parsed: {
          ...validPlan,
          action: "ask_clarifying_question",
          customerMessage: "What do you need help with?",
          ui: {
            primitive: "choice_list",
            message: "What do you need help with?",
            links: [],
            questions: [],
            choices,
            fields: [],
            reference: null,
          },
          grounding: null,
        },
      });
    const client: OpenAiPlannerClient = { responses: { parse } };
    const planner = new OpenAiTurnPlanner({
      client,
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test-model",
        promptVersion: "phase0-test-prompt",
      },
    });

    const result = await planner.planTurn(plannerInput);

    expect(result.action).toBe("ask_clarifying_question");
    expect(result.ui).toMatchObject({
      primitive: "choice_list",
      choices: choices.slice(0, 6),
    });
  });

  it("normalizes an empty clarifying questions array from the message", async () => {
    const parse = vi
      .fn<OpenAiPlannerClient["responses"]["parse"]>()
      .mockResolvedValue({
        output_parsed: {
          ...validPlan,
          action: "ask_clarifying_question",
          customerMessage: "What do you need help with?",
          ui: {
            primitive: "clarifying_prompt",
            message: "What do you need help with?",
            links: [],
            questions: [],
            choices: [],
            fields: [],
            reference: null,
          },
          grounding: null,
        },
      });
    const client: OpenAiPlannerClient = { responses: { parse } };
    const planner = new OpenAiTurnPlanner({
      client,
      config: {
        provider: "openai",
        apiKey: "test-key",
        model: "gpt-test-model",
        promptVersion: "phase0-test-prompt",
      },
    });

    const result = await planner.planTurn(plannerInput);

    expect(result.action).toBe("ask_clarifying_question");
    expect(result.ui).toEqual({
      primitive: "clarifying_prompt",
      message: "What do you need help with?",
      questions: ["What do you need help with?"],
    });
  });
});
