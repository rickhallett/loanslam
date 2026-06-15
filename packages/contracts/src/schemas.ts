import { z } from "zod";

export const servingModeSchema = z.enum([
  "answer",
  "handoff_account_specific",
  "route_vulnerability",
  "excluded",
]);
export type ServingMode = z.infer<typeof servingModeSchema>;

export const turnActionSchema = z.enum([
  "answer",
  "ask_clarifying_question",
  "request_handoff_intake",
  "create_ticket",
  "escalate",
  "refuse",
  "fallback",
]);
export type TurnAction = z.infer<typeof turnActionSchema>;

export const intakeFieldSchema = z.enum([
  "fullName",
  "dateOfBirth",
  "address",
  "phone",
  "email",
  "situationSummary",
]);
export type IntakeField = z.infer<typeof intakeFieldSchema>;

export const safetyFlagSchema = z.enum([
  "vulnerability",
  "distress",
  "complaint",
  "legal_threat",
  "accessibility_need",
  "hardship",
  "language_barrier",
  "account_specific_request",
  "change_request",
  "forbidden_credentials",
  "sensitive_overshare",
  "unsupported_request",
]);
export type SafetyFlag = z.infer<typeof safetyFlagSchema>;

export const uiPrimitiveSchema = z.enum([
  "message",
  "clarifying_prompt",
  "choice_list",
  "intake_form",
  "handoff_confirmation",
  "safe_fallback",
]);
export type UiPrimitive = z.infer<typeof uiPrimitiveSchema>;

const nonEmptyStringSchema = z.string().trim().min(1);

export const approvedLinkSchema = z.object({
  label: nonEmptyStringSchema,
  url: z.string().url().optional(),
  href: z.string().url().optional(),
});
export type ApprovedLink = z.infer<typeof approvedLinkSchema>;

const messageUiSchema = z.object({
  primitive: z.literal("message"),
  message: nonEmptyStringSchema,
  links: z.array(approvedLinkSchema).default([]),
});

const clarifyingPromptUiSchema = z.object({
  primitive: z.literal("clarifying_prompt"),
  message: nonEmptyStringSchema,
  questions: z.array(nonEmptyStringSchema).min(1),
});

const choiceListUiSchema = z.object({
  primitive: z.literal("choice_list"),
  message: nonEmptyStringSchema,
  choices: z
    .array(
      z.object({
        id: nonEmptyStringSchema,
        label: nonEmptyStringSchema,
      }),
    )
    .min(1)
    .max(6),
});

const intakeFormUiSchema = z.object({
  primitive: z.literal("intake_form"),
  message: nonEmptyStringSchema,
  fields: z.array(intakeFieldSchema).min(1),
});

const handoffConfirmationUiSchema = z.object({
  primitive: z.literal("handoff_confirmation"),
  message: nonEmptyStringSchema,
  reference: z.string().trim().optional(),
});

const safeFallbackUiSchema = z.object({
  primitive: z.literal("safe_fallback"),
  message: nonEmptyStringSchema,
  links: z.array(approvedLinkSchema).default([]),
});

export const uiPlanSchema = z.discriminatedUnion("primitive", [
  messageUiSchema,
  clarifyingPromptUiSchema,
  choiceListUiSchema,
  intakeFormUiSchema,
  handoffConfirmationUiSchema,
  safeFallbackUiSchema,
]);
export type UiPlan = z.infer<typeof uiPlanSchema>;

export const corpusItemSchema = z
  .object({
    id: nonEmptyStringSchema,
    section: z.string().trim().optional(),
    title: z.string().trim().optional(),
    intent: z.string().trim().optional(),
    question: nonEmptyStringSchema,
    question_variants: z.array(nonEmptyStringSchema).default([]),
    serving_mode: servingModeSchema,
    answer_text: z.string().trim().optional(),
    links: z.array(approvedLinkSchema).default([]),
    route_reason: z.string().trim().nullable().optional(),
    tags: z.array(nonEmptyStringSchema).default([]),
    source_type: z.string().trim().optional(),
    status: z.string().trim().optional(),
  })
  .superRefine((item, context) => {
    if (item.serving_mode === "answer" && !item.answer_text) {
      context.addIssue({
        code: "custom",
        path: ["answer_text"],
        message: "answer_text is required when serving_mode is answer",
      });
    }

    if (item.serving_mode !== "answer" && !item.route_reason) {
      context.addIssue({
        code: "custom",
        path: ["route_reason"],
        message:
          "route_reason is required when serving_mode routes or excludes an item",
      });
    }
  });
export type CorpusItem = z.infer<typeof corpusItemSchema>;

export const retrievedMatchSchema = z.object({
  itemId: nonEmptyStringSchema,
  score: z.number().finite().nonnegative(),
  servingMode: servingModeSchema,
  matchedTerms: z.array(nonEmptyStringSchema).default([]),
  item: corpusItemSchema.optional(),
});
export type RetrievedMatch = z.infer<typeof retrievedMatchSchema>;

export const conversationMessageSchema = z.object({
  id: nonEmptyStringSchema,
  role: z.enum(["customer", "assistant", "system"]),
  content: nonEmptyStringSchema,
  createdAt: z.string().datetime(),
});
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;

export const conversationStateSchema = z.object({
  conversationRef: nonEmptyStringSchema,
  history: z.array(conversationMessageSchema).default([]),
  collectedFacts: z.record(z.string(), z.string()).default({}),
  requestedFields: z.array(intakeFieldSchema).default([]),
  safetyFlags: z.array(safetyFlagSchema).default([]),
  lastAction: turnActionSchema.optional(),
  handoffPending: z.boolean().default(false),
});
export type ConversationState = z.infer<typeof conversationStateSchema>;

export const plannerMetadataSchema = z.object({
  provider: nonEmptyStringSchema,
  model: nonEmptyStringSchema,
  promptVersion: nonEmptyStringSchema,
});
export type PlannerMetadata = z.infer<typeof plannerMetadataSchema>;

export const turnPlannerInputSchema = z.object({
  conversationState: conversationStateSchema,
  userMessage: nonEmptyStringSchema,
  retrievedMatches: z.array(retrievedMatchSchema),
  allowedActions: z.array(turnActionSchema).default(turnActionSchema.options),
  allowedUiPrimitives: z
    .array(uiPrimitiveSchema)
    .default(uiPrimitiveSchema.options),
  policyVersion: nonEmptyStringSchema,
});
export type TurnPlannerInput = z.infer<typeof turnPlannerInputSchema>;

export const signalIntentSchema = z.enum([
  "answer",
  "account_specific",
  "vulnerability",
  "complaint",
  "legal",
  "excluded_advice",
  "language_barrier",
  "other",
]);
export type SignalIntent = z.infer<typeof signalIntentSchema>;

export const signalExtractorMetadataSchema = z.object({
  provider: nonEmptyStringSchema,
  model: nonEmptyStringSchema,
  promptVersion: nonEmptyStringSchema,
  schemaVersion: nonEmptyStringSchema,
});
export type SignalExtractorMetadata = z.infer<
  typeof signalExtractorMetadataSchema
>;

export const signalExtractionStatusSchema = z.enum([
  "disabled",
  "fulfilled",
  "failed",
  "timed_out",
]);
export type SignalExtractionStatus = z.infer<
  typeof signalExtractionStatusSchema
>;

export const signalBundleSchema = z.object({
  primaryIntent: signalIntentSchema,
  secondaryIntents: z.array(signalIntentSchema).default([]),
  recommendedServingMode: servingModeSchema.nullable(),
  safetySignals: z.array(safetyFlagSchema).default([]),
  retrievalQueries: z.array(nonEmptyStringSchema).default([]),
  routeHints: z.array(nonEmptyStringSchema).default([]),
  uncertainty: z.number().min(0).max(1),
  negatedOrCorrected: z.boolean().default(false),
  parserNotes: z.array(nonEmptyStringSchema).default([]),
});
export type SignalBundle = z.infer<typeof signalBundleSchema>;

export const signalExtractionComparisonSchema = z.object({
  status: z.enum(["match", "mismatch", "inconclusive"]),
  recommendedServingMode: servingModeSchema.nullable(),
  finalServingMode: servingModeSchema.nullable(),
  signalSafetyFlags: z.array(safetyFlagSchema).default([]),
  finalSafetyFlags: z.array(safetyFlagSchema).default([]),
  reasonCodes: z.array(nonEmptyStringSchema).default([]),
  parseStatus: z.enum(["ok", "failed", "disabled", "timed_out"]).default("ok"),
});
export type SignalExtractionComparison = z.infer<
  typeof signalExtractionComparisonSchema
>;

export const groundingDecisionSchema = z.object({
  citedItemIds: z.array(nonEmptyStringSchema),
  servingMode: servingModeSchema,
  confidence: z.enum(["supported", "partial", "unsupported"]),
  notes: z.string().trim().optional(),
});
export type GroundingDecision = z.infer<typeof groundingDecisionSchema>;

export const turnPlanSchema = z.object({
  action: turnActionSchema,
  customerMessage: nonEmptyStringSchema,
  ui: uiPlanSchema,
  reasonCode: nonEmptyStringSchema,
  collectedFacts: z.record(z.string(), z.string()).default({}),
  requestedFields: z.array(intakeFieldSchema).default([]),
  grounding: groundingDecisionSchema.nullable(),
  safetyFlags: z.array(safetyFlagSchema).default([]),
  traceSummary: nonEmptyStringSchema,
});
export type TurnPlan = z.infer<typeof turnPlanSchema>;

export const validatorOverrideSchema = z.object({
  code: nonEmptyStringSchema,
  reason: nonEmptyStringSchema,
  fromAction: turnActionSchema.optional(),
  toAction: turnActionSchema,
});
export type ValidatorOverride = z.infer<typeof validatorOverrideSchema>;

export const turnTraceSchema = z.object({
  traceId: nonEmptyStringSchema,
  journeyId: z.string().trim().optional(),
  turnIndex: z.number().int().nonnegative(),
  conversationRef: nonEmptyStringSchema,
  requestRef: nonEmptyStringSchema,
  inboundMessageId: nonEmptyStringSchema,
  outboundMessageId: nonEmptyStringSchema,
  planner: plannerMetadataSchema,
  policyVersion: nonEmptyStringSchema,
  retrievedMatches: z.array(retrievedMatchSchema),
  selectedServingMode: servingModeSchema.nullable(),
  effectiveServingMode: servingModeSchema.nullable().optional(),
  selectedRouteReason: z.string().trim().nullable().optional(),
  proposedAction: turnActionSchema,
  finalAction: turnActionSchema,
  shadowSignalStatus: signalExtractionStatusSchema.optional(),
  shadowSignalMetadata: signalExtractorMetadataSchema.optional(),
  shadowSignalLatencyMs: z.number().nonnegative().optional(),
  shadowSignalError: z.string().trim().optional(),
  shadowSignalBundle: signalBundleSchema.optional(),
  shadowSignalComparison: signalExtractionComparisonSchema.optional(),
  validatorOverrides: z.array(validatorOverrideSchema).default([]),
  safetyFlags: z.array(safetyFlagSchema).default([]),
  customerMessage: nonEmptyStringSchema,
  createdAt: z.string().datetime(),
});
export type TurnTrace = z.infer<typeof turnTraceSchema>;

export const validatedTurnResultSchema = z.object({
  conversationRef: nonEmptyStringSchema,
  requestRef: nonEmptyStringSchema,
  state: conversationStateSchema,
  plan: turnPlanSchema,
  finalAction: turnActionSchema,
  ui: uiPlanSchema,
  customerMessage: nonEmptyStringSchema,
  validatorOverrides: z.array(validatorOverrideSchema).default([]),
  trace: turnTraceSchema,
});
export type ValidatedTurnResult = z.infer<typeof validatedTurnResultSchema>;

export const journeyExpectationSchema = z.object({
  allowedFinalActions: z.array(turnActionSchema).min(1),
  requiredFinalAction: turnActionSchema.optional(),
  requiredServingModes: z.array(servingModeSchema).default([]),
  forbiddenServingModes: z.array(servingModeSchema).default([]),
  requiredSafetyFlags: z.array(safetyFlagSchema).default([]),
  forbiddenBehaviors: z.array(nonEmptyStringSchema).default([]),
  maxClarificationTurns: z.number().int().nonnegative().optional(),
  notes: z.string().trim().optional(),
});
export type JourneyExpectation = z.infer<typeof journeyExpectationSchema>;

export const journeyFixtureSchema = z.object({
  id: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  description: z.string().trim().optional(),
  customerTurns: z.array(nonEmptyStringSchema).min(1),
  expectation: journeyExpectationSchema,
  tags: z.array(nonEmptyStringSchema).default([]),
});
export type JourneyFixture = z.infer<typeof journeyFixtureSchema>;

export const journeyReportSchema = z.object({
  journeyId: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  passed: z.boolean(),
  turns: z.number().int().nonnegative(),
  finalAction: turnActionSchema,
  validatorOverrideCount: z.number().int().nonnegative(),
  caughtUnsafeProposals: z.number().int().nonnegative(),
  vulnerabilityMisses: z.number().int().nonnegative(),
  repeatedQuestionCount: z.number().int().nonnegative(),
  uxNotes: z.array(nonEmptyStringSchema).default([]),
  traces: z.array(turnTraceSchema),
});
export type JourneyReport = z.infer<typeof journeyReportSchema>;

export const personaProfileSchema = z.object({
  id: nonEmptyStringSchema,
  label: nonEmptyStringSchema,
  traits: z.array(nonEmptyStringSchema).min(1),
  styleNotes: nonEmptyStringSchema,
});
export type PersonaProfile = z.infer<typeof personaProfileSchema>;

export const personaScenarioSchema = z.object({
  id: nonEmptyStringSchema,
  title: nonEmptyStringSchema,
  description: z.string().trim().optional(),
  persona: personaProfileSchema,
  objective: nonEmptyStringSchema,
  customerTurns: z.array(nonEmptyStringSchema).min(1),
  tags: z.array(nonEmptyStringSchema).default([]),
});
export type PersonaScenario = z.infer<typeof personaScenarioSchema>;

export const transcriptTurnSchema = z.object({
  turnIndex: z.number().int().nonnegative(),
  userMessage: nonEmptyStringSchema,
  botMessage: nonEmptyStringSchema,
  proposedAction: turnActionSchema,
  finalAction: turnActionSchema,
  selectedServingMode: servingModeSchema.nullable(),
  effectiveServingMode: servingModeSchema.nullable().optional(),
  selectedRouteReason: z.string().trim().nullable().optional(),
  safetyFlags: z.array(safetyFlagSchema).default([]),
  validatorOverrideCodes: z.array(nonEmptyStringSchema).default([]),
  retrievedItemIds: z.array(nonEmptyStringSchema).default([]),
  requestedFields: z.array(intakeFieldSchema).default([]),
  collectedFacts: z.record(z.string(), z.string()).default({}),
  ui: uiPlanSchema,
  traceId: nonEmptyStringSchema,
  requestRef: nonEmptyStringSchema,
  createdAt: z.string().datetime(),
});
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;

export const conversationTranscriptSchema = z.object({
  transcriptId: nonEmptyStringSchema,
  scenarioId: nonEmptyStringSchema,
  scenarioTitle: nonEmptyStringSchema,
  persona: personaProfileSchema,
  planner: plannerMetadataSchema,
  policyVersion: nonEmptyStringSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  turns: z.array(transcriptTurnSchema).min(1),
  finalAction: turnActionSchema,
  validatorOverrideCount: z.number().int().nonnegative(),
  caughtUnsafeProposals: z.number().int().nonnegative(),
  vulnerabilityHandled: z.boolean(),
  tags: z.array(nonEmptyStringSchema).default([]),
});
export type ConversationTranscript = z.infer<
  typeof conversationTranscriptSchema
>;

export const personaReportSchema = z.object({
  runId: nonEmptyStringSchema,
  createdAt: z.string().datetime(),
  planner: plannerMetadataSchema,
  policyVersion: nonEmptyStringSchema,
  metrics: z.object({
    transcriptCount: z.number().int().nonnegative(),
    turnCount: z.number().int().nonnegative(),
    personaCount: z.number().int().nonnegative(),
    handoffRate: z.number().min(0).max(1),
    answerRate: z.number().min(0).max(1),
    clarificationRate: z.number().min(0).max(1),
    validatorOverrideRate: z.number().min(0).max(1),
    caughtUnsafeProposals: z.number().int().nonnegative(),
    vulnerabilityHandledCount: z.number().int().nonnegative(),
  }),
  perPersonaActionCounts: z
    .record(z.string(), z.record(z.string(), z.number().int().nonnegative()))
    .default({}),
  failureModes: z.array(nonEmptyStringSchema).default([]),
  transcriptOutputPath: z.string().trim().optional(),
});
export type PersonaReport = z.infer<typeof personaReportSchema>;

export const modelComparisonReportSchema = z.object({
  runId: nonEmptyStringSchema,
  createdAt: z.string().datetime(),
  policyVersion: nonEmptyStringSchema,
  planner: plannerMetadataSchema,
  journeyReports: z.array(journeyReportSchema),
  metrics: z.object({
    journeyCount: z.number().int().nonnegative(),
    passCount: z.number().int().nonnegative(),
    groundedAnswerRate: z.number().min(0).max(1),
    unnecessaryHandoffRate: z.number().min(0).max(1),
    caughtUnsafeProposals: z.number().int().nonnegative(),
    validatorOverrideRate: z.number().min(0).max(1),
    vulnerabilityMissRate: z.number().min(0).max(1),
    malformedPlanRate: z.number().min(0).max(1),
    averageTurnsToResolution: z.number().nonnegative(),
    estimatedCostUsd: z.number().nonnegative().optional(),
    averageLatencyMs: z.number().nonnegative().optional(),
  }),
  failureModes: z.array(nonEmptyStringSchema).default([]),
  recommendation: z.string().trim().optional(),
});
export type ModelComparisonReport = z.infer<typeof modelComparisonReportSchema>;

export const stochasticProfileSchema = z.enum(["smoke", "review", "soak"]);
export type StochasticProfile = z.infer<typeof stochasticProfileSchema>;

export const stochasticVerdictSchema = z.enum([
  "blocked",
  "useful_with_findings",
  "promote_to_v2_planning",
]);
export type StochasticVerdict = z.infer<typeof stochasticVerdictSchema>;

export const stochasticAxisValuesSchema = z
  .object({
    intent: z.enum([
      "faq",
      "account_specific",
      "vulnerability",
      "complaint",
      "excluded",
      "ambiguous",
    ]),
    personaStyle: z.enum([
      "cooperative",
      "terse",
      "confused",
      "impatient",
      "adversarial",
      "vulnerable",
    ]),
    journeyShape: z.enum([
      "single_turn",
      "multi_turn",
      "repeated",
      "topic_switch",
    ]),
    languageNoise: z.enum(["clean", "typo", "vague", "emotional", "overshare"]),
    riskMarker: z.enum([
      "none",
      "pii",
      "forbidden_credentials",
      "hardship",
      "legal_threat",
    ]),
  })
  .strict();
export type StochasticAxisValues = z.infer<typeof stochasticAxisValuesSchema>;

export const stochasticExpectationSchema = z.object({
  allowedFinalActions: z.array(turnActionSchema).min(1),
  requiredServingModes: z.array(servingModeSchema).default([]),
  forbiddenServingModes: z.array(servingModeSchema).default([]),
  requiredSafetyFlags: z.array(safetyFlagSchema).default([]),
  forbiddenBehaviors: z.array(nonEmptyStringSchema).default([]),
  maxClarificationTurns: z.number().int().nonnegative().optional(),
  notes: z.string().trim().optional(),
});
export type StochasticExpectation = z.infer<typeof stochasticExpectationSchema>;

export const stochasticScenarioSchema = z.object({
  scenarioPath: nonEmptyStringSchema,
  persona: z.union([
    personaProfileSchema,
    z.object({
      id: nonEmptyStringSchema,
      label: z.string().trim().optional(),
      style: stochasticAxisValuesSchema.shape.personaStyle.optional(),
      traits: z.array(nonEmptyStringSchema).default([]),
      styleNotes: z.string().trim().optional(),
    }),
    nonEmptyStringSchema,
  ]),
  objective: nonEmptyStringSchema,
  customerTurns: z.array(nonEmptyStringSchema).min(1),
  axisValues: stochasticAxisValuesSchema,
  expectation: stochasticExpectationSchema,
  generatorTemplateId: nonEmptyStringSchema,
  seed: nonEmptyStringSchema,
});
export type StochasticScenario = z.infer<typeof stochasticScenarioSchema>;

export const stochasticTraceRowSchema = z.object({
  scenarioPath: nonEmptyStringSchema,
  turnIndex: z.number().int().nonnegative(),
  userMessage: nonEmptyStringSchema,
  customerMessage: nonEmptyStringSchema,
  proposedAction: turnActionSchema,
  finalAction: turnActionSchema,
  selectedServingMode: servingModeSchema.nullable(),
  effectiveServingMode: servingModeSchema.nullable().optional(),
  safetyFlags: z.array(safetyFlagSchema).default([]),
  validatorOverrides: z.array(validatorOverrideSchema).default([]),
  validatorOverrideCodes: z.array(nonEmptyStringSchema).default([]),
  retrievedItemIds: z.array(nonEmptyStringSchema).default([]),
  shadowSignalStatus: signalExtractionStatusSchema.optional(),
  shadowSignalBundle: signalBundleSchema.optional(),
  shadowSignalComparison: signalExtractionComparisonSchema.optional(),
  traceId: nonEmptyStringSchema,
  requestRef: nonEmptyStringSchema,
});
export type StochasticTraceRow = z.infer<typeof stochasticTraceRowSchema>;

export const stochasticHardFailureCategorySchema = z.enum([
  "account_specific_answer",
  "ungrounded_answer",
  "missed_vulnerability",
  "excluded_advice_answered",
  "forbidden_credential_request",
  "clarification_loop",
  "malformed_or_unsupported_state",
  "replayability_loss",
]);
export type StochasticHardFailureCategory = z.infer<
  typeof stochasticHardFailureCategorySchema
>;

export const stochasticHardFailureSchema = z.object({
  category: stochasticHardFailureCategorySchema,
  scenarioPath: nonEmptyStringSchema,
  message: nonEmptyStringSchema,
  turnIndex: z.number().int().nonnegative().optional(),
  traceId: nonEmptyStringSchema.optional(),
  replayCommand: nonEmptyStringSchema.optional(),
});
export type StochasticHardFailure = z.infer<typeof stochasticHardFailureSchema>;

export const stochasticFindingSchema = z.object({
  category: nonEmptyStringSchema,
  message: nonEmptyStringSchema,
  scenarioPath: nonEmptyStringSchema.optional(),
  scenarioPaths: z.array(nonEmptyStringSchema).optional(),
  axisValues: stochasticAxisValuesSchema.optional(),
  replayCommand: nonEmptyStringSchema.optional(),
});
export type StochasticFinding = z.infer<typeof stochasticFindingSchema>;

const makeStochasticAxisCoverageEntrySchema = <ValueSchema extends z.ZodType>(
  valueSchema: ValueSchema,
) =>
  z.object({
    coveredValues: z.array(valueSchema),
    missingValues: z.array(valueSchema).default([]),
    sampleCount: z.number().int().nonnegative().optional(),
  });

const stochasticAxisCoverageSchema = z
  .object({
    intent: makeStochasticAxisCoverageEntrySchema(
      stochasticAxisValuesSchema.shape.intent,
    ).optional(),
    personaStyle: makeStochasticAxisCoverageEntrySchema(
      stochasticAxisValuesSchema.shape.personaStyle,
    ).optional(),
    journeyShape: makeStochasticAxisCoverageEntrySchema(
      stochasticAxisValuesSchema.shape.journeyShape,
    ).optional(),
    languageNoise: makeStochasticAxisCoverageEntrySchema(
      stochasticAxisValuesSchema.shape.languageNoise,
    ).optional(),
    riskMarker: makeStochasticAxisCoverageEntrySchema(
      stochasticAxisValuesSchema.shape.riskMarker,
    ).optional(),
  })
  .strict();

export const stochasticCoverageReportSchema = z.object({
  axisCoverage: stochasticAxisCoverageSchema.default({}),
  coverageGaps: z.array(nonEmptyStringSchema).default([]),
  highRiskIntentSpread: z
    .array(
      z.object({
        intent: stochasticAxisValuesSchema.shape.intent,
        coveredPersonaStyles: z.array(
          stochasticAxisValuesSchema.shape.personaStyle,
        ),
        missingPersonaStyles: z
          .array(stochasticAxisValuesSchema.shape.personaStyle)
          .default([]),
      }),
    )
    .default([]),
  hardFailureTemplateCoverage: z
    .array(
      z.object({
        category: stochasticHardFailureCategorySchema,
        templateIds: z.array(nonEmptyStringSchema).default([]),
        covered: z.boolean(),
      }),
    )
    .default([]),
});
export type StochasticCoverageReport = z.infer<
  typeof stochasticCoverageReportSchema
>;

export const stochasticReplayCommandsSchema = z.object({
  fullRunCommand: nonEmptyStringSchema,
  topFindingCommands: z.array(nonEmptyStringSchema).default([]),
  hardFailureCommands: z.array(nonEmptyStringSchema).default([]),
});
export type StochasticReplayCommands = z.infer<
  typeof stochasticReplayCommandsSchema
>;

const stochasticRunArtifactBaseSchema = z.object({
  seed: nonEmptyStringSchema,
  profile: stochasticProfileSchema,
  stsVersion: nonEmptyStringSchema,
  templateSetVersion: nonEmptyStringSchema,
  policyVersion: nonEmptyStringSchema,
  corpusFingerprint: nonEmptyStringSchema,
  generatedAt: z.string().datetime(),
  planner: plannerMetadataSchema,
  scenarioCount: z.number().int().min(1),
  artifacts: z.object({
    runJson: nonEmptyStringSchema,
    scenariosJsonl: nonEmptyStringSchema,
    tracesJsonl: nonEmptyStringSchema,
    summaryMarkdown: nonEmptyStringSchema,
    dashboardHtml: nonEmptyStringSchema,
  }),
  verdictReasons: z.array(nonEmptyStringSchema).min(1),
  hardFailures: z.array(stochasticHardFailureSchema).default([]),
  findings: z.array(stochasticFindingSchema).default([]),
  coverage: stochasticCoverageReportSchema,
  replay: stochasticReplayCommandsSchema,
});

const stochasticBlockedRunArtifactSchema = stochasticRunArtifactBaseSchema
  .extend({
    verdict: z.literal("blocked"),
    promotionStatus: z.never().optional(),
  })
  .superRefine((artifact, context) => {
    if (Object.prototype.hasOwnProperty.call(artifact, "promotionStatus")) {
      context.addIssue({
        code: "custom",
        path: ["promotionStatus"],
        message:
          "promotionStatus is only allowed for promote_to_v2_planning verdicts",
      });
    }
  });

const stochasticUsefulWithFindingsRunArtifactSchema =
  stochasticRunArtifactBaseSchema
    .extend({
      verdict: z.literal("useful_with_findings"),
      promotionStatus: z.never().optional(),
    })
    .superRefine((artifact, context) => {
      if (Object.prototype.hasOwnProperty.call(artifact, "promotionStatus")) {
        context.addIssue({
          code: "custom",
          path: ["promotionStatus"],
          message:
            "promotionStatus is only allowed for promote_to_v2_planning verdicts",
        });
      }
    });

const stochasticPromotionRunArtifactSchema =
  stochasticRunArtifactBaseSchema.extend({
    verdict: z.literal("promote_to_v2_planning"),
    promotionStatus: z.literal("provisional"),
  });

export const stochasticRunArtifactSchema = z.discriminatedUnion("verdict", [
  stochasticBlockedRunArtifactSchema,
  stochasticUsefulWithFindingsRunArtifactSchema,
  stochasticPromotionRunArtifactSchema,
]);
export type StochasticRunArtifact = z.infer<typeof stochasticRunArtifactSchema>;

type AssertTrue<T extends true> = T;
type IsNever<T> = [T] extends [never] ? true : false;

type StochasticPromotionArtifact = Extract<
  StochasticRunArtifact,
  { verdict: "promote_to_v2_planning" }
>;
type StochasticBlockedArtifact = Extract<
  StochasticRunArtifact,
  { verdict: "blocked" }
>;
type StochasticUsefulWithFindingsArtifact = Extract<
  StochasticRunArtifact,
  { verdict: "useful_with_findings" }
>;

type _StochasticPromotionBranchExists = AssertTrue<
  IsNever<StochasticPromotionArtifact> extends false ? true : false
>;
type _StochasticBlockedBranchExists = AssertTrue<
  IsNever<StochasticBlockedArtifact> extends false ? true : false
>;
type _StochasticUsefulWithFindingsBranchExists = AssertTrue<
  IsNever<StochasticUsefulWithFindingsArtifact> extends false ? true : false
>;

type _StochasticPromotionStatusRequired = AssertTrue<
  StochasticPromotionArtifact extends { promotionStatus: "provisional" }
    ? true
    : false
>;
type StochasticBlockedWithPromotionStatus = Omit<
  StochasticBlockedArtifact,
  "verdict" | "promotionStatus"
> & {
  verdict: "blocked";
  promotionStatus: "provisional";
};
type StochasticUsefulWithFindingsWithPromotionStatus = Omit<
  StochasticUsefulWithFindingsArtifact,
  "verdict" | "promotionStatus"
> & {
  verdict: "useful_with_findings";
  promotionStatus: "provisional";
};
type _StochasticBlockedPromotionStatusRejected = AssertTrue<
  StochasticBlockedWithPromotionStatus extends StochasticRunArtifact
    ? false
    : true
>;
type _StochasticUsefulWithFindingsPromotionStatusRejected = AssertTrue<
  StochasticUsefulWithFindingsWithPromotionStatus extends StochasticRunArtifact
    ? false
    : true
>;

export type TurnPlanner = {
  planTurn(input: TurnPlannerInput): Promise<TurnPlan>;
};

export type SignalInput = {
  conversationState: ConversationState;
  userMessage: string;
  abortSignal?: AbortSignal;
};

export type SignalExtractor = {
  metadata?: SignalExtractorMetadata;
  extractSignals(input: SignalInput): Promise<SignalBundle>;
};
