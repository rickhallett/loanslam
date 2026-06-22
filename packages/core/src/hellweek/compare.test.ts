import { describe, expect, it } from "vitest";

import {
  compareHellWeekReports,
  formatHellWeekComparison,
  toHellWeekComparisonJson,
} from "./compare";

describe("Hell Week comparison comparability", () => {
  it("warns when run metadata differs before making a recommendation", () => {
    const comparison = compareHellWeekReports(
      report("baseline", {
        profile: "full",
        plannerModel: "planner-a",
        plannerPrompt: "planner-prompt-a",
        signalModel: "signal-a",
        signalPrompt: "signal-prompt-a",
        policyVersion: "policy-a",
        judged: false,
        scenarioIds: ["one", "two"],
      }),
      report("candidate", {
        profile: "smoke",
        plannerModel: "planner-b",
        plannerPrompt: "planner-prompt-b",
        signalModel: "signal-b",
        signalPrompt: "signal-prompt-b",
        policyVersion: "policy-b",
        judged: true,
        scenarioIds: ["one"],
      }),
    );

    expect(comparison.comparability.compatible).toBe(false);
    expect(
      comparison.comparability.warnings.map((warning) => warning.field),
    ).toEqual([
      "profile",
      "scenario_set",
      "planner_model",
      "planner_prompt",
      "signal_model",
      "signal_prompt",
      "policy_version",
      "judged_state",
    ]);

    const text = formatHellWeekComparison(comparison);
    expect(text.indexOf("Comparability warnings:")).toBeGreaterThan(-1);
    expect(text.indexOf("Comparability warnings:")).toBeLessThan(
      text.indexOf("Recommendation:"),
    );

    expect(toHellWeekComparisonJson(comparison)).toMatchObject({
      baseline: {
        planner: { model: "planner-a", promptVersion: "planner-prompt-a" },
        signalExtractor: {
          model: "signal-a",
          promptVersion: "signal-prompt-a",
        },
        policyVersion: "policy-a",
        judged: false,
      },
      candidate: {
        planner: { model: "planner-b", promptVersion: "planner-prompt-b" },
        signalExtractor: {
          model: "signal-b",
          promptVersion: "signal-prompt-b",
        },
        policyVersion: "policy-b",
        judged: true,
      },
    });
  });

  it("warns when judged runs use different judge metadata", () => {
    const comparison = compareHellWeekReports(
      report("baseline", {
        profile: "full",
        plannerModel: "planner-a",
        plannerPrompt: "planner-prompt-a",
        signalModel: "signal-a",
        signalPrompt: "signal-prompt-a",
        policyVersion: "policy-a",
        judged: true,
        judge: {
          artifactSchemaVersion: 1,
          provider: "workflow",
          mode: "single_model",
          model: "judge-a",
          verifierModel: "verifier-a",
          finalAdjudicatorModel: "final-a",
          tool: "tool-a",
          promptVersion: "judge-prompt-a",
          rubricHash: "sha256:rubric-a",
          scenarioCount: 2,
          verdictCount: 2,
        },
        scenarioIds: ["one", "two"],
      }),
      report("candidate", {
        profile: "full",
        plannerModel: "planner-a",
        plannerPrompt: "planner-prompt-a",
        signalModel: "signal-a",
        signalPrompt: "signal-prompt-a",
        policyVersion: "policy-a",
        judged: true,
        judge: {
          artifactSchemaVersion: 2,
          provider: "workflow-v2",
          mode: "ladder",
          model: "judge-b",
          verifierModel: "verifier-b",
          finalAdjudicatorModel: "final-b",
          tool: "tool-b",
          promptVersion: "judge-prompt-b",
          rubricHash: "sha256:rubric-b",
          scenarioCount: 1,
          verdictCount: 1,
        },
        scenarioIds: ["one", "two"],
      }),
    );

    expect(
      comparison.comparability.warnings.map((warning) => warning.field),
    ).toEqual([
      "judge_artifact_schema",
      "judge_provider",
      "judge_mode",
      "judge_model",
      "judge_verifier_model",
      "judge_final_model",
      "judge_tool",
      "judge_prompt",
      "judge_rubric_hash",
      "judge_scenario_count",
      "judge_verdict_count",
    ]);

    expect(toHellWeekComparisonJson(comparison)).toMatchObject({
      baseline: {
        judge: {
          artifactSchemaVersion: 1,
          mode: "single_model",
          model: "judge-a",
          verifierModel: "verifier-a",
          finalAdjudicatorModel: "final-a",
          promptVersion: "judge-prompt-a",
          rubricHash: "sha256:rubric-a",
          verdictCount: 2,
        },
      },
      candidate: {
        judge: {
          artifactSchemaVersion: 2,
          mode: "ladder",
          model: "judge-b",
          verifierModel: "verifier-b",
          finalAdjudicatorModel: "final-b",
          promptVersion: "judge-prompt-b",
          rubricHash: "sha256:rubric-b",
          verdictCount: 1,
        },
      },
    });
  });

  it("keeps old judged reports without judge metadata comparable", () => {
    const comparison = compareHellWeekReports(
      report("baseline", {
        profile: "full",
        plannerModel: "planner-a",
        plannerPrompt: "planner-prompt-a",
        signalModel: "signal-a",
        signalPrompt: "signal-prompt-a",
        policyVersion: "policy-a",
        judged: true,
        scenarioIds: ["one"],
      }),
      report("candidate", {
        profile: "full",
        plannerModel: "planner-a",
        plannerPrompt: "planner-prompt-a",
        signalModel: "signal-a",
        signalPrompt: "signal-prompt-a",
        policyVersion: "policy-a",
        judged: true,
        scenarioIds: ["one"],
      }),
    );

    expect(comparison.comparability.compatible).toBe(true);
    expect(comparison.comparability.warnings).toEqual([]);
  });
});

function report(
  runId: string,
  options: {
    profile: string;
    plannerModel: string;
    plannerPrompt: string;
    signalModel: string;
    signalPrompt: string;
    policyVersion: string;
    judged: boolean;
    judge?: {
      artifactSchemaVersion?: number;
      provider?: string;
      mode?: string;
      model?: string;
      judgeModel?: string;
      verifierModel?: string;
      finalAdjudicatorModel?: string;
      tool?: string;
      promptVersion?: string;
      rubricHash?: string;
      scenarioCount?: number;
      verdictCount: number;
    };
    scenarioIds: string[];
  },
) {
  const grades = options.scenarioIds.map((scenarioId) => ({
    scenarioId,
    title: scenarioId,
    dimension: "clarification",
    pass: true,
    severity: "fine" as const,
    triageLabels: [],
    rationale: "Passed.",
  }));

  return {
    path: `memory:${runId}`,
    report: {
      runId,
      generatedAt: "2026-06-20T10:00:00.000Z",
      profile: options.profile,
      planner: {
        provider: "openai",
        model: options.plannerModel,
        promptVersion: options.plannerPrompt,
      },
      signalExtractor: {
        enabled: true,
        model: options.signalModel,
        promptVersion: options.signalPrompt,
      },
      policyVersion: options.policyVersion,
      judged: options.judged,
      ...(options.judge ? { judge: options.judge } : {}),
      durationMs: 1000,
      runtime: {
        scenarioWallTimeMs: runtimeStat(1000),
        signalLatencyMs: runtimeStat(50),
        plannerLatencyMs: runtimeStat(75),
      },
      verdict: "ship_ready" as const,
      totals: {
        scenarios: grades.length,
        passed: grades.length,
        failed: 0,
        passRate: 1,
        demoKillers: 0,
        dents: 0,
        fine: grades.length,
        errored: 0,
      },
      safetyFloor: {
        pass: grades.length,
        total: grades.length,
        breached: false,
      },
      deflection: {
        answered: 0,
        total: 0,
        rate: 0,
      },
      routingPrecision: {
        inScopeScenarios: grades.length,
        misroutes: 0,
        rate: 1,
        signalTurns: 0,
        signalAgreements: 0,
        signalAgreementRate: 0,
      },
      uxQuality: {
        scored: 0,
        averageScore: null,
      },
      grades,
    },
  };
}

function runtimeStat(value: number) {
  return {
    count: 1,
    missing: 0,
    totalMs: value,
    averageMs: value,
    medianMs: value,
    p95Ms: value,
    maxMs: value,
  };
}
