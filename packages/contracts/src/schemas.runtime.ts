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
  "postcode",
  "email",
  "phone",
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

export const nonEmptyStringSchema = z.string().trim().min(1);

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
  plannerLatencyMs: z.number().nonnegative().optional(),
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

export const demoHostContextSchema = z.enum([
  "vulnerability",
  "handoff",
  "general",
]);
export type DemoHostContext = z.infer<typeof demoHostContextSchema>;

export const demoTelemetrySourceSchema = z.enum(["turn", "structured-intake"]);
export type DemoTelemetrySource = z.infer<typeof demoTelemetrySourceSchema>;

export const demoSignalComparisonStatusSchema = z.enum([
  "match",
  "mismatch",
  "inconclusive",
]);
export type DemoSignalComparisonStatus = z.infer<
  typeof demoSignalComparisonStatusSchema
>;

export const demoDisplayTelemetrySchema = z.object({
  type: z.literal("turn-telemetry"),
  turn: z.number().int().positive(),
  proposedAction: turnActionSchema,
  finalAction: turnActionSchema,
  servingMode: servingModeSchema.nullable(),
  actionChanged: z.boolean(),
  overrides: z.array(
    z.object({
      code: nonEmptyStringSchema,
      fromAction: turnActionSchema.nullable(),
      toAction: turnActionSchema,
    }),
  ),
  safetyFlags: z.array(safetyFlagSchema),
  retrieval: z.object({
    count: z.number().int().nonnegative(),
    topScore: z.number().finite().nonnegative(),
    matches: z.array(
      z.object({
        itemId: nonEmptyStringSchema,
        score: z.number().finite().nonnegative(),
        servingMode: servingModeSchema,
      }),
    ),
  }),
  signal: z.object({
    status: signalExtractionStatusSchema,
    primaryIntent: signalIntentSchema.nullable(),
    recommendedServingMode: servingModeSchema.nullable(),
    uncertainty: z.number().min(0).max(1).nullable(),
    comparison: demoSignalComparisonStatusSchema.nullable(),
  }),
  intake: z.object({
    collected: z.array(intakeFieldSchema),
    requested: z.array(intakeFieldSchema),
    handoffPending: z.boolean(),
  }),
  uiPrimitive: uiPrimitiveSchema,
  source: demoTelemetrySourceSchema,
});
export type DemoDisplayTelemetry = z.infer<typeof demoDisplayTelemetrySchema>;

export const demoTurnResponseSchema = z.object({
  conversationRef: nonEmptyStringSchema,
  requestRef: nonEmptyStringSchema.optional(),
  customerMessage: nonEmptyStringSchema,
  ui: uiPlanSchema,
  terminalSession: z.boolean(),
  hostContext: demoHostContextSchema,
  telemetry: demoDisplayTelemetrySchema,
  continuationToken: nonEmptyStringSchema.optional(),
});
export type DemoTurnResponse = z.infer<typeof demoTurnResponseSchema>;

export const demoSessionResponseSchema = z.object({
  conversationRef: nonEmptyStringSchema,
  continuationToken: nonEmptyStringSchema.optional(),
});
export type DemoSessionResponse = z.infer<typeof demoSessionResponseSchema>;

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
