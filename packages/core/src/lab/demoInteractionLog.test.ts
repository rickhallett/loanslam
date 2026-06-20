import type {
  DemoTurnResponse,
  ValidatedTurnResult,
} from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import {
  formatDemoLoggedEvent,
  formatDemoLogSession,
  formatDemoLogSummary,
  openInMemoryDemoInteractionLog,
  recordDemoSessionStarted,
  recordDemoTurn,
} from "./demoInteractionLog";

describe("demo interaction log", () => {
  it("stores queryable receipts and owner-only internal trace details", async () => {
    const log = openInMemoryDemoInteractionLog();

    await recordDemoSessionStarted({
      log,
      createdAt: "2026-06-16T12:00:00.000Z",
      method: "POST",
      path: "/demo/sessions",
      durationMs: 2,
      response: {
        conversationRef: "conv-1",
        continuationToken: "token-secret",
      },
    });
    await recordDemoTurn({
      log,
      createdAt: "2026-06-16T12:00:03.000Z",
      method: "POST",
      path: "/demo/sessions/conv-1/messages",
      durationMs: 123,
      turn: 1,
      userMessage: "Why did it do that?",
      result: validatedTurnResultFixture(),
      response: demoTurnResponseFixture(),
    });

    const summaries = await log.summaries(10);
    const events = await log.eventsForSession("conv-1");
    const turn = await log.turnEvent("conv-1", 1);

    await log.close();

    expect(summaries).toEqual([
      expect.objectContaining({
        conversationRef: "conv-1",
        eventCount: 2,
        messageTurns: 1,
        maxTurn: 1,
        hostContexts: ["handoff"],
        finalActions: ["request_handoff_intake"],
        overrideCount: 1,
      }),
    ]);
    expect(events).toHaveLength(2);
    expect(turn).toMatchObject({
      eventType: "message",
      turn: 1,
      customerMessage: "Why did it do that?",
      assistantMessage: "I can pass that to the team.",
      proposedAction: "answer",
      finalAction: "request_handoff_intake",
      servingMode: "handoff_account_specific",
      safetyFlags: ["account_specific_request"],
      overrideCodes: ["account_specific_answer_blocked"],
      retrievedItemIds: ["settlement-safe-id"],
      traceId: "trace-1",
    });

    expect(JSON.stringify(events)).not.toContain("token-secret");
    expect(JSON.stringify(turn?.displayResponseJson)).not.toContain(
      "token-secret",
    );
    expect(JSON.stringify(turn?.internalJson)).toContain("trace-secret");

    expect(formatDemoLogSummary(summaries)).toContain("conv-1");
    expect(
      formatDemoLogSession({ events, includeFullInternal: false }),
    ).toContain("overrides=account_specific_answer_blocked");
    expect(
      formatDemoLoggedEvent({
        event: turn!,
        includeFullInternal: true,
      }),
    ).toContain("trace-secret");
  });
});

function demoTurnResponseFixture(): DemoTurnResponse {
  return {
    conversationRef: "conv-1",
    requestRef: "req-1",
    customerMessage: "I can pass that to the team.",
    ui: {
      primitive: "intake_form",
      message: "I can pass that to the team.",
      fields: ["fullName", "email"],
    },
    terminalSession: false,
    hostContext: "handoff",
    continuationToken: "token-secret",
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
  };
}

function validatedTurnResultFixture(): ValidatedTurnResult {
  return {
    conversationRef: "conv-1",
    requestRef: "req-1",
    state: {
      conversationRef: "conv-1",
      history: [],
      collectedFacts: {
        email: "owner-visible@example.test",
      },
      requestedFields: ["fullName", "email"],
      safetyFlags: ["account_specific_request"],
      handoffPending: true,
      lastAction: "request_handoff_intake",
    },
    plan: {
      action: "answer",
      customerMessage: "plan-secret",
      ui: {
        primitive: "message",
        message: "plan-secret",
        links: [],
      },
      reasonCode: "plan-reason-secret",
      collectedFacts: {},
      requestedFields: [],
      grounding: null,
      safetyFlags: [],
      traceSummary: "trace-secret",
    },
    finalAction: "request_handoff_intake",
    ui: {
      primitive: "intake_form",
      message: "I can pass that to the team.",
      fields: ["fullName", "email"],
    },
    customerMessage: "I can pass that to the team.",
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
        model: "gpt-test",
        promptVersion: "prompt-test",
      },
      policyVersion: "policy-test",
      retrievedMatches: [
        {
          itemId: "settlement-safe-id",
          score: 42,
          servingMode: "handoff_account_specific",
          matchedTerms: ["owner-visible-match"],
        },
      ],
      selectedServingMode: "handoff_account_specific",
      effectiveServingMode: "handoff_account_specific",
      selectedRouteReason: "owner-visible-route-reason",
      proposedAction: "answer",
      finalAction: "request_handoff_intake",
      shadowSignalStatus: "fulfilled",
      shadowSignalBundle: {
        primaryIntent: "account_specific",
        secondaryIntents: [],
        recommendedServingMode: "handoff_account_specific",
        safetySignals: ["account_specific_request"],
        retrievalQueries: ["owner-visible-query"],
        routeHints: ["owner-visible-route-hint"],
        uncertainty: 0.2,
        negatedOrCorrected: false,
        parserNotes: ["owner-visible-note"],
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
      customerMessage: "trace-secret",
      createdAt: "2026-06-16T12:00:03.000Z",
    },
  };
}
