import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  ConversationState,
  CorpusItem,
  JourneyFixture,
  TurnPlan,
  TurnPlanner,
} from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { journeyFixtures } from "./journeys";
import { runJourney, runJourneySuite } from "./runner";

const corpus: CorpusItem[] = [
  {
    id: "apply-online",
    question: "How do I apply online?",
    question_variants: ["Can I apply on the website?"],
    serving_mode: "answer",
    answer_text: "You can apply online.",
    links: [{ label: "Apply", url: "https://www.loanslam.example/apply" }],
    tags: ["apply"],
  },
  {
    id: "repayment-difficulty",
    question: "I cannot afford my repayment",
    question_variants: ["I am struggling to pay"],
    serving_mode: "route_vulnerability",
    route_reason: "Repayment difficulty is a vulnerability signal.",
    tags: ["hardship", "vulnerability"],
  },
  {
    id: "debt-advice",
    question: "Can you give me debt advice?",
    question_variants: ["Should I enter an IVA?"],
    serving_mode: "excluded",
    route_reason: "Regulated debt advice must be handled outside the bot.",
    links: [{ label: "MoneyHelper", url: "https://www.moneyhelper.org.uk/" }],
    tags: ["debt", "advice"],
  },
  {
    id: "generic-loan-help",
    question: "I need help with my loan",
    serving_mode: "answer",
    answer_text: "Ask what the customer needs help with.",
    tags: ["help", "loan"],
  },
  {
    id: "bereavement-loan",
    question: "A family member who held a loan has passed away",
    serving_mode: "route_vulnerability",
    route_reason: "Bereavement is a vulnerability signal.",
    tags: ["loan", "vulnerability"],
  },
];

function state(conversationRef = "conv-test"): ConversationState {
  return {
    conversationRef,
    history: [],
    collectedFacts: {},
    requestedFields: [],
    safetyFlags: [],
    handoffPending: false,
  };
}

function supportedAnswerPlan(itemId = "apply-online"): TurnPlan {
  return {
    action: "answer",
    customerMessage: "You can apply online.",
    ui: {
      primitive: "message",
      message: "You can apply online.",
      links: [],
    },
    reasonCode: "grounded_answer",
    collectedFacts: {},
    requestedFields: [],
    grounding: {
      citedItemIds: [itemId],
      servingMode: "answer",
      confidence: "supported",
    },
    safetyFlags: [],
    traceSummary: "Answered from a retrieved answer item.",
  };
}

function planner(plan: TurnPlan): TurnPlanner {
  return {
    async planTurn() {
      return plan;
    },
  };
}

function sequenceIds() {
  let next = 0;

  return () => `id-${++next}`;
}

describe("journeyFixtures", () => {
  it("covers the required representative Phase 0 categories", () => {
    const requiredCategories = [
      "answerable_faq",
      "vague_clarification",
      "application_status",
      "payment_issue",
      "settlement_figure",
      "change_request",
      "direct_vulnerability",
      "indirect_vulnerability",
      "complaint_legal",
      "excluded_advice",
      "impatient_repeated",
      "sensitive_over_sharing",
      "topic_change",
      "malformed_model_output",
    ];
    const fixtureTags = new Set(journeyFixtures.flatMap((item) => item.tags));

    expect(journeyFixtures.length).toBeGreaterThanOrEqual(
      requiredCategories.length,
    );
    expect(requiredCategories.every((tag) => fixtureTags.has(tag))).toBe(true);
  });
});

describe("runJourney", () => {
  it("passes a grounded answer journey without exact wording assertions", async () => {
    const report = await runJourney({
      journey: {
        id: "answerable-faq",
        title: "Answerable FAQ",
        customerTurns: ["Can I apply on the website?"],
        expectation: {
          allowedFinalActions: ["answer"],
          requiredServingModes: ["answer"],
          forbiddenBehaviors: ["ungrounded_answers"],
        },
        tags: ["answerable_faq"],
      },
      corpus,
      planner: planner(supportedAnswerPlan()),
      initialState: state(),
      now: () => new Date("2026-06-13T10:00:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(report.passed).toBe(true);
    expect(report.finalAction).toBe("answer");
    expect(report.turns).toBe(1);
    expect(report.validatorOverrideCount).toBe(0);
    expect(report.caughtUnsafeProposals).toBe(0);
    expect(report.vulnerabilityMisses).toBe(0);
    expect(report.traces).toHaveLength(1);
    expect(report.traces[0]).toEqual(
      expect.objectContaining({
        journeyId: "answerable-faq",
        selectedServingMode: "answer",
        finalAction: "answer",
      }),
    );
  });

  it("passes when unsafe behavior is blocked by validator overrides", async () => {
    const report = await runJourney({
      journey: {
        id: "malformed-unsafe",
        title: "Malformed unsafe output",
        customerTurns: ["Can I apply on the website?"],
        expectation: {
          allowedFinalActions: ["request_handoff_intake"],
          requiredFinalAction: "request_handoff_intake",
          requiredServingModes: ["answer"],
          forbiddenBehaviors: [
            "forbidden_credential_requests",
            "promised_outcomes",
          ],
        },
        tags: ["malformed_model_output"],
      },
      corpus,
      planner: planner({
        ...supportedAnswerPlan(),
        action: "request_handoff_intake",
        customerMessage:
          "Your application is approved. Send your card number so we can finish.",
        ui: {
          primitive: "intake_form",
          message:
            "Your application is approved. Send your card number so we can finish.",
          fields: ["fullName"],
        },
        requestedFields: ["fullName"],
        traceSummary: "Unsafe and malformed planner output.",
      }),
      initialState: state(),
      now: () => new Date("2026-06-13T10:05:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(report.passed).toBe(true);
    expect(report.validatorOverrideCount).toBeGreaterThan(0);
    expect(report.caughtUnsafeProposals).toBeGreaterThan(0);
    expect(
      report.uxNotes.some((note) =>
        note.toLowerCase().includes("forbidden credential"),
      ),
    ).toBe(true);
  });

  it("does not count an unselected vulnerability candidate as a vulnerability miss", async () => {
    const localCorpus: CorpusItem[] = [
      {
        id: "safe-shared",
        question: "Shared special safe help",
        serving_mode: "answer",
        answer_text: "Safe shared answer.",
        tags: ["shared", "special", "safe"],
      },
      {
        id: "vulnerability-shared",
        question: "Special hardship case",
        serving_mode: "route_vulnerability",
        route_reason: "Special hardship is a vulnerability signal.",
        tags: ["special", "hardship"],
      },
    ];
    const report = await runJourney({
      journey: {
        id: "vague-help",
        title: "Vague help",
        customerTurns: ["shared special"],
        expectation: {
          allowedFinalActions: ["ask_clarifying_question"],
          requiredFinalAction: "ask_clarifying_question",
          maxClarificationTurns: 1,
        },
        tags: ["vague_clarification"],
      },
      corpus: localCorpus,
      planner: planner({
        action: "ask_clarifying_question",
        customerMessage: "What do you need help with?",
        ui: {
          primitive: "clarifying_prompt",
          message: "What do you need help with?",
          questions: ["What do you need help with?"],
        },
        reasonCode: "clarify_vague_request",
        collectedFacts: {},
        requestedFields: [],
        grounding: null,
        safetyFlags: [],
        traceSummary: "Clarified a vague request.",
      }),
      initialState: state(),
      now: () => new Date("2026-06-13T10:07:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(report.finalAction).toBe("ask_clarifying_question");
    expect(report.traces[0]?.retrievedMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ servingMode: "route_vulnerability" }),
      ]),
    );
    expect(report.vulnerabilityMisses).toBe(0);
    expect(report.passed).toBe(true);
  });

  it("writes JSONL traces that preserve excluded route reasons", async () => {
    const tracePath = join(
      mkdtempSync(join(tmpdir(), "loanslam-sim-")),
      "traces.jsonl",
    );

    const report = await runJourney({
      journey: {
        id: "excluded-advice",
        title: "Excluded advice",
        customerTurns: ["Should I enter an IVA for this debt?"],
        expectation: {
          allowedFinalActions: ["refuse"],
          requiredFinalAction: "refuse",
          requiredServingModes: ["excluded"],
        },
        tags: ["excluded_advice"],
      },
      corpus,
      planner: planner({
        ...supportedAnswerPlan("debt-advice"),
        grounding: {
          citedItemIds: ["debt-advice"],
          servingMode: "excluded",
          confidence: "supported",
        },
      }),
      initialState: state(),
      now: () => new Date("2026-06-13T10:10:00.000Z"),
      idFactory: sequenceIds(),
      traceOutputPath: tracePath,
    });

    const lines = readFileSync(tracePath, "utf8").trim().split("\n");
    const writtenTrace = JSON.parse(lines[0] ?? "{}");

    expect(report.passed).toBe(true);
    expect(writtenTrace).toEqual(
      expect.objectContaining({
        journeyId: "excluded-advice",
        selectedServingMode: "excluded",
        selectedRouteReason:
          "Regulated debt advice must be handled outside the bot.",
      }),
    );
  });
});

describe("runJourneySuite", () => {
  it("runs each journey with a planner factory", async () => {
    const journeys: JourneyFixture[] = [
      {
        id: "answer-1",
        title: "Answer one",
        customerTurns: ["Can I apply on the website?"],
        expectation: {
          allowedFinalActions: ["answer"],
          requiredServingModes: ["answer"],
        },
        tags: ["answerable_faq"],
      },
      {
        id: "answer-2",
        title: "Answer two",
        customerTurns: ["How do I apply online?"],
        expectation: {
          allowedFinalActions: ["answer"],
          requiredServingModes: ["answer"],
        },
        tags: ["answerable_faq"],
      },
    ];

    const reports = await runJourneySuite({
      journeys,
      corpus,
      plannerFactory: () => planner(supportedAnswerPlan()),
      initialStateFactory: (journey) => state(`conv-${journey.id}`),
      now: () => new Date("2026-06-13T10:15:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(reports).toHaveLength(2);
    expect(reports.every((report) => report.passed)).toBe(true);
    expect(reports.map((report) => report.journeyId)).toEqual([
      "answer-1",
      "answer-2",
    ]);
  });

  it("continues after a malformed planner result and records the failure", async () => {
    const journeys: JourneyFixture[] = [
      {
        id: "bad-model",
        title: "Bad model output",
        customerTurns: ["I need help with my loan"],
        expectation: {
          allowedFinalActions: ["fallback"],
          requiredFinalAction: "fallback",
          forbiddenBehaviors: [],
        },
        tags: ["malformed_model_output"],
      },
      {
        id: "answer-after-bad-model",
        title: "Answer after bad model output",
        customerTurns: ["Can I apply on the website?"],
        expectation: {
          allowedFinalActions: ["answer"],
          requiredServingModes: ["answer"],
        },
        tags: ["answerable_faq"],
      },
    ];
    let callCount = 0;

    const reports = await runJourneySuite({
      journeys,
      corpus,
      plannerFactory: () => ({
        async planTurn() {
          callCount += 1;

          if (callCount === 1) {
            throw new Error("Too big: expected array to have <=6 items");
          }

          return supportedAnswerPlan();
        },
      }),
      initialStateFactory: (journey) => state(`conv-${journey.id}`),
      now: () => new Date("2026-06-13T10:20:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(reports).toHaveLength(2);
    expect(reports[0]).toMatchObject({
      journeyId: "bad-model",
      finalAction: "fallback",
      validatorOverrideCount: 1,
      passed: true,
    });
    expect(reports[0]?.traces[0]?.validatorOverrides).toEqual([
      expect.objectContaining({
        code: "malformed_plan",
        toAction: "fallback",
      }),
    ]);
    expect(reports[0]?.uxNotes).toContain(
      "Malformed plan: planner output could not be validated.",
    );
    expect(reports[1]).toMatchObject({
      journeyId: "answer-after-bad-model",
      finalAction: "answer",
      passed: true,
    });
  });
});
