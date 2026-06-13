import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type {
  ConversationState,
  CorpusItem,
  PersonaScenario,
  TurnPlan,
  TurnPlanner,
} from "@loanslam/contracts";
import { describe, expect, it } from "vitest";

import { defaultPersonaScenarios } from "./personas";
import {
  runPersonaScenario,
  runPersonaSuite,
  writeTranscriptJsonl,
} from "./personaRunner";

const corpus: CorpusItem[] = [
  {
    id: "apply-online",
    question: "How do I apply online?",
    question_variants: ["Can I apply online?"],
    serving_mode: "answer",
    answer_text: "You can apply online.",
    links: [{ label: "Apply", url: "https://www.loanslam.example/apply" }],
    tags: ["apply"],
  },
  {
    id: "repayment-difficulty",
    question: "I cannot afford my repayment",
    question_variants: ["I lost my job and cannot pay"],
    serving_mode: "route_vulnerability",
    route_reason: "Repayment difficulty should be handled by a person.",
    tags: ["hardship", "vulnerability"],
  },
];

function state(conversationRef = "persona-conv"): ConversationState {
  return {
    conversationRef,
    history: [],
    collectedFacts: {},
    requestedFields: [],
    safetyFlags: [],
    handoffPending: false,
  };
}

function scenario(overrides: Partial<PersonaScenario> = {}): PersonaScenario {
  return {
    id: overrides.id ?? "persona-answer",
    title: overrides.title ?? "Persona answer",
    persona: overrides.persona ?? {
      id: "cooperative",
      label: "Cooperative",
      traits: ["clear"],
      styleNotes: "Asks a direct question.",
    },
    objective: overrides.objective ?? "Get a grounded answer.",
    customerTurns: overrides.customerTurns ?? ["Can I apply online?"],
    tags: overrides.tags ?? ["cooperative"],
  };
}

function supportedAnswerPlan(): TurnPlan {
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
      citedItemIds: ["apply-online"],
      servingMode: "answer",
      confidence: "supported",
    },
    safetyFlags: [],
    traceSummary: "Answered from retrieved FAQ.",
  };
}

function vulnerableAnswerPlan(): TurnPlan {
  return {
    action: "answer",
    customerMessage: "I can help with that.",
    ui: {
      primitive: "message",
      message: "I can help with that.",
      links: [],
    },
    reasonCode: "unsafe_vulnerability_answer",
    collectedFacts: {},
    requestedFields: [],
    grounding: {
      citedItemIds: ["repayment-difficulty"],
      servingMode: "route_vulnerability",
      confidence: "supported",
    },
    safetyFlags: [],
    traceSummary: "Tried to answer a hardship route.",
  };
}

function accountSpecificHandoffPlan(): TurnPlan {
  return {
    action: "answer",
    customerMessage: "Let me help with your balance.",
    ui: {
      primitive: "message",
      message: "Let me help with your balance.",
      links: [],
    },
    reasonCode: "account_specific_balance",
    collectedFacts: {},
    requestedFields: [],
    grounding: {
      citedItemIds: ["balance-check"],
      servingMode: "handoff_account_specific",
      confidence: "supported",
    },
    safetyFlags: [],
    traceSummary: "Cited an account-specific balance item.",
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

describe("defaultPersonaScenarios", () => {
  it("covers the required Phase 0 persona categories", () => {
    const requiredPersonaIds = [
      "cooperative",
      "adversarial",
      "confused",
      "terse",
      "impatient",
      "vulnerable",
      "oversharing",
      "legal-threat",
      "topic-switching",
      "low-literacy",
      "hostile-valid",
    ];
    const personaIds = new Set(
      defaultPersonaScenarios.map((scenario) => scenario.persona.id),
    );

    expect(defaultPersonaScenarios.length).toBeGreaterThanOrEqual(
      requiredPersonaIds.length,
    );
    expect(requiredPersonaIds.every((id) => personaIds.has(id))).toBe(true);
    expect(
      defaultPersonaScenarios.every(
        (scenario) =>
          scenario.id &&
          scenario.title &&
          scenario.objective &&
          scenario.customerTurns.length > 0,
      ),
    ).toBe(true);
    expect(
      defaultPersonaScenarios.filter(
        (scenario) => scenario.customerTurns.length > 1,
      ).length,
    ).toBeGreaterThanOrEqual(6);
  });
});

describe("runPersonaScenario", () => {
  it("preserves the full turn sequence with trace metadata", async () => {
    const transcript = await runPersonaScenario({
      scenario: scenario(),
      corpus,
      planner: planner(supportedAnswerPlan()),
      initialState: state(),
      now: () => new Date("2026-06-13T13:00:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(transcript).toEqual(
      expect.objectContaining({
        scenarioId: "persona-answer",
        scenarioTitle: "Persona answer",
        finalAction: "answer",
        validatorOverrideCount: 0,
        caughtUnsafeProposals: 0,
        vulnerabilityHandled: false,
        tags: ["cooperative"],
      }),
    );
    expect(transcript.persona).toEqual(
      expect.objectContaining({ id: "cooperative" }),
    );
    expect(transcript.turns).toEqual([
      expect.objectContaining({
        turnIndex: 0,
        userMessage: "Can I apply online?",
        botMessage: "You can apply online.",
        proposedAction: "answer",
        finalAction: "answer",
        selectedServingMode: "answer",
        selectedRouteReason: null,
        safetyFlags: [],
        validatorOverrideCodes: [],
        retrievedItemIds: ["apply-online"],
        requestedFields: [],
        collectedFacts: {},
        ui: {
          primitive: "message",
          message: "You can apply online.",
          links: [],
        },
        traceId: "id-5",
        requestRef: "id-2",
        createdAt: "2026-06-13T13:00:00.000Z",
      }),
    ]);
  });

  it("carries validator override and vulnerability metadata into transcript turns", async () => {
    const transcript = await runPersonaScenario({
      scenario: scenario({
        id: "persona-vulnerable",
        title: "Persona vulnerable",
        persona: {
          id: "vulnerable",
          label: "Vulnerable",
          traits: ["hardship"],
          styleNotes: "Mentions repayment hardship.",
        },
        customerTurns: ["I lost my job and cannot afford my repayment."],
      }),
      corpus,
      planner: planner(vulnerableAnswerPlan()),
      now: () => new Date("2026-06-13T13:03:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(transcript).toEqual(
      expect.objectContaining({
        finalAction: "request_handoff_intake",
        validatorOverrideCount: 1,
        vulnerabilityHandled: true,
      }),
    );
    expect(transcript.turns[0]).toEqual(
      expect.objectContaining({
        proposedAction: "answer",
        finalAction: "request_handoff_intake",
        selectedServingMode: "route_vulnerability",
        selectedRouteReason:
          "Repayment difficulty should be handled by a person.",
        safetyFlags: expect.arrayContaining(["vulnerability"]),
        validatorOverrideCodes: ["vulnerability_route_match"],
        retrievedItemIds: ["repayment-difficulty"],
        requestedFields: [
          "fullName",
          "dateOfBirth",
          "address",
          "phone",
          "email",
          "situationSummary",
        ],
        ui: expect.objectContaining({
          primitive: "intake_form",
          fields: [
            "fullName",
            "dateOfBirth",
            "address",
            "phone",
            "email",
            "situationSummary",
          ],
        }),
      }),
    );
  });

  it("does not count candidate-set vulnerability bleed as handled vulnerability", async () => {
    const bleedCorpus: CorpusItem[] = [
      {
        id: "balance-check",
        question: "What is my current balance?",
        question_variants: [],
        serving_mode: "handoff_account_specific",
        route_reason: "A current balance is account-specific.",
        tags: ["balance"],
      },
      {
        id: "balance-worry",
        question: "I am worried about my balance",
        question_variants: [],
        serving_mode: "route_vulnerability",
        route_reason: "Distress about balances should be handled by a person.",
        tags: ["balance", "hardship"],
      },
    ];

    const transcript = await runPersonaScenario({
      scenario: scenario({
        id: "persona-account-specific",
        title: "Persona account specific",
        customerTurns: ["What is my current balance?"],
      }),
      corpus: bleedCorpus,
      planner: planner(accountSpecificHandoffPlan()),
      initialState: state(),
      now: () => new Date("2026-06-13T13:06:00.000Z"),
      idFactory: sequenceIds(),
    });

    const [turn] = transcript.turns;

    // The vulnerability item is only in the candidate set; the acted-on match
    // is account-specific, so this benign handoff must not be scored as a
    // handled vulnerability.
    expect(transcript.finalAction).toBe("request_handoff_intake");
    expect(turn.selectedServingMode).toBe("handoff_account_specific");
    expect(turn.retrievedItemIds).toContain("balance-worry");
    expect(turn.safetyFlags).not.toContain("vulnerability");
    expect(transcript.vulnerabilityHandled).toBe(false);
  });
});

describe("runPersonaSuite", () => {
  it("runs each persona scenario with a planner factory", async () => {
    const transcripts = await runPersonaSuite({
      scenarios: [
        scenario({ id: "persona-answer-1", title: "Persona answer one" }),
        scenario({ id: "persona-answer-2", title: "Persona answer two" }),
      ],
      corpus,
      plannerFactory: () => planner(supportedAnswerPlan()),
      now: () => new Date("2026-06-13T13:05:00.000Z"),
      idFactory: sequenceIds(),
    });

    expect(transcripts.map((transcript) => transcript.scenarioId)).toEqual([
      "persona-answer-1",
      "persona-answer-2",
    ]);
    expect(
      transcripts.every((transcript) => transcript.finalAction === "answer"),
    ).toBe(true);
    expect(transcripts.flatMap((transcript) => transcript.turns)).toHaveLength(
      2,
    );
  });
});

describe("writeTranscriptJsonl", () => {
  it("writes one schema-compatible transcript per line", async () => {
    const transcript = await runPersonaScenario({
      scenario: scenario(),
      corpus,
      planner: planner(supportedAnswerPlan()),
      now: () => new Date("2026-06-13T13:10:00.000Z"),
      idFactory: sequenceIds(),
    });
    const transcriptPath = join(
      mkdtempSync(join(tmpdir(), "loanslam-persona-")),
      "transcripts.jsonl",
    );

    writeTranscriptJsonl(transcriptPath, [transcript]);

    const lines = readFileSync(transcriptPath, "utf8").trim().split("\n");

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "{}")).toEqual(
      expect.objectContaining({
        transcriptId: transcript.transcriptId,
        scenarioId: "persona-answer",
        turns: [
          expect.objectContaining({
            userMessage: "Can I apply online?",
            botMessage: "You can apply online.",
          }),
        ],
      }),
    );
  });

  it("overwrites existing transcript files so separate runs do not mix", async () => {
    const transcriptPath = join(
      mkdtempSync(join(tmpdir(), "loanslam-persona-overwrite-")),
      "transcripts.jsonl",
    );
    const firstTranscript = await runPersonaScenario({
      scenario: scenario({ id: "first-run" }),
      corpus,
      planner: planner(supportedAnswerPlan()),
      now: () => new Date("2026-06-13T13:12:00.000Z"),
      idFactory: sequenceIds(),
    });
    const secondTranscript = await runPersonaScenario({
      scenario: scenario({ id: "second-run" }),
      corpus,
      planner: planner(supportedAnswerPlan()),
      now: () => new Date("2026-06-13T13:13:00.000Z"),
      idFactory: sequenceIds(),
    });

    writeTranscriptJsonl(transcriptPath, [firstTranscript]);
    writeTranscriptJsonl(transcriptPath, [secondTranscript]);

    const lines = readFileSync(transcriptPath, "utf8").trim().split("\n");

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "{}")).toEqual(
      expect.objectContaining({
        scenarioId: "second-run",
      }),
    );
  });
});
