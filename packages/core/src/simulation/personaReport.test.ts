import type {
  ConversationTranscript,
  PersonaProfile,
  PlannerMetadata,
  TranscriptTurn,
} from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { policyVersion } from "../policy";
import { buildPersonaReport } from "./personaReport";

const planner: PlannerMetadata = {
  provider: "inline",
  model: "persona-test-planner",
  promptVersion: "phase0-persona-report-test",
};

const cooperative: PersonaProfile = {
  id: "cooperative",
  label: "Cooperative",
  traits: ["clear"],
  styleNotes: "Asks direct questions.",
};

const vulnerable: PersonaProfile = {
  id: "vulnerable",
  label: "Vulnerable",
  traits: ["hardship"],
  styleNotes: "Shares hardship signals.",
};

function turn(overrides: Partial<TranscriptTurn> = {}): TranscriptTurn {
  return {
    turnIndex: overrides.turnIndex ?? 0,
    userMessage: overrides.userMessage ?? "Can I apply online?",
    botMessage: overrides.botMessage ?? "You can apply online.",
    proposedAction: overrides.proposedAction ?? "answer",
    finalAction: overrides.finalAction ?? "answer",
    selectedServingMode: overrides.selectedServingMode ?? "answer",
    selectedRouteReason: overrides.selectedRouteReason ?? null,
    safetyFlags: overrides.safetyFlags ?? [],
    validatorOverrideCodes: overrides.validatorOverrideCodes ?? [],
    retrievedItemIds: overrides.retrievedItemIds ?? ["apply-online"],
    traceId: overrides.traceId ?? "trace-report",
    requestRef: overrides.requestRef ?? "request-report",
    createdAt: overrides.createdAt ?? "2026-06-13T14:00:00.000Z",
  };
}

function transcript(
  overrides: Partial<ConversationTranscript> &
    Pick<ConversationTranscript, "transcriptId" | "scenarioId" | "persona">,
): ConversationTranscript {
  const turns = overrides.turns ?? [turn()];

  return {
    transcriptId: overrides.transcriptId,
    scenarioId: overrides.scenarioId,
    scenarioTitle: overrides.scenarioTitle ?? overrides.scenarioId,
    persona: overrides.persona,
    planner: overrides.planner ?? planner,
    policyVersion,
    startedAt: overrides.startedAt ?? "2026-06-13T14:00:00.000Z",
    completedAt: overrides.completedAt ?? "2026-06-13T14:01:00.000Z",
    turns,
    finalAction: overrides.finalAction ?? turns.at(-1)?.finalAction ?? "answer",
    validatorOverrideCount: overrides.validatorOverrideCount ?? 0,
    caughtUnsafeProposals: overrides.caughtUnsafeProposals ?? 0,
    vulnerabilityHandled: overrides.vulnerabilityHandled ?? false,
    tags: overrides.tags ?? [],
  };
}

describe("buildPersonaReport", () => {
  it("aggregates transcript metrics, per-persona action counts, and failure modes", () => {
    const report = buildPersonaReport({
      runId: "persona-run-1",
      createdAt: new Date("2026-06-13T14:05:00.000Z"),
      planner,
      transcriptOutputPath: "artifacts/personas.jsonl",
      transcripts: [
        transcript({
          transcriptId: "transcript-1",
          scenarioId: "cooperative-answer",
          persona: cooperative,
          finalAction: "answer",
        }),
        transcript({
          transcriptId: "transcript-2",
          scenarioId: "vulnerable-handoff",
          persona: vulnerable,
          finalAction: "request_handoff_intake",
          validatorOverrideCount: 1,
          caughtUnsafeProposals: 1,
          vulnerabilityHandled: true,
          turns: [
            turn({
              turnIndex: 0,
              userMessage: "I am not sure what to do.",
              botMessage: "What do you need help with?",
              proposedAction: "ask_clarifying_question",
              finalAction: "ask_clarifying_question",
              selectedServingMode: null,
              retrievedItemIds: [],
              traceId: "trace-clarify",
              requestRef: "request-clarify",
            }),
            turn({
              turnIndex: 1,
              userMessage: "I lost my job and cannot afford repayments.",
              botMessage: "I can pass this to the LoanSlam team.",
              proposedAction: "answer",
              finalAction: "request_handoff_intake",
              selectedServingMode: "route_vulnerability",
              selectedRouteReason: "Hardship should be handled by a person.",
              safetyFlags: ["vulnerability", "hardship"],
              validatorOverrideCodes: ["vulnerability_route_match"],
              retrievedItemIds: ["repayment-difficulty"],
              traceId: "trace-handoff",
              requestRef: "request-handoff",
            }),
          ],
        }),
      ],
    });

    expect(report).toEqual(
      expect.objectContaining({
        runId: "persona-run-1",
        createdAt: "2026-06-13T14:05:00.000Z",
        planner,
        policyVersion,
        transcriptOutputPath: "artifacts/personas.jsonl",
        metrics: expect.objectContaining({
          transcriptCount: 2,
          turnCount: 3,
          personaCount: 2,
          answerRate: 1 / 3,
          handoffRate: 1 / 3,
          clarificationRate: 1 / 3,
          validatorOverrideRate: 1 / 3,
          caughtUnsafeProposals: 1,
          vulnerabilityHandledCount: 1,
        }),
        perPersonaActionCounts: {
          cooperative: { answer: 1 },
          vulnerable: {
            ask_clarifying_question: 1,
            request_handoff_intake: 1,
          },
        },
        failureModes: expect.arrayContaining([
          "vulnerable-handoff: caught unsafe proposals 1",
          "vulnerable-handoff: vulnerability_route_match",
        ]),
      }),
    );
  });
});
