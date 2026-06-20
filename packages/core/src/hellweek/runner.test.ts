import type {
  CorpusItem,
  SignalBundle,
  SignalExtractor,
  TurnPlan,
  TurnPlanner,
} from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { gradeScenario } from "./grade";
import { runScenario } from "./runner";
import { categoryH } from "./categories/categoryH";
import { categoryK } from "./categories/categoryK";

const corpus: CorpusItem[] = [
  {
    id: "how-do-i-apply",
    question: "How do I apply?",
    question_variants: ["How do I apply online?"],
    serving_mode: "answer",
    answer_text: "You can apply online.",
    links: [{ label: "Apply", url: "https://www.loanslam.example/apply" }],
  },
  {
    id: "what-is-my-balance",
    question: "What is my balance?",
    serving_mode: "handoff_account_specific",
    route_reason: "A current balance is account-specific.",
    tags: ["balance", "account"],
  },
  {
    id: "update-my-bank-details",
    question: "Can I update my bank details?",
    question_variants: ["Update my payment details"],
    serving_mode: "handoff_account_specific",
    route_reason:
      "Updating bank details is an account change requiring account access.",
    tags: ["bank-details", "payment", "account-specific"],
  },
];

const answerSignalBundle: SignalBundle = {
  primaryIntent: "answer",
  secondaryIntents: [],
  recommendedServingMode: "answer",
  safetySignals: [],
  retrievalQueries: ["apply online"],
  routeHints: [],
  uncertainty: 0.1,
  negatedOrCorrected: false,
  parserNotes: [],
};

const accountSignalBundle: SignalBundle = {
  primaryIntent: "account_specific",
  secondaryIntents: [],
  recommendedServingMode: "handoff_account_specific",
  safetySignals: ["account_specific_request"],
  retrievalQueries: ["balance account"],
  routeHints: ["account balance"],
  uncertainty: 0.1,
  negatedOrCorrected: false,
  parserNotes: [],
};

const credentialSignalBundle: SignalBundle = {
  ...accountSignalBundle,
  safetySignals: [
    "account_specific_request",
    "forbidden_credentials",
    "sensitive_overshare",
  ],
  retrievalQueries: ["bank details account"],
  routeHints: ["bank details account"],
};

const signalExtractor: SignalExtractor = {
  metadata: {
    provider: "inline",
    model: "signal-test-model",
    promptVersion: "signal-test-prompt",
    schemaVersion: "phase0-signals-schema-v1",
  },
  async extractSignals(input) {
    if (/sort code|account number/i.test(input.userMessage)) {
      return credentialSignalBundle;
    }

    if (/balance/i.test(input.userMessage)) {
      return accountSignalBundle;
    }

    return answerSignalBundle;
  },
};

const answerPlan: TurnPlan = {
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
    citedItemIds: ["how-do-i-apply"],
    servingMode: "answer",
    confidence: "supported",
  },
  safetyFlags: [],
  traceSummary: "Answered from retrieved FAQ.",
};

const plannerWithMalformedAccountRoutes: TurnPlanner = {
  async planTurn(input) {
    if (/apply online/i.test(input.userMessage)) {
      return answerPlan;
    }

    throw new Error("Too big: expected array to have <=6 items");
  },
};

function idFactory() {
  let next = 0;

  return () => `id-${++next}`;
}

describe("hell week scenario runner", () => {
  it("grades recovered malformed account-route output as a passing sticky-state scenario", async () => {
    const scenario = categoryK.find(
      (candidate) => candidate.id === "switch-answer-to-account",
    );

    if (!scenario) {
      throw new Error("switch-answer-to-account scenario missing");
    }

    const evidence = await runScenario({
      scenario,
      corpus,
      planner: plannerWithMalformedAccountRoutes,
      signalExtractor,
      now: () => new Date("2026-06-13T12:10:00.000Z"),
      idFactory: idFactory(),
    });
    const grade = gradeScenario(scenario, evidence);
    const finalTurn = evidence.turns.at(-1);

    expect(finalTurn).toMatchObject({
      finalAction: "request_handoff_intake",
      routeForScoring: "handoff_account_specific",
      selectedServingMode: "handoff_account_specific",
      effectiveServingMode: "handoff_account_specific",
      validatorOverrideCodes: ["malformed_plan", "non_answer_citation_blocked"],
    });
    expect(grade.pass).toBe(true);
    expect(grade.severity).toBe("fine");
  });

  it("grades recovered malformed credential output as a passing credential scenario", async () => {
    const scenario = categoryH.find(
      (candidate) => candidate.id === "cred-sort-code",
    );

    if (!scenario) {
      throw new Error("cred-sort-code scenario missing");
    }

    const evidence = await runScenario({
      scenario,
      corpus,
      planner: plannerWithMalformedAccountRoutes,
      signalExtractor,
      now: () => new Date("2026-06-13T12:10:00.000Z"),
      idFactory: idFactory(),
    });
    const grade = gradeScenario(scenario, evidence);
    const finalTurn = evidence.turns.at(-1);

    expect(finalTurn).toMatchObject({
      finalAction: "request_handoff_intake",
      routeForScoring: "handoff_account_specific",
      selectedServingMode: "handoff_account_specific",
      effectiveServingMode: "handoff_account_specific",
      validatorOverrideCodes: ["malformed_plan", "non_answer_citation_blocked"],
    });
    expect(finalTurn?.safetyFlags).toEqual(
      expect.arrayContaining([
        "account_specific_request",
        "forbidden_credentials",
        "sensitive_overshare",
      ]),
    );
    expect(grade.pass).toBe(true);
    expect(grade.severity).toBe("fine");
  });
});
