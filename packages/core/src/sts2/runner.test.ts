import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  CorpusItem,
  PlannerMetadata,
  Sts2CustomerOutcome,
  TurnPlanner,
} from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import {
  buildCustomerInstructions,
  Sts2CustomerAgent,
  type Sts2CustomerClient,
  type Sts2CustomerRequest,
} from "./customerAgent";
import {
  generateSts2Initializations,
  replaySts2Initialization,
  sts2PersonaStyles,
} from "./initialization";
import { buildSts2UsageReceipt } from "./report";
import { regradeSts2Run, runSts2Simulator } from "./runner";

const plannerMetadata: PlannerMetadata = {
  provider: "inline",
  model: "sts2-test-planner",
  promptVersion: "test",
};

describe("generateSts2Initializations", () => {
  it("is deterministic for a given seed and profile", () => {
    const first = generateSts2Initializations({ seed: "demo", profile: "smoke" });
    const second = generateSts2Initializations({
      seed: "demo",
      profile: "smoke",
    });

    expect(first).toEqual(second);
    expect(first).toHaveLength(12);
  });

  it("covers every persona style (incl. persistent) and intent in smoke", () => {
    const initializations = generateSts2Initializations({
      seed: "demo",
      profile: "smoke",
    });
    const styles = new Set(
      initializations.map((init) => init.persona.style),
    );
    const intents = new Set(
      initializations.map((init) => init.persona.goal.intent),
    );

    for (const style of sts2PersonaStyles) {
      expect(styles.has(style)).toBe(true);
    }
    expect(intents.size).toBeGreaterThanOrEqual(5);
  });

  it("replays a single initialization by scenarioPath", () => {
    const initializations = generateSts2Initializations({
      seed: "demo",
      profile: "smoke",
    });
    const target = initializations[4];

    expect(target).toBeDefined();
    expect(
      replaySts2Initialization({
        seed: "demo",
        profile: "smoke",
        scenarioPath: target?.scenarioPath ?? "",
      }),
    ).toEqual(target);
  });

  it("raises a clear missing initialization error", () => {
    expect(() =>
      replaySts2Initialization({
        seed: "demo",
        profile: "smoke",
        scenarioPath: "sts2/smoke/999/missing/path",
      }),
    ).toThrow(
      'No sts2 initialization found for seed "demo", profile "smoke", scenarioPath "sts2/smoke/999/missing/path"',
    );
  });
});

describe("Sts2CustomerAgent", () => {
  it("keeps instructions stable across calls and renders the conversation input", async () => {
    const initialization = generateSts2Initializations({
      seed: "demo",
      profile: "smoke",
    })[0];
    expect(initialization).toBeDefined();
    if (initialization === undefined) {
      return;
    }

    const requests: Sts2CustomerRequest[] = [];
    const agent = new Sts2CustomerAgent({
      config: { apiKey: "test-key", model: "gpt-5.4-mini" },
      initialization,
      client: scriptedClient(requests, [
        { message: "Hi, I need help with something.", outcome: "continue" },
        { message: "Thanks, that answers it.", outcome: "satisfied" },
      ]),
    });

    const first = await agent.nextTurn([]);
    const second = await agent.nextTurn([
      {
        customerMessage: first.message,
        botMessage: "Here is the answer.",
      },
    ]);

    expect(requests).toHaveLength(2);
    expect(requests[0]?.instructions).toBe(requests[1]?.instructions);
    expect(requests[0]?.instructions).toBe(
      buildCustomerInstructions(initialization),
    );
    expect(requests[0]?.input).toContain("has not started");
    expect(requests[1]?.input).toContain("Customer: Hi, I need help");
    expect(requests[1]?.input).toContain("Support chat: Here is the answer.");
    expect(first.usage).toEqual({
      inputTokens: 100,
      cachedInputTokens: 20,
      outputTokens: 10,
    });
    expect(second.outcome).toBe("satisfied");
  });
});

describe("buildSts2UsageReceipt", () => {
  it("computes cached-aware cost from recorded rates", () => {
    const initialization = generateSts2Initializations({
      seed: "demo",
      profile: "smoke",
    })[0];
    if (initialization === undefined) {
      throw new Error("expected initialization");
    }

    const receipt = buildSts2UsageReceipt({
      customerModel: "gpt-5.4-mini",
      trajectories: [
        {
          scenarioPath: initialization.scenarioPath,
          initialization,
          turns: [
            fakeTurn(0, { inputTokens: 1000, cachedInputTokens: 200, outputTokens: 100 }),
          ],
          endReason: "satisfied",
          error: null,
        },
      ],
    });

    expect(receipt.calls).toBe(1);
    // (800/1M)*0.75 + (200/1M)*0.075 + (100/1M)*4.5
    expect(receipt.estimatedCostUsd).toBeCloseTo(0.0011, 4);
    expect(receipt.rates.model).toBe("gpt-5.4-mini");
  });

  it("refuses to estimate cost for a model with no recorded rates", () => {
    expect(() =>
      buildSts2UsageReceipt({ customerModel: "mystery-model", trajectories: [] }),
    ).toThrow('No recorded rates for customer model "mystery-model"');
  });
});

describe("runSts2Simulator", () => {
  it("runs smoke trajectories, writes the run folder, and supports regrade", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-sts2-runner-"));
    const result = await runSts2Simulator({
      seed: "demo",
      profile: "smoke",
      outputDir,
      corpus,
      planner: testPlanner(),
      customerConfig: { apiKey: "test-key", model: "gpt-5.4-mini" },
      customerClient: loopingClient([
        { message: "Hello, I have a question about my situation.", outcome: "continue" },
        { message: "Right, understood. Thanks.", outcome: "satisfied" },
      ]),
      now: new Date("2026-07-03T12:00:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(result.trajectories).toHaveLength(12);
    expect(
      result.trajectories.every(
        (trajectory) => trajectory.endReason === "satisfied",
      ),
    ).toBe(true);
    expect(
      result.trajectories.every((trajectory) => trajectory.turns.length === 2),
    ).toBe(true);
    expect(result.report.verdict).toBe("ungraded");
    expect(result.report.usage.calls).toBe(24);
    expect(result.paths.runDir).toBe(
      join(outputDir, "sts2-smoke-2026-07-03T12-00-00Z"),
    );

    for (const artifact of [
      "report.json",
      "report.html",
      "inits.jsonl",
      "transcripts.jsonl",
      "summary.md",
    ]) {
      expect(existsSync(join(result.paths.runDir, artifact))).toBe(true);
    }

    const transcriptLines = readFileSync(result.paths.transcriptsJsonl, "utf8")
      .trim()
      .split("\n");
    expect(transcriptLines).toHaveLength(12);

    const regraded = regradeSts2Run(result.paths.runDir);
    expect(regraded.trajectories).toEqual(result.trajectories);
    expect(regraded.report.runId).toBe(result.report.runId);
    expect(regraded.report.usage).toEqual(result.report.usage);
  });

  it("runs a single regenerated initialization when --init is given", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-sts2-single-"));
    const scenarioPath = generateSts2Initializations({
      seed: "demo",
      profile: "smoke",
    })[2]?.scenarioPath;
    expect(scenarioPath).toBeDefined();

    const result = await runSts2Simulator({
      seed: "demo",
      profile: "smoke",
      ...(scenarioPath !== undefined ? { scenarioPath } : {}),
      outputDir,
      corpus,
      planner: testPlanner(),
      customerConfig: { apiKey: "test-key", model: "gpt-5.4-mini" },
      customerClient: loopingClient([
        { message: "Quick question.", outcome: "continue" },
        { message: "Fine, thanks.", outcome: "satisfied" },
      ]),
      now: new Date("2026-07-03T12:00:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(result.trajectories).toHaveLength(1);
    expect(result.trajectories[0]?.scenarioPath).toBe(scenarioPath);
  });

  it("records an error end reason and keeps the trajectory when the customer agent fails", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-sts2-error-"));
    const scenarioPath = generateSts2Initializations({
      seed: "demo",
      profile: "smoke",
    })[0]?.scenarioPath;

    const failingClient: Sts2CustomerClient = {
      responses: {
        async parse() {
          throw new Error("customer model unavailable");
        },
      },
    };

    const result = await runSts2Simulator({
      seed: "demo",
      profile: "smoke",
      ...(scenarioPath !== undefined ? { scenarioPath } : {}),
      outputDir,
      corpus,
      planner: testPlanner(),
      customerConfig: { apiKey: "test-key", model: "gpt-5.4-mini" },
      customerClient: failingClient,
      now: new Date("2026-07-03T12:00:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(result.trajectories[0]?.endReason).toBe("error");
    expect(result.trajectories[0]?.error).toContain(
      "customer model unavailable",
    );
    expect(result.trajectories[0]?.turns).toHaveLength(0);
  });

  it("stops at the turn cap when the customer never finishes", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "loanslam-sts2-cap-"));
    const scenarioPath = generateSts2Initializations({
      seed: "demo",
      profile: "smoke",
    })[0]?.scenarioPath;

    const result = await runSts2Simulator({
      seed: "demo",
      profile: "smoke",
      ...(scenarioPath !== undefined ? { scenarioPath } : {}),
      outputDir,
      corpus,
      planner: testPlanner(),
      customerConfig: { apiKey: "test-key", model: "gpt-5.4-mini" },
      customerClient: loopingClient([
        { message: "But what about my question?", outcome: "continue" },
      ]),
      now: new Date("2026-07-03T12:00:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(result.trajectories[0]?.endReason).toBe("turn_cap");
    expect(result.trajectories[0]?.turns).toHaveLength(12);
  });
});

interface ScriptedTurn {
  message: string;
  outcome: Sts2CustomerOutcome;
}

function scriptedClient(
  requests: Sts2CustomerRequest[],
  turns: readonly ScriptedTurn[],
): Sts2CustomerClient {
  let call = 0;

  return {
    responses: {
      async parse(request: Sts2CustomerRequest) {
        requests.push(request);
        const turn = turns[Math.min(call, turns.length - 1)];
        call += 1;

        return {
          output_parsed: turn,
          usage: {
            input_tokens: 100,
            output_tokens: 10,
            input_tokens_details: { cached_tokens: 20 },
          },
        };
      },
    },
  };
}

// A client that cycles the same script for every trajectory: call index is
// tracked per conversation length so all trajectories see the same turns.
function loopingClient(turns: readonly ScriptedTurn[]): Sts2CustomerClient {
  return {
    responses: {
      async parse(request: Sts2CustomerRequest) {
        const exchangeCount = (request.input.match(/^Customer: /gm) ?? [])
          .length;
        const turn = turns[Math.min(exchangeCount, turns.length - 1)];

        return {
          output_parsed: turn,
          usage: {
            input_tokens: 100,
            output_tokens: 10,
            input_tokens_details: { cached_tokens: 20 },
          },
        };
      },
    },
  };
}

function fakeTurn(
  turnIndex: number,
  usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number },
) {
  return {
    turnIndex,
    customerMessage: "Hello there.",
    customerOutcome: "continue" as const,
    botMessage: "Hello, how can I help?",
    finalAction: "answer_from_corpus" as const,
    effectiveServingMode: "answer" as const,
    safetyFlags: [],
    validatorOverrideCodes: [],
    customerUsage: usage,
  };
}

function sequenceIds(): () => string {
  let counter = 0;

  return () => {
    counter += 1;
    return `sts2-test-id-${counter}`;
  };
}

const corpus: CorpusItem[] = [
  {
    id: "apply-online",
    question: "Can I apply for a LoanSlam loan online?",
    question_variants: [
      "Can I apply online?",
      "Can I apply on the website?",
      "How do I apply online?",
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
      "I do not think I can make the next repayment.",
    ],
    serving_mode: "route_vulnerability",
    route_reason: "Hardship needs human support.",
    tags: ["hardship", "vulnerability"],
  },
  {
    id: "excluded-iva",
    question: "Should I enter an IVA for this debt?",
    question_variants: ["Should I enter an IVA?", "I am worried about my debts."],
    serving_mode: "excluded",
    route_reason: "Debt advice is outside the Phase 0 answerable corpus.",
    tags: ["iva", "debt-advice"],
  },
  {
    id: "complaint",
    question: "I want to complain and I may take legal action.",
    question_variants: [
      "I want to complain.",
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
        customerMessage: "I need to pass this to the LoanSlam team.",
        ui: {
          primitive: "intake_form",
          message: "I need to pass this to the LoanSlam team.",
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
