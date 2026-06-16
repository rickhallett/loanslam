import type {
  ConversationState,
  ValidatedTurnResult,
} from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import {
  mapStructuredIntakeToDemoResponse,
  mapTurnResultToDemoResponse,
} from "./demoDisplay";

describe("demo display mapper", () => {
  it("preserves content-free state-machine telemetry and strips internal evidence", () => {
    const response = mapTurnResultToDemoResponse({
      result: validatedTurnResultFixture(),
      turn: 1,
      continuationToken: "opaque-token",
    });

    expect(response).toMatchObject({
      conversationRef: "conv-1",
      requestRef: "req-1",
      customerMessage: "The team can help with that.",
      terminalSession: false,
      hostContext: "handoff",
      continuationToken: "opaque-token",
      telemetry: {
        type: "turn-telemetry",
        turn: 1,
        proposedAction: "answer",
        finalAction: "request_handoff_intake",
        servingMode: "handoff_account_specific",
        actionChanged: true,
        overrides: [
          {
            code: "account_specific_answer_blocked",
            fromAction: "answer",
            toAction: "request_handoff_intake",
          },
        ],
        safetyFlags: ["account_specific_request"],
        retrieval: {
          count: 1,
          topScore: 42,
          matches: [
            {
              itemId: "settlement-safe-id",
              score: 42,
              servingMode: "handoff_account_specific",
            },
          ],
        },
        signal: {
          status: "fulfilled",
          primaryIntent: "account_specific",
          recommendedServingMode: "handoff_account_specific",
          uncertainty: 0.2,
          comparison: "match",
        },
        intake: {
          collected: ["email"],
          requested: ["fullName", "email"],
          handoffPending: true,
        },
        uiPrimitive: "intake_form",
        source: "turn",
      },
    });

    const serialized = JSON.stringify(response);

    expect(serialized).not.toContain("trace-secret");
    expect(serialized).not.toContain("state-history-secret");
    expect(serialized).not.toContain("plan-reason-secret");
    expect(serialized).not.toContain("validator-reason-secret");
    expect(serialized).not.toContain("selected-route-reason-secret");
    expect(serialized).not.toContain("matched-term-secret");
    expect(serialized).not.toContain("route-hint-secret");
    expect(serialized).not.toContain("retrieval-query-secret");
    expect(serialized).not.toContain("parser-note-secret");
    expect(serialized).not.toContain("customer@example.test");
    expect(response.telemetry.retrieval.matches[0]).not.toHaveProperty("item");
  });

  it("returns only field names and safe confirmation copy for structured intake", () => {
    const state = conversationStateFixture({
      handoffPending: false,
      collectedFacts: {
        fullName: "Ada Lovelace",
        dateOfBirth: "1815-12-10",
        postcode: "AA1 1AA",
        email: "ada@example.test",
        phone: "07123456789",
      },
      requestedFields: [],
    });

    const response = mapStructuredIntakeToDemoResponse({
      conversationRef: "conv-1",
      state,
      finalAction: "create_ticket",
      ui: {
        primitive: "handoff_confirmation",
        message:
          "They will contact you on ada@example.test or 07123456789 within the next 48 hours.",
        reference: "LS-CONV1",
      },
      customerMessage:
        "They will contact you on ada@example.test or 07123456789 within the next 48 hours.",
      reference: "LS-CONV1",
      turn: 3,
      continuationToken: "opaque-token",
    });

    expect(response.customerMessage).toContain("contact details you provided");
    expect(response.ui.message).toContain("contact details you provided");
    expect(response.telemetry).toMatchObject({
      turn: 3,
      proposedAction: "create_ticket",
      finalAction: "create_ticket",
      source: "structured-intake",
      intake: {
        collected: ["fullName", "dateOfBirth", "postcode", "email", "phone"],
        requested: [],
        handoffPending: false,
      },
    });

    const serialized = JSON.stringify(response);
    expect(serialized).not.toContain("Ada Lovelace");
    expect(serialized).not.toContain("1815-12-10");
    expect(serialized).not.toContain("AA1 1AA");
    expect(serialized).not.toContain("ada@example.test");
    expect(serialized).not.toContain("07123456789");
  });
});

function validatedTurnResultFixture(): ValidatedTurnResult {
  const state = conversationStateFixture({
    history: [
      {
        id: "hist-1",
        role: "customer",
        content: "state-history-secret",
        createdAt: "2026-06-16T12:00:00.000Z",
      },
    ],
    collectedFacts: {
      email: "customer@example.test",
    },
    requestedFields: ["fullName", "email"],
    safetyFlags: ["account_specific_request"],
    handoffPending: true,
    lastAction: "request_handoff_intake",
  });

  return {
    conversationRef: "conv-1",
    requestRef: "req-1",
    state,
    plan: {
      action: "answer",
      customerMessage: "plan-customer-message-secret",
      ui: {
        primitive: "message",
        message: "plan-ui-secret",
        links: [],
      },
      reasonCode: "plan-reason-secret",
      collectedFacts: {
        email: "customer@example.test",
      },
      requestedFields: [],
      grounding: {
        citedItemIds: ["settlement-safe-id"],
        servingMode: "handoff_account_specific",
        confidence: "partial",
        notes: "grounding-notes-secret",
      },
      safetyFlags: ["account_specific_request"],
      traceSummary: "trace-secret",
    },
    finalAction: "request_handoff_intake",
    ui: {
      primitive: "intake_form",
      message: "The team can help with that.",
      fields: ["fullName", "email"],
    },
    customerMessage: "The team can help with that.",
    validatorOverrides: [
      {
        code: "account_specific_answer_blocked",
        reason: "validator-reason-secret",
        fromAction: "answer",
        toAction: "request_handoff_intake",
      },
    ],
    trace: {
      traceId: "trace-1",
      turnIndex: 0,
      conversationRef: "conv-1",
      requestRef: "req-1",
      inboundMessageId: "in-1",
      outboundMessageId: "out-1",
      planner: {
        provider: "openai",
        model: "model-secret",
        promptVersion: "prompt-version-secret",
      },
      policyVersion: "policy-secret",
      retrievedMatches: [
        {
          itemId: "settlement-safe-id",
          score: 42,
          servingMode: "handoff_account_specific",
          matchedTerms: ["matched-term-secret"],
          item: {
            id: "settlement-safe-id",
            question: "How do I get a settlement figure?",
            serving_mode: "handoff_account_specific",
            route_reason: "item-route-reason-secret",
            links: [],
            question_variants: [],
            tags: [],
          },
        },
      ],
      selectedServingMode: "handoff_account_specific",
      effectiveServingMode: "handoff_account_specific",
      selectedRouteReason: "selected-route-reason-secret",
      proposedAction: "answer",
      finalAction: "request_handoff_intake",
      shadowSignalStatus: "fulfilled",
      shadowSignalBundle: {
        primaryIntent: "account_specific",
        secondaryIntents: ["other"],
        recommendedServingMode: "handoff_account_specific",
        safetySignals: ["account_specific_request"],
        retrievalQueries: ["retrieval-query-secret"],
        routeHints: ["route-hint-secret"],
        uncertainty: 0.2,
        negatedOrCorrected: false,
        parserNotes: ["parser-note-secret"],
      },
      shadowSignalComparison: {
        status: "match",
        recommendedServingMode: "handoff_account_specific",
        finalServingMode: "handoff_account_specific",
        signalSafetyFlags: ["account_specific_request"],
        finalSafetyFlags: ["account_specific_request"],
        reasonCodes: ["serving_mode_match"],
        parseStatus: "ok",
      },
      validatorOverrides: [
        {
          code: "account_specific_answer_blocked",
          reason: "validator-reason-secret",
          fromAction: "answer",
          toAction: "request_handoff_intake",
        },
      ],
      safetyFlags: ["account_specific_request"],
      customerMessage: "trace-customer-message-secret",
      createdAt: "2026-06-16T12:00:00.000Z",
    },
  };
}

function conversationStateFixture(
  overrides: Partial<ConversationState> = {},
): ConversationState {
  return {
    conversationRef: "conv-1",
    history: [],
    collectedFacts: {},
    requestedFields: [],
    safetyFlags: [],
    handoffPending: false,
    ...overrides,
  };
}
