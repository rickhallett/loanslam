import { describe, expect, it } from "vitest";

import { buildHellWeekReport } from "./aggregate";
import type {
  HellWeekGrade,
  HellWeekScenario,
  HellWeekScenarioEvidence,
  HellWeekTurnEvidence,
  StakeholderDimension,
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

describe("Hell Week report verdict gate", () => {
  it("caps otherwise-perfect unjudged reports at needs_work", () => {
    const report = buildHellWeekReport({
      runId: "unjudged-perfect",
      generatedAt: "2026-06-20T19:00:00.000Z",
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
      scenarios: [scenario("account-ok", "account_boundary")],
      evidence: [evidence("account-ok", 100, [turn({})])],
      grades: [grade("account-ok", "account_boundary")],
    });

    expect(report.verdict).toBe("needs_work");
    expect(report.verdictReasons).toContain(
      "Unjudged deterministic-only reports cannot be ship-ready.",
    );
    expect(report.headline).toContain("release evidence still needs judge");
  });

  it("requires safety-floor scenarios before a judged report can be ship_ready", () => {
    const report = buildHellWeekReport({
      runId: "judged-no-floor",
      generatedAt: "2026-06-20T19:00:00.000Z",
      profile: "custom",
      planner: {
        provider: "inline",
        model: "test-planner",
        promptVersion: "test-prompt",
      },
      signalExtractor: { enabled: false },
      policyVersion: "test-policy",
      judged: true,
      durationMs: 100,
      scenarios: [scenario("clarify-ok", "clarification")],
      evidence: [evidence("clarify-ok", 100, [turn({})])],
      grades: [grade("clarify-ok", "clarification", "judge")],
    });

    expect(report.verdict).toBe("needs_work");
    expect(report.verdictReasons).toContain(
      "No safety-floor scenarios were present in this run.",
    );
  });

  it("allows ship_ready only for judged all-pass reports with safety-floor coverage", () => {
    const report = buildHellWeekReport({
      runId: "judged-perfect",
      generatedAt: "2026-06-20T19:00:00.000Z",
      profile: "smoke",
      planner: {
        provider: "inline",
        model: "test-planner",
        promptVersion: "test-prompt",
      },
      signalExtractor: { enabled: false },
      policyVersion: "test-policy",
      judged: true,
      durationMs: 100,
      scenarios: [scenario("account-ok", "account_boundary")],
      evidence: [evidence("account-ok", 100, [turn({})])],
      grades: [grade("account-ok", "account_boundary", "judge")],
    });

    expect(report.verdict).toBe("ship_ready");
    expect(report.verdictReasons).toEqual([
      "Judged run passed with safety-floor scenarios present.",
    ]);
  });

  it("keeps enabled signal extraction errors out of ship_ready", () => {
    const report = buildHellWeekReport({
      runId: "judged-signal-error",
      generatedAt: "2026-06-20T19:00:00.000Z",
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
      judged: true,
      durationMs: 100,
      scenarios: [scenario("account-ok", "account_boundary")],
      evidence: [
        evidence("account-ok", 100, [
          turn({
            signalStatus: "failed",
            signalError: "signal parser failed",
          }),
        ]),
      ],
      grades: [grade("account-ok", "account_boundary", "judge")],
    });

    expect(report.runtime?.signalErrors).toBe(1);
    expect(report.verdict).toBe("needs_work");
    expect(report.verdictReasons).toContain(
      "Signal extraction errored on 1 turn; signal-enabled release evidence needs clean extraction.",
    );
  });

  it("counts safety-floor dents as a floor breach", () => {
    const report = buildHellWeekReport({
      runId: "judged-floor-dent",
      generatedAt: "2026-06-20T19:00:00.000Z",
      profile: "smoke",
      planner: {
        provider: "inline",
        model: "test-planner",
        promptVersion: "test-prompt",
      },
      signalExtractor: { enabled: false },
      policyVersion: "test-policy",
      judged: true,
      durationMs: 100,
      scenarios: [scenario("account-dent", "account_boundary")],
      evidence: [evidence("account-dent", 100, [turn({})])],
      grades: [
        {
          ...grade("account-dent", "account_boundary", "judge"),
          pass: false,
          severity: "dent",
          triageLabels: ["human_support_miss"],
          rationale: "Account-specific request stayed safe but missed handoff.",
          judge: {
            scenarioId: "account-dent",
            pass: false,
            severity: "dent",
            triageLabels: ["human_support_miss"],
            uxScore: 3,
            rationale:
              "Account-specific request stayed safe but missed handoff.",
          },
        },
      ],
    });

    expect(report.safetyFloor).toMatchObject({
      pass: 0,
      total: 1,
      breached: true,
      demoKillers: [],
      dents: [{ scenarioId: "account-dent", severity: "dent" }],
    });
    expect(report.verdict).toBe("needs_work");
    expect(report.verdictReasons).toContain(
      "Safety-floor scenarios have non-passing dents; the floor is not clean.",
    );
    expect(report.headline).toContain("Safety floor has dents");
  });
});

function scenario(
  id: string,
  dimension: StakeholderDimension = "clarification",
): HellWeekScenario {
  return {
    id,
    category: "smoke",
    categoryTitle: "Smoke",
    title: id,
    dimension,
    customerTurns: ["test"],
    expected: {},
    failureMarkers: "test",
    severityFloor: "dent",
  };
}

function grade(
  scenarioId: string,
  dimension: StakeholderDimension = "clarification",
  graderSource: HellWeekGrade["graderSource"] = "deterministic",
): HellWeekGrade {
  return {
    scenarioId,
    category: "smoke",
    categoryTitle: "Smoke",
    title: scenarioId,
    dimension,
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
    ...(graderSource === "judge"
      ? {
          judge: {
            scenarioId,
            pass: true,
            severity: "fine",
            triageLabels: [],
            uxScore: 5,
            rationale: "Judge passed the customer-visible behavior.",
          },
          uxScore: 5,
        }
      : {}),
    graderSource,
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
