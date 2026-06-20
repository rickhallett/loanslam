import { describe, expect, it } from "vitest";

import { buildHellWeekStabilityReport } from "./stability";
import type { HellWeekGrade, HellWeekReport, HellWeekScenario } from "./types";

const scenarios: HellWeekScenario[] = [
  scenario("stable-pass", "Stable pass"),
  scenario("stable-failure", "Stable failure"),
  scenario("recurring", "Recurring failure"),
  scenario("one-off", "One-off failure"),
];

describe("Hell Week stability report", () => {
  it("classifies repeated-run scenario outcomes", () => {
    const report = buildHellWeekStabilityReport({
      setId: "iteration-stability",
      runs: [
        run("run-1", [
          grade("stable-pass", true, "fine"),
          grade("stable-failure", false, "dent"),
          grade("recurring", false, "dent"),
          grade("one-off", false, "dent"),
        ]),
        run("run-2", [
          grade("stable-pass", true, "fine"),
          grade("stable-failure", false, "dent"),
          grade("recurring", false, "dent"),
          grade("one-off", true, "fine"),
        ]),
        run("run-3", [
          grade("stable-pass", true, "fine"),
          grade("stable-failure", false, "dent"),
          grade("recurring", true, "fine"),
          grade("one-off", true, "fine"),
        ]),
      ],
      now: () => new Date("2026-06-20T10:30:00.000Z"),
    });

    expect(report.summary).toEqual({
      stablePass: 1,
      stableFailure: 1,
      recurringFailure: 1,
      oneOffFailure: 1,
      mixed: 0,
    });
    expect(classification(report, "stable-pass")).toBe("stable_pass");
    expect(classification(report, "stable-failure")).toBe("stable_failure");
    expect(classification(report, "recurring")).toBe("recurring_failure");
    expect(classification(report, "one-off")).toBe("one_off_failure");
    expect(report.pairwiseComparisons).toHaveLength(2);
  });
});

function classification(
  report: ReturnType<typeof buildHellWeekStabilityReport>,
  scenarioId: string,
) {
  return report.scenarios.find((scenario) => scenario.scenarioId === scenarioId)
    ?.classification;
}

function scenario(id: string, title: string): HellWeekScenario {
  return {
    id,
    category: "smoke",
    categoryTitle: "Smoke",
    title,
    dimension: "clarification",
    customerTurns: ["test"],
    expected: {},
    failureMarkers: "test",
    severityFloor: "dent",
  };
}

function grade(
  scenarioId: string,
  pass: boolean,
  severity: HellWeekGrade["severity"],
): HellWeekGrade {
  const scenario = scenarios.find((item) => item.id === scenarioId);

  if (!scenario) {
    throw new Error(`Unknown scenario ${scenarioId}.`);
  }

  return {
    scenarioId,
    category: scenario.category,
    categoryTitle: scenario.categoryTitle,
    title: scenario.title,
    dimension: scenario.dimension,
    deterministic: {
      envelopeFailures: [],
      contentViolations: [],
      hardSafetyViolations: [],
      triageLabels: pass ? [] : ["test_failure"],
      severity,
      pass,
    },
    pass,
    severity,
    triageLabels: pass ? [] : ["test_failure"],
    rationale: pass ? "Passed." : "Failed.",
    hardFloorTriggered: false,
    graderSource: "deterministic",
  };
}

function run(runId: string, grades: HellWeekGrade[]): HellWeekReport {
  const passed = grades.filter((item) => item.pass).length;
  const failed = grades.length - passed;
  const dents = grades.filter((item) => item.severity === "dent").length;
  const fine = grades.filter((item) => item.severity === "fine").length;

  return {
    runId,
    generatedAt: "2026-06-20T10:00:00.000Z",
    profile: "smoke",
    planner: {
      provider: "test",
      model: "test",
      promptVersion: "test",
    },
    signalExtractor: { enabled: false },
    policyVersion: "test",
    judged: false,
    durationMs: 1,
    verdict: failed > 0 ? "needs_work" : "ship_ready",
    headline: "test",
    totals: {
      scenarios: grades.length,
      passed,
      failed,
      passRate: passed / grades.length,
      demoKillers: 0,
      dents,
      fine,
      errored: 0,
    },
    safetyFloor: {
      pass: passed,
      total: grades.length,
      breached: false,
      dimensions: [],
      demoKillers: [],
    },
    deflection: {
      answered: 0,
      total: 0,
      rate: 0,
      leaked: [],
    },
    routingPrecision: {
      inScopeScenarios: grades.length,
      misroutes: failed,
      rate: passed / grades.length,
      signalTurns: 0,
      signalAgreements: 0,
      signalAgreementRate: 0,
    },
    uxQuality: {
      scored: 0,
      averageScore: null,
    },
    categories: [],
    dimensions: [],
    severityCounts: {
      demo_killer: 0,
      dent: dents,
      fine,
    },
    triageCounts: [],
    topRisks: [],
    grades,
    evidence: grades.map((item) => ({
      scenarioId: item.scenarioId,
      conversationRef: `hellweek-${item.scenarioId}`,
      turns: [],
      durationMs: 1,
    })),
    scenarios,
  };
}
