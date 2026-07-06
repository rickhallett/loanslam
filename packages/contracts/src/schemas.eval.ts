import { z } from "zod";

import {
  intakeFieldSchema,
  nonEmptyStringSchema,
  plannerMetadataSchema,
  safetyFlagSchema,
  servingModeSchema,
  signalBundleSchema,
  signalExtractionComparisonSchema,
  signalExtractionStatusSchema,
  turnActionSchema,
  turnTraceSchema,
  uiPlanSchema,
  validatorOverrideSchema,
} from "./schemas.runtime";

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
  signalStatus: signalExtractionStatusSchema.optional(),
  signalBundle: signalBundleSchema.optional(),
  signalComparison: signalExtractionComparisonSchema.optional(),
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
