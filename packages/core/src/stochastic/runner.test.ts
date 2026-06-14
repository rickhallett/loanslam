import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  CorpusItem,
  PlannerMetadata,
  TurnPlanner,
} from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { generateStochasticScenarios } from "./generator";
import { runStochasticTestSimulator } from "./runner";

const plannerMetadata: PlannerMetadata = {
  provider: "inline",
  model: "sts-test-planner",
  promptVersion: "test",
};

describe("runStochasticTestSimulator", () => {
  it("runs a deterministic smoke profile and writes the STS artifacts", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-sts-runner-"));
    const result = await runStochasticTestSimulator({
      seed: "demo",
      profile: "smoke",
      outputDir,
      corpus,
      planner: testPlanner(),
      now: new Date("2026-06-14T12:00:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(result.scenarios).toHaveLength(12);
    expect(result.run.scenarioCount).toBe(12);
    expect(result.run.replay.fullRunCommand).toBe(
      "just core-stochastic -- --seed demo --profile smoke",
    );
    expect(result.run.planner).toEqual(plannerMetadata);
    expect(result.paths.runJson).toBe(
      join(outputDir, "stochastic-run-demo.json"),
    );

    const runJson = JSON.parse(readFileSync(result.paths.runJson, "utf8"));
    const scenarioLines = readFileSync(result.paths.scenariosJsonl, "utf8")
      .trim()
      .split("\n");
    const traceLines = readFileSync(result.paths.tracesJsonl, "utf8")
      .trim()
      .split("\n");

    expect(runJson.scenarioCount).toBe(12);
    expect(scenarioLines).toHaveLength(12);
    expect(traceLines).toHaveLength(result.traces.length);
    expect(readFileSync(result.paths.summaryMarkdown, "utf8")).toContain(
      "Stochastic Test Simulator Summary",
    );
    expect(readFileSync(result.paths.dashboardHtml, "utf8")).toContain(
      "Loanslam Phase 0 Stochastic Test Simulator",
    );
  });

  it("runs only the replayed scenario when scenarioPath is provided", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-sts-scenario-"));
    const scenarioPath = generateStochasticScenarios({
      seed: "demo",
      profile: "smoke",
    })[3]?.scenarioPath;

    expect(scenarioPath).toBeDefined();

    const result = await runStochasticTestSimulator({
      seed: "demo",
      profile: "smoke",
      scenarioPath,
      outputDir,
      corpus,
      planner: testPlanner(),
      now: new Date("2026-06-14T12:00:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0]?.scenarioPath).toBe(scenarioPath);
    expect(
      result.traces.every((trace) => trace.scenarioPath === scenarioPath),
    ).toBe(true);
    expect(result.run.scenarioCount).toBe(1);
  });

  it("raises a clear missing scenario error with seed, profile, and path", async () => {
    await expect(
      runStochasticTestSimulator({
        seed: "demo",
        profile: "smoke",
        scenarioPath: "smoke/999/missing/path",
        outputDir: mkdtempSync(join(tmpdir(), "loanslam-sts-missing-")),
        corpus,
        planner: testPlanner(),
        now: new Date("2026-06-14T12:00:00.000Z"),
        idFactory: sequenceIds(),
      }),
    ).rejects.toThrow(
      'No stochastic scenario found for seed "demo", profile "smoke", scenarioPath "smoke/999/missing/path"',
    );
  });
});

const corpus: CorpusItem[] = [
  {
    id: "apply-online",
    question: "Can I apply for a Loanslam loan online?",
    question_variants: [
      "Can I apply online?",
      "Can I apply on the website?",
      "Can I start the application online?",
      "How do I apply online?",
      "Do you have a phone number?",
    ],
    serving_mode: "answer",
    answer_text: "You can apply online through the approved application page.",
    links: [{ label: "Apply", url: "https://loanslam.example/apply" }],
    tags: ["apply", "online"],
  },
  {
    id: "application-status",
    question: "Can you tell me if my application has been approved?",
    question_variants: [
      "What is my application status?",
      "Am I approved or not?",
      "Can you check whether I have been approved?",
      "What is my settlement figure?",
      "What is my balance?",
    ],
    serving_mode: "handoff_account_specific",
    route_reason: "Application status is account-specific.",
    tags: ["status", "account-specific"],
  },
  {
    id: "hardship-support",
    question: "I lost work and cannot afford this month's repayment.",
    question_variants: [
      "I cannot afford the repayment.",
      "I am struggling after losing shifts at work.",
      "I do not think I can make the next repayment.",
      "Actually I cannot afford the repayment I already have.",
    ],
    serving_mode: "route_vulnerability",
    route_reason: "Hardship needs human support.",
    tags: ["hardship", "vulnerability"],
  },
  {
    id: "excluded-iva",
    question: "Should I enter an IVA for this debt?",
    question_variants: [
      "Should I enter an IVA?",
      "Should I enter an IVA or a debt management plan?",
      "I am worried about my debts.",
    ],
    serving_mode: "excluded",
    route_reason: "Debt advice is outside the Phase 0 answerable corpus.",
    tags: ["iva", "debt-advice"],
  },
  {
    id: "complaint",
    question: "I want to complain and I may take legal action.",
    question_variants: [
      "I want to complain.",
      "Treat this as a complaint and I may take legal action.",
      "I am unhappy with how this loan has been handled.",
    ],
    serving_mode: "route_vulnerability",
    route_reason: "Complaints and legal threats need human support.",
    tags: ["complaint", "legal"],
  },
];

function testPlanner(): TurnPlanner & { metadata: PlannerMetadata } {
  return {
    metadata: plannerMetadata,
    async planTurn(input) {
      const match = input.retrievedMatches[0];

      if (!match) {
        return {
          action: "ask_clarifying_question",
          customerMessage: "What would you like help with?",
          ui: {
            primitive: "clarifying_prompt",
            message: "What would you like help with?",
            questions: [
              "Is this about applying, an existing account, or support?",
            ],
          },
          reasonCode: "needs_clarification",
          collectedFacts: {},
          requestedFields: [],
          grounding: null,
          safetyFlags: [],
          traceSummary: "No retrieved match.",
        };
      }

      if (match.servingMode === "answer") {
        return {
          action: "answer",
          customerMessage: "You can apply online through the approved page.",
          ui: {
            primitive: "message",
            message: "You can apply online through the approved page.",
            links: [],
          },
          reasonCode: "grounded_answer",
          collectedFacts: {},
          requestedFields: [],
          grounding: {
            citedItemIds: [match.itemId],
            servingMode: "answer",
            confidence: "supported",
          },
          safetyFlags: [],
          traceSummary: "Answered from the retrieved corpus item.",
        };
      }

      if (match.servingMode === "excluded") {
        return {
          action: "refuse",
          customerMessage:
            "I cannot give debt advice here, but I can route you to support.",
          ui: {
            primitive: "safe_fallback",
            message:
              "I cannot give debt advice here, but I can route you to support.",
            links: [],
          },
          reasonCode: "excluded_request",
          collectedFacts: {},
          requestedFields: [],
          grounding: {
            citedItemIds: [match.itemId],
            servingMode: "excluded",
            confidence: "supported",
          },
          safetyFlags: [],
          traceSummary: "Refused excluded advice.",
        };
      }

      return {
        action: "request_handoff_intake",
        customerMessage: "I need to pass this to the Loanslam team.",
        ui: {
          primitive: "intake_form",
          message: "I need to pass this to the Loanslam team.",
          fields: [
            "fullName",
            "dateOfBirth",
            "address",
            "phone",
            "email",
            "situationSummary",
          ],
        },
        reasonCode: "handoff",
        collectedFacts: {},
        requestedFields: [
          "fullName",
          "dateOfBirth",
          "address",
          "phone",
          "email",
          "situationSummary",
        ],
        grounding: {
          citedItemIds: [match.itemId],
          servingMode: match.servingMode,
          confidence: "supported",
        },
        safetyFlags:
          match.servingMode === "route_vulnerability"
            ? ["vulnerability"]
            : ["account_specific_request"],
        traceSummary: "Routed to handoff.",
      };
    },
  };
}

function sequenceIds(): () => string {
  let next = 0;

  return () => {
    next += 1;
    return `id-${next}`;
  };
}
