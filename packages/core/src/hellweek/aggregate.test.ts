import { describe, expect, it } from "vitest";

import { buildHellWeekReport } from "./aggregate";
import type {
  HellWeekGrade,
  HellWeekScenario,
  HellWeekScenarioEvidence,
  HellWeekTurnEvidence,
} from "./types";

describe("Hell Week aggregate runtime summary", () => {
  it("rolls up scenario, signal, and planner latency with missing counts", () => {
    const report = buildHellWeekReport({
      runId: "runtime-summary",
      generatedAt: "2026-06-20T16:30:00.000Z",
      profile: "smoke",
      planner: {
        provider: "inline",
        model: "test-planner",
        promptVersion: "test-prompt",
      },
      signalExtractor: {
        enabled: true,
        model: "test-signal",
        promptVersion: "test-signal-prompt",
      },
      policyVersion: "test-policy",
      judged: false,
      durationMs: 600,
      scenarios: [scenario("one"), scenario("two"), scenario("three")],
      evidence: [
        evidence("one", 100, [
          turn({ signalLatencyMs: 10, plannerLatencyMs: 100 }),
        ]),
        evidence("two", 200, [
          turn({ signalLatencyMs: 30, plannerLatencyMs: 200 }),
        ]),
        evidence("three", 300, [turn({ plannerLatencyMs: 300 })]),
      ],
      grades: [grade("one"), grade("two"), grade("three")],
    });

    expect(report.runtime).toMatchObject({
      scenarioWallTimeMs: {
        count: 3,
        missing: 0,
        medianMs: 200,
        p95Ms: 300,
        maxMs: 300,
      },
      signalLatencyMs: {
        count: 2,
        missing: 1,
        maxMs: 30,
      },
      plannerLatencyMs: {
        count: 3,
        missing: 0,
        medianMs: 200,
        p95Ms: 300,
        maxMs: 300,
      },
    });
  });

  it("marks turn-level latency as missing when old evidence lacks it", () => {
    const report = buildHellWeekReport({
      runId: "runtime-missing",
      generatedAt: "2026-06-20T16:30:00.000Z",
      profile: "smoke",
      planner: {
        provider: "inline",
        model: "test-planner",
        promptVersion: "test-prompt",
      },
      signalExtractor: { enabled: false },
      policyVersion: "test-policy",
      judged: false,
      durationMs: 100,
      scenarios: [scenario("one")],
      evidence: [evidence("one", 100, [turn({})])],
      grades: [grade("one")],
    });

    expect(report.runtime?.signalLatencyMs).toMatchObject({
      count: 0,
      missing: 1,
      medianMs: null,
    });
    expect(report.runtime?.plannerLatencyMs).toMatchObject({
      count: 0,
      missing: 1,
      medianMs: null,
    });
  });
});

function scenario(id: string): HellWeekScenario {
  return {
    id,
    category: "smoke",
    categoryTitle: "Smoke",
    title: id,
    dimension: "clarification",
    customerTurns: ["test"],
    expected: {},
    failureMarkers: "test",
    severityFloor: "dent",
  };
}

function grade(scenarioId: string): HellWeekGrade {
  return {
    scenarioId,
    category: "smoke",
    categoryTitle: "Smoke",
    title: scenarioId,
    dimension: "clarification",
    deterministic: {
      envelopeFailures: [],
      contentViolations: [],
      hardSafetyViolations: [],
      triageLabels: [],
      severity: "fine",
      pass: true,
    },
    pass: true,
    severity: "fine",
    triageLabels: [],
    rationale: "Passed.",
    hardFloorTriggered: false,
    graderSource: "deterministic",
  };
}

function evidence(
  scenarioId: string,
  durationMs: number,
  turns: HellWeekTurnEvidence[],
): HellWeekScenarioEvidence {
  return {
    scenarioId,
    conversationRef: `hellweek-${scenarioId}`,
    durationMs,
    turns,
  };
}

function turn(partial: Partial<HellWeekTurnEvidence>): HellWeekTurnEvidence {
  return {
    turnIndex: 0,
    userMessage: "test",
    botMessage: "test",
    finalAction: "answer",
    proposedAction: "answer",
    selectedServingMode: "answer",
    effectiveServingMode: "answer",
    routeForScoring: "answer",
    selectedRouteReason: null,
    safetyFlags: [],
    validatorOverrideCodes: [],
    retrieved: [],
    uiPrimitive: "message",
    ...partial,
  };
}
