import type { StochasticRunArtifact } from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { renderStochasticDashboardHtml } from "./htmlReport";

describe("renderStochasticDashboardHtml", () => {
  it("renders a self-contained stakeholder dashboard with run metrics", () => {
    const html = renderStochasticDashboardHtml(report());

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("LoanSlam Phase 0 Stochastic Test Simulator");
    expect(html).toContain("Hard failures");
    expect(html).toContain("Coverage");
    expect(html).toContain("Review Queue");
    expect(html).toContain(
      "just core-stochastic -- --seed demo --profile review",
    );
  });

  it("escapes dynamic report content before embedding it in HTML", () => {
    const html = renderStochasticDashboardHtml({
      ...report(),
      seed: '<script>alert("bad")</script>',
      verdictReasons: ["<b>unsafe</b>"],
    });

    expect(html).toContain(
      "&lt;script&gt;alert(&quot;bad&quot;)&lt;/script&gt;",
    );
    expect(html).not.toContain('<script>alert("bad")</script>');
  });
});

function report(): StochasticRunArtifact {
  return {
    seed: "demo",
    profile: "review",
    stsVersion: "sts-v1",
    templateSetVersion: "sts-templates-v1",
    policyVersion: "phase0-turnplanner-policy-v1",
    corpusFingerprint: "sha256:test",
    generatedAt: "2026-06-14T12:00:00.000Z",
    planner: {
      provider: "openai",
      model: "gpt-test",
      promptVersion: "phase0-test",
    },
    scenarioCount: 24,
    artifacts: {
      runJson: "artifacts/phase0/stochastic-run-demo.json",
      scenariosJsonl: "artifacts/phase0/stochastic-scenarios-demo.jsonl",
      tracesJsonl: "artifacts/phase0/stochastic-traces-demo.jsonl",
      summaryMarkdown: "artifacts/phase0/stochastic-summary-demo.md",
      dashboardHtml: "artifacts/phase0/stochastic-dashboard-demo.html",
    },
    verdict: "useful_with_findings",
    verdictReasons: ["No hard failures observed."],
    hardFailures: [],
    findings: [
      {
        category: "diagnostic_gap",
        message: "Needs engineer review.",
        scenarioPath: "review/001/faq/cooperative/single-turn",
        replayCommand:
          "just core-stochastic -- --seed demo --profile review --scenario review/001/faq/cooperative/single-turn",
      },
    ],
    coverage: {
      axisCoverage: {
        intent: {
          coveredValues: ["faq", "account_specific"],
          missingValues: [
            "vulnerability",
            "complaint",
            "excluded",
            "ambiguous",
          ],
          sampleCount: 24,
        },
      },
      coverageGaps: ["Missing axis intent value vulnerability."],
      highRiskIntentSpread: [],
      hardFailureTemplateCoverage: [
        {
          category: "account_specific_answer",
          templateIds: ["account-specific-template"],
          covered: true,
        },
        {
          category: "replayability_loss",
          templateIds: [],
          covered: false,
        },
      ],
    },
    replay: {
      fullRunCommand: "just core-stochastic -- --seed demo --profile review",
      topFindingCommands: [
        "just core-stochastic -- --seed demo --profile review --scenario review/001/faq/cooperative/single-turn",
      ],
      hardFailureCommands: [],
    },
  };
}
