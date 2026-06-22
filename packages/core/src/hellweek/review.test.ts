import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type {
  PlannerMetadata,
  TurnPlan,
  TurnPlanner,
} from "@loanslam/contracts";

import { runHellWeekReviewOrchestration } from "./review";
import type { OpenAiHellWeekJudgeClient } from "./openaiJudge";

const metadata: PlannerMetadata = {
  provider: "openai",
  model: "test-planner",
  promptVersion: "test-prompt",
};

const safePlan: TurnPlan = {
  action: "answer",
  customerMessage:
    "I can help with general LoanSlam information, but please do not send passwords or account details here.",
  ui: {
    primitive: "message",
    message:
      "I can help with general LoanSlam information, but please do not send passwords or account details here.",
    links: [],
  },
  reasonCode: "grounded_answer",
  collectedFacts: {},
  requestedFields: [],
  grounding: {
    citedItemIds: [],
    servingMode: "answer",
    confidence: "supported",
  },
  safetyFlags: [],
  traceSummary: "Returned a generic safe answer.",
};

describe("Hell Week review-tier orchestration", () => {
  it("captures, ladder-judges, and regrades the full review tier", async () => {
    const outBaseDir = mkdtempSync(join(tmpdir(), "hell-week-review-"));

    try {
      const judgeCalls: string[] = [];
      const artifacts = await runHellWeekReviewOrchestration({
        profile: "full",
        corpus: [],
        planner: planner(),
        outBaseDir,
        judgeModel: "gpt-5.4-mini-test",
        verifierModel: "gpt-5.4-test",
        finalAdjudicatorModel: "gpt-5.5-test",
        judgeClient: fakeJudgeClient(judgeCalls),
        now: () => new Date("2026-06-22T10:00:00.000Z"),
      });

      const deterministic = JSON.parse(
        readFileSync(artifacts.deterministicReportJsonPath, "utf8"),
      );
      const finalReport = JSON.parse(
        readFileSync(artifacts.reportJsonPath, "utf8"),
      );
      const orchestration = JSON.parse(
        readFileSync(artifacts.orchestrationJsonPath, "utf8"),
      );

      expect(existsSync(artifacts.judgeVerdictsPath)).toBe(true);
      expect(deterministic).toMatchObject({
        profile: "full",
        judged: false,
      });
      expect(finalReport).toMatchObject({
        profile: "full",
        judged: true,
        judge: {
          mode: "ladder",
          model:
            "gpt-5.4-mini-test judge, gpt-5.4-test verifier, gpt-5.5-test final adjudicator",
          judgeModel: "gpt-5.4-mini-test",
          verifierModel: "gpt-5.4-test",
          finalAdjudicatorModel: "gpt-5.5-test",
          rubricHash: expect.stringMatching(/^sha256:/),
        },
      });
      expect(orchestration).toMatchObject({
        command: "hell-week-review",
        profile: "full",
        reviewTierProfile: "full",
        mode: "ladder",
        stages: {
          deterministicCapture: {
            snapshotJsonPath: artifacts.deterministicReportJsonPath,
          },
          ladderJudge: {
            verdictsPath: artifacts.judgeVerdictsPath,
            model: "gpt-5.4-mini-test",
            verifierModel: "gpt-5.4-test",
            finalAdjudicatorModel: "gpt-5.5-test",
          },
          regrade: {
            judged: true,
            reportJsonPath: artifacts.reportJsonPath,
          },
        },
      });
      expect(judgeCalls).toContain("judge");
      expect(judgeCalls).toContain("verify");
    } finally {
      rmSync(outBaseDir, { recursive: true, force: true });
    }
  });

  it("rejects non-review-tier profiles", async () => {
    await expect(
      runHellWeekReviewOrchestration({
        profile: "smoke",
        corpus: [],
        planner: planner(),
        outBaseDir: mkdtempSync(join(tmpdir(), "hell-week-review-reject-")),
        judgeModel: "gpt-5.4-mini-test",
        verifierModel: "gpt-5.4-test",
        finalAdjudicatorModel: "gpt-5.5-test",
        judgeClient: fakeJudgeClient([]),
      }),
    ).rejects.toThrow(/review-tier orchestration uses profile "full"/);
  });
});

function planner(): TurnPlanner & { metadata: PlannerMetadata } {
  return {
    metadata,
    async planTurn() {
      return safePlan;
    },
  };
}

function fakeJudgeClient(phases: string[]): OpenAiHellWeekJudgeClient {
  return {
    responses: {
      async parse(request) {
        phases.push(request.metadata.phase);
        return {
          output_parsed: {
            scenarioId: request.metadata.scenarioId,
            pass: true,
            severity: "fine",
            triageLabels: [],
            uxScore: 5,
            rationale: "Safe judged behavior.",
            confidence: 0.99,
          },
        };
      },
    },
  };
}
