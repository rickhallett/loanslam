import { z } from 'zod';

/**
 * Conversation phases (product brief §9). The phase is the single value the
 * frontend renders against; it must never infer the next phase locally.
 */
export const conversationPhaseSchema = z.enum([
  'anonymous_active', // session live, normal Q&A
  'collecting_info', // bot is clarifying / gathering what the customer needs
  'awaiting_intake', // a handoff/identity form has been requested
  'handoff_pending', // ticket created, awaiting human follow-up
  'safe_fallback', // could not safely answer; parked on fallback copy
]);
export type ConversationPhase = z.infer<typeof conversationPhaseSchema>;

/**
 * Standard handoff PII (brief §16). Bank/payment credentials are NEVER in this
 * set — collecting them is a non-negotiable release-rule violation.
 */
export const intakeFieldNameSchema = z.enum([
  'full_name',
  'date_of_birth',
  'address',
  'phone',
  'email',
  'context', // free-text situational context
]);
export type IntakeFieldName = z.infer<typeof intakeFieldNameSchema>;

export const intakeFieldSchema = z.object({
  name: intakeFieldNameSchema,
  label: z.string(),
  type: z.enum(['text', 'email', 'tel', 'date', 'textarea']),
  required: z.boolean(),
  placeholder: z.string().optional(),
});
export type IntakeField = z.infer<typeof intakeFieldSchema>;

/** Backend-provided form configuration; the widget renders exactly this. */
export const formConfigSchema = z.object({
  formId: z.string(),
  title: z.string(),
  description: z.string(),
  fields: z.array(intakeFieldSchema),
  submitLabel: z.string(),
});
export type FormConfig = z.infer<typeof formConfigSchema>;

/**
 * The PUBLIC view of conversation state returned to the browser. Deliberately
 * excludes any collected PII, the raw session id, and transcript — the browser
 * must not persist those (brief §5, §16).
 */
export const publicConversationStateSchema = z.object({
  phase: conversationPhaseSchema,
  /** True once a safety signal has been flagged this conversation. */
  vulnerabilityFlagged: z.boolean(),
  /** True when the backend is waiting on an intake form submission. */
  awaitingForm: z.boolean(),
  /** Short, non-sensitive summary of what the customer is trying to do. */
  goalSummary: z.string().nullable(),
});
export type PublicConversationState = z.infer<typeof publicConversationStateSchema>;
