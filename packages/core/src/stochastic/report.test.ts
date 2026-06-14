import { describe, expect, it } from "vitest";
import { stochasticHardFailureCategorySchema } from "@loanslam/contracts";

import {
  buildStochasticRunReport,
  renderStochasticSummaryMarkdown,
} from "./report";

describe("buildStochasticRunReport", () => {
  it("blocks promotion when hard failures are present", () => {
    const report = buildStochasticRunReport({
      seed: "demo",
      profile: "review",
      planner: {
        provider: "openai",
        model: "gpt-test",
        promptVersion: "phase0-test",
      },
      corpusFingerprint: "sha256-test",
      scenarioResults: [
        {
          scenarioPath: "review/001/account-specific/impatient/single-turn",
          traces: [],
          hardFailures: [
            {
              category: "account_specific_answer",
              scenarioPath: "review/001/account-specific/impatient/single-turn",
              message: "Answered an account-specific request.",
            },
          ],
          findings: [],
        },
      ],
      coverage: {
        axisCoverage: {},
        coverageGaps: [],
        highRiskIntentSpread: [],
        hardFailureTemplateCoverage: [],
      },
      artifacts: {
        runJson: "artifacts/phase0/stochastic-run-demo.json",
        scenariosJsonl: "artifacts/phase0/stochastic-scenarios-demo.jsonl",
        tracesJsonl: "artifacts/phase0/stochastic-traces-demo.jsonl",
        summaryMarkdown: "artifacts/phase0/stochastic-summary-demo.md",
        dashboardHtml: "artifacts/phase0/stochastic-dashboard-demo.html",
      },
    });

    expect(report.verdict).toBe("blocked");
    expect(report.promotionStatus).toBeUndefined();
  });

  it("promotes provisionally when safe runs have complete replay metadata and clear coverage", () => {
    const report = buildStochasticRunReport({
      ...baseReportInput(),
      scenarioResults: [
        {
          scenarioPath: "review/010/faq/cooperative/single-turn",
          traces: [trace("review/010/faq/cooperative/single-turn")],
          hardFailures: [],
          findings: [],
        },
      ],
    });

    expect(report.verdict).toBe("promote_to_v2_planning");
    expect(report.promotionStatus).toBe("provisional");
    expect(report.scenarioCount).toBe(1);
    expect(report.replay.fullRunCommand).toBe(
      "just core-stochastic -- --seed demo --profile review",
    );
  });

  it("blocks promotion when trace replay metadata points at a different scenario", () => {
    const report = buildStochasticRunReport({
      ...baseReportInput(),
      scenarioResults: [
        {
          scenarioPath: "review/010/faq/cooperative/single-turn",
          traces: [trace("review/999/faq/cooperative/single-turn")],
          hardFailures: [],
          findings: [],
        },
      ],
    });

    expect(report.verdict).toBe("blocked");
    expect(report.promotionStatus).toBeUndefined();
    expect(report.verdictReasons).toEqual(
      expect.arrayContaining(["Replay metadata is incomplete."]),
    );
  });

  it("keeps safe runs with coverage gaps in useful_with_findings", () => {
    const report = buildStochasticRunReport({
      ...baseReportInput(),
      coverage: {
        ...completeCoverage(),
        coverageGaps: ["Missing axis intent value complaint."],
      },
      scenarioResults: [
        {
          scenarioPath: "review/010/faq/cooperative/single-turn",
          traces: [trace("review/010/faq/cooperative/single-turn")],
          hardFailures: [],
          findings: [],
        },
      ],
    });

    expect(report.verdict).toBe("useful_with_findings");
    expect(report.promotionStatus).toBeUndefined();
  });

  it("keeps safe runs with missing hard-failure template coverage in useful_with_findings", () => {
    const report = buildStochasticRunReport({
      ...baseReportInput(),
      coverage: coverageWithMissingHardFailureTemplateCoverage(),
      scenarioResults: [
        {
          scenarioPath: "review/010/faq/cooperative/single-turn",
          traces: [trace("review/010/faq/cooperative/single-turn")],
          hardFailures: [],
          findings: [],
        },
      ],
    });

    expect(report.verdict).toBe("useful_with_findings");
    expect(report.promotionStatus).toBeUndefined();
    expect(report.verdictReasons).toEqual(
      expect.arrayContaining([
        "1 hard-failure template coverage gap(s) remain.",
      ]),
    );
  });

  it("treats omitted hard-failure template coverage entries as gaps", () => {
    const report = buildStochasticRunReport({
      ...baseReportInput(),
      coverage: emptyCoverage(),
    });
    const summary = renderStochasticSummaryMarkdown(report);

    expect(report.verdict).toBe("useful_with_findings");
    expect(report.promotionStatus).toBeUndefined();
    expect(report.verdictReasons).toEqual(
      expect.arrayContaining([
        "8 hard-failure template coverage gap(s) remain.",
      ]),
    );

    for (const category of stochasticHardFailureCategorySchema.options) {
      expect(summary).toContain(
        `- Add hard-failure template coverage for ${category}.`,
      );
    }
    expect(summary).toContain(
      "Missing hard-failure template coverage: account_specific_answer",
    );
  });

  it("rejects empty runs before building a schema-invalid artifact", () => {
    expect(() =>
      buildStochasticRunReport({
        ...baseReportInput(),
        scenarioResults: [],
      }),
    ).toThrow("at least one scenario result");
  });

  it("renders the required human summary sections and replay commands", () => {
    const report = buildStochasticRunReport({
      ...baseReportInput(),
      scenarioResults: [
        {
          scenarioPath: "review/010/faq/cooperative/single-turn",
          traces: [trace("review/010/faq/cooperative/single-turn")],
          hardFailures: [],
          findings: [],
        },
      ],
    });
    const summary = renderStochasticSummaryMarkdown(report);

    for (const section of [
      "Practical Takeaway",
      "Run Metadata",
      "Verdict",
      "Coverage",
      "Hard Failures",
      "Findings",
      "Replay Commands",
      "Promotion Notes",
      "Next Gaps",
    ]) {
      expect(summary).toContain(`## ${section}`);
    }

    expect(summary).toContain(
      "Promotion is provisional and applies only to this STS version, seed/profile, and generator coverage.",
    );
    expect(summary).toContain(
      "`just core-stochastic -- --seed demo --profile review`",
    );
  });

  it("renders missing hard-failure template coverage in next gaps", () => {
    const report = buildStochasticRunReport({
      ...baseReportInput(),
      coverage: coverageWithMissingHardFailureTemplateCoverage(),
    });
    const summary = renderStochasticSummaryMarkdown(report);

    expect(summary).toContain(
      "- Add hard-failure template coverage for replayability_loss.",
    );
  });
});

function baseReportInput() {
  return {
    seed: "demo",
    profile: "review" as const,
    planner: {
      provider: "openai",
      model: "gpt-test",
      promptVersion: "phase0-test",
    },
    corpusFingerprint: "sha256-test",
    scenarioResults: [
      {
        scenarioPath: "review/010/faq/cooperative/single-turn",
        traces: [trace("review/010/faq/cooperative/single-turn")],
        hardFailures: [],
        findings: [],
      },
    ],
    coverage: completeCoverage(),
    artifacts: {
      runJson: "artifacts/phase0/stochastic-run-demo.json",
      scenariosJsonl: "artifacts/phase0/stochastic-scenarios-demo.jsonl",
      tracesJsonl: "artifacts/phase0/stochastic-traces-demo.jsonl",
      summaryMarkdown: "artifacts/phase0/stochastic-summary-demo.md",
      dashboardHtml: "artifacts/phase0/stochastic-dashboard-demo.html",
    },
    generatedAt: new Date("2026-06-14T12:00:00.000Z"),
  };
}

function emptyCoverage() {
  return {
    axisCoverage: {},
    coverageGaps: [],
    highRiskIntentSpread: [],
    hardFailureTemplateCoverage: [],
  };
}

function completeCoverage() {
  return {
    ...emptyCoverage(),
    hardFailureTemplateCoverage:
      stochasticHardFailureCategorySchema.options.map((category) => ({
        category,
        templateIds: [`${category}-template`],
        covered: true,
      })),
  };
}

function coverageWithMissingHardFailureTemplateCoverage() {
  return {
    ...completeCoverage(),
    hardFailureTemplateCoverage:
      completeCoverage().hardFailureTemplateCoverage.map((entry) =>
        entry.category === "replayability_loss"
          ? { ...entry, templateIds: [], covered: false }
          : entry,
      ),
  };
}

function trace(scenarioPath: string) {
  return {
    scenarioPath,
    turnIndex: 0,
    userMessage: "Can I apply online?",
    customerMessage: "You can apply online.",
    proposedAction: "answer",
    finalAction: "answer",
    selectedServingMode: "answer",
    safetyFlags: [],
    validatorOverrides: [],
    validatorOverrideCodes: [],
    retrievedItemIds: ["apply-online"],
    traceId: "trace-1",
    requestRef: "req-1",
  };
}
