import type { JourneyReport, PlannerMetadata } from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { policyVersion } from "../policy";
import { buildModelComparisonReport, calculateJourneyMetrics } from "./report";

const planner: PlannerMetadata = {
  provider: "inline",
  model: "test-planner",
  promptVersion: "phase0-report-test",
};

function report(
  overrides: Partial<JourneyReport> & Pick<JourneyReport, "journeyId">,
): JourneyReport {
  return {
    journeyId: overrides.journeyId,
    title: overrides.title ?? overrides.journeyId,
    passed: overrides.passed ?? true,
    turns: overrides.turns ?? 1,
    finalAction: overrides.finalAction ?? "answer",
    validatorOverrideCount: overrides.validatorOverrideCount ?? 0,
    unsafeAnswerAttempts: overrides.unsafeAnswerAttempts ?? 0,
    vulnerabilityMisses: overrides.vulnerabilityMisses ?? 0,
    repeatedQuestionCount: overrides.repeatedQuestionCount ?? 0,
    uxNotes: overrides.uxNotes ?? [],
    traces: overrides.traces ?? [
      {
        traceId: `${overrides.journeyId}-trace`,
        journeyId: overrides.journeyId,
        turnIndex: 0,
        conversationRef: "conv-report",
        requestRef: "request-report",
        inboundMessageId: "inbound-report",
        outboundMessageId: "outbound-report",
        planner,
        policyVersion,
        retrievedMatches: [],
        selectedServingMode: "answer",
        proposedAction: "answer",
        finalAction: overrides.finalAction ?? "answer",
        validatorOverrides: [],
        safetyFlags: [],
        customerMessage: "A report message.",
        createdAt: "2026-06-13T11:00:00.000Z",
      },
    ],
  };
}

describe("calculateJourneyMetrics", () => {
  it("counts pass rate, override rate, malformed rate, and average turns", () => {
    const metrics = calculateJourneyMetrics([
      report({ journeyId: "passed", turns: 1 }),
      report({
        journeyId: "overridden",
        passed: false,
        turns: 3,
        finalAction: "fallback",
        validatorOverrideCount: 2,
        unsafeAnswerAttempts: 1,
        vulnerabilityMisses: 1,
        uxNotes: ["Malformed plan: UI did not match final action."],
        traces: [
          {
            ...report({ journeyId: "overridden" }).traces[0],
            traceId: "overridden-trace",
            proposedAction: "answer",
            finalAction: "fallback",
            validatorOverrides: [
              {
                code: "ui_action_mismatch",
                reason: "UI mismatch.",
                fromAction: "answer",
                toAction: "fallback",
              },
              {
                code: "answer_grounding_missing",
                reason: "Missing grounding.",
                fromAction: "answer",
                toAction: "fallback",
              },
            ],
          },
        ],
      }),
    ]);

    expect(metrics).toEqual(
      expect.objectContaining({
        journeyCount: 2,
        passCount: 1,
        unsafeAnswerAttempts: 1,
        groundedAnswerRate: 0.5,
        validatorOverrideRate: 0.5,
        vulnerabilityMissRate: 0.5,
        malformedPlanRate: 0.5,
        averageTurnsToResolution: 2,
      }),
    );
  });
});

describe("buildModelComparisonReport", () => {
  it("builds schema-compatible failure modes and recommendation text from reports", () => {
    const comparison = buildModelComparisonReport({
      runId: "comparison-1",
      createdAt: new Date("2026-06-13T11:05:00.000Z"),
      planner,
      journeyReports: [
        report({ journeyId: "safe-answer", passed: true }),
        report({
          journeyId: "unsafe",
          passed: false,
          finalAction: "fallback",
          validatorOverrideCount: 1,
          unsafeAnswerAttempts: 1,
          uxNotes: ["Forbidden credential request blocked."],
          traces: [
            {
              ...report({ journeyId: "unsafe" }).traces[0],
              traceId: "unsafe-trace",
              proposedAction: "answer",
              finalAction: "fallback",
              validatorOverrides: [
                {
                  code: "forbidden_credential_request_blocked",
                  reason: "Credential request.",
                  fromAction: "answer",
                  toAction: "fallback",
                },
              ],
            },
          ],
        }),
      ],
    });

    expect(comparison).toEqual(
      expect.objectContaining({
        runId: "comparison-1",
        createdAt: "2026-06-13T11:05:00.000Z",
        policyVersion,
        planner,
        metrics: expect.objectContaining({
          journeyCount: 2,
          passCount: 1,
          validatorOverrideRate: 0.5,
        }),
        failureModes: expect.arrayContaining([
          expect.stringContaining("unsafe"),
          expect.stringContaining("forbidden_credential_request_blocked"),
        ]),
        recommendation: expect.stringContaining("Review"),
      }),
    );
  });
});
