import { describe, expect, it } from "vitest";

import {
  conversationTranscriptSchema,
  corpusItemSchema,
  intakeFieldSchema,
  personaProfileSchema,
  personaReportSchema,
  personaScenarioSchema,
  stochasticAxisValuesSchema,
  stochasticCoverageReportSchema,
  stochasticFindingSchema,
  stochasticHardFailureSchema,
  stochasticProfileSchema,
  stochasticRunArtifactSchema,
  stochasticVerdictSchema,
  turnPlanSchema,
  turnTraceSchema,
} from "./schemas";

const baseUi = {
  primitive: "message",
  message: "You can apply online and we will explain the next steps.",
  links: [
    {
      label: "Apply online",
      url: "https://www.loanslam.example/apply",
    },
  ],
};

describe("TurnPlanner contract schemas", () => {
  it("parses a valid TurnPlan", () => {
    expect(() =>
      turnPlanSchema.parse({
        action: "answer",
        customerMessage:
          "You can apply online. The application form explains what happens next.",
        ui: baseUi,
        reasonCode: "grounded_application_process_answer",
        collectedFacts: {
          topic: "application",
        },
        requestedFields: [],
        grounding: {
          citedItemIds: ["faq-application-process"],
          servingMode: "answer",
          confidence: "supported",
        },
        safetyFlags: [],
        traceSummary: "Answered from the application process FAQ.",
      }),
    ).not.toThrow();
  });

  it("rejects an invalid action", () => {
    const result = turnPlanSchema.safeParse({
      action: "refund",
      customerMessage: "I can refund that now.",
      ui: baseUi,
      reasonCode: "invalid_refund",
      collectedFacts: {},
      requestedFields: [],
      grounding: null,
      safetyFlags: [],
      traceSummary: "Invalid action should not be accepted.",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid UI primitive", () => {
    const result = turnPlanSchema.safeParse({
      action: "fallback",
      customerMessage: "I need to pass this to the team.",
      ui: {
        primitive: "modal",
        message: "Unsupported frontend instruction",
      },
      reasonCode: "unsupported_ui",
      collectedFacts: {},
      requestedFields: [],
      grounding: null,
      safetyFlags: [],
      traceSummary: "Arbitrary UI primitives are not allowed.",
    });

    expect(result.success).toBe(false);
  });

  it("requires answer_text on answer corpus items", () => {
    const result = corpusItemSchema.safeParse({
      id: "faq-missing-answer",
      title: "Missing answer text",
      serving_mode: "answer",
      question: "How do I apply?",
      tags: [],
    });

    expect(result.success).toBe(false);
  });

  it("allows non-answer corpus items to omit answer_text", () => {
    expect(() =>
      corpusItemSchema.parse({
        id: "settlement-figure",
        title: "Settlement figure requests",
        serving_mode: "handoff_account_specific",
        question: "Can I get my settlement figure?",
        route_reason:
          "Settlement figures are account-specific and need a human handoff.",
        tags: ["settlement"],
      }),
    ).not.toThrow();
  });

  it("requires route_reason on policy-routing corpus items", () => {
    const result = corpusItemSchema.safeParse({
      id: "excluded-no-reason",
      title: "Personal APR",
      serving_mode: "excluded",
      question: "What APR will I get?",
      tags: ["apr"],
    });

    expect(result.success).toBe(false);
  });

  it("keeps handoff fields as exact enum values", () => {
    expect(intakeFieldSchema.options).toEqual([
      "fullName",
      "dateOfBirth",
      "address",
      "phone",
      "email",
      "situationSummary",
    ]);
  });

  it("preserves validator override reasons in traces", () => {
    const trace = turnTraceSchema.parse({
      traceId: "trace-1",
      journeyId: "application-status",
      turnIndex: 2,
      conversationRef: "conv-1",
      requestRef: "req-1",
      inboundMessageId: "in-1",
      outboundMessageId: "out-1",
      planner: {
        provider: "openai",
        model: "gpt-test",
        promptVersion: "phase0-test",
      },
      policyVersion: "phase0-contracts",
      retrievedMatches: [],
      selectedServingMode: "handoff_account_specific",
      selectedRouteReason:
        "The anonymous chat cannot access account-specific status.",
      proposedAction: "answer",
      finalAction: "request_handoff_intake",
      validatorOverrides: [
        {
          code: "account_specific_answer_blocked",
          reason:
            "Account-specific status cannot be answered from anonymous chat.",
          fromAction: "answer",
          toAction: "request_handoff_intake",
        },
      ],
      safetyFlags: [],
      customerMessage: "I can help the team look into your application status.",
      createdAt: "2026-06-13T12:00:00.000Z",
    });

    expect(trace.validatorOverrides).toEqual([
      expect.objectContaining({
        code: "account_specific_answer_blocked",
        reason:
          "Account-specific status cannot be answered from anonymous chat.",
      }),
    ]);
    expect(trace.selectedRouteReason).toBe(
      "The anonymous chat cannot access account-specific status.",
    );
  });

  it("requires persona profiles to describe both traits and style", () => {
    const result = personaProfileSchema.safeParse({
      id: "cooperative",
      label: "Cooperative customer",
      traits: ["patient", "clear"],
      styleNotes: "Answers follow-up questions directly.",
    });

    expect(result.success).toBe(true);
    expect(
      personaProfileSchema.safeParse({
        id: "empty-persona",
        label: "Empty persona",
        traits: [],
        styleNotes: "Missing traits should fail.",
      }).success,
    ).toBe(false);
  });

  it("requires persona scenarios to contain at least one customer turn", () => {
    expect(
      personaScenarioSchema.safeParse({
        id: "cooperative-apply",
        title: "Cooperative application question",
        persona: {
          id: "cooperative",
          label: "Cooperative customer",
          traits: ["patient"],
          styleNotes: "Clear and direct.",
        },
        objective: "Ask how to apply.",
        customerTurns: ["How do I apply online?"],
        tags: ["answerable"],
      }).success,
    ).toBe(true);

    expect(
      personaScenarioSchema.safeParse({
        id: "no-turns",
        title: "No turns",
        persona: {
          id: "cooperative",
          label: "Cooperative customer",
          traits: ["patient"],
          styleNotes: "Clear and direct.",
        },
        objective: "Invalid scenario.",
        customerTurns: [],
      }).success,
    ).toBe(false);
  });

  it("preserves exact message sequences and trace facts in transcripts", () => {
    const transcript = conversationTranscriptSchema.parse({
      transcriptId: "transcript-1",
      scenarioId: "scenario-1",
      scenarioTitle: "Cooperative application question",
      persona: {
        id: "cooperative",
        label: "Cooperative customer",
        traits: ["patient"],
        styleNotes: "Clear and direct.",
      },
      planner: {
        provider: "openai",
        model: "gpt-test",
        promptVersion: "phase0-test",
      },
      policyVersion: "phase0-contracts",
      startedAt: "2026-06-13T12:00:00.000Z",
      completedAt: "2026-06-13T12:01:00.000Z",
      turns: [
        {
          turnIndex: 0,
          userMessage: "How do I apply?",
          botMessage: "You can apply online.",
          proposedAction: "answer",
          finalAction: "answer",
          selectedServingMode: "answer",
          selectedRouteReason: null,
          safetyFlags: [],
          validatorOverrideCodes: [],
          retrievedItemIds: ["how-do-i-apply"],
          requestedFields: ["fullName", "email"],
          collectedFacts: {
            topic: "application",
          },
          ui: {
            primitive: "message",
            message: "You can apply online.",
            links: [],
          },
          traceId: "trace-1",
          requestRef: "request-1",
          createdAt: "2026-06-13T12:00:00.000Z",
        },
      ],
      finalAction: "answer",
      validatorOverrideCount: 0,
      caughtUnsafeProposals: 0,
      vulnerabilityHandled: false,
      tags: ["answerable"],
    });

    expect(transcript.turns[0]).toEqual(
      expect.objectContaining({
        userMessage: "How do I apply?",
        botMessage: "You can apply online.",
        retrievedItemIds: ["how-do-i-apply"],
        requestedFields: ["fullName", "email"],
        collectedFacts: {
          topic: "application",
        },
      }),
    );
  });

  it("summarises persona evidence reports without hiding exact transcripts", () => {
    const report = personaReportSchema.parse({
      runId: "persona-run-1",
      createdAt: "2026-06-13T12:00:00.000Z",
      planner: {
        provider: "openai",
        model: "gpt-test",
        promptVersion: "phase0-test",
      },
      policyVersion: "phase0-contracts",
      metrics: {
        transcriptCount: 2,
        turnCount: 4,
        personaCount: 2,
        handoffRate: 0.5,
        answerRate: 0.25,
        clarificationRate: 0.25,
        validatorOverrideRate: 0.5,
        caughtUnsafeProposals: 1,
        vulnerabilityHandledCount: 1,
      },
      perPersonaActionCounts: {
        cooperative: {
          answer: 1,
        },
        adversarial: {
          request_handoff_intake: 1,
        },
      },
      failureModes: ["adversarial-card-details: forbidden_credentials"],
      transcriptOutputPath: "artifacts/phase0/persona-transcripts.jsonl",
    });

    expect(report.metrics.personaCount).toBe(2);
    expect(report.perPersonaActionCounts.adversarial).toEqual({
      request_handoff_intake: 1,
    });
  });

  it("keeps STS profile and verdict values exact", () => {
    expect(stochasticProfileSchema.options).toEqual([
      "smoke",
      "review",
      "soak",
    ]);
    expect(stochasticVerdictSchema.options).toEqual([
      "blocked",
      "useful_with_findings",
      "promote_to_v2_planning",
    ]);
  });

  it("parses sampled STS coverage axes", () => {
    expect(() =>
      stochasticAxisValuesSchema.parse({
        intent: "account_specific",
        personaStyle: "impatient",
        journeyShape: "topic_switch",
        languageNoise: "vague",
        riskMarker: "pii",
      }),
    ).not.toThrow();
  });

  it("rejects extra STS axis value keys", () => {
    const result = stochasticAxisValuesSchema.safeParse({
      intent: "account_specific",
      personaStyle: "impatient",
      journeyShape: "topic_switch",
      languageNoise: "vague",
      riskMarker: "pii",
      intentt: "faq",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid STS coverage axis keys and values", () => {
    expect(
      stochasticCoverageReportSchema.safeParse({
        axisCoverage: {
          intentt: {
            coveredValues: ["faq"],
          },
        },
        coverageGaps: [],
        highRiskIntentSpread: [],
        hardFailureTemplateCoverage: [],
      }).success,
    ).toBe(false);

    expect(
      stochasticCoverageReportSchema.safeParse({
        axisCoverage: {
          intent: {
            coveredValues: ["faq", "made_up_intent"],
          },
        },
        coverageGaps: [],
        highRiskIntentSpread: [],
        hardFailureTemplateCoverage: [],
      }).success,
    ).toBe(false);
  });

  it("rejects blank optional STS replay commands in failures and findings", () => {
    expect(
      stochasticHardFailureSchema.safeParse({
        category: "replayability_loss",
        scenarioPath: "review/001/faq/cooperative/single-turn",
        message: "Replay command was missing.",
        replayCommand: "   ",
      }).success,
    ).toBe(false);

    expect(
      stochasticFindingSchema.safeParse({
        category: "weak_clarification",
        message: "Clarification was safe but too vague.",
        replayCommand: "",
      }).success,
    ).toBe(false);
  });

  it("requires provisional promotion status for STS promotion verdicts", () => {
    const base = {
      seed: "2026-06-14-demo",
      profile: "review",
      stsVersion: "sts-v1",
      templateSetVersion: "sts-templates-v1",
      policyVersion: "phase0-turnplanner-policy-v1",
      corpusFingerprint: "sha256-test",
      generatedAt: "2026-06-14T12:00:00.000Z",
      planner: {
        provider: "openai",
        model: "gpt-test",
        promptVersion: "phase0-test",
      },
      scenarioCount: 1,
      artifacts: {
        runJson: "artifacts/phase0/stochastic-run-2026-06-14-demo.json",
        scenariosJsonl:
          "artifacts/phase0/stochastic-scenarios-2026-06-14-demo.jsonl",
        tracesJsonl: "artifacts/phase0/stochastic-traces-2026-06-14-demo.jsonl",
        summaryMarkdown:
          "artifacts/phase0/stochastic-summary-2026-06-14-demo.md",
        dashboardHtml:
          "artifacts/phase0/stochastic-dashboard-2026-06-14-demo.html",
      },
      verdict: "promote_to_v2_planning",
      verdictReasons: ["No hard failures observed."],
      hardFailures: [],
      findings: [],
      coverage: {
        axisCoverage: {},
        coverageGaps: [],
        highRiskIntentSpread: [],
        hardFailureTemplateCoverage: [],
      },
      replay: {
        fullRunCommand:
          "just core-stochastic -- --seed 2026-06-14-demo --profile review",
        topFindingCommands: [],
        hardFailureCommands: [],
      },
    };

    expect(stochasticRunArtifactSchema.safeParse(base).success).toBe(false);
    expect(
      stochasticRunArtifactSchema.safeParse({
        ...base,
        promotionStatus: "provisional",
      }).success,
    ).toBe(true);
    expect(
      stochasticRunArtifactSchema.safeParse({
        ...base,
        scenarioCount: 0,
        promotionStatus: "provisional",
      }).success,
    ).toBe(false);
  });

  it("rejects provisional promotion status for non-promotion STS verdicts", () => {
    const base = {
      seed: "2026-06-14-demo",
      profile: "review",
      stsVersion: "sts-v1",
      templateSetVersion: "sts-templates-v1",
      policyVersion: "phase0-turnplanner-policy-v1",
      corpusFingerprint: "sha256-test",
      generatedAt: "2026-06-14T12:00:00.000Z",
      planner: {
        provider: "openai",
        model: "gpt-test",
        promptVersion: "phase0-test",
      },
      scenarioCount: 1,
      artifacts: {
        runJson: "artifacts/phase0/stochastic-run-2026-06-14-demo.json",
        scenariosJsonl:
          "artifacts/phase0/stochastic-scenarios-2026-06-14-demo.jsonl",
        tracesJsonl: "artifacts/phase0/stochastic-traces-2026-06-14-demo.jsonl",
        summaryMarkdown:
          "artifacts/phase0/stochastic-summary-2026-06-14-demo.md",
        dashboardHtml:
          "artifacts/phase0/stochastic-dashboard-2026-06-14-demo.html",
      },
      verdict: "useful_with_findings",
      verdictReasons: ["Useful behavioral findings observed."],
      hardFailures: [],
      findings: [],
      coverage: {
        axisCoverage: {},
        coverageGaps: [],
        highRiskIntentSpread: [],
        hardFailureTemplateCoverage: [],
      },
      replay: {
        fullRunCommand:
          "just core-stochastic -- --seed 2026-06-14-demo --profile review",
        topFindingCommands: [],
        hardFailureCommands: [],
      },
    };

    expect(
      stochasticRunArtifactSchema.safeParse({
        ...base,
        promotionStatus: "provisional",
      }).success,
    ).toBe(false);
    expect(
      stochasticRunArtifactSchema.safeParse({
        ...base,
        promotionStatus: undefined,
      }).success,
    ).toBe(false);
  });
});
