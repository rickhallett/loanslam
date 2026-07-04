import { z } from "zod";

import {
  safetyFlagSchema,
  servingModeSchema,
  turnActionSchema,
} from "./schemas.runtime";
import { stochasticAxisValuesSchema } from "./schemas.eval";

// STS v2 (reactive battery) schemas. The initialization shape is frozen by the
// keel spec (docs/prds/2026-07-03-sts-v2-keel-spec.md, section 2): the seeded,
// deterministic half of a trajectory. Turn content is generated live and is
// NOT replayable bit-for-bit; transcripts persist so any trajectory can be
// regraded without re-simulation.

export const sts2ProfileSchema = z.enum(["smoke", "review", "soak"]);
export type Sts2Profile = z.infer<typeof sts2ProfileSchema>;

// v1 persona styles plus `persistent`: benign repetition pressure (the
// customer re-asks their core question even after a good answer).
export const sts2PersonaStyleSchema = z.enum([
  "cooperative",
  "terse",
  "confused",
  "impatient",
  "adversarial",
  "vulnerable",
  "persistent",
]);
export type Sts2PersonaStyle = z.infer<typeof sts2PersonaStyleSchema>;

export const sts2GoalSchema = z.object({
  intent: stochasticAxisValuesSchema.shape.intent,
  objective: z.string().min(1),
});
export type Sts2Goal = z.infer<typeof sts2GoalSchema>;

export const sts2KnowledgeSchema = z.object({
  knows: z.array(z.string()),
  doesNotKnow: z.array(z.string()),
});
export type Sts2Knowledge = z.infer<typeof sts2KnowledgeSchema>;

export const sts2FrustrationStepSchema = z.object({
  afterTurn: z.number().int().nonnegative(),
  mood: z.string().min(1),
});

export const sts2PatienceBudgetSchema = z.object({
  maxTurns: z.number().int().positive(),
  frustrationSchedule: z.array(sts2FrustrationStepSchema),
});
export type Sts2PatienceBudget = z.infer<typeof sts2PatienceBudgetSchema>;

export const sts2PersonaSchema = z.object({
  style: sts2PersonaStyleSchema,
  goal: sts2GoalSchema,
  knowledge: sts2KnowledgeSchema,
  patienceBudget: sts2PatienceBudgetSchema,
});
export type Sts2Persona = z.infer<typeof sts2PersonaSchema>;

export const sts2SurfaceSchema = z.object({
  page: z.string().min(1),
  formState: z.record(z.string(), z.string()).nullable(),
});
export type Sts2Surface = z.infer<typeof sts2SurfaceSchema>;

export const sts2InitializationSchema = z.object({
  seed: z.string().min(1),
  profile: sts2ProfileSchema,
  scenarioPath: z.string().min(1),
  persona: sts2PersonaSchema,
  languageNoise: stochasticAxisValuesSchema.shape.languageNoise,
  riskMarker: stochasticAxisValuesSchema.shape.riskMarker,
  surface: sts2SurfaceSchema,
  turnCap: z.number().int().positive(),
});
export type Sts2Initialization = z.infer<typeof sts2InitializationSchema>;

// Customer-agent turn outcome: `continue` keeps the conversation going;
// `satisfied` ends it with the goal met or a safe boundary accepted;
// `giving_up` ends it with patience exhausted.
export const sts2CustomerOutcomeSchema = z.enum([
  "continue",
  "satisfied",
  "giving_up",
]);
export type Sts2CustomerOutcome = z.infer<typeof sts2CustomerOutcomeSchema>;

export const sts2UsageSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  cachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
});
export type Sts2Usage = z.infer<typeof sts2UsageSchema>;

export const sts2TranscriptTurnSchema = z.object({
  turnIndex: z.number().int().nonnegative(),
  customerMessage: z.string().min(1),
  customerOutcome: sts2CustomerOutcomeSchema,
  botMessage: z.string(),
  finalAction: turnActionSchema,
  effectiveServingMode: servingModeSchema.nullable(),
  safetyFlags: z.array(safetyFlagSchema),
  validatorOverrideCodes: z.array(z.string()),
  customerUsage: sts2UsageSchema,
});
export type Sts2TranscriptTurn = z.infer<typeof sts2TranscriptTurnSchema>;

export const sts2EndReasonSchema = z.enum([
  "satisfied",
  "giving_up",
  "turn_cap",
  "error",
]);
export type Sts2EndReason = z.infer<typeof sts2EndReasonSchema>;

export const sts2TrajectorySchema = z.object({
  scenarioPath: z.string().min(1),
  initialization: sts2InitializationSchema,
  turns: z.array(sts2TranscriptTurnSchema),
  endReason: sts2EndReasonSchema,
  error: z.string().nullable(),
});
export type Sts2Trajectory = z.infer<typeof sts2TrajectorySchema>;

// Per-model rates snapshot recorded with every run so cost receipts are
// self-describing. Estimates only; billing exports are the settlement truth.
export const sts2RateSnapshotSchema = z.object({
  model: z.string().min(1),
  inputPerMTok: z.number().nonnegative(),
  cachedInputPerMTok: z.number().nonnegative(),
  outputPerMTok: z.number().nonnegative(),
  source: z.string().min(1),
});

export const sts2UsageReceiptSchema = z.object({
  customerModel: z.string().min(1),
  calls: z.number().int().nonnegative(),
  totals: sts2UsageSchema,
  estimatedCostUsd: z.number().nonnegative(),
  rates: sts2RateSnapshotSchema,
});
export type Sts2UsageReceipt = z.infer<typeof sts2UsageReceiptSchema>;

// Verdict vocabulary is frozen by the keel; judge verdicts arrive with
// arc-002. Until a judge pass runs, reports carry `ungraded`.
export const sts2RunVerdictSchema = z.enum([
  "ungraded",
  "blocked",
  "useful_with_findings",
  "clean",
]);
export type Sts2RunVerdict = z.infer<typeof sts2RunVerdictSchema>;

export const sts2TrajectorySummarySchema = z.object({
  scenarioPath: z.string().min(1),
  personaStyle: sts2PersonaStyleSchema,
  intent: stochasticAxisValuesSchema.shape.intent,
  languageNoise: stochasticAxisValuesSchema.shape.languageNoise,
  riskMarker: stochasticAxisValuesSchema.shape.riskMarker,
  turnCount: z.number().int().nonnegative(),
  endReason: sts2EndReasonSchema,
  finalActions: z.array(turnActionSchema),
  safetyFlagCounts: z.record(z.string(), z.number().int().nonnegative()),
});
export type Sts2TrajectorySummary = z.infer<typeof sts2TrajectorySummarySchema>;

export const sts2RunReportSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string().min(1),
  seed: z.string().min(1),
  profile: sts2ProfileSchema,
  customerModel: z.string().min(1),
  plannerModel: z.string().min(1),
  generatedAt: z.string().min(1),
  verdict: sts2RunVerdictSchema,
  trajectories: z.array(sts2TrajectorySummarySchema),
  usage: sts2UsageReceiptSchema,
  replay: z.object({
    regenerateCommand: z.string().min(1),
    regradeCommand: z.string().min(1),
  }),
});
export type Sts2RunReport = z.infer<typeof sts2RunReportSchema>;
