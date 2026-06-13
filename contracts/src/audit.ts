import { z } from 'zod';
import { replyModeSchema } from './chat.js';
import { servingModeSchema } from './kb.js';

/**
 * Audit event taxonomy. Full auditability is the one non-negotiable compliance
 * requirement (brief §13, §16): every inbound and outbound message, and every
 * routing decision, is persisted and reviewable, correlated by conversation +
 * request reference. Do not drop any inbound/outbound message from this trail.
 */
export const auditEventTypeSchema = z.enum([
  'session_created',
  'message_inbound', // a customer message was received
  'message_outbound', // a bot reply was sent
  'vulnerability_check', // result of the fail-closed safety gate
  'classification', // classifier output
  'routing_decision', // the safe action chosen
  'grounding_check', // retrieval + grounding gate result
  'ticket_created', // handoff ticket pushed to the webhook adapter
  'intake_submitted', // a handoff form was submitted
  'conversation_reset',
  'extraction', // structured slot/signal extraction result (journey modelling)
  'collection_step', // a slot-filling step (asked / filled / corrected / refused)
  'failure', // any failure path (unsafe, fallback error, ticket error)
]);
export type AuditEventType = z.infer<typeof auditEventTypeSchema>;

/**
 * Reason codes explain *why* a route was taken. They make the audit trail
 * machine-reviewable for the offline feedback loop (brief §17).
 */
export const reasonCodeSchema = z.enum([
  'grounded_answer', // answered from approved KB
  'clarify_needed', // asked for more info
  'no_grounding', // nothing in KB grounded an answer -> safe route
  'account_specific', // needs real account data -> handoff
  'change_request', // asked to change a loan application -> handoff
  'excluded_topic', // public but must-not-serve (e.g. APR) -> safe route
  'vulnerability_signal', // distress/difficulty detected -> human
  'ambiguous_or_noisy', // short/unclear message -> clarify/fallback
  'unsupported', // outside scope -> refusal/fallback
  'model_error_failclosed', // gate/model errored -> treated as vulnerability
  'rate_limited',
  'intake_complete', // handoff details collected
  // ── Slot-filling collection (PRD §4.2, §5) ──────────────────────────────────
  'slot_asked', // asked the customer for the next missing slot
  'slot_filled', // accepted one or more slot values this turn
  'slot_corrected', // customer corrected an earlier slot value
  'slot_refused', // customer declined to provide a requested slot
  'collection_confirmed', // customer confirmed the collected set (confidence gate)
  'budget_exhausted', // clarification/turn budget hit -> escalate to a human
]);
export type ReasonCode = z.infer<typeof reasonCodeSchema>;

/**
 * One persisted audit event. `payload` carries redacted, structured detail
 * (never raw bank/payment credentials). Inbound/outbound message text is stored
 * for transcript review per the brief, correlated by the two refs.
 */
export const auditEventSchema = z.object({
  id: z.string(),
  conversationRef: z.string(),
  requestRef: z.string(),
  type: auditEventTypeSchema,
  /** ISO-8601 timestamp. */
  ts: z.string(),
  /** Version of the routing/policy config in effect, for replayability. */
  policyVersion: z.string(),
  reasonCode: reasonCodeSchema.nullable().default(null),
  replyMode: replyModeSchema.nullable().default(null),
  groundingServingMode: servingModeSchema.nullable().default(null),
  /** Free-form, redacted, structured detail. */
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type AuditEvent = z.infer<typeof auditEventSchema>;

/** A stored transcript line (the durable inbound/outbound message log). */
export const transcriptEntrySchema = z.object({
  id: z.string(),
  conversationRef: z.string(),
  requestRef: z.string(),
  direction: z.enum(['inbound', 'outbound']),
  /** 'customer' for inbound; 'bot' for outbound. */
  author: z.enum(['customer', 'bot']),
  text: z.string(),
  replyMode: replyModeSchema.nullable().default(null),
  ts: z.string(),
});
export type TranscriptEntry = z.infer<typeof transcriptEntrySchema>;
