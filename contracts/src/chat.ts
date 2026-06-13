import { z } from 'zod';
import { citationSchema, kbLinkSchema } from './kb.js';
import { formConfigSchema, publicConversationStateSchema } from './state.js';

/**
 * The reply the backend selected for this turn. The frontend renders against
 * `mode` and never decides the mode itself. Every customer-facing answer that
 * carries facts (`answer`) MUST also carry citations — that is the visible
 * proof of grounding.
 */
export const replyModeSchema = z.enum([
  'answer', // grounded answer from approved KB
  'clarify', // ask a clarifying / info-collection question
  'fallback', // safe fallback copy; nothing grounded
  'handoff', // routed to a human (ticket may be created)
  'vulnerability', // escalation copy for a safety signal
  'refusal', // unsupported / unsafe request, safely declined
  'intake_request', // asking the customer to complete a handoff form
]);
export type ReplyMode = z.infer<typeof replyModeSchema>;

const replyBase = {
  /** Customer-facing copy chosen by the backend (model-phrased or template). */
  text: z.string(),
};

export const replySchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('answer'),
    ...replyBase,
    citations: z.array(citationSchema).min(1),
    links: z.array(kbLinkSchema).default([]),
  }),
  z.object({ mode: z.literal('clarify'), ...replyBase }),
  z.object({ mode: z.literal('fallback'), ...replyBase }),
  z.object({
    mode: z.literal('handoff'),
    ...replyBase,
    ticketRef: z.string().nullable().default(null),
  }),
  z.object({
    mode: z.literal('vulnerability'),
    ...replyBase,
    /** Approved support resources (e.g. StepChange/MoneyHelper). */
    links: z.array(kbLinkSchema).default([]),
    ticketRef: z.string().nullable().default(null),
  }),
  z.object({ mode: z.literal('refusal'), ...replyBase }),
  z.object({
    mode: z.literal('intake_request'),
    ...replyBase,
    form: formConfigSchema,
  }),
]);
export type Reply = z.infer<typeof replySchema>;

/**
 * Common payload returned on every successful turn (brief §8): a non-secret
 * conversation reference, a per-request reference, the current public state,
 * and the backend-selected reply.
 */
export const chatTurnResponseSchema = z.object({
  conversationRef: z.string(),
  requestRef: z.string(),
  state: publicConversationStateSchema,
  reply: replySchema,
});
export type ChatTurnResponse = z.infer<typeof chatTurnResponseSchema>;

// ── Requests ────────────────────────────────────────────────────────────────
// The session is carried by an HttpOnly cookie — never in the body, never read
// by browser JS (brief §16). Requests therefore omit any session id.

export const createSessionRequestSchema = z.object({
  locale: z.string().optional(),
});
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export const messageRequestSchema = z.object({
  /** Client-generated idempotency key; de-dupes retries within a session. */
  clientMessageId: z.string().min(1).max(200),
  text: z.string().min(1).max(4000),
});
export type MessageRequest = z.infer<typeof messageRequestSchema>;

export const intakeRequestSchema = z.object({
  formId: z.string().min(1),
  values: z.record(z.string(), z.string()),
});
export type IntakeRequest = z.infer<typeof intakeRequestSchema>;

export const resetRequestSchema = z.object({});
export type ResetRequest = z.infer<typeof resetRequestSchema>;

// ── Response objects ─────────────────────────────────────────────────────────

export const sessionCreatedResponseSchema = chatTurnResponseSchema;
export type SessionCreatedResponse = z.infer<typeof sessionCreatedResponseSchema>;

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number(),
  aiEnabled: z.boolean(),
  persistence: z.string(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
